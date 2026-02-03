#!/bin/bash

echo "🚀 启动Android开发模式..."

# 启动开发服务器
echo "📡 启动前端开发服务器..."
cd client
npm run dev &
DEV_PID=$!

# 等待开发服务器启动
echo "⏳ 等待开发服务器启动..."
sleep 5

# 在Android设备上运行应用
echo "📱 在Android设备上运行应用..."
cd ..
npx cap run android

# 清理进程
kill $DEV_PID 2>/dev/null

echo "✅ 开发模式已关闭"