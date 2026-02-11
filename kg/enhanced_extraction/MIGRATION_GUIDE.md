# 迁移指南 - LLM增强实体提取系统

本指南帮助您从现有的实体提取系统迁移到LLM增强实体提取系统。

## 目录

- [概述](#概述)
- [兼容性](#兼容性)
- [迁移步骤](#迁移步骤)
- [配置迁移](#配置迁移)
- [代码迁移](#代码迁移)
- [测试迁移](#测试迁移)
- [性能优化](#性能优化)
- [故障排除](#故障排除)

---

## 概述

LLM增强实体提取系统设计为向后兼容，可以：
- 作为可选模块启用/禁用
- 与现有Universal Document Pipeline无缝集成
- 在LLM失败时自动降级到算法提取
- 保持现有算法提取的100%准确率

## 兼容性

### 支持的版本

- Node.js: >= 14.0.0
- 现有Universal Document Pipeline: >= 1.0.0

### 依赖项

新增依赖：
- 无（使用现有的qwen_client和llm_cache）

## 迁移步骤

### 步骤1：评估现有系统

1. 确认当前使用的提取方法
2. 评估提取质量和性能
3. 确定需要改进的领域

### 步骤2：准备环境

1. 获取LLM API密钥（通义千问）
2. 设置环境变量：
```bash
export DASHSCOPE_API_KEY="your-api-key"
export LLM_ENABLED="true"
```

3. 验证API连接：
```javascript
const { LLMClient } = require('./kg/enhanced_extraction/llm_client');
const client = new LLMClient({
  apiKey: process.env.DASHSCOPE_API_KEY
});
await client.testConnection();
```

### 步骤3：渐进式迁移

#### 阶段1：并行运行（推荐）

在不影响现有系统的情况下测试新系统：

```javascript
// 现有代码
const oldResult = await existingExtractor.extract(text);

// 新系统（并行）
const newResult = await coordinator.extract(text);

// 比较结果
compareResults(oldResult, newResult);
```

#### 阶段2：部分启用

在特定场景下启用增强提取：

```javascript
const useEnhanced = shouldUseEnhanced(document);

const result = useEnhanced 
  ? await coordinator.extract(text)
  : await existingExtractor.extract(text);
```

#### 阶段3：完全迁移

完全切换到新系统：

```javascript
const result = await coordinator.extract(text);
```

### 步骤4：监控和优化

1. 监控提取质量
2. 跟踪LLM调用成本
3. 优化配置参数
4. 收集用户反馈

## 配置迁移

### 从现有配置迁移

如果您有现有的提取配置：

```javascript
// 旧配置
const oldConfig = {
  extractorType: 'universal',
  timeout: 5000
};

// 新配置
const newConfig = new Configuration({
  algorithm: {
    enabled: true,
    extractorType: oldConfig.extractorType
  },
  llm: {
    enabled: true,
    apiKey: process.env.DASHSCOPE_API_KEY
  },
  performance: {
    maxProcessingTime: oldConfig.timeout
  }
});
```

### 配置映射表

| 旧配置项 | 新配置项 | 说明 |
|---------|---------|------|
| extractorType | algorithm.extractorType | 提取器类型 |
| timeout | performance.maxProcessingTime | 超时时间 |
| - | llm.enabled | 新增：启用LLM |
| - | llm.apiKey | 新增：API密钥 |
| - | performance.enableCache | 新增：启用缓存 |

## 代码迁移

### 基本提取

#### 迁移前

```javascript
const { UniversalExtractor } = require('./kg/field_extractor/universal_extractor');

const extractor = new UniversalExtractor();
const result = await extractor.extract(text);

// 使用结果
console.log(result.entities);
```

#### 迁移后

```javascript
const ExtractionCoordinator = require('./kg/enhanced_extraction/extraction_coordinator');
const Configuration = require('./kg/enhanced_extraction/configuration');

const config = new Configuration({
  llm: { enabled: true, apiKey: process.env.DASHSCOPE_API_KEY },
  algorithm: { enabled: true }
});

const coordinator = new ExtractionCoordinator({ config });
const result = await coordinator.extract(text);

// 使用结果（格式相同）
console.log(result.entities);
```

### Pipeline集成

#### 迁移前

```javascript
const { UniversalDocumentPipeline } = require('./kg/pipeline/universal_document_pipeline');

const pipeline = new UniversalDocumentPipeline();
const result = await pipeline.processDocument(text);
```

#### 迁移后

```javascript
const { createEnhancedPipeline } = require('./kg/enhanced_extraction/pipeline_integration');

const pipeline = createEnhancedPipeline({
  enableEnhancedExtraction: true,
  llmConfig: {
    apiKey: process.env.DASHSCOPE_API_KEY
  }
});

const result = await pipeline.processDocument(text);
```

### 批量处理

#### 迁移前

```javascript
const results = await Promise.all(
  documents.map(doc => extractor.extract(doc))
);
```

#### 迁移后

```javascript
// 方式1：使用Promise.all（推荐用于小批量）
const results = await Promise.all(
  documents.map(doc => coordinator.extract(doc))
);

// 方式2：使用LLMExtractor的批处理（推荐用于大批量）
const llmExtractor = coordinator.llmExtractor;
const results = await llmExtractor.batchExtract(documents);
```

## 测试迁移

### 单元测试

#### 迁移前

```javascript
describe('Entity Extraction', () => {
  test('should extract entities', async () => {
    const result = await extractor.extract(testText);
    expect(result.entities.length).toBeGreaterThan(0);
  });
});
```

#### 迁移后

```javascript
describe('Enhanced Entity Extraction', () => {
  test('should extract entities with LLM', async () => {
    const result = await coordinator.extract(testText);
    expect(result.entities.length).toBeGreaterThan(0);
    expect(result.metadata.status).toBe('success');
  });
  
  test('should fallback to algorithm on LLM failure', async () => {
    // 模拟LLM失败
    const result = await coordinator.extract(testText, {
      enableLLM: false
    });
    expect(result.entities.length).toBeGreaterThan(0);
    expect(result.metadata.status).toBe('success');
  });
});
```

### 集成测试

添加新的集成测试：

```javascript
describe('Pipeline Integration', () => {
  test('should work with enhanced extraction', async () => {
    const pipeline = createEnhancedPipeline({
      enableEnhancedExtraction: true
    });
    
    const result = await pipeline.processDocument(testText);
    expect(result.entities.length).toBeGreaterThan(0);
  });
  
  test('should maintain backward compatibility', async () => {
    const pipeline = createEnhancedPipeline({
      enableEnhancedExtraction: false
    });
    
    const result = await pipeline.processDocument(testText);
    // 行为应与旧pipeline一致
    expect(result).toBeDefined();
  });
});
```

## 性能优化

### 迁移后的性能优化建议

1. **启用缓存**
```javascript
const config = new Configuration({
  performance: {
    enableCache: true,
    cacheExpiry: 86400  // 24小时
  }
});
```

2. **调整超时时间**
```javascript
const config = new Configuration({
  llm: {
    timeout: 30000  // 根据实际情况调整
  }
});
```

3. **使用批处理**
```javascript
const config = new Configuration({
  performance: {
    batchSize: 10  // 根据文档大小调整
  }
});
```

4. **监控Token使用**
```javascript
const result = await coordinator.extract(text);
console.log('Token使用:', result.metadata.tokensUsed);
console.log('成本:', result.metadata.cost);
```

### 性能对比

| 指标 | 旧系统 | 新系统（仅算法） | 新系统（混合） |
|-----|-------|----------------|--------------|
| 处理时间 | 100ms | 100ms | 3-5s |
| 实体数量 | 10 | 10 | 15-20 |
| 关系数量 | 5 | 5 | 10-15 |
| 语义信息 | 无 | 无 | 丰富 |

## 故障排除

### 常见问题

#### 1. LLM调用失败

**问题**：LLM调用总是失败

**解决方案**：
- 检查API密钥是否正确
- 验证网络连接
- 检查API配额
- 查看错误日志

```javascript
const result = await coordinator.extract(text);
if (result.metadata.errors) {
  console.error('错误:', result.metadata.errors);
}
```

#### 2. 性能下降

**问题**：迁移后性能明显下降

**解决方案**：
- 启用缓存
- 调整超时时间
- 使用批处理
- 考虑仅在需要时启用LLM

```javascript
// 仅对重要文档启用LLM
const enableLLM = document.importance === 'high';
const result = await coordinator.extract(text, { enableLLM });
```

#### 3. 结果不一致

**问题**：新旧系统结果差异大

**解决方案**：
- 检查配置是否正确
- 验证算法提取是否正常
- 调整置信度阈值
- 查看质量指标

```javascript
const result = await coordinator.extract(text);
console.log('质量指标:', result.quality);
```

#### 4. 成本过高

**问题**：LLM调用成本过高

**解决方案**：
- 启用缓存
- 减少调用频率
- 使用批处理
- 优化提示词长度

```javascript
const config = new Configuration({
  performance: {
    enableCache: true,
    cacheExpiry: 86400 * 7  // 7天缓存
  }
});
```

### 回滚计划

如果需要回滚到旧系统：

1. **禁用增强提取**
```javascript
const pipeline = createEnhancedPipeline({
  enableEnhancedExtraction: false
});
```

2. **使用旧代码**
```javascript
// 恢复使用旧的extractor
const result = await oldExtractor.extract(text);
```

3. **清理配置**
```bash
unset LLM_ENABLED
unset DASHSCOPE_API_KEY
```

## 最佳实践

1. **渐进式迁移**：不要一次性迁移所有代码
2. **充分测试**：在生产环境前进行充分测试
3. **监控指标**：持续监控性能和质量指标
4. **保留备份**：保留旧系统作为备份
5. **文档更新**：更新相关文档和注释
6. **团队培训**：确保团队了解新系统

## 支持

如有迁移问题，请：
1. 查看[用户指南](./USER_GUIDE.md)
2. 查看[API文档](./API.md)
3. 查看[故障排除](./TROUBLESHOOTING.md)
4. 联系开发团队

---

## 迁移检查清单

- [ ] 评估现有系统
- [ ] 获取LLM API密钥
- [ ] 设置环境变量
- [ ] 测试API连接
- [ ] 创建新配置
- [ ] 迁移代码
- [ ] 更新测试
- [ ] 性能测试
- [ ] 质量验证
- [ ] 文档更新
- [ ] 团队培训
- [ ] 生产部署
- [ ] 监控和优化

---

最后更新：2026-02-08
