import path from "path";
import fs from "fs";
import { LocalIndex } from "vectra";

const AUTHORS_DATA_DIR = path.resolve(process.cwd(), "data/authors");

export interface ChunkMetadata {
  [key: string]: string | number;
  id: string;
  text: string;
  source: string;
  chunkIndex: number;
}

export interface QueryResult {
  score: number;
  metadata: ChunkMetadata;
}

const indexCache = new Map<string, LocalIndex>();

function getIndexDir(authorId: string): string {
  return path.join(AUTHORS_DATA_DIR, authorId, "index");
}

async function getAuthorIndex(authorId: string): Promise<LocalIndex> {
  const cached = indexCache.get(authorId);
  if (cached) return cached;

  const dir = getIndexDir(authorId);
  fs.mkdirSync(dir, { recursive: true });

  const index = new LocalIndex(dir);
  if (!(await index.isIndexCreated())) {
    await index.createIndex();
  }

  indexCache.set(authorId, index);
  return index;
}

export async function exists(authorId: string, id: string): Promise<boolean> {
  const index = await getAuthorIndex(authorId);
  const item = await index.getItem(id);
  return item !== undefined;
}

export async function upsert(
  authorId: string,
  vector: number[],
  metadata: ChunkMetadata
): Promise<boolean> {
  const index = await getAuthorIndex(authorId);
  const existing = await index.getItem(metadata.id);
  if (existing) return false;
  await index.insertItem({ id: metadata.id, vector, metadata });
  return true;
}

export async function query(
  authorId: string,
  queryVector: number[],
  topK = 5
): Promise<QueryResult[]> {
  const index = await getAuthorIndex(authorId);
  const results = await index.queryItems(queryVector, topK);
  return results.map((r) => ({
    score: r.score,
    metadata: r.item.metadata as ChunkMetadata,
  }));
}

export async function count(authorId: string): Promise<number> {
  const index = await getAuthorIndex(authorId);
  const items = await index.listItems();
  return items.length;
}

export async function randomSample(
  authorId: string,
  n: number
): Promise<QueryResult[]> {
  const index = await getAuthorIndex(authorId);
  const allItems = await index.listItems();
  if (allItems.length === 0) return [];

  const shuffled = [...allItems].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(n, allItems.length));

  return selected.map((item) => ({
    score: 0,
    metadata: item.metadata as ChunkMetadata,
  }));
}

export async function deleteByPrefix(
  authorId: string,
  prefix: string
): Promise<number> {
  const index = await getAuthorIndex(authorId);
  const allItems = await index.listItems();
  let deleted = 0;

  for (const item of allItems) {
    if (item.id.startsWith(prefix)) {
      await index.deleteItem(item.id);
      deleted++;
    }
  }

  return deleted;
}

export function removeAuthorIndex(authorId: string): void {
  indexCache.delete(authorId);
  const dir = getIndexDir(authorId);
  fs.rmSync(dir, { recursive: true, force: true });
}
