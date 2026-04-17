# RAG Writer

基于 **Next.js + SQLite + Vectra + Ollama + DeepSeek** 的多作者风格写作工具。你可以为不同作者上传 `.txt` 语料，分析其写作风格，并基于检索增强生成（RAG）创作新文章。

## 功能特性

- **多作者管理**：为不同作者分别维护语料、风格和生成历史
- **本地向量索引**：使用 `vectra` 存储每位作者的检索索引，无需外部向量数据库
- **本地 Embedding**：通过 Ollama 的 `nomic-embed-text` 生成向量
- **DeepSeek 生成**：使用 DeepSeek 进行风格分析与文章生成
- **服务端风格状态**：风格分析状态持久化为 `idle / analyzing / done / failed`，切页或刷新后不会丢失
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

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | **是** | DeepSeek API 密钥 |
| `OLLAMA_BASE_URL` | 否 | Ollama 地址，默认 `http://localhost:11434` |

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
- **`data/authors/<authorId>/index/`**：该作者的 Vectra 向量索引

### 风格数据当前如何保存

当前版本 **不再使用** `data/style.md` 作为正式数据源。

风格分析结果现在保存在数据库 `authors` 表中：

- **`style_md`**：风格指南正文
- **`style_status`**：分析状态（`idle` / `analyzing` / `done` / `failed`）
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
├── lib/                     # 数据库、向量检索、生成器等核心逻辑
├── data/                    # 本地运行数据（已 gitignore）
├── Dockerfile
├── docker-compose.yml
└── DEPLOY.md                # Docker 部署说明
```

## 运行与部署注意事项

- 启动前请确保 Ollama 正常运行，并已拉取 `nomic-embed-text`
- `.env` 不应提交到仓库
- `data/` 下的数据库、向量索引、上传语料都属于运行数据，不建议提交到 Git
- Docker 部署请参考 `DEPLOY.md`

## License

MIT
