#!/bin/bash

# 切换知识图谱数据库到 SQLite
# 此脚本会自动完成所有配置步骤

echo "================================================"
echo "知识图谱数据库切换工具"
echo "从 PostgreSQL 切换到 SQLite"
echo "================================================"
echo ""

# 检查是否在项目根目录
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

echo "📝 步骤 1/4: 备份原始配置文件..."
cp prisma/schema.prisma prisma/schema.prisma.backup
cp .env .env.backup
echo "✅ 备份完成"
echo ""

echo "📝 步骤 2/4: 修改 Prisma 配置..."
# 使用 sed 修改 schema.prisma
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' 's/provider = "postgresql"/provider = "sqlite"/' prisma/schema.prisma
    sed -i '' 's|url      = env("DATABASE_URL")|url      = "file:../data/knowledge_graph.db"|' prisma/schema.prisma
else
    # Linux
    sed -i 's/provider = "postgresql"/provider = "sqlite"/' prisma/schema.prisma
    sed -i 's|url      = env("DATABASE_URL")|url      = "file:../data/knowledge_graph.db"|' prisma/schema.prisma
fi
echo "✅ Prisma 配置已更新"
echo ""

echo "📝 步骤 3/4: 修改环境变量..."
# 修改 .env 文件
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' 's|DATABASE_URL="postgresql://.*"|DATABASE_URL="file:./data/knowledge_graph.db"|' .env
else
    # Linux
    sed -i 's|DATABASE_URL="postgresql://.*"|DATABASE_URL="file:./data/knowledge_graph.db"|' .env
fi
echo "✅ 环境变量已更新"
echo ""

echo "📝 步骤 4/4: 生成 Prisma Client 并创建数据库..."
echo ""

# 生成 Prisma Client
echo "正在生成 Prisma Client..."
npx prisma generate

if [ $? -ne 0 ]; then
    echo "❌ Prisma Client 生成失败"
    echo "正在恢复备份..."
    mv prisma/schema.prisma.backup prisma/schema.prisma
    mv .env.backup .env
    exit 1
fi

echo ""
echo "正在创建数据库表..."
npx prisma migrate dev --name init_sqlite

if [ $? -ne 0 ]; then
    echo "❌ 数据库迁移失败"
    echo "正在恢复备份..."
    mv prisma/schema.prisma.backup prisma/schema.prisma
    mv .env.backup .env
    exit 1
fi

echo ""
echo "================================================"
echo "✅ 配置完成！"
echo "================================================"
echo ""
echo "数据库文件位置:"
echo "  - 用户数据: data/users.db"
echo "  - 知识图谱: data/knowledge_graph.db"
echo ""
echo "备份文件位置:"
echo "  - prisma/schema.prisma.backup"
echo "  - .env.backup"
echo ""
echo "下一步操作:"
echo "  1. 重启服务器: npm start"
echo "  2. 上传测试文档"
echo "  3. 查看知识图谱可视化"
echo ""
echo "如需恢复到 PostgreSQL:"
echo "  mv prisma/schema.prisma.backup prisma/schema.prisma"
echo "  mv .env.backup .env"
echo "  npx prisma generate"
echo ""
