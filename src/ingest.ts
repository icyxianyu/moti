#!/usr/bin/env node
/**
 * 数据摄入脚本：读取 .txt 文章 → 分块 → 嵌入 → 存入向量索引
 *
 * 支持增量摄入：已索引的片段自动跳过。
 *
 * 使用方式：
 *   pnpm ingest            # 增量摄入（默认）
 *   pnpm ingest:force      # 强制重建全部索引
 *
 * 文章目录：
 *   默认读取 data/articles/，可通过 .env 中 ARTICLES_DIR 覆盖
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { embed } from './lib/embedder.js';
import { upsert, count, exists } from './lib/vectorStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ARTICLES_DIR = path.resolve(__dirname, '../data/articles');
const ARTICLES_DIR = path.resolve(process.env.ARTICLES_DIR ?? DEFAULT_ARTICLES_DIR);
const CHUNK_SIZE = 600;
const CHUNK_OVERLAP = 100;
const FORCE = process.argv.includes('--force');

/** 将文本按固定长度 + 重叠切分为片段 */
function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);
    if (end === text.length) break;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

async function main(): Promise<void> {
  // 确保默认文章目录存在
  await fs.mkdir(DEFAULT_ARTICLES_DIR, { recursive: true });

  console.log(`读取文章目录: ${ARTICLES_DIR}`);
  if (FORCE) console.log('⚠ 强制模式：重新索引全部片段');

  let files: string[];
  try {
    files = (await fs.readdir(ARTICLES_DIR)).filter((f) => f.endsWith('.txt'));
  } catch {
    console.error(`无法读取目录: ${ARTICLES_DIR}`);
    console.error('请将 .txt 文件放入 data/articles/ 目录，或在 .env 中设置 ARTICLES_DIR。');
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('目录为空，没有找到 .txt 文件。');
    console.log(`请将文章文件放入: ${ARTICLES_DIR}`);
    process.exit(0);
  }

  console.log(`找到 ${files.length} 篇文章。`);

  let addedChunks = 0;
  let skippedChunks = 0;
  let skippedFiles = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filepath = path.join(ARTICLES_DIR, filename);
    const raw = await fs.readFile(filepath, 'utf-8');

    // 跳过元数据头（标题/URL/时间/分隔线），只嵌入正文
    const lines = raw.split('\n');
    const bodyStart = lines.findIndex((l) => l.startsWith('─')) + 1;
    const body = lines.slice(bodyStart).join('\n').trim();

    if (!body) {
      console.log(`  [跳过] ${filename} — 正文为空`);
      continue;
    }

    const chunks = splitIntoChunks(body);

    // 快速检查：如果第一个片段已存在且非强制模式，跳过整个文件
    if (!FORCE) {
      const firstId = `${filename}__0`;
      if (await exists(firstId)) {
        skippedFiles++;
        skippedChunks += chunks.length;
        continue;
      }
    }

    process.stdout.write(`[${i + 1}/${files.length}] ${filename} — ${chunks.length} 个片段 ... `);

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunkId = `${filename}__${ci}`;
      const vector = await embed(chunks[ci]);
      const inserted = await upsert(vector, {
        id: chunkId,
        text: chunks[ci],
        source: filename,
        chunkIndex: ci,
      });

      if (inserted) {
        addedChunks++;
      } else {
        skippedChunks++;
      }
    }

    console.log('完成');
  }

  const total = await count();
  console.log(`\n摄入完成。`);
  console.log(`  新增: ${addedChunks} 个片段`);
  console.log(`  跳过: ${skippedChunks} 个片段（${skippedFiles} 个文件已索引）`);
  console.log(`  索引总数: ${total}`);
}

main().catch((err: unknown) => {
  console.error('致命错误:', err);
  process.exit(1);
});
