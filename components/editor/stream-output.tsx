"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Square, Copy } from "lucide-react";
import { MarkdownView } from "@/components/editor/markdown-view";

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

  // 找到右侧挂载点。
  // 注意：右侧 #stream-output 容器会在 rightState 切换（generating <-> idle/history）时
  // 被销毁并重建，每次重建都是新 DOM 节点。因此必须在 generating 每次从 false→true 时重找，
  // 否则第二次生成会把 Portal 挂到已经脱离 DOM 的旧容器上，造成右侧空白。
  useEffect(() => {
    if (!generating) return;

    const initial = document.getElementById("stream-output");
    if (initial) {
      setContainer(initial);
      return;
    }

    // 容器可能在 rightState 切换后才被 React 渲染出来，用 MutationObserver 等它出现
    const observer = new MutationObserver(() => {
      const el = document.getElementById("stream-output");
      if (el) {
        setContainer(el);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [generating]);

  // 自动吸底：只有用户正贴着底部时才自动滚；用户上滚阅读则暂停吸底，滚回底部后恢复。
  // 新一轮生成开始（generating false→true）时重置为开启。
  const stickToBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);

  // 找到当前容器对应的可滚动父元素（Radix ScrollArea 或带 overflow 的容器）
  const getScrollable = (): HTMLElement | null => {
    if (!container) return null;
    return (
      (container.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null) ??
      (container.closest("[class*='overflow']") as HTMLElement | null)
    );
  };

  // 监听用户滚动：若往上离开底部→关闭吸底；滚回底部附近→恢复吸底
  useEffect(() => {
    const scrollable = getScrollable();
    if (!scrollable) return;

    lastScrollTopRef.current = scrollable.scrollTop;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollable;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      const scrollingUp = scrollTop < lastScrollTopRef.current;
      lastScrollTopRef.current = scrollTop;

      if (distanceToBottom < 32) {
        // 贴底了：恢复自动吸底
        stickToBottomRef.current = true;
      } else if (scrollingUp) {
        // 用户主动上滚：关闭自动吸底
        stickToBottomRef.current = false;
      }
    };

    scrollable.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollable.removeEventListener("scroll", handleScroll);
  }, [container]);

  // 新一轮生成开始时重置为吸底
  useEffect(() => {
    if (generating) stickToBottomRef.current = true;
  }, [generating]);

  // 文本/状态更新时，若允许吸底就滚到底
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const scrollable = getScrollable();
    if (scrollable) {
      scrollable.scrollTop = scrollable.scrollHeight;
      lastScrollTopRef.current = scrollable.scrollTop;
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
            停下
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
