# LLM文档索引预处理系统

## 概述

LLM文档索引预处理系统是知识图谱构建流程的核心增强模块，通过在处理流程最前端生成文档的结构化索引，为后续所有处理阶段提供准确的参考上下文，从而显著提升知识图谱构建的质量和准确性。

### 核心价值

- **提升准确性**: 通过索引叙述文本为6个关键环节提供统一参考，减少错误和遗漏
- **增强完整性**: 自动识别并补充遗漏的实体和关系
- **保证一致性**: 验证知识图谱与原始文档的一致性
- **可观测性**: 完整的矫正记录和质量指标追踪

### 系统架构

```
文档输入
    ↓
[索引叙述文本生成] ← 核心预处理
    ↓
索引叙述文本 (Document Index)
    ↓
    ├─→ [CKB描述生成]
    ├─→ [字段提取矫正]
    ├─→ [Schema选择矫正]
    ├─→ [实体合并矫正]
    ├─→ [关系抽取矫正]
    └─→ [图谱一致性校验]
    ↓
知识图谱输出 + 图谱描述
```

## 快速开始

### 1. 启用预处理功能

在 `.env` 文件中添加：

```bash
ENABLE_LLM_PREPROCESSING=true
```

### 2. 配置LLM客户端

确保系统已配置可用的LLM客户端（通义千问、DeepSeek等）。

### 3. 构建知识图谱

```javascript
const { buildKnowledgeGraph } = require('./kg/services/kg_service');

const result = await buildKnowledgeGraph(
  docId,
  filePath,
  fileType,
  {
    llmClient: myLLMClient,
    enableLLMPreprocessing: true,
    enableConsistencyCheck: true
  }
);

console.log('知识图谱构建完成');
console.log('一致性得分:', result.consistency.score);
console.log('图谱描述:', result.consistency.briefDescription);
```

## 核心功能

### 1. 索引叙述文本生成

将原始文档转换为低噪声、结构友好的索引叙述文本。

**特点**:
- 只包含明确事实，无评论、推理、观点
- 每条独立、完整、可验证
- 显式化所有信息，稳定指代

**示例**:
```
1. 2025年1月，阿里C区地下水位监测显示水位为45.2米。
2. 阿里C区位于海南省海口市美兰区。
3. 该监测点编号为ALI-C-001，由海南省水文局负责管理。
```

### 2. CKB描述生成

基于索引叙述文本生成CKB描述，确保每条索引对应一个CKB。

### 3. 字段提取矫正

验证字段提取的完整性，自动补充遗漏的实体和属性。

**矫正内容**:
- 识别索引中提到但未被提取的实体
- 补充提取遗漏的字段
- 计算并记录覆盖率

### 4. Schema选择矫正

验证Schema选择的准确性，对低置信度匹配进行二次验证。

**矫正内容**:
- 验证Schema是否符合索引描述的事实
- 检查核心字段是否有索引支持
- 二次验证低置信度匹配

### 5. 实体合并矫正

验证实体合并决策，避免错误合并或遗漏应合并的实体。

**矫正内容**:
- 在索引中查找实体提及
- 判断是否指向同一对象
- 基于索引做出合并决策

### 6. 关系抽取矫正

验证关系抽取的完整性，自动补充遗漏的关系。

**矫正内容**:
- 识别索引中明确提到但未被抽取的关系
- 补充提取遗漏的关系
- 计算并记录覆盖率

### 7. 图谱一致性校验

验证知识图谱与索引叙述文本的一致性，生成图谱的自然语言描述。

**输出**:
- 一致性评估报告
- 简要图谱描述
- 详细图谱描述
- 问题识别和标注

## 核心模块

### 索引生成器 (index_generator.js)

生成文档的索引叙述文本。

```javascript
const { createIndexGenerator } = require('./kg/preprocessing/index_generator');

const generator = createIndexGenerator({
  temperature: 0.1,
  maxTokens: 2000,
  timeout: 30000
});

const index = await generator.generateIndexedText(
  docId,
  documentText,
  llmClient
);
```

### CKB描述生成器 (ckb_description_generator.js)

基于索引生成CKB描述。

```javascript
const { createCKBDescriptionGenerator } = require('./kg/preprocessing/ckb_description_generator');

const generator = createCKBDescriptionGenerator();
const ckbs = await generator.generateCKBDescriptions(indexedText, llmClient);
```

### 字段提取验证器 (field_extraction_validator.js)

验证和矫正字段提取。

