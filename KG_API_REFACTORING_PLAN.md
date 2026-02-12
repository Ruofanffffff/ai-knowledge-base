# 知识图谱 API 重构方案

## 问题分析

### 当前问题
1. **前端缓存问题**：前端显示旧数据，即使后端已清空
   - 原因：浏览器 HTTP 缓存了 API 响应
   - 解决：需要添加缓存控制头

2. **架构混乱**：文档上传和知识图谱构建耦合在一起
   - 文档上传逻辑和知识图谱构建逻辑混在一起
   - 难以维护和扩展

### 目标架构
将知识图谱封装成统一的 API 接口，实现职责分离：
- **文档服务**：负责文档的上传、保存、查询
- **知识图谱服务**：负责从数据库拉取数据、构建知识图谱、返回结果

## 重构方案

### 1. API 设计

#### 1.1 文档 API（已存在，需优化）
```
POST   /api/documents/upload    - 上传文档
POST   /api/documents           - 创建文档
GET    /api/documents           - 获取文档列表
GET    /api/documents/:id       - 获取单个文档
PUT    /api/documents/:id       - 更新文档
DELETE /api/documents/:id       - 删除文档
```

#### 1.2 知识图谱 API（新增/重构）
```
POST   /api/kg/build/:docId     - 为指定文档构建知识图谱
GET    /api/kg/status/:docId    - 获取知识图谱构建状态
GET    /api/kg/graph/:docId     - 获取文档的知识图谱数据
POST   /api/kg/rebuild/:docId   - 重建知识图谱
DELETE /api/kg/:docId            - 删除知识图谱
```

### 2. 数据流设计

```
┌─────────────┐
│   前端      │
└──────┬──────┘
       │
       │ 1. 上传文档
       ↓
┌─────────────────────┐
│  文档服务 API       │
│  /api/documents     │
└──────┬──────────────┘
       │
       │ 2. 保存到数据库
       ↓
┌─────────────────────┐
│   数据库 (Prisma)   │
│   - Document 表     │
└──────┬──────────────┘
       │
       │ 3. 触发知识图谱构建
       ↓
┌─────────────────────┐
│  知识图谱服务 API   │
│  /api/kg/build      │
└──────┬──────────────┘
       │
       │ 4. 从数据库拉取文档
       │ 5. 构建知识图谱
       │ 6. 保存结果到数据库
       ↓
┌─────────────────────┐
│   数据库 (Prisma)   │
│   - KGEntity 表     │
│   - KGRelation 表   │
└──────┬──────────────┘
       │
       │ 7. 返回结果
       ↓
┌─────────────┐
│   前端      │
│  显示图谱   │
└─────────────┘
```

### 3. 实现步骤

#### 步骤 1：创建知识图谱服务模块
```javascript
// kg/services/kg_api_service.js
class KGAPIService {
  // 构建知识图谱
  async buildKG(docId) {
    // 1. 从数据库获取文档
    // 2. 调用现有的 KG 构建逻辑
    // 3. 保存结果到数据库
    // 4. 返回构建状态
  }

  // 获取知识图谱数据
  async getKGGraph(docId) {
    // 从数据库查询知识图谱数据
  }

  // 获取构建状态
  async getKGStatus(docId) {
    // 查询构建状态
  }

  // 重建知识图谱
  async rebuildKG(docId) {
    // 删除旧数据，重新构建
  }
}
```

#### 步骤 2：创建知识图谱路由
```javascript
// routes/kgRoutes.js
const express = require('express');
const router = express.Router();
const KGAPIService = require('../kg/services/kg_api_service');

// 构建知识图谱
router.post('/build/:docId', async (req, res) => {
  try {
    const result = await KGAPIService.buildKG(req.params.docId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取知识图谱
router.get('/graph/:docId', async (req, res) => {
  try {
    const graph = await KGAPIService.getKGGraph(req.params.docId);
    res.json(graph);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 其他路由...
```

#### 步骤 3：修改文档上传逻辑
```javascript
// routes/documentRoutes.js
router.post('/upload', async (req, res) => {
  try {
    // 1. 上传文件
    const file = req.file;
    
    // 2. 保存文档到数据库
    const document = await saveDocument(file);
    
    // 3. 异步触发知识图谱构建（不阻塞响应）
    KGAPIService.buildKG(document.id).catch(err => {
      console.error('KG build failed:', err);
    });
    
    // 4. 立即返回文档信息
    res.json(document);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### 步骤 4：添加缓存控制
```javascript
// server.js 或 middleware
app.use('/api/documents', (req, res, next) => {
  // 禁用缓存
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
```

#### 步骤 5：前端调用
```typescript
// client/src/services/api.ts
export const kgAPI = {
  // 构建知识图谱
  async buildKG(docId: string) {
    return apiClient.post(`/kg/build/${docId}`);
  },

  // 获取知识图谱
  async getGraph(docId: string) {
    return apiClient.get(`/kg/graph/${docId}`);
  },

  // 获取构建状态
  async getStatus(docId: string) {
    return apiClient.get(`/kg/status/${docId}`);
  },

  // 重建知识图谱
  async rebuildKG(docId: string) {
    return apiClient.post(`/kg/rebuild/${docId}`);
  }
};
```

### 4. 优势

1. **职责分离**：文档管理和知识图谱构建完全分离
2. **易于维护**：每个服务独立，修改不影响其他部分
3. **可扩展性**：可以轻松添加新的知识图谱功能
4. **性能优化**：文档上传不阻塞，知识图谱异步构建
5. **标准化**：统一的 API 接口，易于理解和使用

### 5. 迁移计划

#### 阶段 1：创建新 API（不影响现有功能）
- 创建 `kg_api_service.js`
- 创建 `kgRoutes.js`
- 添加缓存控制中间件

#### 阶段 2：逐步迁移现有功能
- 将现有的 KG 构建逻辑迁移到新服务
- 保持向后兼容

#### 阶段 3：前端适配
- 更新前端调用新 API
- 添加更好的状态显示

#### 阶段 4：清理旧代码
- 删除旧的耦合代码
- 更新文档

## 实施建议

1. **先解决缓存问题**：添加缓存控制头（最快）
2. **创建新 API**：不影响现有功能
3. **逐步迁移**：一个功能一个功能地迁移
4. **充分测试**：确保每个阶段都正常工作

## 下一步

1. 添加缓存控制头（立即）
2. 创建 `kg_api_service.js` 服务类
3. 创建 `kgRoutes.js` 路由
4. 更新文档上传逻辑
5. 前端适配新 API
