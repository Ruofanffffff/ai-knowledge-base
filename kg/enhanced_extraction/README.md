# LLM-Enhanced Entity Extraction System

LLM增强实体提取系统是一个混合架构的实体提取解决方案，结合了基于规则的算法提取器和基于大语言模型的语义提取器。

## 核心特性

- **混合提取策略**: 结合算法提取和LLM提取的优势
- **高准确率**: 算法提取保证数值参数100%准确
- **语义增强**: LLM提取语义概念、细粒度实体和语义关系
- **错误处理**: 完善的降级策略和错误处理
- **性能监控**: 详细的提取指标和统计信息
- **Pipeline集成**: 可作为Universal Document Pipeline的可选提取器

## 快速开始

### 独立使用

```javascript
const { ExtractionCoordinator, Configuration } = require('./kg/enhanced_extraction');

// 创建配置
const config = new Configuration({
  llm: { enabled: false },  // 禁用LLM以节省成本
  algorithm: { enabled: true }
});

// 创建协调器
const coordinator = new ExtractionCoordinator({ config });

// 执行提取
const documentText = '焦距: 35mm, 光圈: F1.8, 快门速度: 1/200s';
const result = await coordinator.extract(documentText);

console.log('提取实体:', result.entities.length);
console.log('提取关系:', result.relations.length);
console.log('处理状态:', result.metadata.status);
```

### 与Pipeline集成

```javascript
const { UniversalDocumentPipeline } = require('./kg/pipeline/universal_document_pipeline');
const { createEnhancedExtractor } = require('./kg/enhanced_extraction');

// 创建增强提取器
const enhancedExtractor = createEnhancedExtractor({
  llm: { enabled: false, apiKey: 'your-api-key' },
  algorithm: { enabled: true }
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
  content: '焦距: 35mm, 光圈: F1.8'
};

const context = await pipeline.processDocument(document);
console.log('提取字段:', context.metrics.fieldCount);
```

## 系统架构

```
文档输入
  ↓
[提取协调器]
  ├─→ [算法提取器] → 数值参数
  └─→ [LLM提取器] → 语义信息
        ├─→ [提示词构建器]
        ├─→ [LLM客户端] (带缓存)
        └─→ [结果解析器]
  ↓
[结果融合器]
  ├─→ [冲突解决器]
  └─→ [质量验证器]
  ↓
提取结果输出
```

## 核心组件

### 1. ExtractionCoordinator (提取协调器)
- 协调算法提取和LLM提取的执行
- 管理提取流程的生命周期
- 处理降级策略

### 2. AlgorithmExtractor (算法提取器)
- 提取数值参数（焦距、光圈、快门速度等）
- 保证100%准确率
- 标记来源为'algorithm'

### 3. LLMExtractor (LLM提取器)
- 提取语义概念实体
- 提取细粒度实体
- 提取语义关系
- 标记来源为'llm'

### 4. ResultFusion (结果融合器)
- 合并算法和LLM的提取结果
- 标记每个字段的提取来源
- 生成统一的输出格式

### 5. ConflictResolver (冲突解决器)
- 处理算法和LLM提取结果的冲突
- 应用冲突解决策略（优先算法提取的数值）
- 记录冲突日志

### 6. QualityValidator (质量验证器)
- 验证提取结果的完整性
- 计算质量指标
- 生成验证报告

## 配置选项

```javascript
{
  // LLM配置
  llm: {
    enabled: false,        // 是否启用LLM提取
    model: 'qwen-plus',    // LLM模型
    apiKey: 'your-key',    // API密钥
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

## 输出格式

```javascript
{
  // 实体列表
  entities: [
    {
      id: 'entity-1',
      type: 'lens',
      name: 'SEL35F18F',
      confidence: 0.95,
      source: 'algorithm',
      properties: {
        focalLength: '35mm',
        maxAperture: 'F1.8'
      }
    }
  ],
  
  // 关系列表
  relations: [
    {
      id: 'relation-1',
      type: 'suitable_for',
      source: 'SEL35F18F',
      target: '人文摄影',
      confidence: 0.90,
      source: 'llm'
    }
  ],
  
  // 元数据
  metadata: {
    language: 'zh',
    processingTime: 1234,
    algorithmTime: 100,
    llmTime: 1000,
    tokensUsed: 1200,
    status: 'success'
  },
  
  // 质量报告
  quality: {
    entityCompleteness: 0.95,
    relationCompleteness: 0.85,
    averageConfidence: 0.92,
    warnings: []
  }
}
```

## 错误处理

系统具有完善的降级策略：

1. **LLM失败** → 回退到算法提取
2. **算法失败** → 使用LLM提取
3. **两者都失败** → 返回失败状态

```javascript
try {
  const result = await coordinator.extract(documentText);
  if (result.metadata.status === 'failed') {
    console.error('提取失败:', result.metadata.errors);
  } else if (result.metadata.status === 'partial_success') {
    console.warn('部分成功:', result.metadata.warnings);
  }
} catch (error) {
  console.error('提取异常:', error.message);
}
```

## 性能优化

### 1. 禁用LLM
LLM调用是最耗时的操作，如果不需要语义提取可以禁用：

```javascript
const config = new Configuration({
  llm: { enabled: false },
  algorithm: { enabled: true }
});
```

### 2. 启用缓存
缓存可以避免重复处理相同的文档：

```javascript
const config = new Configuration({
  performance: {
    enableCache: true,
    cacheExpiry: 3600  // 1小时
  }
});
```

### 3. 调整超时时间
根据文档复杂度调整超时时间：

```javascript
const config = new Configuration({
  llm: {
    timeout: 3000  // 简单文档使用较短超时
  }
});
```

## 测试

```bash
# 运行所有测试
npm test -- kg/enhanced_extraction

# 运行特定测试
npm test -- kg/enhanced_extraction/extraction_coordinator.test.js

# 运行属性测试
npm test -- kg/enhanced_extraction/*.property.test.js
```

## 文档

- [集成指南](./INTEGRATION.md) - Pipeline集成详细说明
- [API文档](./API.md) - 完整API参考
- [设计文档](../../.kiro/specs/llm-enhanced-entity-extraction/design.md) - 系统设计
- [需求文档](../../.kiro/specs/llm-enhanced-entity-extraction/requirements.md) - 系统需求

## 许可证

MIT
