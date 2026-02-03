# 迁移指南：从 build_knowledge_graph.js 到 Universal Document Pipeline

本指南帮助你将现有的 `build_knowledge_graph.js` 脚本迁移到使用新的 `UniversalDocumentPipeline` 模块。

## 为什么要迁移？

### 旧方式的问题

`build_knowledge_graph.js` 是一个独立的脚本，存在以下问题：

1. **不可复用**: 代码逻辑硬编码在脚本中，难以在其他地方复用
2. **配置不灵活**: 配置选项分散在代码各处，难以统一管理
3. **错误处理不完善**: 缺乏统一的错误处理和降级策略
4. **缺少批量处理**: 不支持并发批量处理多个文档
5. **性能监控有限**: 缺少详细的性能指标和瓶颈分析
6. **难以测试**: 脚本形式难以进行单元测试和集成测试

### 新方式的优势

`UniversalDocumentPipeline` 提供：

1. ✅ **模块化设计**: 可在任何地方导入和使用
2. ✅ **灵活配置**: 统一的配置接口，支持细粒度控制
3. ✅ **完善的错误处理**: 区分关键/非关键错误，支持降级策略
4. ✅ **批量处理**: 内置并发控制的批量处理能力
5. ✅ **详细的性能监控**: 完整的指标追踪和瓶颈识别
6. ✅ **易于测试**: 完整的单元测试和属性测试覆盖

## 迁移步骤

### 步骤1: 理解旧代码结构

旧的 `build_knowledge_graph.js` 脚本的主要流程：

```javascript
// 1. 加载Schema
const schemas = await schemaManager.listSchemas();

// 2. 读取文件
const content = fs.readFileSync(filePath, 'utf-8');

// 3. 创建CKB对象
const ckb = { ckb_id, doc_id, content: { text, title }, quality: { source_confidence } };

// 4. 字段提取
const extractedFields = await fieldExtractor.extractFields(ckb, { useLLM: false });

// 5. Schema匹配
const schemaScores = schemaMatcher.matchSchemas(extractedFields, schemas, ckb.quality.source_confidence);
const triggeredSchemas = schemaMatcher.getTriggeredSchemas(schemaScores);

// 6. 字段标准化
const normalizedFields = await fieldNormalizer.normalizeFields(extractedFields, schema, { useLLM: false });

// 7. 实体构建
const entity = await entityBuilder.buildEntity(schemaMatch, normalizedFields, ckb, { useLLM: false });

// 8. 关系抽取
const relations = await builtinRelationBuilder.buildRelations(entity, schema, normalizedFields, [ckb.ckb_id]);

// 9. 生成报告
generateReport(results);
```

### 步骤2: 使用新的Pipeline

新的Pipeline将所有这些步骤封装在一个简单的API中：

```javascript
const { UniversalDocumentPipeline } = require('./kg/pipeline/universal_document_pipeline');

// 创建流水线实例（配置一次）
const pipeline = new UniversalDocumentPipeline({
  extraction: { useLLM: false },
  normalization: { useLLM: false },
  entityBuilding: { useLLM: false },
  relationExtraction: { enableSemantic: false }
});

// 处理文档（一行代码）
const document = {
  id: 'doc-001',
  type: 'text',
  title: '测试数据.md',
  content: fs.readFileSync('测试数据.md', 'utf-8')
};

const context = await pipeline.processDocument(document);

// 查看结果
console.log('状态:', context.status);
console.log('实体数:', context.metrics.entityCount);
console.log('关系数:', context.metrics.relationCount);
```

## 完整迁移示例

### 旧代码 (build_knowledge_graph.js)

