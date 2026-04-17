import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "风格写作 — RAG Writer",
  description: "基于 RAG 的多作者风格写作平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-[#0A0A0B] text-[#E4E4E7] antialiased">
        {children}
      </body>
    </html>
  );
}
