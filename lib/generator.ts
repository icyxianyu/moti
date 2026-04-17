import OpenAI from "openai";

const DEFAULT_SYSTEM_PROMPT = `你是一名内容创作者。请根据用户提供的参考片段，学习其中的写作风格（语感、节奏、用词习惯），然后以类似的风格写一篇新文章。

注意：
- 只学习风格，不要复制具体内容、素材或例子
- 每篇文章的结构要有变化，不要套模板
- 禁止"总的来说""不得不说""值得一提"等套话`;

function buildSystemPrompt(styleMd: string | null): string {
  if (styleMd) {
    return `你是一名深受某位作者影响的内容创作者，继承了他的行文基因，但有自己的独立表达。

以下是从该作者文章中提炼出的风格指南，请严格遵循：

${styleMd}`;
  }
  return DEFAULT_SYSTEM_PROMPT;
}

function buildReferencePrompt(chunks: string[]): string {
  if (chunks.length === 0) return "";

  return `

─── 以下是该作者的几段原文，你的任务是从中感受风格，而非借用内容 ───

阅读规则：
1. 从这些片段中体会"语感"——句式节奏、情绪切换方式、比喻手法
2. 严禁复用其中的任何具体素材：包括游戏名、动漫名、电影名、人名、事件、梗、比喻对象
3. 严禁模仿其中的论点或观点走向
4. 你要写的文章必须有完全不同的素材、不同的例子、不同的论证路径
5. 如果你发现自己在写和参考片段类似的句子，立刻换一种说法

${chunks.map((c, i) => `〔片段${i + 1}〕\n${c}`).join("\n\n")}

─── 参考结束。以下是你的写作任务，从这里开始你必须完全原创 ───`;
}

export interface GenerateParams {
  topic: string;
  extraNote?: string;
  events?: string;
  context?: string;
  chunks: string[];
  styleMd: string | null;
  onToken: (token: string) => void;
  signal?: AbortSignal;
}

export async function generateArticle({
  topic,
  extraNote = "",
  events = "",
  context = "",
  chunks,
  styleMd,
  onToken,
  signal,
}: GenerateParams): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
    timeout: 60_000,
  });

  const systemPrompt = buildSystemPrompt(styleMd);
  const referenceBlock = buildReferencePrompt(chunks);

  const parts = [`写一篇关于「${topic}」的文章。`];
  if (events) parts.push(`\n可以引用或切入的现实/历史事件：${events}`);
  if (context) parts.push(`\n背景补充：${context}`);
  if (extraNote) parts.push(`\n额外要求：${extraNote}`);
  parts.push(referenceBlock);

  const userMessage = parts.join("");

  const stream = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    stream: true,
    max_tokens: 3000,
    temperature: 0.95,
    frequency_penalty: 0.3,
    presence_penalty: 0.4,
  });

  let fullText = "";
  for await (const chunk of stream) {
    if (signal?.aborted) {
      stream.controller.abort();
      break;
    }
    const token = chunk.choices[0]?.delta?.content ?? "";
    if (token) {
      fullText += token;
      onToken(token);
    }
  }
  return fullText;
}
