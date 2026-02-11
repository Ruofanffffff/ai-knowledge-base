# LLM增强实体提取系统 - 用户指南

## 概述

LLM增强实体提取系统是一个混合架构的实体提取解决方案，结合了基于规则的算法提取器和基于大语言模型（LLM）的语义提取器。系统在保持数值参数提取100%准确率的基础上，通过LLM增加语义概念、细粒度实体和语义关系的提取能力。

## 核心特性

- **混合提取策略**：结合算法提取（数值参数）和LLM提取（语义信息）
- **高准确性**：算法提取保证100%准确率
- **语义增强**：LLM提取语义概念、细粒度实体和语义关系
- **智能降级**：LLM失败时自动回退到算法提取
- **多语言支持**：支持中文和英文文档
- **性能优化**：内置缓存机制，减少LLM调用成本
- **质量保证**：自动验证和质量指标计算

## 快速开始

### 安装

系统已集成到知识图谱项目中，无需额外安装。

### 基本使用

```javascript
const ExtractionCoordinator = require('./kg/enhanced_extraction/extraction_coordinator');
const Configuration = require('./kg/enhanced_extraction/configuration');

// 1. 创建配置
const config = new Configuration({
  llm: {
    enabled: true,
    model: 'qwen-plus',
    apiKey: process.env.DASHSCOPE_API_KEY,
    timeout: 10000,
    maxRetries: 3
  },
  algorithm: {
    enabled: true
  },
  performance: {
    enableCache: true
  }
});

// 2. 创建协调器
const coordinator = new ExtractionCoordinator({ config });

// 3. 提取实体和关系
const documentText = `
SEL35F18F 是一款35mm定焦镜头，最大光圈F1.8，适合人文和街拍。
使用三分法构图可以让照片更有平衡感。
`;

const result = await coordinator.extract(documentText);

// 4. 使用结果
console.log('提取的实体:', result.entities);
console.log('提取的关系:', result.relations);
console.log('处理状态:', result.metadata.status);
console.log('质量指标:', result.quality);
```

## 配置选项

### 完整配置示例

```javascript
const config = new Configuration({
  // LLM配置
  llm: {
    enabled: true,              // 是否启用LLM提取
    model: 'qwen-plus',         // LLM模型名称
    apiKey: 'your-api-key',     // API密钥
    baseURL: undefined,         // API基础URL（可选）
    timeout: 30000,             // 超时时间（毫秒）
    maxRetries: 3,              // 最大重试次数
    temperature: 0.7,           // 温度参数
    maxTokens: 2000             // 最大token数
  },
  
  // 算法配置
  algorithm: {
    enabled: true,              // 是否启用算法提取
    extractorType: 'universal'  // 提取器类型
  },
  
  // 融合配置
  fusion: {
    conflictStrategy: 'prefer_algorithm',  // 冲突解决策略
    deduplication: true,                   // 是否去重
    confidenceThreshold: 0.5               // 置信度阈值
  },
  
  // 性能配置
  performance: {
    enableCache: true,          // 是否启用缓存
    cacheExpiry: 86400,         // 缓存过期时间（秒）
    batchSize: 5,               // 批处理大小
    maxProcessingTime: 5000     // 最大处理时间（毫秒）
  },
  
  // 质量配置
  quality: {
    minEntities: 0,             // 最小实体数量
    minRelations: 0,            // 最小关系数量
    minConfidence: 0.5,         // 最小置信度
    requiredFields: []          // 必需字段列表
  },
  
  // 语言配置
  language: {
    default: 'zh',              // 默认语言
    supported: ['zh', 'en'],    // 支持的语言列表
    autoDetect: true            // 是否自动检测语言
  }
});
```

### 从环境变量加载配置

```javascript
// 设置环境变量
process.env.LLM_API_KEY = 'your-api-key';
process.env.LLM_MODEL = 'qwen-plus';
process.env.LLM_ENABLED = 'true';

// 从环境变量加载
const config = Configuration.fromEnv();
```

### 从文件加载配置

```javascript
// config.json
{
  "llm": {
    "enabled": true,
    "model": "qwen-plus",
    "apiKey": "your-api-key"
  }
}

// 加载配置
const config = Configuration.fromFile('./config.json');
```

## 提取结果格式

### 实体格式

```javascript
{
  id: 'entity-1',
  type: 'lens',                    // 实体类型
  name: 'SEL35F18F',               // 实体名称
  properties: {                     // 实体属性
    focalLength: '35mm',
    maxAperture: 'F1.8',
    description: '适合人文和街拍的定焦镜头',
    suitableScenes: ['街拍', '人文摄影']
  },
  confidence: 0.95,                 // 置信度
  source: 'llm',                    // 提取来源
  metadata: {
    extractedAt: '2026-02-08T...',
    context: '...'
  }
}
```

### 关系格式

```javascript
{
  id: 'relation-1',
  type: 'suitable_for',             // 关系类型
  source: 'SEL35F18F',              // 源实体
  target: '人文摄影',                // 目标实体
  confidence: 0.90,                 // 置信度
  source: 'llm',                    // 提取来源
  metadata: {
    extractedAt: '2026-02-08T...',
    evidence: '适合人文和街拍'
  }
}
```

### 完整结果格式

