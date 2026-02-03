# LLM 100%兜底机制说明

## 设计原则

**LLM作为100%兜底方案**，而不是概率性启动。这意味着：

1. **算法优先**：规则引擎首先生成基础实体名称（快速、确定性、零成本）
2. **LLM兜底**：LLM对**所有**实体名称进行验证和优化（100%启动）
3. **智能优化**：LLM根据名称质量决定是否需要修正

## 工作流程

```
文档输入
  ↓
[字段提取] → 60个字段
  ↓
[Schema匹配] → 4个Schema (Focus-Mode, Shutter-Usage, Aperture-Usage, Shooting-Info)
  ↓
[字段标准化] → 标准化字段
  ↓
[实体构建]
  ├─ [算法] 规则引擎生成基础名称
  │   ├─ "焦点" (Focus-Mode)
  │   ├─ "效果" (Shutter-Usage)
  │   ├─ "效果" (Aperture-Usage)
  │   └─ "相机_定焦" (Shooting-Info)
  │
  ├─ [检查] 名称是否规范？
  │   ├─ "焦点" → ✅ 规范（有中文字符，长度合适）
  │   ├─ "效果" → ✅ 规范
  │   ├─ "效果" → ✅ 规范
  │   └─ "相机_定焦" → ✅ 规范
  │
  └─ [LLM兜底] 100%启动验证和优化
      ├─ "焦点" → "焦点模式" ✨ (更明确)
      ├─ "效果" → "肖像照" ✨ (更具体)
      ├─ "效果" → "背景虚化" ✨ (更准确)
      └─ "相机_定焦" → "定焦镜头" ✨ (更标准)
  ↓
最终实体: 4个高质量实体
```

## 代码实现

### 核心逻辑

```javascript
async function generateCanonicalName(fields, schema, ckb, options = {}) {
  // Step 1: 算法生成基础名称（100%执行）
  let canonicalName = generateRuleBasedName(fields, schema);
  // 结果: "焦点", "效果", "相机_定焦" 等
  
  // Step 2: 检查名称是否规范
  const isWellFormed = checkNameWellFormed(canonicalName);
  // 检查: 长度、字符类型、空格、占位符等
  
  // Step 3: LLM 100%兜底验证和优化
  if (useLLM) {
    const llmResult = await enhanceNameWithLLM(
      canonicalName,
      schema,
      ckb,
      llmClient,
      !isWellFormed  // 传递是否需要强制修正的标志
    );
    
    if (llmResult && llmResult.canonical_name) {
      return {
        canonical_name: llmResult.canonical_name,  // "焦点模式"
        aliases: llmResult.aliases,                // ["Focus Mode", "对焦模式"]
        llm_enhanced: true,
        needs_fixing: !isWellFormed
      };
    }
  }
  
  // Fallback: 如果LLM失败，使用算法生成的名称
  return {
    canonical_name: canonicalName,
    aliases: [],
    llm_enhanced: false
  };
}
```

### LLM Prompt

```javascript
function buildNameEnhancementPrompt(rawName, schema, ckb, needsFixing) {
  const taskDescription = needsFixing 
    ? '⚠️ 当前名称不规范，需要修正！请生成一个规范的实体名称。'
    : '✅ 当前名称基本规范，请验证并优化（如有必要）。';
    
  return `你是一个实体名称标准化专家。请标准化以下实体名称。

${taskDescription}

原始名称: ${rawName}
实体类型: ${schema.entity_type}
Schema: ${schema.schema_name}
上下文: ${ckb.content?.text || ''}

任务:
1. 去除冗余词汇和多余空格
2. 统一格式
3. 确保名称简洁、准确、易读
4. 提供 2-3 个常见别名
${needsFixing ? '5. ⚠️ 必须修正不规范的名称！' : '5. 如果当前名称已经很好，可以保持不变'}

输出 JSON 格式:
{
  "canonical_name": "标准化后的名称",
  "aliases": ["别名1", "别名2"],
  "reasoning": "简短说明理由"
}`;
}
```

## 对比测试结果

### 测试文档
- 文件：`摄影课.md`
- 内容：人物肖像拍摄技巧（2,172字符）

### 纯本地处理（零Token）

```
提取字段: 60个
匹配Schema: 4个
实体构建: 4个
  - 焦点 (Focus-Mode)
  - 效果 (Shutter-Usage)
  - 效果 (Aperture-Usage)
  - 相机_定焦 (Shooting-Info)
关系提取: 6个共现关系
处理时间: 0.41秒
Token消耗: 0
API调用: 0
```

### LLM增强处理（100%兜底）

