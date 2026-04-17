"use client";

import { useState, useCallback } from "react";
import { AuthorSwitcher } from "@/components/author-switcher";
import { LeftPanel } from "@/components/left-panel";
import { RightPanel } from "@/components/right-panel";
import { UploadIndicator } from "@/components/upload-indicator";
import { useAuthors } from "@/hooks/use-authors";
import { useUploadManager } from "@/hooks/use-upload-manager";

export interface RightPanelState {
  mode: "idle" | "generating" | "history";
  historyId?: string;
  historyTopic?: string;
  historyContent?: string;
  historyCreatedAt?: string;
}

export default function Home() {
  const {
    authors,
    currentAuthor,
    setCurrentAuthorId,
    refresh: refreshAuthors,
    refreshStatus,
    status,
  } = useAuthors();

  const [rightState, setRightState] = useState<RightPanelState>({ mode: "idle" });
  const [activeTab, setActiveTab] = useState("compose");

  const handleUploadAllDone = useCallback((_authorId: string) => {
    refreshStatus();
  }, [refreshStatus]);

  const uploadManager = useUploadManager(handleUploadAllDone);

  const handleGenerate = useCallback(() => {
    setRightState({ mode: "generating" });
  }, []);

  const handleGenerateDone = useCallback(() => {
    setRightState((state) => (state.mode === "generating" ? { mode: "idle" } : state));
  }, []);

  const handleViewHistory = useCallback(
    (id: string, topic: string, content: string, createdAt: string) => {
      setRightState({
        mode: "history",
        historyId: id,
        historyTopic: topic,
        historyContent: content,
        historyCreatedAt: createdAt,
      });
    },
    []
  );

  const styleBadge = (() => {
    if (!currentAuthor) return null;

    if (currentAuthor.style_status === "queued") {
      return (
        <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 border border-amber-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="text-amber-400">风格排队中</span>
        </div>
      );
    }

    if (currentAuthor.style_status === "analyzing") {
      return (
        <div className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 border border-blue-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-blue-400">风格分析中</span>
        </div>
      );
    }

    if (currentAuthor.style_md) {
      return (
        <div className="flex items-center gap-1.5 rounded-full bg-[#C8A96E]/10 px-2.5 py-1 border border-[#C8A96E]/20">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C8A96E]" />
          <span className="text-[#C8A96E]">已风格化</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 rounded-full bg-[#2A2A2E]/50 px-2.5 py-1 border border-[#2A2A2E]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#52525B]" />
        <span className="text-[#52525B]">未风格化</span>
      </div>
    );
  })();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-14 flex-shrink-0 items-center border-b border-[#2A2A2E] bg-[#141416] px-5">
        <h1 className="font-serif text-lg font-bold tracking-wide text-[#C8A96E]">
          风格写作
        </h1>
        <div className="mx-6 h-5 w-px bg-[#2A2A2E]" />
        <AuthorSwitcher
          authors={authors}
          currentAuthor={currentAuthor}
          onSelect={setCurrentAuthorId}
          onRefresh={refreshAuthors}
        />
        <div className="flex-1" />

        <UploadIndicator uploadManager={uploadManager} />

        {currentAuthor && (
          <div className="flex items-center gap-3 text-xs text-[#71717A]">
            {styleBadge}

            <div className="flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  status.chunks > 0 ? "bg-[#4ADE80]" : "bg-[#71717A]"
                }`}
              />
              {status.chunks} 片段
            </div>
          </div>
        )}
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <LeftPanel
          currentAuthor={currentAuthor}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onGenerate={handleGenerate}
          onViewHistory={handleViewHistory}
          rightState={rightState}
          setRightState={setRightState}
          uploadManager={uploadManager}
          onRefreshAuthors={refreshAuthors}
        />
        <RightPanel state={rightState} currentAuthor={currentAuthor} />
      </div>
    </div>
  );
}
