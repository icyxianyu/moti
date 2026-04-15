/**
 * 嵌入服务：调用 Ollama nomic-embed-text 生成向量
 *
 * 特性：
 *   - 请求超时 30 秒
 *   - 失败自动重试 3 次（指数退避）
 */

import axios, { type AxiosInstance } from 'axios';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const EMBED_MODEL = 'nomic-embed-text';
const MAX_RETRY = 3;
const TIMEOUT_MS = 30_000;

const client: AxiosInstance = axios.create({
  baseURL: OLLAMA_BASE_URL,
  timeout: TIMEOUT_MS,
});

/** 嵌入单个文本，返回向量 */
export async function embed(text: string): Promise<number[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const { data } = await client.post('/api/embeddings', {
        model: EMBED_MODEL,
        prompt: text,
      });
      return data.embedding;
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_RETRY) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise<void>((r) => setTimeout(r, delay));
      }
    }
  }

  throw new Error(`Ollama embedding 失败（已重试 ${MAX_RETRY} 次）: ${lastError?.message}`);
}