```
提取字段: 60个
匹配Schema: 4个
实体构建: 4个（全部LLM增强 ✨）
  - 焦点模式 (Focus-Mode) ✨
  - 肖像照 (Shutter-Usage) ✨
  - 背景虚化 (Aperture-Usage) ✨
  - 定焦镜头 (Shooting-Info) ✨
关系提取: 6个共现关系
处理时间: 7.36秒
Token消耗: ~1200 tokens (估算)
API调用: 4次
LLM增强实体: 4/4 (100%)
```

### 质量提升

| 实体 | 本地名称 | LLM优化后 | 改进说明 |
|------|---------|----------|---------|
| 1 | 焦点 | 焦点模式 | 更明确，增加"模式"说明 |
| 2 | 效果 | 肖像照 | 更具体，从通用"效果"到具体"肖像照" |
| 3 | 效果 | 背景虚化 | 更准确，从通用"效果"到技术术语 |
| 4 | 相机_定焦 | 定焦镜头 | 更标准，去除冗余"相机"，统一格式 |

## 性能分析

### 时间成本
- **纯本地**: 0.41秒（快速）
- **LLM增强**: 7.36秒（+6.95秒）
- **增加倍数**: 18倍

### Token成本
- **纯本地**: 0 tokens（免费）
- **LLM增强**: ~1200 tokens（约￥0.0024，按0.002元/1K tokens计算）
- **每个实体**: ~300 tokens

### 质量提升
- **实体名称**: 从通用/模糊 → 具体/准确
- **可读性**: 显著提升
- **语义清晰度**: 大幅改善
- **别名生成**: 自动生成多语言别名

## 使用建议

### 场景1: 生产环境（推荐LLM增强）
```javascript
const pipeline = new UniversalDocumentPipeline({
  entityBuilding: {
    useLLM: true,  // ✅ 启用LLM 100%兜底
    llmProbability: 1.0  // 不再使用，保持向后兼容
  }
});
```

**优势**:
- 实体名称质量高
- 自动生成别名
- 语义清晰准确
- 用户体验好

**成本**:
- 每个实体 ~300 tokens
- 处理时间增加 ~1.5秒/实体
- 需要API密钥

### 场景2: 开发/测试环境（可选纯本地）
```javascript
const pipeline = new UniversalDocumentPipeline({
  entityBuilding: {
    useLLM: false  // ❌ 禁用LLM，纯本地处理
  }
});
```

**优势**:
- 零成本
- 快速处理
- 离线可用
- 结果稳定

**劣势**:
- 实体名称可能不够精确
- 无别名生成
- 需要人工审核

### 场景3: 混合模式（智能选择）
```javascript
const pipeline = new UniversalDocumentPipeline({
  entityBuilding: {
    useLLM: true,
    // 可以通过token budget manager动态控制
    // 当预算充足时使用LLM，预算紧张时降级到纯本地
  }
});
```

## 技术细节

### checkNameWellFormed 检查规则

名称被认为**不规范**的情况：
1. 空字符串或null
2. 长度超过100字符
3. 不包含字母或中文字符（只有数字/符号）
4. 包含3个以上连续空格
5. 以占位符开头（unknown, unnamed, 无名, 未命名等）

名称被认为**规范**的情况：
- 包含字母或中文
- 长度适中（1-100字符）
- 格式合理

### LLM增强策略

1. **名称不规范** (`!isWellFormed`)
   - LLM **必须**修正
   - Prompt明确标注 ⚠️ 需要修正
   - 如果LLM失败，记录警告

2. **名称规范** (`isWellFormed`)
   - LLM **验证**并优化
   - Prompt说明可以保持不变
   - LLM可以选择优化或保持原样

### 错误处理

```javascript
try {
  const llmResult = await enhanceNameWithLLM(...);
  // 使用LLM结果
} catch (error) {
  console.error('LLM enhancement failed:', error);
  
  if (!isWellFormed) {
    // 名称不规范且LLM失败 - 这是严重问题
    console.warn('Name is not well-formed and LLM failed to fix it');
  }
  
  // Fallback到算法生成的名称
  return { canonical_name: algorithmName, llm_enhanced: false };
}
```

## 总结

✅ **LLM现在100%作为兜底启动**
- 所有实体名称都经过LLM验证和优化
- 不再是概率性的（移除了随机数判断）
- 确保实体名称质量

✅ **算法+LLM混合策略**
- 算法快速生成基础名称
- LLM保证最终质量
- 平衡性能和质量

✅ **智能成本控制**
- Token budget manager可以动态调整
- 支持降级到纯本地处理
- 灵活适应不同场景

✅ **测试验证通过**
- 4个实体全部LLM增强
- 名称质量显著提升
- 处理时间可接受（7.36秒/4实体）
