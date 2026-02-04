# 三阶段Schema匹配实现说明

## 概述

本文档说明了通用文档流水线中三阶段Schema匹配的实现，该实现完全遵循用户的设计要求。

## 设计原则

**LLM作为兜底方案（100%启动）**：LLM不是概率性启动，而是作为算法匹配失败后的必然兜底方案，确保所有未匹配字段都有机会被处理。

## 三个阶段

### 阶段1: 算法匹配（Algorithm Matching）

**目标**：使用映射表快速匹配字段

**流程**：
```
提取字段 (60个)
  ↓
映射表判断命中
  ├─ "时间" → Time (命中)
  ├─ "数值" → Value (命中)
  ├─ "单位" → Unit (命中)
  ├─ "指标" → Indicator (命中)
  ├─ "实体" → Entity (命中)
  ├─ "摄影技巧" → ??? (未命中)
  ├─ "肖像拍摄" → ??? (未命中)
  └─ ... 其他字段
  ↓
在Schema上计数
  ├─ EITV Schema: 5个字段命中
  ├─ Focus-Mode: 2个字段命中
  ├─ Shutter-Usage: 2个字段命中
  └─ ...
  ↓
Schema排名（算法阶段）
  1. EITV: 5/5 = 100%
  2. Focus-Mode: 2/2 = 100%
  3. Shutter-Usage: 2/2 = 100%
```

**实现位置**：`kg/pipeline/universal_document_pipeline.js` - `_matchSchema()` 方法

**关键代码**：
```javascript
// 阶段1: 算法匹配（映射表）
const schemaMatchResults = [];
const allMatchedFieldNames = new Set(); // 跟踪所有被匹配的字段名

for (const schema of sortedSchemas) {
  // 使用映射表归一化字段
  const normalizedFields = await this._normalizeFieldsWithCache(
    context.data.extractedFields,
    schema,
    normalizationCache,
    options
  );
  
  // 记录成功匹配的字段名
  normalizedFields
    .filter(f => f.mappingMethod && f.mappingMethod !== 'none')
    .forEach(f => {
      const originalField = context.data.extractedFields.find(
        ef => ef.name === f.name || ef.value === f.value
      );
      if (originalField) {
        allMatchedFieldNames.add(originalField.name);
      }
    });
  
  // 计算完整度并保存结果
  // ...
}

// 识别未匹配的字段
const unmatchedFields = context.data.extractedFields.filter(
  field => !allMatchedFieldNames.has(field.name)
);
```

### 阶段2: LLM匹配（LLM Fallback）

**目标**：使用LLM处理算法未能匹配的字段

**流程**：
```
未匹配字段 (例如: "摄影技巧", "肖像拍摄", "背景虚化" 等)
  ↓
发送给LLM判断
  Prompt: "以下字段可能属于哪些Schema的哪些字段？
    - 摄影技巧
    - 肖像拍摄
    - 背景虚化
    - 定焦镜头
    ...
    
    候选Schema:
    1. Shooting-Info (拍摄信息)
    2. Composition-Type (构图类型)
    3. Lens-Choice (镜头选择)
    ..."
  ↓
LLM输出命中结果
  {
    "摄影技巧": { schema: "Shooting-Info", field: "Technique" },
    "肖像拍摄": { schema: "Shooting-Info", field: "Subject" },
    "背景虚化": { schema: "Aperture-Usage", field: "Effect" },
    "定焦镜头": { schema: "Lens-Choice", field: "LensType" }
  }
  ↓
在Schema上计数（LLM阶段）
  ├─ Shooting-Info: +2个字段
  ├─ Aperture-Usage: +1个字段
  └─ Lens-Choice: +1个字段
  ↓
Schema排名（LLM阶段）
  1. Shooting-Info: 2个新字段
  2. Aperture-Usage: 1个新字段
  3. Lens-Choice: 1个新字段
```

**实现位置**：
- `kg/pipeline/universal_document_pipeline.js` - `_llmMatchFields()` 方法
- `kg/prompts/schema_match.js` - LLM Prompt模板

