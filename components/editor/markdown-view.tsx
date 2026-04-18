"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface Props {
  content: string;
  className?: string;
  /** 是否在末尾显示打字光标（流式生成时用） */
  typing?: boolean;
}

/**
 * 富文本 Markdown 展示组件
 * - 支持 GFM（表格、任务列表、删除线等）
 * - 统一采用项目的暗色 / 金色排版
 * - 代码块、引用、表格等都做了深色主题适配
 */
export function MarkdownView({ content, className, typing }: Props) {
  return (
    <div
      className={cn(
        "prose prose-invert max-w-none",
        "prose-headings:font-serif prose-headings:text-[#F4E2B8] prose-headings:tracking-tight",
        "prose-h1:text-2xl prose-h1:mt-0 prose-h1:mb-4",
        "prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:border-b prose-h2:border-[#2A2A2E] prose-h2:pb-2",
        "prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2 prose-h3:text-[#E7D2A6]",
        "prose-h4:text-base prose-h4:text-[#E7D2A6]",
        "prose-p:text-[#E4E4E7] prose-p:leading-[1.9] prose-p:my-4",
        "prose-strong:text-[#F4E2B8] prose-strong:font-semibold",
        "prose-em:text-[#E7D2A6]",
        "prose-a:text-[#C8A96E] prose-a:no-underline hover:prose-a:text-[#E7D2A6] hover:prose-a:underline",
        "prose-blockquote:border-l-2 prose-blockquote:border-[#C8A96E]/60 prose-blockquote:bg-[#141416]/60 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-md prose-blockquote:not-italic prose-blockquote:text-[#A1A1AA]",
        "prose-ul:my-4 prose-ol:my-4 prose-li:my-1 prose-li:text-[#E4E4E7] marker:text-[#C8A96E]",
        "prose-hr:border-[#2A2A2E] prose-hr:my-8",
        "prose-code:text-[#E7D2A6] prose-code:bg-[#1C1C20] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-[0.875em] prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:bg-[#0F0F11] prose-pre:border prose-pre:border-[#2A2A2E] prose-pre:rounded-lg prose-pre:p-4 prose-pre:my-4",
        "prose-table:my-4 prose-table:border-collapse",
        "prose-th:border prose-th:border-[#2A2A2E] prose-th:bg-[#141416] prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-[#E7D2A6]",
        "prose-td:border prose-td:border-[#2A2A2E] prose-td:px-3 prose-td:py-2 prose-td:text-[#E4E4E7]",
        "prose-img:rounded-lg prose-img:border prose-img:border-[#2A2A2E]",
        typing && "typing-cursor",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 代码块：区分内联 / 多行
          code({ className: codeClass, children, ...props }) {
            const isBlock = /\n/.test(String(children ?? ""));
            if (isBlock) {
              return (
                <code className={cn("block font-mono text-sm leading-relaxed text-[#E4E4E7]", codeClass)} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={codeClass} {...props}>
                {children}
              </code>
            );
          },
          // 图片：默认安全的 lazy
          img({ alt, ...rest }) {
            // eslint-disable-next-line @next/next/no-img-element
            return <img alt={alt ?? ""} loading="lazy" {...rest} />;
          },
        }}
      >
        {content || ""}
      </ReactMarkdown>
    </div>
  );
}
