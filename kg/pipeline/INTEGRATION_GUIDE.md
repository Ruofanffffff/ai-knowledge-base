# Universal Document Pipeline 集成指南

本文档说明如何将 Universal Document Pipeline 集成到现有项目中，以及如何在传统模式和 Pipeline 模式之间切换。

## 集成概述

Universal Document Pipeline 已通过**渐进式集成**方式集成到项目中，具有以下特点：

✅ **向后兼容** - 保留现有的 kgService 功能，不破坏现有代码  
✅ **可选启用** - 通过环境变量控制是否使用 Pipeline 模式  
✅ **双模式支持** - 支持传统模式和 Pipeline 模式并存  
✅ **平滑迁移** - 可以逐步从传统模式迁移到 Pipeline 模式

## 集成架构

```
┌─────────────────────────────────────────────────────────────┐
│                      应用层 (Application)                     │
│  - server.js                                                 │
│  - routes/knowledgeGraphRoutes.js                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   钩子层 (Document Hooks)                    │
│  kg/hooks/document_hooks.js                                 │
│  - onDocumentCreated()                                      │
│  - onDocumentUpdated()                                      │
│  - onDocumentDeleted()                                      │
│                                                              │
│  根据 USE_PIPELINE 环境变量选择处理模式：                      │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  传统模式         │   OR    │  Pipeline 模式    │         │
│  │  (kgService)     │         │  (Pipeline)      │         │
│  └──────────────────┘         └──────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    处理层 (Processing)                       │
│                                                              │
│  传统模式:                    Pipeline 模式:                  │
│  kg/services/kg_service.js   kg/pipeline/                   │
│  - buildKnowledgeGraph()     universal_document_pipeline.js │
│  - updateKnowledgeGraph()    - processDocument()            │
│  - deleteKnowledgeGraph()    - processBatch()               │
└─────────────────────────────────────────────────────────────┘
```

## 启用 Pipeline 模式

### 方式 1: 环境变量（推荐）

在 `.env` 文件中添加：

```bash
# 启用 Pipeline 模式
USE_PIPELINE=true

# Pipeline 配置（可选）
PIPELINE_EXTRACTION_USE_LLM=false
PIPELINE_EXTRACTION_USE_NER=true
PIPELINE_EXTRACTION_USE_RULES=true
PIPELINE_NORMALIZATION_USE_LLM=false
PIPELINE_NORMALIZATION_USE_ALGORITHM=true
PIPELINE_ENTITY_USE_LLM=false
PIPELINE_ENTITY_ALLOW_PARTIAL=true
PIPELINE_RELATION_BUILTIN=true
PIPELINE_RELATION_COOCCURRENCE=true
PIPELINE_RELATION_SEMANTIC=false
```

### 方式 2: 运行时设置

```bash
# 启动服务器时设置环境变量
USE_PIPELINE=true npm start
```

### 方式 3: 代码中设置（不推荐）

```javascript
// 在 server.js 或应用入口处设置
process.env.USE_PIPELINE = 'true';
```

## 使用方式

### 1. 通过 Document Hooks（自动）

当启用 Pipeline 模式后，文档的创建、更新操作会自动使用 Pipeline 处理：

```javascript
// 创建文档时自动触发 Pipeline
const document = {
  id: 'doc-001',
  title: '测试文档',
  content: '文档内容...'
};

// 这会自动调用 onDocumentCreated，根据 USE_PIPELINE 选择处理模式
await createDocument(document);
```

**日志输出示例：**

```
[KG Hook] 文档创建钩子触发: doc-001 - 测试文档
[KG Hook] 使用Pipeline模式处理文档
[KG Hook] Pipeline 处理完成: doc-001, 状态: completed
```

### 2. 通过 API 端点（手动）

#### 处理单个文档

```bash
POST /api/knowledge-graph/pipeline/process
Content-Type: application/json

{
  "document": {
    "id": "doc-001",
    "type": "text",
    "title": "测试文档",
    "content": "文档内容..."
  },
  "options": {
    "extraction": {
      "useLLM": false
    }
  }
}
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "documentId": "doc-001",
    "status": "completed",
    "totalDuration": 1234,
    "metrics": {
      "fieldCount": 10,
      "entityCount": 5,
      "relationCount": 8
    },
    "steps": {
      "parsing": { "status": "success", "duration": 100 },
      "extraction": { "status": "success", "duration": 200 },
      "schemaMatching": { "status": "success", "duration": 150 },
      "normalization": { "status": "success", "duration": 180 },
      "entityBuilding": { "status": "success", "duration": 220 },
      "relationExtraction": { "status": "success", "duration": 250 },
      "storage": { "status": "success", "duration": 134 }
    },
    "warnings": [],
    "errors": []
  }
}
```

