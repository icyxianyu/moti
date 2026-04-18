import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUser } from "@/lib/db/sqlite";

/**
 * 从 NextAuth session 拿当前用户。
 * 返回 null 表示未登录。API 路由应自行返回 401（或抛出）。
 *
 * 调用 getUser() 是为了获取最新的 role/status/quota 等可变字段，
 * 而不是信任已经签发出去可能滞后的 JWT 。
 */
export async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = getUser(session.user.id);
  if (!user) return null;
  if (user.status !== "active") return null;
  return user;
}

/**
 * 便捷函数：要求用户已登录，否则直接返回 401 Response。
 * 用法：
 *   const res = await requireUser();
 *   if (res instanceof Response) return res;
 *   const user = res;
 */
export async function requireUser(): Promise<
  | { id: string; email: string; role: "user" | "admin"; name: string | null }
  | Response
> {
  const u = await getSessionUser();
  if (!u) {
    return NextResponse.json({ error: "未登录或会话已失效" }, { status: 401 });
  }
  return { id: u.id, email: u.email, role: u.role, name: u.name };
}

export async function requireAdmin(): Promise<
  | { id: string; email: string; role: "admin"; name: string | null }
  | Response
> {
  const u = await getSessionUser();
  if (!u) {
    return NextResponse.json({ error: "未登录或会话已失效" }, { status: 401 });
  }
  if (u.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }
  return { id: u.id, email: u.email, role: "admin", name: u.name };
}
