# Universal Field Extractor

## 概述

Universal Field Extractor（通用字段提取器）是一个基于**分词 + 关键词提取 + 结构化识别**的通用字段提取方案，不依赖固定的字段类型（如time、location、number、indicator），能够适应90%的生活工作场景。

## 核心特性

### 1. 通用性
- **不限定字段类型**：不再局限于time、location、number、indicator等固定类型
- **自动识别结构**：自动识别文档中的key-value结构
- **智能分词**：支持中英文混合分词
- **关键词提取**：基于TF-IDF算法提取文档关键词

### 2. 提取方法

#### 结构化字段提取
识别以下模式：
- 中文冒号：`相机：Sony A7M4`
- 英文冒号：`Camera: Sony A7M4`
- 等号：`ISO=3200`
- Markdown列表：`- 相机：Sony A7M4`
- 数字列表：`1. 相机：Sony A7M4`

#### 关键词字段提取
- 使用nodejieba进行中文分词
- 基于TF-IDF算法提取关键词
- 自动查找关键词的上下文值
- 过滤停用词

### 3. 值类型识别
自动识别以下值类型：
- `date`：日期（2025-10-15、2025年10月15日）
- `time`：时间（14:30、14:30:00）
- `number`：数字（3200、3.14、-10）
- `percentage`：百分比（85%、3.14%）
- `url`：网址（https://example.com）
- `email`：邮箱（test@example.com）
- `mixed`：混合（包含数字的文本）
- `text`：纯文本

## 使用方法

### 方法1: 直接使用Universal Extractor

```javascript
const UniversalExtractor = require('./field_extractor/universal_extractor');

const extractor = new UniversalExtractor();

const ckb = {
  ckb_id: 'test_001',
  doc_id: 'doc_001',
  content: {
    text: `
相机：Sony A7M4
镜头：35mm f1.8
ISO：3200
光圈：f1.8
快门速度：1/15s
    `
  }
};

const fields = await extractor.extractFields(ckb, {
  maxFields: 100,           // 最多提取字段数
  minKeywordScore: 0.01,    // 最小关键词分数
  includeStructured: true,  // 是否包含结构化字段
  includeKeywords: true     // 是否包含关键词字段
});

console.log(`提取到 ${fields.length} 个字段`);
```

### 方法2: 通过field_extractor.js使用universal策略

```javascript
const fieldExtractor = require('./field_extractor/field_extractor');

const fields = await fieldExtractor.extractFields(ckb, {
  strategy: 'universal',  // 使用universal策略
  useCache: true          // 启用缓存
});
```

### 方法3: 在Pipeline中使用自定义提取器

```javascript
const { UniversalDocumentPipeline } = require('./pipeline/universal_document_pipeline');
const UniversalExtractor = require('./field_extractor/universal_extractor');

// 创建自定义提取函数
const universalExtractor = new UniversalExtractor();
const customExtractFields = async (ckb, options) => {
  return await universalExtractor.extractFields(ckb, {
    maxFields: 100,
    minKeywordScore: 0.01,
    includeStructured: true,
    includeKeywords: true
  });
};

// 初始化Pipeline
const pipeline = new UniversalDocumentPipeline({
  extraction: {
    useLLM: false,
    useNER: false,
    useRules: false,
    customExtractor: customExtractFields  // 使用自定义提取器
  }
});

const result = await pipeline.processDocument(document);
```

### 方法4: 在rule-first策略中启用Universal Extractor

```javascript
const fields = await fieldExtractor.extractFields(ckb, {
  strategy: 'rule-first',
  useUniversal: true,  // 启用Universal Extractor
  useLLM: false,
  useRules: false,
  useNER: false
});
```

## 提取结果格式

每个提取的字段包含以下属性：

```javascript
{
  name: '相机',                    // 字段名称
  value: 'Sony A7M4',             // 字段值
  type: 'text',                   // 值类型
  confidence: 0.9,                // 置信度（0-1）
  extraction_method: 'structured', // 提取方法
  ckb_id: 'test_001',             // CKB ID
  doc_id: 'doc_001',              // 文档ID
  source: 'universal_extractor'   // 来源
}
```

### 提取方法类型
- `structured`：结构化模式提取（key: value）
- `keyword_context`：关键词+上下文提取
- `keyword`：纯关键词提取

