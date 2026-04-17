"use client";

import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { UploadManager } from "@/hooks/use-upload-manager";

interface Props {
  uploadManager: UploadManager;
}

export function UploadIndicator({ uploadManager }: Props) {
  const { uploadTasks, uploading, doneCount, totalCount } = uploadManager;

  if (uploadTasks.length === 0) return null;

  const errorCount = uploadTasks.filter((t) => t.status === "error").length;
  const allDone = !uploading && doneCount === totalCount && errorCount === 0;

  return (
    <div className="mr-4 flex items-center gap-2 text-xs">
      {uploading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C8A96E]" />
          <span className="text-[#C8A96E]">
            上传中 {doneCount}/{totalCount}
          </span>
        </>
      ) : allDone ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-emerald-500">
            全部上传完成（{totalCount} 个文件）
          </span>
        </>
      ) : errorCount > 0 ? (
        <>
          <XCircle className="h-3.5 w-3.5 text-[#EF4444]" />
          <span className="text-[#EF4444]">
            {errorCount} 个失败
            {doneCount > 0 && <span className="text-emerald-500 ml-1">{doneCount} 个成功</span>}
          </span>
        </>
      ) : null}
    </div>
  );
}
