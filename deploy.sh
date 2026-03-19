#!/usr/bin/env bash
# ============================================================
#  精斗云云会计系统 — Docker 一键部署脚本
#  用法：bash deploy.sh [start|stop|restart|logs|status|backup|update]
# ============================================================

set -euo pipefail

# ── 颜色输出 ────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[✓]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[✗]${NC}    $*"; exit 1; }
title()   { echo -e "\n${BOLD}${BLUE}=== $* ===${NC}\n"; }

# ── 项目根目录（脚本所在位置） ───────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── 环境变量 ─────────────────────────────────────────────────
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
  warn ".env 不存在，从 .env.example 复制..."
  cp .env.example .env
  warn "请编辑 .env 修改 JWT_SECRET 等安全配置后重新运行！"
  echo ""
fi

# ── 检查依赖 ─────────────────────────────────────────────────
check_deps() {
  for cmd in docker docker-compose; do
    # docker compose v2 兼容
    if [ "$cmd" = "docker-compose" ]; then
      if ! (docker compose version &>/dev/null || command -v docker-compose &>/dev/null); then
        error "未找到 docker compose。请安装 Docker Desktop 或 Docker Engine + Compose 插件"
      fi
    else
      command -v "$cmd" &>/dev/null || error "未找到 $cmd，请先安装 Docker"
    fi
  done
}

# ── 兼容 docker compose / docker-compose ────────────────────
dc() {
  if docker compose version &>/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

# ── 命令：start ──────────────────────────────────────────────
cmd_start() {
  title "启动 精斗云云会计系统"

  check_deps

  # 生成随机 JWT_SECRET（如果还是默认值）
  if grep -q "please_change_this" .env 2>/dev/null; then
    warn "检测到默认 JWT_SECRET，自动生成随机密钥..."
    RANDOM_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null | tr -d '-' || echo "fallback_$(date +%s)")
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/please_change_this_to_a_strong_random_secret/${RANDOM_SECRET}/" .env
    else
      sed -i "s/please_change_this_to_a_strong_random_secret/${RANDOM_SECRET}/" .env
    fi
    success "JWT_SECRET 已自动更新"
  fi

  info "拉取/构建镜像（首次约需 3-5 分钟）..."
  dc build --parallel

  info "启动容器..."
  dc up -d

  info "等待服务就绪..."
  local retries=0
  until dc ps server | grep -q "healthy" || [ $retries -ge 20 ]; do
    sleep 3; retries=$((retries + 1))
    echo -n "."
  done
  echo ""

  # 初始化种子数据
  info "检查数据库初始化状态..."
  dc run --rm seed

  print_status
}

# ── 命令：stop ───────────────────────────────────────────────
cmd_stop() {
  title "停止服务"
  dc down
  success "所有容器已停止（数据卷保留）"
}

# ── 命令：restart ────────────────────────────────────────────
cmd_restart() {
  title "重启服务"
  dc restart
  success "服务已重启"
}

# ── 命令：logs ───────────────────────────────────────────────
cmd_logs() {
  local service="${1:-}"
  if [ -n "$service" ]; then
    dc logs -f "$service"
  else
    dc logs -f
  fi
}

# ── 命令：status ─────────────────────────────────────────────
cmd_status() {
  print_status
}

print_status() {
  title "服务状态"
  dc ps
  echo ""

  local port
  port=$(grep "APP_PORT" .env 2>/dev/null | cut -d= -f2 || echo "80")
  port="${port:-80}"

  success "部署完成！"
  echo ""
  echo -e "  ${BOLD}🌐 访问地址：${NC}  http://localhost:${port}"
  echo -e "  ${BOLD}🔑 默认账号：${NC}  admin / Admin@123"
  echo -e "  ${BOLD}💾 数据持久化：${NC} Docker Volume finance_data"
  echo ""
  echo -e "  ${YELLOW}常用命令：${NC}"
  echo -e "  bash deploy.sh logs         # 查看日志"
  echo -e "  bash deploy.sh logs server  # 只看后端日志"
  echo -e "  bash deploy.sh stop         # 停止服务"
  echo -e "  bash deploy.sh backup       # 备份数据库"
  echo -e "  bash deploy.sh update       # 拉取最新代码重新部署"
}

