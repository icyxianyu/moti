import { NextRequest, NextResponse } from "next/server";
import { getAuthor } from "@/lib/db";
import { count } from "@/lib/vector-store";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const author = getAuthor(id);
  if (!author) {
    return NextResponse.json({ error: "作者不存在" }, { status: 404 });
  }

  const chunks = await count(id);
  return NextResponse.json({ ok: true, chunks });
}
