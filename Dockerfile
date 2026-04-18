# syntax=docker/dockerfile:1.6

# ── Stage 1: 安装全量依赖（含 devDependencies 用于 build）───────
FROM node:20-alpine AS deps
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apk/repositories \
 && apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate \
 && pnpm config set registry https://registry.npmmirror.com
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: 构建 Next.js ─────────────────────────────────────
FROM node:20-alpine AS builder
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apk/repositories \
 && apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate \
 && pnpm config set registry https://registry.npmmirror.com
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ── Stage 3: 生产运行（最小镜像，不含编译工具链）────────────────
FROM node:20-alpine AS runner
# better-sqlite3 运行期只需要 libstdc++（alpine 默认不带）
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apk/repositories \
 && apk add --no-cache libstdc++ libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN corepack enable && corepack prepare pnpm@latest --activate

# 拷贝运行期所需文件（直接复用 builder 的 node_modules，避免 pnpm store 路径冲突）
COPY --from=builder  /app/package.json     ./package.json
COPY --from=builder  /app/pnpm-lock.yaml   ./pnpm-lock.yaml
COPY --from=builder  /app/next.config.mjs  ./next.config.mjs
COPY --from=builder  /app/public           ./public
COPY --from=builder  /app/.next            ./.next
COPY --from=builder  /app/node_modules     ./node_modules

# 数据目录（通过 volume 挂载持久化），并交给 node 用户
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["pnpm", "start"]
