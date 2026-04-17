"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Copy, PenLine } from "lucide-react";
import type { RightPanelState } from "@/app/page";
import type { Author } from "@/hooks/use-authors";

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
          <p className="text-sm text-[#52525B]">选择作者，填写主题，开始创作</p>
        </div>
      </div>
    );
  }

  if (state.mode === "idle") {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#0A0A0B]">
        <div className="text-center">
          <PenLine className="mx-auto mb-3 h-10 w-10 text-[#2A2A2E]" />
          <p className="text-sm text-[#52525B]">填写左侧信息，点击「生成文章」开始创作</p>
        </div>
      </div>
    );
  }

  if (state.mode === "generating") {
    // Stream output is managed by TabCompose via a portal or shared state
    // This shows the streaming container
    return (
      <div className="flex flex-1 flex-col bg-[#0A0A0B] overflow-hidden" id="right-panel-stream">
        <ScrollArea className="flex-1 p-8">
          <div id="stream-output" className="prose prose-invert max-w-none prose-p:text-[#E4E4E7] prose-headings:text-[#C8A96E] prose-p:leading-relaxed" />
        </ScrollArea>
      </div>
    );
  }

  if (state.mode === "history" && state.historyContent) {
    const handleCopy = () => {
      navigator.clipboard.writeText(state.historyContent ?? "");
    };

    return (
      <div className="flex flex-1 flex-col bg-[#0A0A0B] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#2A2A2E] px-8 py-3">
          <div>
            <h2 className="text-base font-medium text-[#E4E4E7]">{state.historyTopic}</h2>
            <p className="text-xs text-[#52525B] mt-0.5">
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
        <ScrollArea className="flex-1 p-8">
          <div className="prose prose-invert max-w-none prose-p:text-[#E4E4E7] prose-headings:text-[#C8A96E] prose-p:leading-relaxed whitespace-pre-wrap">
            {state.historyContent}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return null;
}
