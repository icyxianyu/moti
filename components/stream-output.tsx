"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Square, Copy } from "lucide-react";

interface Props {
  text: string;
  statusMsg: string;
  generating: boolean;
  onStop: () => void;
  onCopy: () => void;
}

export function StreamOutput({ text, statusMsg, generating, onStop, onCopy }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    containerRef.current = document.getElementById("stream-output");
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = "";

      if (statusMsg) {
        const statusEl = document.createElement("div");
        statusEl.className = "text-xs text-[#71717A] mb-4 animate-fade-in";
        statusEl.textContent = statusMsg;
        containerRef.current.appendChild(statusEl);
      }

      if (text) {
        const textEl = document.createElement("div");
        textEl.className = "whitespace-pre-wrap leading-relaxed text-[#E4E4E7]";
        textEl.textContent = text;
        if (generating) {
          textEl.classList.add("typing-cursor");
        }
        containerRef.current.appendChild(textEl);
      }

      // Buttons
      if (text || generating) {
        const btnRow = document.createElement("div");
        btnRow.className = "flex items-center gap-2 mt-6 pt-4 border-t border-[#2A2A2E]";
        containerRef.current.appendChild(btnRow);

        // We'll use a React portal for the buttons instead
      }

      // Auto-scroll
      const panel = containerRef.current?.closest("[class*='overflow']");
      if (panel) {
        panel.scrollTop = panel.scrollHeight;
      }
    }
  }, [text, statusMsg, generating]);

  // Render buttons at the bottom of left panel compose section
  return (
    <div className="flex items-center gap-2 mt-2">
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
  );
}
