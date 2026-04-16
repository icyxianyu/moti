/**
 * 向量存储：基于 vectra（本地 JSON 文件，无需外部服务）
 * 索引持久化在 ./data/index/
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { LocalIndex } from 'vectra';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_DIR = path.resolve(__dirname, '../../data/index');

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

let _index: LocalIndex | null = null;
let _cachedCount: number | null = null;

async function getIndex(): Promise<LocalIndex> {
  if (_index) return _index;
  _index = new LocalIndex(INDEX_DIR);
  if (!(await _index.isIndexCreated())) {
    await _index.createIndex();
  }
  return _index;
}

/** 检查指定 id 的条目是否已存在 */
export async function exists(id: string): Promise<boolean> {
  const index = await getIndex();
  const item = await index.getItem(id);
  return item !== undefined;
}

/**
 * 插入一条向量记录（去重：相同 id 跳过）。
 * @returns true 表示新增，false 表示已存在被跳过
 */
export async function upsert(vector: number[], metadata: ChunkMetadata): Promise<boolean> {
  const index = await getIndex();
  const existing = await index.getItem(metadata.id);
  if (existing) return false;
  await index.insertItem({ id: metadata.id, vector, metadata });
  _cachedCount = null;
  return true;
}

/** 查询最相似的 top-k 个片段 */
export async function query(queryVector: number[], topK = 5): Promise<QueryResult[]> {
  const index = await getIndex();
  const results = await index.queryItems(queryVector, topK);
  return results.map((r) => ({
    score: r.score,
    metadata: r.item.metadata as ChunkMetadata,
  }));
}

/** 返回索引中的总条目数（带缓存） */
export async function count(): Promise<number> {
  if (_cachedCount !== null) return _cachedCount;
  const index = await getIndex();
  const stats = await index.listItems();
  _cachedCount = stats.length;
  return _cachedCount;
}

/** 从索引中随机抽取 n 个片段（用于纯风格示范） */
export async function randomSample(n: number): Promise<QueryResult[]> {
  const index = await getIndex();
  const allItems = await index.listItems();
  if (allItems.length === 0) return [];

  // Fisher-Yates 洗牌取前 n 个
  const shuffled = [...allItems].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(n, allItems.length));

  return selected.map((item) => ({
    score: 0,
    metadata: item.metadata as ChunkMetadata,
  }));
}
