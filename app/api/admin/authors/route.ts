import { NextResponse } from "next/server";
import { listAuthors } from "@/lib/db/sqlite";
import { requireAdmin } from "@/lib/auth/session";

/**
 * admin 专用：列出所有作家（含他人私人作家），用于后台管理。
 */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  return NextResponse.json(listAuthors());
}
