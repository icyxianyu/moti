import {
  claimNextQueuedJob,
  completeQueueJob,
  createCollection,
  failQueueJob,
  getAuthor,
  getCollectionTexts,
  getUser,
  type AnalyzeStyleJobPayload,
  type AnalyzeStyleJobResult,
  type IngestCollectionJobPayload,
  type IngestCollectionJobResult,
  type QueueJob,
  type QueueJobType,
  updateAuthor,
} from "@/lib/db/sqlite";
import { analyzeStyle } from "@/lib/rag/style-analyzer";
import { ingestText } from "@/lib/rag/ingest";
import type { LLMConfigOverride } from "@/lib/ai/llm";
import { analyzeLimiter, ingestLimiter } from "@/lib/runtime/task-limiter";
import { nowISO } from "@/lib/utils";

const QUEUE_TYPES: QueueJobType[] = ["analyze_style", "ingest_collection"];

type QueueState = {
  booted: boolean;
  draining: Record<QueueJobType, boolean>;
};

function getQueueState(): QueueState {
  const globalState = globalThis as typeof globalThis & {
    __ragWriterQueueState?: QueueState;
  };

  if (!globalState.__ragWriterQueueState) {
    globalState.__ragWriterQueueState = {
      booted: false,
      draining: {
        analyze_style: false,
        ingest_collection: false,
      },
    };
  }

  return globalState.__ragWriterQueueState;
}

function getLimiter(type: QueueJobType) {
  return type === "analyze_style" ? analyzeLimiter : ingestLimiter;
}

/**
 * 根据 author.owner_id 反查出 owner 的 LLM 覆盖配置。
 * - owner_id 为 null（公共作家，没人"拥有"）或 owner 已删除 → undefined（用系统 env）
 * - owner 三项齐备 → 返回 override
 * - owner 未填 → undefined
 */
function resolveAuthorLLMOverride(ownerId: string | null): LLMConfigOverride | undefined {
  if (!ownerId) return undefined;
  const owner = getUser(ownerId);
  if (!owner) return undefined;
  if (owner.llm_base_url && owner.llm_api_key && owner.llm_model) {
    return {
      baseURL: owner.llm_base_url,
      apiKey: owner.llm_api_key,
      model: owner.llm_model,
    };
  }
  return undefined;
}

async function runAnalyzeStyleJob(
  job: QueueJob<AnalyzeStyleJobPayload, AnalyzeStyleJobResult>
): Promise<AnalyzeStyleJobResult> {
  const author = getAuthor(job.author_id);
  if (!author) {
    throw new Error("作者不存在，无法继续分析");
  }

  const analyzeStartedAt = nowISO();
  updateAuthor(author.id, { style_status: "analyzing" }, analyzeStartedAt);

  const texts = getCollectionTexts(author.id);
  if (texts.length === 0) {
    throw new Error("该作者下没有文本集，请先上传");
  }

  const llmOverride = resolveAuthorLLMOverride(author.owner_id);
  const styleMd = await analyzeStyle(texts, llmOverride);
  const analyzedAt = nowISO();
  updateAuthor(
    author.id,
    { style_md: styleMd, style_status: "done", style_analyzed_at: analyzedAt },
    analyzedAt
  );

  return { style_analyzed_at: analyzedAt };
}

async function runIngestCollectionJob(
  job: QueueJob<IngestCollectionJobPayload, IngestCollectionJobResult>
): Promise<IngestCollectionJobResult> {
  const payload = job.payload;
  const author = getAuthor(payload.authorId);
  if (!author) {
    throw new Error("作者不存在，无法继续建索引");
  }

  const chunkCount = await ingestText(
    payload.authorId,
    payload.collectionId,
    payload.filename,
    payload.rawText
  );

  // 语料归属 = 作家归属。公共作家（owner_id=null）上传的语料也 null，
  // 便于后续若作家被"取消公开/转私"时语义统一。
  createCollection(
    payload.collectionId,
    payload.authorId,
    payload.filename,
    payload.rawText,
    chunkCount,
    payload.queuedAt,
    author.owner_id
  );

  return {
    collection_id: payload.collectionId,
    filename: payload.filename,
    chunk_count: chunkCount,
    created_at: payload.queuedAt,
  };
}

async function processJob(job: QueueJob): Promise<AnalyzeStyleJobResult | IngestCollectionJobResult> {
  if (job.type === "analyze_style") {
    return runAnalyzeStyleJob(job as QueueJob<AnalyzeStyleJobPayload, AnalyzeStyleJobResult>);
  }

  return runIngestCollectionJob(job as QueueJob<IngestCollectionJobPayload, IngestCollectionJobResult>);
}

async function runClaimedJob(job: QueueJob, release: () => void) {
  try {
    const result = await processJob(job);
    completeQueueJob(job.id, result, nowISO());
  } catch (err) {
    const message = err instanceof Error ? err.message : "任务执行失败";
    failQueueJob(job.id, message, nowISO());

    if (job.type === "analyze_style") {
      // 风格分析失败时保留旧的 style_md，只更新状态，方便前端继续显示并支持重试。
      updateAuthor(job.author_id, { style_status: "failed" }, nowISO());
    }

    console.error(`[job-queue] ${job.type} 任务失败:`, err);
  } finally {
    release();
    scheduleQueueDrain(job.type);
  }
}

async function drainQueue(type: QueueJobType) {
  const state = getQueueState();
  if (state.draining[type]) {
    return;
  }

  state.draining[type] = true;

  try {
    while (true) {
      const release = getLimiter(type).tryAcquire();
      if (!release) {
        break;
      }

      const job = claimNextQueuedJob(type, nowISO());
      if (!job) {
        release();
        break;
      }

      void runClaimedJob(job, release);
    }
  } finally {
    state.draining[type] = false;
  }
}

export function ensureQueueWorkersStarted() {
  const state = getQueueState();
  if (state.booted) {
    return;
  }

  state.booted = true;
  setTimeout(() => {
    for (const type of QUEUE_TYPES) {
      void drainQueue(type);
    }
  }, 0);
}

export function scheduleQueueDrain(type?: QueueJobType) {
  ensureQueueWorkersStarted();

  if (type) {
    void drainQueue(type);
    return;
  }

  for (const queueType of QUEUE_TYPES) {
    void drainQueue(queueType);
  }
}
