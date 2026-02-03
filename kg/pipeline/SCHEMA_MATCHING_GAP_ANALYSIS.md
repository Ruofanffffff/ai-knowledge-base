# Schema匹配实现差异分析

## 您的设计（正确的流程）

### 1. 算法匹配（第一阶段）
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

### 2. LLM匹配（第二阶段 - 兜底）
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

### 3. 合并排名（最终阶段）
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

## 当前实现（有问题）

### 当前流程
```
提取字段 (60个)
  ↓
映射表判断命中（仅算法）
  ├─ "时间" → Time (命中)
  ├─ "数值" → Value (命中)
  ├─ "单位" → Unit (命中)
  ├─ "指标" → Indicator (命中)
  ├─ "实体" → Entity (命中)
  ├─ "摄影技巧" → ❌ 未命中（丢失！）
  ├─ "肖像拍摄" → ❌ 未命中（丢失！）
  └─ ... 其他字段 → ❌ 未命中（丢失！）
  ↓
在Schema上计数（仅算法结果）
  ├─ EITV Schema: 5个字段命中
  ├─ Focus-Mode: 2个字段命中
  ├─ Shutter-Usage: 2个字段命中
  └─ ...
  ↓
Schema排名（仅算法）
  1. EITV: 5/5 = 100%
  2. Focus-Mode: 2/2 = 100%
  3. Shutter-Usage: 2/2 = 100%
  ↓
❌ 没有LLM匹配阶段！
❌ 未命中的字段直接丢失！
❌ 无法发现更多Schema匹配！
  ↓
筛选：完整度 > 60%（阈值）
  ✅ EITV: 100%
  ✅ Focus-Mode: 100%
  ✅ Shutter-Usage: 100%
  ✅ Aperture-Usage: 100%
  ✅ Shooting-Info: 85%
```

## 关键差异

| 方面 | 您的设计 | 当前实现 | 影响 |
|------|---------|---------|------|
| **算法匹配** | ✅ 第一阶段 | ✅ 已实现 | 正常 |
| **LLM匹配** | ✅ 第二阶段（兜底） | ❌ **完全缺失** | **严重问题** |
| **未匹配字段** | LLM处理 | 直接丢失 | 信息损失 |
| **Schema发现** | 算法+LLM | 仅算法 | 召回率低 |
| **完整度计算** | 合并计数 | 仅算法计数 | 不准确 |
| **阈值** | 40% | 60% (schema.threshold) | 过于严格 |

## 问题示例

### 场景：摄影课文档

**提取的字段**（60个）:
- 时间: 2025-10 ✅ (算法命中 → Time)
- 数值: 3, 5.5 ✅ (算法命中 → Value)
- 单位: 个 ✅ (算法命中 → Unit)
- 指标: 深度, 距离 ✅ (算法命中 → Indicator)
- 实体: 摄影点评专家 ✅ (算法命中 → Entity)
- **摄影技巧** ❌ (算法未命中，LLM应该处理但缺失)
- **肖像拍摄** ❌ (算法未命中，LLM应该处理但缺失)
- **背景虚化** ❌ (算法未命中，LLM应该处理但缺失)
- **定焦镜头** ❌ (算法未命中，LLM应该处理但缺失)
- **光圈大小** ❌ (算法未命中，LLM应该处理但缺失)
- ... 还有很多未命中的字段

**当前结果**:
- 只有5个字段被使用（算法命中的）
- 其他55个字段被丢弃
- 可能错过了很多Schema匹配机会

**应该的结果**（如果有LLM匹配）:
- 5个字段算法命中
- 20-30个字段LLM命中
- 发现更多Schema（如Composition-Type, Lens-Choice等）
- 更准确的完整度计算

## 需要修复的代码

### 1. 在`_matchSchema`中添加LLM匹配阶段

```javascript
async _matchSchema(context, options) {
  // 阶段1: 算法匹配（已实现）
  const algorithmResults = await this._algorithmMatch(extractedFields, schemas);
  
  // 阶段2: LLM匹配（需要添加）
  const unmatchedFields = this._getUnmatchedFields(extractedFields, algorithmResults);
  const llmResults = await this._llmMatch(unmatchedFields, schemas, options);
  
  // 阶段3: 合并结果（需要添加）
  const mergedResults = this._mergeMatchResults(algorithmResults, llmResults);
  
  // 阶段4: 筛选（完整度 > 40%）
  const qualifiedSchemas = mergedResults.filter(r => r.completeness > 0.4);
  
  return qualifiedSchemas;
}
```

### 2. 实现`_llmMatch`函数

```javascript
async _llmMatch(unmatchedFields, schemas, options) {
  if (!options.schemaMatching.useLLM || unmatchedFields.length === 0) {
    return [];
  }
  
  // 构建LLM Prompt
  const prompt = this._buildSchemaMatchPrompt(unmatchedFields, schemas);
  
  // 调用LLM
  const llmClient = getLLMClient();
  const response = await llmClient.callJSON(prompt);
  
  // 解析LLM输出
  const llmMatches = this._parseLLMMatchResponse(response);
  
  // 在Schema上计数
  const llmResults = this._countLLMMatches(llmMatches, schemas);
  
  return llmResults;
}
```

### 3. 实现`_mergeMatchResults`函数

```javascript
_mergeMatchResults(algorithmResults, llmResults) {
  const merged = new Map();
  
  // 添加算法结果
  algorithmResults.forEach(r => {
    merged.set(r.schema_name, {
      schema: r.schema,
      algorithmMatches: r.matchedFields,
      llmMatches: [],
      totalMatches: r.matchedFields.length
    });
  });
  
  // 合并LLM结果
  llmResults.forEach(r => {
    if (merged.has(r.schema_name)) {
      const existing = merged.get(r.schema_name);
      existing.llmMatches = r.matchedFields;
      existing.totalMatches += r.matchedFields.length;
    } else {
      merged.set(r.schema_name, {
        schema: r.schema,
        algorithmMatches: [],
        llmMatches: r.matchedFields,
        totalMatches: r.matchedFields.length
      });
    }
  });
  
  // 计算最终完整度
  return Array.from(merged.values()).map(r => ({
    ...r,
    completeness: r.totalMatches / r.schema.core_fields.length
  }));
}
```

## 优先级

🔴 **P0 - 紧急**: 添加LLM匹配阶段（核心功能缺失）
🟡 **P1 - 重要**: 实现结果合并逻辑
🟡 **P1 - 重要**: 调整阈值为40%
🟢 **P2 - 优化**: 优化LLM Prompt设计
🟢 **P2 - 优化**: 添加缓存机制

## 总结

当前实现**严重偏离**您的设计：
- ❌ 缺少LLM匹配阶段（核心功能）
- ❌ 未匹配字段直接丢失
- ❌ 无法发现更多Schema
- ❌ 完整度计算不准确

需要**重新实现**Schema匹配逻辑，按照您的三阶段设计：
1. 算法匹配 → 2. LLM匹配 → 3. 合并排名
