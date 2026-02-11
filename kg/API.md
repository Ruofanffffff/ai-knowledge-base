# Schema 驱动知识图谱系统 - API 参考文档

## 1. 概述

本文档详细说明知识图谱系统的所有 API 端点,包括请求参数、响应格式、错误码和使用示例。

### 1.1 基础信息

- **Base URL**: `http://localhost:3000/api/knowledge-graph`
- **认证方式**: Bearer Token (通过 `authMiddleware`)
- **请求格式**: JSON
- **响应格式**: JSON
- **字符编码**: UTF-8

### 1.2 通用响应格式

**成功响应**:
```json
{
  "success": true,
  "data": {
    // 响应数据
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "错误信息"
}
```

### 1.3 HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

### 1.4 认证

所有 API 端点都需要认证。在请求头中包含 Bearer Token:

```bash
Authorization: Bearer YOUR_TOKEN_HERE
```

## 2. CKB (Common Knowledge Base) API

### 2.1 解析文档生成 CKB

**端点**: `POST /ckb/parse`

**描述**: 解析文档并生成 CKB (Common Knowledge Base) 列表

**请求参数**:
```json
{
  "docId": "string",      // 文档 ID (必需)
  "filePath": "string",   // 文件路径 (必需)
  "fileType": "string"    // 文件类型: word, pdf, excel, markdown (必需)
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "count": 5,
    "ckbs": [
      {
        "id": "ckb-uuid-1",
        "doc_id": "doc-123",
        "source_type": "word",
        "source_meta": {
          "file_name": "report.docx",
          "page": 1
        },
        "structure": {
          "section_title": "第一章",
          "level": 1
        },
        "content": {
          "text": "A区2022年地下水位下降0.8米",
          "language": "zh"
        },
        "quality": {
          "source_confidence": 0.9
        },
        "created_at": "2025-02-01T00:00:00Z"
      }
    ]
  }
}
```

**错误响应**:
- `400`: 缺少必需参数
- `500`: 解析失败

**示例**:
```bash
curl -X POST http://localhost:3000/api/knowledge-graph/ckb/parse \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "docId": "doc-123",
    "filePath": "/path/to/document.docx",
    "fileType": "word"
  }'
```


### 2.2 获取 CKB 详情

**端点**: `GET /ckb/:id`

**描述**: 根据 ID 获取单个 CKB 的详细信息

**路径参数**:
- `id`: CKB ID (必需)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "ckb-uuid-1",
    "doc_id": "doc-123",
    "source_type": "word",
    "content": {
      "text": "A区2022年地下水位下降0.8米"
    }
  }
}
```

**错误响应**:
- `404`: CKB 不存在

**示例**:
```bash
curl -X GET http://localhost:3000/api/knowledge-graph/ckb/ckb-uuid-1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2.3 获取文档的所有 CKB

**端点**: `GET /ckb/document/:docId`

**描述**: 获取指定文档的所有 CKB

**路径参数**:
- `docId`: 文档 ID (必需)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "count": 5,
    "ckbs": [...]
  }
}
```

**示例**:
```bash
curl -X GET http://localhost:3000/api/knowledge-graph/ckb/document/doc-123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2.4 获取所有 CKB (分页)

**端点**: `GET /ckb`

**描述**: 获取所有 CKB,支持分页

**查询参数**:
- `skip`: 跳过的记录数 (可选,默认: 0)
- `take`: 返回的记录数 (可选,默认: 100)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": 150,
    "count": 100,
    "ckbs": [...]
  }
}
```

**示例**:
```bash
curl -X GET "http://localhost:3000/api/knowledge-graph/ckb?skip=0&take=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 3. Schema API

### 3.1 获取 Schema 列表

**端点**: `GET /schemas`

**描述**: 获取 Schema 列表,支持筛选和分页

**查询参数**:
- `scene`: 按场景筛选 (可选,如 "科研/政府")
- `active`: 按启用状态筛选 (可选,true/false)
- `skip`: 跳过的记录数 (可选,默认: 0)
- `take`: 返回的记录数 (可选,默认: 100)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": 250,
    "count": 100,
    "schemas": [
      {
        "schema_id": "schema-uuid-1",
        "schema_name": "地下水位变化事件",
        "entity_type": "EventEntity",
        "scene": "科研/政府",
        "core_fields": [
          { "name": "区域", "weight": 0.3, "required": true },
          { "name": "时间", "weight": 0.2, "required": true }
        ],
        "threshold": 0.75,
        "relations": [
          { "type": "发生于", "target_field": "区域", "direction": "outgoing" }
        ],
        "example_description": "A区2022年地下水位下降0.8米",
        "description": "用于记录某个实体在某个时间点的指标数值",
        "version": "1.0.0",
        "active": true
      }
    ]
  }
}
```

**示例**:
```bash
# 获取所有启用的科研场景 Schema
curl -X GET "http://localhost:3000/api/knowledge-graph/schemas?scene=科研&active=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3.2 获取 Schema 详情

**端点**: `GET /schemas/:id`

**描述**: 根据 ID 获取单个 Schema 的详细信息

**路径参数**:
- `id`: Schema ID (必需)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "schema_id": "schema-uuid-1",
    "schema_name": "地下水位变化事件",
    ...
  }
}
```

**错误响应**:
- `404`: Schema 不存在

**示例**:
```bash
curl -X GET http://localhost:3000/api/knowledge-graph/schemas/schema-uuid-1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```


### 3.3 创建 Schema

**端点**: `POST /schemas`

**描述**: 创建新的 Schema

**请求参数**:
```json
{
  "schema_name": "string",        // Schema 名称 (必需)
  "entity_type": "string",        // 实体类型 (必需)
  "scene": "string",              // 场景分类 (可选)
  "core_fields": [                // 核心字段 (必需)
    {
      "name": "string",
      "weight": 0.5,
      "required": true
    }
  ],
  "threshold": 0.7,               // 阈值 (必需,0-1)
  "relations": [                  // 关系定义 (可选)
    {
      "type": "string",
      "target_field": "string",
      "direction": "outgoing"
    }
  ],
  "example_description": "string", // 示例描述 (可选)
  "description": "string",         // 详细说明 (可选)
  "version": "1.0.0",             // 版本号 (必需)
  "active": true                  // 是否启用 (可选,默认: true)
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "schema_id": "schema-uuid-new",
    "schema_name": "新Schema",
    ...
  }
}
```

**错误响应**:
- `400`: 缺少必需参数或参数验证失败
- `500`: 创建失败

**示例**:
```bash
curl -X POST http://localhost:3000/api/knowledge-graph/schemas \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schema_name": "项目实体",
    "entity_type": "ProjectEntity",
    "scene": "政府工作",
    "core_fields": [
      { "name": "项目名称", "weight": 0.5, "required": true },
      { "name": "负责人", "weight": 0.5, "required": false }
    ],
    "threshold": 0.7,
    "version": "1.0.0"
  }'
```

### 3.4 更新 Schema

**端点**: `PUT /schemas/:id`

**描述**: 更新现有 Schema (会创建新版本)

**路径参数**:
- `id`: Schema ID (必需)

**请求参数**: 与创建 Schema 相同,但所有字段都是可选的

**响应示例**:
```json
{
  "success": true,
  "data": {
    "schema_id": "schema-uuid-1",
    "version": "1.1.0",
    ...
  }
}
```

**错误响应**:
- `404`: Schema 不存在
- `500`: 更新失败

**示例**:
```bash
curl -X PUT http://localhost:3000/api/knowledge-graph/schemas/schema-uuid-1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "更新后的描述",
    "active": true
  }'
```

### 3.5 删除 Schema

**端点**: `DELETE /schemas/:id`

**描述**: 删除 Schema (如果有依赖实体则失败)

**路径参数**:
- `id`: Schema ID (必需)

**响应示例**:
```json
{
  "success": true,
  "message": "Schema deleted successfully"
}
```

**错误响应**:
- `400`: Schema 有依赖实体,无法删除
- `404`: Schema 不存在

