# LLM增强实体提取系统 - API文档

## 目录

- [ExtractionCoordinator](#extractioncoordinator)
- [Configuration](#configuration)
- [LLMExtractor](#llmextractor)
- [AlgorithmExtractor](#algorithmextractor)
- [ResultFusion](#resultfusion)
- [ConflictResolver](#conflictresolver)
- [QualityValidator](#qualityvalidator)
- [数据类型](#数据类型)

---

## ExtractionCoordinator

提取协调器，协调整个提取流程。

### 构造函数

```javascript
new ExtractionCoordinator(options)
```

**参数：**
- `options.config` (Configuration): 配置对象
- `options.algorithmExtractor` (AlgorithmExtractor): 算法提取器（可选）
- `options.llmExtractor` (LLMExtractor): LLM提取器（可选）
- `options.resultFusion` (ResultFusion): 结果融合器（可选）
- `options.conflictResolver` (ConflictResolver): 冲突解决器（可选）
- `options.qualityValidator` (QualityValidator): 质量验证器（可选）
- `options.errorHandler` (ErrorHandler): 错误处理器（可选）

### 方法

#### extract(documentText, options)

执行混合提取。

```javascript
async extract(documentText, options = {})
```

**参数：**
- `documentText` (string): 文档文本
- `options` (Object): 提取选项
  - `enableLLM` (boolean): 是否启用LLM提取
  - `enableAlgorithm` (boolean): 是否启用算法提取
  - `timeout` (number): 超时时间（毫秒）
  - `language` (string): 文档语言 ('zh' | 'en' | 'auto')
  - `documentId` (string): 文档ID

**返回值：** Promise<ExtractionResult>

**示例：**
```javascript
const result = await coordinator.extract('文档内容...', {
  enableLLM: true,
  enableAlgorithm: true,
  timeout: 5000,
  language: 'zh'
});
```

#### configure(config)

配置提取策略。

```javascript
configure(config)
```

**参数：**
- `config` (Object): 配置对象
  - `enableLLM` (boolean): 是否启用LLM提取
  - `enableAlgorithm` (boolean): 是否启用算法提取
  - `timeout` (number): 超时时间
  - `language` (string): 文档语言

**示例：**
```javascript
coordinator.configure({
  enableLLM: true,
  timeout: 10000
});
```

#### getStatistics()

获取提取统计信息。

```javascript
getStatistics()
```

**返回值：** Object

**示例：**
```javascript
const stats = coordinator.getStatistics();
console.log('错误指标:', stats.errorMetrics);
```

#### resetStatistics()

重置统计信息。

```javascript
resetStatistics()
```

---

## Configuration

配置管理器。

### 构造函数

```javascript
new Configuration(config)
```

**参数：**
- `config` (Object): 配置对象（参见[配置选项](#配置选项)）

### 静态方法

#### Configuration.fromFile(filePath)

从文件加载配置。

```javascript
static fromFile(filePath)
```

**参数：**
- `filePath` (string): 配置文件路径

**返回值：** Configuration

**示例：**
```javascript
const config = Configuration.fromFile('./config.json');
```

#### Configuration.fromEnv()

从环境变量加载配置。

```javascript
static fromEnv()
```

**返回值：** Configuration

**示例：**
```javascript
const config = Configuration.fromEnv();
```

### 方法

#### get(path)

获取配置值。

```javascript
get(path)
```

**参数：**
- `path` (string): 点分隔的配置路径（如 'llm.enabled'）

**返回值：** any

**示例：**
```javascript
const enabled = config.get('llm.enabled');
```

#### set(path, value)

设置配置值。

```javascript
set(path, value)
```

**参数：**
- `path` (string): 点分隔的配置路径
- `value` (any): 配置值

**示例：**
```javascript
config.set('llm.timeout', 60000);
```

#### getAll()

获取完整配置对象。

```javascript
getAll()
```

**返回值：** Object

#### toJSON()

导出配置为JSON字符串。

```javascript
toJSON()
```

**返回值：** string

#### saveToFile(filePath)

保存配置到文件。

```javascript
saveToFile(filePath)
```

**参数：**
- `filePath` (string): 保存路径

---

## LLMExtractor

LLM提取器。

### 构造函数

```javascript
new LLMExtractor(options)
```

**参数：**
- `options` (Object): 配置选项
  - `language` (string): 语言
  - `enableCache` (boolean): 是否启用缓存
  - `batchSize` (number): 批处理大小
  - `timeout` (number): 超时时间
  - `config` (Configuration): 配置对象

### 方法

#### extract(text, context)

提取语义信息。

```javascript
async extract(text, context = {})
```

**参数：**
- `text` (string): 文档文本
- `context` (Object): 上下文信息
  - `language` (string): 语言
  - `algorithmResults` (Array): 算法提取结果

**返回值：** Promise<LLMExtractionResult>

#### batchExtract(texts, context)

批量提取。

```javascript
async batchExtract(texts, context = {})
```

**参数：**
- `texts` (Array<string>): 文档文本数组
- `context` (Object): 共享上下文

**返回值：** Promise<Array<LLMExtractionResult>>

#### configure(newConfig)

更新配置。

```javascript
configure(newConfig)
```

**参数：**
- `newConfig` (Object): 新配置

#### getConfig()

获取当前配置。

```javascript
getConfig()
```

**返回值：** Object

---

## AlgorithmExtractor

算法提取器。

### 构造函数

```javascript
new AlgorithmExtractor(options)
```

**参数：**
- `options` (Object): 配置选项

### 方法

#### extract(text)

提取数值参数。

```javascript
async extract(text)
```

**参数：**
- `text` (string): 文档文本

**返回值：** Promise<AlgorithmExtractionResult>

---

## ResultFusion

结果融合器。

### 构造函数

```javascript
new ResultFusion(options)
```

**参数：**
- `options` (Object): 配置选项
  - `config` (Configuration): 配置对象

### 方法

#### fuse(algorithmResult, llmResult)

融合提取结果。

```javascript
fuse(algorithmResult, llmResult)
```

**参数：**
- `algorithmResult` (AlgorithmExtractionResult): 算法提取结果
- `llmResult` (LLMExtractionResult): LLM提取结果

**返回值：** FusedResult

#### detectConflicts(result)

检测冲突。

```javascript
detectConflicts(result)
```

**参数：**
- `result` (FusedResult): 融合结果

**返回值：** Array<Conflict>

---

## ConflictResolver

冲突解决器。

### 构造函数

```javascript
new ConflictResolver(options)
```

**参数：**
- `options` (Object): 配置选项
  - `strategy` (string): 解决策略

### 方法

#### resolve(conflicts, strategy)

解决冲突。

```javascript
resolve(conflicts, strategy = {})
```

**参数：**
- `conflicts` (Array<Conflict>): 冲突列表
- `strategy` (Object): 解决策略

**返回值：** Array<Resolution>

---

## QualityValidator

质量验证器。

### 构造函数

```javascript
new QualityValidator(options)
```

**参数：**
- `options` (Object): 配置选项
  - `config` (Configuration): 配置对象

### 方法

#### validate(result)

验证结果。

```javascript
validate(result)
```

**参数：**
- `result` (FusedResult): 融合结果

**返回值：** ValidationReport

#### calculateMetrics(result)

计算质量指标。

```javascript
calculateMetrics(result)
```

**参数：**
- `result` (FusedResult): 融合结果

**返回值：** QualityMetrics

---

## 数据类型

### ExtractionResult

```typescript
interface ExtractionResult {
  entities: Entity[];
  relations: Relation[];
  metadata: Metadata;
  quality: QualityMetrics;
}
```

### Entity

```typescript
interface Entity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, any>;
  confidence: number;
  source: 'algorithm' | 'llm';
  metadata: {
    extractedAt: string;
    context?: string;
  };
}
```

### Relation

```typescript
interface Relation {
  id: string;
  type: string;
  source: string;
  target: string;
  confidence: number;
  source: 'algorithm' | 'llm';
  metadata: {
    extractedAt: string;
    evidence?: string;
  };
}
```

### Metadata

```typescript
interface Metadata {
  documentId?: string;
  language: string;
  processingTime: number;
  algorithmTime: number;
  llmTime: number;
  tokensUsed: number;
  cost: number;
  llmModel: string;
  conflicts: number;
  status: 'success' | 'partial_success' | 'failed';
  errors?: Array<{phase: string, error: string}>;
}
```

### QualityMetrics

```typescript
interface QualityMetrics {
  entityCompleteness: number;
  relationCompleteness: number;
  averageConfidence: number;
  fieldCompleteness: number;
  warnings: string[];
}
```

### 配置选项

```typescript
interface ConfigurationOptions {
  llm: {
    enabled: boolean;
    model: string;
    apiKey: string;
    baseURL?: string;
    timeout: number;
    maxRetries: number;
    temperature: number;
    maxTokens: number;
  };
  algorithm: {
    enabled: boolean;
    extractorType: string;
  };
  fusion: {
    conflictStrategy: 'prefer_algorithm' | 'prefer_llm' | 'merge';
    deduplication: boolean;
    confidenceThreshold: number;
  };
  performance: {
    enableCache: boolean;
    cacheExpiry: number;
    batchSize: number;
    maxProcessingTime: number;
  };
  quality: {
    minEntities: number;
    minRelations: number;
    minConfidence: number;
    requiredFields: string[];
  };
  language: {
    default: 'zh' | 'en' | 'auto';
    supported: string[];
    autoDetect: boolean;
  };
}
```

---

## 错误类型

### ExtractionError

提取过程中的错误。

```javascript
class ExtractionError extends Error {
  constructor(message, cause)
}
```

### ConfigurationError

配置错误。

```javascript
class ConfigurationError extends Error {
  constructor(message)
}
```

### ValidationError

验证错误。

```javascript
class ValidationError extends Error {
  constructor(message, violations)
}
```

---

## 事件

### 错误事件

```javascript
coordinator.on('error', (error) => {
  console.error('提取错误:', error);
});
```

### 进度事件

```javascript
coordinator.on('progress', (progress) => {
  console.log('提取进度:', progress);
});
```

---

## 最佳实践

1. **始终处理错误**：使用try-catch包装提取调用
2. **启用缓存**：减少LLM调用成本
3. **设置合理超时**：根据文档大小调整超时时间
4. **监控质量指标**：定期检查提取质量
5. **使用批处理**：处理多个文档时使用批处理
6. **配置降级策略**：确保LLM失败时有备用方案

---

## 版本历史

- v1.0.0 (2026-02-08): 初始版本
  - 混合提取策略
  - 多语言支持
  - 质量保证
  - 性能优化

---

## 许可证

MIT License
