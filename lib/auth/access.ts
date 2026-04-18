import { NextResponse } from "next/server";
import { getAuthor, type Author } from "@/lib/db/sqlite";

export interface AuthedUser {
  id: string;
  role: "user" | "admin";
}

/**
 * 判定某用户对某作家是否具备"只读"权限：
 * - 作家是 public（所有登录用户可读可生成）
 * - 作家 owner_id 等于用户本人
 * - 用户是 admin（看所有）
 */
export function canRead(author: Author, user: AuthedUser): boolean {
  if (author.visibility === "public") return true;
  if (author.owner_id === user.id) return true;
  if (user.role === "admin") return true;
  return false;
}

/**
 * 判定某用户对某作家是否具备"写"权限：
 * - owner 本人
 * - admin
 *
 * 注意：即使作家是 public，非 owner 的普通用户**不能**修改或上传语料，
 * 只能"用它来生成"。这是设计原则：公共作家由创建者/admin 维护。
 */
export function canWrite(author: Author, user: AuthedUser): boolean {
  if (author.owner_id === user.id) return true;
  if (user.role === "admin") return true;
  return false;
}

/**
 * 快捷：取 author + 做读权限校验。失败直接返回 Response。
 */
export function getAuthorForRead(
  authorId: string,
  user: AuthedUser
): Author | Response {
  const author = getAuthor(authorId);
  if (!author) {
    return NextResponse.json({ error: "作者不存在" }, { status: 404 });
  }
  if (!canRead(author, user)) {
    return NextResponse.json({ error: "无权访问该作者" }, { status: 403 });
  }
  return author;
}

/**
 * 快捷：取 author + 做写权限校验。失败直接返回 Response。
 */
export function getAuthorForWrite(
  authorId: string,
  user: AuthedUser
): Author | Response {
  const author = getAuthor(authorId);
  if (!author) {
    return NextResponse.json({ error: "作者不存在" }, { status: 404 });
  }
  if (!canWrite(author, user)) {
    return NextResponse.json({ error: "无权修改该作者" }, { status: 403 });
  }
  return author;
}