**示例**:
```bash
curl -X DELETE http://localhost:3000/api/knowledge-graph/schemas/schema-uuid-1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3.6 启用 Schema

**端点**: `PUT /schemas/:id/enable`

**描述**: 启用 Schema,使其参与匹配

**路径参数**:
- `id`: Schema ID (必需)

**响应示例**:
```json
{
  "success": true,
  "message": "Schema enabled successfully",
  "data": {
    "schema_id": "schema-uuid-1",
    "active": true
  }
}
```

**示例**:
```bash
curl -X PUT http://localhost:3000/api/knowledge-graph/schemas/schema-uuid-1/enable \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3.7 禁用 Schema

**端点**: `PUT /schemas/:id/disable`

**描述**: 禁用 Schema,使其不参与匹配

**路径参数**:
- `id`: Schema ID (必需)

**响应示例**:
```json
{
  "success": true,
  "message": "Schema disabled successfully",
  "data": {
    "schema_id": "schema-uuid-1",
    "active": false
  }
}
```

**示例**:
```bash
curl -X PUT http://localhost:3000/api/knowledge-graph/schemas/schema-uuid-1/disable \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3.8 导入 Schema

**端点**: `POST /schemas/import`

**描述**: 从文件导入 Schema (通常是 SchemaList.md)

**请求参数**:
```json
{
  "filePath": "string",         // 文件路径 (必需)
  "skipExisting": true,         // 跳过已存在的 Schema (可选,默认: true)
  "updateExisting": false       // 更新已存在的 Schema (可选,默认: false)
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "imported": 250,
    "skipped": 0,
    "updated": 0,
    "failed": 0
  }
}
```

**示例**:
```bash
curl -X POST http://localhost:3000/api/knowledge-graph/schemas/import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "./SchemaList.md",
    "skipExisting": true
  }'
```

### 3.9 导出 Schema

**端点**: `GET /schemas/export`

**描述**: 导出 Schema 为 JSON 或 CSV 格式

**查询参数**:
- `format`: 导出格式 (可选,json 或 csv,默认: json)
- `scene`: 按场景筛选 (可选)
- `active`: 按启用状态筛选 (可选)

**响应示例** (JSON):
```json
{
  "success": true,
  "data": {
    "count": 250,
    "schemas": [...]
  }
}
```

**示例**:
```bash
# 导出为 JSON
curl -X GET "http://localhost:3000/api/knowledge-graph/schemas/export?format=json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o schemas.json

# 导出为 CSV
curl -X GET "http://localhost:3000/api/knowledge-graph/schemas/export?format=csv" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o schemas.csv
```

### 3.10 获取 Schema 系统状态

**端点**: `GET /schemas/status`

**描述**: 获取 Schema 系统的当前状态和健康检查

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_schemas": 250,
    "active_schemas": 245,
    "inactive_schemas": 5,
    "health_status": "healthy",
    "last_check": "2025-02-01T00:00:00Z"
  }
}
```

**示例**:
```bash
curl -X GET http://localhost:3000/api/knowledge-graph/schemas/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3.11 强制重新导入 Schema

**端点**: `POST /schemas/reimport`

**描述**: 强制从 SchemaList.md 重新导入所有 Schema

**响应示例**:
```json
{
  "success": true,
  "data": {
    "imported": 250,
    "message": "Schemas reimported successfully"
  }
}
```

**示例**:
```bash
curl -X POST http://localhost:3000/api/knowledge-graph/schemas/reimport \
  -H "Authorization: Bearer YOUR_TOKEN"
```


## 4. Entity API

### 4.1 获取实体列表

**端点**: `GET /entities`

**描述**: 获取实体列表,支持筛选、排序和分页

**查询参数**:
- `type`: 按实体类型筛选 (可选,如 "EventEntity")
- `minConfidence`: 最小置信度 (可选,0-1)
- `maxConfidence`: 最大置信度 (可选,0-1)
- `skip`: 跳过的记录数 (可选,默认: 0)
- `take`: 返回的记录数 (可选,默认: 100)
- `orderBy`: 排序字段 (可选,默认: "createdAt")
- `order`: 排序顺序 (可选,asc 或 desc,默认: "desc")

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": 500,
    "count": 100,
    "entities": [
      {
        "id": "entity-uuid-1",
        "canonical_name": "2024年北京地下水位变化",
        "type": "EventEntity",
        "schema_name": "地下水位变化事件",
        "attributes": {
          "区域": "北京",
          "时间": "2024-01-01",
          "指标": "地下水位",
          "数值": "10.5",
          "单位": "米"
        },
        "confidence": 0.85,
        "supported_by": ["ckb-1", "ckb-2"],
        "created_at": "2025-02-01T00:00:00Z"
      }
    ]
  }
}
```

**示例**:
```bash
# 获取所有事件实体
curl -X GET "http://localhost:3000/api/knowledge-graph/entities?type=EventEntity" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 获取高置信度实体
curl -X GET "http://localhost:3000/api/knowledge-graph/entities?minConfidence=0.8" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4.2 获取实体详情

**端点**: `GET /entities/:id`

**描述**: 根据 ID 获取单个实体的详细信息

**路径参数**:
- `id`: 实体 ID (必需)

**查询参数**:
- `includeCKBs`: 是否包含支撑的 CKB (可选,true/false,默认: false)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "entity-uuid-1",
    "canonical_name": "2024年北京地下水位变化",
    "type": "EventEntity",
    "schema_name": "地下水位变化事件",
    "attributes": {...},
    "confidence": 0.85,
    "supported_by": ["ckb-1", "ckb-2"],
    "supporting_ckbs": [  // 仅当 includeCKBs=true 时包含
      {
        "id": "ckb-1",
        "content": {...}
      }
    ]
  }
}
```

**错误响应**:
- `404`: 实体不存在

**示例**:
```bash
curl -X GET "http://localhost:3000/api/knowledge-graph/entities/entity-uuid-1?includeCKBs=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4.3 搜索实体

**端点**: `GET /entities/search`

**描述**: 按名称搜索实体

**查询参数**:
- `q`: 搜索关键词 (必需)
- `skip`: 跳过的记录数 (可选,默认: 0)
- `take`: 返回的记录数 (可选,默认: 100)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "query": "地下水位",
    "count": 15,
    "entities": [...]
  }
}
```

**错误响应**:
- `400`: 缺少搜索关键词

**示例**:
```bash
curl -X GET "http://localhost:3000/api/knowledge-graph/entities/search?q=地下水位" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4.4 获取实体统计

**端点**: `GET /entities/stats`

**描述**: 获取实体的统计信息

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_entities": 500,
    "by_type": {
      "EventEntity": 200,
      "LocationEntity": 150,
      "PersonEntity": 100,
      "ProjectEntity": 50
    },
    "avg_confidence": 0.75,
    "high_confidence_count": 350,
    "low_confidence_count": 150
  }
}
```

**示例**:
```bash
curl -X GET http://localhost:3000/api/knowledge-graph/entities/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4.5 获取实体的关系

**端点**: `GET /entities/:entityId/relations`

**描述**: 获取指定实体的所有关系

**路径参数**:
- `entityId`: 实体 ID (必需)

**查询参数**:
- `type`: 按关系类型筛选 (可选,如 "builtin")
- `minConfidence`: 最小置信度 (可选,0-1)
- `direction`: 关系方向 (可选,outgoing/incoming/all,默认: all)
- `includeEntities`: 是否包含关联实体详情 (可选,true/false,默认: false)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "entity_id": "entity-uuid-1",
    "direction": "all",
    "count": 5,
    "relations": [
      {
        "id": "relation-uuid-1",
        "source_id": "entity-uuid-1",
        "target_id": "entity-uuid-2",
        "type": "builtin",
        "subtype": "发生于",
        "weight": 1.0,
        "confidence": 0.9,
        "evidence": ["ckb-1"]
      }
    ]
  }
}
```

**示例**:
```bash
# 获取所有关系
curl -X GET "http://localhost:3000/api/knowledge-graph/entities/entity-uuid-1/relations" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 只获取出边关系
curl -X GET "http://localhost:3000/api/knowledge-graph/entities/entity-uuid-1/relations?direction=outgoing" \
  -H "Authorization: Bearer YOUR_TOKEN"
```


