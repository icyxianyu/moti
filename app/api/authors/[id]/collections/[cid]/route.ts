import { NextRequest, NextResponse } from "next/server";
import { getCollection, deleteCollection } from "@/lib/db";
import { deleteByPrefix } from "@/lib/vector-store";

interface Ctx {
  params: Promise<{ id: string; cid: string }>;
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id, cid } = await ctx.params;

  const collection = getCollection(cid);
  if (!collection || collection.author_id !== id) {
    return NextResponse.json({ error: "文本集不存在" }, { status: 404 });
  }

  await deleteByPrefix(id, `${cid}__`);
  deleteCollection(cid);

  return NextResponse.json({ ok: true });
}
