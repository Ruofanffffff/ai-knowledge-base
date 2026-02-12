# 问题诊断总结

## 问题 1: 文件上传 - 重复检测和进度显示

### 状态: ✅ 已修复（需要测试）

### 问题描述
1. 上传重复文件时，前端没有显示重复检测模态框
2. 上传文件时没有显示进度条、速度和预计时间

### 根本原因
1. **重复检测响应格式不匹配**: 后端返回 `duplicate: true`，但前端只检查 `isDuplicate` 字段
2. **缺少调试日志**: 无法确认上传进度功能是否正常工作

### 已实施的修复

#### 修复 1: 响应格式兼容性（`client/src/pages/DocumentsList.tsx` 第 210 行）
```typescript
// 同时支持 isDuplicate 和 duplicate 字段
const isDuplicate = (response as any).isDuplicate || (response.data && (response.data as any).duplicate);
if (isDuplicate && response.data) {
  // 显示重复检测模态框
}
```

#### 修复 2: 添加详细调试日志
在整个上传流程中添加了 console.log：
- 文件上传开始
- 进度更新（百分比、速度、预计时间）
- 响应数据
- 重复检测确认

### 测试步骤

1. **打开浏览器控制台**（F12 → Console 标签）

2. **测试正常上传**:
   - 上传一个新文件
   - 观察控制台日志：
     ```
     [Upload] 开始上传文件: {name: "test.txt", size: 1234, type: "text/plain"}
     [Upload] 进度更新: {fileName: "test.txt", progress: 25, speed: 102400, estimatedTime: 3}
     [Upload] 收到响应: {success: true, data: {...}}
     ```
   - 检查页面右下角是否显示上传面板
   - 确认进度条、速度和时间显示正常

3. **测试重复文件上传**:
   - 上传一个已存在的文件（相同内容或相同文件名）
   - 观察控制台日志：
     ```
     [Upload] 检测到重复文件: {fileName: "test.txt", duplicateType: "content", existingFile: {...}}
     [Upload] 重复检测模态框应该显示
     ```
   - 确认重复检测模态框弹出
   - 测试三个操作按钮：
     - 覆盖现有文件
     - 保存为新文件
     - 取消上传

4. **如果问题仍然存在**:
   - 复制控制台的完整日志
   - 检查 Network 标签中的 `/api/documents/upload` 请求和响应
   - 提供详细的错误信息

---

## 问题 2: 知识图谱可视化混乱

### 状态: ⚠️ 需要修复

### 问题描述
用户上传了两个文档，但知识图谱显示非常混乱，有很多无关的节点，看不到上传文档的知识图谱。

### 诊断结果

#### 数据库架构
系统使用两个数据库：
1. **SQLite** (`data/users.db`) - 存储用户数据和文档元数据
2. **PostgreSQL** (通过 Prisma) - 存储知识图谱数据（实体和关系）

#### 当前状态
```
✅ SQLite 数据库:
   - 3 个文档已上传
   - 文档 1: test-file.txt (89 bytes)
   - 文档 2: 20210824海南省海口市美兰机场智慧防疫项目测试方案.docx (2.1 MB)
   - 文档 3: 美兰机场商汤科技联合创新协议暨第一阶段方案（初稿）.docx (743 KB)

❌ PostgreSQL 数据库:
   - 0 个文档
   - 0 个实体
   - 0 个关系
```

### 根本原因

**文档没有同步到 PostgreSQL 数据库！**

虽然 `server.js` 在文档上传后调用了 `onDocumentCreated` 钩子，但知识图谱构建失败了。可能的原因：

1. **PostgreSQL 连接问题**: 数据库可能没有运行或连接失败
2. **文档处理失败**: 知识图谱构建过程中出现错误
3. **异步处理问题**: 钩子是异步执行的，错误可能被忽略了

### 解决方案

#### 方案 1: 检查 PostgreSQL 数据库状态

```bash
# 检查 PostgreSQL 是否运行
ps aux | grep postgres

# 如果没有运行，启动 PostgreSQL
# macOS (使用 Homebrew):
brew services start postgresql

# 或者使用 Docker:
docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```

#### 方案 2: 检查服务器日志

查看服务器启动日志，确认：
1. PostgreSQL 连接是否成功
2. 知识图谱构建是否有错误

