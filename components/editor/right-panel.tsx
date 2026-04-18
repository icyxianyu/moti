"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Copy, PenLine } from "lucide-react";
import type { RightPanelState } from "@/app/page";
import type { Author } from "@/hooks/use-authors";
import { MarkdownView } from "@/components/editor/markdown-view";

interface Props {
  state: RightPanelState;
  currentAuthor: Author | null;
}

export function RightPanel({ state, currentAuthor }: Props) {
  if (!currentAuthor) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#0A0A0B]">
        <div className="text-center">
          <PenLine className="mx-auto mb-3 h-10 w-10 text-[#2A2A2E]" />
          <p className="text-sm text-[#52525B]">先挑一位作者，或者新建一位</p>
        </div>
      </div>
    );
  }

  if (state.mode === "idle") {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#0A0A0B]">
        <div className="text-center">
          <PenLine className="mx-auto mb-3 h-10 w-10 text-[#2A2A2E]" />
          <p className="text-sm text-[#52525B]">填好左侧，点「开始下笔」，文章会在这里成形</p>
        </div>
      </div>
    );
  }

  if (state.mode === "generating") {
    // 实际正文由 TabCompose 内的 StreamOutput 通过 Portal 挂到这里
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-[#0A0A0B]" id="right-panel-stream">
        <ScrollArea className="flex-1">
          <div id="stream-output" className="px-8 py-8" />
        </ScrollArea>
      </div>
    );
  }

  if (state.mode === "history" && state.historyContent) {
    const handleCopy = () => {
      navigator.clipboard.writeText(state.historyContent ?? "");
    };

    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-[#0A0A0B]">
        <div className="flex items-center justify-between border-b border-[#2A2A2E] px-8 py-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-[#E4E4E7]">{state.historyTopic}</h2>
              {state.historyStatus === "aborted" && (
                <span className="rounded border border-[#C8A96E]/30 bg-[#C8A96E]/10 px-2 py-0.5 text-[10px] leading-none text-[#C8A96E]">
                  未完成
                </span>
              )}
              {state.historyStatus === "failed" && (
                <span className="rounded border border-[#EF4444]/30 bg-[#EF4444]/10 px-2 py-0.5 text-[10px] leading-none text-[#F87171]">
                  失败
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[#52525B]">
              {state.historyCreatedAt ? new Date(state.historyCreatedAt).toLocaleString("zh-CN") : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-[#71717A] hover:text-[#C8A96E] hover:bg-[#1C1C20]"
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            复制
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-8 py-8">
            <MarkdownView content={state.historyContent} />
          </div>
        </ScrollArea>
      </div>
    );
  }

  return null;
}
