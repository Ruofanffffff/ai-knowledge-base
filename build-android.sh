#!/bin/bash

echo "🚀 开始构建Android应用..."

# 构建前端项目
echo "📦 构建前端项目..."
cd client
npm run build
cd ..

# 同步到Android平台
echo "🔄 同步代码到Android平台..."
npx cap sync android

echo "✅ 构建完成！"
echo ""
echo "📱 下一步操作："
echo "1. 在Android Studio中打开 android/ 目录"
echo "2. 点击 Run 按钮运行应用"
echo "3. 或者使用命令: cd android && ./gradlew assembleDebug"
echo ""
echo "🔧 开发模式："
echo "使用 'npm run dev:android' 启动开发服务器并实时预览"