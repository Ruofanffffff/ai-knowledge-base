# Main分支知识图谱系统实现分析

## 1. 系统概述

Main分支实现了一个完整的**Schema驱动知识图谱系统**,采用模块化、分层的架构设计。

### 核心特性
- **Schema驱动**: 基于250+预定义Schema进行知识抽取
- **三阶段Schema匹配**: 算法匹配 → LLM兜底 → 合并排名(40%阈值)
- **多层次抽取**: CKB → 字段 → 实体 → 关系的渐进式抽取
- **智能映射**: 4层字段映射策略(精确匹配 → 相似度 → 同义词 → LLM)
- **LLM 100%兜底**: LLM作为兜底方案,确保关键步骤的质量
- **Token优化**: 智能控制LLM调用,降低成本90%+
- **高质量**: 置信度管理和质量过滤机制

## 2. 架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────┐
│         前端层 (Frontend)               │
│  SchemaKG可视化 | CKBExplorer | 统计    │
└─────────────────────────────────────────┘
                  ↓ HTTP/REST API
┌─────────────────────────────────────────┐
│          API层 (API Layer)              │
│  KG Routes | Schema Routes | Stats      │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│        服务层 (Service Layer)           │
│  KG Service | Graph Traversal | Token   │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         核心层 (Core Layer)             │
│  CKB Parser | Field Extractor           │
│  Schema Matcher | Field Normalizer      │
│  Entity Builder | Relation Builder      │
│  Confidence Engine | Quality Filter     │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         数据层 (Data Layer)             │
│  Prisma | LLM Cache | Synonym Dict      │
└─────────────────────────────────────────┘
```

### 2.2 数据流程

```
文档 (Document)
    ↓
1. CKB解析 (CKB Parser)
    ↓ CKB列表
2. 字段抽取 (Field Extractor)
    ↓ 原始字段
3. 字段清洗 (Field Normalizer)
    ↓ 标准化字段
4. Schema匹配 (Schema Matcher)
    ↓ 匹配的Schema
5. 实体构建 (Entity Builder)
    ↓ 实体列表
6. 关系构建 (Relation Builder)
    ↓ 关系列表
7. 置信度计算 (Confidence Engine)
    ↓ 带置信度的图谱
8. 质量过滤 (Quality Filter)
    ↓
