import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.sqlite");

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

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
db.exec(`UPDATE authors SET style_status = 'done' WHERE style_md IS NOT NULL AND style_status = 'idle'`);

// ── Author CRUD ──────────────────────────────────────────────────────────────

export type StyleStatus = "idle" | "analyzing" | "done" | "failed";

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
  db.prepare(
    "INSERT INTO collections (id, author_id, filename, raw_text, chunk_count, created_at) VALUES (?, ?, ?, ?, ?, ?)"
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