```javascript
const { createFieldExtractionValidator } = require('./kg/preprocessing/field_extraction_validator');

const validator = createFieldExtractionValidator();
const result = await validator.validateFields(
  extractedFields,
  indexedText,
  ckb,
  llmClient
);
```

### Schema选择验证器 (schema_selection_validator.js)

验证Schema选择。

```javascript
const { createSchemaSelectionValidator } = require('./kg/preprocessing/schema_selection_validator');

const validator = createSchemaSelectionValidator();
const result = await validator.validateSchemaSelection(
  schemaMatch,
  indexedText,
  llmClient
);
```

### 实体合并验证器 (entity_merge_validator.js)

验证实体合并决策。

```javascript
const { createEntityMergeValidator } = require('./kg/preprocessing/entity_merge_validator');

const validator = createEntityMergeValidator();
const result = await validator.validateMergeDecision(
  entity1,
  entity2,
  indexedText,
  llmClient
);
```

### 关系抽取验证器 (relation_extraction_validator.js)

验证和矫正关系抽取。

```javascript
const { createRelationExtractionValidator } = require('./kg/preprocessing/relation_extraction_validator');

const validator = createRelationExtractionValidator();
const result = await validator.validateRelations(
  extractedRelations,
  indexedText,
  entities,
  llmClient
);
```

### 知识图谱一致性校验器 (kg_consistency_checker.js)

校验图谱一致性并生成描述。

```javascript
const { createKGConsistencyChecker } = require('./kg/preprocessing/kg_consistency_checker');

const checker = createKGConsistencyChecker();
const result = await checker.checkConsistency(
  graph,
  indexedText,
  llmClient
);

const description = checker.generateGraphDescription(graph, 'brief');
```

### 矫正统计收集器 (correction_stats_collector.js)

收集和记录矫正统计信息。

```javascript
const { createCorrectionStatsCollector } = require('./kg/preprocessing/correction_stats_collector');

const collector = createCorrectionStatsCollector();
collector.recordCorrection('field_extraction', correctionData);
const stats = collector.getStats(docId);
```

### 时延控制管理器 (latency_control_manager.js)

控制LLM调用的时延和并发。

```javascript
const { createLatencyControlManager } = require('./kg/preprocessing/latency_control_manager');

const manager = createLatencyControlManager({
  maxConcurrency: 5,
  timeout: 30000
});

const result = await manager.callWithControl(
  'document_index',
  () => llmClient.call(prompt)
);
```

### 版本管理器 (version_manager.js)

管理文档索引的版本。

```javascript
const { VersionManager } = require('./kg/preprocessing/version_manager');

const versionManager = new VersionManager({ prisma });
const history = await versionManager.getVersionHistory(docId);
const comparison = await versionManager.compareVersions(docId, 1, 2);
```

## 配置选项

详细配置请参考 [配置指南](./CONFIG_GUIDE.md)。

### 主要配置项

```bash
# 启用预处理
ENABLE_LLM_PREPROCESSING=true

# LLM配置
LLM_PREPROCESSING_TEMPERATURE=0.1
LLM_PREPROCESSING_MAX_TOKENS=2000

# 超时配置（毫秒）
LLM_PREPROCESSING_DOCUMENT_INDEX_TIMEOUT=30000
LLM_PREPROCESSING_FIELD_CORRECTION_TIMEOUT=15000
LLM_PREPROCESSING_RELATION_CORRECTION_TIMEOUT=20000

# 并发控制
LLM_PREPROCESSING_MAX_CONCURRENCY=5

# 缓存配置
LLM_PREPROCESSING_CACHE_ENABLED=true
LLM_PREPROCESSING_CACHE_MAX_SIZE=1000
LLM_PREPROCESSING_CACHE_TTL=3600000

# 智能触发阈值
LLM_PREPROCESSING_FIELD_COVERAGE_THRESHOLD=0.8
LLM_PREPROCESSING_RELATION_COVERAGE_THRESHOLD=0.7
LLM_PREPROCESSING_SCHEMA_CONFIDENCE_THRESHOLD=0.75
```

## API接口

详细API文档请参考 [API文档](./API_DOCUMENTATION.md)。

### 主要接口

```
GET    /api/preprocessing/index/:docId              # 获取文档索引
GET    /api/preprocessing/index/:docId/versions     # 获取所有版本
GET    /api/preprocessing/index/:docId/history      # 获取版本历史
GET    /api/preprocessing/index/:docId/compare      # 比较版本
POST   /api/preprocessing/index/:docId/regenerate   # 重新生成索引
DELETE /api/preprocessing/index/:docId/version/:v   # 删除版本
GET    /api/preprocessing/stats/:docId              # 获取矫正统计
```

