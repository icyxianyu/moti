import { NextRequest, NextResponse } from "next/server";
import { getGeneration, deleteGeneration } from "@/lib/db/sqlite";
import { requireUser } from "@/lib/auth/session";

interface Ctx {
  params: Promise<{ id: string; hid: string }>;
}

function ensureOwnership(
  gen: ReturnType<typeof getGeneration>,
  authorId: string,
  userId: string,
  role: "user" | "admin"
): Response | null {
  if (!gen || gen.author_id !== authorId) {
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  }
  // 历史严格归属调用者；admin 可以看所有
  if (gen.owner_id !== userId && role !== "admin") {
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  }
  return null;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const { id, hid } = await ctx.params;
  const gen = getGeneration(hid);
  const err = ensureOwnership(gen, id, user.id, user.role);
  if (err) return err;

  return NextResponse.json(gen);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const { id, hid } = await ctx.params;
  const gen = getGeneration(hid);
  const err = ensureOwnership(gen, id, user.id, user.role);
  if (err) return err;

  deleteGeneration(hid);
  return NextResponse.json({ ok: true });
}
