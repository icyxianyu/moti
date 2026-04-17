"use client";

import { useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Square } from "lucide-react";
import { StreamOutput } from "@/components/stream-output";
import { RetrievalPanel } from "@/components/retrieval-panel";
import type { RightPanelState } from "@/app/page";

interface Props {
  authorId: string;
  onGenerate: () => void;
  rightState: RightPanelState;
  setRightState: React.Dispatch<React.SetStateAction<RightPanelState>>;
}

interface RetrievalItem {
  index: number;
  text: string;
  score: number;
  source: string | null;
  type: string;
}

export function TabCompose({ authorId, onGenerate, rightState, setRightState }: Props) {
  const [topic, setTopic] = useState("");
  const [events, setEvents] = useState("");
  const [context, setContext] = useState("");
  const [extra, setExtra] = useState("");
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [streamText, setStreamText] = useState("");
  const [retrievalItems, setRetrievalItems] = useState<RetrievalItem[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim() || generating) return;

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
          topic: topic.trim(),
          events: events.trim() || undefined,
          context: context.trim() || undefined,
          extraNote: extra.trim() || undefined,
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
  }, [topic, events, context, extra, authorId, generating, onGenerate]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setGenerating(false);
    setStatusMsg("已停止");
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(streamText);
  }, [streamText]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#71717A]">
          文章主题 <span className="text-[#C8A96E]">*</span>
        </label>
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={200}
          placeholder="例如：为什么独立游戏正在吞噬 3A 大作的灵魂"
          className="border-[#2A2A2E] bg-[#141416] text-[#E4E4E7] placeholder:text-[#52525B] focus-visible:ring-[#C8A96E]/30"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#71717A]">
            相关事件 <span className="text-[10px] font-normal text-[#52525B]">现实 / 历史</span>
          </label>
          <Textarea
            value={events}
            onChange={(e) => setEvents(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="例如：2024年《小丑牌》获年度最佳"
            className="resize-none border-[#2A2A2E] bg-[#141416] text-[#E4E4E7] placeholder:text-[#52525B] focus-visible:ring-[#C8A96E]/30 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#71717A]">
            背景补充 <span className="text-[10px] font-normal text-[#52525B]">行业 / 文化</span>
          </label>
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="例如：Steam独立游戏市场份额连续3年增长"
            className="resize-none border-[#2A2A2E] bg-[#141416] text-[#E4E4E7] placeholder:text-[#52525B] focus-visible:ring-[#C8A96E]/30 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#71717A]">
          额外要求 <span className="text-[10px] font-normal text-[#52525B]">可选</span>
        </label>
        <Textarea
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="例如：结尾用一个具体的画面定格，不要抒情升华"
          className="resize-none border-[#2A2A2E] bg-[#141416] text-[#E4E4E7] placeholder:text-[#52525B] focus-visible:ring-[#C8A96E]/30 text-sm"
        />
      </div>

      <Button
        onClick={handleGenerate}
        disabled={!topic.trim() || generating}
        className="w-full bg-[#C8A96E] text-[#0A0A0B] font-medium hover:bg-[#8A7344] disabled:opacity-40 transition-all"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {generating ? "生成中…" : "生成文章"}
      </Button>

      {/* Retrieval Panel */}
      {retrievalItems.length > 0 && <RetrievalPanel items={retrievalItems} />}

      {/* Stream Output - renders into the right panel via portal */}
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
