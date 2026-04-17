import { NextRequest, NextResponse } from "next/server";
import { getGeneration, deleteGeneration } from "@/lib/db";

interface Ctx {
  params: Promise<{ id: string; hid: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id, hid } = await ctx.params;

  const gen = getGeneration(hid);
  if (!gen || gen.author_id !== id) {
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  }

  return NextResponse.json(gen);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id, hid } = await ctx.params;

  const gen = getGeneration(hid);
  if (!gen || gen.author_id !== id) {
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  }

  deleteGeneration(hid);
  return NextResponse.json({ ok: true });
}
