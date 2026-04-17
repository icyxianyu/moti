# RAG Writer

基于 **Next.js + SQLite + Vectra + Ollama + DeepSeek** 的多作者风格写作工具。你可以为不同作者上传 `.txt` 语料，分析其写作风格，并基于检索增强生成（RAG）创作新文章。

## 功能特性

- **多作者管理**：为不同作者分别维护语料、风格和生成历史
- **本地向量索引**：使用 `vectra` 存储每位作者的检索索引，无需外部向量数据库
- **本地 Embedding**：通过 Ollama 的 `nomic-embed-text` 生成向量
- **DeepSeek 生成**：使用 DeepSeek 进行风格分析与文章生成
- **服务端风格状态**：风格分析状态持久化为 `idle / queued / analyzing / done / failed`，切页或刷新后不会丢失
- **任务队列化处理**：风格分析与上传建索引采用“先入队、后台按并发消费”的模式，降低小机器瞬时压力
- **可编辑风格面板**：在创作页顶部直接查看、展开和编辑当前作者的风格指南
- **生成历史查看**：保留每次生成结果，支持回看历史内容

## 技术栈

- **前端**：Next.js 15、React 19、Tailwind CSS、Radix UI
- **数据库**：SQLite（`better-sqlite3`）
- **向量检索**：Vectra
- **Embedding**：Ollama（`nomic-embed-text`）
- **LLM**：DeepSeek API

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
| `DEEPSEEK_API_KEY` | **是** | - | DeepSeek API 密钥 |
| `OLLAMA_BASE_URL` | 否 | `http://localhost:11434` | Ollama 服务地址 |
| `GENERATE_CONCURRENCY` | 否 | `2` | 同时允许进行的文章生成任务数；超出后接口直接返回 `429` |
| `ANALYZE_CONCURRENCY` | 否 | `1` | 风格分析后台消费者并发数；超出的任务会先进入队列 |
| `INGEST_CONCURRENCY` | 否 | `1` | 上传建索引后台消费者并发数；超出的任务会先进入队列 |

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
  - `authors`：作者信息、风格文本、风格状态、分析完成时间
  - `collections`：上传的原始文本及分片数量
  - `generations`：生成历史
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
├── components/              # 前端组件
├── hooks/                   # 前端 hooks
├── lib/                     # 数据库、向量检索、生成器、队列调度等核心逻辑
├── data/                    # 本地运行数据（已 gitignore）
├── Dockerfile
├── docker-compose.yml
└── DEPLOY.md                # Docker 部署说明
```

## 运行与部署注意事项

- 启动前请确保 Ollama 正常运行，并已拉取 `nomic-embed-text`
- `.env` 不应提交到仓库
- `data/` 下的数据库、向量索引、上传语料都属于运行数据，不建议提交到 Git
- 如果线上机器配置较小，建议优先通过 `.env` 中的并发参数控制生成、分析、建索引任务上限
- 目前仅文章生成在超限时会直接返回 `429`；风格分析和上传建索引会先入队，再由后台按并发限制消费
- Docker 部署请参考 `DEPLOY.md`

## License

MIT
