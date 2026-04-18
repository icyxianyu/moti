import { NextRequest, NextResponse } from "next/server";
import {
  createQueueJob,
  listCollections,
  type IngestCollectionJobPayload,
} from "@/lib/db/sqlite";
import { ensureQueueWorkersStarted, scheduleQueueDrain } from "@/lib/runtime/job-queue";
import { requireUser } from "@/lib/auth/session";
import { getAuthorForRead, getAuthorForWrite } from "@/lib/auth/access";
import { genId, nowISO } from "@/lib/utils";

interface Ctx {
  params: Promise<{ id: string }>;
}

interface UploadQueuedJob {
  job_id: string;
  collection_id: string;
  filename: string;
  status: "queued";
  created_at: string;
}

interface UploadError {
  filename: string;
  error: string;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  ensureQueueWorkersStarted();

  const { id } = await ctx.params;
  const author = getAuthorForRead(id, user);
  if (author instanceof Response) return author;

  // 语料列表跟随 author 的可见性：能读作者就能看到他的文本集（公共作家对所有人只读）
  const collections = listCollections(id);
  return NextResponse.json(collections);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  ensureQueueWorkersStarted();

  const { id } = await ctx.params;
  // 上传语料 = 写入作家，必须有写权限
  const author = getAuthorForWrite(id, user);
  if (author instanceof Response) return author;

  const formData = await req.formData();

  const files: File[] = [];
  const single = formData.get("file") as File | null;
  if (single) files.push(single);
  for (const entry of formData.getAll("files")) {
    if (entry instanceof File) files.push(entry);
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "请上传文件" }, { status: 400 });
  }

  const jobs: UploadQueuedJob[] = [];
  const errors: UploadError[] = [];

  for (const file of files) {
    if (!file.name.endsWith(".txt")) {
      errors.push({ filename: file.name, error: "仅支持 .txt 文件" });
      continue;
    }

    const rawText = await file.text();
    if (rawText.trim().length < 50) {
      errors.push({ filename: file.name, error: "文件内容过短（至少 50 字符）" });
      continue;
    }

    const collectionId = genId();
    const jobId = genId();
    const queuedAt = nowISO();

    const job = createQueueJob<IngestCollectionJobPayload>(jobId, "ingest_collection", id, {
      authorId: id,
      collectionId,
      filename: file.name,
      rawText,
      queuedAt,
    }, queuedAt);

    jobs.push({
      job_id: job.id,
      collection_id: collectionId,
      filename: file.name,
      status: "queued",
      created_at: job.created_at,
    });
  }

  if (jobs.length > 0) {
    scheduleQueueDrain("ingest_collection");
  }

  if (files.length === 1 && errors.length === 0 && jobs.length === 1) {
    return NextResponse.json({ job: jobs[0], message: "文件已加入建索引队列" }, { status: 202 });
  }

  return NextResponse.json(
    {
      jobs,
      errors,
      total: files.length,
      accepted: jobs.length,
      failed: errors.length,
    },
    { status: jobs.length > 0 ? 202 : 400 }
  );
}
