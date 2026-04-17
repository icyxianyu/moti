import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.sqlite");

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

const RECOVERY_NOW = new Date().toISOString();

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS authors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    style_md TEXT,
    style_status TEXT NOT NULL DEFAULT 'idle',
    style_analyzed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    events TEXT,
    context TEXT,
    extra_note TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS queue_jobs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    result_json TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_queue_jobs_type_status_created_at
  ON queue_jobs (type, status, created_at);

  CREATE INDEX IF NOT EXISTS idx_queue_jobs_author_id_created_at
  ON queue_jobs (author_id, created_at DESC);
`);

// ── Migrations ──────────────────────────────────────────────────────────────
// 为已存在的 authors 表添加 style_status 和 style_analyzed_at 字段
try {
  db.exec(`ALTER TABLE authors ADD COLUMN style_status TEXT NOT NULL DEFAULT 'idle'`);
} catch {
  // 列已存在，忽略
}
try {
  db.exec(`ALTER TABLE authors ADD COLUMN style_analyzed_at TEXT`);
} catch {
  // 列已存在，忽略
}
// 将已有 style_md 但 status 还是 idle 的记录修正为 done
// 同时兼容新引入的 queued 状态。
db.exec(`UPDATE authors SET style_status = 'done' WHERE style_md IS NOT NULL AND style_status = 'idle'`);

// 进程重启后，把未完成的 processing 任务重新放回队列，避免队列“卡死”。
db.prepare(
  `UPDATE queue_jobs
   SET status = 'queued', started_at = NULL, finished_at = NULL, updated_at = ?, error = NULL
   WHERE status = 'processing'`
).run(RECOVERY_NOW);

// 与任务队列同步恢复作者风格状态：
// - 有待执行分析任务时，将作者状态调整为 queued
// - 没有活跃任务却仍停留在 analyzing 的，标记为 failed，避免前端永远转圈
// - 保留已完成风格文本，不主动清空 style_md
db.prepare(
  `UPDATE authors
   SET style_status = 'queued', updated_at = ?
   WHERE style_status = 'analyzing'
     AND EXISTS (
       SELECT 1 FROM queue_jobs
       WHERE queue_jobs.author_id = authors.id
         AND queue_jobs.type = 'analyze_style'
         AND queue_jobs.status = 'queued'
     )`
).run(RECOVERY_NOW);

db.prepare(
  `UPDATE authors
   SET style_status = 'failed', updated_at = ?
   WHERE style_status = 'analyzing'
     AND NOT EXISTS (
       SELECT 1 FROM queue_jobs
       WHERE queue_jobs.author_id = authors.id
         AND queue_jobs.type = 'analyze_style'
         AND queue_jobs.status IN ('queued', 'processing')
     )`
).run(RECOVERY_NOW);

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

// ── Author CRUD ──────────────────────────────────────────────────────────────

export type StyleStatus = "idle" | "queued" | "analyzing" | "done" | "failed";

export interface Author {
  id: string;
  name: string;
  style_md: string | null;
  style_status: StyleStatus;
  style_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function listAuthors(): Author[] {
  return db.prepare("SELECT * FROM authors ORDER BY created_at DESC").all() as Author[];
}

export function getAuthor(id: string): Author | undefined {
  return db.prepare("SELECT * FROM authors WHERE id = ?").get(id) as Author | undefined;
}

export function createAuthor(id: string, name: string, now: string): void {
  db.prepare("INSERT INTO authors (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
    id, name, now, now
  );
}

export function updateAuthor(
  id: string,
  fields: { name?: string; style_md?: string; style_status?: StyleStatus; style_analyzed_at?: string | null },
  now: string
): void {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (fields.name !== undefined) { sets.push("name = ?"); vals.push(fields.name); }
  if (fields.style_md !== undefined) { sets.push("style_md = ?"); vals.push(fields.style_md); }
  if (fields.style_status !== undefined) { sets.push("style_status = ?"); vals.push(fields.style_status); }
  if (fields.style_analyzed_at !== undefined) { sets.push("style_analyzed_at = ?"); vals.push(fields.style_analyzed_at); }
  sets.push("updated_at = ?");
  vals.push(now);
  vals.push(id);
  db.prepare(`UPDATE authors SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