## 5. Relation API

### 5.1 获取关系列表

**端点**: `GET /relations`

**描述**: 获取关系列表,支持筛选和分页

**查询参数**:
- `type`: 按关系类型筛选 (可选,builtin/cooccurrence/semantic)
- `minConfidence`: 最小置信度 (可选,0-1)
- `skip`: 跳过的记录数 (可选,默认: 0)
- `take`: 返回的记录数 (可选,默认: 100)
- `includeEntities`: 是否包含实体详情 (可选,true/false,默认: false)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": 800,
    "count": 100,
    "relations": [
      {
        "id": "relation-uuid-1",
        "source_id": "entity-uuid-1",
        "target_id": "entity-uuid-2",
        "type": "builtin",
        "subtype": "发生于",
        "weight": 1.0,
        "confidence": 0.9,
        "evidence": ["ckb-1"],
        "created_at": "2025-02-01T00:00:00Z"
      }
    ]
  }
}
```

**示例**:
```bash
# 获取所有内建关系
curl -X GET "http://localhost:3000/api/knowledge-graph/relations?type=builtin" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 获取高置信度的语义关系
curl -X GET "http://localhost:3000/api/knowledge-graph/relations?type=semantic&minConfidence=0.8" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5.2 获取关系详情

**端点**: `GET /relations/:id`

**描述**: 根据 ID 获取单个关系的详细信息

**路径参数**:
- `id`: 关系 ID (必需)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "relation-uuid-1",
    "source_id": "entity-uuid-1",
    "target_id": "entity-uuid-2",
    "type": "semantic",
    "subtype": "causes",
    "weight": 0.8,
    "confidence": 0.75,
    "evidence": ["ckb-1", "ckb-2"]
  }
}
```

**错误响应**:
- `404`: 关系不存在

**示例**:
```bash
curl -X GET http://localhost:3000/api/knowledge-graph/relations/relation-uuid-1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5.3 获取关系统计

**端点**: `GET /relations/stats`

**描述**: 获取关系的统计信息

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_relations": 800,
    "by_type": {
      "builtin": 400,
      "cooccurrence": 250,
      "semantic": 150
    },
    "avg_confidence": 0.72,
    "high_confidence_count": 600,
    "low_confidence_count": 200
  }
}
```

**示例**:
```bash
curl -X GET http://localhost:3000/api/knowledge-graph/relations/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 6. Graph Traversal API

### 6.1 图遍历

**端点**: `POST /traverse`

**描述**: 使用 BFS 或 DFS 算法遍历知识图谱

**请求参数**:
```json
{
  "startEntityId": "string",      // 起始实体 ID (必需)
  "algorithm": "bfs",             // 算法: bfs 或 dfs (可选,默认: bfs)
  "maxDepth": 3,                  // 最大深度 (可选,默认: 3)
  "relationTypes": ["string"],    // 关系类型过滤 (可选)
  "minConfidence": 0.5            // 最小置信度 (可选,默认: 0)
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "algorithm": "bfs",
    "start_entity_id": "entity-uuid-1",
    "max_depth": 3,
    "visited_count": 25,
    "path_count": 10,
    "visited": ["entity-uuid-1", "entity-uuid-2", ...],
    "paths": [
      {
        "path": ["entity-uuid-1", "entity-uuid-2", "entity-uuid-3"],
        "depth": 2
      }
    ]
  }
}
```

**错误响应**:
- `400`: 缺少起始实体 ID

**示例**:
```bash
curl -X POST http://localhost:3000/api/knowledge-graph/traverse \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startEntityId": "entity-uuid-1",
    "algorithm": "bfs",
    "maxDepth": 3,
    "minConfidence": 0.7
  }'
```

### 6.2 获取邻居节点

**端点**: `GET /neighbors/:id`

**描述**: 获取指定实体的邻居节点

**路径参数**:
- `id`: 实体 ID (必需)

**查询参数**:
- `direction`: 方向 (可选,outgoing/incoming/both,默认: both)
- `relationTypes`: 关系类型,逗号分隔 (可选)
- `minConfidence`: 最小置信度 (可选,默认: 0)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "entity_id": "entity-uuid-1",
    "direction": "both",
    "count": 5,
    "neighbors": [
      {
        "entity": {
          "id": "entity-uuid-2",
          "canonical_name": "北京",
          "type": "LocationEntity"
        },
        "relation": {
          "id": "relation-uuid-1",
          "type": "builtin",
          "subtype": "发生于",
          "direction": "outgoing"
        }
      }
    ]
  }
}
```

**示例**:
```bash
# 获取所有邻居
curl -X GET "http://localhost:3000/api/knowledge-graph/neighbors/entity-uuid-1" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 只获取出边邻居
curl -X GET "http://localhost:3000/api/knowledge-graph/neighbors/entity-uuid-1?direction=outgoing" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 筛选关系类型
curl -X GET "http://localhost:3000/api/knowledge-graph/neighbors/entity-uuid-1?relationTypes=builtin,semantic" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6.3 查找最短路径

**端点**: `GET /path/:sourceId/:targetId`

**描述**: 查找两个实体之间的最短路径

**路径参数**:
- `sourceId`: 源实体 ID (必需)
- `targetId`: 目标实体 ID (必需)

**查询参数**:
- `relationTypes`: 关系类型,逗号分隔 (可选)
- `minConfidence`: 最小置信度 (可选,默认: 0)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "source_id": "entity-uuid-1",
    "target_id": "entity-uuid-5",
    "path_found": true,
    "length": 3,
    "path": [
      {
        "entity": {
          "id": "entity-uuid-1",
          "canonical_name": "2024年北京地下水位变化"
        }
      },
      {
        "relation": {
          "id": "relation-uuid-1",
          "type": "builtin",
          "subtype": "发生于"
        }
      },
      {
        "entity": {
          "id": "entity-uuid-2",
          "canonical_name": "北京"
        }
      },
      {
        "relation": {
          "id": "relation-uuid-2",
          "type": "semantic",
          "subtype": "influences"
        }
      },
      {
        "entity": {
          "id": "entity-uuid-5",
          "canonical_name": "农业灌溉"
        }
      }
    ]
  }
}
```

**无路径响应**:
```json
{
  "success": true,
  "data": {
    "source_id": "entity-uuid-1",
    "target_id": "entity-uuid-99",
    "path_found": false,
    "message": "No path found between entities"
  }
}
```

**示例**:
```bash
curl -X GET "http://localhost:3000/api/knowledge-graph/path/entity-uuid-1/entity-uuid-5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6.4 获取子图

**端点**: `GET /subgraph/:id`

**描述**: 获取以指定实体为中心的子图

**路径参数**:
- `id`: 中心实体 ID (必需)

**查询参数**:
- `depth`: 子图深度 (可选,默认: 2)
- `relationTypes`: 关系类型,逗号分隔 (可选)
- `minConfidence`: 最小置信度 (可选,默认: 0)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "center_entity_id": "entity-uuid-1",
    "depth": 2,
    "entity_count": 15,
    "relation_count": 20,
    "entities": [
      {
        "id": "entity-uuid-1",
        "canonical_name": "2024年北京地下水位变化",
        "type": "EventEntity"
      },
      ...
    ],
    "relations": [
      {
        "id": "relation-uuid-1",
        "source_id": "entity-uuid-1",
        "target_id": "entity-uuid-2",
        "type": "builtin",
        "subtype": "发生于"
      },
      ...
    ]
  }
}
```

**示例**:
```bash
# 获取深度为 2 的子图
curl -X GET "http://localhost:3000/api/knowledge-graph/subgraph/entity-uuid-1?depth=2" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 获取深度为 3 的高置信度子图
curl -X GET "http://localhost:3000/api/knowledge-graph/subgraph/entity-uuid-1?depth=3&minConfidence=0.7" \
  -H "Authorization: Bearer YOUR_TOKEN"
