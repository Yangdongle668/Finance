# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制 package.json，利用 Docker layer 缓存
COPY package*.json ./
RUN npm ci --ignore-scripts

# 复制源码并编译 TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────
FROM node:20-alpine AS runner

# 安装 SQLite 原生依赖所需的 Python/make（better-sqlite3 需要）
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 只复制生产依赖
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# 重新编译 better-sqlite3 原生模块（alpine 架构兼容）
RUN npm rebuild better-sqlite3

# 复制编译产物
COPY --from=builder /app/dist ./dist

# 复制 schema（migrate 运行时读取，需与编译产物同级）
COPY src/infrastructure/database/schema.sql ./dist/infrastructure/database/schema.sql
# 同时保留 src 路径（path.join(__dirname) 在 dist 下会向上查找）
RUN mkdir -p /app/src/infrastructure/database && \
    cp /app/dist/infrastructure/database/schema.sql /app/src/infrastructure/database/schema.sql

# 创建数据目录
RUN mkdir -p /app/data && mkdir -p /app/logs

# 环境变量默认值（可被 docker-compose 覆盖）
ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/app/data/finance.db \
    JWT_SECRET=change_this_secret_in_production \
    JWT_EXPIRES_IN=7d \
    BCRYPT_ROUNDS=10

EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

# 启动脚本（迁移 + 启动，使用 shell 形式确保信号传递正确）
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

CMD ["/app/docker-entrypoint.sh"]
