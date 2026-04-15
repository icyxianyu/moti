/**
 * 文章生成器：调用 DeepSeek API，基于 RAG 上下文生成风格化文章
 * 支持流式输出，服务端可以实时将 token 推送给浏览器
 */

import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
  timeout: 60_000,
});

const SYSTEM_PROMPT = `你是一名有独立视角的内容创作者，专注于游戏、动漫、亚文化领域的深度评论。你深受某位作者的影响，继承了他的行文基因，但你有自己的表达。

【你从这位作者身上继承的基因——不是模板，是本能】

语感：
- 长短句交替是呼吸节奏，不是修辞技巧。吐槽用短句连击，抒情用长句铺陈，两者可以在同一段里切换
- 混用ACG术语、互联网梗与文学化隐喻，像深夜酒馆里的老资深玩家在说话
- 频繁使用第一人称，分享真实的个人经历和审美偏好

论证：
- 不引用数据，偏好跨界类比——把讨论对象与文学、电影、历史做互文
- 先给判断再回溯依据，对被时代忽视的创作者保持人文关怀

禁区：
- 禁止"总的来说""不得不说""值得一提"等套话
- 禁止"首先/其次/最后"式列举
- 禁止每段长度相似，要有明显的节奏起伏

【关于文章结构——你必须打破固定套路】

每篇文章的结构应该由主题本身决定，而不是套模板。以下是一些可能的开头方式（每次只选一种，且优先发明你自己的方式）：
- 从一个荒诞的细节或个人记忆切入
- 从一个反直觉的结论开始，然后解释为什么
- 从两个看似无关的事物的碰撞开始
- 从对读者的一个提问开始
- 直接扔出一个场景描写

中间展开和结尾同理——不要每次都"上升到人类情感/时代变迁"收尾。可以戛然而止、可以用一个画面定格、可以用一句自嘲、可以开放式留白。结构本身要让人觉得"这篇和上一篇不一样"。

【标题】
- 包含强情绪或冲突感，有争议性但不无聊`;

/** 从参考片段中构建风格引导提示词（只学语感，不借内容） */
function buildReferencePrompt(chunks: string[]): string {
  if (chunks.length === 0) return '';

  return `

─── 以下是该作者的几段原文，你的任务是从中感受风格，而非借用内容 ───

阅读规则：
1. 从这些片段中体会"语感"——句式节奏、情绪切换方式、比喻手法
2. 严禁复用其中的任何具体素材：包括游戏名、动漫名、电影名、人名、事件、梗、比喻对象
3. 严禁模仿其中的论点或观点走向
4. 你要写的文章必须有完全不同的素材、不同的例子、不同的论证路径
5. 如果你发现自己在写和参考片段类似的句子，立刻换一种说法

${chunks.map((c, i) => `〔片段${i + 1}〕\n${c}`).join('\n\n')}

─── 参考结束。以下是你的写作任务，从这里开始你必须完全原创 ───`;
}

export interface GenerateParams {
  topic: string;
  extraNote?: string;
  chunks: string[];
  onToken: (token: string) => void;
  signal?: AbortSignal;
}

/** 流式生成文章，通过 onToken 回调逐 token 返回 */
export async function generateArticle({
  topic,
  extraNote = '',
  chunks,
  onToken,
  signal,
}: GenerateParams): Promise<string> {
  const referenceBlock = buildReferencePrompt(chunks);
  const userMessage = `写一篇关于「${topic}」的文章。${extraNote ? `\n额外要求：${extraNote}` : ''}${referenceBlock}`;

  const stream = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    stream: true,
    max_tokens: 3000,
    temperature: 0.95,
    frequency_penalty: 0.3,
    presence_penalty: 0.4,
  });

  let fullText = '';
  for await (const chunk of stream) {
    if (signal?.aborted) {
      stream.controller.abort();
      break;
    }
    const token = chunk.choices[0]?.delta?.content ?? '';
    if (token) {
      fullText += token;
      onToken(token);
    }
  }
  return fullText;
}