```


## 7. KG Build/Update API

### 7.1 构建知识图谱

**端点**: `POST /build`

**描述**: 从文档构建知识图谱

**请求参数**:
```json
{
  "docId": "string",                    // 文档 ID (必需)
  "filePath": "string",                 // 文件路径 (必需)
  "fileType": "string",                 // 文件类型 (必需)
  "enableSemanticRelations": true,      // 启用语义关系 (可选,默认: true)
  "enableQualityFilter": true           // 启用质量过滤 (可选,默认: true)
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "doc_id": "doc-123",
    "ckb_count": 10,
    "entity_count": 15,
    "relation_count": 20,
    "processing_time_ms": 25000,
    "token_usage": {
      "total_tokens": 2500,
      "prompt_tokens": 1800,
      "completion_tokens": 700
    },
    "quality_metrics": {
      "avg_entity_confidence": 0.78,
      "avg_relation_confidence": 0.72,
      "filtered_entities": 2,
      "filtered_relations": 3
    }
  }
}
```

**错误响应**:
- `400`: 缺少必需参数
- `500`: 构建失败

**示例**:
```bash
curl -X POST http://localhost:3000/api/knowledge-graph/build \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "docId": "doc-123",
    "filePath": "/path/to/document.docx",
    "fileType": "word",
    "enableSemanticRelations": true,
    "enableQualityFilter": true
  }'
```

### 7.2 更新知识图谱

**端点**: `POST /update`

**描述**: 更新已修改文档的知识图谱 (增量更新)

**请求参数**: 与构建知识图谱相同

**响应示例**:
```json
{
  "success": true,
  "data": {
    "doc_id": "doc-123",
    "deleted_entities": 5,
    "deleted_relations": 8,
    "new_entities": 12,
    "new_relations": 18,
    "processing_time_ms": 20000,
    "token_usage": {...}
  }
}
```

**示例**:
```bash
curl -X POST http://localhost:3000/api/knowledge-graph/update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "docId": "doc-123",
    "filePath": "/path/to/updated_document.docx",
    "fileType": "word"
  }'
```

### 7.3 重建知识图谱

**端点**: `POST /rebuild`

**描述**: 重建整个知识图谱 (全量重建)

**请求参数**:
```json
{
  "enableSemanticRelations": true,      // 启用语义关系 (可选,默认: true)
  "enableQualityFilter": true           // 启用质量过滤 (可选,默认: true)
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_documents": 50,
    "processed_documents": 50,
    "failed_documents": 0,
    "total_entities": 500,
    "total_relations": 800,
    "processing_time_ms": 600000,
    "token_usage": {
      "total_tokens": 125000
    }
  }
}
```

**警告**: 此操作会删除所有现有的知识图谱数据,请谨慎使用!

**示例**:
```bash
curl -X POST http://localhost:3000/api/knowledge-graph/rebuild \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enableSemanticRelations": true,
    "enableQualityFilter": true
  }'
```

### 7.4 删除文档的知识图谱

**端点**: `DELETE /document/:docId`

**描述**: 删除指定文档的所有知识图谱数据

**路径参数**:
- `docId`: 文档 ID (必需)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "doc_id": "doc-123",
    "deleted_ckbs": 10,
    "deleted_entities": 15,
    "deleted_relations": 20
  },
  "message": "Knowledge graph deleted successfully"
}
```

**示例**:
```bash
curl -X DELETE http://localhost:3000/api/knowledge-graph/document/doc-123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 8. Statistics API

### 8.1 获取知识图谱统计

**端点**: `GET /stats`

**描述**: 获取知识图谱的整体统计信息

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_documents": 50,
    "total_ckbs": 500,
    "total_entities": 500,
    "total_relations": 800,
    "total_schemas": 250,
    "active_schemas": 245,
    "entity_stats": {
      "by_type": {
        "EventEntity": 200,
        "LocationEntity": 150
      },
      "avg_confidence": 0.75
    },
    "relation_stats": {
      "by_type": {
        "builtin": 400,
        "cooccurrence": 250,
        "semantic": 150
      },
      "avg_confidence": 0.72
    }
  }
}
```

**示例**:
```bash
curl -X GET http://localhost:3000/api/knowledge-graph/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 8.2 获取 Token 使用统计

**端点**: `GET /stats/tokens`

**描述**: 获取 Token 使用统计信息

**查询参数**:
- `startDate`: 开始日期 (可选,ISO 格式)
- `endDate`: 结束日期 (可选,ISO 格式)
- `module`: 按模块筛选 (可选)
- `operation`: 按操作筛选 (可选)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_tokens": 125000,
    "prompt_tokens": 90000,
    "completion_tokens": 35000,
    "total_cost": 12.5,
    "by_operation": {
      "field_extraction": 30000,
      "field_mapping": 25000,
      "entity_canonical_name": 20000,
      "entity_disambiguation": 15000,
      "semantic_relation": 35000
    },
    "by_date": {
      "2025-02-01": 50000,
      "2025-01-31": 45000,
      "2025-01-30": 30000
    }
  }
}
```

**示例**:
```bash
# 获取所有 Token 统计
curl -X GET http://localhost:3000/api/knowledge-graph/stats/tokens \
  -H "Authorization: Bearer YOUR_TOKEN"

# 获取指定日期范围的统计
curl -X GET "http://localhost:3000/api/knowledge-graph/stats/tokens?startDate=2025-01-01&endDate=2025-02-01" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 按操作筛选
curl -X GET "http://localhost:3000/api/knowledge-graph/stats/tokens?operation=field_mapping" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 8.3 获取 Token 使用时序数据

**端点**: `GET /stats/tokens/timeseries`

**描述**: 获取 Token 使用的时序数据

**查询参数**:
- `startDate`: 开始日期 (必需,ISO 格式)
- `endDate`: 结束日期 (必需,ISO 格式)
- `interval`: 时间间隔 (可选,hour/day/week,默认: day)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "start_date": "2025-01-01",
    "end_date": "2025-02-01",
    "interval": "day",
    "data_points": 32,
    "time_series": [
      {
        "timestamp": "2025-01-01T00:00:00Z",
        "total_tokens": 3000,
        "prompt_tokens": 2100,
        "completion_tokens": 900
      },
      {
        "timestamp": "2025-01-02T00:00:00Z",
        "total_tokens": 3500,
        "prompt_tokens": 2500,
        "completion_tokens": 1000
      }
    ]
  }
}
```

**错误响应**:
- `400`: 缺少必需参数

**示例**:
```bash
curl -X GET "http://localhost:3000/api/knowledge-graph/stats/tokens/timeseries?startDate=2025-01-01&endDate=2025-02-01&interval=day" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 8.4 获取每日 Token 预算状态

**端点**: `GET /stats/tokens/budget`

**描述**: 获取当前每日 Token 预算的使用状态

**响应示例**:
```json
{
  "success": true,
  "data": {
    "daily_limit": 100000,
    "used_today": 45000,
    "remaining": 55000,
    "usage_percentage": 45,
    "status": "normal",
    "alert_level": "none",
    "emergency_mode": false,
    "reset_time": "2025-02-02T00:00:00Z"
  }
}
```

**状态说明**:
- `normal`: 正常 (< 80%)
- `warning`: 预警 (80-100%)
- `exceeded`: 超限 (> 100%)

**示例**:
```bash
curl -X GET http://localhost:3000/api/knowledge-graph/stats/tokens/budget \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 8.5 获取 Token 优化建议

**端点**: `GET /stats/tokens/recommendations`

**描述**: 获取 Token 使用优化建议

**响应示例**:
```json
{
  "success": true,
  "data": {
    "current_usage": 45000,
    "daily_limit": 100000,
    "recommendations": [
      {
        "priority": "high",
        "category": "cache",
        "title": "启用 LLM 响应缓存",
        "description": "当前缓存命中率仅 20%,建议启用缓存以减少重复调用",
        "potential_savings": 15000
      },
      {
        "priority": "medium",
        "category": "frequency",
        "title": "降低语义关系抽取频率",
        "description": "语义关系抽取占用 Token 较多,建议降低频率至 20%",
        "potential_savings": 10000
      }
    ]
  }
}
```