#### 批量处理文档

```bash
POST /api/knowledge-graph/pipeline/batch
Content-Type: application/json

{
  "documents": [
    {
      "id": "doc-001",
      "type": "text",
      "content": "文档1内容..."
    },
    {
      "id": "doc-002",
      "type": "text",
      "content": "文档2内容..."
    }
  ],
  "options": {
    "concurrency": 2,
    "stopOnFirstError": false
  }
}
```

#### 查看 Pipeline 状态

```bash
GET /api/knowledge-graph/pipeline/status
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "available": true,
    "version": "1.0.0",
    "mode": "enabled",
    "message": "Pipeline mode is enabled in hooks"
  }
}
```

#### 查看 Pipeline 配置

```bash
GET /api/knowledge-graph/pipeline/config
```

### 3. 直接使用 Pipeline 类

```javascript
const { UniversalDocumentPipeline } = require('./kg/pipeline/universal_document_pipeline');

// 创建 Pipeline 实例
const pipeline = new UniversalDocumentPipeline({
  extraction: { useLLM: false },
  normalization: { useLLM: false },
  entityBuilding: { useLLM: false },
  relationExtraction: { enableSemantic: false }
});

// 处理文档
const document = {
  id: 'doc-001',
  type: 'text',
  content: '文档内容...'
};

const context = await pipeline.processDocument(document);
console.log('处理状态:', context.status);
console.log('提取字段:', context.metrics.fieldCount);
console.log('构建实体:', context.metrics.entityCount);
```

## 模式对比

### 传统模式 (kgService)

**优点：**
- 成熟稳定，经过充分测试
- 支持增量更新 (updateKnowledgeGraph)
- 与现有代码完全兼容

**缺点：**
- 流程不够清晰，步骤耦合
- 错误处理不够完善
- 缺少详细的性能指标
- 不支持批量并发处理

**适用场景：**
- 生产环境（当前默认）
- 需要增量更新的场景
- 对稳定性要求高的场景

### Pipeline 模式

**优点：**
- 流程清晰，步骤解耦
- 完善的错误处理和降级策略
- 详细的性能指标追踪
- 支持批量并发处理
- 每个步骤可独立配置
- 更好的可测试性

**缺点：**
- 相对较新，需要更多测试
- 暂不支持增量更新（总是全量重建）
- 性能可能略低于传统模式

**适用场景：**
- 新项目或新功能
- 需要详细监控的场景
- 批量处理大量文档
- 需要灵活配置的场景

## 迁移策略

### 阶段 1: 测试验证（当前阶段）

1. 在开发/测试环境启用 Pipeline 模式
2. 对比两种模式的处理结果
3. 验证 Pipeline 的稳定性和性能

```bash
# 测试环境
USE_PIPELINE=true npm start
```

### 阶段 2: 灰度发布

1. 在生产环境保持传统模式
2. 为特定用户或文档类型启用 Pipeline
3. 收集反馈和性能数据

```javascript
// 根据条件选择模式
const usePipeline = document.type === 'experimental' || user.betaTester;
```

### 阶段 3: 全面切换

1. 确认 Pipeline 稳定后，全面启用
2. 保留传统模式作为后备方案
3. 逐步移除传统模式代码

## 配置说明

### Pipeline 配置选项

```javascript
{
  // 字段提取配置
  extraction: {
    useLLM: false,          // 是否使用 LLM 提取（成本高）
    useNER: true,           // 是否使用 NER 提取
    useRules: true,         // 是否使用规则提取
    maxTokens: 4000         // LLM 最大 token 数
  },
  
  // Schema 匹配配置
  schemaMatching: {
    useLLM: false,          // 是否使用 LLM 匹配
    minConfidence: 0.5,     // 最小置信度阈值
    fallbackToGeneric: true // 未匹配时使用通用 Schema
  },
  
  // 字段标准化配置
  normalization: {
    useLLM: false,          // 是否使用 LLM 标准化
    useAlgorithm: true,     // 是否使用算法标准化
    minConfidence: 0.6      // 最小置信度阈值
  },
  
  // 实体构建配置
  entityBuilding: {
    useLLM: false,          // 是否使用 LLM 构建
    allowPartialEntities: true,  // 是否允许部分实体
    minFieldCoverage: 0.5   // 最小字段覆盖率
  },
  
  // 关系抽取配置
  relationExtraction: {
    enableBuiltin: true,    // 启用内置关系
    enableCooccurrence: true,  // 启用共现关系
    enableSemantic: false,  // 启用语义关系（慢）
    minConfidence: 0.5      // 最小置信度阈值
  }
}
```

