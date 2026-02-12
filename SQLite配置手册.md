# SQLite 配置手册

## 方法 1: 自动配置（推荐）

运行自动配置脚本：

```bash
./switch-to-sqlite.sh
```

脚本会自动完成所有配置步骤。

---

## 方法 2: 手动配置

如果自动脚本失败，请按照以下步骤手动配置：

### 步骤 1: 修改 Prisma Schema

打开文件 `prisma/schema.prisma`，找到第 7-9 行：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

修改为：

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:../data/knowledge_graph.db"
}
```

### 步骤 2: 修改环境变量

打开文件 `.env`，找到第 8 行：

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/knowledge_base?schema=public"
```

修改为：

```bash
DATABASE_URL="file:./data/knowledge_graph.db"
```

### 步骤 3: 生成 Prisma Client

在终端运行：

```bash
npx prisma generate
```

等待命令完成，应该看到：

```
✔ Generated Prisma Client (5.x.x) to ./node_modules/@prisma/client
```

### 步骤 4: 创建数据库表

在终端运行：

```bash
npx prisma migrate dev --name init_sqlite
```

这个命令会：
1. 创建 `data/knowledge_graph.db` 文件
2. 创建所有必需的表（CKB、实体、关系等）
3. 生成迁移记录

### 步骤 5: 重启服务器

1. 停止当前服务器（按 Ctrl+C）
2. 重新启动：

```bash
npm start
```

---

## 验证配置

### 检查数据库文件

运行以下命令检查数据库文件是否创建：

```bash
ls -lh data/
```

应该看到：
```
-rw-r--r--  1 user  staff   xxx KB  knowledge_graph.db
-rw-r--r--  1 user  staff   xxx KB  users.db
```

### 检查数据库表

运行以下命令查看表结构：

```bash
sqlite3 data/knowledge_graph.db ".tables"
```

应该看到类似输出：
```
Alert                    DocumentStructure        KGTokenUsage
Attachment               Entity                   Note
AttachmentAnalysis       EntityRelation           ProcessingMonitor
AttachmentType           FieldDistribution        RelationType
Backup                   FilterRule               Schema
CKB                      KGEntity                 SearchHistory
Document                 KGRelation               SegmentProcessing
DocumentEntity           _prisma_migrations       Setting
DocumentTag                                       Tag
                                                  User
                                                  ValidationReport
```

### 测试知识图谱生成

1. 打开浏览器，访问应用
2. 上传一个测试文档（建议使用小文件，如 .txt）
3. 等待 10-30 秒
4. 打开知识图谱可视化界面
5. 应该能看到生成的实体和关系

---

## 常见问题

### 问题 1: `npx prisma generate` 失败

**错误信息**:
```
Error: Generator "client" failed:
```

**解决方法**:
```bash
# 清理 node_modules
rm -rf node_modules
npm install

# 重新生成
npx prisma generate
```

### 问题 2: `npx prisma migrate dev` 失败

**错误信息**:
```
Error: P1003: Database does not exist
```

**解决方法**:
```bash
# 确保 data 目录存在
mkdir -p data

# 重新运行迁移
npx prisma migrate dev --name init_sqlite
```

### 问题 3: 服务器启动后仍然连接 PostgreSQL

**症状**: 看到错误日志 "Can't reach database server at localhost:5432"

**解决方法**:
1. 确认 `.env` 文件已修改
2. 完全停止服务器（Ctrl+C）
3. 清理缓存：`rm -rf .cache`
4. 重新启动：`npm start`

### 问题 4: 知识图谱仍然不显示

**检查步骤**:

1. **检查数据库文件是否存在**:
```bash
ls -lh data/knowledge_graph.db
```

2. **检查是否有数据**:
```bash
sqlite3 data/knowledge_graph.db "SELECT COUNT(*) FROM CKB;"
sqlite3 data/knowledge_graph.db "SELECT COUNT(*) FROM KGEntity;"
sqlite3 data/knowledge_graph.db "SELECT COUNT(*) FROM KGRelation;"
```

3. **检查服务器日志**:
查找类似日志：
```
[KG Hook] 文档创建钩子触发: xxx
[KG Hook] 文档 xxx 的知识图谱构建完成
```

4. **重新上传文档**:
删除旧文档，上传新文档，观察日志

---

## 恢复到 PostgreSQL

如果需要切换回 PostgreSQL：

### 方法 1: 使用备份文件

```bash
mv prisma/schema.prisma.backup prisma/schema.prisma
mv .env.backup .env
npx prisma generate
```

### 方法 2: 手动修改

1. 修改 `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. 修改 `.env`:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/knowledge_base?schema=public"
```

3. 重新生成：
```bash
npx prisma generate
```

---

## 数据迁移

### 从 SQLite 迁移到 PostgreSQL

当您准备部署到生产环境时：

1. **安装 PostgreSQL**
2. **修改配置文件**（参考上面的"恢复到 PostgreSQL"）
3. **运行迁移**:
```bash
npx prisma migrate deploy
```

4. **导出 SQLite 数据**（可选）:
```bash
# 导出为 SQL
sqlite3 data/knowledge_graph.db .dump > kg_backup.sql

# 手动导入到 PostgreSQL（需要调整 SQL 语法）
```

---

## 性能对比

| 特性 | SQLite | PostgreSQL |
|------|--------|------------|
| 安装难度 | ⭐⭐⭐⭐⭐ 无需安装 | ⭐⭐⭐ 需要安装 |
| 配置难度 | ⭐⭐⭐⭐⭐ 非常简单 | ⭐⭐⭐ 需要配置 |
| 开发体验 | ⭐⭐⭐⭐⭐ 本地文件 | ⭐⭐⭐⭐ 需要服务 |
| 并发性能 | ⭐⭐⭐ 适合单用户 | ⭐⭐⭐⭐⭐ 适合多用户 |
| 数据量 | ⭐⭐⭐⭐ < 1GB | ⭐⭐⭐⭐⭐ 无限制 |
| 生产环境 | ⭐⭐⭐ 小型应用 | ⭐⭐⭐⭐⭐ 企业级 |

**建议**:
- 开发阶段：使用 SQLite
- 生产环境：使用 PostgreSQL

---

## 技术支持

如果遇到问题：

1. 检查服务器日志
2. 检查浏览器控制台
3. 运行诊断脚本：
```bash
node diagnose-kg-for-documents.js
```

4. 提供以下信息：
   - 错误消息
   - 服务器日志
   - 执行的命令
   - 系统环境（macOS/Linux）
