"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, FileText } from "lucide-react";

interface HistoryItem {
  id: string;
  author_id: string;
  topic: string;
  events: string | null;
  context: string | null;
  extra_note: string | null;
  status?: "completed" | "aborted" | "failed";
  created_at: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  aborted: {
    label: "未完成",
    className: "border-[#C8A96E]/30 bg-[#C8A96E]/10 text-[#C8A96E]",
  },
  failed: {
    label: "失败",
    className: "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#F87171]",
  },
};

interface Props {
  authorId: string;
  onViewHistory: (id: string, topic: string, content: string, createdAt: string, status?: "completed" | "aborted" | "failed") => void;
  selectedHistoryId?: string;
}

export function TabHistory({ authorId, onViewHistory, selectedHistoryId }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/authors/${authorId}/history`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [authorId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleClick = async (item: HistoryItem) => {
    const res = await fetch(`/api/authors/${authorId}/history/${item.id}`);
    if (res.ok) {
      const data = await res.json();
      onViewHistory(data.id, data.topic, data.content, data.created_at, data.status);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await fetch(`/api/authors/${authorId}/history/${id}`, { method: "DELETE" });
    fetchHistory();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[#52525B]">
        加载中…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
        <FileText className="mb-3 h-8 w-8 text-[#2A2A2E]" />
        <p className="text-sm text-[#52525B]">暂无生成记录</p>
        <p className="mt-1 text-[10px] text-[#52525B]">生成的文章会自动保存在这里</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 animate-fade-in">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => handleClick(item)}
          className={`group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
            selectedHistoryId === item.id
              ? "bg-[#C8A96E]/10 border border-[#C8A96E]/20"
              : "hover:bg-[#141416] border border-transparent"
          }`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p
                className={`truncate text-sm ${
                  selectedHistoryId === item.id ? "text-[#C8A96E]" : "text-[#E4E4E7]"
                }`}
              >
                {item.topic}
              </p>
              {item.status && STATUS_BADGE[item.status] && (
                <span
                  className={`flex-shrink-0 rounded border px-1.5 py-0.5 text-[10px] leading-none ${STATUS_BADGE[item.status].className}`}
                >
                  {STATUS_BADGE[item.status].label}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[10px] text-[#52525B]">
              {new Date(item.created_at).toLocaleString("zh-CN")}
            </p>
          </div>
          <button
            onClick={(e) => handleDelete(e, item.id)}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 text-[#52525B] hover:text-[#EF4444] transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </button>
      ))}
    </div>
  );
}
