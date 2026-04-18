"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { StreamOutput } from "@/components/stream-output";
import { RetrievalPanel } from "@/components/retrieval-panel";
import { PromptFieldEditor } from "@/components/prompt-field-editor";

export interface ComposeDraft {
  topic: string;
  events: string;
  context: string;
  extra: string;
}

interface Props {
  authorId: string;
  onGenerate: () => void;
  draft: ComposeDraft;
  onDraftChange: (patch: Partial<ComposeDraft>) => void;
}

interface RetrievalItem {
  index: number;
  text: string;
  score: number;
  source: string | null;
  type: string;
}

export function TabCompose({ authorId, onGenerate, draft, onDraftChange }: Props) {
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [streamText, setStreamText] = useState("");
  const [retrievalItems, setRetrievalItems] = useState<RetrievalItem[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!draft.topic.trim() || generating) return;

    setGenerating(true);
    setStatusMsg("正在准备…");
    setStreamText("");
    setRetrievalItems([]);
    onGenerate();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/authors/${authorId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: draft.topic.trim(),
          events: draft.events.trim() || undefined,
          context: draft.context.trim() || undefined,
          extraNote: draft.extra.trim() || undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json();
        setStatusMsg(`错误: ${err.error ?? "请求失败"}`);
        setGenerating(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            switch (eventType) {
              case "status":
                setStatusMsg(data.message);
                break;
              case "retrieval":
                setRetrievalItems(data.items);
                break;
              case "token":
                setStreamText((prev) => prev + data.token);
                break;
              case "done":
                setStatusMsg("生成完成");
                break;
              case "error":
                setStatusMsg(`错误: ${data.message}`);
                break;
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setStatusMsg(`错误: ${(err as Error).message}`);
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }, [draft, authorId, generating, onGenerate]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setGenerating(false);
    setStatusMsg("已停止");
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(streamText);
  }, [streamText]);

  const filledCount = [draft.topic, draft.events, draft.context, draft.extra].filter((item) => item.trim()).length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="overflow-hidden rounded-2xl border border-[#2A2A2E] bg-[linear-gradient(145deg,rgba(200,169,110,0.14),rgba(20,20,22,0.98)_48%,rgba(10,10,11,1))] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[#C8A96E]/80">
              <Sparkles className="h-3.5 w-3.5" />
              创作输入区
            </div>
            <h3 className="text-base font-semibold text-[#F4F4F5]">把提示词收进左栏，把长内容放进弹窗</h3>
            <p className="text-sm leading-6 text-[#A1A1AA]">
              左侧只保留摘要，真正输入时点击“展开编辑”，可以在更大的空间里整理主题、背景和额外要求。
            </p>
          </div>
          <div className="shrink-0 self-start whitespace-nowrap rounded-full border border-[#C8A96E]/20 bg-[#0A0A0B]/60 px-3 py-1 text-xs tabular-nums text-[#E7D2A6]">
            已填写 {filledCount}/4
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <PromptFieldEditor
          label="文章主题"
          hint="核心命题"
          description="建议用一句话写清楚你真正想表达的观点或争议点。"
          placeholder="例如：为什么独立游戏正在吞噬 3A 大作的灵魂"
          value={draft.topic}
          onChange={(value) => onDraftChange({ topic: value })}
          maxLength={200}
          required
          multiline={false}
        />

        <PromptFieldEditor
          label="相关事件"
          hint="现实 / 历史"
          description="可填写新闻、行业事件、历史案例，给模型更明确的论据抓手。"
          placeholder="例如：2024年《小丑牌》获年度最佳"
          value={draft.events}
          onChange={(value) => onDraftChange({ events: value })}
          maxLength={500}
          rows={10}
        />

        <PromptFieldEditor
          label="背景补充"
          hint="行业 / 文化"
          description="补充行业背景、文化语境、市场变化，帮助模型理解你想站在哪个角度写。"
          placeholder="例如：Steam独立游戏市场份额连续3年增长"
          value={draft.context}
          onChange={(value) => onDraftChange({ context: value })}
          maxLength={500}
          rows={10}
        />

        <PromptFieldEditor
          label="额外要求"
          hint="语气 / 结构"
          description="告诉模型你想要的语气、结构、结尾方式，或者明确避免哪些常见套路。"
          placeholder="例如：结尾用一个具体的画面定格，不要抒情升华"
          value={draft.extra}
          onChange={(value) => onDraftChange({ extra: value })}
          maxLength={500}
          rows={12}
        />
      </div>

      <Button
        onClick={handleGenerate}
        disabled={!draft.topic.trim() || generating}
        className="h-11 w-full rounded-2xl bg-[#C8A96E] text-[#0A0A0B] font-medium hover:bg-[#8A7344] disabled:opacity-40 transition-all"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {generating ? "生成中…" : "生成文章"}
      </Button>

      {retrievalItems.length > 0 && <RetrievalPanel items={retrievalItems} />}

      {(generating || streamText) && (
        <StreamOutput
          text={streamText}
          statusMsg={statusMsg}
          generating={generating}
          onStop={handleStop}
          onCopy={handleCopy}
        />
      )}
    </div>
  );
}
