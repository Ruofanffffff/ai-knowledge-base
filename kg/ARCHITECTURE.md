# Schema 驱动知识图谱系统 - 架构设计文档

## 1. 系统概述

Schema 驱动知识图谱系统是一个智能的知识抽取和图谱构建系统,采用模块化、分层的架构设计,能够从非结构化文档中自动提取结构化知识,并构建高质量的知识图谱。

### 1.1 设计目标

- **高质量**: 通过 Schema 驱动和多层验证确保知识质量
- **低成本**: 智能控制 LLM 调用,降低 Token 成本
- **高性能**: 本地处理 + LLM 结合,优化处理速度
- **可扩展**: 模块化设计,易于扩展和定制
- **可维护**: 清晰的架构和完善的文档

### 1.2 核心特性

- Schema 驱动的知识抽取
- 4 层字段映射策略
- 智能 Token 优化
- 置信度管理和质量过滤
- 多类型关系构建
- 图遍历和查询

## 2. 整体架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端层 (Frontend)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  SchemaKG    │  │ CKBExplorer  │  │  Statistics  │         │
│  │   可视化     │  │   浏览器     │  │    统计      │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP/REST API
┌─────────────────────────────────────────────────────────────────┐
│                         API 层 (API Layer)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  KG Routes   │  │ Schema Routes│  │  Stats Routes│         │
│  │  知识图谱    │  │  Schema管理  │  │    统计      │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      服务层 (Service Layer)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  KG Service  │  │Graph Traversal│ │ Token Tracker│         │
│  │  图谱构建    │  │   图遍历     │  │  Token追踪   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      核心层 (Core Layer)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  CKB Parser  │  │Field Extractor│ │Field Normalizer│       │
│  │  CKB解析     │  │  字段抽取    │  │  字段清洗    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │Schema Matcher│  │Entity Builder │  │Relation Builder│       │
│  │ Schema匹配   │  │  实体构建    │  │  关系构建    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │Confidence Eng│  │Quality Filter │                            │
│  │  置信度引擎  │  │  质量过滤    │                            │
│  └──────────────┘  └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      数据层 (Data Layer)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Prisma     │  │  LLM Cache   │  │ Synonym Dict │         │
│  │   数据库     │  │  LLM缓存     │  │  同义词词典  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      外部服务 (External Services)                │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │  Qwen API    │  │ DeepSeek API │                            │
│  │  通义千问    │  │  DeepSeek    │                            │
│  └──────────────┘  └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流图

```
文档 (Document)
    ↓
┌─────────────────────┐
│  1. CKB 解析        │  解析文档,提取知识块
│  (CKB Parser)       │  支持: Word, PDF, Excel, Markdown
└─────────────────────┘
    ↓ CKB 列表
┌─────────────────────┐
│  2. 字段抽取        │  从 CKB 中抽取结构化字段
│  (Field Extractor)  │  策略: 规则 + NER + LLM
└─────────────────────┘
    ↓ 原始字段
┌─────────────────────┐
│  3. 字段清洗        │  映射到标准 Schema 字段
│  (Field Normalizer) │  4层: 精确 → 相似度 → 同义词 → LLM
└─────────────────────┘
    ↓ 标准化字段
┌─────────────────────┐
│  4. Schema 匹配     │  匹配最相关的 Schema
│  (Schema Matcher)   │  基于字段覆盖率和语义相似度
└─────────────────────┘
    ↓ 匹配的 Schema
┌─────────────────────┐
│  5. 实体构建        │  构建实体实例
│  (Entity Builder)   │  生成规范名称,消歧,属性增强
└─────────────────────┘
    ↓ 实体列表
┌─────────────────────┐
│  6. 关系构建        │  构建实体间关系
│  (Relation Builder) │  类型: 内建 + 共现 + 语义
└─────────────────────┘
    ↓ 关系列表
┌─────────────────────┐
│  7. 置信度计算      │  计算实体和关系的置信度
│  (Confidence Engine)│  级联更新机制
└─────────────────────┘
    ↓ 带置信度的图谱
┌─────────────────────┐
│  8. 质量过滤        │  过滤低质量数据
│  (Quality Filter)   │  冲突消解
└─────────────────────┘
    ↓
知识图谱 (Knowledge Graph)
```

## 3. 核心模块设计

### 3.1 CKB Parser (CKB 解析器)

**职责**: 解析文档,提取结构化的知识块

**输入**: 文档 (Document)
**输出**: CKB 列表 (Common Knowledge Base)

**组件**:
- `ckb_parser.js` - 主解析器
- `word_parser.js` - Word 文档解析
- `pdf_parser.js` - PDF 文档解析
- `excel_parser.js` - Excel 文档解析
- `ckb_store.js` - CKB 存储