# ── 命令：backup ─────────────────────────────────────────────
cmd_backup() {
  title "备份数据库"
  local backup_dir="./backups"
  local timestamp
  timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_file="${backup_dir}/finance_${timestamp}.tar.gz"

  mkdir -p "$backup_dir"

  # 检查数据卷中是否有数据库文件
  local db_count
  db_count=$(docker run --rm -v finance_data:/data alpine sh -c 'ls /data/*.db 2>/dev/null | wc -l')
  if [ "${db_count:-0}" -eq 0 ]; then
    warn "数据卷中暂无数据库文件，跳过备份"
    return 0
  fi

  # 打包所有 .db 文件（master.db + company_*.db）
  docker run --rm \
    -v finance_data:/data \
    -v "$(pwd)/backups:/backups" \
    alpine tar czf "/backups/finance_${timestamp}.tar.gz" -C /data $(ls /data/*.db 2>/dev/null | xargs -n1 basename | tr '\n' ' ')

  success "备份完成：${backup_file}"
  ls -lh "$backup_dir" | tail -5
}

# ── 命令：restore ────────────────────────────────────────────
cmd_restore() {
  local file="${1:-}"
  [ -z "$file" ] && error "用法：bash deploy.sh restore <备份文件路径>"
  [ ! -f "$file" ] && error "文件不存在：$file"

  title "恢复数据库"
  warn "⚠  此操作将覆盖当前数据库，建议先备份！"
  read -rp "确认恢复？(y/N) " confirm
  [[ "$confirm" != "y" && "$confirm" != "Y" ]] && { info "已取消"; exit 0; }

  dc stop server
  docker run --rm \
    -v finance_data:/data \
    -v "$(cd "$(dirname "$file")" && pwd):/restore" \
    alpine tar xzf "/restore/$(basename "$file")" -C /data
  dc start server
  success "数据库恢复完成"
}

# ── 命令：update ─────────────────────────────────────────────
cmd_update() {
  title "更新部署"
  info "备份当前数据库..."
  cmd_backup

  info "拉取最新代码..."
  git pull

  info "重新构建镜像..."
  dc build --parallel --no-cache

  info "重启服务..."
  dc up -d

  success "更新完成"
  print_status
}

# ── 命令：clean ──────────────────────────────────────────────
cmd_clean() {
  title "清除所有数据（危险！）"
  warn "⚠  此操作将删除所有容器和数据卷，数据不可恢复！"
  read -rp "确认清除？(y/N) " confirm
  [[ "$confirm" != "y" && "$confirm" != "Y" ]] && { info "已取消"; exit 0; }

  dc down -v --remove-orphans
  success "已清除所有容器和数据卷"
}

# ── 主入口 ───────────────────────────────────────────────────
CMD="${1:-start}"

case "$CMD" in
  start)              cmd_start ;;
  stop)               cmd_stop ;;
  restart)            cmd_restart ;;
  logs)               cmd_logs "${2:-}" ;;
  status)             cmd_status ;;
  backup)             cmd_backup ;;
  restore)            cmd_restore "${2:-}" ;;
  update)             cmd_update ;;
  clean)              cmd_clean ;;
  *)
    echo -e "${BOLD}精斗云云会计系统 — 部署脚本${NC}"
    echo ""
    echo "用法: bash deploy.sh <命令>"
    echo ""
    echo "命令列表："
    echo "  start              构建并启动所有服务（默认）"
    echo "  stop               停止所有服务（保留数据）"
    echo "  restart            重启所有服务"
    echo "  logs [service]     查看日志（server/client）"
    echo "  status             查看服务状态和访问地址"
    echo "  backup             备份数据库到 ./backups/"
    echo "  restore <file>     从备份文件恢复数据库"
    echo "  update             拉取最新代码并重新部署"
    echo "  clean              删除所有容器和数据（危险）"
    ;;
esac
