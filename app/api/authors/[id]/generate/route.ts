import { NextRequest } from "next/server";
import { getAuthor, createGeneration } from "@/lib/db";
import { embed } from "@/lib/embedder";
import { query, randomSample } from "@/lib/vector-store";
import { generateArticle } from "@/lib/generator";
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

  const encoder = new TextEncoder();
  const abortController = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send("status", { message: "正在检索相关段落…" });
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
          message: `检索到 ${allHits.length} 个参考片段（${topicHits.length} 主题相关 + ${dedupedStyleHits.length} 风格示范），开始生成…`,
        });

        const fullText = await generateArticle({
          topic: topic.trim(),
          extraNote: extraNote ?? "",
          events: events ?? "",
          context: context ?? "",
          chunks,
          styleMd: author.style_md,
          onToken: (token) => send("token", { token }),
          signal: abortController.signal,
        });

        // 保存生成历史
        createGeneration(
          genId(),
          id,
          topic.trim(),
          events || null,
          context || null,
          extraNote || null,
          fullText,
          nowISO()
        );

        send("done", { message: "生成完成" });
      } catch (err) {
        if (!abortController.signal.aborted) {
          send("error", { message: (err as Error).message });
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      abortController.abort();
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
