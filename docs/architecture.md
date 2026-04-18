# 架构与数据存储

## 技术栈

- **前端**：Next.js 15（App Router）、React 19、Tailwind CSS、Radix UI、shadcn/ui
- **鉴权**：NextAuth（v5 beta）
- **数据库**：SQLite（`better-sqlite3`，同步接口）
- **向量检索**：Vectra（本地文件存储）
- **Embedding**：Ollama（`nomic-embed-text`）
- **LLM**：任意 OpenAI 兼容 API（`openai` SDK）

## 本地数据目录

项目运行时会在 `data/` 下生成以下数据：

```text
data/
├── db.sqlite                     # 主数据库（SQLite）
└── authors/
    └── <authorId>/
        └── index/                # 该作者的 Vectra 向量索引
```

Docker 部署时 `data/` 挂在 volume `app_data` 上。

## 主要数据表

| 表 | 作用 | 关键字段 |
| --- | --- | --- |
| `users` | 账号 | `email`、bcrypt `password_hash`、`role`、`status`、自带 LLM 配置、`monthly_quota` / `quota_used` / `quota_period` |
| `authors` | 作者 | `owner_id`、`visibility`（`private` / `shared`）、`style_md`、`style_status`、`style_analyzed_at` |
| `collections` | 上传的文本集 | `owner_id`、`author_id`、原始文本、分片数量 |
| `generations` | 生成历史 | `owner_id`、`author_id`、主题、正文、引用片段 |
| `queue_jobs` | 持久化任务队列 | 类型（风格分析 / ingest）、状态、payload、重试信息 |

所有业务数据（`authors` / `collections` / `generations`）按 `owner_id` 严格隔离，用户之间互不可见。

## 风格数据

当前版本**不再使用** `data/style.md`，风格分析结果保存在 `authors` 表中：

- `style_md`：风格指南正文
- `style_status`：`idle` / `queued` / `analyzing` / `done` / `failed`
- `style_analyzed_at`：最近一次分析完成时间

刷新页面 / 切换作者 / 离开后再回来，前端都能从服务端恢复准确的分析状态。

## 异步队列

风格分析与上传建索引都走 `queue_jobs` 表持久化：

```
API 入队  →  queue_jobs (queued)  →  worker claim  →  processing  →  done / failed
```

- 每种任务类型有独立并发上限（`ANALYZE_CONCURRENCY` / `INGEST_CONCURRENCY`）
- 前端通过 `GET /api/authors/{id}/jobs` 轮询一次拿到该作者所有 active job
- **崩溃自愈**：进程启动时会把所有遗留的 `processing` 任务重置为 `queued`，新 worker 会重新执行

## 目录结构

```text
.
├── app/                     # Next.js App Router 页面与 API
│   ├── admin/               # Admin 管理端
│   ├── login/ register/     # 鉴权页
│   ├── settings/            # 用户设置（改密码 / 自带 LLM Key）
│   └── api/
│       ├── auth/            # NextAuth
│       ├── admin/           # 管理端 API
│       ├── authors/         # 作者、文本集、生成、任务查询
│       ├── jobs/            # 单任务状态查询
│       └── me/              # 当前用户信息、配额
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
├── docs/                    # 项目文档
├── data/                    # 本地运行数据（已 gitignore）
├── Dockerfile
└── docker-compose.yml
```
