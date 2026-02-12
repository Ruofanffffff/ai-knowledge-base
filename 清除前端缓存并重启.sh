#!/bin/bash

echo "=== 清除前端缓存并重启 ==="
echo ""

cd client

echo "1️⃣  停止前端服务器（如果正在运行）..."
# 查找并杀死 vite 进程
pkill -f "vite" || echo "   没有找到运行中的 vite 进程"
echo ""

echo "2️⃣  清除 Vite 缓存..."
rm -rf node_modules/.vite
echo "   ✅ 已删除 node_modules/.vite"
echo ""

echo "3️⃣  清除构建输出..."
rm -rf dist
echo "   ✅ 已删除 dist 目录"
echo ""

echo "4️⃣  清除浏览器缓存提示..."
echo "   ⚠️  请在浏览器中执行以下操作："
echo "   1. 打开开发者工具 (F12)"
echo "   2. 右键点击刷新按钮"
echo "   3. 选择 '清空缓存并硬性重新加载'"
echo "   或者按 Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows/Linux)"
echo ""

echo "5️⃣  重启前端服务器..."
echo "   执行: npm run dev"
echo ""
echo "=== 完成 ==="
echo ""
echo "💡 下一步："
echo "   1. 在新终端中运行: cd client && npm run dev"
echo "   2. 等待服务器启动"
echo "   3. 在浏览器中硬刷新页面 (Cmd+Shift+R)"
echo ""
