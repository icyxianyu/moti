# 功能特性

## 核心能力

- **像某位作者一样写作**：为每位作者建立独立语料库 → 分析笔法 → 用其口吻生成新文章
- **多作者管理**：作者之间语料、风格、生成历史完全隔离
- **本地向量索引**：`vectra` 存储每位作者的检索索引，无需外部向量数据库
- **本地 Embedding**：通过 Ollama 的 `nomic-embed-text` 生成向量，不外发语料
- **任意 LLM 供应商**：OpenAI 兼容协议，换 `LLM_BASE_URL` 就能切换（DeepSeek / OpenAI / 通义千问 / 智谱 / Moonshot / 硅基流动 / 本地 vLLM 均可）

## 多用户与权限

- **账号体系**：基于 NextAuth，支持邮箱注册/登录，密码 bcrypt 加密
- **角色**：普通用户 / Admin
- **数据隔离**：`authors` / `collections` / `generations` 全部按 `owner_id` 严格隔离，用户只看得到自己的数据
- **作者可见性**：`authors.visibility` 支持 `private`（仅所有者）/ `shared`（全体登录用户可用）

## 月度配额

- 每个用户有 `monthly_quota`（默认 3 次/月），按自然月重置
- 文章生成消耗配额；超限时生成接口返回错误
- Admin 可在管理端为用户上调配额

## 用户自带 LLM Key（BYOK）

- 用户可在「设置」页填写自己的 `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`
- 填了之后生成走**用户自己的 key**，不占系统额度
- 也不再消耗上述月度配额
- 适合个人付费用户 / 团队内共用部署

## 管理端（Admin）

- **用户管理**：列出所有用户、调整角色、封禁/解禁、修改配额、重置密码
- **作者管理**：查看全局作者列表、切换可见性
- 路径：`/admin`，仅 Admin 账号可访问

## 设置页

- 用户路径：`/settings`
- 可做：修改密码、填写/清除自带 LLM 配置、查看本月配额使用情况

## 异步任务队列

风格分析和上传建索引都是耗时任务，采用"先入队、后台按并发消费"的模式：

- **`queue_jobs` 表持久化**：任务状态重启后不丢
- **前端进度恢复**：刷新页面 / 切换作者 / 从别处跳回来，进度条继续显示
- **崩溃自愈**：进程重启时会把遗留的 `processing` 任务重置回 `queued` 重新执行
- **服务端资源保护**：通过 `GENERATE_CONCURRENCY` / `ANALYZE_CONCURRENCY` / `INGEST_CONCURRENCY` 限并发

## 服务端风格状态

风格分析状态持久化为 `idle` / `queued` / `analyzing` / `done` / `failed`，切页或刷新后不丢失。
