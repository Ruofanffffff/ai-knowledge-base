# 数据库迁移指南

## 概述

本指南说明如何为知识图谱构建状态追踪功能执行数据库迁移。迁移过程包括创建新的 `kg_build_status` 表和初始化现有文档的状态。

---

## 前提条件

1. **备份数据库**
   ```bash
   # SQLite 备份
   cp database.db database.db.backup
   
   # 或使用 SQLite 命令
   sqlite3 database.db ".backup database.db.backup"
   ```

2. **确认Node.js环境**
   ```bash
   node --version  # 应该是 v14 或更高版本
   ```

3. **安装依赖**
   ```bash
   cd ai-knowledge-base
   npm install
   ```

---

## 迁移步骤

### 步骤 1: 运行数据库迁移脚本

迁移脚本会创建 `kg_build_status` 表及相关索引和触发器。

```bash
cd ai-knowledge-base
node database/migrate.js
```

**预期输出:**
```
[Migration] Starting database migration...
[Migration] Running migration: 001_create_kg_build_status.sql
[Migration] Migration completed successfully
[Migration] Current schema version: 1
```

**迁移内容:**
- 创建 `kg_build_status` 表
- 创建索引: `doc_id`, `status`, `updated_at`
- 创建触发器: 自动更新 `updated_at` 字段
- 记录迁移版本

---

### 步骤 2: 初始化现有文档状态

为系统中已存在的文档创建初始状态记录。

```bash
cd ai-knowledge-base
node scripts/init-kg-status.js
```

**预期输出:**
```
[Init KG Status] Starting initialization...
[Init KG Status] Found 150 documents
[Init KG Status] Processing documents...
[Init KG Status] Created status for document 1: completed (has graph data)
[Init KG Status] Created status for document 2: pending (no graph data)
...
[Init KG Status] Initialization completed
[Init KG Status] Summary:
  - Total documents: 150
  - Completed: 120
  - Pending: 30
```

**初始化逻辑:**
- 查询所有现有文档
- 检查每个文档是否有图谱数据（entities 或 relations）
- 有图谱数据 → 状态设为 `completed`
- 无图谱数据 → 状态设为 `pending`

---

### 步骤 3: 验证迁移结果

#### 3.1 检查表结构

```bash
sqlite3 database.db
```

```sql
-- 查看表结构
.schema kg_build_status

-- 预期输出:
-- CREATE TABLE kg_build_status (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   doc_id TEXT NOT NULL UNIQUE,
--   status TEXT NOT NULL CHECK(status IN ('pending', 'building', 'completed', 'failed')),
--   error_message TEXT,
--   error_category TEXT CHECK(error_category IN ('user_error', 'system_error', 'unknown_error')),
--   entity_count INTEGER DEFAULT 0,
--   relation_count INTEGER DEFAULT 0,
--   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--   FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
-- );
```

#### 3.2 检查索引

```sql
-- 查看索引
.indexes kg_build_status

-- 预期输出:
-- idx_kg_build_status_doc_id
-- idx_kg_build_status_status
-- idx_kg_build_status_updated_at
```

#### 3.3 检查数据

```sql
-- 查看状态分布
SELECT status, COUNT(*) as count 
FROM kg_build_status 
GROUP BY status;

-- 预期输出示例:
-- status     | count
-- -----------|------
-- pending    | 30
-- completed  | 120

-- 查看示例记录
SELECT * FROM kg_build_status LIMIT 5;
```

#### 3.4 检查触发器

```sql
-- 查看触发器
.schema update_kg_build_status_timestamp

-- 测试触发器
UPDATE kg_build_status SET status = 'building' WHERE id = 1;
SELECT updated_at FROM kg_build_status WHERE id = 1;
-- updated_at 应该是当前时间
```

---

## 回滚迁移

如果迁移出现问题，可以回滚到之前的状态。

### 方法 1: 恢复备份

```bash
# 停止应用服务器
# 然后恢复备份
cp database.db.backup database.db
```

### 方法 2: 手动删除表

```bash
sqlite3 database.db
```

```sql
-- 删除触发器
DROP TRIGGER IF EXISTS update_kg_build_status_timestamp;

-- 删除索引
DROP INDEX IF EXISTS idx_kg_build_status_doc_id;
DROP INDEX IF EXISTS idx_kg_build_status_status;
DROP INDEX IF EXISTS idx_kg_build_status_updated_at;

-- 删除表
DROP TABLE IF EXISTS kg_build_status;

-- 删除迁移版本记录（如果有）
DELETE FROM schema_migrations WHERE version = '001';
```

### 方法 3: 使用回滚脚本

```bash
cd ai-knowledge-base
node database/migrate.js --rollback
```

**预期输出:**
```
[Migration] Rolling back migration: 001_create_kg_build_status.sql
[Migration] Rollback completed successfully
[Migration] Current schema version: 0
```

---

## 常见问题

### 问题 1: 迁移脚本报错 "table already exists"

**原因:** 表已经存在，可能是之前运行过迁移。

**解决方法:**
```bash
# 检查表是否存在
sqlite3 database.db "SELECT name FROM sqlite_master WHERE type='table' AND name='kg_build_status';"

# 如果表存在但数据不完整，可以删除后重新迁移
sqlite3 database.db "DROP TABLE IF EXISTS kg_build_status;"
node database/migrate.js
```

