import { NextResponse } from "next/server";
import { listUsers, toPublicUser } from "@/lib/db/sqlite";
import { requireAdmin } from "@/lib/auth/session";

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const users = listUsers().map(toPublicUser);
  return NextResponse.json(users);
}
