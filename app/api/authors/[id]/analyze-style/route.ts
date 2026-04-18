import { NextRequest, NextResponse } from "next/server";
import {
  createQueueJob,
  findActiveQueueJob,
  getCollectionTexts,
  type AnalyzeStyleJobPayload,
  updateAuthor,
} from "@/lib/db/sqlite";
import { ensureQueueWorkersStarted, scheduleQueueDrain } from "@/lib/runtime/job-queue";
import { requireUser } from "@/lib/auth/session";
import { getAuthorForWrite } from "@/lib/auth/access";
import { genId, nowISO } from "@/lib/utils";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  ensureQueueWorkersStarted();

  const { id } = await ctx.params;
  // 风格分析改写 author.style_md → 需要写权限
  const author = getAuthorForWrite(id, user);
  if (author instanceof Response) return author;

  const activeJob = findActiveQueueJob("analyze_style", id);
  if (author.style_status === "queued" || author.style_status === "analyzing" || activeJob) {
    return NextResponse.json(
      {
        error: "风格分析任务已在队列中，请稍候",
        style_status: activeJob?.status === "processing" ? "analyzing" : author.style_status,
        job_id: activeJob?.id ?? null,
      },
      { status: 409 }
    );
  }

  const texts = getCollectionTexts(id);
  if (texts.length === 0) {
    return NextResponse.json({ error: "该作者下没有文本集，请先上传" }, { status: 400 });
  }

  const now = nowISO();
  const job = createQueueJob<AnalyzeStyleJobPayload>(genId(), "analyze_style", id, { authorId: id }, now);

  updateAuthor(id, { style_status: "queued" }, now);
  scheduleQueueDrain("analyze_style");

  return NextResponse.json(
    {
      job_id: job.id,
      style_status: "queued",
      message: "风格分析已加入队列",
    },
    { status: 202 }
  );
}
