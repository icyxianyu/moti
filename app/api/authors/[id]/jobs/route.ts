import { NextRequest, NextResponse } from "next/server";
import { listActiveQueueJobs, type IngestCollectionJobPayload } from "@/lib/db/sqlite";
import { requireUser } from "@/lib/auth/session";
import { getAuthorForRead } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * 列出当前作者下所有"进行中"的 ingest_collection 任务（queued / processing）。
 *
 * 前端用途：页面刷新 / 切换 author 后，上传进度条在 React state 里丢了，
 *          但后台 worker 其实还在跑，通过该接口拉一次即可恢复进度条，
 *          然后前端继续按 jobId 轮询 /api/jobs/{id} 直到完成。
 *
 * 为什么只返回 queued + processing：
 *   - done 的任务已经落到 collections 表，前端已经能在"作品列表"里看到
 *   - failed 的任务短期内用 toast 提示即可，不需要持久化展示（否则要考虑"已读/忽略"语义）
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const { id } = await ctx.params;
  const author = getAuthorForRead(id, user);
  if (author instanceof Response) return author;

  const jobs = listActiveQueueJobs<IngestCollectionJobPayload>("ingest_collection", id);

  // 只暴露前端真正需要的字段，rawText 不回传（体积大、安全敏感）
  return NextResponse.json(
    jobs.map((job) => ({
      job_id: job.id,
      collection_id: job.payload.collectionId,
      filename: job.payload.filename,
      // DB 里是 queued / processing，直接透传给前端
      status: job.status,
      created_at: job.created_at,
    }))
  );
}