**关键算法**:
1. 文档结构分析
2. 章节识别
3. 内容提取
4. 元数据提取

**数据模型**:
```javascript
{
  id: string,
  doc_id: string,
  source_type: 'word' | 'pdf' | 'excel' | 'markdown',
  source_meta: {
    file_name: string,
    page: number,
    sheet_name: string,
    row: number
  },
  structure: {
    section_title: string,
    level: number
  },
  content: {
    text: string,
    language: string
  },
  quality: {
    source_confidence: number
  }
}
```

### 3.2 Field Extractor (字段抽取器)

**职责**: 从 CKB 中抽取结构化字段

**输入**: CKB
**输出**: 原始字段 (Raw Fields)

**组件**:
- `field_extractor.js` - 主抽取器
- `rule_extractor.js` - 规则抽取
- `ner_extractor.js` - NER 抽取
- `llm_extractor.js` - LLM 抽取

**抽取策略**:
1. **规则抽取** (Rule-based)
   - 正则表达式匹配
   - 模式识别
   - 快速,无成本

2. **NER 抽取** (Named Entity Recognition)
   - 命名实体识别
   - 识别人名、地名、时间等
   - 本地处理,无成本

3. **LLM 抽取** (LLM-based)
   - 使用大语言模型
   - 智能理解和抽取
   - 100% 调用频率

**数据模型**:
```javascript
{
  "时间": "2024-01-01",
  "地点": "北京",
  "事件": "地下水位变化",
  "观测值": "10.5米",
  ...
}
```

### 3.3 Field Normalizer (字段清洗器)

**职责**: 将原始字段映射到标准 Schema 字段

**输入**: 原始字段, Schema
**输出**: 标准化字段 (Normalized Fields)

**组件**:
- `field_normalizer.js` - 主清洗器
- `algorithm_mapper.js` - 算法映射
- `llm_mapper.js` - LLM 映射
- `field_cleaner.js` - 字段值清洗
- `mapping_cache.js` - 映射缓存
- `synonym_dict.js` - 同义词词典
- `intelligent_truncating.js` - 智能截断

**映射策略** (4层):

1. **精确匹配** (Exact Match)
   - 字段名完全相同
   - 最快,最准确
   - 优先级最高

2. **相似度匹配** (Similarity Match)
   - 编辑距离 (Levenshtein Distance)
   - 余弦相似度 (Cosine Similarity)
   - 阈值: 0.8

3. **同义词匹配** (Synonym Match)
   - 基于同义词词典
   - 覆盖 90% 常见字段
   - 支持自动扩充

4. **LLM 映射** (LLM Mapping)
   - 使用大语言模型
   - 语义理解和映射
   - 50% 调用频率

**智能截断**:
- 字段重要性评分
- 语义相关性评分
- 上下文相关性评分
- 场景自适应策略
- Token 节省率 ≥ 40%

**数据模型**:
```javascript
{
  "event_time": "2024-01-01",
  "location": "北京",
  "event_type": "地下水位变化",
  "observation_value": "10.5米",
  ...
}
```

### 3.4 Schema Matcher (Schema 匹配器)

**职责**: 匹配最相关的 Schema

**输入**: 标准化字段
**输出**: 匹配的 Schema 列表

**组件**:
- `schema_matcher.js` - 主匹配器
- `schema_manager.js` - Schema 管理
- `schema_loader.js` - Schema 加载

**匹配算法**:
1. 计算字段覆盖率
2. 计算语义相似度
3. 综合评分排序
4. 返回 Top-K Schema

**评分公式**:
```
score = field_coverage * 0.6 + semantic_similarity * 0.4
```

**数据模型**:
```javascript
{
  schema_name: "地下水位变化事件",
  confidence: 0.85,
  matched_fields: ["event_time", "location", "observation_value"],
  missing_fields: ["observer"]
}
```

### 3.5 Entity Builder (实体构建器)

**职责**: 从字段构建实体

**输入**: 标准化字段, Schema
**输出**: 实体 (Entity)

**组件**:
- `entity_builder.js` - 主构建器
- `entity_store.js` - 实体存储

**构建流程**:
1. **规范名称生成**
   - 规则生成 (50%)
   - LLM 生成 (50%)

2. **实体消歧**
   - 检测重复实体
   - LLM 消歧 (30%)

3. **属性增强**
   - LLM 提取隐含信息
   - 补充缺失属性

**数据模型**:
```javascript
{
  id: "entity-123",
  canonical_name: "2024年北京地下水位变化",
  type: "EventEntity",
  schema_name: "地下水位变化事件",
  attributes: {
    event_time: "2024-01-01",
    location: "北京",
    observation_value: "10.5米"
  },
  confidence: 0.85,
  source_ckb_ids: ["ckb-1", "ckb-2"]
}
```

