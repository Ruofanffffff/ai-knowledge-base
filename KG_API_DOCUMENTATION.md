# 知识图谱API文档

## 📋 文档概述

本文档涵盖任务17.1的API文档更新。

**版本**: 1.0  
**最后更新**: 2026-02-11

---

## 🚀 核心API

### 1. buildKnowledgeGraph

构建文档的知识图谱，包括CKB创建、字段提取、实体构建和关系抽取。

#### 签名

```javascript
async function buildKnowledgeGraph(
  docId: string,
  filePath: string,
  fileType: string,
  options?: BuildOptions
): Promise<BuildResult>
```

#### 参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| docId | string | 是 | 文档ID |
| filePath | string | 是 | 文档文件路径 |
| fileType | string | 是 | 文件类型（pdf, docx, txt等） |
| options | BuildOptions | 否 | 构建选项 |

#### BuildOptions

```typescript
interface BuildOptions {
  llmClient?: LLMClient;              // LLM客户端实例
  enableSemanticRelations?: boolean;  // 启用语义关系（默认false）
  enableQualityFilter?: boolean;      // 启用质量过滤（默认false）
  enableLLM?: boolean;                // 启用LLM增强（默认true）
  batchSize?: number;                 // 批量处理大小（默认20）
  maxConcurrent?: number;             // 最大并发数（默认3）
}
```

#### 返回值

```typescript
interface BuildResult {
  doc_id: string;
  ckbs_created: number;
  entities_created: number;
  relations_created: {
    builtin: number;
    semantic: number;
  };
  processing_time: number;  // 毫秒
  llm_enhancement?: {
    ckbs_processed: number;
    fields_extracted: number;
    duration_ms: number;
  };
  errors?: Array<{
    step: string;
    error: string;
    ckb_id?: string;
  }>;
}
```

#### 示例

```javascript
const kgService = require('./kg/services/kg_service');
const { createLLMClient } = require('./llm/factory');

// 创建LLM客户端
const llmClient = createLLMClient({
  provider: 'qwen',
  apiKey: process.env.QWEN_API_KEY
});

// 构建知识图谱
const result = await kgService.buildKnowledgeGraph(
  'doc-123',
  '/path/to/document.pdf',
  'pdf',
  {
    llmClient: llmClient,
    enableSemanticRelations: false,
    enableQualityFilter: false
  }
);

console.log(`创建了 ${result.entities_created} 个实体`);
console.log(`创建了 ${result.relations_created.builtin} 个关系`);
console.log(`处理时间: ${result.processing_time}ms`);
```

---

## 🔧 字段提取API

### 2. SchemaAwareExtractor.extractFields

根据schemas智能提取字段。

#### 签名

```javascript
async function extractFields(
  ckb: CKB,
  schemas: Schema[],
  options?: ExtractOptions
): Promise<Field[]>
```

#### 参数

```typescript
interface CKB {
  ckb_id: string;
  content: {
    text: string;
    metadata?: any;
  };
}

interface Schema {
  id: string;
  name: string;
  entityType: string;
  coreFields: CoreField[];
  relations?: Relation[];
}

interface ExtractOptions {
  llmClient?: LLMClient;
  enableLLM?: boolean;
}
```

#### 返回值

```typescript
interface Field {
  name: string;
  value: string;
  type: string;
  confidence?: number;
  sources?: string[];  // ['rule', 'ner', 'llm']
}
```

#### 示例

```javascript
const SchemaAwareExtractor = require('./kg/field_extractor/schema_aware_extractor');

const extractor = new SchemaAwareExtractor();

const fields = await extractor.extractFields(
  ckb,
  schemas,
  {
    llmClient: llmClient,
    enableLLM: true
  }
);

console.log(`提取了 ${fields.length} 个字段`);
```

---

### 3. LLMExtractor.batchExtractMissingFields

批量提取缺失的关键字段。

#### 签名

```javascript
async function batchExtractMissingFields(
  ckbsWithMissingFields: CKBWithMissingFields[],
  llmClient: LLMClient
): Promise<Map<string, Field[]>>
```

#### 参数

```typescript
interface CKBWithMissingFields {
  ckb: CKB;
  missingFields: RequiredField[];
}

interface RequiredField {
  name: string;
  weight: number;
  required: boolean;
  sources: FieldSource[];
}
```

#### 返回值

```typescript
// Map<ckb_id, Field[]>
Map<string, Field[]>
```

#### 示例

```javascript
const LLMExtractor = require('./kg/field_extractor/llm_extractor');

const llmExtractor = new LLMExtractor();

const results = await llmExtractor.batchExtractMissingFields(
  ckbsNeedingLLM,
  llmClient
);

console.log(`处理了 ${results.size} 个CKB`);
```

---

## 🔗 关系构建API

### 4. BuiltinRelationBuilder.buildRelations

构建内置关系。

#### 签名

```javascript
async function buildRelations(
  entities: Entity[],
  options?: RelationOptions
): Promise<Relation[]>
```

#### 参数

```typescript
interface Entity {
  id: string;
  type: string;
  canonical_name: string;
  attributes: Record<string, any>;
  schema?: Schema;
}

interface RelationOptions {
  enableLogging?: boolean;
}
```

#### 返回值