export function deleteAuthor(id: string): void {
  db.prepare("DELETE FROM authors WHERE id = ?").run(id);
}

// ── Collection CRUD ──────────────────────────────────────────────────────────

export interface Collection {
  id: string;
  author_id: string;
  filename: string;
  raw_text: string;
  chunk_count: number;
  created_at: string;
}

export function listCollections(authorId: string): Collection[] {
  return db
    .prepare("SELECT * FROM collections WHERE author_id = ? ORDER BY created_at DESC")
    .all(authorId) as Collection[];
}

export function getCollection(id: string): Collection | undefined {
  return db.prepare("SELECT * FROM collections WHERE id = ?").get(id) as Collection | undefined;
}

export function createCollection(
  id: string,
  authorId: string,
  filename: string,
  rawText: string,
  chunkCount: number,
  now: string
): void {
  // 使用 INSERT OR REPLACE 让入队任务在“建库成功但回写状态前进程重启”的情况下可以安全重试。
  db.prepare(
    "INSERT OR REPLACE INTO collections (id, author_id, filename, raw_text, chunk_count, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, authorId, filename, rawText, chunkCount, now);
}

export function deleteCollection(id: string): void {
  db.prepare("DELETE FROM collections WHERE id = ?").run(id);
}

export function getCollectionTexts(authorId: string): string[] {
  const rows = db
    .prepare("SELECT raw_text FROM collections WHERE author_id = ? ORDER BY created_at")
    .all(authorId) as { raw_text: string }[];
  return rows.map((r) => r.raw_text);
}

export function getAuthorChunkCount(authorId: string): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(chunk_count), 0) AS total FROM collections WHERE author_id = ?")
    .get(authorId) as { total: number } | undefined;
  return row?.total ?? 0;
}

// ── Queue Jobs ───────────────────────────────────────────────────────────────

export type QueueJobType = "analyze_style" | "ingest_collection";
export type QueueJobStatus = "queued" | "processing" | "done" | "failed";

export interface AnalyzeStyleJobPayload {
  authorId: string;
}

export interface AnalyzeStyleJobResult {
  style_analyzed_at: string;
}

export interface IngestCollectionJobPayload {
  authorId: string;
  collectionId: string;
  filename: string;
  rawText: string;
  queuedAt: string;
}

export interface IngestCollectionJobResult {
  collection_id: string;
  filename: string;
  chunk_count: number;
  created_at: string;
}

