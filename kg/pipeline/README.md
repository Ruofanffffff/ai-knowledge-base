# Universal Document Pipeline (通用文档处理流水线)

通用文档处理流水线是一个端到端的文档处理系统，能够自动完成从文档输入到知识图谱生成的完整流程。

## 功能特性

- ✅ **通用性**: 支持 text, PDF, Word, Excel, Markdown, HTML 等多种文档格式
- ✅ **完整流程**: 覆盖文档解析 → 字段提取 → Schema匹配 → 字段标准化 → 实体构建 → 关系抽取 → 知识图谱存储
- ✅ **可配置**: 每个步骤都支持灵活配置（LLM使用、置信度阈值等）
- ✅ **错误处理**: 完善的错误处理和降级策略
- ✅ **批量处理**: 支持并发批量处理多个文档
- ✅ **性能监控**: 详细的执行时间和性能指标追踪

## 快速开始

### 基本使用

```javascript
const { UniversalDocumentPipeline } = require('./kg/pipeline/universal_document_pipeline');

// 创建流水线实例
const pipeline = new UniversalDocumentPipeline();

// 处理单个文档
const document = {
  id: 'doc-001',
  type: 'text',
  title: '招标文件',
  content: '项目名称：某市政道路改造工程...'
};

const context = await pipeline.processDocument(document);

// 查看处理结果
console.log('状态:', context.status);
console.log('提取字段:', context.metrics.fieldCount);
console.log('构建实体:', context.metrics.entityCount);
console.log('抽取关系:', context.metrics.relationCount);
console.log('总耗时:', context.totalDuration, 'ms');
```

### 自定义配置

```javascript
const pipeline = new UniversalDocumentPipeline({
  // 字段提取配置
  extraction: {
    useLLM: false,        // 禁用LLM以节省成本
    useNER: true,         // 使用NER
    useRules: true,       // 使用规则提取
    maxTokens: 4000
  },
  
  // Schema匹配配置
  schemaMatching: {
    useLLM: true,
    minConfidence: 0.5,
    fallbackToGeneric: true  // 未匹配时使用通用Schema
  },
  
  // 字段标准化配置
  normalization: {
    useLLM: false,
    useAlgorithm: true,
    minConfidence: 0.6
  },
  
  // 实体构建配置
  entityBuilding: {
    useLLM: false,
    allowPartialEntities: true,
    minFieldCoverage: 0.5
  },
  
  // 关系抽取配置
  relationExtraction: {
    enableBuiltin: true,
    enableCooccurrence: true,
    enableSemantic: false,  // 禁用语义关系以节省时间
    minConfidence: 0.5
  }
});
```

### 批量处理

```javascript
const documents = [
  { id: 'doc-1', type: 'text', content: '...' },
  { id: 'doc-2', type: 'text', content: '...' },
  { id: 'doc-3', type: 'text', content: '...' }
];

const results = await pipeline.processBatch(documents, {
  concurrency: 3,           // 并发处理3个文档
  stopOnFirstError: false   // 遇到错误继续处理
});

// 查看批量处理结果
results.forEach(context => {
  console.log(`${context.documentId}: ${context.status}`);
});
```

## 处理流程

```
文档输入
  ↓
[1] 文档验证
  ↓
[2] 文档解析 (CKB创建)
  ↓
[3] 字段提取 (Field Extraction)
  ↓
[4] Schema匹配 (Schema Matching)
  ↓
[5] 字段标准化 (Field Normalization)
  ↓
[6] 实体构建 (Entity Building)
  ↓
[7] 关系抽取 (Relation Extraction)
  ↓
[8] 知识图谱存储 (KG Storage)
  ↓
处理上下文输出
```

## Processing Context (处理上下文)

每个文档处理完成后会返回一个 `ProcessingContext` 对象，包含：

