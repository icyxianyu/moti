"use client";

import { useState, useCallback, useRef } from "react";

export interface UploadTask {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  chunkCount?: number;
  error?: string;
}

export interface UploadManager {
  uploadTasks: UploadTask[];
  uploading: boolean;
  doneCount: number;
  totalCount: number;
  processFiles: (authorId: string, files: File[]) => Promise<void>;
  clearCompleted: () => void;
}

export function useUploadManager(onAllDone?: (authorId: string) => void): UploadManager {
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [uploading, setUploading] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processFiles = useCallback(
    async (authorId: string, files: File[]) => {
      const txtFiles = files.filter((f) => f.name.endsWith(".txt"));
      if (txtFiles.length === 0) return;

      // 清除之前的自动清理定时器
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }

      const tasks: UploadTask[] = txtFiles.map((file) => ({
        file,
        status: "pending" as const,
      }));
      setUploadTasks(tasks);
      setUploading(true);

      for (let i = 0; i < tasks.length; i++) {
        // 标记当前文件为上传中
        setUploadTasks((prev) =>
          prev.map((t, idx) => (idx === i ? { ...t, status: "uploading" } : t))
        );

        const formData = new FormData();
        formData.append("file", tasks[i].file);

        try {
          const res = await fetch(`/api/authors/${authorId}/collections`, {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            setUploadTasks((prev) =>
              prev.map((t, idx) =>
                idx === i ? { ...t, status: "done", chunkCount: data.chunk_count } : t
              )
            );
          } else {
            const err = await res.json();
            setUploadTasks((prev) =>
              prev.map((t, idx) =>
                idx === i ? { ...t, status: "error", error: err.error ?? "上传失败" } : t
              )
            );
          }
        } catch (err) {
          setUploadTasks((prev) =>
            prev.map((t, idx) =>
              idx === i
                ? { ...t, status: "error", error: (err as Error).message }
                : t
            )
          );
        }
      }

      setUploading(false);
      onAllDone?.(authorId);

      // 5 秒后清除已完成的上传任务列表（保留失败的）
      clearTimerRef.current = setTimeout(() => {
        setUploadTasks((prev) => prev.filter((t) => t.status === "error"));
      }, 5000);
    },
    [onAllDone]
  );

  const clearCompleted = useCallback(() => {
    setUploadTasks((prev) => prev.filter((t) => t.status === "error"));
  }, []);

  const doneCount = uploadTasks.filter((t) => t.status === "done").length;
  const totalCount = uploadTasks.length;

  return {
    uploadTasks,
    uploading,
    doneCount,
    totalCount,
    processFiles,
    clearCompleted,
  };
}
