"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Upload,
  Trash2,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  X,
  Globe2,
  Lock,
  Eye,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Author } from "@/hooks/use-authors";
import type { UploadManager } from "@/hooks/use-upload-manager";

interface Collection {
  id: string;
  author_id: string;
  filename: string;
  chunk_count: number;
  created_at: string;
}

interface CollectionDetail extends Collection {
  raw_text: string;
}

interface MeLite {
  id: string;
  role: "user" | "admin";
}

interface Props {
  authorId: string;
  author: Author;
  uploadManager: UploadManager;
}

export function TabCollections({ authorId, author, uploadManager }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [me, setMe] = useState<MeLite | null>(null);
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<CollectionDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadTasks, uploading, doneCount, totalCount, processFiles, hydrateFromServer } =
    uploadManager;

  const fetchCollections = useCallback(async () => {
    const res = await fetch(`/api/authors/${authorId}/collections`);
    if (res.ok) setCollections(await res.json());
  }, [authorId]);

  useEffect(() => {
    fetchCollections();
    // 切换到该作者时，拉一次"进行中的 ingest 任务"恢复进度条——
    // 用户上传后刷新页面、或从别处跳回来时，仍能看到剩余任务并继续轮询
    hydrateFromServer(authorId);
    // 只依赖 authorId：fetchCollections / hydrateFromServer 是 useCallback，
    // 但父组件重渲染可能让它们的引用变化，放进依赖会导致 effect 反复执行，
    // 触发对 /api/authors/{id}/jobs、/api/authors/{id}/collections 的无限刷新。
    // 这里明确忽略 ESLint 的 exhaustive-deps 警告。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorId]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setMe({ id: data.id, role: data.role }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!uploading && totalCount > 0 && doneCount > 0) {
      fetchCollections();
    }
  }, [uploading, totalCount, doneCount, fetchCollections]);

  // 写权限：owner 本人 或 admin
  const canWrite = useMemo(() => {
    if (!me) return false;
    if (me.role === "admin") return true;
    return author.owner_id === me.id;
  }, [me, author.owner_id]);

  const isPublic = author.visibility === "public";

  const filteredCollections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter((c) => c.filename.toLowerCase().includes(q));
  }, [collections, query]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    await processFiles(authorId, Array.from(fileList));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canWrite) return;
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (!canWrite || uploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFiles(authorId, files);
    }
  };

  const handleDelete = async (cid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await fetch(`/api/authors/${authorId}/collections/${cid}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("已删除");
      fetchCollections();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || "删除失败");
    }
  };

  const handleView = async (c: Collection) => {
    setViewLoading(true);
    try {
      const res = await fetch(`/api/authors/${authorId}/collections/${c.id}`);
      if (res.ok) {
        const data: CollectionDetail = await res.json();
        setViewing(data);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "加载失败");
      }
    } finally {
      setViewLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 作家来源标识 */}
      <div
        className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs ${
          isPublic
            ? "border-[#C8A96E]/25 bg-[#C8A96E]/5 text-[#E7D2A6]"
            : "border-[#2A2A2E] bg-[#141416] text-[#A1A1AA]"
        }`}
      >
        {isPublic ? (
          <Globe2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C8A96E]" />
        ) : (
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#71717A]" />
        )}
        <div className="flex-1 leading-relaxed">
          {isPublic ? (
            <>
              <span className="text-[#C8A96E] font-medium">公共作家</span>
              <span className="ml-1 text-[#A1A1AA]">
                — 所有登录用户都能用他生成文章。
                {canWrite
                  ? "作为维护者，你可以上传/删除文本。"
                  : "只有创建者或管理员可以管理文本集。"}
              </span>
            </>
          ) : (
            <>
              <span className="text-[#E4E4E7] font-medium">私有作家</span>
              <span className="ml-1 text-[#71717A]">
                — 只有你能看到和使用{canWrite ? "，可自由管理文本集。" : "。"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 上传区：只有有写权限时才显示 */}
      {canWrite && (
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
            dragOver
              ? "border-[#C8A96E] bg-[#C8A96E]/5"
              : "border-[#2A2A2E] bg-[#141416] hover:border-[#C8A96E]/40 hover:bg-[#1C1C20]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-[#C8A96E]">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">
                正在把他的作品收进来… ({doneCount}/{totalCount})
              </span>
            </div>
          ) : (
            <>
              <Upload className="mx-auto mb-2 h-6 w-6 text-[#52525B]" />
              <p className="text-sm text-[#71717A]">把他写过的文章拖进来，或点击选择 .txt</p>
              <p className="mt-1 text-[10px] text-[#52525B]">多篇可以一次性选中，Moti 会按顺序一篇篇读</p>
            </>
          )}
        </div>
      )}

      {canWrite && uploadTasks.length > 0 && (
        <div className="space-y-1 rounded-lg border border-[#2A2A2E] bg-[#141416] p-2">
          {uploadTasks.map((task, idx) => (
            <div key={idx} className="flex items-center gap-2 px-2 py-1.5 text-xs">
              {task.status === "pending" && (
                <div className="h-3.5 w-3.5 rounded-full border border-[#52525B] flex-shrink-0" />
              )}
              {task.status === "queued" && (
                <Clock className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
              )}
              {task.status === "processing" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C8A96E] flex-shrink-0" />
              )}
              {task.status === "done" && (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
              )}
              {task.status === "error" && (
                <XCircle className="h-3.5 w-3.5 text-[#EF4444] flex-shrink-0" />
              )}
              <span
                className={`truncate flex-1 ${
                  task.status === "done"
                    ? "text-[#52525B]"
                    : task.status === "error"
                    ? "text-[#EF4444]"
                    : "text-[#E4E4E7]"
                }`}
              >
                {task.filename}
              </span>
              {task.status === "queued" && (
                <span className="text-amber-400/80 flex-shrink-0 text-[10px]">排队中</span>
              )}
              {task.status === "processing" && (
                <span className="text-[#C8A96E] flex-shrink-0 text-[10px]">读取中</span>
              )}
              {task.status === "done" && task.chunkCount !== undefined && (
                <span className="text-[#52525B] flex-shrink-0">{task.chunkCount} 段</span>
              )}
              {task.status === "error" && task.error && (
                <span className="text-[#EF4444] flex-shrink-0 text-[10px]">{task.error}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 作品列表 */}
      {collections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#71717A]">
              他写过的作品
              <span className="ml-2 text-[10px] text-[#52525B]">
                {query ? `${filteredCollections.length}/${collections.length}` : `${collections.length} 篇`}
              </span>
            </p>
          </div>

          {/* 搜索框 */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#52525B]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索文件名…"
              className="h-8 border-[#2A2A2E] bg-[#141416] pl-8 pr-8 text-xs text-[#E4E4E7] placeholder:text-[#52525B] focus-visible:ring-[#C8A96E]/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-[#E4E4E7]"
                title="清除"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {filteredCollections.length === 0 ? (
            <p className="rounded-lg border border-[#2A2A2E] bg-[#141416] px-3 py-6 text-center text-xs text-[#52525B]">
              没有匹配「{query}」的文件
            </p>
          ) : (
            <div className="divide-y divide-[#2A2A2E] rounded-lg border border-[#2A2A2E] bg-[#141416]">
              {filteredCollections.map((collection) => (
                <div
                  key={collection.id}
                  onClick={() => handleView(collection)}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[#1C1C20] group"
                  title="点击查看文本内容"
                >
                  <FileText className="h-4 w-4 flex-shrink-0 text-[#52525B] group-hover:text-[#C8A96E]" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-[#E4E4E7] group-hover:text-[#C8A96E]">
                      {collection.filename}
                    </p>
                    <p className="text-[10px] text-[#52525B]">
                      {collection.chunk_count} 段 ·{" "}
                      {new Date(collection.created_at).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                  <Eye className="h-3.5 w-3.5 flex-shrink-0 text-[#52525B] opacity-0 transition-opacity group-hover:opacity-100" />
                  {canWrite && (
                    <button
                      onClick={(e) => handleDelete(collection.id, e)}
                      className="p-1 text-[#52525B] opacity-0 transition-all hover:text-[#EF4444] group-hover:opacity-100"
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {collections.length === 0 && !canWrite && (
        <p className="rounded-lg border border-[#2A2A2E] bg-[#141416] px-3 py-8 text-center text-xs text-[#52525B]">
          这位作家还没有上传任何作品
        </p>
      )}

      {/* 文本详情弹窗 */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="flex max-h-[85vh] flex-col border-[#2A2A2E] bg-[#141416] text-[#E4E4E7] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#C8A96E] text-sm font-medium">
              <FileText className="h-4 w-4" />
              <span className="truncate">{viewing?.filename}</span>
            </DialogTitle>
            {viewing && (
              <p className="text-[10px] text-[#52525B]">
                {viewing.chunk_count} 段 · {viewing.raw_text.length.toLocaleString("zh-CN")} 字 ·{" "}
                {new Date(viewing.created_at).toLocaleString("zh-CN")}
              </p>
            )}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto rounded border border-[#2A2A2E] bg-[#0A0A0B] p-4">
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-[#D4D4D8]">
              {viewing?.raw_text}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      {viewLoading && !viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Loader2 className="h-6 w-6 animate-spin text-[#C8A96E]" />
        </div>
      )}
    </div>
  );
}
