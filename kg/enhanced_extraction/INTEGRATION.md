# Enhanced Extraction - Pipeline Integration Guide

本文档说明如何将LLM增强实体提取系统集成到Universal Document Pipeline中。

## 概述

LLM增强实体提取系统现在可以作为Pipeline的可选字段提取器使用，提供以下优势：

- **混合提取策略**: 结合算法提取和LLM提取的优势
- **高准确率**: 算法提取保证数值参数100%准确
- **语义增强**: LLM提取语义概念、细粒度实体和语义关系
- **错误处理**: 完善的降级策略和错误处理
- **性能监控**: 详细的提取指标和统计信息

## 集成方式

### 方式1: 作为自定义提取器（推荐）

在Pipeline配置中使用`customExtractor`选项：

```javascript
const { UniversalDocumentPipeline } = require('./kg/pipeline/universal_document_pipeline');
const { createEnhancedExtractor } = require('./kg/enhanced_extraction');

// 创建增强提取器
const enhancedExtractor = createEnhancedExtractor({
  llm: {
    enabled: false,  // 禁用LLM以节省成本
    timeout: 5000
  },
  algorithm: {
    enabled: true
  }
});

// 创建Pipeline并配置自定义提取器
const pipeline = new UniversalDocumentPipeline({
  extraction: {
    customExtractor: async (ckb, options) => {
      return await enhancedExtractor.extractFields(ckb, options);
    }
  }
});

// 处理文档
const document = {
  id: 'doc-001',
  type: 'text',
  content: '焦距: 35mm, 光圈: F1.8, 快门速度: 1/200s'
};

const context = await pipeline.processDocument(document);
console.log('提取字段:', context.metrics.fieldCount);
```

### 方式2: 直接使用（独立模式）

不通过Pipeline，直接使用增强提取系统：

```javascript
const { ExtractionCoordinator, Configuration } = require('./kg/enhanced_extraction');

// 创建配置
const config = new Configuration({
  llm: { enabled: false },
  algorithm: { enabled: true }
});

// 创建协调器
const coordinator = new ExtractionCoordinator(config);

// 执行提取
const documentText = '焦距: 35mm, 光圈: F1.8, 快门速度: 1/200s';
const result = await coordinator.extract(documentText);

console.log('提取实体:', result.entities.length);
console.log('提取关系:', result.relations.length);
console.log('处理状态:', result.metadata.status);
```

## 配置选项

### Enhanced Extractor 配置

```javascript
{
  // 是否启用
  enabled: true,
  
  // LLM配置
  llm: {
    enabled: false,        // 是否启用LLM提取
    model: 'qwen-plus',    // LLM模型
    timeout: 5000,         // 超时时间(ms)
    maxRetries: 3          // 最大重试次数
  },
  
  // 算法配置
  algorithm: {
    enabled: true          // 是否启用算法提取
  },
  
  // 融合配置
  fusion: {
    conflictStrategy: 'prefer_algorithm',  // 冲突解决策略
    deduplication: true                    // 是否去重
  },
  
  // 性能配置
  performance: {
    enableCache: true,     // 是否启用缓存
    cacheExpiry: 3600,     // 缓存过期时间(秒)
    maxProcessingTime: 5000 // 最大处理时间(ms)
  }
}
```

### Pipeline 提取选项

传递给`extractFields`方法的选项：

```javascript
{
  useLLM: false,           // 是否使用LLM
  useAlgorithm: true,      // 是否使用算法
  timeout: 5000,           // 超时时间(ms)
  language: 'auto'         // 文档语言: 'zh', 'en', 'auto'
}
```

## 输出格式

### 字段格式

增强提取器输出的字段格式与Pipeline兼容：

```javascript
{
  name: string,            // 字段名称
  value: string,           // 字段值
  confidence: number,      // 置信度 (0-1)
  source: string,          // 来源: 'algorithm' | 'llm'
  type: string,            // 类型: 'entity' | 'property'
  metadata: {
    entityId: string,      // 实体ID
    entityType: string,    // 实体类型
    properties: Object     // 实体属性
  }
}
```

### 示例输出

```javascript
[
  {
    name: 'lens',
    value: 'SEL35F18F',
    confidence: 0.95,
    source: 'algorithm',
    type: 'entity',
    metadata: {
      entityId: 'entity-1',
      entityType: 'lens',
      properties: {
        focalLength: '35mm',
        maxAperture: 'F1.8'
      }
    }
  },
  {
    name: 'focalLength',
    value: '35mm',
    confidence: 0.95,
    source: 'algorithm',
    type: 'property',
    metadata: {
      entityId: 'entity-1',
      entityType: 'lens',
      propertyName: 'focalLength'
    }
  }
]
```

