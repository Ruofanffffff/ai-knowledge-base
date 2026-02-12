# 知识图谱API文档

## 概述

本文档描述了知识图谱API的使用方法。新的API架构实现了文档服务与知识图谱服务的完全分离，提供了更灵活的控制和更好的性能。

## 核心概念

### 服务分离

- **文档服务**: 负责文档的上传、保存和管理
- **知识图谱服务**: 负责从数据库读取文档并构建知识图谱

### 数据流向

```
前端 → 文档服务 → 数据库 → KG服务（拉取数据）→ 构建图谱 → 返回前端
```

### 配置开关

通过环境变量 `AUTO_BUILD_KG` 控制是否自动构建：

- `AUTO_BUILD_KG=false` (默认): 需要手动调用API触发构建
- `AUTO_BUILD_KG=true`: 文档创建/更新/删除时自动触发构建

## API端点

### 1. 触发单个文档KG构建

**端点**: `POST /api/kg/build`

**认证**: 需要

**请求体**:
```json
{
  "docId": "string (必需)",
  "options": {
    "force": false,  // 是否强制重建
    "async": true    // 是否异步执行
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "docId": "doc123",
    "status": "queued",
    "queuePosition": 2,
    "message": "KG build queued successfully"
  }
}
```

**示例**:
```bash
curl -X POST http://localhost:3000/api/kg/build \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"docId": "doc123"}'
```

---

### 2. 批量构建KG

**端点**: `POST /api/kg/build/batch`

**认证**: 需要

**请求体**:
```json
{
  "docIds": ["doc1", "doc2", "doc3"],
  "options": {
    "concurrency": 3  // 并发数
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "total": 3,
    "successCount": 3,
    "failureCount": 0,
    "results": [
      {
        "success": true,
        "docId": "doc1",
        "status": "queued"
      }
    ]
  }
}
```

**示例**:
```bash
curl -X POST http://localhost:3000/api/kg/build/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"docIds": ["doc1", "doc2", "doc3"]}'
```

---

### 3. 查询构建状态

**端点**: `GET /api/kg/status/:docId`

**认证**: 需要

**查询参数**:
- `detailed`: boolean (可选) - 是否返回详细信息，包含进度

**响应**:
```json
{
  "success": true,
  "data": {
    "docId": "doc123",
    "status": "building",
    "progress": 75,
    "currentStage": "building",
    "entityCount": 10,
    "relationCount": 15,
    "queuePosition": null,
    "estimatedTimeRemaining": 5000
  }
}
```

**状态值**:
- `pending`: 等待开始
- `queued`: 已加入队列
- `building`: 正在构建
- `completed`: 构建完成
- `failed`: 构建失败

**示例**:
```bash
# 基本状态查询
curl http://localhost:3000/api/kg/status/doc123 \
  -H "Authorization: Bearer YOUR_TOKEN"

# 详细状态查询
curl "http://localhost:3000/api/kg/status/doc123?detailed=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 4. 删除KG

**端点**: `DELETE /api/kg/:docId`

**认证**: 需要

**响应**:
```json
{
  "success": true,
  "data": {
    "docId": "doc123",
    "deletedEntities": 10,
    "deletedRelations": 15
  },
  "message": "KG deleted successfully"
}
```

**示例**:
```bash
curl -X DELETE http://localhost:3000/api/kg/doc123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 5. 重建KG

**端点**: `POST /api/kg/rebuild/:docId`

**认证**: 需要

**请求体**:
```json
{
  "options": {
    "async": true
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "docId": "doc123",
    "status": "queued",
    "message": "KG rebuild initiated"
  }
}
```

**示例**:
```bash
curl -X POST http://localhost:3000/api/kg/rebuild/doc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"options": {"async": true}}'
```

---

### 6. 取消构建任务

**端点**: `POST /api/kg/cancel/:docId`

**认证**: 需要

**响应**:
```json
{
  "success": true,
  "message": "Task removed from queue"
}
```

**注意**: 只能取消队列中的任务，正在运行的任务会在当前操作完成后停止。

**示例**:
```bash
curl -X POST http://localhost:3000/api/kg/cancel/doc123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 7. 获取队列统计

**端点**: `GET /api/kg/queue/stats`

**认证**: 需要

**响应**:
```json
{
  "success": true,
  "data": {
    "maxConcurrent": 3,
    "running": 2,
    "queued": 5,
    "total": 10,
    "runningTasks": ["doc1", "doc2"],
    "queuedTasks": ["doc3", "doc4", "doc5"]
  }
}
```

**示例**:
```bash
curl http://localhost:3000/api/kg/queue/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 8. 健康检查

**端点**: `GET /api/kg/health`

**认证**: 不需要

