import { NextRequest, NextResponse } from "next/server";
import { getAuthor, getAuthorChunkCount } from "@/lib/db";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const author = getAuthor(id);
  if (!author) {
    return NextResponse.json({ error: "作者不存在" }, { status: 404 });
  }

  const chunks = getAuthorChunkCount(id);
  return NextResponse.json({ ok: true, chunks });
}