## 性能优化

### 1. 禁用LLM

LLM调用是最耗时的操作，如果不需要语义提取可以禁用：

```javascript
const enhancedExtractor = createEnhancedExtractor({
  llm: { enabled: false },
  algorithm: { enabled: true }
});
```

### 2. 启用缓存

缓存可以避免重复处理相同的文档：

```javascript
const enhancedExtractor = createEnhancedExtractor({
  performance: {
    enableCache: true,
    cacheExpiry: 3600  // 1小时
  }
});
```

### 3. 调整超时时间

根据文档复杂度调整超时时间：

```javascript
const enhancedExtractor = createEnhancedExtractor({
  llm: {
    timeout: 3000  // 简单文档使用较短超时
  }
});
```

## 错误处理

### 降级策略

增强提取器具有完善的降级策略：

1. **LLM失败** → 回退到算法提取
2. **算法失败** → 使用LLM提取
3. **两者都失败** → 返回失败状态

```javascript
try {
  const fields = await enhancedExtractor.extractFields(ckb);
  console.log('提取成功:', fields.length, '个字段');
} catch (error) {
  console.error('提取失败:', error.message);
  // 可以使用Pipeline的默认提取器作为后备
}
```

### 部分成功

即使部分提取失败，系统也会返回成功提取的字段：

```javascript
const fields = await enhancedExtractor.extractFields(ckb);

// 检查提取质量
const algorithmFields = fields.filter(f => f.source === 'algorithm');
const llmFields = fields.filter(f => f.source === 'llm');

console.log('算法提取:', algorithmFields.length);
console.log('LLM提取:', llmFields.length);
```

## 监控和调试

### 获取统计信息

```javascript
const stats = enhancedExtractor.getStatistics();

console.log('总提取次数:', stats.totalExtractions);
console.log('成功次数:', stats.successfulExtractions);
console.log('失败次数:', stats.failedExtractions);
console.log('平均处理时间:', stats.averageProcessingTime, 'ms');
```

### 重置统计信息

```javascript
enhancedExtractor.resetStatistics();
```

### 启用详细日志

```bash
DEBUG=kg:enhanced_extraction npm start
```

## 与现有Pipeline功能对比

| 功能 | 默认提取器 | 增强提取器 |
|------|-----------|-----------|
| 数值参数提取 | ✅ | ✅ (100%准确) |
| 语义概念提取 | ❌ | ✅ |
| 细粒度实体 | ❌ | ✅ |
| 语义关系 | ❌ | ✅ |
| 错误降级 | 基础 | 完善 |
| 性能监控 | 基础 | 详细 |
| 缓存支持 | ❌ | ✅ |

## 迁移建议

### 阶段1: 测试验证

在开发环境测试增强提取器：

```javascript
// 对比测试
const defaultFields = await defaultExtractor.extractFields(ckb);
const enhancedFields = await enhancedExtractor.extractFields(ckb);

console.log('默认提取:', defaultFields.length);
console.log('增强提取:', enhancedFields.length);
```

### 阶段2: 灰度发布

为特定文档类型启用增强提取：

```javascript
const useEnhanced = document.type === 'photography' || document.experimental;

const pipeline = new UniversalDocumentPipeline({
  extraction: {
    customExtractor: useEnhanced ? 
      async (ckb, options) => await enhancedExtractor.extractFields(ckb, options) :
      undefined
  }
});
```

### 阶段3: 全面切换

确认稳定后，全面启用增强提取器。

## 常见问题

### Q: 增强提取器会替代默认提取器吗？

A: 不会。增强提取器是可选的，可以通过配置选择使用。

### Q: 性能影响如何？

A: 禁用LLM时，性能与默认提取器相当。启用LLM时会增加2-3秒处理时间。

### Q: 如何确保向后兼容？

A: 增强提取器输出的字段格式与Pipeline完全兼容，不会破坏现有功能。

### Q: 可以同时使用两种提取器吗？

A: 可以。可以先用默认提取器，然后用增强提取器补充提取。

## 相关文档

- [Enhanced Extraction README](./README.md) - 系统概述
- [Pipeline Integration Guide](../pipeline/INTEGRATION_GUIDE.md) - Pipeline集成指南
- [API Documentation](./API.md) - 完整API参考

## 支持

如有问题或建议，请查看相关文档或联系开发团队。
