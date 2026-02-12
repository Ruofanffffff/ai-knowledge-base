#!/bin/bash

echo "=== 重启前端服务器 ==="
echo ""

# 停止所有 vite 进程
echo "1️⃣  停止现有的 Vite 进程..."
pkill -f "vite" 2>/dev/null && echo "   ✅ 已停止 Vite 进程" || echo "   ℹ️  没有运行中的 Vite 进程"
sleep 1
echo ""

# 进入 client 目录
cd client || exit 1

# 清除缓存
echo "2️⃣  清除 Vite 缓存..."
rm -rf node_modules/.vite 2>/dev/null && echo "   ✅ 已清除 node_modules/.vite" || echo "   ℹ️  缓存目录不存在"
rm -rf dist 2>/dev/null && echo "   ✅ 已清除 dist" || echo "   ℹ️  dist 目录不存在"
echo ""

echo "3️⃣  启动前端服务器..."
echo "   执行: npm run dev"
echo ""
echo "=== 请在新终端中运行以下命令 ==="
echo ""
echo "cd ai-knowledge-base/client && npm run dev"
echo ""
echo "=== 或者直接运行 ==="
echo ""
echo "npm run dev"
echo ""
