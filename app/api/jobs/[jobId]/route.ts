import { NextRequest, NextResponse } from "next/server";
import { getQueueJob } from "@/lib/db/sqlite";
import { ensureQueueWorkersStarted } from "@/lib/runtime/job-queue";
import { requireUser } from "@/lib/auth/session";
import { getAuthorForRead } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ jobId: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  ensureQueueWorkersStarted();

  const { jobId } = await ctx.params;
  const job = getQueueJob(jobId);
  if (!job) return NextResponse.json({ error: "任务不存在" }, { status: 404 });

  // 校验当前用户是否能看这个 job（通过它所属 author 的读权限）
  const author = getAuthorForRead(job.author_id, user);
  if (author instanceof Response) return author;

  return NextResponse.json({
    id: job.id,
    type: job.type,
    author_id: job.author_id,
    status: job.status,
    result: job.result,
    error: job.error,
    created_at: job.created_at,
    started_at: job.started_at,
    finished_at: job.finished_at,
    updated_at: job.updated_at,
  });
}