**响应**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "queueStats": {
      "running": 2,
      "queued": 5
    },
    "timestamp": "2025-01-15T10:00:00.000Z"
  }
}
```

**示例**:
```bash
curl http://localhost:3000/api/kg/health
```

---

## 错误处理

### 错误响应格式

```json
{
  "success": false,
  "error": "错误消息",
  "category": "error_category"
}
```

### 错误类别

- `document_not_found`: 文档不存在
- `document_invalid`: 文档无效（缺少必要字段）
- `queue_full`: 队列已满
- `timeout`: 构建超时
- `system_error`: 系统错误

### HTTP状态码

- `200`: 成功
- `400`: 请求参数错误
- `401`: 未认证
- `404`: 资源不存在
- `500`: 服务器错误

---

## 使用场景

### 场景1: 上传文档后手动触发KG构建

```javascript
// 1. 上传文档
const uploadResponse = await fetch('/api/notes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    title: '我的文档',
    content: '文档内容...'
  })
});

const { id: docId } = await uploadResponse.json();

// 2. 触发KG构建
const buildResponse = await fetch('/api/kg/build', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ docId })
});

// 3. 轮询查询状态
const checkStatus = async () => {
  const statusResponse = await fetch(`/api/kg/status/${docId}?detailed=true`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { data } = await statusResponse.json();
  
  if (data.status === 'completed') {
    console.log('KG构建完成！');
  } else if (data.status === 'failed') {
    console.error('KG构建失败');
  } else {
    // 继续轮询
    setTimeout(checkStatus, 2000);
  }
};

checkStatus();
```

### 场景2: 批量构建多个文档的KG

```javascript
const docIds = ['doc1', 'doc2', 'doc3', 'doc4', 'doc5'];

// 批量触发构建
const response = await fetch('/api/kg/build/batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    docIds,
    options: { concurrency: 3 }
  })
});

const { data } = await response.json();
console.log(`成功: ${data.successCount}, 失败: ${data.failureCount}`);
```

### 场景3: 监控队列状态

```javascript
// 定期查询队列统计
setInterval(async () => {
  const response = await fetch('/api/kg/queue/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { data } = await response.json();
  
  console.log(`队列状态: ${data.running}个运行中, ${data.queued}个等待中`);
}, 5000);
```

---

## 性能考虑

### 并发控制

- 默认最大并发: 3个任务
- 可通过 `KG_MAX_CONCURRENT` 环境变量调整
- 超过并发限制的任务会自动加入队列

### 超时设置

- 默认构建超时: 5分钟
- 可通过 `KG_BUILD_TIMEOUT` 环境变量调整

### 队列管理

- 默认队列最大长度: 100
- 可通过 `KG_QUEUE_MAX_LENGTH` 环境变量调整
- 队列满时会拒绝新任务

---

## 配置参考

在 `.env` 文件中配置：

```bash
# 自动构建开关 (默认false)
AUTO_BUILD_KG=false

# KG服务启用开关
KG_SERVICE_ENABLED=true

# 最大并发构建数
KG_MAX_CONCURRENT=3

# 构建超时时间 (毫秒)
KG_BUILD_TIMEOUT=300000

# 启用构建队列
KG_ENABLE_QUEUE=true

# 队列最大长度
KG_QUEUE_MAX_LENGTH=100
```

---

## 迁移指南

参见 [KG_MIGRATION_GUIDE.md](./KG_MIGRATION_GUIDE.md) 了解如何从旧架构迁移到新架构。

---

## 常见问题

### Q: 为什么我的文档上传后没有自动构建KG？

A: 默认情况下 `AUTO_BUILD_KG=false`，需要手动调用 `POST /api/kg/build` 触发构建。如果希望自动构建，请设置 `AUTO_BUILD_KG=true`。

### Q: 如何知道KG构建是否完成？

A: 使用 `GET /api/kg/status/:docId` 查询状态，当 `status` 为 `completed` 时表示完成。

### Q: 构建失败了怎么办？

A: 查询状态时会返回 `errorMessage` 和 `errorCategory`，根据错误信息排查问题。可以使用 `POST /api/kg/rebuild/:docId` 重新构建。

### Q: 可以取消正在运行的构建吗？

A: 可以调用 `POST /api/kg/cancel/:docId`，但正在运行的任务会在当前操作完成后才停止。队列中的任务会立即取消。

### Q: 队列满了怎么办？

A: 可以等待队列中的任务完成，或者调整 `KG_QUEUE_MAX_LENGTH` 增加队列容量。

---

## 技术支持

如有问题，请查看：
- [设计文档](../.kiro/specs/kg-api-separation/design.md)
- [需求文档](../.kiro/specs/kg-api-separation/requirements.md)
- [迁移指南](./KG_MIGRATION_GUIDE.md)
