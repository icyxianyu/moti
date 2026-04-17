import { NextRequest, NextResponse } from "next/server";
import {
  createQueueJob,
  findActiveQueueJob,
  getAuthor,
  getCollectionTexts,
  type AnalyzeStyleJobPayload,
  updateAuthor,
} from "@/lib/db";
import { ensureQueueWorkersStarted, scheduleQueueDrain } from "@/lib/job-queue";
import { genId, nowISO } from "@/lib/utils";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  ensureQueueWorkersStarted();

  const { id } = await ctx.params;
  const author = getAuthor(id);
  if (!author) {
    return NextResponse.json({ error: "作者不存在" }, { status: 404 });
  }

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

  // 先把作者状态置为 queued，前端即可立即感知“已排队”。
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