### 3.6 Relation Builder (关系构建器)

**职责**: 构建实体间的关系

**输入**: 实体列表
**输出**: 关系列表 (Relations)

**组件**:
- `builtin_relation_builder.js` - 内建关系
- `cooccurrence_relation_builder.js` - 共现关系
- `semantic_relation_builder.js` - 语义关系
- `relation_store.js` - 关系存储

**关系类型**:

1. **内建关系** (Builtin Relations)
   - 基于 Schema 定义
   - 100% 自动生成
   - 例如: has_location, has_time

2. **共现关系** (Co-occurrence Relations)
   - 基于实体共现
   - 统计共现频率和距离
   - 例如: co_occurs_with

3. **语义关系** (Semantic Relations)
   - 基于 LLM 理解
   - 分层触发: 高优先级 30% + 随机采样 20%
   - 三轮验证机制
   - 例如: causes, influences

**数据模型**:
```javascript
{
  id: "relation-123",
  source_id: "entity-1",
  target_id: "entity-2",
  type: "builtin" | "co_occurrence" | "semantic",
  subtype: "causes",
  weight: 0.8,
  confidence: 0.75,
  evidence: ["ckb-1", "ckb-2"]
}
```

### 3.7 Confidence Engine (置信度引擎)

**职责**: 计算和管理置信度

**输入**: 实体, 关系
**输出**: 带置信度的实体和关系

**组件**:
- `confidence_engine.js` - 置信度引擎
- `quality_filter.js` - 质量过滤

**置信度计算**:

**实体置信度**:
```
entity_confidence = 
  source_confidence * 0.3 +
  schema_match_confidence * 0.3 +
  field_completeness * 0.2 +
  extraction_method_confidence * 0.2
```

**关系置信度**:
```
relation_confidence = 
  min(source_entity_confidence, target_entity_confidence) * 0.4 +
  relation_type_confidence * 0.3 +
  evidence_strength * 0.3
```

**级联更新**:
- 实体置信度变化时,自动更新相关关系的置信度
- 确保图谱的一致性

### 3.8 Quality Filter (质量过滤器)

**职责**: 过滤低质量数据

**输入**: 带置信度的图谱
**输出**: 高质量图谱

**过滤规则**:
1. 实体置信度 < 0.5 → 过滤
2. 关系置信度 < 0.5 → 过滤
3. 孤立节点 → 可选过滤
4. 冲突数据 → 消解

**冲突消解**:
- 保留置信度最高的版本
- 合并互补信息
- 记录冲突日志

### 3.9 Graph Traversal (图遍历)

**职责**: 图查询和遍历

**输入**: 查询参数
**输出**: 查询结果

**组件**:
- `graph_traversal.js` - 图遍历服务

**支持操作**:
1. **BFS 遍历** (广度优先)
2. **DFS 遍历** (深度优先)
3. **最短路径** (Dijkstra)
4. **邻居查询**
5. **子图查询**

## 4. 数据模型

### 4.1 数据库 Schema

使用 Prisma ORM,数据库表结构:

```prisma
// CKB 表
model CKB {
  id              String   @id @default(uuid())
  doc_id          String
  source_type     String
  source_meta     Json
  structure       Json
  content         Json
  quality         Json
  timestamps      Json
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
}

// Schema 表
model Schema {
  id                  String   @id @default(uuid())
  name                String   @unique
  scene               String
  entity_type         String
  fields              Json
  builtin_relations   Json
  description         String?
  example_description String?
  active              Boolean  @default(true)
  version             Int      @default(1)
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt
}

// 实体表
model Entity {
  id              String   @id @default(uuid())
  canonical_name  String
  type            String
  schema_name     String
  attributes      Json
  confidence      Float
  source_ckb_ids  Json
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
}

// 关系表
model Relation {
  id          String   @id @default(uuid())
  source_id   String
  target_id   String
  type        String
  subtype     String?
  weight      Float?
  confidence  Float
  evidence    Json
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
}

// Token 使用记录表
model TokenUsage {
  id                String   @id @default(uuid())
  operation         String
  prompt_tokens     Int
  completion_tokens Int
  total_tokens      Int
  model             String
  cost              Float?
  created_at        DateTime @default(now())
}
```

### 4.2 缓存数据结构

**LLM 响应缓存**:
```javascript
{
  key: "hash(prompt)",
  value: {
    response: "LLM 响应内容",
    tokens: 1234,
    timestamp: "2024-01-01T00:00:00Z",
    ttl: 86400 // 24小时
  }
}
```

**同义词词典**:
```javascript
{
  "标准字段名": ["同义词1", "同义词2", "同义词3"],
  "event_time": ["时间", "日期", "发生时间", "观测时间"],
  "location": ["地点", "位置", "地理位置", "观测点"]
}
```

