# 知识图谱可视化修复说明

## 问题描述
知识图谱页面一直显示硬编码的演示数据,即使没有上传任何文档也会显示"人工智能"、"机器学习"等节点。这是因为前端组件使用了固定的演示数据,而没有从后端获取真实的知识图谱数据。

## 解决方案
添加了新的后端API端点,用于返回可视化就绪的知识图谱数据。

### 技术实现

#### 1. 后端API端点
**文件**: `routes/knowledgeGraphRoutes.js`

**端点**: `GET /api/knowledge-graph`

**功能**:
- 从数据库查询实体(entities)和关系(relations)
- 将数据转换为前端可视化所需的格式
- 支持多种过滤选项

**查询参数**:
- `minConfidence` (默认: 0.5) - 最小置信度阈值
- `maxNodes` (默认: 100) - 最大节点数量
- `entityType` (可选) - 按实体类型过滤
- `relationType` (可选) - 按关系类型过滤

**响应格式**:
```json
{
  "success": true,
  "nodes": [
    {
      "id": "entity_001",
      "label": "阿里C区_水位_2025-01",
      "type": "EventEntity",
      "confidence": 0.92
    }
  ],
  "links": [
    {
      "source": "entity_001",
      "target": "entity_002",
      "relation": "发生于",
      "confidence": 0.85
    }
  ],
  "metadata": {
    "nodeCount": 10,
    "linkCount": 15,
    "minConfidence": 0.5,
    "filters": {
      "entityType": "all",
      "relationType": "all"
    }
  }
}
```

#### 2. 前端组件
**文件**: `client/src/pages/Graph.tsx`

前端组件已经配置为调用 `/api/knowledge-graph` 端点:
- 使用 `useEffect` 在组件加载时获取数据
- 显示加载状态和错误处理
- 如果没有数据或出错,回退到演示数据
- 显示黄色提示条,告知用户当前显示的是演示数据

## 测试步骤

### 1. 验证空数据库场景
1. 打开浏览器访问 `http://localhost:5173/graph`
2. 应该看到黄色提示条: "演示数据 - 上传文档后将显示真实的知识图谱"
3. 显示默认的演示节点(人工智能、机器学习等)

### 2. 验证有数据场景
1. 上传一个文档(例如: 摄影课.md 或 影像科学PRD.md)
2. 等待文档处理完成(查看控制台日志)
3. 刷新图谱页面
4. 应该看到:
   - 黄色提示条消失
   - 显示从文档中提取的真实实体和关系
   - 节点标签显示实际的实体名称
   - 连接线显示实际的关系类型

### 3. 测试API端点
使用curl或Postman测试API:

```bash
# 获取所有图谱数据
curl -X GET "http://localhost:3000/api/knowledge-graph" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 使用过滤参数
curl -X GET "http://localhost:3000/api/knowledge-graph?minConfidence=0.7&maxNodes=50" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 按实体类型过滤
curl -X GET "http://localhost:3000/api/knowledge-graph?entityType=EventEntity" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 数据流程

```
用户上传文档
    ↓
server.js 处理上传 (/api/upload)
    ↓
document_hooks.js 触发KG构建
    ↓
kg_service.js 或 universal_document_pipeline.js
    ↓
实体和关系存储到数据库
    ↓
前端调用 GET /api/knowledge-graph
    ↓
后端查询数据库
    ↓
格式化为可视化数据
    ↓
前端Graph组件渲染
```

## 相关文件

### 后端
- `routes/knowledgeGraphRoutes.js` - API路由定义
- `kg/entity/entity_store.js` - 实体数据访问
- `kg/relation/relation_store.js` - 关系数据访问
- `kg/services/graph_traversal.js` - 图遍历工具

### 前端
- `client/src/pages/Graph.tsx` - 图谱可视化组件
- `client/src/api/client.ts` - API客户端配置

### 数据库
- `prisma/schema.prisma` - 数据模型定义
  - `KGEntity` - 实体表
  - `KGRelation` - 关系表

## 注意事项

1. **认证**: API端点需要认证token,确保用户已登录
2. **性能**: 默认限制返回100个节点,避免前端渲染过多节点导致性能问题
3. **置信度**: 默认只返回置信度≥0.5的实体和关系,可通过参数调整
4. **空数据**: 如果数据库中没有实体,API会返回空数组,前端会显示演示数据

## 后续优化建议

1. **增量更新**: 实现WebSocket或轮询,实时更新图谱数据
2. **布局算法**: 在后端计算节点位置,使用力导向布局算法
3. **缓存**: 对图谱数据进行缓存,提高响应速度
4. **分页**: 实现图谱数据分页加载,支持大规模图谱
5. **交互**: 添加节点点击、缩放、搜索等交互功能
6. **导出**: 支持导出图谱为图片或JSON格式

## 提交信息
- Commit: c13d9bf
- Branch: KnowlegeGraghpy
- Date: 2026-02-04
