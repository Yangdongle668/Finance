#!/bin/sh
set -e

echo "🔄 运行数据库迁移..."
node -e "
  const { runMigrations } = require('./dist/infrastructure/database/migrate');
  runMigrations();
  console.log('✅ 数据库迁移完成');
"

echo "🚀 启动精斗云云会计系统后端..."
exec node dist/server.js