## 5. 技术选型

### 5.1 后端技术栈

- **运行时**: Node.js 18+
- **框架**: Express.js
- **ORM**: Prisma
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **测试**: Jest + fast-check (Property-Based Testing)
- **LLM**: 通义千问 (Qwen) / DeepSeek

### 5.2 前端技术栈

- **框架**: React 18 + TypeScript
- **UI 库**: Ant Design 5.8
- **可视化**: D3.js 7.8
- **路由**: React Router DOM 6.15
- **状态管理**: React Hooks

### 5.3 外部服务

- **LLM API**: 
  - 通义千问 (Qwen Plus/Max)
  - DeepSeek (Chat/Reasoner)
- **文档解析**:
  - mammoth (Word)
  - pdf-parse (PDF)
  - xlsx (Excel)

## 6. 性能优化

### 6.1 Token 优化策略

1. **LLM 响应缓存**
   - 缓存所有 LLM 响应
   - TTL: 24小时
   - 命中率目标: > 30%

2. **智能频率控制**
   - 字段映射: 50%
   - 实体规范名称: 50%
   - 实体消歧: 30%
   - 语义关系: 30% + 20%

3. **批量处理**
   - 批量大小: 10
   - 并发数: 3
   - 减少 API 调用次数

4. **智能截断**
   - 只传递重要字段
   - Token 节省率: ≥ 40%

5. **同义词词典**
   - 覆盖率: > 90%
   - 减少 LLM 映射调用

### 6.2 处理性能优化

1. **本地处理优先**
   - 规则抽取
   - NER 抽取
   - 精确匹配
   - 相似度匹配
   - 同义词匹配

2. **并发处理**
   - 批量实体构建
   - 批量关系构建
   - 并发 LLM 调用

3. **数据库优化**
   - 索引优化
   - 查询优化
   - 连接池管理

4. **缓存策略**
   - LLM 响应缓存
   - 映射结果缓存
   - Schema 缓存

### 6.3 性能指标

- **本地处理**: < 1s
- **LLM 调用**: < 10s
- **单文档总时间**: < 30s
- **图查询**: < 1s
- **Schema 匹配**: < 1s

## 7. 安全性设计

### 7.1 数据安全

- 用户数据隔离
- 敏感信息加密
- 访问权限控制

### 7.2 API 安全

- 认证和授权
- 请求限流
- 输入验证
- SQL 注入防护

### 7.3 LLM 安全

- API 密钥保护
- Token 预算控制
- 请求超时控制
- 错误处理

## 8. 可扩展性设计

### 8.1 模块扩展

- 插件式架构
- 接口标准化
- 配置驱动

### 8.2 Schema 扩展

- 动态 Schema 定义
- Schema 版本控制
- Schema 导入导出

### 8.3 抽取器扩展

- 自定义规则抽取器
- 自定义 NER 模型
- 自定义 LLM Prompt

### 8.4 关系类型扩展

- 自定义关系类型
- 自定义关系构建逻辑
- 自定义验证规则

## 9. 监控和运维

### 9.1 监控指标

- Token 使用量
- 处理时间
- 成功率
- 错误率
- 缓存命中率
- 数据库性能

### 9.2 告警机制

- Token 超限告警
- 处理超时告警
- 错误率告警
- Schema 数量告警
- 字段映射失败率告警

### 9.3 日志管理

- 结构化日志
- 日志级别控制
- 日志轮转
- 错误追踪

## 10. 部署架构

### 10.1 开发环境

```
┌─────────────────┐
│  开发机器       │
│  - Node.js      │
│  - SQLite       │
│  - React Dev    │
└─────────────────┘
```

### 10.2 生产环境

```
┌─────────────────┐
│  负载均衡器     │
└─────────────────┘
        ↓
┌─────────────────┐
│  应用服务器集群 │
│  - Node.js      │
│  - Express      │
└─────────────────┘
        ↓
┌─────────────────┐
│  数据库集群     │
│  - PostgreSQL   │
│  - Redis        │
└─────────────────┘
        ↓
┌─────────────────┐
│  外部服务       │
│  - Qwen API     │
│  - DeepSeek API │
└─────────────────┘
```

## 11. 未来规划

### 11.1 功能增强

- 支持更多文档格式
- 多语言支持
- 实时知识图谱更新
- 知识推理引擎

### 11.2 性能优化

- 分布式处理
- GPU 加速
- 增量更新优化
- 缓存策略优化

### 11.3 用户体验

- 可视化增强
- 交互式编辑
- 协作功能
- 移动端支持

---

**文档版本**: v1.0.0  
**最后更新**: 2025-02-01  
**维护者**: Schema-Driven KG Team
