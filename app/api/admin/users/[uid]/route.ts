import { NextRequest, NextResponse } from "next/server";
import { getUser, updateUser, deleteUser, toPublicUser } from "@/lib/db/sqlite";
import { requireAdmin } from "@/lib/auth/session";
import { nowISO } from "@/lib/utils";

interface Ctx {
  params: Promise<{ uid: string }>;
}

/**
 * PATCH：admin 修改用户的 role / status / monthly_quota（以及清零本月已用 quota_used）
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { uid } = await ctx.params;
  const user = getUser(uid);
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const patch: Parameters<typeof updateUser>[1] = {};

  if (body.role === "user" || body.role === "admin") {
    patch.role = body.role;
  }
  if (body.status === "active" || body.status === "banned") {
    patch.status = body.status;
  }
  if (typeof body.monthly_quota === "number" && body.monthly_quota >= 0) {
    patch.monthly_quota = Math.floor(body.monthly_quota);
  }
  if (body.reset_quota_used === true) {
    patch.quota_used = 0;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
  }

  // 禁止 admin 把自己降级/禁用，以免失去管理员入口
  if (uid === admin.id && (patch.role === "user" || patch.status === "banned")) {
    return NextResponse.json({ error: "不能修改自己的角色或状态" }, { status: 400 });
  }

  updateUser(uid, patch, nowISO());
  return NextResponse.json(toPublicUser(getUser(uid)!));
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { uid } = await ctx.params;
  if (uid === admin.id) {
    return NextResponse.json({ error: "不能删除自己" }, { status: 400 });
  }

  const user = getUser(uid);
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  // CASCADE 会把该用户私人作家 / 语料 / 生成历史一并清掉
  // 该用户"拥有"的公共作家呢？表设计上 owner_id ON DELETE CASCADE 会把公共作家也连带删掉。
  // 若希望保留公共作家，应先把 owner_id 置 NULL 再删。下面显式处理：
  // （我们明确语义：admin 删人前应把公共作家交接或"取消公开"；简化版本直接级联删。）
  deleteUser(uid);
  return NextResponse.json({ ok: true });
}
