"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, Trash2, FileText, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { Author } from "@/hooks/use-authors";
import type { UploadManager } from "@/hooks/use-upload-manager";

interface Collection {
  id: string;
  author_id: string;
  filename: string;
  chunk_count: number;
  created_at: string;
}

interface Props {
  authorId: string;
  author: Author;
  uploadManager: UploadManager;
}

export function TabCollections({ authorId, author: _author, uploadManager }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadTasks, uploading, doneCount, totalCount, processFiles } = uploadManager;

  const fetchCollections = useCallback(async () => {
    const res = await fetch(`/api/authors/${authorId}/collections`);
    if (res.ok) setCollections(await res.json());
  }, [authorId]);

  useEffect(() => {
    fetchCollections();
  }, [authorId, fetchCollections]);

  useEffect(() => {
    if (!uploading && totalCount > 0 && doneCount > 0) {
      fetchCollections();
    }
  }, [uploading, totalCount, doneCount, fetchCollections]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    await processFiles(authorId, Array.from(fileList));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
    if (uploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFiles(authorId, files);
    }
  };

  const handleDelete = async (cid: string) => {
    await fetch(`/api/authors/${authorId}/collections/${cid}`, { method: "DELETE" });
    fetchCollections();
  };

  return (
    <div className="space-y-4 animate-fade-in">
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
              建索引队列处理中… ({doneCount}/{totalCount})
            </span>
          </div>
        ) : (
          <>
            <Upload className="mx-auto mb-2 h-6 w-6 text-[#52525B]" />
            <p className="text-sm text-[#71717A]">点击或拖拽上传 .txt 文件</p>
            <p className="mt-1 text-[10px] text-[#52525B]">支持批量选择多个文件，服务端会自动排队完成分块、Embedding 与索引写入</p>
          </>
        )}
      </div>

      {uploadTasks.length > 0 && (
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
                {task.file.name}
              </span>
              {task.status === "queued" && (
                <span className="text-amber-400/80 flex-shrink-0 text-[10px]">排队中</span>
              )}
              {task.status === "processing" && (
                <span className="text-[#C8A96E] flex-shrink-0 text-[10px]">处理中</span>
              )}
              {task.status === "done" && task.chunkCount !== undefined && (
                <span className="text-[#52525B] flex-shrink-0">{task.chunkCount} 片段</span>
              )}
              {task.status === "error" && task.error && (
                <span className="text-[#EF4444] flex-shrink-0 text-[10px]">{task.error}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {collections.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#71717A]">
            已上传文本集
            <span className="ml-2 text-[10px] text-[#52525B]">{collections.length} 个文件</span>
          </p>
          <div className="divide-y divide-[#2A2A2E] rounded-lg border border-[#2A2A2E] bg-[#141416]">
            {collections.map((collection) => (
              <div key={collection.id} className="flex items-center gap-3 px-3 py-2.5 group">
                <FileText className="h-4 w-4 flex-shrink-0 text-[#52525B]" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm text-[#E4E4E7]">{collection.filename}</p>
                  <p className="text-[10px] text-[#52525B]">
                    {collection.chunk_count} 片段 · {new Date(collection.created_at).toLocaleDateString("zh-CN")}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(collection.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-[#52525B] hover:text-[#EF4444] transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
