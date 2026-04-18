"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const POLL_INTERVAL = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 上传任务视图模型。
 *
 * 为什么 filename 而不是 File 对象：
 *   - UI 里其实只用到 file.name
 *   - 页面刷新后从服务端 hydrate 时拿不到 File，只拿得到 filename
 *   - 用字符串统一两种来源（新上传 / 从 DB 恢复）避免分支
 */
export interface UploadTask {
  filename: string;
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
  hydrateFromServer: (authorId: string) => Promise<void>;
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

interface ActiveJobFromServer {
  job_id: string;
  collection_id: string;
  filename: string;
  status: "queued" | "processing";
  created_at: string;
}

export function useUploadManager(onAllDone?: (authorId: string) => void): UploadManager {
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [uploading, setUploading] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 正在进行的轮询标识：避免 processFiles 与 hydrateFromServer 重复起轮询
  const pollingRef = useRef(false);
  // 轮询用到的最新任务快照（由 state 同步）；轮询循环通过 ref 拿到任意时刻最新列表
  const tasksRef = useRef<UploadTask[]>([]);
  useEffect(() => {
    tasksRef.current = uploadTasks;
  }, [uploadTasks]);

  /** 根据 jobId 局部更新 task；找不到对应 jobId 时忽略（任务已被清理） */
  const patchTaskByJobId = useCallback((jobId: string, patch: Partial<UploadTask>) => {
    setUploadTasks((prev) => prev.map((task) => (task.jobId === jobId ? { ...task, ...patch } : task)));
  }, []);

  /**
   * 统一的轮询循环：扫 state 里所有 queued/processing 的 task，按 jobId 去后端查状态。
   * - 同一时刻只会有一个轮询循环在跑（pollingRef 保护）
   * - 轮询期间新 push 的 task 会被自动纳入（依赖 tasksRef）
   * - 所有任务都非 active 时退出，清理 uploading 标志
   */
  const pollActiveJobs = useCallback(
    async (authorId: string) => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      setUploading(true);

      try {
        while (true) {
          const activeTasks = tasksRef.current.filter(
            (task) => task.jobId && (task.status === "queued" || task.status === "processing")
          );
          if (activeTasks.length === 0) break;

          const results = await Promise.all(
            activeTasks.map(async (task) => {
              try {
                const res = await fetch(`/api/jobs/${task.jobId}`);
                const data = await res.json();
                return { jobId: task.jobId!, ok: res.ok, data };
              } catch (err) {
                return {
                  jobId: task.jobId!,
                  ok: false,
                  data: { error: err instanceof Error ? err.message : "获取任务状态失败" },
                };
              }
            })
          );

          for (const { jobId, ok, data } of results) {
            if (!ok) {
              patchTaskByJobId(jobId, { status: "error", error: data.error ?? "获取任务状态失败" });
              continue;
            }
            const job = data as JobStatusResponse;
            if (job.status === "queued") {
              patchTaskByJobId(jobId, { status: "queued" });
            } else if (job.status === "processing") {
              patchTaskByJobId(jobId, { status: "processing" });
            } else if (job.status === "done") {
              patchTaskByJobId(jobId, {
                status: "done",
                chunkCount: job.result?.chunk_count,
                collectionId: job.result?.collection_id,
                error: undefined,
              });
            } else if (job.status === "failed") {
              patchTaskByJobId(jobId, { status: "error", error: job.error ?? "建索引失败" });
            }
          }

          await sleep(POLL_INTERVAL);
        }
      } finally {
        pollingRef.current = false;
        setUploading(false);
        onAllDone?.(authorId);

        // 5 秒后自动收走已成功的任务，保留失败项让用户看清错误
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        clearTimerRef.current = setTimeout(() => {
          setUploadTasks((prev) => prev.filter((task) => task.status === "error"));
        }, 5000);
      }
    },
    [onAllDone, patchTaskByJobId]
  );

  /**
   * 进页面或切换作者时调用：从后端拉取"该作者进行中的 ingest 任务"，
   * 合并进 state 并启动轮询，让用户刷新后依然看得到上传进度。
   */
  const hydrateFromServer = useCallback(
    async (authorId: string) => {
      let activeJobs: ActiveJobFromServer[] = [];
      try {
        const res = await fetch(`/api/authors/${authorId}/jobs`);
        if (!res.ok) return;
        activeJobs = (await res.json()) as ActiveJobFromServer[];
      } catch {
        return;
      }

      if (activeJobs.length === 0) return;

      setUploadTasks((prev) => {
        // 已经在 state 里的 jobId 不重复加；未完成的保留原样，其它的以服务端数据为准
        const existingJobIds = new Set(prev.filter((t) => t.jobId).map((t) => t.jobId!));
        const hydrated: UploadTask[] = activeJobs
          .filter((j) => !existingJobIds.has(j.job_id))
          .map((j) => ({
            filename: j.filename,
            status: j.status,
            jobId: j.job_id,
            collectionId: j.collection_id,
          }));
        return [...prev, ...hydrated];
      });

      // 清掉上一次上传批次结束后的"自动清理定时器"，避免刚 hydrate 进来又被扫走
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }

      void pollActiveJobs(authorId);
    },
    [pollActiveJobs]
  );

  const processFiles = useCallback(
    async (authorId: string, files: File[]) => {
      const txtFiles = files.filter((f) => f.name.endsWith(".txt"));
      if (txtFiles.length === 0) return;

      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }

      // 本批次新增的 task 先塞进 state，标记 pending
      const batchStartIndex = tasksRef.current.length;
      const newTasks: UploadTask[] = txtFiles.map((f) => ({
        filename: f.name,
        status: "pending",
      }));
      setUploadTasks((prev) => [...prev, ...newTasks]);

      // 按索引定位本批次任务并 patch（不用 jobId 因为此时还没有）
      const patchBatchTask = (batchIdx: number, patch: Partial<UploadTask>) => {
        const absoluteIdx = batchStartIndex + batchIdx;
        setUploadTasks((prev) =>
          prev.map((task, idx) => (idx === absoluteIdx ? { ...task, ...patch } : task))
        );
      };

      // 串行上传：一个接一个 POST，避免把请求一次性打给服务端
      for (let i = 0; i < txtFiles.length; i++) {
        const formData = new FormData();
        formData.append("file", txtFiles[i]);

        try {
          const res = await fetch(`/api/authors/${authorId}/collections`, {
            method: "POST",
            body: formData,
          });
          const data = await res.json();

          if (res.ok) {
            const job = data.job ?? data.jobs?.[0];
            if (!job?.job_id) {
              patchBatchTask(i, { status: "error", error: "服务端未返回任务 ID" });
              continue;
            }
            patchBatchTask(i, {
              status: "queued",
              jobId: job.job_id,
              collectionId: job.collection_id,
            });
          } else {
            patchBatchTask(i, {
              status: "error",
              error: data.error ?? data.errors?.[0]?.error ?? "上传失败",
            });
          }
        } catch (err) {
          patchBatchTask(i, {
            status: "error",
            error: err instanceof Error ? err.message : "上传失败",
          });
        }
      }

      await pollActiveJobs(authorId);
    },
    [pollActiveJobs]
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
    hydrateFromServer,
    clearCompleted,
  };
}
