import { NextRequest, NextResponse } from "next/server";
import { getCollection, deleteCollection } from "@/lib/db/sqlite";
import { deleteByPrefix } from "@/lib/db/vector-store";
import { requireUser } from "@/lib/auth/session";
import { getAuthorForRead, getAuthorForWrite } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ id: string; cid: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const { id, cid } = await ctx.params;

  // 读语料 = 读作家（公共作家所有登录用户可读，私有仅 owner/admin）
  const author = getAuthorForRead(id, user);
  if (author instanceof Response) return author;

  const collection = getCollection(cid);
  if (!collection || collection.author_id !== id) {
    return NextResponse.json({ error: "文本集不存在" }, { status: 404 });
  }

  return NextResponse.json({
    id: collection.id,
    author_id: collection.author_id,
    filename: collection.filename,
    raw_text: collection.raw_text,
    chunk_count: collection.chunk_count,
    created_at: collection.created_at,
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const { id, cid } = await ctx.params;

  // 删语料 = 修改作者资产 → 需要写权限
  const author = getAuthorForWrite(id, user);
  if (author instanceof Response) return author;

  const collection = getCollection(cid);
  if (!collection || collection.author_id !== id) {
    return NextResponse.json({ error: "文本集不存在" }, { status: 404 });
  }

  await deleteByPrefix(id, `${cid}__`);
  deleteCollection(cid);

  return NextResponse.json({ ok: true });
}