---

### 问题 2: 初始化脚本报错 "FOREIGN KEY constraint failed"

**原因:** 某些文档记录在 `documents` 表中不存在。

**解决方法:**
```sql
-- 查找孤立的实体记录
SELECT DISTINCT doc_id FROM entities 
WHERE doc_id NOT IN (SELECT id FROM documents);

-- 清理孤立记录
DELETE FROM entities WHERE doc_id NOT IN (SELECT id FROM documents);
DELETE FROM relations WHERE doc_id NOT IN (SELECT id FROM documents);

-- 重新运行初始化脚本
node scripts/init-kg-status.js
```

---

### 问题 3: 初始化后所有文档都是 "pending" 状态

**原因:** 图谱数据可能存储在不同的表中，或者表名不匹配。

**解决方法:**
```sql
-- 检查实体表
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%entit%';

-- 检查关系表
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%relat%';

-- 如果表名不同，修改 init-kg-status.js 中的表名
-- 然后重新运行初始化脚本
```

---

### 问题 4: 迁移后应用无法启动

**原因:** 可能是代码和数据库不同步。

**解决方法:**
1. 检查 `StatusManager` 类是否正确导入
2. 检查 `document_hooks.js` 是否正确集成
3. 查看应用日志获取详细错误信息
4. 如果问题严重，回滚迁移并联系开发团队

---

## 迁移验证清单

完成迁移后，请检查以下项目：

- [ ] `kg_build_status` 表已创建
- [ ] 三个索引已创建（doc_id, status, updated_at）
- [ ] 触发器已创建并正常工作
- [ ] 所有现有文档都有状态记录
- [ ] 有图谱数据的文档状态为 `completed`
- [ ] 无图谱数据的文档状态为 `pending`
- [ ] 应用服务器可以正常启动
- [ ] API端点 `/api/kg-status/:docId` 可以正常访问
- [ ] 前端可以显示文档状态

---

## 性能优化建议

### 对于大型数据库（>10000文档）

1. **分批初始化**
   
   修改 `scripts/init-kg-status.js`，添加批处理逻辑：
   
   ```javascript
   const BATCH_SIZE = 1000;
   for (let i = 0; i < documents.length; i += BATCH_SIZE) {
     const batch = documents.slice(i, i + BATCH_SIZE);
     await processBatch(batch);
     console.log(`Processed ${i + batch.length}/${documents.length} documents`);
   }
   ```

2. **使用事务**
   
   ```javascript
   await db.run('BEGIN TRANSACTION');
   try {
     // 批量插入操作
     await db.run('COMMIT');
   } catch (error) {
     await db.run('ROLLBACK');
     throw error;
   }
   ```

3. **临时禁用索引**
   
   ```sql
   -- 初始化前
   DROP INDEX idx_kg_build_status_doc_id;
   DROP INDEX idx_kg_build_status_status;
   DROP INDEX idx_kg_build_status_updated_at;
   
   -- 运行初始化脚本
   
   -- 初始化后重建索引
   CREATE INDEX idx_kg_build_status_doc_id ON kg_build_status(doc_id);
   CREATE INDEX idx_kg_build_status_status ON kg_build_status(status);
   CREATE INDEX idx_kg_build_status_updated_at ON kg_build_status(updated_at);
   ```

---

## 监控和维护

### 定期检查

```sql
-- 检查状态分布
SELECT status, COUNT(*) as count 
FROM kg_build_status 
GROUP BY status;

-- 检查长时间处于 building 状态的文档
SELECT doc_id, status, 
       ROUND((julianday('now') - julianday(updated_at)) * 24 * 60) as minutes_ago
FROM kg_build_status 
WHERE status = 'building' 
  AND updated_at < datetime('now', '-15 minutes');

-- 检查失败的文档
SELECT doc_id, error_message, error_category, updated_at
FROM kg_build_status 
WHERE status = 'failed'
ORDER BY updated_at DESC
LIMIT 10;
```

### 清理孤立记录

```sql
-- 查找没有对应文档的状态记录
SELECT doc_id FROM kg_build_status 
WHERE doc_id NOT IN (SELECT id FROM documents);

-- 删除孤立记录
DELETE FROM kg_build_status 
WHERE doc_id NOT IN (SELECT id FROM documents);
```

---

## 获取帮助

如果遇到迁移问题：

1. **查看日志文件**
   - 迁移日志: `logs/migration.log`
   - 应用日志: `logs/app.log`

2. **检查数据库完整性**
   ```bash
   sqlite3 database.db "PRAGMA integrity_check;"
   ```

3. **联系技术支持**
   - 提供错误信息
   - 提供数据库备份（如果可能）
   - 说明迁移步骤和环境信息

---

## 附录

### 迁移脚本位置

- 迁移执行器: `ai-knowledge-base/database/migrate.js`
- SQL脚本: `ai-knowledge-base/database/migrations/001_create_kg_build_status.sql`
- 初始化脚本: `ai-knowledge-base/scripts/init-kg-status.js`

### 相关文档

- [API文档](./API.md)
- [用户使用指南](./KG_STATUS_GUIDE.md)
- [故障排除指南](../KG_TROUBLESHOOTING_GUIDE.md)

### 版本历史

- **v1.0.0** (2024-01): 初始迁移，创建 kg_build_status 表
