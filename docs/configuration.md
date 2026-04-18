# 配置参考

所有配置通过项目根目录的 `.env` 文件读取，`.env.example` 是带注释的模板。

## LLM 配置（必填）

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `LLM_BASE_URL` | 否 | `https://api.deepseek.com` | OpenAI 兼容 API 的 Base URL |
| `LLM_API_KEY` | **是** | - | LLM 服务的 API Key |
| `LLM_MODEL` | 否 | `deepseek-chat` | 使用的模型名 |

### 常见 LLM 供应商

| Provider | `LLM_BASE_URL` | `LLM_MODEL` 示例 |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` |
| Moonshot | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `Qwen/Qwen2.5-7B-Instruct` |
| 本地 vLLM / LM Studio | `http://localhost:8000/v1` | 视部署而定 |

> 这里设置的是**系统级默认 LLM**。用户可以在「设置」页填入自己的 Key 覆盖默认，详见 [features.md](./features.md#用户自带-llm-keybyok)。

## Embedding 服务（必填）

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `OLLAMA_BASE_URL` | 否 | `http://localhost:11434` | Ollama 服务地址 |

> ⚠️ Docker Compose 部署时，即使 `.env` 里写 `localhost`，容器内也会被强制覆盖为 `http://ollama:11434`（见 `docker-compose.yml`）。

## 鉴权与初始账号（生产必填）

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `AUTH_SECRET` | **是** | NextAuth 会话签名密钥，生成：`openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | 生产环境 **是** | 非 localhost 访问时设 `true`，让 Auth.js 信任反代/域名/IP 的 Host 头 |
| `AUTH_URL` | 生产环境 **是** | 应用对外访问的完整 URL（`http://your-domain-or-ip`，不带末尾斜杠） |
| `ADMIN_EMAIL` | 否 | 首次启动自动创建的 admin 邮箱；已存在同名用户则跳过 |
| `ADMIN_INITIAL_PASSWORD` | 否 | 初始 admin 密码，**首次登录后请立即到「设置」页修改** |

> 首次部署建议填 `ADMIN_EMAIL` + `ADMIN_INITIAL_PASSWORD`；一旦 admin 已创建，这两个变量可以清空。

## 服务端并发保护

这三个并发配置用于**服务端资源保护**，避免在小机器上同时触发过多高开销任务，导致 CPU、内存或外部模型服务被打满。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `GENERATE_CONCURRENCY` | `2` | 同时允许进行的文章生成任务数；超出后接口直接返回 `429` |
| `ANALYZE_CONCURRENCY` | `1` | 风格分析后台消费并发；超出的任务会先入队 |
| `INGEST_CONCURRENCY` | `1` | 上传建索引后台消费并发；超出的任务会先入队 |

### 按机器配置参考

| 配置 | 建议值（`GENERATE / ANALYZE / INGEST`） |
| --- | --- |
| **2 核 4G** | `2 / 1 / 1`（默认值即可） |
| **4 核 8G** | `3~4 / 1~2 / 1~2` |
| 更高配置 | 逐步调高，并配合观察 Ollama、Node 进程和系统负载 |

> 如果使用本机 Ollama，最终瓶颈往往不只在 Node 服务本身，也会受 Ollama 模型吞吐影响，建议**小步调参**，不要一次性拉太高。
