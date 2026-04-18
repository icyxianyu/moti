"use client";

import { useEffect, useMemo, useState } from "react";
import { Maximize2, PenSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PromptFieldEditorProps {
  label: string;
  hint?: string;
  description?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
}

export function PromptFieldEditor({
  label,
  hint,
  description,
  placeholder,
  value,
  onChange,
  maxLength,
  required = false,
  multiline = true,
  rows = 12,
}: PromptFieldEditorProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!open) {
      setDraft(value);
    }
  }, [value, open]);

  const preview = useMemo(() => {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) return "";
    return normalized.length > 100 ? `${normalized.slice(0, 100)}…` : normalized;
  }, [value]);

  const remaining = maxLength - draft.length;
  const isFilled = value.trim().length > 0;

  const openEditor = () => {
    setDraft(value);
    setOpen(true);
  };

  const handleSave = () => {
    onChange(draft);
    setOpen(false);
  };

  return (
    <>
      <div
        className={cn(
          "group rounded-2xl border bg-[#141416] p-3 transition-all",
          required && !isFilled
            ? "border-[#C8A96E]/40 bg-[#C8A96E]/[0.03] shadow-[0_0_0_1px_rgba(200,169,110,0.08)]"
            : "border-[#2A2A2E] hover:border-[#3A3A40] hover:bg-[#18181B]"
        )}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl border border-[#2A2A2E] bg-[#0F0F11] p-2 text-[#C8A96E]">
            <PenSquare className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-[#E4E4E7]">{label}</span>
                {required && <span className="text-xs text-[#C8A96E]">必填</span>}
              </div>
              {hint && (
                <span className="rounded-full border border-[#2A2A2E] bg-[#0F0F11] px-2 py-0.5 text-[10px] text-[#71717A]">
                  {hint}
                </span>
              )}
            </div>

            <div className="min-h-[52px] rounded-xl border border-dashed border-[#232327] bg-[#0D0D0F] px-3 py-2.5">
              {preview ? (
                <p className="line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-[#D4D4D8]">
                  {preview}
                </p>
              ) : (
                <p className="line-clamp-2 text-sm leading-6 text-[#52525B]">{placeholder}</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 text-[11px] text-[#6B7280]">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#C8A96E]/70" />
                <span>{isFilled ? `已填写 ${value.length} 字` : "点击展开后可输入更长内容"}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={openEditor}
                className="h-7 rounded-full border border-[#2A2A2E] px-3 text-[11px] text-[#C8A96E] hover:border-[#C8A96E]/40 hover:bg-[#C8A96E]/10 hover:text-[#E7D2A6]"
              >
                <Maximize2 className="h-3 w-3" />
                展开编辑
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-[#2A2A2E] bg-[#101012] p-0 text-[#E4E4E7] shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:max-w-3xl overflow-hidden">
          <DialogHeader className="border-b border-[#232327] bg-[linear-gradient(135deg,rgba(200,169,110,0.14),rgba(10,10,11,0.92)_58%)] px-6 py-5 text-left">
            <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[#C8A96E]/80">
              <Sparkles className="h-3.5 w-3.5" />
              沉浸编辑
            </div>
            <DialogTitle className="text-xl font-semibold text-[#F4F4F5]">{label}</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-[#A1A1AA]">
              {description ?? placeholder}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="flex items-center justify-between text-xs text-[#71717A]">
              <div className="flex items-center gap-2">
                {required && (
                  <span className="rounded-full border border-[#C8A96E]/30 bg-[#C8A96E]/10 px-2 py-0.5 text-[#C8A96E]">
                    必填字段
                  </span>
                )}
                {hint && (
                  <span className="rounded-full border border-[#2A2A2E] bg-[#16161A] px-2 py-0.5 text-[#8B8B93]">
                    {hint}
                  </span>
                )}
              </div>
              <span>
                {draft.length}/{maxLength}
              </span>
            </div>

            {multiline ? (
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, maxLength))}
                rows={rows}
                maxLength={maxLength}
                placeholder={placeholder}
                className="min-h-[320px] resize-none rounded-2xl border-[#2A2A2E] bg-[#0A0A0B] px-4 py-3 text-sm leading-7 text-[#E4E4E7] placeholder:text-[#52525B] focus-visible:ring-[#C8A96E]/30"
              />
            ) : (
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, maxLength))}
                maxLength={maxLength}
                placeholder={placeholder}
                className="h-12 rounded-2xl border-[#2A2A2E] bg-[#0A0A0B] px-4 text-base text-[#E4E4E7] placeholder:text-[#52525B] focus-visible:ring-[#C8A96E]/30"
              />
            )}

            <p className="text-xs leading-6 text-[#6B7280]">
              写完点击“保存内容”回填到左侧。这样左栏保持简洁，但需要展开时仍然有足够大的输入空间。
            </p>
          </div>

          <DialogFooter className="border-t border-[#232327] bg-[#0C0C0D] px-6 py-4 sm:justify-between sm:space-x-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft(value);
                setOpen(false);
              }}
              className="text-[#A1A1AA] hover:bg-[#1C1C20] hover:text-[#F4F4F5]"
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="bg-[#C8A96E] text-[#0A0A0B] hover:bg-[#D7B77A]"
            >
              保存内容
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
