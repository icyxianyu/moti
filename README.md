# Moti · 墨替

![Moti · 墨替 — 像某位作者一样写作](./public/og-image.png)

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-local-003B57?logo=sqlite&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-local-000000)
![License](https://img.shields.io/badge/license-MIT-green)

**像某位作者一样写作。**

Moti 是一个本地运行的写作工具：为你欣赏的每一位作者单独建立语料库，分析出他的笔法，然后让 AI 用这位作者的口吻替你写新的文章。

底层基于 **Next.js + SQLite + Vectra + Ollama**，LLM 层采用 OpenAI 兼容协议，可对接 DeepSeek / OpenAI / 通义千问 / 智谱 / Moonshot / 硅基流动 / 本地 vLLM 等任意服务。

## 功能特性

- **多作者管理**：为不同作者分别维护语料、风格和生成历史
- **本地向量索引**：使用 `vectra` 存储每位作者的检索索引，无需外部向量数据库
- **本地 Embedding**：通过 Ollama 的 `nomic-embed-text` 生成向量
- **任意 LLM 供应商**：通过 OpenAI 兼容协议接入，换个 `LLM_BASE_URL` 就能切换
- **服务端风格状态**：风格分析状态持久化为 `idle / queued / analyzing / done / failed`，切页或刷新后不会丢失
- **任务队列化处理**：风格分析与上传建索引采用"先入队、后台按并发消费"的模式，降低小机器瞬时压力
- **可编辑风格面板**：在创作页顶部直接查看、展开和编辑当前作者的风格指南
- **生成历史查看**：保留每次生成结果，支持回看历史内容

## 技术栈

- **前端**：Next.js 15、React 19、Tailwind CSS、Radix UI
- **数据库**：SQLite（`better-sqlite3`）
- **向量检索**：Vectra
- **Embedding**：Ollama（`nomic-embed-text`）
- **LLM**：任意 OpenAI 兼容 API（默认 DeepSeek）

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 安装 Ollama 并拉取模型

```bash
ollama pull nomic-embed-text
```

默认会连接到 `http://localhost:11434`。

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `LLM_BASE_URL` | 否 | `https://api.deepseek.com` | OpenAI 兼容 API 的 Base URL |
| `LLM_API_KEY` | **是** | - | LLM 服务的 API Key |
| `LLM_MODEL` | 否 | `deepseek-chat` | 使用的模型名 |
| `OLLAMA_BASE_URL` | 否 | `http://localhost:11434` | Ollama 服务地址 |
| `GENERATE_CONCURRENCY` | 否 | `2` | 同时允许进行的文章生成任务数；超出后接口直接返回 `429` |
| `ANALYZE_CONCURRENCY` | 否 | `1` | 风格分析后台消费者并发数；超出的任务会先进入队列 |
| `INGEST_CONCURRENCY` | 否 | `1` | 上传建索引后台消费者并发数；超出的任务会先进入队列 |

<details>
<summary><b>常见 LLM 供应商配置示例</b></summary>

| Provider | `LLM_BASE_URL` | `LLM_MODEL` 示例 |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` |
| Moonshot | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `Qwen/Qwen2.5-7B-Instruct` |
| 本地 vLLM / LM Studio | `http://localhost:8000/v1` | 视部署而定 |

</details>

### 并发配置建议

这三个并发配置用于做**服务端资源保护**，避免在小机器上同时触发过多高开销任务，导致 CPU、内存或外部模型服务被打满。

- **`GENERATE_CONCURRENCY`**：控制文章生成接口并发。一次生成会同时占用检索、LLM 请求和 SSE 流式输出，通常是最耗时的请求；超限时会直接返回 `429`。
- **`ANALYZE_CONCURRENCY`**：控制风格分析的后台消费并发。请求会先入队，再按这个并发数逐个取出执行。
- **`INGEST_CONCURRENCY`**：控制上传建索引的后台消费并发。请求会先入队，再按这个并发数逐个取出执行。

可按机器配置粗略参考：

- **2 核 4G**：建议保持默认值，即 `2 / 1 / 1`
- **4 核 8G**：可尝试 `3~4 / 1~2 / 1~2`
- **更高配置**：建议逐步调高，并配合观察 Ollama、Node 进程和系统负载

如果你使用的是本机 Ollama，最终瓶颈往往不只在 Node 服务本身，也会受 Ollama 模型吞吐影响，因此建议**小步调参**，不要一次性拉太高。

### 4. 启动开发环境

```bash
pnpm dev
```

启动后访问 `http://localhost:3000`。

### 5. 使用流程

- **创建作者**：在顶部作者切换器中新增作者
- **上传语料**：在“文本集”页签上传一个或多个 `.txt` 文件
- **分析风格**：在“创作”页签顶部点击“分析风格”或“重新分析”
- **生成文章**：填写主题、背景等信息后生成文章
- **查看历史**：在“历史”页签查看过往生成记录

## 数据存储说明

项目运行时会在 `data/` 目录下生成本地数据：

- **`data/db.sqlite`**：主数据库
  - `users`：账号（邮箱、bcrypt 密码、角色、状态、自带 LLM Key、月配额）
  - `authors`：作者信息、风格文本、风格状态、归属者 `owner_id`、可见性 `visibility`
  - `collections`：上传的原始文本、分片数量、`owner_id`
  - `generations`：生成历史（按 `owner_id` 严格隔离）
  - `queue_jobs`：风格分析与上传建索引的持久化任务队列
- **`data/authors/<authorId>/index/`**：该作者的 Vectra 向量索引

### 风格数据当前如何保存

当前版本 **不再使用** `data/style.md` 作为正式数据源。

风格分析结果现在保存在数据库 `authors` 表中：

- **`style_md`**：风格指南正文
- **`style_status`**：分析状态（`idle` / `queued` / `analyzing` / `done` / `failed`）
- **`style_analyzed_at`**：最近一次分析完成时间

这意味着即使刷新页面、切换作者或离开后再回来，前端也能从服务端恢复准确的分析状态。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 开发模式启动 |
| `pnpm build` | 构建生产版本 |
| `pnpm start` | 启动生产服务 |

## 项目结构

```text
.
├── app/                     # Next.js App Router 页面与 API
├── components/
│   ├── ui/                  # shadcn/ui 原子组件
│   ├── layout/              # 全局布局（Providers、用户菜单）
│   └── editor/              # 主工作台（作者切换、编辑器、侧栏）
├── hooks/                   # 前端 hooks
├── lib/
│   ├── auth/                # 会话与权限
│   ├── db/                  # SQLite 与向量存储
│   ├── ai/                  # Embedding 与 LLM 客户端
│   ├── rag/                 # 语料入库、风格分析、文章生成
│   ├── runtime/             # 后台队列与并发限流
│   └── utils.ts             # 通用工具
├── docs/                    # 文档（部署、架构等）
├── data/                    # 本地运行数据（已 gitignore）
├── Dockerfile
└── docker-compose.yml
```

## 运行与部署注意事项

- 启动前请确保 Ollama 正常运行，并已拉取 `nomic-embed-text`
- `.env` 不应提交到仓库
- `data/` 下的数据库、向量索引、上传语料都属于运行数据，不建议提交到 Git
- 如果线上机器配置较小，建议优先通过 `.env` 中的并发参数控制生成、分析、建索引任务上限
- 目前仅文章生成在超限时会直接返回 `429`；风格分析和上传建索引会先入队，再由后台按并发限制消费
- Docker 部署请参考 [`docs/deploy.md`](./docs/deploy.md)

## License

MIT