```typescript
interface Relation {
  source_id: string;
  target_id: string;
  relation_type_id: string;
  confidence: number;
  metadata?: any;
}
```

#### 示例

```javascript
const BuiltinRelationBuilder = require('./kg/relation/builtin_relation_builder');

const builder = new BuiltinRelationBuilder();

const relations = await builder.buildRelations(entities, {
  enableLogging: true
});

console.log(`构建了 ${relations.length} 个关系`);
```

---

## 📊 监控API

### 5. MetricsCollector

收集和报告性能指标。

#### 方法

```javascript
// 记录字段提取时间
metricsCollector.recordFieldExtraction(stage: string, duration: number)

// 记录LLM调用
metricsCollector.recordLLMCall(
  success: boolean,
  latency: number,
  isRetry?: boolean,
  isTimeout?: boolean
)

// 记录Token使用
metricsCollector.recordTokenUsage(
  docId: string,
  inputTokens: number,
  outputTokens: number,
  cost: number
)

// 记录关系构建
metricsCollector.recordRelationBuild(
  relationType: string,
  success: boolean
)

// 生成报告
metricsCollector.generateReport(): MetricsReport

// 打印报告
metricsCollector.printReport(): void
```

#### 示例

```javascript
const metricsCollector = require('./kg/services/metrics_collector');

// 记录指标
metricsCollector.recordLLMCall(true, 512);
metricsCollector.recordTokenUsage('doc-123', 500, 200, 0.014);

// 生成报告
const report = metricsCollector.generateReport();
console.log(JSON.stringify(report, null, 2));

// 打印报告
metricsCollector.printReport();
```

---

## 💰 Token预算API

### 6. TokenBudgetManager

管理Token预算和使用。

#### 方法

```javascript
// 检查是否可以使用tokens
canUseTokens(estimatedTokens: number): boolean

// 记录token使用
recordUsage(tokens: number): void

// 获取剩余预算
getRemainingBudget(): {
  daily: number;
  dailyPercentage: string;
}
```

#### 示例

```javascript
const TokenBudgetManager = require('./kg/services/token_budget_manager');

const budgetManager = new TokenBudgetManager();

// 检查预算
if (budgetManager.canUseTokens(500)) {
  // 执行LLM调用
  const result = await llmClient.chat(...);
  
  // 记录使用
  budgetManager.recordUsage(result.usage.total_tokens);
}

// 查看剩余预算
const remaining = budgetManager.getRemainingBudget();
console.log(`剩余预算: ${remaining.daily} tokens (${remaining.dailyPercentage}%)`);
```

---

## 🔍 工具API

### 7. DocumentClassifier.classify

分类文档类型。

#### 签名

```javascript
async function classify(text: string): Promise<Classification>
```

#### 返回值

```typescript
interface Classification {
  entityTypes: string[];
  confidence: number;
  matchedKeywords: string[];
}
```

#### 示例

```javascript
const DocumentClassifier = require('./kg/services/document_classifier');

const classifier = new DocumentClassifier();

const classification = await classifier.classify(documentText);
console.log(`文档类型: ${classification.entityTypes.join(', ')}`);
console.log(`置信度: ${classification.confidence}`);
```

---

### 8. SchemaMatcher.matchSchemas

匹配相关的schemas。

#### 签名

```javascript
async function matchSchemas(
  fields: Field[],
  schemas: Schema[],
  sourceConfidence?: number
): Promise<SchemaMatch[]>
```

#### 返回值

```typescript
interface SchemaMatch {
  schema: Schema;
  score: number;
  matchedFields: string[];
}
```

#### 示例

```javascript
const SchemaMatcher = require('./kg/services/schema_matcher');

const matcher = new SchemaMatcher();

const matches = await matcher.matchSchemas(fields, schemas);
console.log(`匹配到 ${matches.length} 个schemas`);
```

---

## 🚨 错误处理

### 错误类型

```typescript
// LLM调用错误
class LLMError extends Error {
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
  }
}

// 字段提取错误
class FieldExtractionError extends Error {
  constructor(message: string, ckbId?: string) {
    super(message);
    this.name = 'FieldExtractionError';
    this.ckbId = ckbId;
  }
}

// 关系构建错误
class RelationBuildError extends Error {
  constructor(message: string, entityId?: string) {
    super(message);
    this.name = 'RelationBuildError';
    this.entityId = entityId;
  }
}
```

### 错误处理示例

```javascript
try {
  const result = await kgService.buildKnowledgeGraph(...);
} catch (error) {
  if (error instanceof LLMError) {
    console.error('LLM调用失败:', error.message);
    // 降级到规则提取
  } else if (error instanceof FieldExtractionError) {
    console.error('字段提取失败:', error.message, error.ckbId);
  } else {
    console.error('未知错误:', error);
  }
}
```

---

## 📚 相关文档

- [使用指南](./KG_RELATION_EXTRACTION_USER_GUIDE.md)
- [配置指南](./KG_LLM_FIELD_EXTRACTION_CONFIG.md)
- [故障排查指南](./KG_TROUBLESHOOTING_GUIDE.md)

---

**文档版本**: 1.0  
**创建日期**: 2026-02-11  
**维护者**: AI Knowledge Base Team
