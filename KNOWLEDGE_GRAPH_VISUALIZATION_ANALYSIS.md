# 知识图谱可视化实现分析

## 概述

本文档分析了当前项目中知识图谱的可视化输出实现机制，确认了数据流向和组件关系。

## 核心结论

**是的，知识图谱的可视化输出是通过 `routes/knowledgeGraphRoutes.js` 实现的。**

完整的数据流如下：

```
后端数据层 (Prisma DB)
    ↓
KG 核心模块 (kg/*)
    ↓
API 路由层 (routes/knowledgeGraphRoutes.js)
    ↓
前端可视化组件 (client/src/pages/KnowledgeGraph/*.tsx)
```

---

## 详细实现分析

### 1. 后端 API 路由 (`routes/knowledgeGraphRoutes.js`)

#### 主要端点

**实体相关：**
- `GET /api/knowledge-graph/entities` - 获取所有实体
- `GET /api/knowledge-graph/entities/:id` - 获取单个实体
- `GET /api/knowledge-graph/entities/search` - 搜索实体

**关系相关：**
- `GET /api/knowledge-graph/relations` - 获取所有关系
- `GET /api/knowledge-graph/relations/:id` - 获取单个关系

**CKB 相关：**
- `GET /api/knowledge-graph/ckb` - 获取所有 CKB
- `GET /api/knowledge-graph/ckb/:id` - 获取单个 CKB
- `GET /api/knowledge-graph/ckb/document/:docId` - 获取文档的所有 CKB

**图遍历相关：**
- `POST /api/knowledge-graph/traverse` - 图遍历
- `GET /api/knowledge-graph/neighbors/:id` - 获取邻居节点
- `GET /api/knowledge-graph/path/:sourceId/:targetId` - 查找路径
- `GET /api/knowledge-graph/subgraph/:id` - 获取子图

#### 数据来源

路由层调用以下核心模块：
- `kg/entity/entity_store.js` - 实体存储
- `kg/relation/relation_store.js` - 关系存储
- `kg/ckb/ckb_store.js` - CKB 存储
- `kg/services/kg_service.js` - 知识图谱服务
- `kg/services/graph_traversal.js` - 图遍历服务

### 2. 前端可视化组件

#### 2.1 SchemaKG.tsx - Schema 驱动知识图谱可视化

**位置：** `client/src/pages/KnowledgeGraph/SchemaKG.tsx`

**功能：**
- 使用 D3.js 力导向图可视化知识图谱
- 显示实体节点和关系边
- 支持交互式操作（拖拽、缩放、点击）
- 提供过滤控制（置信度、实体类型、关系类型）

**数据获取：**
```typescript
// 获取实体数据
const entitiesResponse = await fetch(
  `/api/knowledge-graph/entities?minConfidence=${confidenceThreshold}`
);
const entitiesData = await entitiesResponse.json();

// 获取关系数据
const relationsResponse = await fetch(
  `/api/knowledge-graph/relations?minConfidence=${confidenceThreshold}`
);
const relationsData = await relationsResponse.json();
```

**可视化特性：**
- 节点大小：根据置信度动态调整
- 节点颜色：根据实体类型区分
- 连线颜色：根据关系类型区分（内建/共现/语义）
- 连线粗细：根据关系权重调整
- 交互：支持拖拽、缩放、节点点击查看详情

**实体类型颜色映射：**
- EventEntity (事件实体): #1890ff (蓝色)
- LocationEntity (位置实体): #52c41a (绿色)
- ObservationEntity (观测实体): #faad14 (橙色)
- ResearchEntity (科研实体): #f5222d (红色)
- TravelEntity (旅行实体): #722ed1 (紫色)
- PhotographyEntity (摄影实体): #13c2c2 (青色)

**关系类型颜色映射：**
- builtin (内建关系): #1890ff (蓝色)
- co_occurrence (共现关系): #52c41a (绿色)
- semantic (语义关系): #722ed1 (紫色)

#### 2.2 CKBExplorer.tsx - CKB 浏览器

**位置：** `client/src/pages/KnowledgeGraph/CKBExplorer.tsx`

**功能：**
- 浏览和搜索 CKB（最小事实单元）
- 按源类型过滤（PDF、Word、Excel 等）
- 显示 CKB 详细信息（源文档、置信度、内容等）
- 支持跳转到源文档

**数据获取：**
```typescript
const response = await fetch('/api/knowledge-graph/ckb');
const data = await response.json();
```

### 3. 服务器配置 (`server.js`)

**路由注册：**
```javascript
// 知识图谱路由
const knowledgeGraphRoutes = require('./routes/knowledgeGraphRoutes');
app.use('/api/knowledge-graph', knowledgeGraphRoutes);
```

**静态文件服务：**
```javascript
// 提供 client 目录下的静态文件服务（用于 React 应用）
app.use(express.static(path.join(__dirname, 'client')));
```

### 4. 数据存储层

**Prisma 数据库模型：**
- `CKB` - 最小事实单元
- `Entity` - 实体
- `Relation` - 关系
- `Schema` - Schema 定义
- `FieldDistribution` - 字段分布统计

---

## 完整数据流示例

### 场景：用户查看知识图谱可视化