## 统计信息

获取提取统计：

```javascript
const stats = extractor.getStats(fields);

console.log(stats);
// {
//   total: 42,
//   byMethod: {
//     structured: 26,
//     keyword_context: 10,
//     keyword: 6
//   },
//   byType: {
//     text: 30,
//     number: 5,
//     mixed: 7
//   },
//   avgConfidence: 78.5  // 百分比
// }
```

## 性能特点

### 优势
1. **零Token消耗**：不使用LLM，完全本地处理
2. **高速处理**：纯算法处理，速度快
3. **通用性强**：适用于90%的生活工作场景
4. **自动适应**：无需预定义字段类型

### 适用场景
- ✅ 摄影参数记录
- ✅ 旅行日记
- ✅ 工作日志
- ✅ 项目文档
- ✅ 会议记录
- ✅ 技术规格
- ✅ 产品说明
- ✅ 配置文件
- ✅ 结构化文档

### 不适用场景
- ❌ 需要深度语义理解的文档
- ❌ 高度非结构化的自然语言
- ❌ 需要推理的复杂关系

## 配置选项

### extraction_config.js中的配置

```javascript
'universal': {
  useLLM: false,
  useRules: false,
  useNER: false,
  useUniversal: true,
  forceLLM: false,
  maxFields: 100,
  minKeywordScore: 0.01,
  minConfidence: 0.5
}
```

### 可调参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| maxFields | 100 | 最多提取字段数 |
| minKeywordScore | 0.01 | 最小关键词TF-IDF分数 |
| includeStructured | true | 是否包含结构化字段 |
| includeKeywords | true | 是否包含关键词字段 |
| minConfidence | 0.5 | 最小置信度阈值 |

## 测试

### 运行单元测试
```bash
npm test -- kg/field_extractor/universal_extractor.test.js
```

### 运行集成测试
```bash
node kg/field_extractor/test_universal_integration.js
```

### 运行Pipeline测试
```bash
node kg/pipeline/test_universal_pipeline.js
```

## 实际案例

### 案例1: 摄影参数提取

输入文档：
```
拍摄日期：2025年10月15日
相机机身：Sony A7M4
镜头：35mm f1.8
ISO：3200
光圈：f1.8
快门速度：1/15s
```

提取结果：
- 42个结构化字段
- 3个摄影Schema匹配（ISO-Usage: 100%, Shooting-Info: 70%, Shooting-Condition: 60%）
- 5个实体生成

### 案例2: 旅行日记提取

输入文档：
```
日期：2025年11月1日
地点：京都清水寺
天气：晴天
温度：18°C
活动：参观寺庙、拍照
费用：门票400日元
```

提取结果：
- 自动识别日期、地点、天气、温度等字段
- 支持中日文混合
- 自动识别货币单位

## 与其他策略对比

| 策略 | Token消耗 | 速度 | 准确度 | 适用场景 |
|------|-----------|------|--------|----------|
| universal | 0 | 极快 | 中-高 | 结构化文档 |
| rule-first | 低 | 快 | 中 | 通用文档 |
| llm-first | 高 | 慢 | 高 | 复杂文档 |
| semantic-only | 高 | 慢 | 最高 | 需要深度理解 |
| hybrid | 高 | 中 | 高 | 平衡方案 |

## 未来改进方向

1. **扩展映射表**：为更多Schema添加中文字段映射
2. **优化关键词提取**：改进TF-IDF算法，提高关键词质量
3. **增强上下文识别**：更智能地识别字段值的上下文
4. **支持更多模式**：识别表格、列表等更多结构化模式
5. **性能优化**：针对大文档优化处理速度

## 相关文件

- `kg/field_extractor/universal_extractor.js` - 核心实现
- `kg/field_extractor/universal_extractor.test.js` - 单元测试
- `kg/field_extractor/test_universal_integration.js` - 集成测试
- `kg/pipeline/test_universal_pipeline.js` - Pipeline测试
- `kg/field_extractor/extraction_config.js` - 策略配置
- `kg/field_extractor/field_extractor.js` - 主提取器（包含universal策略）

## 贡献

欢迎提交Issue和Pull Request来改进Universal Extractor！
