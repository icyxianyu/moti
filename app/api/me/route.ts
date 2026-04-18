import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUser, updateUser, toPublicUser } from "@/lib/db/sqlite";
import { requireUser } from "@/lib/auth/session";
import { nowISO } from "@/lib/utils";

/**
 * GET  /api/me          返回当前用户（脱敏：不含 password_hash / llm_api_key 原文）
 * PATCH /api/me         更新 name / 密码 / LLM 覆盖（base_url / api_key / model）
 */
export async function GET() {
  const u = await requireUser();
  if (u instanceof Response) return u;
  const full = getUser(u.id);
  if (!full) return NextResponse.json({ error: "会话已失效" }, { status: 401 });
  return NextResponse.json(toPublicUser(full));
}

export async function PATCH(req: NextRequest) {
  const u = await requireUser();
  if (u instanceof Response) return u;
  const me = getUser(u.id);
  if (!me) return NextResponse.json({ error: "会话已失效" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch: Parameters<typeof updateUser>[1] = {};

  if (typeof body.name === "string") {
    patch.name = body.name.trim() || null;
  }

  // LLM 覆盖配置：任一字段可独立清空（传空串）或更新
  if (body.llm_base_url !== undefined) {
    patch.llm_base_url = body.llm_base_url ? String(body.llm_base_url).trim() : null;
  }
  if (body.llm_model !== undefined) {
    patch.llm_model = body.llm_model ? String(body.llm_model).trim() : null;
  }
  if (body.llm_api_key !== undefined) {
    // 空串 = 清除；其他值原样存。明文存 SQLite，单机自部署场景可接受。
    const key = body.llm_api_key ? String(body.llm_api_key) : "";
    patch.llm_api_key = key ? key : null;
  }

  // 改密码（需要旧密码）
  if (body.new_password) {
    const newPw = String(body.new_password);
    if (newPw.length < 6) {
      return NextResponse.json({ error: "新密码至少 6 位" }, { status: 400 });
    }
    const oldPw = String(body.current_password ?? "");
    const ok = await bcrypt.compare(oldPw, me.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });
    }
    patch.password_hash = await bcrypt.hash(newPw, 10);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
  }

  updateUser(u.id, patch, nowISO());
  const updated = getUser(u.id);
  return NextResponse.json(toPublicUser(updated!));
}
