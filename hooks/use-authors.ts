"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type StyleStatus = "idle" | "queued" | "analyzing" | "done" | "failed";
export type AuthorVisibility = "private" | "public";

export interface Author {
  id: string;
  name: string;
  owner_id: string | null;
  visibility: AuthorVisibility;
  style_md: string | null;
  style_status: StyleStatus;
  style_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

const POLL_INTERVAL = 3000; // 排队中 / 分析中时每 3 秒轮询一次

export function useAuthors() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [currentAuthorId, setCurrentAuthorId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; chunks: number }>({ ok: false, chunks: 0 });
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAuthors = useCallback(async () => {
    const res = await fetch("/api/authors");
    if (res.ok) {
      const data: Author[] = await res.json();
      setAuthors(data);
      if (data.length > 0 && !currentAuthorId) {
        setCurrentAuthorId(data[0].id);
      }
    }
  }, [currentAuthorId]);

  const fetchStatus = useCallback(async (authorId: string) => {
    const res = await fetch(`/api/authors/${authorId}/status`);
    if (res.ok) {
      setStatus(await res.json());
    }
  }, []);

  // 获取单个作者最新状态（轮询用，不刷新整个列表）
  const fetchCurrentAuthor = useCallback(async (authorId: string) => {
    const res = await fetch(`/api/authors/${authorId}`);
    if (res.ok) {
      const updated: Author = await res.json();
      setAuthors((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a))
      );
      return updated;
    }
    return null;
  }, []);

  useEffect(() => {
    fetchAuthors();
  }, [fetchAuthors]);

  useEffect(() => {
    if (currentAuthorId) {
      fetchStatus(currentAuthorId);
    }
  }, [currentAuthorId, fetchStatus]);

  const currentAuthor = authors.find((a) => a.id === currentAuthorId) ?? null;
  const shouldPollCurrentAuthor = currentAuthor?.style_status === "queued" || currentAuthor?.style_status === "analyzing";

  // 当前作者处于 queued / analyzing 状态时，自动轮询
  useEffect(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    if (shouldPollCurrentAuthor && currentAuthorId) {
      pollTimerRef.current = setInterval(async () => {
        const updated = await fetchCurrentAuthor(currentAuthorId);
        // 分析完成或失败后，停止轮询
        if (updated && updated.style_status !== "queued" && updated.style_status !== "analyzing") {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        }
      }, POLL_INTERVAL);
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [shouldPollCurrentAuthor, currentAuthorId, fetchCurrentAuthor]);

  return {
    authors,
    currentAuthor,
    currentAuthorId,
    setCurrentAuthorId,
    refresh: fetchAuthors,
    refreshStatus: () => currentAuthorId && fetchStatus(currentAuthorId),
    status,
  };
}
