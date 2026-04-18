"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Wand2,
  Loader2,
  Save,
  ChevronDown,
  ChevronUp,
  Pencil,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Clock,
} from "lucide-react";
import type { Author } from "@/hooks/use-authors";

interface Props {
  author: Author;
  onRefreshAuthors: () => void;
}

/** 将 ISO 时间字符串格式化为相对时间或简短时间 */
function formatAnalyzedTime(isoStr: string | null): string {
  if (!isoStr) return "";
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;

  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StylePanel({ author, onRefreshAuthors }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [styleText, setStyleText] = useState(author.style_md ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStyleText(author.style_md ?? "");
    setEditing(false);
  }, [author.id, author.style_md]);

  const isQueued = author.style_status === "queued";
  const isAnalyzing = author.style_status === "analyzing";
  const isBusy = isQueued || isAnalyzing;
  const isDone = author.style_status === "done";
  const isFailed = author.style_status === "failed";
  const hasStyle = !!author.style_md;

  const handleAnalyze = useCallback(async () => {
    try {
      const res = await fetch(`/api/authors/${author.id}/analyze-style`, {
        method: "POST",
      });
      if (res.ok) {
        onRefreshAuthors();
      } else {
        const data = await res.json();
        if (res.status === 409) {
          onRefreshAuthors();
        } else {
          console.error("[StylePanel] 分析请求失败:", data.error);
        }
      }
    } catch (err) {
      console.error("[StylePanel] 网络错误:", err);
    }
  }, [author.id, onRefreshAuthors]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/authors/${author.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style_md: styleText }),
      });
      setEditing(false);
      onRefreshAuthors();
    } finally {
      setSaving(false);
    }
  }, [author.id, styleText, onRefreshAuthors]);

  const styleSummary = (() => {
    if (!styleText) return "";
    const lines = styleText.split("\n").filter((l) => l.trim());
    const first2 = lines.slice(0, 2).join("  ·  ");
    return first2.length > 120 ? `${first2.slice(0, 120)}…` : first2;
  })();

  return (
    <div className="rounded-lg border border-[#2A2A2E] bg-[#141416] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Sparkles className="h-3.5 w-3.5 text-[#C8A96E] flex-shrink-0" />
        <span className="text-xs font-medium text-[#A1A1AA] flex-shrink-0">
          他的笔法
        </span>

        {isQueued ? (
          <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 border border-amber-500/20">
            <Clock className="h-2.5 w-2.5 text-amber-400" />
            <span className="text-[10px] text-amber-400">排队中</span>
          </div>
        ) : isAnalyzing ? (
          <div className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 border border-blue-500/20">
            <Loader2 className="h-2.5 w-2.5 text-blue-400 animate-spin" />
            <span className="text-[10px] text-blue-400">学习中</span>
          </div>
        ) : isFailed ? (
          <div className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 border border-red-500/20">
            <AlertCircle className="h-2.5 w-2.5 text-red-400" />
            <span className="text-[10px] text-red-400">学习失败</span>
          </div>
        ) : isDone || hasStyle ? (
          <div className="flex items-center gap-1 rounded-full bg-[#C8A96E]/10 px-2 py-0.5 border border-[#C8A96E]/20">
            <CheckCircle2 className="h-2.5 w-2.5 text-[#C8A96E]" />
            <span className="text-[10px] text-[#C8A96E]">已就位</span>
          </div>
        ) : (
          <div className="rounded-full bg-[#2A2A2E]/50 px-2 py-0.5 border border-[#2A2A2E]">
            <span className="text-[10px] text-[#52525B]">还没学过</span>
          </div>
        )}

        {author.style_analyzed_at && !isBusy && (
          <div className="flex items-center gap-1 text-[10px] text-[#52525B]">
            <Clock className="h-2.5 w-2.5" />
            <span>{formatAnalyzedTime(author.style_analyzed_at)}</span>
          </div>
        )}

        <div className="flex-1" />

        <Button
          onClick={handleAnalyze}
          disabled={isBusy}
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-xs text-[#A1A1AA] hover:text-[#C8A96E] hover:bg-[#C8A96E]/5"
        >
          {isAnalyzing ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : isQueued ? (
            <Clock className="mr-1.5 h-3 w-3" />
          ) : (
            <Wand2 className="mr-1.5 h-3 w-3" />
          )}
          {isQueued
            ? "排队中…"
            : isAnalyzing
            ? "分析中…"
            : isFailed
            ? "重试分析"
            : hasStyle
            ? "重新分析"
            : "分析风格"}
        </Button>

        {hasStyle && !isBusy && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-[#52525B] hover:text-[#A1A1AA] transition-colors"
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {isQueued && (
        <div className="border-t border-[#2A2A2E]/50 px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="relative h-1 flex-1 rounded-full bg-[#2A2A2E] overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-amber-500/60 animate-[shimmer_1.8s_ease-in-out_infinite]" />
            </div>
            <span className="text-[10px] text-[#A1A1AA] flex-shrink-0">
              已加入风格分析队列，等待可用处理槽位…
            </span>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="border-t border-[#2A2A2E]/50 px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="relative h-1 flex-1 rounded-full bg-[#2A2A2E] overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-blue-500/60 animate-[shimmer_1.5s_ease-in-out_infinite]" />
            </div>
            <span className="text-[10px] text-[#52525B] flex-shrink-0">
              正在通过 AI 分析写作风格，请稍候…
            </span>
          </div>
        </div>
      )}

      {isFailed && !hasStyle && (
        <div className="border-t border-[#2A2A2E]/50 px-3 py-2">
          <p className="text-[11px] text-red-400/70">
            上次分析未能完成，请点击「重试分析」重新尝试
          </p>
        </div>
      )}

      {hasStyle && !expanded && !isBusy && (
        <div
          onClick={() => setExpanded(true)}
          className="cursor-pointer border-t border-[#2A2A2E]/50 px-3 py-2 hover:bg-[#1C1C20]/50 transition-colors"
        >
          <p className="text-[11px] text-[#52525B] leading-relaxed truncate">
            {styleSummary}
          </p>
        </div>
      )}

      {hasStyle && expanded && !isBusy && (
        <div className="border-t border-[#2A2A2E]">
          {editing ? (
            <div className="p-3 space-y-2">
              <Textarea
                value={styleText}
                onChange={(e) => setStyleText(e.target.value)}
                rows={14}
                className="resize-none border-[#2A2A2E] bg-[#0A0A0B] text-xs text-[#E4E4E7] font-mono leading-relaxed focus-visible:ring-[#C8A96E]/30"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#C8A96E] text-[#0A0A0B] hover:bg-[#8A7344] text-xs"
                >
                  <Save className="mr-1 h-3 w-3" />
                  {saving ? "保存中…" : "保存"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setStyleText(author.style_md ?? "");
                  }}
                  className="text-xs text-[#71717A]"
                >
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-3">
              <div className="prose prose-invert prose-xs max-w-none text-xs leading-relaxed text-[#A1A1AA] max-h-64 overflow-y-auto whitespace-pre-wrap scrollbar-thin scrollbar-thumb-[#2A2A2E]">
                {styleText}
              </div>
              <button
                onClick={() => setEditing(true)}
                className="mt-2 flex items-center gap-1 text-[10px] text-[#C8A96E] hover:text-[#8A7344] transition-colors"
              >
                <Pencil className="h-2.5 w-2.5" />
                手动调一下
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
