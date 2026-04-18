# 部署指南

## 前提条件

- 腾讯云轻量服务器（Docker CE 镜像）
- 服务器公网 IP（购买后在控制台查看）

## 部署步骤

### 1. SSH 登录服务器

```bash
ssh root@你的公网IP
```

首次登录密码在腾讯云控制台 → 轻量应用服务器 → 重置密码。

### 2. 拉取项目代码

```bash
# 方式一：从 Git 仓库拉取（推荐）
git clone <你的仓库地址> /opt/rag-writer
cd /opt/rag-writer

# 方式二：从本地上传（如果没有 Git 仓库）
# 在本地执行：
# scp -r ./ root@你的公网IP:/opt/rag-writer
```

### 3. 配置环境变量

```bash
cd /opt/rag-writer

# 创建 .env 文件（以 DeepSeek 为例，也可换成任意 OpenAI 兼容服务）
cat > .env << 'EOF'
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=你的API密钥
LLM_MODEL=deepseek-chat
EOF
```

> Moti 使用 OpenAI 兼容协议，除 DeepSeek 外也支持 OpenAI、通义千问、智谱、Moonshot、硅基流动、本地 vLLM / LM Studio 等。把 `LLM_BASE_URL` 和 `LLM_MODEL` 换成对应服务即可。

### 4. 开放防火墙端口

在腾讯云控制台 → 轻量应用服务器 → 防火墙，添加规则：

| 协议 | 端口 | 策略 | 备注 |
|------|------|------|------|
| TCP  | 80   | 允许 | HTTP 访问 |

### 5. 启动服务

```bash
# 构建并启动（首次需要几分钟）
docker compose up -d --build

# 查看日志，确认启动成功
docker compose logs -f
```

### 6. 拉取 Embedding 模型

```bash
# 首次需要下载 nomic-embed-text 模型（约 274MB）
docker compose exec ollama ollama pull nomic-embed-text

# 验证模型已安装
docker compose exec ollama ollama list
```

### 7. 访问

打开浏览器访问：`http://你的公网IP`

---

## 常用运维命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f app      # 查看应用日志
docker compose logs -f ollama   # 查看 Ollama 日志

# 重启服务
docker compose restart

# 更新代码后重新部署
git pull
docker compose up -d --build

# 停止服务
docker compose down

# 停止并删除数据（慎用！）
docker compose down -v
```

## 数据备份

数据存储在 Docker Volume 中：

```bash
# 查看 volume 位置
docker volume inspect rag-writer_app_data

# 备份 SQLite 数据库
docker compose exec app cp /app/data/db.sqlite /app/data/db.sqlite.bak
docker cp $(docker compose ps -q app):/app/data/db.sqlite.bak ./backup/

# 备份全部数据
docker run --rm -v rag-writer_app_data:/data -v $(pwd)/backup:/backup alpine tar czf /backup/data.tar.gz -C /data .
```

## 绑定域名 + HTTPS（可选）

如果需要绑定域名和 HTTPS，后续可以加一个 Nginx 反代 + Let's Encrypt 免费证书。