**示例**:
```bash
curl -X GET http://localhost:3000/api/knowledge-graph/stats/tokens/recommendations \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 8.6 获取质量报告

**端点**: `GET /stats/quality`

**描述**: 获取知识图谱的质量报告

**响应示例**:
```json
{
  "success": true,
  "data": {
    "entity_quality": {
      "total": 500,
      "high_confidence": 350,
      "medium_confidence": 120,
      "low_confidence": 30,
      "avg_confidence": 0.75
    },
    "relation_quality": {
      "total": 800,
      "high_confidence": 600,
      "medium_confidence": 150,
      "low_confidence": 50,
      "avg_confidence": 0.72
    },
    "issues": [
      {
        "type": "low_confidence_entity",
        "count": 30,
        "severity": "medium",
        "recommendation": "Review and improve low confidence entities"
      }
    ],
    "overall_score": 85
  }
}
```

**示例**:
```bash
curl -X GET http://localhost:3000/api/knowledge-graph/stats/quality \
  -H "Authorization: Bearer YOUR_TOKEN"
```


### 8.7 获取性能统计

**端点**: `GET /stats/performance`

**描述**: 获取系统性能统计信息

**查询参数**:
- `timeRange`: 时间范围 (毫秒,可选,默认: 3600000 = 1小时)
- `includeDetails`: 是否包含详细指标 (可选,true/false,默认: false)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "time_range_ms": 3600000,
    "total_operations": 150,
    "avg_processing_time_ms": 2500,
    "max_processing_time_ms": 8000,
    "min_processing_time_ms": 500,
    "by_operation": {
      "ckb_parsing": {
        "count": 50,
        "avg_time_ms": 800
      },
      "field_extraction": {
        "count": 50,
        "avg_time_ms": 1200
      },
      "entity_building": {
        "count": 50,
        "avg_time_ms": 2000
      }
    },
    "health_score": 92
  }
}
```

**示例**:
```bash
curl -X GET "http://localhost:3000/api/knowledge-graph/stats/performance?timeRange=7200000&includeDetails=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 8.8 获取性能仪表板

**端点**: `GET /stats/performance/dashboard`

**描述**: 获取过去 24 小时的综合性能仪表板指标

**响应示例**:
```json
{
  "success": true,
  "data": {
    "time_period": "last_24_hours",
    "processing_metrics": {
      "total_documents": 50,
      "avg_processing_time_ms": 25000,
      "success_rate": 98
    },
    "token_metrics": {
      "total_tokens": 125000,
      "daily_limit": 100000,
      "usage_percentage": 125,
      "emergency_mode": true
    },
    "quality_metrics": {
      "avg_entity_confidence": 0.75,
      "avg_relation_confidence": 0.72,
      "overall_score": 85
    },
    "health_status": "warning",
    "alerts": [
      {
        "type": "token_exceeded",
        "severity": "high",
        "message": "Daily token limit exceeded"
      }
    ]
  }
}
```

**示例**:
```bash
curl -X GET http://localhost:3000/api/knowledge-graph/stats/performance/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 8.9 获取预算状态

**端点**: `GET /stats/budget/status`

**描述**: 获取当前 Token 预算状态,包括每日使用和紧急模式

**响应示例**:
```json
{
  "success": true,
  "data": {
    "daily_limit": 100000,
    "used_today": 125000,
    "remaining": -25000,
    "usage_percentage": 125,
    "emergency_mode": true,
    "emergency_mode_enabled_at": "2025-02-01T15:30:00Z",
    "status": "exceeded",
    "alert_level": "critical"
  }
}
```

**示例**:
```bash
curl -X GET http://localhost:3000/api/knowledge-graph/stats/budget/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 8.10 获取预算建议

**端点**: `GET /stats/budget/recommendations`

**描述**: 基于当前预算使用情况获取优化建议

**响应示例**:
```json
{
  "success": true,
  "data": {
    "count": 3,
    "recommendations": [
      {
        "priority": "high",
        "category": "emergency",
        "title": "启用紧急模式",
        "description": "Token 使用已超限,建议启用紧急模式降低 LLM 调用频率",
        "action": "POST /stats/budget/emergency/enable"
      },
      {
        "priority": "high",
        "category": "cache",
        "title": "提高缓存命中率",
        "description": "当前缓存命中率 20%,建议优化缓存策略",
        "potential_savings": 20000
      },
      {
        "priority": "medium",
        "category": "frequency",
        "title": "调整 LLM 调用频率",
        "description": "降低非关键操作的 LLM 调用频率",
        "potential_savings": 15000
      }
    ]
  }
}
```

**示例**:
```bash
curl -X GET http://localhost:3000/api/knowledge-graph/stats/budget/recommendations \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 8.11 获取预算告警

**端点**: `GET /stats/budget/alerts`

**描述**: 获取最近的预算告警记录

**查询参数**:
- `limit`: 返回的告警数量 (可选,默认: 10)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "count": 5,
    "alerts": [
      {
        "timestamp": "2025-02-01T15:30:00Z",
        "level": "critical",
        "type": "budget_exceeded",
        "message": "Daily token limit exceeded: 125000/100000",
        "action_taken": "Emergency mode enabled"
      },
      {
        "timestamp": "2025-02-01T14:00:00Z",
        "level": "warning",
        "type": "budget_warning",
        "message": "Token usage at 80%: 80000/100000",
        "action_taken": "None"
      }
    ]
  }
}
```

**示例**:
```bash
curl -X GET "http://localhost:3000/api/knowledge-graph/stats/budget/alerts?limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 8.12 启用紧急模式

**端点**: `POST /stats/budget/emergency/enable`

**描述**: 启用紧急模式,降低 LLM 调用频率

**响应示例**:
```json
{
  "success": true,
  "message": "Emergency mode enabled",
  "data": {
    "emergency_mode": true,
    "enabled_at": "2025-02-01T16:00:00Z",
    "llm_frequency_reduction": "50%"
  }
}
```

**示例**:
```bash
curl -X POST http://localhost:3000/api/knowledge-graph/stats/budget/emergency/enable \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 8.13 禁用紧急模式

**端点**: `POST /stats/budget/emergency/disable`

**描述**: 禁用紧急模式,恢复正常 LLM 调用频率

**响应示例**:
```json
{
  "success": true,
  "message": "Emergency mode disabled",
  "data": {
    "emergency_mode": false,
    "disabled_at": "2025-02-01T17:00:00Z"
  }
}
```

**示例**:
```bash
curl -X POST http://localhost:3000/api/knowledge-graph/stats/budget/emergency/disable \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 9. 错误码

### 9.1 HTTP 状态码

| 状态码 | 说明 | 常见原因 |
|--------|------|---------|
| 200 | 成功 | 请求成功处理 |
| 201 | 创建成功 | 资源创建成功 |
| 400 | 请求错误 | 缺少必需参数、参数格式错误 |
| 401 | 未授权 | 缺少或无效的认证 Token |
| 404 | 资源不存在 | 请求的资源不存在 |
| 500 | 服务器错误 | 服务器内部错误 |

### 9.2 业务错误码

| 错误码 | 说明 | 解决方案 |
|--------|------|---------|
| `MISSING_PARAMETERS` | 缺少必需参数 | 检查请求参数 |
| `INVALID_PARAMETERS` | 参数格式错误 | 检查参数类型和格式 |
| `RESOURCE_NOT_FOUND` | 资源不存在 | 检查资源 ID 是否正确 |
| `SCHEMA_VALIDATION_FAILED` | Schema 验证失败 | 检查 Schema 结构 |
| `ENTITY_HAS_DEPENDENCIES` | 实体有依赖关系 | 先删除依赖关系 |
| `TOKEN_LIMIT_EXCEEDED` | Token 超限 | 启用紧急模式或等待重置 |
| `PROCESSING_TIMEOUT` | 处理超时 | 增加超时时间或优化文档 |
| `LLM_API_ERROR` | LLM API 错误 | 检查 API 密钥和网络 |

## 10. 最佳实践

### 10.1 分页查询

对于返回大量数据的端点,建议使用分页:

```bash
# 第一页
curl -X GET "http://localhost:3000/api/knowledge-graph/entities?skip=0&take=100"

# 第二页
curl -X GET "http://localhost:3000/api/knowledge-graph/entities?skip=100&take=100"
```