**关键代码**：
```javascript
// 阶段2: LLM匹配（兜底方案）
let llmMatchesBySchema = new Map();
if (unmatchedFields.length > 0 && options.schemaMatching.useLLM) {
  llmMatchesBySchema = await this._llmMatchFields(
    unmatchedFields,
    sortedSchemas,
    context.data.ckb,
    options
  );
}
```

**LLM Prompt设计**：
- 输入：未匹配字段列表 + 候选Schema列表 + 文档上下文
- 输出：JSON格式的匹配结果
- 约束：只输出置信度 >= 0.7 的匹配
- 验证：使用 `validateSchemaMatchResult()` 验证LLM输出

### 阶段3: 合并排名（Merge & Filter）

**目标**：合并算法和LLM的匹配结果，按完整度排名并筛选

**流程**：
```
算法结果 + LLM结果
  ├─ EITV: 5 + 0 = 5个字段 (100%)
  ├─ Focus-Mode: 2 + 0 = 2个字段 (100%)
  ├─ Shutter-Usage: 2 + 0 = 2个字段 (100%)
  ├─ Shooting-Info: 4 + 2 = 6个字段 (85%)
  ├─ Aperture-Usage: 2 + 1 = 3个字段 (100%)
  └─ Lens-Choice: 0 + 1 = 1个字段 (20%)
  ↓
最终排名（按完整度）
  1. EITV: 100%
  2. Focus-Mode: 100%
  3. Shutter-Usage: 100%
  4. Aperture-Usage: 100%
  5. Shooting-Info: 85%
  ↓
筛选：完整度 > 40%
  ✅ EITV: 100% → 进行实体合成
  ✅ Focus-Mode: 100% → 进行实体合成
  ✅ Shutter-Usage: 100% → 进行实体合成
  ✅ Aperture-Usage: 100% → 进行实体合成
  ✅ Shooting-Info: 85% → 进行实体合成
  ❌ Lens-Choice: 20% → 不合成
```

**实现位置**：`kg/pipeline/universal_document_pipeline.js` - `_mergeMatchResults()` 方法

**关键代码**：
```javascript
// 阶段3: 合并算法和LLM匹配结果
const mergedResults = this._mergeMatchResults(
  schemaMatchResults,
  llmMatchesBySchema,
  sortedSchemas
);

// 按加权完整度排序
mergedResults.sort((a, b) => b.weightedCompleteness - a.weightedCompleteness);

// 筛选：完整度 > 40% 的Schema（用户要求的阈值）
const COMPLETENESS_THRESHOLD = 0.4;
const qualifiedSchemas = mergedResults.filter(
  result => result.weightedCompleteness >= COMPLETENESS_THRESHOLD
);
```

## 关键改进点

### 1. 阈值调整：60% → 40%

**原因**：用户明确要求使用40%作为完整度阈值

**实现**：
```javascript
const COMPLETENESS_THRESHOLD = 0.4; // 用户要求的阈值
const qualifiedSchemas = mergedResults.filter(
  result => result.weightedCompleteness >= COMPLETENESS_THRESHOLD
);
```

### 2. LLM作为100%兜底方案

**原因**：LLM不是概率性启动，而是必然的兜底方案

**实现**：
```javascript
// 只要有未匹配字段且启用LLM，就调用LLM
if (unmatchedFields.length > 0 && options.schemaMatching.useLLM) {
  llmMatchesBySchema = await this._llmMatchFields(...);
}
```

### 3. 未匹配字段跟踪

**原因**：需要准确识别哪些字段未被算法匹配，以便传递给LLM

**实现**：
```javascript
const allMatchedFieldNames = new Set(); // 跟踪所有被匹配的字段名

// 在算法匹配阶段记录
normalizedFields
  .filter(f => f.mappingMethod && f.mappingMethod !== 'none')
  .forEach(f => {
    const originalField = context.data.extractedFields.find(...);
    if (originalField) {
      allMatchedFieldNames.add(originalField.name);
    }
  });

// 识别未匹配字段
const unmatchedFields = context.data.extractedFields.filter(
  field => !allMatchedFieldNames.has(field.name)
);
```