```javascript
{
  entities: [...],                  // 实体列表
  relations: [...],                 // 关系列表
  metadata: {
    documentId: 'doc-1',
    language: 'zh',
    processingTime: 3500,           // 总处理时间（毫秒）
    algorithmTime: 100,             // 算法提取时间
    llmTime: 3400,                  // LLM提取时间
    tokensUsed: 1200,               // Token使用量
    cost: 0.024,                    // 估算成本
    llmModel: 'qwen-plus',
    conflicts: 0,                   // 冲突数量
    status: 'success'               // 处理状态
  },
  quality: {
    entityCompleteness: 0.85,       // 实体完整性
    relationCompleteness: 0.75,     // 关系完整性
    averageConfidence: 0.88,        // 平均置信度
    fieldCompleteness: 0.92,        // 字段完整率
    warnings: []                    // 警告信息
  }
}
```

## 高级用法

### 批量处理

```javascript
const documents = [
  'document text 1...',
  'document text 2...',
  'document text 3...'
];

// 批量提取
const results = await Promise.all(
  documents.map(doc => coordinator.extract(doc))
);
```

### 仅使用算法提取

```javascript
const result = await coordinator.extract(documentText, {
  enableLLM: false,
  enableAlgorithm: true
});
```

### 仅使用LLM提取

```javascript
const result = await coordinator.extract(documentText, {
  enableLLM: true,
  enableAlgorithm: false
});
```

### 自定义超时时间

```javascript
const result = await coordinator.extract(documentText, {
  timeout: 10000  // 10秒超时
});
```

### 指定文档语言

```javascript
const result = await coordinator.extract(documentText, {
  language: 'en'  // 英文文档
});
```

## 集成到Universal Document Pipeline

### 作为可选模块启用

```javascript
const { createEnhancedPipeline } = require('./kg/enhanced_extraction/pipeline_integration');

// 创建增强的pipeline
const pipeline = createEnhancedPipeline({
  enableEnhancedExtraction: true,
  llmConfig: {
    apiKey: process.env.DASHSCOPE_API_KEY,
    model: 'qwen-plus'
  }
});

// 使用pipeline处理文档
const result = await pipeline.processDocument(documentText);
```

### 向后兼容模式

```javascript
// 禁用增强提取，使用原有pipeline
const pipeline = createEnhancedPipeline({
  enableEnhancedExtraction: false
});

// 行为与原有pipeline完全一致
const result = await pipeline.processDocument(documentText);
```

## 错误处理

### 处理LLM失败

系统会自动处理LLM失败，回退到算法提取：

```javascript
const result = await coordinator.extract(documentText);

if (result.metadata.status === 'partial_success') {
  console.log('LLM提取失败，使用算法提取结果');
  console.log('错误信息:', result.metadata.errors);
}
```

### 处理完全失败

```javascript
try {
  const result = await coordinator.extract(documentText);
  
  if (result.metadata.status === 'failed') {
    console.error('提取完全失败');
  }
} catch (error) {
  console.error('提取异常:', error.message);
}
```

## 性能优化

### 启用缓存

```javascript
const config = new Configuration({
  performance: {
    enableCache: true,
    cacheExpiry: 86400  // 24小时
  }
});
```

### 批处理优化

```javascript
// 使用批处理减少LLM调用
const config = new Configuration({
  performance: {
    batchSize: 10  // 每批处理10个文档
  }
});
```

### 监控Token使用

```javascript
const result = await coordinator.extract(documentText);

console.log('Token使用量:', result.metadata.tokensUsed);
console.log('估算成本:', result.metadata.cost);
```

## 质量保证

### 验证提取结果

```javascript
const result = await coordinator.extract(documentText);

// 检查质量指标
if (result.quality.entityCompleteness < 0.7) {
  console.warn('实体提取不完整');
}

if (result.quality.averageConfidence < 0.6) {
  console.warn('平均置信度较低');
}

// 检查警告
if (result.quality.warnings.length > 0) {
  console.warn('质量警告:', result.quality.warnings);
}
```

### 设置质量阈值

```javascript
const config = new Configuration({
  quality: {
    minEntities: 3,        // 至少3个实体
    minRelations: 5,       // 至少5个关系
    minConfidence: 0.6     // 最小置信度0.6
  }
});
```

## 故障排除

### LLM调用超时

如果LLM调用经常超时：

1. 增加超时时间：
```javascript
const config = new Configuration({
  llm: { timeout: 60000 }  // 60秒
});
```

2. 减少文档长度
3. 检查网络连接
4. 验证API密钥

### 提取结果为空

如果提取结果为空：

1. 检查文档内容是否有效
2. 验证配置是否正确
3. 查看错误日志
4. 尝试仅使用算法提取

### 内存使用过高

如果内存使用过高：

1. 减少批处理大小
2. 清理缓存
3. 限制并发处理数量

## API参考

详细API文档请参考：
- [ExtractionCoordinator API](./extraction_coordinator.js)
- [Configuration API](./configuration.js)
- [数据模型](./types.js)

## 示例代码

更多示例代码请参考：
- [基本示例](./integration_example.js)
- [集成示例](./pipeline_integration.js)
- [测试示例](./real_document_validation.test.js)

## 支持

如有问题或建议，请联系开发团队或提交Issue。
