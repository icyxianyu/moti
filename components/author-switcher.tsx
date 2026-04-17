"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
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
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[#C8A96E]" />
        <Select value={currentAuthor?.id ?? ""} onValueChange={onSelect}>
          <SelectTrigger className="h-8 w-[180px] border-[#2A2A2E] bg-transparent text-sm text-[#E4E4E7] focus:ring-[#C8A96E]/30">
            <SelectValue placeholder="选择作者…" />
          </SelectTrigger>
          <SelectContent className="border-[#2A2A2E] bg-[#1C1C20]">
            {authors.map((a) => (
              <SelectItem key={a.id} value={a.id} className="text-[#E4E4E7] focus:bg-[#2A2A2E] focus:text-[#C8A96E]">
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-[#71717A] hover:text-[#C8A96E] hover:bg-[#1C1C20]"
        onClick={() => setShowCreate(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>

      {currentAuthor && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[#71717A] hover:text-[#EF4444] hover:bg-[#1C1C20]"
          onClick={() => setShowDelete(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Create Author Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-[#2A2A2E] bg-[#141416] text-[#E4E4E7] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#C8A96E]">新建作者</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="输入作者名称"
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
            <DialogTitle className="text-[#EF4444]">删除作者</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#71717A]">
            确定要删除「{currentAuthor?.name}」吗？该作者的所有文本集、向量索引和生成历史都将被永久删除。
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDelete(false)} className="text-[#71717A]">
              取消
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
