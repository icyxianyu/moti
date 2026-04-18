# 部署指南（腾讯云 Docker）

## 0. 前提条件

- 腾讯云服务器（轻量或 CVM），**推荐 2C4G + 20G 系统盘及以上**
  - Ollama + embedding 模型常驻约 1–2 GB 内存
  - Next.js + SQLite 运行时约 300–500 MB
- 已安装 Docker 20+ 与 Docker Compose v2（轻量服务器的「Docker CE」应用镜像自带；CVM 需手动装）

如果服务器没装 Docker：

```bash
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
systemctl enable --now docker
```

## 1. 拉取代码

```bash
git clone https://github.com/icyxianyu/moti.git /opt/moti
cd /opt/moti
```

## 2. 配置 `.env`

```bash
cp .env.example .env
vim .env
```

至少需要改动：

| 变量 | 说明 |
|------|------|
| `LLM_API_KEY` | DeepSeek / OpenAI 等提供的真实 API Key |
| `AUTH_SECRET` | NextAuth 会话签名密钥，用 `openssl rand -base64 32` 生成 |
| `ADMIN_EMAIL` | 初始 admin 邮箱 |
| `ADMIN_INITIAL_PASSWORD` | **初始强密码**，登录后立即去「设置」页修改 |

⚠️ **不要改 `OLLAMA_BASE_URL`**：即使 `.env` 里写的是 `http://localhost:11434`，compose 会在容器内强制覆盖为 `http://ollama:11434`。

## 3. 开放防火墙端口

腾讯云控制台 → 轻量应用服务器 / CVM 安全组 → 放行：

| 协议 | 端口 | 备注 |
|------|------|------|
| TCP  | 80   | HTTP 访问 |
| TCP  | 443  | 后续绑域名 HTTPS 时再开 |

## 4. 构建并启动

```bash
docker compose up -d --build
docker compose logs -f app     # 观察启动日志，出现 "Ready" 即成功
```

## 5. 拉取 Embedding 模型（首次必做）

```bash
docker compose exec ollama ollama pull nomic-embed-text
docker compose exec ollama ollama list     # 验证
```

## 6. 访问

浏览器打开 `http://<公网IP>`，用 `.env` 里的 `ADMIN_EMAIL` + `ADMIN_INITIAL_PASSWORD` 登录。**登录后务必到「设置」页改密码**。

---

## 常用运维

```bash
docker compose ps                       # 状态
docker compose logs -f app              # 应用日志
docker compose logs -f ollama           # Ollama 日志
docker compose restart app              # 只重启 app
docker compose up -d --build            # 更新代码后重建
docker compose down                     # 停止（保留数据）
docker compose down -v                  # 停止 + 删除 volume（慎用！）
```

## 数据备份

```bash
# 快速备份 SQLite
docker compose exec app cp /app/data/db.sqlite /app/data/db.sqlite.bak
docker cp $(docker compose ps -q app):/app/data/db.sqlite.bak ./backup/

# 全量备份 volume
docker run --rm \
  -v rag-writer_app_data:/data \
  -v "$(pwd)/backup":/backup \
  alpine tar czf /backup/data-$(date +%Y%m%d).tar.gz -C /data .
```

## 绑定域名 + HTTPS（可选）

在 compose 外加一层 Caddy 反代即可自动签发 Let's Encrypt 证书，示例：

```yaml
# 追加到 docker-compose.yml
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on: [app]

volumes:
  caddy_data:
```

`Caddyfile`：
```
yourdomain.com {
  reverse_proxy app:3000
}
```

同时把原 `app` 服务的 `ports: - "80:3000"` 删掉（只由 Caddy 对外暴露）。
