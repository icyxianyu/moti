import { NextRequest, NextResponse } from "next/server";
import { listGenerationsForUser } from "@/lib/db/sqlite";
import { requireUser } from "@/lib/auth/session";
import { getAuthorForRead } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const { id } = await ctx.params;
  const author = getAuthorForRead(id, user);
  if (author instanceof Response) return author;

  // 历史按用户严格隔离：即使是公共作家，每个人只看自己的生成记录
  const generations = listGenerationsForUser(id, user.id);
  return NextResponse.json(generations);
}
