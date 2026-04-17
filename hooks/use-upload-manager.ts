"use client";

import { useState, useCallback, useRef } from "react";

const POLL_INTERVAL = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface UploadTask {
  file: File;
  status: "pending" | "queued" | "processing" | "done" | "error";
  jobId?: string;
  collectionId?: string;
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

interface JobStatusResponse {
  status: "queued" | "processing" | "done" | "failed";
  result?: {
    chunk_count?: number;
    collection_id?: string;
  } | null;
  error?: string | null;
}

export function useUploadManager(onAllDone?: (authorId: string) => void): UploadManager {
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [uploading, setUploading] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processFiles = useCallback(
    async (authorId: string, files: File[]) => {
      const txtFiles = files.filter((f) => f.name.endsWith(".txt"));
      if (txtFiles.length === 0) return;

      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }

      const localTasks: UploadTask[] = txtFiles.map((file) => ({
        file,
        status: "pending",
      }));
      setUploadTasks(localTasks);
      setUploading(true);

      const patchTask = (index: number, patch: Partial<UploadTask>) => {
        localTasks[index] = { ...localTasks[index], ...patch };
        setUploadTasks((prev) =>
          prev.map((task, idx) => (idx === index ? { ...task, ...patch } : task))
        );
      };

      for (let i = 0; i < localTasks.length; i++) {
        const formData = new FormData();
        formData.append("file", localTasks[i].file);

        try {
          const res = await fetch(`/api/authors/${authorId}/collections`, {
            method: "POST",
            body: formData,
          });
          const data = await res.json();

          if (res.ok) {
            const job = data.job ?? data.jobs?.[0];
            if (!job?.job_id) {
              patchTask(i, { status: "error", error: "服务端未返回任务 ID" });
              continue;
            }

            patchTask(i, {
              status: "queued",
              jobId: job.job_id,
              collectionId: job.collection_id,
            });
          } else {
            patchTask(i, {
              status: "error",
              error: data.error ?? data.errors?.[0]?.error ?? "上传失败",
            });
          }
        } catch (err) {
          patchTask(i, {
            status: "error",
            error: err instanceof Error ? err.message : "上传失败",
          });
        }
      }

      while (true) {
        const activeTasks = localTasks
          .map((task, index) => ({ task, index }))
          .filter(({ task }) => task.jobId && (task.status === "queued" || task.status === "processing"));

        if (activeTasks.length === 0) {
          break;
        }

        const results = await Promise.all(
          activeTasks.map(async ({ task, index }) => {
            try {
              const res = await fetch(`/api/jobs/${task.jobId}`);
              const data = await res.json();
              return { index, ok: res.ok, data };
            } catch (err) {
              return {
                index,
                ok: false,
                data: { error: err instanceof Error ? err.message : "获取任务状态失败" },
              };
            }
          })
        );

        for (const { index, ok, data } of results) {
          if (!ok) {
            patchTask(index, { status: "error", error: data.error ?? "获取任务状态失败" });
            continue;
          }

          const job = data as JobStatusResponse;
          if (job.status === "queued") {
            patchTask(index, { status: "queued" });
          } else if (job.status === "processing") {
            patchTask(index, { status: "processing" });
          } else if (job.status === "done") {
            patchTask(index, {
              status: "done",
              chunkCount: job.result?.chunk_count,
              collectionId: job.result?.collection_id,
              error: undefined,
            });
          } else if (job.status === "failed") {
            patchTask(index, {
              status: "error",
              error: job.error ?? "建索引失败",
            });
          }
        }

        await sleep(POLL_INTERVAL);
      }

      setUploading(false);
      onAllDone?.(authorId);

      clearTimerRef.current = setTimeout(() => {
        setUploadTasks((prev) => prev.filter((task) => task.status === "error"));
      }, 5000);
    },
    [onAllDone]
  );

  const clearCompleted = useCallback(() => {
    setUploadTasks((prev) => prev.filter((task) => task.status === "error"));
  }, []);

  const doneCount = uploadTasks.filter((task) => task.status === "done").length;
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
