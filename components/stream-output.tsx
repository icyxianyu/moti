"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Square, Copy } from "lucide-react";
import { MarkdownView } from "@/components/markdown-view";

interface Props {
  text: string;
  statusMsg: string;
  generating: boolean;
  onStop: () => void;
  onCopy: () => void;
}

/**
 * 流式输出：
 * - 正文通过 Portal 挂到右侧面板的 #stream-output 容器上，
 *   切换 Tab 时不会销毁正在进行的生成流。
 * - 按钮仍然就地渲染在左栏创作区下方，方便操作。
 */
export function StreamOutput({ text, statusMsg, generating, onStop, onCopy }: Props) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  // 找到右侧挂载点（右侧面板进入 generating 模式后才会出现）
  useEffect(() => {
    const find = () => document.getElementById("stream-output");

    const initial = find();
    if (initial) {
      setContainer(initial);
      return;
    }

    // 挂载点可能在右侧面板切换时才渲染出来，用 MutationObserver 等它出现
    const observer = new MutationObserver(() => {
      const el = find();
      if (el) {
        setContainer(el);
        observer.disconnect();
        observerRef.current = null;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  // 自动滚到底
  useEffect(() => {
    if (!container) return;
    const scrollable = container.closest("[data-radix-scroll-area-viewport]") ?? container.closest("[class*='overflow']");
    if (scrollable) {
      (scrollable as HTMLElement).scrollTop = (scrollable as HTMLElement).scrollHeight;
    }
  }, [text, statusMsg, container]);

  const body = (
    <>
      {statusMsg && (
        <div className="mb-4 text-xs text-[#71717A] animate-fade-in">{statusMsg}</div>
      )}
      {text ? (
        <MarkdownView content={text} typing={generating} />
      ) : generating ? (
        <div className="text-sm text-[#52525B] typing-cursor">模型正在组织语言</div>
      ) : null}
    </>
  );

  return (
    <>
      {container ? createPortal(body, container) : null}
      <div className="mt-2 flex items-center gap-2">
        {generating && (
          <Button
            onClick={onStop}
            variant="ghost"
            size="sm"
            className="text-[#EF4444] hover:bg-[#EF4444]/10 hover:text-[#F87171]"
          >
            <Square className="mr-1.5 h-3.5 w-3.5" />
            停止生成
          </Button>
        )}
        {text && (
          <Button
            onClick={onCopy}
            variant="ghost"
            size="sm"
            className="text-[#71717A] hover:text-[#C8A96E] hover:bg-[#1C1C20]"
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            复制全文
          </Button>
        )}
      </div>
    </>
  );
}