```bash
# 查看最近的服务器日志
# 在 Kiro 中运行：
# 查看进程输出（进程 ID 11）
```

#### 方案 3: 手动触发知识图谱构建

创建一个脚本来手动触发已上传文档的知识图谱构建：

```javascript
// rebuild-kg-for-documents.js
const { PrismaClient } = require('@prisma/client');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { onDocumentCreated } = require('./kg/hooks/document_hooks');

const prisma = new PrismaClient();
const sqliteDb = new sqlite3.Database(path.join(__dirname, 'data', 'users.db'));

async function rebuildKG() {
  // 1. 从 SQLite 获取所有文档
  sqliteDb.all('SELECT * FROM documents ORDER BY created_at DESC', async (err, docs) => {
    if (err) {
      console.error('Error fetching documents:', err);
      return;
    }

    console.log(`找到 ${docs.length} 个文档，开始构建知识图谱...`);

    // 2. 为每个文档触发知识图谱构建
    for (const doc of docs) {
      console.log(`\n处理文档: ${doc.title}`);
      
      const document = {
        id: doc.id.toString(),
        title: doc.title,
        content: doc.content,
        type: doc.type,
        fileType: doc.file_type,
        metadata: doc.metadata ? JSON.parse(doc.metadata) : {},
      };

      try {
        const result = await onDocumentCreated(document, { 
          async: false,  // 同步执行，等待完成
          skipIfExists: false 
        });
        console.log(`✅ 成功:`, result);
      } catch (error) {
        console.error(`❌ 失败:`, error.message);
      }
    }

    sqliteDb.close();
    await prisma.$disconnect();
  });
}

rebuildKG().catch(console.error);
```

#### 方案 4: 前端添加文档过滤功能

即使知识图谱数据很多，也可以通过前端过滤来只显示特定文档的实体和关系。

修改 `client/src/hooks/useGraph.ts`:

```typescript
// 添加 documentId 参数
export function useGraph(documentId?: string) {
  const { data, loading, error, refetch } = useApiData(
    () => apiService.getGraphData(documentId),  // 传递 documentId
    [documentId]
  );
  // ...
}
```

修改 `client/src/services/api.ts`:

```typescript
async getGraphData(documentId?: string): Promise<ApiResponse<GraphData>> {
  try {
    // 添加 documentId 查询参数
    const url = documentId 
      ? `/knowledge-graph?documentId=${documentId}`
      : '/knowledge-graph';
    
    const response = await apiClient.get(url);
    // ...
  }
}
```

修改后端 `routes/knowledgeGraphRoutes.js`:

```javascript
router.get('/', async (req, res) => {
  try {
    const { documentId } = req.query;
    
    // 如果提供了 documentId，只返回该文档的实体和关系
    const whereClause = documentId ? { documentId } : {};
    
    const entities = await prisma.kGEntity.findMany({
      where: whereClause
    });
    
    const relations = await prisma.kGRelation.findMany({
      where: whereClause
    });
    
    // ...
  }
});
```

### 推荐的行动步骤

1. **立即**: 检查 PostgreSQL 是否运行
2. **然后**: 查看服务器日志，确认知识图谱构建错误
3. **如果需要**: 运行手动重建脚本
4. **长期**: 实现前端文档过滤功能

---

## 相关文件

### 问题 1 (上传)
- `client/src/pages/DocumentsList.tsx` - 前端上传逻辑（已修改）
- `client/src/services/api.ts` - API 服务
- `client/src/components/DuplicateDetectionModal.tsx` - 重复检测模态框
- `server.js` - 后端上传处理（handleFileUpload 函数，第 837 行）
- `UPLOAD_DEBUGGING_GUIDE.md` - 详细调试指南

### 问题 2 (知识图谱)
- `kg/hooks/document_hooks.js` - 文档钩子
- `kg/services/kg_service.js` - 知识图谱服务
- `routes/knowledgeGraphRoutes.js` - 知识图谱 API
- `client/src/hooks/useGraph.ts` - 前端图谱数据获取
- `prisma/schema.prisma` - 数据库模式
- `diagnose-kg-postgres.js` - PostgreSQL 诊断脚本（已创建）

---

## 下一步

请告诉我：
1. 上传功能测试结果如何？是否看到了调试日志和进度显示？
2. 是否需要我创建手动重建知识图谱的脚本？
3. 是否需要我实现前端文档过滤功能？