### 10.2 筛选和过滤

使用查询参数进行筛选,减少数据传输:

```bash
# 只获取高置信度的事件实体
curl -X GET "http://localhost:3000/api/knowledge-graph/entities?type=EventEntity&minConfidence=0.8"
```

### 10.3 Token 优化

- 启用 LLM 响应缓存
- 监控每日 Token 使用
- 根据需求调整 LLM 调用频率
- 使用紧急模式应对超限情况

### 10.4 错误处理

始终检查响应的 `success` 字段:

```javascript
const response = await fetch('/api/knowledge-graph/entities');
const data = await response.json();

if (data.success) {
  // 处理成功响应
  console.log(data.data);
} else {
  // 处理错误
  console.error(data.error);
}
```

### 10.5 批量操作

对于批量操作,使用专门的批量端点而不是循环调用:

```bash
# 推荐: 使用重建端点
curl -X POST http://localhost:3000/api/knowledge-graph/rebuild

# 不推荐: 循环调用构建端点
for doc in docs; do
  curl -X POST http://localhost:3000/api/knowledge-graph/build -d "{\"docId\": \"$doc\"}"
done
```

## 10.6 关系类型管理

### 获取所有关系类型

```bash
GET /api/knowledge-graph/relation-types
```

**查询参数:**
- `domain` (可选): 按领域过滤 (life/work/travel/shopping/government/management)
- `category` (可选): 按分类过滤
- `entityType` (可选): 按实体类型过滤
- `role` (可选): 实体角色 (source/target/both)
- `activeOnly` (可选): 只返回激活的关系类型 (默认: true)

**响应示例:**

```json
{
  "success": true,
  "data": {
    "count": 90,
    "relationTypes": [
      {
        "relationTypeId": "family_parent",
        "name": "parent",
        "displayName": "父母",
        "description": "表示父母关系",
        "domain": "life",
        "category": "family",
        "sourceEntityTypes": ["PersonEntity"],
        "targetEntityTypes": ["PersonEntity"],
        "isDirectional": true,
        "isTemporal": false,
        "supportsConfidence": true,
        "version": "1.0.0",
        "active": true
      }
    ]
  }
}
```

**使用示例:**

```bash
# 获取所有关系类型
curl -X GET http://localhost:3000/api/knowledge-graph/relation-types

# 获取生活领域的关系类型
curl -X GET "http://localhost:3000/api/knowledge-graph/relation-types?domain=life"

# 获取适用于PersonEntity的关系类型
curl -X GET "http://localhost:3000/api/knowledge-graph/relation-types?entityType=PersonEntity&role=source"
```

### 获取单个关系类型

```bash
GET /api/knowledge-graph/relation-types/:id
```

**路径参数:**
- `id`: 关系类型ID (如 "family_parent")

**响应示例:**

```json
{
  "success": true,
  "data": {
    "relationTypeId": "family_parent",
    "name": "parent",
    "displayName": "父母",
    "description": "表示父母关系",
    "domain": "life",
    "category": "family",
    "sourceEntityTypes": ["PersonEntity"],
    "targetEntityTypes": ["PersonEntity"],
    "isDirectional": true,
    "isTemporal": false,
    "supportsConfidence": true,
    "version": "1.0.0",
    "active": true
  }
}
```

### 注册新关系类型

```bash
POST /api/knowledge-graph/relation-types
```

**请求体:**

```json
{
  "relationTypeId": "custom_relation",
  "name": "custom",
  "displayName": "自定义关系",
  "description": "自定义关系描述",
  "domain": "life",
  "category": "custom",
  "sourceEntityTypes": ["PersonEntity"],
  "targetEntityTypes": ["PersonEntity"],
  "isDirectional": true,
  "isTemporal": false,
  "supportsConfidence": true,
  "version": "1.0.0",
  "active": true
}
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "relationTypeId": "custom_relation",
    "name": "custom",
    "displayName": "自定义关系",
    ...
  }
}
```

### 更新关系类型

```bash
PUT /api/knowledge-graph/relation-types/:id
```

**请求体:**

```json
{
  "displayName": "新名称",
  "description": "更新的描述",
  "active": false
}
```

### 删除关系类型

```bash
DELETE /api/knowledge-graph/relation-types/:id
```

**响应示例:**

```json
{
  "success": true,
  "message": "Relation type deleted successfully"
}
```

### 获取关系类型统计

```bash
GET /api/knowledge-graph/relation-types-stats
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "total": 90,
    "active": 85,
    "inactive": 5,
    "byDomain": {
      "life": 17,
      "work": 15,
      "travel": 13,
      "shopping": 13,
      "government": 16,
      "management": 16
    },
    "byCategory": {
      "family": 6,
      "social": 4,
      "residence": 3,
      "health": 4
    }
  }
}
```

### 搜索关系类型

```bash
GET /api/knowledge-graph/relation-types-search?q=父母
```

**查询参数:**
- `q`: 搜索关键词

**响应示例:**

```json
{
  "success": true,
  "data": {
    "count": 1,
    "results": [
      {
        "relationTypeId": "family_parent",
        "name": "parent",
        "displayName": "父母",
        ...
      }
    ]
  }
}
```

### 获取兼容的关系类型

```bash
GET /api/knowledge-graph/relation-types-compatible?sourceEntityType=PersonEntity&targetEntityType=PersonEntity
```

**查询参数:**
- `sourceEntityType`: 源实体类型
- `targetEntityType` (可选): 目标实体类型
- `role` (可选): 角色 (source/target/both)

**响应示例:**

```json
{
  "success": true,
  "data": {
    "count": 15,
    "compatibleTypes": [
      {
        "relationTypeId": "family_parent",
        "name": "parent",
        "displayName": "父母",
        ...
      }
    ]
  }
}
```

## 11. 参考资源

### 11.1 相关文档

- [README.md](./README.md) - KG 模块概述
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 系统架构设计
- [SCHEMA_GUIDE.md](./SCHEMA_GUIDE.md) - Schema 定义指南
- [CONFIG.md](./CONFIG.md) - 配置说明

### 11.2 示例代码

完整的 API 使用示例请参考:
- `routes/knowledgeGraphRoutes.js` - 路由实现
- `routes/knowledgeGraphRoutes.test.js` - API 测试

### 11.3 在线工具

- Postman Collection: 导入 API 集合进行测试
- Swagger UI: 交互式 API 文档 (如果启用)

---

**文档版本**: v1.0.1  
**最后更新**: 2025-02-03  
**维护者**: Schema-Driven KG Team



---

## 9. Anchor System API

### 9.1 概述

锚点系统 (Anchor System) 是知识图谱的核心机制,用于实现确定性的实体识别和合并。本节介绍与锚点系统相关的 API 端点。

**关键概念**:
- **Anchor Fingerprint**: 基于语义关键字段生成的确定性标识符
- **Anchor Fields**: 用于生成锚点指纹的字段集合
- **Schema Instance**: Schema 匹配产生的中间表示
- **Compatibility Mode**: 兼容模式 (ANCHOR_ONLY, HYBRID, LEGACY)

### 9.2 处理文档 (带锚点支持)

**端点**: `POST /build`

**描述**: 处理文档并使用锚点系统构建知识图谱

**请求参数**:
```json
{
  "docId": "string",              // 文档 ID (必需)
  "ckbIds": ["string"],           // CKB ID 列表 (可选)
  "compatibilityMode": "string"   // 兼容模式 (可选): ANCHOR_ONLY, HYBRID, LEGACY
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "entities": [
      {
        "id": "entity-uuid-1",
        "name": "A7M4 摄影设置",
        "type": "PhotographyEntity",
        "properties": {
          "Camera": "A7M4",
          "Lens": "35mm F1.8",
          "ISO": "100"
        },
        "anchor_fingerprint": "PhotographyEntity|a7m4|35mm_f1.8",
        "anchor_fields": {
          "Camera": "A7M4",
          "Lens": "35mm F1.8"
        },
        "schemas": ["Photography Setup A", "Photography Setup B"],
        "ckb_ids": ["ckb-uuid-1", "ckb-uuid-2"],
        "confidence": 0.92,
        "created_at": "2026-02-08T10:00:00Z"
      }
    ],
    "relations": [...],
    "anchorStats": {
      "totalInstances": 10,
      "uniqueAnchors": 5,
      "mergedEntities": 5,
      "conflictsDetected": 1,
      "llmAdvisoryUsed": 1
    },
    "stats": {
      "entities_created": 5,
      "relations_created": 8,
      "processing_time_ms": 1250
    }
  }
}
```