```javascript
{
  documentId: string,           // 文档ID
  documentType: string,         // 文档类型
  status: string,               // 处理状态: completed, failed, partial
  startTime: timestamp,         // 开始时间
  endTime: timestamp,           // 结束时间
  totalDuration: number,        // 总耗时(ms)
  
  steps: {                      // 各步骤执行状态
    parsing: { status, duration, result, error, metrics },
    extraction: { status, duration, result, error, metrics },
    schemaMatching: { status, duration, result, error, metrics },
    normalization: { status, duration, result, error, metrics },
    entityBuilding: { status, duration, result, error, metrics },
    relationExtraction: { status, duration, result, error, metrics },
    storage: { status, duration, result, error, metrics }
  },
  
  data: {                       // 流程数据
    ckb: CKB,                   // 解析后的CKB对象
    extractedFields: Field[],   // 提取的字段
    matchedSchemas: Schema[],   // 匹配的Schema
    normalizedFields: [],       // 标准化字段
    entities: Entity[],         // 构建的实体
    relations: Relation[]       // 抽取的关系
  },
  
  metrics: {                    // 性能指标
    fieldCount: number,         // 字段数量
    entityCount: number,        // 实体数量
    relationCount: number,      // 关系数量
    tokenUsage: number,         // Token使用量
    confidenceScores: {}        // 置信度分数
  },
  
  errors: Error[],              // 错误列表
  warnings: Warning[]           // 警告列表
}
```

## 错误处理

流水线区分**关键错误**和**非关键错误**：

### 关键错误（终止处理）
- 文档验证失败
- 文档解析失败
- Schema匹配完全失败（禁用降级时）
- 数据库存储失败

### 非关键错误（记录警告并继续）
- 部分字段提取失败
- 部分字段标准化失败
- 部分实体构建失败
- 某个关系构建器失败

### 降级策略

1. **LLM降级**: LLM失败时自动降级到算法方法
2. **部分结果接受**: 接受部分成功的结果
3. **通用Schema降级**: 未匹配到Schema时使用通用Schema

## 性能优化建议

1. **禁用不必要的LLM**: 设置 `useLLM: false` 可大幅提升速度
2. **调整并发数**: 批量处理时根据系统资源调整 `concurrency`
3. **禁用语义关系**: 语义关系抽取较慢，可按需禁用
4. **使用缓存**: 字段标准化会自动使用缓存

## 与现有代码集成

### 替代 build_knowledge_graph.js

```javascript
// 旧方式 (build_knowledge_graph.js)
const { buildKnowledgeGraph } = require('./kg/build_knowledge_graph');
await buildKnowledgeGraph();

// 新方式 (使用流水线)
const { UniversalDocumentPipeline } = require('./kg/pipeline/universal_document_pipeline');
const pipeline = new UniversalDocumentPipeline();

const document = {
  id: 'doc-001',
  type: 'text',
  content: fs.readFileSync('测试数据.md', 'utf-8')
};

const context = await pipeline.processDocument(document);
```

### 与 document_hooks 集成

```javascript
const { UniversalDocumentPipeline } = require('./kg/pipeline/universal_document_pipeline');
const pipeline = new UniversalDocumentPipeline();

// 在文档创建钩子中使用
async function onDocumentCreated(document) {
  const context = await pipeline.processDocument(document);
  return context;
}
```

## 测试

```bash
# 运行单元测试
npm test -- kg/pipeline/universal_document_pipeline.test.js

# 运行属性测试
npm test -- kg/pipeline/universal_document_pipeline.property.test.js
```

## API参考

### UniversalDocumentPipeline

#### 构造函数
```javascript
new UniversalDocumentPipeline(options?: PipelineOptions)
```

#### 方法

##### processDocument(document, options?)
处理单个文档

**参数:**
- `document`: 文档对象
  - `id`: 文档ID
  - `type`: 文档类型 (text, pdf, word, excel, markdown, html)
  - `content`: 文档内容
  - `title?`: 文档标题
  - `metadata?`: 元数据
- `options?`: 可选的配置覆盖

**返回:** `Promise<ProcessingContext>`

##### processBatch(documents, options?)
批量处理文档

**参数:**
- `documents`: 文档数组
- `options?`: 批量处理配置
  - `concurrency`: 并发数 (默认: 3)
  - `stopOnFirstError`: 遇到错误是否停止 (默认: false)

**返回:** `Promise<ProcessingContext[]>`

## 许可证

MIT
