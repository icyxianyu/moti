"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle } from "lucide-react";
import { StreamOutput } from "@/components/editor/stream-output";
import { RetrievalPanel } from "@/components/editor/retrieval-panel";
import { PromptFieldEditor } from "@/components/editor/prompt-field-editor";

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

interface QuotaInfo {
  role: "user" | "admin";
  monthly_quota: number;
  quota_used: number;
}

export function TabCompose({ authorId, onGenerate, draft, onDraftChange }: Props) {
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [streamText, setStreamText] = useState("");
  const [retrievalItems, setRetrievalItems] = useState<RetrievalItem[]>([]);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const refreshQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        const data = await res.json();
        setQuota({
          role: data.role,
          monthly_quota: data.monthly_quota,
          quota_used: data.quota_used,
        });
      }
    } catch {
      // 静默失败，不影响主流程
    }
  }, []);

  useEffect(() => {
    refreshQuota();
  }, [refreshQuota]);

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
      refreshQuota();
    }
  }, [draft, authorId, generating, onGenerate, refreshQuota]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setGenerating(false);
    setStatusMsg("已停下。已经写出的部分会留在历史里。");
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(streamText);
  }, [streamText]);

  const filledCount = [draft.topic, draft.events, draft.context, draft.extra].filter((item) => item.trim()).length;

  const quotaLeft = quota ? Math.max(quota.monthly_quota - quota.quota_used, 0) : null;
  const isAdmin = quota?.role === "admin";
  const quotaDepleted = !isAdmin && quotaLeft !== null && quotaLeft <= 0;
  const quotaLow = !isAdmin && quotaLeft !== null && quotaLeft > 0 && quotaLeft <= 10;

  const quotaHint = (() => {
    if (!quota || isAdmin) return null;

    if (quotaDepleted) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#EF4444]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>本月额度已用完（{quota.quota_used}/{quota.monthly_quota}），下月初自动重置，或联系管理员加额度。</span>
        </div>
      );
    }

    if (quotaLow) {
      return (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>本月还剩 <span className="tabular-nums font-semibold">{quotaLeft}</span> 次</span>
          </div>
          <span className="text-[10px] text-amber-400/70 tabular-nums">{quota.quota_used}/{quota.monthly_quota}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-[#2A2A2E] bg-[#141416] px-3 py-2 text-xs text-[#A1A1AA]">
        <span>本月还可生成 <span className="tabular-nums text-[#E4E4E7] font-medium">{quotaLeft}</span> 次</span>
        <span className="text-[10px] text-[#52525B] tabular-nums">{quota.quota_used}/{quota.monthly_quota}</span>
      </div>
    );
  })();

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="overflow-hidden rounded-2xl border border-[#2A2A2E] bg-[linear-gradient(145deg,rgba(200,169,110,0.14),rgba(20,20,22,0.98)_48%,rgba(10,10,11,1))] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[#C8A96E]/80">
              <Sparkles className="h-3.5 w-3.5" />
              今天想写什么
            </div>
            <h3 className="text-base font-semibold text-[#F4F4F5]">告诉 Moti 你的主题，剩下的交给他</h3>
            <p className="text-sm leading-6 text-[#A1A1AA]">
              主题必填，其余三项想补什么补什么。写得越具体，替你下笔的那个人越像你想要的样子。
            </p>
          </div>
          <div className="shrink-0 self-start whitespace-nowrap rounded-full border border-[#C8A96E]/20 bg-[#0A0A0B]/60 px-3 py-1 text-xs tabular-nums text-[#E7D2A6]">
            已填写 {filledCount}/4
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <PromptFieldEditor
          label="这次想写什么"
          hint="主题"
          description="一句话说清你想写的那件事、那个观点、那场争论。"
          placeholder="例如：为什么独立游戏正在吞噬 3A 大作的灵魂"
          value={draft.topic}
          onChange={(value) => onDraftChange({ topic: value })}
          maxLength={200}
          required
          multiline={false}
        />

        <PromptFieldEditor
          label="想提到的事件"
          hint="选填"
          description="哪些新闻、案例、故事你希望这篇文章里出现。"
          placeholder="例如：2024 年《小丑牌》拿下年度最佳"
          value={draft.events}
          onChange={(value) => onDraftChange({ events: value })}
          maxLength={500}
          rows={10}
        />

        <PromptFieldEditor
          label="背景信息"
          hint="选填"
          description="这件事发生在什么时代、什么语境里，补几句背景会让文章更有力气。"
          placeholder="例如：Steam 独立游戏市场份额连续 3 年增长"
          value={draft.context}
          onChange={(value) => onDraftChange({ context: value })}
          maxLength={1500}
          rows={14}
        />

        <PromptFieldEditor
          label="你想要的味道"
          hint="选填"
          description="希望语气怎样、结构怎么铺、结尾落在哪里，或者你不想看到什么。"
          placeholder="例如：结尾用一个具体的画面定格，不要抒情升华"
          value={draft.extra}
          onChange={(value) => onDraftChange({ extra: value })}
          maxLength={500}
          rows={12}
        />
      </div>

      {quotaHint}

      <Button
        onClick={handleGenerate}
        disabled={!draft.topic.trim() || generating || quotaDepleted}
        className="h-11 w-full rounded-2xl bg-[#C8A96E] text-[#0A0A0B] font-medium hover:bg-[#8A7344] disabled:opacity-40 transition-all"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {generating ? "正在下笔…" : quotaDepleted ? "本月额度已用完" : "开始下笔"}
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