```javascript
async function buildKnowledgeGraph() {
  const testFiles = [
    { name: '测试数据.md', type: '招标文件', maxLength: 3000 },
    { name: '测试数据1.md', type: '政府工作报告', maxLength: 5000 },
    { name: '测试数据2.md', type: '旅游攻略', maxLength: 5000 }
  ];

  const results = [];
  const schemas = await schemaManager.listSchemas();

  for (const fileInfo of testFiles) {
    try {
      // 读取文件
      const filePath = path.join(__dirname, '..', fileInfo.name);
      const fullContent = fs.readFileSync(filePath, 'utf-8');
      const content = fullContent.substring(0, fileInfo.maxLength);
      
      // 创建CKB
      const ckb = {
        ckb_id: `ckb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        doc_id: `doc_${fileInfo.name}`,
        content: { text: content, title: fileInfo.name },
        quality: { source_confidence: 0.9 }
      };

      // 字段提取
      const extractedFields = await fieldExtractor.extractFields(ckb, {
        useLLM: false,
        minFieldCount: 3
      });

      // Schema匹配
      const schemaScores = schemaMatcher.matchSchemas(extractedFields, schemas, ckb.quality.source_confidence);
      const triggeredSchemas = schemaMatcher.getTriggeredSchemas(schemaScores);

      // 实体构建
      const entities = [];
      for (const schemaScore of triggeredSchemas) {
        const schema = schemas.find(s => s.schema_name === schemaScore.schema_name);
        const normalizedFields = await fieldNormalizer.normalizeFields(extractedFields, schema, {
          useLLM: false,
          cleanValues: true,
          useCache: true
        });
        const entity = await entityBuilder.buildEntity(
          { schema, completeness: schemaScore.completeness },
          normalizedFields,
          ckb,
          { useLLM: false, llmProbability: 0 }
        );
        entities.push(entity);
      }

      // 关系抽取
      const allRelations = [];
      for (const entity of entities) {
        const schema = schemas.find(s => s.schema_name === entity.schemas[0]?.schema_name);
        const normalizedFields = await fieldNormalizer.normalizeFields(extractedFields, schema, {
          useLLM: false,
          cleanValues: true
        });
        const relations = await builtinRelationBuilder.buildRelations(
          entity,
          schema,
          normalizedFields,
          [ckb.ckb_id]
        );
        allRelations.push(...relations);
      }

      // 保存结果
      results.push({
        file: fileInfo.name,
        type: fileInfo.type,
        fieldCount: extractedFields.length,
        entityCount: entities.length,
        relationCount: allRelations.length,
        entities: entities,
        relations: allRelations
      });

    } catch (error) {
      console.error(`处理 ${fileInfo.name} 时出错:`, error.message);
    }
  }

  // 生成报告
  generateReport(results);
  return results;
}
```

### 新代码 (使用Pipeline)

```javascript
const { UniversalDocumentPipeline } = require('./kg/pipeline/universal_document_pipeline');
const fs = require('fs');
const path = require('path');

async function buildKnowledgeGraph() {
  // 1. 创建流水线实例（配置一次）
  const pipeline = new UniversalDocumentPipeline({
    extraction: { useLLM: false, minFieldCount: 3 },
    normalization: { useLLM: false, cleanValues: true, useCache: true },
    entityBuilding: { useLLM: false, llmProbability: 0 },
    relationExtraction: { 
      enableBuiltin: true,
      enableCooccurrence: false,
      enableSemantic: false
    }
  });

  // 2. 准备文档列表
  const testFiles = [
    { name: '测试数据.md', type: '招标文件', maxLength: 3000 },
    { name: '测试数据1.md', type: '政府工作报告', maxLength: 5000 },
    { name: '测试数据2.md', type: '旅游攻略', maxLength: 5000 }
  ];

  const documents = testFiles.map(fileInfo => {
    const filePath = path.join(__dirname, '..', fileInfo.name);
    const fullContent = fs.readFileSync(filePath, 'utf-8');
    const content = fullContent.substring(0, fileInfo.maxLength);
    
    return {
      id: `doc_${fileInfo.name}`,
      type: 'text',
      title: fileInfo.name,
      content: content,
      metadata: { 
        originalType: fileInfo.type,
        fullLength: fullContent.length,
        processedLength: content.length
      }
    };
  });

  // 3. 批量处理文档（并发处理）
  const contexts = await pipeline.processBatch(documents, {
    concurrency: 3,
    stopOnFirstError: false
  });

  // 4. 转换结果格式（兼容旧格式）
  const results = contexts.map((context, index) => ({
    file: testFiles[index].name,
    type: testFiles[index].type,
    processedLength: context.data.ckb?.content?.text?.length || 0,
    fullLength: documents[index].metadata.fullLength,
    fieldCount: context.metrics.fieldCount,
    entityCount: context.metrics.entityCount,
    relationCount: context.metrics.relationCount,
    entities: context.data.entities.map(e => ({
      id: e.entity_id,
      name: e.canonical_name,
      type: e.entity_type,
      confidence: e.confidence,
      attributes: e.attributes,
      schemas: e.schemas
    })),
    relations: context.data.relations.map(r => ({
      source: r.source_id,
      type: r.subtype || r.type,
      target: r.target_id,
      confidence: r.confidence
    })),
    // 新增：性能指标
    performance: {
      totalDuration: context.totalDuration,
      slowestStep: context.getSummary().slowestStep,
      tokenUsage: context.metrics.tokenUsage
    }
  }));

  // 5. 生成报告（复用旧函数或使用新的摘要）
  generateReport(results);
  
  // 6. 额外：打印性能摘要
  console.log('\n性能摘要:');
  contexts.forEach((context, index) => {
    const summary = context.getSummary();
    console.log(`\n${testFiles[index].name}:`);
    console.log(`  总耗时: ${summary.totalDuration}ms`);
    console.log(`  瓶颈步骤: ${summary.slowestStep} (${summary.slowestStepDuration}ms)`);
    console.log(`  状态: ${summary.status}`);
    console.log(`  错误: ${summary.errorCount}, 警告: ${summary.warningCount}`);
  });

  return results;
}
```

## 代码对比

| 特性 | 旧代码 | 新代码 |
|------|--------|--------|
| 代码行数 | ~150行 | ~50行 |
| 错误处理 | 手动try-catch | 自动处理+降级 |
| 批量处理 | 串行循环 | 并发处理 |
| 性能监控 | 无 | 详细指标+瓶颈分析 |
| 配置管理 | 分散在各处 | 统一配置对象 |
| 可复用性 | 脚本形式 | 模块化API |
| 测试覆盖 | 无 | 完整测试套件 |

## 配置映射

### 字段提取配置

```javascript
// 旧代码
await fieldExtractor.extractFields(ckb, {
  useLLM: false,
  minFieldCount: 3
});

