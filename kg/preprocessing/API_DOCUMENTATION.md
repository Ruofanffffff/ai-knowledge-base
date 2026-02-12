# LLM文档索引预处理 API 文档

## 概述

本文档详细说明LLM文档索引预处理系统提供的所有API接口。

## 基础信息

- **Base URL**: `/api/preprocessing`
- **Content-Type**: `application/json`
- **认证**: 根据系统配置（如需要）

## API端点

### 1. 文档索引管理

#### 1.1 获取文档索引

获取指定文档的索引叙述文本（最新版本或指定版本）。

**请求**

```
GET /api/preprocessing/index/:docId?version=<version>
```

**路径参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| docId | string | 是 | 文档ID |

**查询参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| version | integer | 否 | 版本号，不指定则返回最新版本 |

**响应示例**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "docId": "doc-123",
    "indexedText": "1. 2025年1月，阿里C区地下水位监测显示水位为45.2米。\n2. 阿里C区位于海南省海口市美兰区。\n3. 该监测点编号为ALI-C-001，由海南省水文局负责管理。",
    "version": 2,
    "metadata": {
      "llm_model": "qwen-plus",
      "token_count": 150,
      "fact_count": 3,
      "generated_at": "2025-01-15T10:30:00Z"
    },
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T10:30:00Z"
  }
}
```

**错误响应**

```json
{
  "success": false,
  "error": "Document index not found"
}
```

#### 1.2 获取所有版本

获取指定文档的所有索引版本列表。

**请求**

```
GET /api/preprocessing/index/:docId/versions?orderBy=<order>&skip=<skip>&take=<take>
```

**路径参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| docId | string | 是 | 文档ID |

**查询参数**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| orderBy | string | 否 | desc | 排序方式：asc（升序）或 desc（降序） |
| skip | integer | 否 | 0 | 跳过的记录数（分页） |
| take | integer | 否 | 10 | 返回的记录数（分页） |

**响应示例**

```json
{
  "success": true,
  "data": {
    "docId": "doc-123",
    "count": 3,
    "versions": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440003",
        "version": 3,
        "metadata": {
          "fact_count": 5,
          "token_count": 200,
          "llm_model": "qwen-plus"
        },
        "createdAt": "2025-01-15T12:00:00Z",
        "updatedAt": "2025-01-15T12:00:00Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "version": 2,
        "metadata": {
          "fact_count": 3,
          "token_count": 150,
          "llm_model": "qwen-plus"
        },
        "createdAt": "2025-01-15T10:30:00Z",
        "updatedAt": "2025-01-15T10:30:00Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "version": 1,
        "metadata": {
          "fact_count": 2,
          "token_count": 100,
          "llm_model": "qwen-plus"
        },
        "createdAt": "2025-01-15T09:00:00Z",
        "updatedAt": "2025-01-15T09:00:00Z"
      }
    ]
  }
}
```

#### 1.3 获取版本历史

获取指定文档的版本历史摘要。

**请求**

```
GET /api/preprocessing/index/:docId/history
```

**路径参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| docId | string | 是 | 文档ID |

**响应示例**

```json
{
  "success": true,
  "data": {
    "docId": "doc-123",
    "totalVersions": 3,
    "latestVersion": 3,
    "firstCreated": "2025-01-15T09:00:00Z",
    "lastUpdated": "2025-01-15T12:00:00Z",
    "versions": [
      {
        "version": 3,
        "factCount": 5,
        "tokenCount": 200,
        "llmModel": "qwen-plus",
        "createdAt": "2025-01-15T12:00:00Z"
      },
      {
        "version": 2,
        "factCount": 3,
        "tokenCount": 150,
        "llmModel": "qwen-plus",
        "createdAt": "2025-01-15T10:30:00Z"
      },
      {
        "version": 1,
        "factCount": 2,
        "tokenCount": 100,
        "llmModel": "qwen-plus",
        "createdAt": "2025-01-15T09:00:00Z"
      }
    ]
  }
}
```

#### 1.4 比较版本

比较指定文档的两个版本。

**请求**

```
GET /api/preprocessing/index/:docId/compare?version1=<v1>&version2=<v2>
```

**路径参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| docId | string | 是 | 文档ID |

**查询参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| version1 | integer | 是 | 第一个版本号 |
| version2 | integer | 是 | 第二个版本号 |

**响应示例**

```json
{
  "success": true,
  "data": {
    "docId": "doc-123",
    "version1": {
      "version": 1,
      "createdAt": "2025-01-15T09:00:00Z",
      "factCount": 2,
      "tokenCount": 100
    },
    "version2": {
      "version": 2,
      "createdAt": "2025-01-15T10:30:00Z",
      "factCount": 3,
      "tokenCount": 150
    },
    "comparison": {
      "text": {
        "identical": false,
        "similarity": 0.85,
        "lengthDiff": 50,
        "length1": 100,
        "length2": 150
      },
      "metadata": {
        "factCountDiff": 1,
        "tokenCountDiff": 50,
        "modelChanged": false,
        "model1": "qwen-plus",
        "model2": "qwen-plus"
      },
      "facts": {
        "totalFacts1": 2,
        "totalFacts2": 3,
        "added": 1,
        "removed": 0,
        "modified": 0,
        "unchanged": 2,
        "addedFacts": [
          {
            "index": 3,
            "text": "该监测点编号为ALI-C-001，由海南省水文局负责管理。"
          }
        ],
        "removedFacts": [],
        "modifiedFacts": []
      }
    }
  }
}
```

#### 1.5 重新生成索引

重新生成指定文档的索引叙述文本（创建新版本）。

**请求**

```
POST /api/preprocessing/index/:docId/regenerate
Content-Type: application/json
```

**路径参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| docId | string | 是 | 文档ID |

**请求体**

```json
{
  "text": "文档的完整文本内容...",
  "llmConfig": {
    "model": "qwen-plus",
    "temperature": 0.1,
    "maxTokens": 2000
  }
}
```

**请求体参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| text | string | 是 | 文档文本内容 |
| llmConfig | object | 否 | LLM配置（可选） |
| llmConfig.model | string | 否 | LLM模型名称 |
| llmConfig.temperature | float | 否 | 温度参数（0-1） |
| llmConfig.maxTokens | integer | 否 | 最大Token数 |

**响应示例**

```json
{
  "success": true,
  "message": "Document index regenerated successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440004",
    "docId": "doc-123",
    "version": 4,
    "metadata": {
      "fact_count": 6,
      "token_count": 220,
      "llm_model": "qwen-plus",
      "generated_at": "2025-01-15T14:00:00Z"
    },
    "createdAt": "2025-01-15T14:00:00Z"
  }
}
```

**错误响应**

```json
{
  "success": false,
  "error": "LLM call failed: timeout"
}
```

#### 1.6 删除版本

删除指定文档的指定版本。

**请求**

```
DELETE /api/preprocessing/index/:docId/version/:version
```

**路径参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| docId | string | 是 | 文档ID |
| version | integer | 是 | 版本号 |

**响应示例**

```json
{
  "success": true,
  "message": "Version 2 deleted successfully"
}
```

**错误响应**

```json
{
  "success": false,
  "error": "Version not found"
}
```

### 2. 矫正统计

#### 2.1 获取矫正统计

获取指定文档的矫正统计信息。

**请求**

```
GET /api/preprocessing/stats/:docId?stage=<stage>
```

**路径参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| docId | string | 是 | 文档ID |

**查询参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| stage | string | 否 | 处理阶段（不指定则返回所有阶段） |

**有效的stage值**:
- `cbk_correction` - CKB描述矫正
- `field_extraction` - 字段提取矫正
- `schema_selection` - Schema选择矫正
- `entity_merge` - 实体合并矫正
- `relation_extraction` - 关系抽取矫正

**响应示例**

```json
{
  "success": true,
  "data": {
    "docId": "doc-123",
    "stages": {
      "field_extraction": {
        "totalCorrections": 5,
        "accuracyBefore": 0.75,
        "accuracyAfter": 0.90,
        "recallBefore": 0.70,
        "recallAfter": 0.88,
        "precisionBefore": 0.80,
        "precisionAfter": 0.92,
        "metadata": {
          "missingFieldsFound": 3,
          "redundantFieldsRemoved": 2
        }
      },
      "relation_extraction": {
        "totalCorrections": 3,
        "accuracyBefore": 0.80,
        "accuracyAfter": 0.92,
        "recallBefore": 0.75,
        "recallAfter": 0.90,
        "precisionBefore": 0.85,
        "precisionAfter": 0.94,
        "metadata": {
          "missingRelationsFound": 2,
          "incorrectRelationsRemoved": 1
        }
      }
    }
  }
}
```

#### 2.2 获取矫正记录

获取指定文档的详细矫正记录。

**请求**

```
GET /api/preprocessing/corrections/:docId?stage=<stage>&limit=<limit>
```

**路径参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| docId | string | 是 | 文档ID |

**查询参数**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| stage | string | 否 | - | 处理阶段（不指定则返回所有阶段） |
| limit | integer | 否 | 50 | 返回的记录数 |

**响应示例**

```json
{
  "success": true,
  "data": {
    "docId": "doc-123",
    "count": 8,
    "corrections": [
      {
        "id": "corr-001",
        "stage": "field_extraction",
        "correctionType": "missing_field_added",
        "originalValue": null,
        "correctedValue": "{\"name\": \"监测点编号\", \"value\": \"ALI-C-001\"}",
        "confidenceBefore": null,
        "confidenceAfter": 0.90,
        "metadata": {
          "sourceIndex": 3,
          "reason": "Found in indexed text but not extracted"
        },
        "createdAt": "2025-01-15T10:35:00Z"
      },
      {
        "id": "corr-002",
        "stage": "relation_extraction",
        "correctionType": "missing_relation_added",
        "originalValue": null,
        "correctedValue": "{\"subject\": \"阿里C区\", \"relation\": \"位于\", \"object\": \"海南省海口市美兰区\"}",
        "confidenceBefore": null,
        "confidenceAfter": 0.88,
        "metadata": {
          "sourceIndex": 2,
          "reason": "Relation mentioned in indexed text"
        },
        "createdAt": "2025-01-15T10:40:00Z"
      }
    ]
  }
}
```

### 3. 图谱描述

#### 3.1 获取图谱描述

获取指定文档的知识图谱描述。

**请求**

```
GET /api/preprocessing/description/:docId/:type
```

**路径参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| docId | string | 是 | 文档ID |
| type | string | 是 | 描述类型：brief（简要）或 detailed（详细） |

**响应示例（简要描述）**

```json
{
  "success": true,
  "data": {
    "id": "desc-001",
    "docId": "doc-123",
    "descriptionType": "brief",
    "description": "图谱包含 5 个实体和 3 个关系。主要实体包括：阿里C区（地点）、海南省水文局（组织）、ALI-C-001（监测点）。关键关系：阿里C区位于海南省海口市美兰区，监测点由海南省水文局管理。",
    "metadata": {
      "entityCount": 5,
      "relationCount": 3,
      "consistencyScore": 0.92
    },
    "createdAt": "2025-01-15T10:45:00Z"
  }
}
```

**响应示例（详细描述）**

```json
{
  "success": true,
  "data": {
    "id": "desc-002",
    "docId": "doc-123",
    "descriptionType": "detailed",
    "description": "# 知识图谱详细描述\n\n## 实体列表\n\n1. **阿里C区** (地点)\n   - 水位: 45.2米\n   - 位置: 海南省海口市美兰区\n\n2. **海南省水文局** (组织)\n   - 角色: 监测点管理单位\n\n3. **ALI-C-001** (监测点)\n   - 类型: 地下水位监测点\n   - 管理单位: 海南省水文局\n\n## 关系列表\n\n1. 阿里C区 --位于--> 海南省海口市美兰区\n2. ALI-C-001 --管理者--> 海南省水文局\n3. ALI-C-001 --监测对象--> 阿里C区\n\n## 图谱结构\n\n图谱呈现星型结构，以阿里C区为中心，连接监测点和管理单位。",
    "metadata": {
      "entityCount": 5,
      "relationCount": 3,
      "consistencyScore": 0.92
    },
    "createdAt": "2025-01-15T10:45:00Z"
  }
}
```

**错误响应**

```json
{
  "success": false,
  "error": "Description not found"
}
```

### 4. 监控和性能

#### 4.1 获取性能指标

获取预处理系统的性能指标。

**请求**

```
GET /api/preprocessing/metrics?operation=<operation>&period=<period>
```

**查询参数**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| operation | string | 否 | all | 操作类型（不指定则返回所有操作） |
| period | string | 否 | 1h | 时间范围：1h, 24h, 7d, 30d |

**有效的operation值**:
- `document_index` - 文档索引生成
- `cbk_correction` - CKB描述矫正
- `field_correction` - 字段提取矫正
- `schema_correction` - Schema选择矫正
- `merge_correction` - 实体合并矫正
- `relation_correction` - 关系抽取矫正
- `graph_description` - 图谱描述生成

**响应示例**

```json
{
  "success": true,
  "data": {
    "period": "1h",
    "operations": {
      "document_index": {
        "totalCalls": 50,
        "successRate": 0.96,
        "timeouts": 2,
        "cacheHitRate": 0.15,
        "latency": {
          "p50": 3200,
          "p95": 8500,
          "p99": 12000,
          "avg": 4100
        }
      },
      "field_correction": {
        "totalCalls": 120,
        "successRate": 0.98,
        "timeouts": 1,
        "cacheHitRate": 0.35,
        "latency": {
          "p50": 1500,
          "p95": 3200,
          "p99": 5000,
          "avg": 1800
        }
      }
    }
  }
}
```

#### 4.2 获取系统状态

获取预处理系统的当前状态。

**请求**

```
GET /api/preprocessing/status
```

**响应示例**

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "llmAvailable": true,
    "queueStatus": {
      "pending": 3,
      "running": 5,
      "maxConcurrency": 5
    },
    "cacheStatus": {
      "enabled": true,
      "size": 450,
      "maxSize": 1000,
      "hitRate": 0.32
    },
    "config": {
      "temperature": 0.1,
      "maxTokens": 2000,
      "fieldCoverageThreshold": 0.8,
      "relationCoverageThreshold": 0.7,
      "schemaConfidenceThreshold": 0.75
    }
  }
}
```

