# RAG Writer

基于 RAG（检索增强生成）的风格写作工具，从已有文章中学习写作风格，生成模仿风格的新文章。

## 功能特性

- 本地向量索引（vectra），无需外部向量数据库
- 本地 Embedding（Ollama nomic-embed-text），无需云端 embedding 服务
- DeepSeek API 流式生成，实时输出
- 增量摄入：已索引的文章自动跳过
- 前端支持取消生成、折叠查看参考片段
- 请求频率限制 + 输入长度限制

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 安装 Ollama 并拉取模型

```bash
# 安装 Ollama: https://ollama.com
ollama pull nomic-embed-text
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入 DeepSeek API Key：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | **是** | DeepSeek API 密钥 |
| `OLLAMA_BASE_URL` | 否 | Ollama 地址，默认 `http://localhost:11434` |
| `PORT` | 否 | 服务端口，默认 `8000` |
| `ARTICLES_DIR` | 否 | 文章目录，默认 `data/articles/` |

### 4. 放入文章

将 `.txt` 格式的文章文件放入 `data/articles/` 目录。

### 5. 摄入索引

```bash
pnpm ingest           # 增量摄入（跳过已索引文章）
pnpm ingest:force     # 强制重建全部索引
```

### 6. 启动服务

```bash
pnpm dev              # 开发模式（热重载）
```

打开 `http://localhost:8000` 即可使用。

## 命令说明

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 开发模式启动（tsx watch 热重载） |
| `pnpm start` | 生产模式启动（需先 build） |
| `pnpm build` | 编译 TypeScript 到 dist/ |
| `pnpm ingest` | 增量摄入文章到向量索引 |
| `pnpm ingest:force` | 强制重建全部索引 |

## 项目结构

```
├── src/
│   ├── server.ts           # Express 服务器（SSE 流式响应）
│   ├── ingest.ts           # 数据摄入脚本
│   └── lib/
│       ├── embedder.ts     # Ollama 嵌入服务（带超时和重试）
│       ├── generator.ts    # DeepSeek 生成服务（带 AbortSignal）
│       └── vectorStore.ts  # vectra 本地向量存储
├── public/
│   └── index.html          # 前端页面（暗色主题）
├── data/
│   ├── articles/           # 放入 .txt 文章（用户目录）
│   └── index/              # 向量索引（自动生成）
├── .env.example            # 环境变量模板
├── tsconfig.json
└── package.json
```

## 注意事项

- 使用前请确保 Ollama 已启动并拉取了 `nomic-embed-text` 模型
- `.env` 包含 API 密钥，已在 `.gitignore` 中排除
- `data/articles/` 和 `data/index/` 均已 gitignore

## License

MIT
