"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";

interface RetrievalItem {
  index: number;
  text: string;
  score: number;
  source: string | null;
  type: string;
}

interface Props {
  items: RetrievalItem[];
}

export function RetrievalPanel({ items }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleItem = (idx: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="mt-4 rounded-lg border border-[#2A2A2E] bg-[#141416] overflow-hidden animate-slide-up">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-[#71717A] hover:text-[#E4E4E7] transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        参考片段
        <Badge variant="secondary" className="ml-1 h-4 bg-[#1C1C20] text-[10px] text-[#71717A]">
          {items.length}
        </Badge>
      </button>

      {expanded && (
        <div className="border-t border-[#2A2A2E] divide-y divide-[#2A2A2E]">
          {items.map((item) => (
            <div key={item.index} className="px-3 py-2">
              <button
                onClick={() => toggleItem(item.index)}
                className="flex w-full items-center gap-2 text-left"
              >
                <Badge
                  className={`h-4 text-[10px] px-1.5 ${
                    item.type === "主题相关"
                      ? "bg-[#C8A96E]/15 text-[#C8A96E] hover:bg-[#C8A96E]/15"
                      : "bg-[#4ADE80]/15 text-[#4ADE80] hover:bg-[#4ADE80]/15"
                  }`}
                >
                  {item.type}
                </Badge>
                <span className="flex-1 truncate text-xs text-[#71717A]">
                  {item.source ?? `片段 ${item.index}`}
                </span>
                <span className="text-[10px] text-[#52525B]">
                  {item.score > 0 ? item.score.toFixed(3) : "—"}
                </span>
              </button>
              {expandedItems.has(item.index) && (
                <p className="mt-1.5 text-xs leading-relaxed text-[#71717A] pl-2 border-l-2 border-[#2A2A2E]">
                  {item.text.slice(0, 300)}
                  {item.text.length > 300 && "…"}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
