import { NextRequest } from "next/server";
import { createGeneration, consumeQuota, getUser } from "@/lib/db/sqlite";
import type { GenerationStatus } from "@/lib/db/sqlite";
import { embed } from "@/lib/ai/embedder";
import { query, randomSample } from "@/lib/db/vector-store";
import { generateArticle } from "@/lib/rag/generator";
import type { LLMConfigOverride } from "@/lib/ai/llm";
import { generateLimiter } from "@/lib/runtime/task-limiter";
import { requireUser } from "@/lib/auth/session";
import { getAuthorForRead } from "@/lib/auth/access";
import { genId, nowISO } from "@/lib/utils";

interface Ctx {
  params: Promise<{ id: string }>;
}

const json = (obj: unknown, status: number) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function POST(req: NextRequest, ctx: Ctx) {
  const authUser = await requireUser();
  if (authUser instanceof Response) return authUser;

  const { id } = await ctx.params;
  // 生成 = 读权限即可（公共作家大家都能用来生成）
  const author = getAuthorForRead(id, authUser);
  if (author instanceof Response) return author;

  const body = await req.json();
  const { topic, extraNote, events, context } = body;

  if (!topic || typeof topic !== "string" || !topic.trim()) {
    return json({ error: "请提供文章主题" }, 400);
  }

  // 取完整的 user record，拿到 llm_* 覆盖与 quota
  const userRecord = getUser(authUser.id);
  if (!userRecord) return json({ error: "会话已失效" }, 401);

  // 配额扣减（admin 初始配额 999999，等同无限制）
  // 非原子 + 原子：先消费，失败直接 402-like 返回；下面的生成若失败不退还，因为大模型 token 也烧掉了
  const consumed = consumeQuota(authUser.id, nowISO());
  if (!consumed) {
    return json(
      {
        error: `本月生成额度已用完（${userRecord.monthly_quota} 次/月）。下月自动重置，或联系管理员提升额度。`,
        code: "QUOTA_EXCEEDED",
      },
      429
    );
  }

  // 用户自带 LLM：三项齐备才启用；否则 fallback 到系统环境变量
  const llmOverride: LLMConfigOverride | undefined =
    userRecord.llm_base_url && userRecord.llm_api_key && userRecord.llm_model
      ? {
          baseURL: userRecord.llm_base_url,
          apiKey: userRecord.llm_api_key,
          model: userRecord.llm_model,
        }
      : undefined;

  // 生成任务通常会持续占用检索、模型请求和流式输出资源，因此先抢占一个并发槽位。
  const release = generateLimiter.tryAcquire();
  if (!release) {
    return json({ error: "当前生成任务较多，请稍后再试" }, 429);
  }

  const encoder = new TextEncoder();
  const abortController = new AbortController();

  let accumulated = "";
  let persisted = false;
  const persist = (status: GenerationStatus) => {
    if (persisted) return;
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
        status,
        authUser.id // owner_id：历史严格归调用者
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
        send("status", { message: "Moti 正在翻他的旧作，找和这次主题有关的段落…" });
        const queryVec = await embed(topic);

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
          message: `挑出了 ${allHits.length} 段当参考（${topicHits.length} 段贴主题，${dedupedStyleHits.length} 段学笔法），开始下笔。`,
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
          llmOverride,
        });

        if (abortController.signal.aborted) {
          persist("aborted");
          return;
        }

        accumulated = fullText;
        persist("completed");

        send("done", { message: "生成完成" });
      } catch (err) {
        persist("failed");
        if (!abortController.signal.aborted) {
          send("error", { message: (err as Error).message });
        }
      } finally {
        release();
        controller.close();
      }
    },
    cancel() {
      abortController.abort();
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