interface QueueJobRow {
  id: string;
  type: QueueJobType;
  author_id: string;
  status: QueueJobStatus;
  payload_json: string;
  result_json: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

export interface QueueJob<TPayload = unknown, TResult = unknown> {
  id: string;
  type: QueueJobType;
  author_id: string;
  status: QueueJobStatus;
  payload: TPayload;
  result: TResult | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

function toQueueJob<TPayload, TResult>(row: QueueJobRow): QueueJob<TPayload, TResult> {
  return {
    id: row.id,
    type: row.type,
    author_id: row.author_id,
    status: row.status,
    payload: JSON.parse(row.payload_json) as TPayload,
    result: parseJson<TResult>(row.result_json),
    error: row.error,
    created_at: row.created_at,
    started_at: row.started_at,
    finished_at: row.finished_at,
    updated_at: row.updated_at,
  };
}

export function createQueueJob<TPayload>(
  id: string,
  type: QueueJobType,
  authorId: string,
  payload: TPayload,
  now: string
): QueueJob<TPayload> {
  db.prepare(
    `INSERT INTO queue_jobs (
      id, type, author_id, status, payload_json, result_json, error,
      created_at, started_at, finished_at, updated_at
    ) VALUES (?, ?, ?, 'queued', ?, NULL, NULL, ?, NULL, NULL, ?)`
  ).run(id, type, authorId, JSON.stringify(payload), now, now);

  return getQueueJob<TPayload>(id)!;
}

export function getQueueJob<TPayload = unknown, TResult = unknown>(
  id: string
): QueueJob<TPayload, TResult> | undefined {
  const row = db.prepare("SELECT * FROM queue_jobs WHERE id = ?").get(id) as QueueJobRow | undefined;
  return row ? toQueueJob<TPayload, TResult>(row) : undefined;
}

export function findActiveQueueJob<TPayload = unknown, TResult = unknown>(
  type: QueueJobType,
  authorId: string
): QueueJob<TPayload, TResult> | undefined {
  const row = db.prepare(
    `SELECT * FROM queue_jobs
     WHERE type = ? AND author_id = ? AND status IN ('queued', 'processing')
     ORDER BY created_at DESC
     LIMIT 1`
  ).get(type, authorId) as QueueJobRow | undefined;

  return row ? toQueueJob<TPayload, TResult>(row) : undefined;
}

export function claimNextQueuedJob<TPayload = unknown, TResult = unknown>(
  type: QueueJobType,
  now: string
): QueueJob<TPayload, TResult> | null {
  const claim = db.transaction((jobType: QueueJobType, claimAt: string) => {
    const row = db.prepare(
      `SELECT * FROM queue_jobs
       WHERE type = ? AND status = 'queued'
       ORDER BY created_at ASC
       LIMIT 1`
    ).get(jobType) as QueueJobRow | undefined;

    if (!row) {
      return null;
    }

    const updated = db.prepare(
      `UPDATE queue_jobs
       SET status = 'processing', started_at = ?, updated_at = ?
       WHERE id = ? AND status = 'queued'`
    ).run(claimAt, claimAt, row.id);

    if (updated.changes === 0) {
      return null;
    }

    const claimed = db.prepare("SELECT * FROM queue_jobs WHERE id = ?").get(row.id) as QueueJobRow | undefined;
    return claimed ? toQueueJob<TPayload, TResult>(claimed) : null;
  });

  return claim(type, now) as QueueJob<TPayload, TResult> | null;
}

export function completeQueueJob<TResult>(id: string, result: TResult, now: string): void {
  db.prepare(
    `UPDATE queue_jobs
     SET status = 'done', result_json = ?, error = NULL, finished_at = ?, updated_at = ?
     WHERE id = ?`
  ).run(JSON.stringify(result), now, now, id);
}

export function failQueueJob(id: string, error: string, now: string): void {
  db.prepare(
    `UPDATE queue_jobs
     SET status = 'failed', error = ?, finished_at = ?, updated_at = ?
     WHERE id = ?`
  ).run(error, now, now, id);
}

// ── Generation CRUD ──────────────────────────────────────────────────────────

export interface Generation {
  id: string;
  author_id: string;
  topic: string;
  events: string | null;
  context: string | null;
  extra_note: string | null;
  content: string;
  created_at: string;
}

export function listGenerations(authorId: string): Omit<Generation, "content">[] {
  return db
    .prepare(
      "SELECT id, author_id, topic, events, context, extra_note, created_at FROM generations WHERE author_id = ? ORDER BY created_at DESC"
    )
    .all(authorId) as Omit<Generation, "content">[];
}

export function getGeneration(id: string): Generation | undefined {
  return db.prepare("SELECT * FROM generations WHERE id = ?").get(id) as Generation | undefined;
}

export function createGeneration(
  id: string,
  authorId: string,
  topic: string,
  events: string | null,
  context: string | null,
  extraNote: string | null,
  content: string,
  now: string
): void {
  db.prepare(
    "INSERT INTO generations (id, author_id, topic, events, context, extra_note, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, authorId, topic, events, context, extraNote, content, now);
}

export function deleteGeneration(id: string): void {
  db.prepare("DELETE FROM generations WHERE id = ?").run(id);
}

export default db;
