import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { countUsers, createUser, getUserByEmail } from "@/lib/db/sqlite";
import { genId, nowISO } from "@/lib/utils";

/**
 * 注册端点。
 * - 第一位注册者自动成为 admin
 * - 之后的注册者为普通 user
 * - 邮箱重复直接 409
 *
 * 注意：本接口必须在 middleware 白名单里（否则未登录 POST 不过）。
 * 在 auth.config.ts 的 authorized() 里，/register 页面已放行，
 * 但 /api/auth/register 是 API 路径，不在 publicPaths，需要特判。
 * —— 放在 /api/auth/register 下是为了与 next-auth 的 /api/auth/* 路径同源，
 *    middleware 的 matcher 已经排除了整个 /api/auth/*。
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const name = body?.name ? String(body.name).trim() : null;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
  }

  if (getUserByEmail(email)) {
    return NextResponse.json({ error: "该邮箱已被注册" }, { status: 409 });
  }

  const isFirstUser = countUsers() === 0;
  const passwordHash = await bcrypt.hash(password, 10);
  const id = genId();
  const now = nowISO();

  createUser({
    id,
    email,
    name,
    passwordHash,
    role: isFirstUser ? "admin" : "user",
    monthlyQuota: isFirstUser ? 999999 : 3,
    now,
  });

  return NextResponse.json(
    {
      ok: true,
      id,
      email,
      role: isFirstUser ? "admin" : "user",
      message: isFirstUser ? "已创建首个账号（admin）" : "注册成功",
    },
    { status: 201 }
  );
}
