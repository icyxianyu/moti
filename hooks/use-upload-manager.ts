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

  // 正在轮询的 authorId：避免对同一作者重复起轮询；切换作者时会自动用新 authorId 重启
  const pollingAuthorRef = useRef<string | null>(null);
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
   * 统一的轮询循环（**单请求版**）：
   * 每一轮只打一个 `/api/authors/{id}/jobs`，后端一次性返回该作者所有 active job，
   * 不再按 jobId 一个个打 `/api/jobs/{id}`。
   *
   * 为什么这样改：
   *   - 旧版用 Promise.all 并发查每个 job，N 个 job 就 N 个请求
   *   - 用户如果积了 200 个僵尸 job，每 2 秒就打 200 个请求 = 100 req/s，把 CPU/带宽打爆
   *   - 服务端本来就有"按 author 列 active job"的接口，复用即可，一次请求解决
   *
   * 同时承担 hydrate 职责：
   *   - 轮询返回的 active job 列表就是最新真相
   *   - state 里没有的 jobId 自动补进来（对应从别处跳回来 / 刷新页面的场景）
   *   - state 里有但服务端没返回的（说明已完成/失败），按 jobId 去 `/api/jobs/{id}` 拉终态
   *
   * 并发保护：同 authorId 不会重复起轮询；切换作者时外层会调用 `stopPolling` 终止。
   */
  const pollActiveJobs = useCallback(
    async (authorId: string) => {
      if (pollingAuthorRef.current === authorId) return;
      pollingAuthorRef.current = authorId;
      setUploading(true);

      try {
        while (pollingAuthorRef.current === authorId) {
          // 1) 拉当前作者的 active job 列表（唯一网络请求）
          let activeJobs: ActiveJobFromServer[] = [];
          try {
            const res = await fetch(`/api/authors/${authorId}/jobs`);
            if (res.ok) {
              activeJobs = (await res.json()) as ActiveJobFromServer[];
            }
          } catch {
            // 网络异常不中断轮询，下一轮再试
          }

          const activeIdSet = new Set(activeJobs.map((j) => j.job_id));

          // 2) 合并到 state：
          //    - 服务端返回的 → 更新对应 task 状态；state 里没有的就新增（hydrate）
          //    - state 里是 active 但服务端没返回的 → 说明已完成/失败，下一步去拉终态
          const stateJobIds = new Set(
            tasksRef.current.filter((t) => t.jobId).map((t) => t.jobId!)
          );
          const toAdd: UploadTask[] = activeJobs
            .filter((j) => !stateJobIds.has(j.job_id))
            .map((j) => ({
              filename: j.filename,
              status: j.status,
              jobId: j.job_id,
              collectionId: j.collection_id,
            }));

          setUploadTasks((prev) => {
            const updated = prev.map((task) => {
              if (!task.jobId) return task;
              const server = activeJobs.find((j) => j.job_id === task.jobId);
              if (server) return { ...task, status: server.status };
              return task;
            });
            return toAdd.length > 0 ? [...updated, ...toAdd] : updated;
          });

          // 3) 对 state 里"active 但服务端没返回"的 job，按 id 拉终态（done / failed）
          const resolvedIds = tasksRef.current
            .filter(
              (t) =>
                t.jobId &&
                (t.status === "queued" || t.status === "processing") &&
                !activeIdSet.has(t.jobId)
            )
            .map((t) => t.jobId!);

          if (resolvedIds.length > 0) {
            const finals = await Promise.all(
              resolvedIds.map(async (jobId) => {
                try {
                  const res = await fetch(`/api/jobs/${jobId}`);
                  const data = await res.json();
                  return { jobId, ok: res.ok, data };
                } catch (err) {
                  return {
                    jobId,
                    ok: false,
                    data: { error: err instanceof Error ? err.message : "获取任务状态失败" },
                  };
                }
              })
            );
            for (const { jobId, ok, data } of finals) {
              if (!ok) {
                patchTaskByJobId(jobId, { status: "error", error: data.error ?? "获取任务状态失败" });
                continue;
              }
              const job = data as JobStatusResponse;
              if (job.status === "done") {
                patchTaskByJobId(jobId, {
                  status: "done",
                  chunkCount: job.result?.chunk_count,
                  collectionId: job.result?.collection_id,
                  error: undefined,
                });
              } else if (job.status === "failed") {
                patchTaskByJobId(jobId, { status: "error", error: job.error ?? "建索引失败" });
              }
              // 注：queued/processing 理论上不会出现在这里，保持现状
            }
          }

          // 4) 所有任务都不再 active → 退出
          const stillActive = tasksRef.current.some(
            (t) => t.jobId && (t.status === "queued" || t.status === "processing")
          );
          if (!stillActive && activeJobs.length === 0) break;

          await sleep(POLL_INTERVAL);
        }
      } finally {
        if (pollingAuthorRef.current === authorId) {
          pollingAuthorRef.current = null;
        }
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
   * 进页面或切换作者时调用：直接启动轮询，首轮会自动 hydrate（把服务端 active job 补进 state）。
   * 旧实现会多打一次 `/api/authors/{id}/jobs`，现在轮询本身就是这个接口，省掉重复请求。
   */
  const hydrateFromServer = useCallback(
    async (authorId: string) => {
      // 清掉上一次上传批次结束后的"自动清理定时器"，避免刚启动轮询又被扫走
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
