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

> 📖 想先了解能力全貌？看 [功能特性](./docs/features.md)。

---

## 快速开始

### 方式一：Docker（推荐）

需要 Docker 20+ 与 Docker Compose v2。

```bash
# 1. 获取代码
git clone https://github.com/icyxianyu/moti.git
cd moti

# 2. 配置环境变量（至少填 LLM_API_KEY / AUTH_SECRET / ADMIN_*）
cp .env.example .env
vim .env

# 3. 启动
docker compose up -d --build

# 4. 首次拉取 embedding 模型（只需一次）
docker compose exec ollama ollama pull nomic-embed-text
```

浏览器访问 `http://localhost`（或服务器公网 IP），用 `.env` 里配置的 `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` 登录，**进入后立即到「设置」页修改密码**。

完整部署（含腾讯云、HTTPS、备份、运维命令）见 [`docs/deploy.md`](./docs/deploy.md)。

### 方式二：本地开发

需要 Node.js 20+、pnpm、已安装的 Ollama。

```bash
# 1. 安装依赖
pnpm install

# 2. 拉取 embedding 模型
ollama pull nomic-embed-text

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，至少填 LLM_API_KEY 和 AUTH_SECRET

# 4. 启动
pnpm dev
```

访问 `http://localhost:3000`。如果 `.env` 里填了 `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD`，首次启动会自动创建 admin 账号；没填就去 `/register` 自行注册。

---

## 使用流程

1. **登录** → 默认 admin 账号 或 `/register` 注册新账号
2. **创建作者** → 顶部作者切换器中新增
3. **上传语料** → 「文本集」页签上传一个或多个 `.txt` 文件
4. **分析风格** → 「创作」页签顶部点击「分析风格」或「重新分析」
5. **生成文章** → 填写主题、背景等信息后生成
6. **查看历史** → 「历史」页签回看

---

## 文档

| 文档 | 内容 |
| --- | --- |
| [功能特性](./docs/features.md) | 多用户、配额、BYOK、admin、队列等完整能力清单 |
| [配置参考](./docs/configuration.md) | 所有环境变量、LLM 供应商对照表、并发调参建议 |
| [架构与数据存储](./docs/architecture.md) | 技术栈、数据表、目录结构、异步队列机制 |
| [部署指南](./docs/deploy.md) | 腾讯云 Docker 部署、HTTPS、备份、运维命令 |

---

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 开发模式启动 |
| `pnpm build` | 构建生产版本 |
| `pnpm start` | 启动生产服务 |
| `docker compose up -d --build` | Docker 重建并启动 |
| `docker compose logs -f app` | 查看应用日志 |

---

## License

MIT