1. **用户访问前端页面**
   - 访问 `/knowledge-graph` 路由
   - React 应用加载 `SchemaKG.tsx` 组件

2. **前端请求数据**
   ```typescript
   // 请求实体
   GET /api/knowledge-graph/entities?minConfidence=0.6
   
   // 请求关系
   GET /api/knowledge-graph/relations?minConfidence=0.6
   ```

3. **后端处理请求**
   ```javascript
   // routes/knowledgeGraphRoutes.js
   router.get('/entities', async (req, res) => {
     const { minConfidence } = req.query;
     
     // 调用实体存储模块
     const entities = await entityStore.getEntities({
       minConfidence: parseFloat(minConfidence) || 0.6
     });
     
     res.json({
       success: true,
       entities: entities
     });
   });
   ```

4. **数据库查询**
   ```javascript
   // kg/entity/entity_store.js
   const entities = await prisma.entity.findMany({
     where: {
       confidence: { gte: minConfidence }
     },
     include: {
       schemas: true,
       attributes: true
     }
   });
   ```

5. **返回数据格式**
   ```json
   {
     "success": true,
     "entities": [
       {
         "id": "entity_001",
         "canonical_name": "React",
         "type": "TechnologyEntity",
         "confidence": 0.95,
         "schemas": [
           {
             "schema_name": "Technology",
             "confidence": 0.92
           }
         ],
         "attributes": {
           "category": "JavaScript库",
           "developer": "Facebook"
         }
       }
     ]
   }
   ```

6. **前端渲染可视化**
   - D3.js 创建力导向图
   - 节点表示实体
   - 连线表示关系
   - 支持交互操作

---

## 关键技术栈

### 后端
- **Express.js** - Web 框架
- **Prisma** - ORM 数据库访问
- **SQLite** - 数据库
- **KG 核心模块** - 知识图谱构建逻辑

### 前端
- **React** - UI 框架
- **TypeScript** - 类型安全
- **D3.js** - 数据可视化
- **Ant Design** - UI 组件库

### 可视化
- **D3.js Force Layout** - 力导向图布局
- **D3.js Zoom** - 缩放交互
- **D3.js Drag** - 拖拽交互

---

## 验证方法

### 1. 检查 API 端点

```bash
# 获取实体列表
curl http://localhost:3000/api/knowledge-graph/entities

# 获取关系列表
curl http://localhost:3000/api/knowledge-graph/relations

# 获取 CKB 列表
curl http://localhost:3000/api/knowledge-graph/ckb
```

### 2. 检查前端组件

- 打开浏览器开发者工具
- 访问知识图谱页面
- 查看 Network 标签，确认 API 请求
- 查看 Console 标签，确认数据加载

### 3. 检查数据库

```bash
# 使用 Prisma Studio 查看数据
npx prisma studio

# 或直接查询数据库
sqlite3 prisma/knowledge-base.db
SELECT COUNT(*) FROM Entity;
SELECT COUNT(*) FROM Relation;
SELECT COUNT(*) FROM CKB;
```

---

## 总结

1. **知识图谱可视化完全通过 `routes/knowledgeGraphRoutes.js` 实现**
2. **数据流清晰：数据库 → API 路由 → 前端组件**
3. **前端使用 D3.js 进行交互式可视化**
4. **支持多种过滤和交互功能**
5. **架构设计良好，职责分离明确**

用户看到的图谱可视化（显示 Facebook、React、JavaScript库 等节点）正是通过这套完整的系统实现的。

---

## 补充说明：关于"雪亮工程"数据

用户提到看到了"雪亮工程"相关的实体，这些数据来自于上传的文档：

**文档来源：** `uploads/1770173245879-雪亮工程建设整体解决方案.docx`

**文档内容：** 这是一个关于基层治安综合治理的完整解决方案文档，包含：
- 视频监控子系统
- 人员出入口子系统
- 车辆出入口子系统
- 人脸抓拍子系统
- 车辆抓拍子系统
- 信息卡口子系统
- 报警联防子系统
- 移动巡防子系统
- 信息发布子系统

**数据处理流程：**
1. 用户上传 Word 文档 → `POST /api/upload`
2. 服务器解析文档内容 → `server.js` 文件上传处理
3. 触发知识图谱构建 → `onDocumentCreated()` 钩子
4. Universal Document Pipeline 处理文档：
   - CKB Parser 解析文档为最小事实单元
   - Field Extractor 提取字段信息
   - Schema Matcher 匹配合适的 Schema
   - Entity Builder 构建实体（如"雪亮工程"、"视频监控系统"等）
   - Relation Builder 构建关系
5. 实体和关系存储到数据库
6. 前端通过 API 获取并可视化展示

**实体示例：**
从"雪亮工程建设整体解决方案"文档中提取的实体可能包括：
- 系统实体：视频监控子系统、人员出入口子系统、车辆出入口子系统
- 技术实体：人脸识别、车牌识别、物联网
- 场所实体：综治中心、村（社区）、重点场所
- 概念实体：治安防控、社会管理、服务民生

这些实体通过知识图谱系统自动提取、规范化、构建关系后，在前端可视化界面中以节点和连线的形式展示出来。
