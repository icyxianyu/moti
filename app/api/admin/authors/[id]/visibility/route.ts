import { NextRequest, NextResponse } from "next/server";
import { getAuthor, updateAuthor } from "@/lib/db/sqlite";
import { requireAdmin } from "@/lib/auth/session";
import { nowISO } from "@/lib/utils";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * admin 专用：切换作家可见性 public/private
 * body: { visibility: 'public' | 'private' }
 *
 * 设计说明：只有 admin 能"发布"为 public，普通用户的私人作家提升请求走 admin。
 * 这样避免普通用户把含敏感素材的作家误公开影响其他人。
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { id } = await ctx.params;
  const author = getAuthor(id);
  if (!author) return NextResponse.json({ error: "作者不存在" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (body.visibility !== "public" && body.visibility !== "private") {
    return NextResponse.json({ error: "visibility 仅接受 public/private" }, { status: 400 });
  }

  updateAuthor(id, { visibility: body.visibility }, nowISO());
  return NextResponse.json({ ok: true, visibility: body.visibility });
}