知识图谱 (Knowledge Graph)
```

## 3. 核心模块详解

### 3.1 CKB Parser (CKB解析器)
**位置**: `kg/ckb/`

**功能**: 解析文档,提取结构化的知识块

**支持格式**:
- Word (.docx)
- PDF (.pdf)
- Excel (.xlsx)
- Markdown (.md)
- 纯文本 (.txt)

**关键文件**:
- `ckb_parser.js` - 主解析器
- `word_parser.js` - Word文档解析
- `pdf_parser.js` - PDF文档解析
- `excel_parser.js` - Excel文档解析
- `ckb_store.js` - CKB存储

### 3.2 Field Extractor (字段抽取器)
**位置**: `kg/field_extractor/`

**功能**: 从CKB中抽取结构化字段

**抽取策略**:
1. **规则抽取** (Rule-based): 正则表达式匹配,快速无成本
2. **NER抽取** (Named Entity Recognition): 识别人名、地名、时间等
3. **LLM抽取** (LLM-based): 使用大语言模型,100%调用频率

**关键文件**:
- `field_extractor.js` - 主抽取器
- `rule_extractor.js` - 规则抽取
- `ner_extractor.js` - NER抽取
- `llm_extractor.js` - LLM抽取
- `universal_extractor.js` - 通用抽取器

### 3.3 Field Normalizer (字段清洗器)
**位置**: `kg/field_normalizer/`

**功能**: 将原始字段映射到标准Schema字段

**映射策略(4层)**:

1. **精确匹配** (Exact Match): 字段名完全相同,最快最准确
2. **相似度匹配** (Similarity Match): 编辑距离+余弦相似度,阈值0.8
3. **同义词匹配** (Synonym Match): 基于同义词词典,覆盖90%常见字段
4. **LLM映射** (LLM Mapping): 使用大语言模型,50%调用频率

**智能截断**:
- 字段重要性评分
- 语义相关性评分
- 上下文相关性评分
- Token节省率 ≥ 40%

**关键文件**:
- `field_normalizer.js` - 主清洗器
- `algorithm_mapper.js` - 算法映射
- `llm_mapper.js` - LLM映射
- `field_cleaner.js` - 字段值清洗
- `mapping_cache.js` - 映射缓存
- `synonym_dict.js` - 同义词词典
- `intelligent_truncating.js` - 智能截断
- `mapping_based_normalizer.js` - 基于映射表的归一化器

### 3.4 Schema Matcher (Schema匹配器)
**位置**: `kg/schema/`

**功能**: 匹配最相关的Schema

**三阶段匹配策略**:
1. **算法匹配阶段**: 使用字段覆盖率和语义相似度(阈值40%)
2. **LLM兜底阶段**: 对未匹配字段使用LLM(100%兜底)
3. **合并排名阶段**: 合并两阶段结果,综合评分排序

**评分公式**:
```
score = field_coverage * 0.6 + semantic_similarity * 0.4
```

**关键文件**:
- `schema_matcher.js` - 主匹配器
- `schema_manager.js` - Schema管理
- `schema_loader.js` - Schema加载
- `schema_matcher_v2.js` - V2版本匹配器

### 3.5 Entity Builder (实体构建器)
**位置**: `kg/entity/`

**功能**: 从字段构建实体

**构建流程**:
1. **规范名称生成**: 规则生成(50%) + LLM生成(50%)
2. **实体消歧**: 检测重复实体,LLM消歧(30%)
3. **属性增强**: LLM提取隐含信息,补充缺失属性

**实体类型**:
- EventEntity (事件实体)
- LocationEntity (地点实体)
- ObservationEntity (观测实体)
- ResearchEntity (科研实体)
- TravelEntity (旅行实体)
- PhotographyEntity (摄影实体)

**关键文件**:
- `entity_builder.js` - 主构建器
- `entity_store.js` - 实体存储

### 3.6 Relation Builder (关系构建器)
**位置**: `kg/relation/`

**功能**: 构建实体间的关系

**关系类型**:

1. **内建关系** (Builtin Relations)
   - 基于Schema定义的固有关系
   - 100%自动生成
   - 例如: has_location, has_time

2. **共现关系** (Co-occurrence Relations)
   - 基于实体在文档中的共现
   - 统计共现频率和距离
   - 例如: co_occurs_with

3. **语义关系** (Semantic Relations)
   - 基于LLM的语义理解
   - 分层触发: 高优先级30% + 随机采样20%
   - 三轮验证机制
   - 例如: causes, influences

**关键文件**:
- `builtin_relation_builder.js` - 内建关系
- `cooccurrence_relation_builder.js` - 共现关系
- `semantic_relation_builder.js` - 语义关系
- `relation_store.js` - 关系存储

### 3.7 Confidence Engine (置信度引擎)
**位置**: `kg/confidence/`

**功能**: 计算和管理置信度

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

**级联更新**: 实体置信度变化时,自动更新相关关系的置信度

**关键文件**:
- `confidence_engine.js` - 置信度引擎
- `quality_filter.js` - 质量过滤

### 3.8 Universal Document Pipeline (通用文档流水线)
**位置**: `kg/pipeline/`

**功能**: 提供端到端的文档处理能力

**核心流程**:
1. 文档解析 (Document Parsing)
2. 字段提取 (Field Extraction)
3. Schema匹配 (Schema Matching)
4. 字段标准化 (Field Normalization)
5. 实体构建 (Entity Building)
6. 关系抽取 (Relation Extraction)
7. 知识图谱存储 (Knowledge Graph Storage)

**特性**:
- 支持多种文档格式
- 灵活配置
- 错误处理
- 批量处理
- 性能监控

**关键文件**:
- `universal_document_pipeline.js` - 通用流水线
- `document_classifier.js` - 文档分类器
- `schema_matcher_v2.js` - Schema匹配器V2

## 4. 服务层

### 4.1 KG Service (知识图谱服务)
**位置**: `kg/services/kg_service.js`

**功能**: 主服务,编排整个流水线

**核心方法**:
- `buildKnowledgeGraph()` - 从文档构建知识图谱
- `updateKnowledgeGraph()` - 增量更新知识图谱
- `rebuildKnowledgeGraph()` - 全量重建知识图谱
- `deleteKnowledgeGraph()` - 删除文档的知识图谱
- `getKnowledgeGraphStats()` - 获取统计信息

### 4.2 Graph Traversal (图遍历)
**位置**: `kg/services/graph_traversal.js`

**功能**: 图查询和遍历

**支持操作**:
- BFS遍历 (广度优先)
- DFS遍历 (深度优先)
- 最短路径 (Dijkstra)
- 邻居查询
- 子图查询

## 5. 工具层

### 5.1 Token管理
**位置**: `kg/utils/`

**功能**: 优化LLM调用,降低Token成本

**优化策略**:
1. **LLM响应缓存**: 避免重复调用
2. **智能频率控制**: 根据场景调整LLM调用频率
3. **批量处理**: 减少API调用次数
4. **智能截断**: 只传递重要字段给LLM
5. **同义词词典**: 减少LLM映射调用

**Token预算管理**:
- 每日限额: 100,000 tokens
- 单文档限额: 5,000 tokens
- 预警阈值: 80%
- 紧急模式: 降低LLM调用频率

**关键文件**:
- `token_tracker.js` - Token追踪
- `token_budget_manager.js` - Token预算管理
- `llm_cache.js` - LLM缓存
- `performance_monitor.js` - 性能监控

## 6. API接口

### 6.1 CKB相关
```
POST   /api/knowledge-graph/ckb/parse          # 解析文档生成CKB
GET    /api/knowledge-graph/ckb/:id            # 获取CKB详情
GET    /api/knowledge-graph/ckb/document/:docId # 获取文档的所有CKB
```

### 6.2 Schema相关
```
GET    /api/knowledge-graph/schemas            # 获取Schema列表
POST   /api/knowledge-graph/schemas            # 创建Schema
PUT    /api/knowledge-graph/schemas/:id        # 更新Schema
DELETE /api/knowledge-graph/schemas/:id        # 删除Schema
POST   /api/knowledge-graph/schemas/import     # 导入Schema
GET    /api/knowledge-graph/schemas/export     # 导出Schema
PUT    /api/knowledge-graph/schemas/:id/enable # 启用Schema
PUT    /api/knowledge-graph/schemas/:id/disable # 禁用Schema
```

### 6.3 实体相关
```
GET    /api/knowledge-graph/entities           # 获取实体列表
GET    /api/knowledge-graph/entities/:id       # 获取实体详情
GET    /api/knowledge-graph/entities/search    # 搜索实体
```

### 6.4 关系相关
```
GET    /api/knowledge-graph/relations          # 获取关系列表
GET    /api/knowledge-graph/relations/:id      # 获取关系详情
```

### 6.5 图遍历相关
```
POST   /api/knowledge-graph/traverse           # 图遍历
GET    /api/knowledge-graph/neighbors/:id      # 获取邻居节点
GET    /api/knowledge-graph/path/:sourceId/:targetId # 查找最短路径
GET    /api/knowledge-graph/subgraph/:id       # 获取子图
```

### 6.6 KG构建相关
```
POST   /api/knowledge-graph/build              # 构建知识图谱
POST   /api/knowledge-graph/rebuild            # 重建知识图谱
POST   /api/knowledge-graph/update             # 更新知识图谱
DELETE /api/knowledge-graph/document/:docId    # 删除文档的知识图谱
```

### 6.7 统计相关
```
GET    /api/knowledge-graph/stats/tokens       # Token使用统计
GET    /api/knowledge-graph/stats/tokens/timeseries # Token时序数据
GET    /api/knowledge-graph/stats/tokens/budget # Token预算状态
GET    /api/knowledge-graph/stats/tokens/recommendations # 优化建议
GET    /api/knowledge-graph/stats/quality      # 质量统计
```

## 7. 数据模型

### 7.1 数据库Schema (Prisma)

**CKB表**:
```prisma
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
```

**Schema表**:
```prisma
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
```

**实体表**:
```prisma
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
```

**关系表**:
```prisma
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
```

## 8. 性能指标

### 8.1 处理时间
- **本地处理**: < 1s
- **LLM调用**: < 10s
- **单文档总时间**: < 30s

### 8.2 Token消耗
- **每日限额**: 100,000 tokens
- **单文档限额**: 5,000 tokens
- **实际消耗**: 约2,000-3,000 tokens/文档

### 8.3 质量指标
- **实体置信度**: 平均 > 0.7
- **关系置信度**: 平均 > 0.6
- **字段映射准确率**: > 90%

## 9. 关键技术特点

### 9.1 Schema驱动
- 250+预定义Schema
- 覆盖科研、政府、个人生活、旅行摄影等多个场景
- 支持动态Schema定义和版本控制

### 9.2 三阶段Schema匹配
- 算法匹配(40%阈值) + LLM兜底(100%) + 合并排名
- 确保高召回率和高准确率

### 9.3 LLM 100%兜底策略
- Schema匹配: LLM作为兜底方案
- 实体名称生成: LLM 100%验证和优化
- 字段映射: 4层策略后,LLM兜底处理未映射字段

### 9.4 智能Token优化
- LLM响应缓存
- 智能频率控制
- 批量处理
- 智能截断
- 同义词词典
- Token预算管理

### 9.5 置信度管理
- 实体置信度计算
- 关系置信度计算
- 级联更新机制
- 质量过滤

## 10. 文档资源

### 10.1 核心文档
- `kg/README.md` - 系统概述和快速开始
- `kg/ARCHITECTURE.md` - 架构设计文档
- `kg/API.md` - API参考文档
- `kg/CONFIG.md` - 配置说明
- `kg/DEPLOYMENT.md` - 部署指南
- `kg/DEVELOPMENT.md` - 开发指南
- `kg/TROUBLESHOOTING.md` - 故障排查
- `kg/PRODUCT_MANUAL.md` - 产品手册
- `kg/WHITEPAPER.md` - 白皮书

### 10.2 技术文档
- `kg/pipeline/THREE_STAGE_SCHEMA_MATCHING.md` - 三阶段Schema匹配
- `kg/pipeline/LLM_FALLBACK_EXPLAINED.md` - LLM兜底策略
- `kg/pipeline/ENTITY_BUILDING_EXPLAINED.md` - 实体构建说明
- `kg/pipeline/INTEGRATION_GUIDE.md` - 集成指南
- `kg/pipeline/MIGRATION_GUIDE.md` - 迁移指南
- `kg/field_extractor/UNIVERSAL_EXTRACTOR.md` - 通用抽取器
- `kg/field_extractor/INTEGRATION_SUMMARY.md` - 集成摘要

## 11. 测试覆盖

### 11.1 单元测试
- 所有核心模块都有对应的单元测试
- 测试文件命名: `*.test.js`

### 11.2 Property-Based测试
- 使用fast-check进行Property-Based测试
- 测试文件命名: `*.property.test.js`
- 覆盖关键模块:
  - CKB Parser
  - Field Extractor
  - Field Normalizer
  - Schema Matcher
  - Entity Builder
  - Relation Builder
  - Confidence Engine

### 11.3 集成测试
- `kg/integration.test.js` - 集成测试
- `kg/e2e.test.js` - 端到端测试
- `kg/integration_performance_budget.test.js` - 性能预算测试

## 12. 前端可视化

### 12.1 SchemaKG可视化
**位置**: `client/src/pages/KnowledgeGraph/SchemaKG.tsx`

**功能**: 知识图谱可视化展示

### 12.2 CKBExplorer
**位置**: `client/src/pages/KnowledgeGraph/CKBExplorer.tsx`

**功能**: CKB浏览器

## 13. 总结

Main分支的知识图谱系统是一个**成熟、完整、高质量**的实现,具有以下特点:

### 优势:
1. **架构清晰**: 分层设计,模块化,易于维护和扩展
2. **功能完整**: 从文档解析到知识图谱生成的完整流程
3. **质量保证**: 置信度管理、质量过滤、Property-Based测试
4. **性能优化**: Token优化、缓存、批量处理
5. **文档完善**: 详细的文档和示例
6. **API丰富**: 完整的REST API接口
7. **前端可视化**: 知识图谱可视化展示

### 技术亮点:
1. **Schema驱动**: 250+预定义Schema,覆盖多个场景
2. **三阶段Schema匹配**: 算法+LLM兜底,确保高召回率
3. **LLM 100%兜底**: 关键步骤LLM兜底,确保质量
4. **智能Token优化**: 降低成本90%+
5. **4层字段映射**: 精确→相似度→同义词→LLM
6. **多类型关系**: 内建+共现+语义关系
7. **置信度管理**: 实体和关系的置信度计算和级联更新

### 适用场景:
- 科研文档知识抽取
- 政府文件知识图谱构建
- 个人生活知识管理
- 旅行摄影知识组织
- 网信工作知识库

---

**生成时间**: 2025-02-04
**分析者**: Kiro AI Assistant