// 新代码
new UniversalDocumentPipeline({
  extraction: {
    useLLM: false,
    useNER: true,
    useRules: true,
    maxTokens: 4000
  }
});
```

### 字段标准化配置

```javascript
// 旧代码
await fieldNormalizer.normalizeFields(extractedFields, schema, {
  useLLM: false,
  cleanValues: true,
  useCache: true
});

// 新代码
new UniversalDocumentPipeline({
  normalization: {
    useLLM: false,
    useAlgorithm: true,
    minConfidence: 0.6,
    maxRetries: 2
  }
});
```

### 实体构建配置

```javascript
// 旧代码
await entityBuilder.buildEntity(schemaMatch, normalizedFields, ckb, {
  useLLM: false,
  llmProbability: 0
});

// 新代码
new UniversalDocumentPipeline({
  entityBuilding: {
    useLLM: false,
    allowPartialEntities: true,
    minFieldCoverage: 0.5
  }
});
```

### 关系抽取配置

```javascript
// 旧代码
// 只能手动调用builtin关系构建器
await builtinRelationBuilder.buildRelations(entity, schema, normalizedFields, [ckb.ckb_id]);

// 新代码
// 支持多种关系构建器
new UniversalDocumentPipeline({
  relationExtraction: {
    enableBuiltin: true,
    enableCooccurrence: true,
    enableSemantic: false,
    minConfidence: 0.5
  }
});
```

## 高级用法

### 1. 单文档处理

```javascript
const pipeline = new UniversalDocumentPipeline();

const document = {
  id: 'doc-001',
  type: 'text',
  content: '...'
};

const context = await pipeline.processDocument(document);

// 访问处理结果
console.log('提取的字段:', context.data.extractedFields);
console.log('匹配的Schema:', context.data.matchedSchemas);
console.log('构建的实体:', context.data.entities);
console.log('抽取的关系:', context.data.relations);
```

### 2. 批量处理

```javascript
const pipeline = new UniversalDocumentPipeline();

const documents = [
  { id: 'doc-1', type: 'text', content: '...' },
  { id: 'doc-2', type: 'text', content: '...' },
  { id: 'doc-3', type: 'text', content: '...' }
];

// 并发处理3个文档
const contexts = await pipeline.processBatch(documents, {
  concurrency: 3,
  stopOnFirstError: false
});

