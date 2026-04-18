"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, ChevronDown, Search, Check, Globe2, Lock, X } from "lucide-react";
import type { Author } from "@/hooks/use-authors";

interface Props {
  authors: Author[];
  currentAuthor: Author | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

export function AuthorSwitcher({ authors, currentAuthor, onSelect, onRefresh }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const wrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 打开时自动聚焦搜索框 + 清空查询
  useEffect(() => {
    if (open) {
      setQuery("");
      const t = setTimeout(() => searchInputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  // 点外部 / 按 Esc 关闭
  useEffect(() => {
    if (!open) return;

    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const { myAuthors, publicAuthors } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? authors.filter((a) => a.name.toLowerCase().includes(q))
      : authors;

    const mine: Author[] = [];
    const pub: Author[] = [];
    for (const a of filtered) {
      if (a.visibility === "public") pub.push(a);
      else mine.push(a);
    }
    return { myAuthors: mine, publicAuthors: pub };
  }, [authors, query]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    const res = await fetch("/api/authors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      onRefresh();
      onSelect(data.id);
      setNewName("");
      setShowCreate(false);
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!currentAuthor) return;
    setLoading(true);
    await fetch(`/api/authors/${currentAuthor.id}`, { method: "DELETE" });
    onRefresh();
    setShowDelete(false);
    setLoading(false);
  };

  const handlePick = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  const isCurrentPublic = currentAuthor?.visibility === "public";

  return (
    <div className="flex items-center gap-2">
      {/* 行内下拉：触发按钮 + 浮层 */}
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`group flex h-8 min-w-[200px] max-w-[280px] items-center gap-2 rounded-md border bg-transparent px-2.5 py-1 text-sm text-[#E4E4E7] transition-colors ${
            open
              ? "border-[#C8A96E]/60 bg-[#1C1C20]"
              : "border-[#2A2A2E] hover:border-[#C8A96E]/40 hover:bg-[#1C1C20]"
          }`}
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#C8A96E]" />
          <span className="truncate flex-1 text-left">
            {currentAuthor?.name ?? "挑一位作者…"}
          </span>
          {currentAuthor && (
            <span
              className={`shrink-0 rounded px-1 text-[10px] ${
                isCurrentPublic
                  ? "bg-[#C8A96E]/15 text-[#C8A96E]"
                  : "bg-[#3F3F46]/40 text-[#A1A1AA]"
              }`}
              title={isCurrentPublic ? "公共作家" : "私有作家"}
            >
              {isCurrentPublic ? "公共" : "私有"}
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-[#71717A] transition-transform group-hover:text-[#C8A96E] ${
              open ? "rotate-180 text-[#C8A96E]" : ""
            }`}
          />
        </button>

        {open && (
          <div
            className="absolute left-0 top-[calc(100%+6px)] z-50 w-[320px] overflow-hidden rounded-md border border-[#2A2A2E] bg-[#141416] shadow-xl shadow-black/40"
            // 阻止 mousedown 冒泡出去误触外部关闭
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#52525B]" />
                <Input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索作家名…"
                  className="h-8 border-[#2A2A2E] bg-[#0A0A0B] pl-8 pr-8 text-sm text-[#E4E4E7] placeholder:text-[#52525B] focus-visible:ring-[#C8A96E]/30"
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
            </div>

            <div className="max-h-[340px] overflow-y-auto px-1.5 pb-2">
              {myAuthors.length === 0 && publicAuthors.length === 0 && (
                <p className="px-3 py-8 text-center text-xs text-[#52525B]">
                  {query ? "没有匹配的作家" : "还没有作家，点 + 新建一位"}
                </p>
              )}

              {myAuthors.length > 0 && (
                <AuthorGroup
                  icon={<Lock className="h-3 w-3" />}
                  label="我的作家"
                  count={myAuthors.length}
                  authors={myAuthors}
                  currentId={currentAuthor?.id}
                  onPick={handlePick}
                />
              )}

              {publicAuthors.length > 0 && (
                <AuthorGroup
                  icon={<Globe2 className="h-3 w-3" />}
                  label="公共作家"
                  count={publicAuthors.length}
                  authors={publicAuthors}
                  currentId={currentAuthor?.id}
                  onPick={handlePick}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-[#71717A] hover:text-[#C8A96E] hover:bg-[#1C1C20]"
        onClick={() => setShowCreate(true)}
        title="新建作家"
      >
        <Plus className="h-4 w-4" />
      </Button>

      {currentAuthor && !isCurrentPublic && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[#71717A] hover:text-[#EF4444] hover:bg-[#1C1C20]"
          onClick={() => setShowDelete(true)}
          title="删除当前作家"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Create Author Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-[#2A2A2E] bg-[#141416] text-[#E4E4E7] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#C8A96E]">新建一位作者</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="给这位作者起个名字"
            className="border-[#2A2A2E] bg-[#0A0A0B] text-[#E4E4E7] placeholder:text-[#52525B] focus-visible:ring-[#C8A96E]/30"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <DialogFooter>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || loading}
              className="bg-[#C8A96E] text-[#0A0A0B] hover:bg-[#8A7344]"
            >
              {loading ? "创建中…" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Author Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="border-[#2A2A2E] bg-[#141416] text-[#E4E4E7] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#EF4444]">删除这位作者</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#71717A]">
            删除「{currentAuthor?.name}」后，他的作品、笔法和所有历史文章都会一起消失，无法恢复。
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDelete(false)} className="text-[#71717A]">
              再想想
            </Button>
            <Button
              onClick={handleDelete}
              disabled={loading}
              className="bg-[#EF4444] text-white hover:bg-[#DC2626]"
            >
              {loading ? "删除中…" : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface GroupProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  authors: Author[];
  currentId?: string;
  onPick: (id: string) => void;
}

function AuthorGroup({ icon, label, count, authors, currentId, onPick }: GroupProps) {
  return (
    <div className="mb-1.5 last:mb-0">
      <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-[#141416] px-2 py-1.5 text-[10px] uppercase tracking-[0.15em] text-[#71717A]">
        {icon}
        <span>{label}</span>
        <span className="text-[#3F3F46]">·</span>
        <span className="tabular-nums text-[#52525B]">{count}</span>
      </div>
      <ul className="space-y-0.5">
        {authors.map((a) => {
          const isActive = a.id === currentId;
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onPick(a.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-[#C8A96E]/10 text-[#C8A96E]"
                    : "text-[#E4E4E7] hover:bg-[#1C1C20] hover:text-[#C8A96E]"
                }`}
              >
                <span className="flex-1 truncate">{a.name}</span>
                {a.style_md && (
                  <span className="text-[9px] text-[#C8A96E]/70">已学笔法</span>
                )}
                {isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
