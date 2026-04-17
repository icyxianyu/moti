import OpenAI from "openai";

const SAMPLE_COUNT = 8;
const SAMPLE_LENGTH = 800;

const ANALYSIS_PROMPT = `你是一位写作风格分析专家。下面是同一位作者的多篇文章片段。

请从这些片段中总结出该作者的写作风格特征，输出一份"风格指南"，供另一个 AI 模仿该风格时使用。

要求：
1. 分析以下维度：语感与节奏、用词与语气、论证方式、文章结构偏好、情绪表达方式
2. 用具体的描述而非笼统的形容词，比如不要说"文笔好"，而是说"善用短句制造冲击感，长句铺陈氛围"
3. 指出该作者的标志性习惯和禁区（比如喜欢什么、避免什么）
4. 输出格式为 Markdown，用【】标记各个维度
5. 不要引用原文中的具体例子，只提炼抽象特征
6. 最后加一段【关于文章结构的多样性要求】，要求模仿者每篇文章的结构都不同，列出至少 5 种可选的开头方式和 5 种可选的结尾方式
7. 最后加一段【严格禁止】，包含：禁止套话、禁止列举式段落、禁止结构雷同、禁止复制参考片段中的具体素材`;

function sampleTexts(texts: string[]): string[] {
  if (texts.length === 0) return [];

  const shuffled = [...texts].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(SAMPLE_COUNT, texts.length));

  return selected
    .map((t) => t.trim())
    .filter((t) => t.length > 100)
    .map((t) => t.slice(0, SAMPLE_LENGTH));
}

export async function analyzeStyle(texts: string[]): Promise<string> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("未配置 DEEPSEEK_API_KEY");
  }

  const samples = sampleTexts(texts);
  if (samples.length === 0) {
    throw new Error("没有足够的文本进行风格分析（需要至少 1 篇 100 字以上的文本）");
  }

  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
    timeout: 120_000,
  });

  const userMessage = `以下是该作者的 ${samples.length} 篇文章片段：\n\n${samples.map((s, i) => `── 片段 ${i + 1} ──\n${s}`).join("\n\n")}`;

  const response = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: ANALYSIS_PROMPT },
      { role: "user", content: userMessage },
    ],
    max_tokens: 2000,
    temperature: 0.5,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("风格分析返回为空");
  }

  return content;
}
