/**
 * Express 服务器
 *   GET  /              → 静态页面 public/index.html
 *   POST /api/generate  → RAG 流水线，SSE 流式响应
 *   GET  /api/status    → 返回索引状态
 *
 * 特性：
 *   - 全局错误中间件
 *   - 输入长度限制
 *   - 请求频率限制
 *   - 请求日志
 *   - AbortController 支持（客户端断开时中止生成）
 */

import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { embed } from './lib/embedder.js';
import { query, count, randomSample } from './lib/vectorStore.js';
import { generateArticle } from './lib/generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ?? 8000;
const MAX_TOPIC_LENGTH = 200;
const MAX_EXTRA_LENGTH = 500;
const MAX_EVENTS_LENGTH = 500;
const MAX_CONTEXT_LENGTH = 500;

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '../public')));

// ── 请求日志 ─────────────────────────────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  console.log(`${time} ${req.method} ${req.path}`);
  next();
});

// ── 频率限制（每 IP 每分钟最多 10 次生成请求）────────────────────────────────
const generateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── 索引状态 ─────────────────────────────────────────────────────────────────
app.get('/api/status', async (_req: Request, res: Response) => {
  try {
    const total = await count();
    res.json({ ok: true, chunks: total });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// ── 生成文章（SSE 流式响应）──────────────────────────────────────────────────
app.post('/api/generate', generateLimiter, async (req: Request, res: Response) => {
  const { topic, extraNote, events, context } = req.body ?? {};

  // 输入校验
  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    res.status(400).json({ error: '请提供文章主题' });
    return;
  }
  if (topic.length > MAX_TOPIC_LENGTH) {
    res.status(400).json({ error: `主题长度不能超过 ${MAX_TOPIC_LENGTH} 个字符` });
    return;
  }
  if (extraNote && typeof extraNote === 'string' && extraNote.length > MAX_EXTRA_LENGTH) {
    res.status(400).json({ error: `额外要求长度不能超过 ${MAX_EXTRA_LENGTH} 个字符` });
    return;
  }
  if (events && typeof events === 'string' && events.length > MAX_EVENTS_LENGTH) {
    res.status(400).json({ error: `事件素材长度不能超过 ${MAX_EVENTS_LENGTH} 个字符` });
    return;
  }
  if (context && typeof context === 'string' && context.length > MAX_CONTEXT_LENGTH) {
    res.status(400).json({ error: `背景补充长度不能超过 ${MAX_CONTEXT_LENGTH} 个字符` });
    return;
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    res.status(500).json({ error: '未配置 DEEPSEEK_API_KEY，请检查 .env 文件' });
    return;
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (event: string, data: Record<string, unknown>) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // 支持客户端断开时中止生成
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  try {
    // 1. 嵌入主题查询
    send('status', { message: '正在检索相关段落…' });
    const queryVec = await embed(topic);

    // 2. 混合检索：3 个主题相关 + 2 个随机风格示范
    const topicHits = await query(queryVec, 3);
    const styleHits = await randomSample(2);

    // 去重（随机抽取的可能和主题检索重复）
    const seenIds = new Set(topicHits.map((h) => h.metadata.id));
    const dedupedStyleHits = styleHits.filter((h) => !seenIds.has(h.metadata.id));

    const allHits = [
      ...topicHits.map((h) => ({ ...h, type: '主题相关' as const })),
      ...dedupedStyleHits.map((h) => ({ ...h, type: '风格示范' as const })),
    ];

    const chunks = allHits.map((h) => h.metadata.text);
    send('retrieval', {
      items: allHits.map((h, i) => ({
        index: i + 1,
        text: h.metadata.text,
        score: h.score,
        source: h.metadata.source ?? null,
        type: h.type,
      })),
    });
    send('status', { message: `检索到 ${allHits.length} 个参考片段（${topicHits.length} 主题相关 + ${dedupedStyleHits.length} 风格示范），开始生成…` });

    // 3. 流式生成
    await generateArticle({
      topic: topic.trim(),
      extraNote: (extraNote as string) ?? '',
      events: (events as string) ?? '',
      context: (context as string) ?? '',
      chunks,
      onToken: (token) => send('token', { token }),
      signal: abortController.signal,
    });

    send('done', { message: '生成完成' });
  } catch (err) {
    if (!abortController.signal.aborted) {
      send('error', { message: (err as Error).message });
    }
  } finally {
    res.end();
  }
});

// ── 全局错误处理 ─────────────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('未捕获的错误:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.listen(PORT, () => {
  console.log(`RAG Writer 运行在 http://localhost:${PORT}`);
});
