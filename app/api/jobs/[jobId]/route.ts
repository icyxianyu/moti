import { NextRequest, NextResponse } from "next/server";
import { getQueueJob } from "@/lib/db";
import { ensureQueueWorkersStarted } from "@/lib/job-queue";

interface Ctx {
  params: Promise<{ jobId: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  ensureQueueWorkersStarted();

  const { jobId } = await ctx.params;
  const job = getQueueJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

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