## 性能优化

### 时延控制

系统实现了多层次的时延控制机制：

1. **超时控制**: 每个操作都有独立的超时配置
2. **并发控制**: 使用队列限制并发LLM调用数量
3. **智能触发**: 只在真正需要时调用LLM
4. **缓存机制**: 缓存LLM调用结果避免重复调用
5. **批量处理**: 批量处理多个CKB的矫正操作

### 成本优化

通过智能触发机制，实际LLM调用率约为：

- 文档索引生成: 100% (每个文档1次)
- CKB描述矫正: ~20% (只在不一致时)
- 字段提取矫正: ~30% (覆盖率低时)
- Schema选择矫正: ~15% (低置信度时)
- 实体合并矫正: ~10% (冲突时)
- 关系抽取矫正: ~40% (覆盖率低时)
- 图谱描述生成: 100% (每个文档1次)

**总体**: 每个文档约2-5次LLM调用

## 监控和日志

### 性能指标

系统自动收集以下指标：

- LLM调用总次数和成功率
- 各操作的时延统计（P50, P95, P99）
- 缓存命中率
- 超时次数
- 矫正操作统计

### 日志记录

系统在关键决策点记录详细日志：

- 索引生成结果
- 矫正操作详情
- 一致性校验结果
- 错误和告警信息

## 数据模型

### document_index 表

存储文档的索引叙述文本。

```sql
CREATE TABLE document_index (
  id VARCHAR(36) PRIMARY KEY,
  doc_id VARCHAR(36) NOT NULL,
  indexed_text TEXT NOT NULL,
  metadata JSON,
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### correction_record 表

存储矫正记录。

```sql
CREATE TABLE correction_record (
  id VARCHAR(36) PRIMARY KEY,
  doc_id VARCHAR(36) NOT NULL,
  stage VARCHAR(50) NOT NULL,
  correction_type VARCHAR(50) NOT NULL,
  original_value TEXT,
  corrected_value TEXT,
  confidence_before DECIMAL(3,2),
  confidence_after DECIMAL(3,2),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### correction_stats 表

存储矫正统计信息。

```sql
CREATE TABLE correction_stats (
  id VARCHAR(36) PRIMARY KEY,
  doc_id VARCHAR(36) NOT NULL,
  stage VARCHAR(50) NOT NULL,
  total_corrections INT DEFAULT 0,
  accuracy_before DECIMAL(5,2),
  accuracy_after DECIMAL(5,2),
  recall_before DECIMAL(5,2),
  recall_after DECIMAL(5,2),
  precision_before DECIMAL(5,2),
  precision_after DECIMAL(5,2),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### graph_description 表

存储图谱描述。

```sql
CREATE TABLE graph_description (
  id VARCHAR(36) PRIMARY KEY,
  doc_id VARCHAR(36) NOT NULL,
  description_type VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 故障排查

详细故障排查指南请参考 [故障排查指南](./TROUBLESHOOTING.md)。

### 常见问题

1. **LLM调用频繁超时**: 增加超时时间或降低并发数
2. **处理速度太慢**: 增加并发数或降低触发阈值
3. **成本过高**: 启用缓存、降低触发阈值
4. **配置不生效**: 检查.env文件、重启服务器

## 测试

### 运行单元测试

```bash
npm test kg/preprocessing/__tests__/
```

### 运行属性测试

```bash
npm test kg/preprocessing/__tests__/*.property.test.js
```

### 运行集成测试

```bash
npm test kg/services/__tests__/kg_service_preprocessing_integration.test.js
```

## 相关文档

- [配置指南](./CONFIG_GUIDE.md) - 详细的配置选项说明
- [API文档](./API_DOCUMENTATION.md) - API接口详细文档
- [故障排查指南](./TROUBLESHOOTING.md) - 常见问题和解决方案
- [版本管理](./VERSION_MANAGEMENT.md) - 文档索引版本管理
- [集成指南](./INTEGRATION_GUIDE.md) - 如何集成到现有系统

## 设计文档

- [需求文档](../../../.kiro/specs/llm-document-index-preprocessing/requirements.md)
- [设计文档](../../../.kiro/specs/llm-document-index-preprocessing/design.md)
- [实现计划](../../../.kiro/specs/llm-document-index-preprocessing/tasks.md)

## 贡献

欢迎提交问题和改进建议。

## 许可证

MIT License
