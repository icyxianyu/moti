import { NextRequest, NextResponse } from "next/server";
import { listAuthors, createAuthor } from "@/lib/db";
import { genId, nowISO } from "@/lib/utils";

export async function GET() {
  const authors = listAuthors();
  return NextResponse.json(authors);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "请提供作者名称" }, { status: 400 });
  }

  const id = genId();
  const now = nowISO();
  createAuthor(id, name, now);

  return NextResponse.json({ id, name, style_md: null, style_status: "idle", style_analyzed_at: null, created_at: now, updated_at: now }, { status: 201 });
}