### 环境变量配置

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `USE_PIPELINE` | 是否启用 Pipeline 模式 | `false` |
| `PIPELINE_EXTRACTION_USE_LLM` | 字段提取是否使用 LLM | `false` |
| `PIPELINE_EXTRACTION_USE_NER` | 字段提取是否使用 NER | `true` |
| `PIPELINE_EXTRACTION_USE_RULES` | 字段提取是否使用规则 | `true` |
| `PIPELINE_NORMALIZATION_USE_LLM` | 标准化是否使用 LLM | `false` |
| `PIPELINE_NORMALIZATION_USE_ALGORITHM` | 标准化是否使用算法 | `true` |
| `PIPELINE_ENTITY_USE_LLM` | 实体构建是否使用 LLM | `false` |
| `PIPELINE_ENTITY_ALLOW_PARTIAL` | 是否允许部分实体 | `true` |
| `PIPELINE_RELATION_BUILTIN` | 是否启用内置关系 | `true` |
| `PIPELINE_RELATION_COOCCURRENCE` | 是否启用共现关系 | `true` |
| `PIPELINE_RELATION_SEMANTIC` | 是否启用语义关系 | `false` |

## 性能优化建议

### 1. 禁用不必要的 LLM

LLM 调用是最耗时的操作，建议在不需要时禁用：

```bash
PIPELINE_EXTRACTION_USE_LLM=false
PIPELINE_NORMALIZATION_USE_LLM=false
PIPELINE_ENTITY_USE_LLM=false
```

### 2. 禁用语义关系抽取

语义关系抽取较慢，如果不需要可以禁用：

```bash
PIPELINE_RELATION_SEMANTIC=false
```

### 3. 调整批量处理并发数

根据服务器资源调整并发数：

```javascript
// 低配置服务器
{ concurrency: 1 }

// 中等配置服务器
{ concurrency: 3 }

// 高配置服务器
{ concurrency: 5 }
```

### 4. 使用缓存

Pipeline 会自动使用字段标准化缓存，无需额外配置。

## 监控和调试

### 查看处理日志

```bash
# 启用详细日志
DEBUG=kg:* npm start
```

### 查看性能指标

```javascript
const context = await pipeline.processDocument(document);

console.log('总耗时:', context.totalDuration, 'ms');
console.log('各步骤耗时:');
Object.keys(context.steps).forEach(step => {
  console.log(`  ${step}: ${context.steps[step].duration}ms`);
});
```

### 查看错误和警告

```javascript
if (context.warnings.length > 0) {
  console.log('警告:', context.warnings);
}

if (context.errors.length > 0) {
  console.log('错误:', context.errors);
}
```

## 故障排查

### Pipeline 模式未生效

**检查：**
1. 确认 `USE_PIPELINE=true` 已设置
2. 重启服务器
3. 查看日志中的模式提示

```bash
# 应该看到这样的日志
[KG Hook] 使用Pipeline模式处理文档
```

### 处理失败

**检查：**
1. 查看 `context.errors` 了解具体错误
2. 检查文档格式是否正确
3. 确认数据库连接正常

### 性能问题

**优化：**
1. 禁用不必要的 LLM 调用
2. 禁用语义关系抽取
3. 减少批量处理并发数
4. 检查数据库性能

## 常见问题

### Q: Pipeline 模式和传统模式可以同时使用吗？

A: 可以。通过 `USE_PIPELINE` 环境变量控制 hooks 使用哪种模式，同时可以直接调用 API 端点使用另一种模式。

### Q: 如何回退到传统模式？

A: 设置 `USE_PIPELINE=false` 或删除该环境变量，然后重启服务器。

### Q: Pipeline 模式支持增量更新吗？

A: 目前不支持。Pipeline 模式总是执行全量重建。如果需要增量更新，请使用传统模式。

### Q: 两种模式的数据格式兼容吗？

A: 完全兼容。两种模式使用相同的数据库 Schema 和数据结构。

### Q: 如何选择使用哪种模式？

A: 
- 生产环境、需要增量更新 → 传统模式
- 新功能、需要详细监控、批量处理 → Pipeline 模式
- 不确定 → 先使用传统模式

## 相关文档

- [Pipeline README](./README.md) - Pipeline 使用文档
- [Pipeline 迁移指南](./MIGRATION_GUIDE.md) - 从 build_knowledge_graph.js 迁移
- [API 文档](../API.md) - 完整 API 参考

## 支持

如有问题或建议，请：
1. 查看相关文档
2. 检查日志输出
3. 提交 Issue 或联系开发团队