// 统计总体结果
const totalEntities = contexts.reduce((sum, ctx) => sum + ctx.metrics.entityCount, 0);
const totalRelations = contexts.reduce((sum, ctx) => sum + ctx.metrics.relationCount, 0);
```

### 3. 错误处理

```javascript
const context = await pipeline.processDocument(document);

// 检查处理状态
if (context.status === 'failed') {
  console.error('处理失败:', context.errors);
} else if (context.status === 'partial') {
  console.warn('部分成功:', context.warnings);
} else {
  console.log('处理成功!');
}

// 查看详细的步骤状态
Object.keys(context.steps).forEach(stepName => {
  const step = context.steps[stepName];
  console.log(`${stepName}: ${step.status} (${step.duration}ms)`);
  if (step.error) {
    console.error(`  错误: ${step.error}`);
  }
});
```

### 4. 性能分析

```javascript
const context = await pipeline.processDocument(document);
const summary = context.getSummary();

// 查看性能统计
console.log('总耗时:', summary.totalDuration, 'ms');
console.log('瓶颈步骤:', summary.slowestStep);
console.log('瓶颈耗时:', summary.slowestStepDuration, 'ms');

// 查看吞吐量指标
console.log('文档处理速度:', summary.performance.throughput.documentsPerSecond, '文档/秒');
console.log('字段提取速度:', summary.performance.throughput.fieldsPerSecond, '字段/秒');
console.log('实体构建速度:', summary.performance.throughput.entitiesPerSecond, '实体/秒');

// 查看各步骤时间占比
Object.keys(summary.steps).forEach(stepName => {
  const step = summary.steps[stepName];
  console.log(`${stepName}: ${step.duration}ms (${step.percentage})`);
});
```

## 常见问题

### Q1: 如何保持与旧代码的兼容性？

A: 可以创建一个适配器函数：

```javascript
async function buildKnowledgeGraphLegacy() {
  const pipeline = new UniversalDocumentPipeline({
    extraction: { useLLM: false },
    normalization: { useLLM: false },
    entityBuilding: { useLLM: false }
  });

  // ... 使用pipeline处理文档 ...

  // 转换为旧格式
  return convertToLegacyFormat(contexts);
}
```

### Q2: 如何处理大文件？

A: Pipeline会自动验证文件大小（默认50MB限制）：

```javascript
const pipeline = new UniversalDocumentPipeline();
pipeline.MAX_DOCUMENT_SIZE = 100 * 1024 * 1024; // 设置为100MB

// 或者手动分段处理
const content = largeContent.substring(0, 50000);
const document = { id: 'doc-001', type: 'text', content };
```

### Q3: 如何禁用某些步骤？

A: 通过配置控制：

```javascript
const pipeline = new UniversalDocumentPipeline({
  relationExtraction: {
    enableBuiltin: true,
    enableCooccurrence: false,  // 禁用共现关系
    enableSemantic: false        // 禁用语义关系
  }
});
```

### Q4: 如何集成到现有系统？

A: Pipeline可以轻松集成到任何Node.js应用：

```javascript
// Express路由
app.post('/api/documents/process', async (req, res) => {
  const pipeline = new UniversalDocumentPipeline();
  const context = await pipeline.processDocument(req.body);
  res.json(context.getSummary());
});

// 定时任务
cron.schedule('0 * * * *', async () => {
  const pipeline = new UniversalDocumentPipeline();
  const documents = await fetchPendingDocuments();
  const contexts = await pipeline.processBatch(documents);
  await saveResults(contexts);
});
```

## 总结

迁移到 `UniversalDocumentPipeline` 可以：

1. **减少代码量**: 从150行减少到50行
2. **提高可维护性**: 统一的配置和错误处理
3. **增强性能**: 并发批量处理和详细的性能监控
4. **提升可靠性**: 完善的错误处理和降级策略
5. **便于测试**: 完整的测试覆盖

建议逐步迁移：

1. 先在新功能中使用Pipeline
2. 保留旧脚本作为参考
3. 逐步替换旧代码
4. 最终完全迁移到Pipeline

## 参考资料

- [Pipeline README](./README.md) - 完整的API文档
- [单元测试](./universal_document_pipeline.test.js) - 使用示例
- [属性测试](./universal_document_pipeline.property.test.js) - 正确性验证
