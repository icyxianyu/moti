import OpenAI from "openai";

/**
 * 统一的 LLM 客户端工厂。
 *
 * 项目不绑定具体供应商，任何"OpenAI 兼容"的 API 都可接入：
 *   - DeepSeek:   https://api.deepseek.com          (deepseek-chat)
 *   - OpenAI:     https://api.openai.com/v1         (gpt-4o-mini 等)
 *   - 通义千问:   https://dashscope.aliyuncs.com/compatible-mode/v1 (qwen-plus)
 *   - 智谱:       https://open.bigmodel.cn/api/paas/v4 (glm-4-flash)
 *   - Moonshot:   https://api.moonshot.cn/v1        (moonshot-v1-8k)
 *   - 硅基流动:   https://api.siliconflow.cn/v1
 *   - 本地 vLLM / LM Studio: http://localhost:8000/v1
 *
 * 配置优先级：调用方显式传入的 override > 环境变量 LLM_*
 * override 用于后续"用户自带 Key"场景（Step 5）。
 */

export interface LLMConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface LLMConfigOverride {
  baseURL?: string | null;
  apiKey?: string | null;
  model?: string | null;
}

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";

/**
 * 解析最终生效的 LLM 配置。
 * 若 override 三项齐备，完全使用 override；否则回落到系统环境变量。
 * 任意一项缺失都会抛错，让上层返回友好的 4xx/5xx。
 */
export function resolveLLMConfig(override?: LLMConfigOverride): LLMConfig {
  const useOverride =
    override &&
    override.baseURL &&
    override.apiKey &&
    override.model;

  if (useOverride) {
    return {
      baseURL: override!.baseURL!,
      apiKey: override!.apiKey!,
      model: override!.model!,
    };
  }

  const apiKey = process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("未配置 LLM API Key（请设置环境变量 LLM_API_KEY）");
  }

  return {
    baseURL: process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL,
    apiKey,
    model: process.env.LLM_MODEL ?? DEFAULT_MODEL,
  };
}

/**
 * 创建一个 OpenAI SDK 客户端实例。
 * timeout 由调用方决定（长文生成 60s、风格分析 120s 差异较大）。
 */
export function createLLMClient(
  config: LLMConfig,
  options: { timeout?: number } = {},
): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout: options.timeout ?? 60_000,
  });
}

/**
 * 便捷函数：一次性拿到 { client, model }，调用方只需关心业务 prompt。
 */
export function getLLM(
  options: { timeout?: number; override?: LLMConfigOverride } = {},
): { client: OpenAI; model: string } {
  const config = resolveLLMConfig(options.override);
  return {
    client: createLLMClient(config, { timeout: options.timeout }),
    model: config.model,
  };
}