### 4. 合并结果统计

**原因**：需要清晰展示算法和LLM各自的贡献

**实现**：
```javascript
mergedResults.set(schemaName, {
  schema: schema,
  schema_name: schemaName,
  algorithmMatches: result.mappedFields || 0,
  llmMatches: 0,
  totalMatches: result.mappedFields || 0,
  completeness: result.completeness || 0,
  weightedCompleteness: result.weightedCompleteness || 0,
  normalizedFields: result.normalizedFields || [],
  threshold: result.threshold || 0.6
});
```

## 配置选项

### 启用/禁用LLM匹配

```javascript
const pipeline = new UniversalDocumentPipeline({
  schemaMatching: {
    useLLM: true,  // 启用LLM匹配（默认）
    minConfidence: 0.5,
    fallbackToGeneric: true
  }
});
```

### 调整完整度阈值

阈值已硬编码为40%（用户要求），如需调整：

```javascript
// 在 _matchSchema 方法中
const COMPLETENESS_THRESHOLD = 0.4; // 修改此值
```

## 性能优化

### 1. 缓存机制

使用缓存避免重复归一化相同字段：

```javascript
const normalizationCache = new Map();
const normalizedFields = await this._normalizeFieldsWithCache(
  context.data.extractedFields,
  schema,
  normalizationCache,
  options
);
```

### 2. Token使用跟踪

记录LLM调用的token使用情况：

```javascript
const tokens = response._meta?.tokens || 0;
await tokenTracker.recordUsage({
  module: 'pipeline',
  operation: 'llm_schema_match',
  tokens: tokens,
  ckb_id: ckb.ckb_id,
  doc_id: ckb.doc_id,
  model_name: 'qwen'
});
```

### 3. 批量处理

LLM一次性处理所有未匹配字段，而不是逐个处理，减少API调用次数。

## 测试验证

### 运行测试

```bash
node kg/pipeline/compare_llm_vs_local.js
```

### 预期输出

```
[Pipeline] 阶段1: 算法匹配（映射表）...
[Pipeline] 算法匹配完成: 50 个Schema, 26/60 个字段被匹配
[Pipeline] 未匹配字段: 27 个

[Pipeline] 阶段2: LLM匹配 27 个未匹配字段...
[Pipeline] LLM匹配完成: 15 个字段匹配到 5 个Schema

[Pipeline] 阶段3: 合并算法和LLM匹配结果...
[Pipeline] 合并结果统计:
  1. Focus-Mode: 完整度 100.0% (算法: 2, LLM: 0, 总计: 2/2)
  2. Shooting-Info: 完整度 85.0% (算法: 4, LLM: 2, 总计: 6/7)
  ...

[Pipeline] 筛选结果: 12/50 个Schema完整度 >= 40%
```

## 文件清单

### 新增文件

1. **kg/prompts/schema_match.js** - LLM Schema匹配Prompt模板
   - `buildSchemaMatchPrompt()` - 构建Prompt
   - `validateSchemaMatchResult()` - 验证LLM输出

### 修改文件

1. **kg/pipeline/universal_document_pipeline.js**
   - `_matchSchema()` - 主流程（三阶段）
   - `_llmMatchFields()` - LLM匹配实现
   - `_mergeMatchResults()` - 结果合并实现

## 总结

三阶段Schema匹配实现完全遵循用户设计：

✅ **阶段1**：算法匹配（映射表）  
✅ **阶段2**：LLM匹配（100%兜底）  
✅ **阶段3**：合并排名（40%阈值）  

关键特性：
- LLM作为兜底方案，100%启动处理未匹配字段
- 使用40%完整度阈值筛选Schema
- 准确跟踪未匹配字段
- 清晰展示算法和LLM各自的贡献
- 优化性能（缓存、批量处理）

这个实现确保了：
1. 所有字段都有机会被匹配（算法 + LLM）
2. 更多Schema被发现（提高召回率）
3. 完整度计算更准确（合并计数）
4. 阈值更合理（40%而非60%）
