import { NextRequest, NextResponse } from "next/server";
import { getAuthor, getCollectionTexts, updateAuthor } from "@/lib/db";
import { analyzeStyle } from "@/lib/style-analyzer";
import { nowISO } from "@/lib/utils";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const author = getAuthor(id);
  if (!author) {
    return NextResponse.json({ error: "作者不存在" }, { status: 404 });
  }

  // 如果已经在分析中，不允许重复触发
  if (author.style_status === "analyzing") {
    return NextResponse.json({ error: "风格分析正在进行中，请稍候" }, { status: 409 });
  }

  const texts = getCollectionTexts(id);
  if (texts.length === 0) {
    return NextResponse.json({ error: "该作者下没有文本集，请先上传" }, { status: 400 });
  }

  // 1. 立即标记为 analyzing，持久化到数据库
  updateAuthor(id, { style_status: "analyzing" }, nowISO());

  // 2. 后台异步执行分析（不阻塞响应）
  (async () => {
    try {
      const styleMd = await analyzeStyle(texts);
      updateAuthor(
        id,
        { style_md: styleMd, style_status: "done", style_analyzed_at: nowISO() },
        nowISO()
      );
    } catch (err) {
      console.error("[analyze-style] 分析失败:", err);
      updateAuthor(id, { style_status: "failed" }, nowISO());
    }
  })();

  // 3. 立即返回，前端通过轮询获取最新状态
  return NextResponse.json({ style_status: "analyzing" });
}