**新增字段说明**:
- `anchor_fingerprint`: 实体的锚点指纹 (确定性标识符)
- `anchor_fields`: 用于生成锚点的字段值
- `schemas`: 该实体由哪些 Schema 合并而来
- `anchorStats`: 锚点系统统计信息

**示例**:
```bash
# 使用锚点系统处理文档
curl -X POST http://localhost:3000/api/knowledge-graph/build \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "docId": "doc-123",
    "compatibilityMode": "ANCHOR_ONLY"
  }'
```

### 9.3 按锚点查询实体

**端点**: `GET /entities/by-anchor/:anchorFingerprint`

**描述**: 根据锚点指纹查询实体

**路径参数**:
- `anchorFingerprint`: 锚点指纹 (必需)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "entity": {
      "id": "entity-uuid-1",
      "name": "A7M4 摄影设置",
      "anchor_fingerprint": "PhotographyEntity|a7m4|35mm_f1.8",
      "anchor_fields": {
        "Camera": "A7M4",
        "Lens": "35mm F1.8"
      },
      ...
    }
  }
}
```

**错误响应**:
- `404`: 未找到匹配的实体

**示例**:
```bash
curl -X GET "http://localhost:3000/api/knowledge-graph/entities/by-anchor/PhotographyEntity%7Ca7m4%7C35mm_f1.8" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 9.4 获取锚点统计

**端点**: `GET /anchors/stats`

**描述**: 获取锚点系统的统计信息

**查询参数**:
- `entityType`: 按实体类型筛选 (可选)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_entities": 1000,
    "entities_with_anchors": 950,
    "anchor_coverage": 0.95,
    "unique_anchors": 800,
    "merge_ratio": 1.19,
    "by_entity_type": {
      "PhotographyEntity": {
        "total": 200,
        "with_anchors": 195,
        "unique_anchors": 150,
        "merge_ratio": 1.30
      },
      "EventEntity": {
        "total": 300,
        "with_anchors": 290,
        "unique_anchors": 250,
        "merge_ratio": 1.16
      }
    },
    "top_anchors": [
      {
        "anchor": "PhotographyEntity|a7m4|35mm_f1.8",
        "entity_count": 5,
        "schemas": ["Photography Setup A", "Photography Setup B"]
      }
    ]
  }
}
```

**字段说明**:
- `anchor_coverage`: 有锚点的实体占比
- `merge_ratio`: 平均每个锚点合并的实体数
- `top_anchors`: 最常见的锚点 (合并最多实体的锚点)

**示例**:
```bash
# 获取所有锚点统计
curl -X GET http://localhost:3000/api/knowledge-graph/anchors/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# 获取特定类型的锚点统计
curl -X GET "http://localhost:3000/api/knowledge-graph/anchors/stats?entityType=PhotographyEntity" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 9.5 查找相似锚点

**端点**: `POST /anchors/similar`

**描述**: 查找与给定字段相似的锚点

**请求参数**:
```json
{
  "entityType": "string",           // 实体类型 (必需)
  "fields": {                       // 字段值 (必需)
    "Camera": "A7M4",
    "Lens": "35mm F1.8"
  },
  "threshold": 0.8                  // 相似度阈值 (可选,默认: 0.8)
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "entity_id": "entity-uuid-1",
        "anchor_fingerprint": "PhotographyEntity|a7m4|35mm_f1.8",
        "similarity": 1.0,
        "fields": {
          "Camera": "A7M4",
          "Lens": "35mm F1.8"
        }
      },
      {
        "entity_id": "entity-uuid-2",
        "anchor_fingerprint": "PhotographyEntity|a7m4|50mm_f1.8",
        "similarity": 0.85,
        "fields": {
          "Camera": "A7M4",
          "Lens": "50mm F1.8"
        }
      }
    ]
  }
}
```

**示例**:
```bash
curl -X POST http://localhost:3000/api/knowledge-graph/anchors/similar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "PhotographyEntity",
    "fields": {
      "Camera": "A7M4",
      "Lens": "35mm F1.8"
    },
    "threshold": 0.8
  }'
```

### 9.6 检测锚点冲突

**端点**: `POST /anchors/detect-conflicts`

**描述**: 检测给定锚点下的实体是否存在冲突

**请求参数**:
```json
{
  "anchorFingerprint": "string"     // 锚点指纹 (必需)
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "hasConflict": true,
    "conflictType": "value_conflict",
    "severity": "medium",
    "details": {
      "field": "ISO",
      "values": ["100", "200", "400"],
      "instances": 3
    },
    "recommendation": {
      "action": "merge",
      "reasoning": "ISO值差异在可接受范围内,建议合并并保留所有值",
      "confidence": 0.85
    }
  }
}
```

**冲突类型**:
- `time_inconsistency`: 时间不一致
- `value_conflict`: 数值冲突
- `state_contradiction`: 状态矛盾

**严重程度**:
- `low`: 轻微冲突,可自动处理
- `medium`: 中等冲突,建议人工审核
- `high`: 严重冲突,需要人工介入

**示例**:
```bash
curl -X POST http://localhost:3000/api/knowledge-graph/anchors/detect-conflicts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "anchorFingerprint": "PhotographyEntity|a7m4|35mm_f1.8"
  }'
```

### 9.7 获取 Schema 的锚点配置

**端点**: `GET /schemas/:id/anchor-config`

**描述**: 获取 Schema 的锚点字段配置

**路径参数**:
- `id`: Schema ID (必需)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "schema_id": "schema-uuid-1",
    "schema_name": "Photography Setup A",
    "entity_type": "PhotographyEntity",
    "anchor_fields": ["Camera", "Lens"],
    "anchor_config": {
      "normalization": {
        "Camera": "lowercase",
        "Lens": "lowercase"
      },
      "required": ["Camera"],
      "optional": ["Lens"]
    },
    "example_anchor": "PhotographyEntity|a7m4|35mm_f1.8"
  }
}
```

**字段说明**:
- `anchor_fields`: 用于生成锚点的字段列表
- `normalization`: 字段标准化策略
- `required`: 必需的锚点字段
- `optional`: 可选的锚点字段
- `example_anchor`: 示例锚点指纹

**示例**:
```bash
curl -X GET http://localhost:3000/api/knowledge-graph/schemas/schema-uuid-1/anchor-config \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 9.8 更新 Schema 的锚点配置

**端点**: `PUT /schemas/:id/anchor-config`

**描述**: 更新 Schema 的锚点字段配置

**路径参数**:
- `id`: Schema ID (必需)

**请求参数**:
```json
{
  "anchor_fields": ["Camera", "Lens", "Timestamp"],
  "anchor_config": {
    "normalization": {
      "Camera": "lowercase",
      "Lens": "lowercase",
      "Timestamp": "time_day"
    },
    "required": ["Camera"],
    "optional": ["Lens", "Timestamp"]
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "schema_id": "schema-uuid-1",
    "updated": true,
    "message": "锚点配置已更新"
  }
}
```

**注意事项**:
- 更新锚点配置会影响后续生成的实体
- 已存在的实体不会自动更新,需要重新处理
- 建议在更新前备份数据

**示例**:
```bash
curl -X PUT http://localhost:3000/api/knowledge-graph/schemas/schema-uuid-1/anchor-config \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "anchor_fields": ["Camera", "Lens", "Timestamp"],
    "anchor_config": {
      "normalization": {
        "Camera": "lowercase",
        "Lens": "lowercase",
        "Timestamp": "time_day"
      }
    }
  }'
```

### 9.9 验证锚点配置

**端点**: `POST /schemas/validate-anchor-config`

**描述**: 验证锚点配置是否正确

