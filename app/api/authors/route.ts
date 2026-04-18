import { NextRequest, NextResponse } from "next/server";
import { createAuthor, listAuthorsForUser } from "@/lib/db/sqlite";
import { ensureQueueWorkersStarted } from "@/lib/runtime/job-queue";
import { requireUser } from "@/lib/auth/session";
import { genId, nowISO } from "@/lib/utils";

export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;

  ensureQueueWorkersStarted();

  // admin 也只看"自己的 + 公共的"，如果需要看全部私人作家，走 /api/admin/authors
  const authors = listAuthorsForUser(user.id);
  return NextResponse.json(authors);
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const body = await req.json();
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "请提供作者名称" }, { status: 400 });
  }

  const id = genId();
  const now = nowISO();
  // 普通用户新建的作家一律 private，归自己
  createAuthor(id, name, now, user.id, "private");

  return NextResponse.json(
    {
      id,
      name,
      owner_id: user.id,
      visibility: "private",
      style_md: null,
      style_status: "idle",
      style_analyzed_at: null,
      created_at: now,
      updated_at: now,
    },
    { status: 201 }
  );
}
