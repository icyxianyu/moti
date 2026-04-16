/**
 * 风格分析器：从已有文章中自动总结写作风格，生成 system prompt
 *
 * 流程：
 *   1. 从文章目录中随机抽取若干篇文章片段
 *   2. 调用 DeepSeek 总结出风格描述
 *   3. 保存到 data/style.md
 *
 * 规则：
 *   - 如果 data/style.md 已存在，不覆盖（尊重用户手动编辑）
 *   - 传入 force=true 时强制重新生成
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STYLE_FILE = path.resolve(__dirname, '../../data/style.md');
const SAMPLE_COUNT = 8;       // 抽取的文章数
const SAMPLE_LENGTH = 800;    // 每篇截取的字符数

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

/** 从文章目录中随机抽取片段 */
async function sampleArticles(articlesDir: string): Promise<string[]> {
  const files = (await fs.readdir(articlesDir)).filter((f) => f.endsWith('.txt'));
  if (files.length === 0) return [];

  // 随机抽取
  const shuffled = files.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(SAMPLE_COUNT, files.length));

  const samples: string[] = [];
  for (const file of selected) {
    const raw = await fs.readFile(path.join(articlesDir, file), 'utf-8');
    const lines = raw.split('\n');
    const bodyStart = lines.findIndex((l) => l.startsWith('─')) + 1;
    const body = lines.slice(bodyStart).join('\n').trim();
    if (body.length > 100) {
      samples.push(body.slice(0, SAMPLE_LENGTH));
    }
  }
  return samples;
}

/**
 * 分析文章风格并保存到 data/style.md
 * @param articlesDir 文章目录路径
 * @param force 是否强制覆盖已有的 style.md
 * @returns 是否生成了新文件
 */
export async function analyzeAndSaveStyle(articlesDir: string, force = false): Promise<boolean> {
  // 检查是否已存在
  if (!force) {
    try {
      await fs.access(STYLE_FILE);
      console.log('📄 data/style.md 已存在，跳过风格分析（如需重新生成，使用 --force）');
      return false;
    } catch {
      // 文件不存在，继续生成
    }
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    console.log('⚠ 未配置 DEEPSEEK_API_KEY，跳过自动风格分析');
    console.log('  你可以手动创建 data/style.md 来定义写作风格');
    return false;
  }

  const samples = await sampleArticles(articlesDir);
  if (samples.length === 0) {
    console.log('⚠ 文章目录为空，跳过风格分析');
    return false;
  }

  console.log(`🔍 正在从 ${samples.length} 篇文章中分析写作风格 …`);

  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com',
    timeout: 120_000,
  });

  const userMessage = `以下是该作者的 ${samples.length} 篇文章片段：\n\n${samples.map((s, i) => `── 片段 ${i + 1} ──\n${s}`).join('\n\n')}`;

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: ANALYSIS_PROMPT },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 2000,
    temperature: 0.5,
  });

  const styleContent = response.choices[0]?.message?.content?.trim();
  if (!styleContent) {
    console.log('⚠ 风格分析返回为空，跳过');
    return false;
  }

  await fs.mkdir(path.dirname(STYLE_FILE), { recursive: true });
  await fs.writeFile(STYLE_FILE, styleContent, 'utf-8');
  console.log(`✅ 风格分析完成，已保存到 data/style.md`);
  console.log('   你可以编辑该文件来微调风格描述\n');
  return true;
}

/** 读取 data/style.md，如果不存在返回 null */
export async function loadStyle(): Promise<string | null> {
  try {
    const content = await fs.readFile(STYLE_FILE, 'utf-8');
    return content.trim() || null;
  } catch {
    return null;
  }
}

/** style.md 文件路径（供外部引用） */
export { STYLE_FILE };
