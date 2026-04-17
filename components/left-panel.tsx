"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TabCompose } from "@/components/tab-compose";
import { TabCollections } from "@/components/tab-collections";
import { TabHistory } from "@/components/tab-history";
import { StylePanel } from "@/components/style-panel";
import type { Author } from "@/hooks/use-authors";
import type { RightPanelState } from "@/app/page";
import type { UploadManager } from "@/hooks/use-upload-manager";

interface Props {
  currentAuthor: Author | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onGenerate: () => void;
  onViewHistory: (id: string, topic: string, content: string, createdAt: string) => void;
  rightState: RightPanelState;
  setRightState: React.Dispatch<React.SetStateAction<RightPanelState>>;
  uploadManager: UploadManager;
  onRefreshAuthors: () => void;
}

export function LeftPanel({
  currentAuthor,
  activeTab,
  onTabChange,
  onGenerate,
  onViewHistory,
  rightState,
  setRightState,
  uploadManager,
  onRefreshAuthors,
}: Props) {
  if (!currentAuthor) {
    return (
      <div className="flex w-[420px] min-w-[360px] flex-shrink-0 items-center justify-center border-r border-[#2A2A2E] bg-[#0A0A0B]">
        <p className="text-sm text-[#52525B]">请先创建或选择一个作者</p>
      </div>
    );
  }

  return (
    <div className="flex w-[420px] min-w-[360px] flex-shrink-0 flex-col border-r border-[#2A2A2E] bg-[#0A0A0B] overflow-hidden">
      <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-1 flex-col min-h-0">
        <TabsList className="mx-4 mt-4 mb-0 flex h-9 w-auto justify-start gap-0 rounded-none border-b border-[#2A2A2E] bg-transparent p-0">
          {[
            { value: "compose", label: "创作" },
            { value: "collections", label: "文本集" },
            { value: "history", label: "历史" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="relative rounded-none border-b-2 border-transparent px-4 pb-2 pt-1 text-sm font-medium text-[#71717A] transition-colors data-[state=active]:border-[#C8A96E] data-[state=active]:text-[#C8A96E] data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-[#E4E4E7]"
            >
              {tab.label}
              {/* 上传中时文本集 Tab 显示脉冲动画指示 */}
              {tab.value === "collections" && uploadManager.uploading && activeTab !== "collections" && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#C8A96E] animate-pulse" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 overflow-y-auto min-h-0">
          <TabsContent value="compose" className="mt-0 p-4 space-y-4">
            <StylePanel
              author={currentAuthor}
              onRefreshAuthors={onRefreshAuthors}
            />
            <TabCompose
              authorId={currentAuthor.id}
              onGenerate={onGenerate}
              rightState={rightState}
              setRightState={setRightState}
            />
          </TabsContent>
          <TabsContent value="collections" className="mt-0 p-4">
            <TabCollections
              authorId={currentAuthor.id}
              author={currentAuthor}
              uploadManager={uploadManager}
            />
          </TabsContent>
          <TabsContent value="history" className="mt-0 p-4">
            <TabHistory
              authorId={currentAuthor.id}
              onViewHistory={onViewHistory}
              selectedHistoryId={rightState.historyId}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