## 错误代码

| 状态码 | 错误代码 | 说明 |
|--------|----------|------|
| 400 | INVALID_REQUEST | 请求参数无效 |
| 404 | NOT_FOUND | 资源不存在 |
| 408 | TIMEOUT | 请求超时 |
| 500 | INTERNAL_ERROR | 内部服务器错误 |
| 503 | SERVICE_UNAVAILABLE | LLM服务不可用 |

## 使用示例

### JavaScript/Node.js

```javascript
const axios = require('axios');

// 获取文档索引
async function getDocumentIndex(docId, version = null) {
  const url = version 
    ? `/api/preprocessing/index/${docId}?version=${version}`
    : `/api/preprocessing/index/${docId}`;
  
  const response = await axios.get(url);
  return response.data;
}

// 重新生成索引
async function regenerateIndex(docId, text, llmConfig = {}) {
  const response = await axios.post(
    `/api/preprocessing/index/${docId}/regenerate`,
    { text, llmConfig }
  );
  return response.data;
}

// 获取矫正统计
async function getCorrectionStats(docId, stage = null) {
  const url = stage
    ? `/api/preprocessing/stats/${docId}?stage=${stage}`
    : `/api/preprocessing/stats/${docId}`;
  
  const response = await axios.get(url);
  return response.data;
}

// 比较版本
async function compareVersions(docId, version1, version2) {
  const response = await axios.get(
    `/api/preprocessing/index/${docId}/compare?version1=${version1}&version2=${version2}`
  );
  return response.data;
}
```

### Python

```python
import requests

BASE_URL = "http://localhost:3000/api/preprocessing"

# 获取文档索引
def get_document_index(doc_id, version=None):
    url = f"{BASE_URL}/index/{doc_id}"
    if version:
        url += f"?version={version}"
    
    response = requests.get(url)
    return response.json()

# 重新生成索引
def regenerate_index(doc_id, text, llm_config=None):
    url = f"{BASE_URL}/index/{doc_id}/regenerate"
    data = {"text": text}
    if llm_config:
        data["llmConfig"] = llm_config
    
    response = requests.post(url, json=data)
    return response.json()

# 获取矫正统计
def get_correction_stats(doc_id, stage=None):
    url = f"{BASE_URL}/stats/{doc_id}"
    if stage:
        url += f"?stage={stage}"
    
    response = requests.get(url)
    return response.json()
```

## 速率限制

为保护系统资源，API实施以下速率限制：

- 每个IP每分钟最多100个请求
- 重新生成索引操作每个文档每小时最多5次
- 超过限制将返回429状态码

## 相关文档

- [README](./README.md) - 系统概述
- [配置指南](./CONFIG_GUIDE.md) - 配置选项
- [故障排查指南](./TROUBLESHOOTING.md) - 问题解决
