import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.sqlite");

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

const RECOVERY_NOW = new Date().toISOString();

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── 建表（首次启动时生效） ───────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    llm_base_url TEXT,
    llm_api_key TEXT,
    llm_model TEXT,
    monthly_quota INTEGER NOT NULL DEFAULT 3,
    quota_used INTEGER NOT NULL DEFAULT 0,
    quota_period TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS authors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    visibility TEXT NOT NULL DEFAULT 'private',
    style_md TEXT,
    style_status TEXT NOT NULL DEFAULT 'idle',
    style_analyzed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    events TEXT,
    context TEXT,
    extra_note TEXT,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
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

  CREATE INDEX IF NOT EXISTS idx_authors_owner_visibility
  ON authors (owner_id, visibility);

  CREATE INDEX IF NOT EXISTS idx_generations_owner_created_at
  ON generations (owner_id, created_at DESC);
`);

// ── Migrations：为老库补字段 ────────────────────────────────────────────────
// 每个 ALTER 都用 try/catch 兜底（SQLite 没有 IF NOT EXISTS for ADD COLUMN）
function safeAlter(sql: string) {
  try {
    db.exec(sql);
  } catch {
    // 列已存在，忽略
  }
}

// 老版本遗留的迁移（保留，避免从更老版本升级时丢字段）
safeAlter(`ALTER TABLE authors ADD COLUMN style_status TEXT NOT NULL DEFAULT 'idle'`);
safeAlter(`ALTER TABLE authors ADD COLUMN style_analyzed_at TEXT`);
safeAlter(`ALTER TABLE generations ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'`);

// 本次 Step 2 新增的列
// 注意：SQLite 的 ALTER TABLE ADD COLUMN 不允许带 REFERENCES/FOREIGN KEY 约束
// （除非 DEFAULT NULL 且不同于其他 FK 限制），因此对老表升级时只能加"裸"列。
// 新建库会通过上面的 CREATE TABLE 语句带上 FK，老库无 FK 但业务层保证一致性。
safeAlter(`ALTER TABLE authors ADD COLUMN owner_id TEXT`);
safeAlter(`ALTER TABLE authors ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'`);
safeAlter(`ALTER TABLE collections ADD COLUMN owner_id TEXT`);
safeAlter(`ALTER TABLE generations ADD COLUMN owner_id TEXT`);

// 将已有 style_md 但 status 还是 idle 的记录修正为 done
db.exec(`UPDATE authors SET style_status = 'done' WHERE style_md IS NOT NULL AND style_status = 'idle'`);

// ── 创世 admin：如果已有业务数据但 users 表空，自动接管存量 ────────────────
(function ensureGenesisAdmin() {
  const userCount = (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;
  if (userCount > 0) return;

  const orphanCount = (
    db.prepare(
      `SELECT
        (SELECT COUNT(*) FROM authors WHERE owner_id IS NULL) +
        (SELECT COUNT(*) FROM collections WHERE owner_id IS NULL) +
        (SELECT COUNT(*) FROM generations WHERE owner_id IS NULL) AS c`
    ).get() as { c: number }
  ).c;

  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || "";

  // 没有存量数据 & 也没配 admin：属于完全新部署，等用户走注册/初始化流程即可
  if (orphanCount === 0 && !adminEmail) return;

  if (!adminEmail || !adminPassword) {
    console.warn(
      "[db] 检测到需要创建 admin 账号（存量数据 %d 条），但 ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD 未配置，跳过。请在 .env 中补充后重启。",
      orphanCount
    );
    return;
  }

  const adminId = randomUUID();
  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(adminPassword, 10);
  const quotaPeriod = now.slice(0, 7); // YYYY-MM

  db.prepare(
    `INSERT INTO users (
      id, email, name, password_hash, role, status,
      monthly_quota, quota_used, quota_period,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'admin', 'active', 999999, 0, ?, ?, ?)`
  ).run(adminId, adminEmail, "Admin", passwordHash, quotaPeriod, now, now);

  // 存量挂到 admin 名下
  if (orphanCount > 0) {
    db.prepare(`UPDATE authors SET owner_id = ? WHERE owner_id IS NULL`).run(adminId);
    db.prepare(`UPDATE collections SET owner_id = ? WHERE owner_id IS NULL`).run(adminId);
    db.prepare(`UPDATE generations SET owner_id = ? WHERE owner_id IS NULL`).run(adminId);
    console.log("[db] 创世迁移完成：已将 %d 条存量数据挂到 admin(%s) 名下。", orphanCount, adminEmail);
  } else {
    console.log("[db] 已创建初始 admin: %s", adminEmail);
  }
})();

// ── 队列恢复 ────────────────────────────────────────────────────────────────
// 进程重启后，把未完成的 processing 任务重新放回队列，避免队列"卡死"。
db.prepare(
  `UPDATE queue_jobs
   SET status = 'queued', started_at = NULL, finished_at = NULL, updated_at = ?, error = NULL
   WHERE status = 'processing'`
).run(RECOVERY_NOW);

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

// ── User CRUD ───────────────────────────────────────────────────────────────

export type UserRole = "user" | "admin";
export type UserStatus = "active" | "banned";

export interface User {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  llm_base_url: string | null;
  llm_api_key: string | null;
  llm_model: string | null;
  monthly_quota: number;
  quota_used: number;
  quota_period: string;
  created_at: string;
  updated_at: string;
}

export type PublicUser = Omit<User, "password_hash" | "llm_api_key"> & {
  has_llm_key: boolean;
};

export function toPublicUser(u: User): PublicUser {
  const { password_hash: _ph, llm_api_key, ...rest } = u;
  return { ...rest, has_llm_key: !!llm_api_key };
}

export function listUsers(): User[] {
  return db.prepare("SELECT * FROM users ORDER BY created_at ASC").all() as User[];
}

export function getUser(id: string): User | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
}

