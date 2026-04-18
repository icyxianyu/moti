import { NextRequest } from "next/server";
import { getAuthor, createGeneration } from "@/lib/db";
import type { GenerationStatus } from "@/lib/db";
import { embed } from "@/lib/embedder";
import { query, randomSample } from "@/lib/vector-store";
import { generateArticle } from "@/lib/generator";
import { generateLimiter } from "@/lib/task-limiter";
import { genId, nowISO } from "@/lib/utils";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const author = getAuthor(id);
  if (!author) {
    return new Response(JSON.stringify({ error: "作者不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { topic, extraNote, events, context } = body;

  if (!topic || typeof topic !== "string" || !topic.trim()) {
    return new Response(JSON.stringify({ error: "请提供文章主题" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return new Response(JSON.stringify({ error: "未配置 DEEPSEEK_API_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 生成任务通常会持续占用检索、模型请求和流式输出资源，因此先抢占一个并发槽位。
  const release = generateLimiter.tryAcquire();
  if (!release) {
    return new Response(JSON.stringify({ error: "当前生成任务较多，请稍后再试" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  // 客户端如果提前断开，这里会把取消信号一路传到下游生成流程，避免后台继续白跑。
  const abortController = new AbortController();

  // 在闭包中累积已经产生的 token，方便 abort / error 时把已经生成的内容落库，避免白跑。
  let accumulated = "";
  let persisted = false;
  const persist = (status: GenerationStatus) => {
    if (persisted) return;
    // 完全没有产出（例如检索阶段就失败）就不要留下一条空记录污染历史列表。
    if (!accumulated.trim()) return;
    persisted = true;
    try {
      createGeneration(
        genId(),
        id,
        topic.trim(),
        events || null,
        context || null,
        extraNote || null,
        accumulated,
        nowISO(),
        status
      );
    } catch (e) {
      console.error("[generate] persist failed:", e);
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send("status", { message: "正在检索相关段落…" });
        const queryVec = await embed(topic);

        // 一部分片段按主题召回，另一部分随机采样作为“风格示范”，两者组合后交给生成模型。
        const topicHits = await query(id, queryVec, 3);
        const styleHits = await randomSample(id, 2);

        const seenIds = new Set(topicHits.map((h) => h.metadata.id));
        const dedupedStyleHits = styleHits.filter((h) => !seenIds.has(h.metadata.id));

        const allHits = [
          ...topicHits.map((h) => ({ ...h, type: "主题相关" as const })),
          ...dedupedStyleHits.map((h) => ({ ...h, type: "风格示范" as const })),
        ];

        const chunks = allHits.map((h) => h.metadata.text);
        send("retrieval", {
          items: allHits.map((h, i) => ({
            index: i + 1,
            text: h.metadata.text,
            score: h.score,
            source: h.metadata.source ?? null,
            type: h.type,
          })),
        });
        send("status", {
          message: `检索到 ${allHits.length} 个参考片段（${topicHits.length} 主题相关 + ${dedupedStyleHits.length} 风格示范），开始生成…`,
        });

        const fullText = await generateArticle({
          topic: topic.trim(),
          extraNote: extraNote ?? "",
          events: events ?? "",
          context: context ?? "",
          chunks,
          styleMd: author.style_md,
          onToken: (token) => {
            accumulated += token;
            send("token", { token });
          },
          signal: abortController.signal,
        });

        // 客户端断开或主动停止时，把已经生成的部分作为 aborted 状态落库，避免完全丢失。
        if (abortController.signal.aborted) {
          persist("aborted");
          return;
        }

        // 正常完成：以 fullText 为准（防止最后一段 token 没走 onToken），覆盖累积值。
        accumulated = fullText;
        persist("completed");

        send("done", { message: "生成完成" });
      } catch (err) {
        // 请求途中报错：如果已经生成了一部分，也应作为 failed 记录保留下来。
        persist("failed");
        if (!abortController.signal.aborted) {
          send("error", { message: (err as Error).message });
        }
      } finally {
        // 无论成功、失败还是客户端取消，都要释放并发槽位，避免额度泄漏。
        release();
        controller.close();
      }
    },
    cancel() {
      abortController.abort();
      // cancel() 由 runtime 在客户端断开时触发，这里兜底再写一次。
      persist("aborted");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
