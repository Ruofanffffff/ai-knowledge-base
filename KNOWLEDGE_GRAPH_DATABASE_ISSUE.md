# 知识图谱数据库问题诊断报告

## 问题根源

您的系统配置了**两个独立的数据库**：

### 1. SQLite 数据库 (`data/users.db`)
- **用途**: 存储用户数据、文档列表
- **状态**: ✅ 正常运行
- **包含的表**: users, documents, user_sessions, token_usage 等
- **文档数据**: 已成功存储 3 个文档

### 2. PostgreSQL 数据库 (Prisma)
- **用途**: 存储知识图谱数据 (CKB, 实体, 关系)
- **状态**: ❌ 未运行（开发阶段未安装）
- **配置**: `.env` 中配置为 `postgresql://postgres:postgres@localhost:5432/knowledge_base`
- **依赖模块**: 
  - `kg/ckb/ckb_store.js` - 使用 `@prisma/client`
  - `kg/entity/entity_store.js` - 使用 `@prisma/client`
  - `kg/relation/relation_store.js` - 使用 `@prisma/client`

## 为什么知识图谱没有生成？

当您上传文档时：
1. ✅ 文档成功保存到 SQLite (`data/users.db`)
2. ✅ 系统调用 `kg/hooks/document_hooks.js` 的 `onDocumentCreated()`
3. ❌ 知识图谱模块尝试连接 PostgreSQL 数据库
4. ❌ PostgreSQL 未运行，连接失败
5. ❌ CKB、实体、关系无法保存
6. ❌ 知识图谱可视化界面显示空白或混乱

## 解决方案

您有三个选择：

### 方案 1: 安装 PostgreSQL（推荐用于生产环境）

```bash
# macOS 安装 PostgreSQL
brew install postgresql@14
brew services start postgresql@14

# 创建数据库
createdb knowledge_base

# 运行 Prisma 迁移
npx prisma migrate deploy
npx prisma generate
```

### 方案 2: 使用 SQLite 适配器（推荐用于开发环境）

修改 Prisma 配置使用 SQLite：

**步骤 1**: 修改 `prisma/schema.prisma`
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:../data/knowledge_graph.db"
}
```

**步骤 2**: 修改 `.env`
```bash
DATABASE_URL="file:./data/knowledge_graph.db"
```

**步骤 3**: 重新生成 Prisma Client 并迁移
```bash
npx prisma generate
npx prisma migrate dev --name init_sqlite
```

### 方案 3: 使用 Docker 运行 PostgreSQL（快速测试）

```bash
# 启动 PostgreSQL 容器
docker run -d \
  --name postgres-kg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=knowledge_base \
  -p 5432:5432 \
  postgres:14

# 运行 Prisma 迁移
npx prisma migrate deploy
npx prisma generate
```

## 推荐方案

**对于您的开发阶段，我强烈推荐方案 2（SQLite 适配器）**，原因：
- ✅ 无需安装额外软件
- ✅ 数据库文件本地存储，便于备份
- ✅ 与现有 SQLite 用户数据库一致
- ✅ 开发调试更简单
- ✅ 后续迁移到 PostgreSQL 很容易（Prisma 支持）

## 下一步操作

请告诉我您选择哪个方案，我将帮您完成配置和测试。

配置完成后，我们将：
1. 重新上传测试文档
2. 验证知识图谱生成
3. 检查可视化界面显示

## 附加信息

### 当前文档列表
```
1. test-file.txt (89 bytes)
2. 20210824海南省海口市美兰机场智慧防疫项目测试方案.docx (2.1 MB)
3. 美兰机场商汤科技联合创新协议暨第一阶段方案（初稿）.docx (743 KB)
```

这些文档已保存在 SQLite，但知识图谱数据未生成。