export function getUserByEmail(email: string): User | undefined {
  return db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.trim().toLowerCase()) as User | undefined;
}

export function countUsers(): number {
  return (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;
}

export interface CreateUserInput {
  id: string;
  email: string;
  name?: string | null;
  passwordHash: string;
  role?: UserRole;
  monthlyQuota?: number;
  now: string;
}

export function createUser(input: CreateUserInput): void {
  const quotaPeriod = input.now.slice(0, 7);
  db.prepare(
    `INSERT INTO users (
      id, email, name, password_hash, role, status,
      monthly_quota, quota_used, quota_period,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'active', ?, 0, ?, ?, ?)`
  ).run(
    input.id,
    input.email.trim().toLowerCase(),
    input.name ?? null,
    input.passwordHash,
    input.role ?? "user",
    input.monthlyQuota ?? 3,
    quotaPeriod,
    input.now,
    input.now
  );
}

export function updateUser(
  id: string,
  fields: Partial<{
    name: string | null;
    role: UserRole;
    status: UserStatus;
    llm_base_url: string | null;
    llm_api_key: string | null;
    llm_model: string | null;
    monthly_quota: number;
    quota_used: number;
    quota_period: string;
    password_hash: string;
  }>,
  now: string
): void {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  vals.push(now);
  vals.push(id);
  db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

export function deleteUser(id: string): void {
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
}

/**
 * 原子地消费一个配额点：跨自然月自动重置。
 * 返回 true 表示扣减成功；false 表示当月额度已用完。
 */
export function consumeQuota(userId: string, now: string): boolean {
  const currentPeriod = now.slice(0, 7);
  const tx = db.transaction(() => {
    const u = db.prepare("SELECT quota_period, quota_used, monthly_quota FROM users WHERE id = ?").get(userId) as
      | { quota_period: string; quota_used: number; monthly_quota: number }
      | undefined;
    if (!u) return false;

    // 跨月重置
    let used = u.quota_used;
    if (u.quota_period !== currentPeriod) {
      used = 0;
      db.prepare("UPDATE users SET quota_period = ?, quota_used = 0, updated_at = ? WHERE id = ?")
        .run(currentPeriod, now, userId);
    }

    if (used >= u.monthly_quota) return false;

    db.prepare("UPDATE users SET quota_used = quota_used + 1, updated_at = ? WHERE id = ?")
      .run(now, userId);
    return true;
  });
  return tx() as boolean;
}

// ── Author CRUD ──────────────────────────────────────────────────────────────

export type StyleStatus = "idle" | "queued" | "analyzing" | "done" | "failed";
export type AuthorVisibility = "private" | "public";

export interface Author {
  id: string;
  name: string;
  owner_id: string | null;
  visibility: AuthorVisibility;
  style_md: string | null;
  style_status: StyleStatus;
  style_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 列出某用户"可见"的作家：自己的私人作家 + 所有公共作家。
 * admin 可通过 `includeAllPrivate` 看到所有私人作家。
 */
export function listAuthorsForUser(userId: string, includeAllPrivate = false): Author[] {
  if (includeAllPrivate) {
    return db.prepare("SELECT * FROM authors ORDER BY created_at DESC").all() as Author[];
  }
  return db
    .prepare(
      `SELECT * FROM authors
       WHERE visibility = 'public' OR owner_id = ?
       ORDER BY created_at DESC`
    )
    .all(userId) as Author[];
}

/** 兼容 Step 2 之前的调用点；Step 4 会把所有调用点换成 listAuthorsForUser。 */
export function listAuthors(): Author[] {
  return db.prepare("SELECT * FROM authors ORDER BY created_at DESC").all() as Author[];
}

export function getAuthor(id: string): Author | undefined {
  return db.prepare("SELECT * FROM authors WHERE id = ?").get(id) as Author | undefined;
}

export function createAuthor(
  id: string,
  name: string,
  now: string,
  ownerId: string | null = null,
  visibility: AuthorVisibility = "private"
): void {
  db.prepare(
    "INSERT INTO authors (id, name, owner_id, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, name, ownerId, visibility, now, now);
}

export function updateAuthor(
  id: string,
  fields: {
    name?: string;
    style_md?: string;
    style_status?: StyleStatus;
    style_analyzed_at?: string | null;
    visibility?: AuthorVisibility;
    owner_id?: string | null;
  },
  now: string
): void {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (fields.name !== undefined) { sets.push("name = ?"); vals.push(fields.name); }
  if (fields.style_md !== undefined) { sets.push("style_md = ?"); vals.push(fields.style_md); }
  if (fields.style_status !== undefined) { sets.push("style_status = ?"); vals.push(fields.style_status); }
  if (fields.style_analyzed_at !== undefined) { sets.push("style_analyzed_at = ?"); vals.push(fields.style_analyzed_at); }
  if (fields.visibility !== undefined) { sets.push("visibility = ?"); vals.push(fields.visibility); }
  if (fields.owner_id !== undefined) { sets.push("owner_id = ?"); vals.push(fields.owner_id); }
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
  owner_id: string | null;
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
  now: string,
  ownerId: string | null = null
): void {
  // 使用 INSERT OR REPLACE 让入队任务在"建库成功但回写状态前进程重启"的情况下可以安全重试。
  db.prepare(
    "INSERT OR REPLACE INTO collections (id, author_id, owner_id, filename, raw_text, chunk_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, authorId, ownerId, filename, rawText, chunkCount, now);
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

/**
 * 列出指定作者下所有"进行中"的 job（queued / processing）。
 * 用于前端页面刷新后恢复上传进度：浏览器 state 丢了，但 DB 里的任务还在跑，
 * 通过该接口拿回文件名+状态，继续轮询即可。
 */
export function listActiveQueueJobs<TPayload = unknown, TResult = unknown>(
  type: QueueJobType,
  authorId: string
): QueueJob<TPayload, TResult>[] {
  const rows = db.prepare(
    `SELECT * FROM queue_jobs
     WHERE type = ? AND author_id = ? AND status IN ('queued', 'processing')
     ORDER BY created_at ASC`
  ).all(type, authorId) as QueueJobRow[];

  return rows.map((row) => toQueueJob<TPayload, TResult>(row));
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

export type GenerationStatus = "completed" | "aborted" | "failed";

export interface Generation {
  id: string;
  author_id: string;
  owner_id: string | null;
  topic: string;
  events: string | null;
  context: string | null;
  extra_note: string | null;
  content: string;
  status: GenerationStatus;
  created_at: string;
}

/**
 * 列出生成历史。Step 4 会把所有调用点改为带 userId 过滤；
 * 这里保留 authorId-only 版本用于兼容，并额外提供按用户隔离的版本。
 */
export function listGenerations(authorId: string): Omit<Generation, "content">[] {
  return db
    .prepare(
      "SELECT id, author_id, owner_id, topic, events, context, extra_note, status, created_at FROM generations WHERE author_id = ? ORDER BY created_at DESC"
    )
    .all(authorId) as Omit<Generation, "content">[];
}

export function listGenerationsForUser(
  authorId: string,
  userId: string
): Omit<Generation, "content">[] {
  return db
    .prepare(
      `SELECT id, author_id, owner_id, topic, events, context, extra_note, status, created_at
       FROM generations
       WHERE author_id = ? AND owner_id = ?
       ORDER BY created_at DESC`
    )
    .all(authorId, userId) as Omit<Generation, "content">[];
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
  now: string,
  status: GenerationStatus = "completed",
  ownerId: string | null = null
): void {
  db.prepare(
    "INSERT INTO generations (id, author_id, owner_id, topic, events, context, extra_note, content, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, authorId, ownerId, topic, events, context, extraNote, content, status, now);
}

export function deleteGeneration(id: string): void {
  db.prepare("DELETE FROM generations WHERE id = ?").run(id);
}

export default db;
