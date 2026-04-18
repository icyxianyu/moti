import { NextRequest, NextResponse } from "next/server";
import { updateAuthor, deleteAuthor, getAuthor } from "@/lib/db/sqlite";
import type { StyleStatus } from "@/lib/db/sqlite";
import { ensureQueueWorkersStarted } from "@/lib/runtime/job-queue";
import { removeAuthorIndex } from "@/lib/db/vector-store";
import { requireUser } from "@/lib/auth/session";
import { canRead, canWrite } from "@/lib/auth/access";
import { nowISO } from "@/lib/utils";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  ensureQueueWorkersStarted();

  const { id } = await ctx.params;
  const author = getAuthor(id);
  if (!author) return NextResponse.json({ error: "作者不存在" }, { status: 404 });
  if (!canRead(author, user)) return NextResponse.json({ error: "无权访问该作者" }, { status: 403 });

  return NextResponse.json(author);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const { id } = await ctx.params;
  const author = getAuthor(id);
  if (!author) return NextResponse.json({ error: "作者不存在" }, { status: 404 });
  if (!canWrite(author, user)) return NextResponse.json({ error: "无权修改该作者" }, { status: 403 });

  const body = await req.json();
  const fields: { name?: string; style_md?: string; style_status?: StyleStatus; style_analyzed_at?: string | null } = {};

  if (body.name !== undefined) fields.name = body.name.trim();
  if (body.style_md !== undefined) fields.style_md = body.style_md;

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
  }

  updateAuthor(id, fields, nowISO());
  return NextResponse.json(getAuthor(id));
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const { id } = await ctx.params;
  const author = getAuthor(id);
  if (!author) return NextResponse.json({ error: "作者不存在" }, { status: 404 });
  if (!canWrite(author, user)) return NextResponse.json({ error: "无权删除该作者" }, { status: 403 });

  removeAuthorIndex(id);
  deleteAuthor(id);

  return NextResponse.json({ ok: true });
}
