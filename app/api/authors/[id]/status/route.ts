import { NextRequest, NextResponse } from "next/server";
import { getAuthorChunkCount } from "@/lib/db/sqlite";
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

  const chunks = getAuthorChunkCount(id);
  return NextResponse.json({ ok: true, chunks });
}