**请求参数**:
```json
{
  "schema_id": "string",            // Schema ID (必需)
  "anchor_fields": ["string"],      // 锚点字段列表 (必需)
  "anchor_config": {                // 锚点配置 (可选)
    "normalization": {
      "field1": "strategy1"
    }
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "warnings": [
      "字段 'Timestamp' 建议使用时间标准化策略"
    ],
    "suggestions": [
      "考虑添加 'Location' 字段以提高锚点唯一性"
    ]
  }
}
```

**验证项**:
- 锚点字段是否存在于 Schema 定义中
- 标准化策略是否有效
- 锚点字段组合是否足够唯一
- 是否有改进建议

**示例**:
```bash
curl -X POST http://localhost:3000/api/knowledge-graph/schemas/validate-anchor-config \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schema_id": "schema-uuid-1",
    "anchor_fields": ["Camera", "Lens"],
    "anchor_config": {
      "normalization": {
        "Camera": "lowercase",
        "Lens": "lowercase"
      }
    }
  }'
```

### 9.10 重新生成实体锚点

**端点**: `POST /entities/:id/regenerate-anchor`

**描述**: 为指定实体重新生成锚点指纹

**路径参数**:
- `id`: 实体 ID (必需)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "entity_id": "entity-uuid-1",
    "old_anchor": "PhotographyEntity|a7m4|35mm",
    "new_anchor": "PhotographyEntity|a7m4|35mm_f1.8",
    "updated": true
  }
}
```

**使用场景**:
- Schema 锚点配置更新后
- 实体数据修正后
- 锚点指纹格式错误

**示例**:
```bash
curl -X POST http://localhost:3000/api/knowledge-graph/entities/entity-uuid-1/regenerate-anchor \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 9.11 批量重新生成锚点

**端点**: `POST /entities/batch-regenerate-anchors`

**描述**: 批量为实体重新生成锚点指纹

**请求参数**:
```json
{
  "entityType": "string",           // 实体类型 (可选)
  "schemaId": "string",             // Schema ID (可选)
  "entityIds": ["string"],          // 实体 ID 列表 (可选)
  "dryRun": false                   // 是否仅模拟 (可选,默认: false)
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": 100,
    "updated": 95,
    "skipped": 5,
    "errors": 0,
    "details": [
      {
        "entity_id": "entity-uuid-1",
        "old_anchor": "PhotographyEntity|a7m4|35mm",
        "new_anchor": "PhotographyEntity|a7m4|35mm_f1.8",
        "status": "updated"
      }
    ]
  }
}
```

**示例**:
```bash
# 重新生成所有 PhotographyEntity 的锚点
curl -X POST http://localhost:3000/api/knowledge-graph/entities/batch-regenerate-anchors \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "PhotographyEntity",
    "dryRun": false
  }'

# 模拟运行 (不实际更新)
curl -X POST http://localhost:3000/api/knowledge-graph/entities/batch-regenerate-anchors \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "PhotographyEntity",
    "dryRun": true
  }'
```

---

## 10. 兼容性和迁移

### 10.1 兼容模式

系统支持三种兼容模式:

| 模式 | 说明 | 使用场景 |
|------|------|----------|
| `ANCHOR_ONLY` | 仅使用锚点系统 | 新部署,完全迁移后 |
| `HYBRID` | 同时支持锚点和传统模式 | 渐进式迁移,测试阶段 |
| `LEGACY` | 仅使用传统模式 | 回滚,兼容性需求 |

### 10.2 设置兼容模式

**全局配置**:
```javascript
// config/anchor.config.js
module.exports = {
  mode: 'ANCHOR_ONLY'  // or 'HYBRID' or 'LEGACY'
};
```

**请求级别配置**:
```json
{
  "docId": "doc-123",
  "compatibilityMode": "ANCHOR_ONLY"
}
```

### 10.3 迁移建议

1. **开发环境**: 使用 `ANCHOR_ONLY` 模式测试
2. **测试环境**: 使用 `HYBRID` 模式验证
3. **生产环境**: 
   - 初期使用 `HYBRID` 模式
   - 验证稳定后切换到 `ANCHOR_ONLY`
   - 保留 `LEGACY` 模式作为回滚选项

---

## 11. 错误码参考

### 11.1 锚点系统错误码

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| `ANCHOR_001` | Schema 未配置锚点字段 | 为 Schema 添加 anchor_fields 配置 |
| `ANCHOR_002` | 锚点字段值缺失 | 确保所有锚点字段都有值 |
| `ANCHOR_003` | 锚点指纹格式错误 | 重新生成锚点指纹 |
| `ANCHOR_004` | 标准化策略无效 | 使用有效的标准化策略 |
| `ANCHOR_005` | 冲突检测失败 | 检查冲突检测配置 |
| `ANCHOR_006` | LLM 建议服务不可用 | 检查 API 密钥或禁用 LLM 建议 |

### 11.2 错误响应示例

```json
{
  "success": false,
  "error": {
    "code": "ANCHOR_001",
    "message": "Schema 'Photography Setup A' 未配置锚点字段",
    "details": {
      "schema_id": "schema-uuid-1",
      "schema_name": "Photography Setup A"
    },
    "suggestion": "请为该 Schema 添加 anchor_fields 配置"
  }
}
```

---

## 12. 最佳实践

### 12.1 锚点字段选择

**推荐做法**:
- 选择语义上唯一标识实体的字段
- 包含 2-4 个字段 (太少不够唯一,太多影响性能)
- 优先选择稳定的字段 (不经常变化)
- 考虑时间粒度 (使用 time_month 而非精确时间戳)

**示例**:
```json
{
  "anchor_fields": ["Location", "Indicator", "Timestamp"],
  "anchor_config": {
    "normalization": {
      "Location": "lowercase",
      "Indicator": "lowercase",
      "Timestamp": "time_month"
    }
  }
}
```

### 12.2 性能优化

**批量处理**:
```bash
# 批量处理多个文档
curl -X POST http://localhost:3000/api/knowledge-graph/build-batch \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "docIds": ["doc-1", "doc-2", "doc-3"],
    "compatibilityMode": "ANCHOR_ONLY"
  }'
```

**缓存利用**:
- 启用锚点指纹缓存
- 使用批量 API 减少请求次数
- 合理设置分页大小

### 12.3 监控和调试

**监控指标**:
- 锚点覆盖率 (目标: >90%)
- 合并比率 (平均每个锚点合并的实体数)
- 冲突检测率
- LLM 建议使用率

**调试工具**:
```bash
# 获取锚点统计
curl -X GET http://localhost:3000/api/knowledge-graph/anchors/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# 检测特定锚点的冲突
curl -X POST http://localhost:3000/api/knowledge-graph/anchors/detect-conflicts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"anchorFingerprint": "..."}'
```

---

## 附录

### A. 标准化策略参考

| 策略 | 说明 | 示例 |
|------|------|------|
| `lowercase` | 转换为小写 | "A7M4" → "a7m4" |
| `time_year` | 标准化到年 | "2026-01-20" → "2026" |
| `time_month` | 标准化到月 | "2026-01-20" → "2026-01" |
| `time_day` | 标准化到日 | "2026-01-20" → "2026-01-20" |
| `location` | 位置标准化 | "阿里C区" → "c_zone" |
| `indicator` | 指标标准化 | "地下水位" → "groundwater_level" |
| `none` | 不标准化 | "A7M4" → "A7M4" |

### B. 相关文档

- **架构文档**: `kg/entity/ANCHOR_ARCHITECTURE.md`
- **开发者指南**: `kg/entity/ANCHOR_DEVELOPER_GUIDE.md`
- **Schema 配置指南**: `kg/schema/ANCHOR_FIELDS_GUIDE.md`
- **迁移指南**: `kg/entity/MIGRATION_GUIDE.md`
- **故障排查**: `kg/entity/TROUBLESHOOTING.md`

### C. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 2.0 | 2026-02-08 | 添加锚点系统 API |
| 1.0 | 2025-02-01 | 初始版本 |

---

**文档更新日期**: 2026-02-08  
**API 版本**: 2.0  
**锚点系统版本**: 1.0
