import { NextRequest, NextResponse } from "next/server";
import { getAuthor, listCollections, createCollection } from "@/lib/db";
import { ingestText } from "@/lib/ingest";
import { genId, nowISO } from "@/lib/utils";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const author = getAuthor(id);
  if (!author) {
    return NextResponse.json({ error: "作者不存在" }, { status: 404 });
  }

  const collections = listCollections(id);
  return NextResponse.json(collections);
}

interface UploadResult {
  id: string;
  author_id: string;
  filename: string;
  chunk_count: number;
  created_at: string;
  error?: undefined;
}

interface UploadError {
  filename: string;
  error: string;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const author = getAuthor(id);
  if (!author) {
    return NextResponse.json({ error: "作者不存在" }, { status: 404 });
  }

  const formData = await req.formData();

  // 支持批量上传：同时接受 "file"（单文件兼容）和 "files"（多文件）
  const files: File[] = [];
  const single = formData.get("file") as File | null;
  if (single) files.push(single);
  for (const entry of formData.getAll("files")) {
    if (entry instanceof File) files.push(entry);
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "请上传文件" }, { status: 400 });
  }

  const results: UploadResult[] = [];
  const errors: UploadError[] = [];

  for (const file of files) {
    // 校验扩展名
    if (!file.name.endsWith(".txt")) {
      errors.push({ filename: file.name, error: "仅支持 .txt 文件" });
      continue;
    }

    const rawText = await file.text();

    // 校验内容长度
    if (rawText.trim().length < 50) {
      errors.push({ filename: file.name, error: "文件内容过短（至少 50 字符）" });
      continue;
    }

    const collectionId = genId();
    const now = nowISO();

    try {
      const chunkCount = await ingestText(id, collectionId, file.name, rawText);
      createCollection(collectionId, id, file.name, rawText, chunkCount, now);
      results.push({
        id: collectionId,
        author_id: id,
        filename: file.name,
        chunk_count: chunkCount,
        created_at: now,
      });
    } catch (err) {
      errors.push({ filename: file.name, error: (err as Error).message });
    }
  }

  // 单文件模式：保持向后兼容
  if (files.length === 1 && errors.length === 0 && results.length === 1) {
    return NextResponse.json(results[0], { status: 201 });
  }

  return NextResponse.json(
    { results, errors, total: files.length, success: results.length, failed: errors.length },
    { status: errors.length === files.length ? 400 : 201 }
  );
}
