# Design Document: Anchor-Driven Entity Synthesis

## Overview

本设计文档描述了基于锚点指纹的实体合成机制，这是知识图谱构建的核心架构修正。核心理念：**知识图谱不是"schema的集合"，而是"schema在同一语义锚点上的持续重叠"**。

### 实际Schema分布（2026-02-08更新）

**数据库现状**:
- **总Schema数**: 267个（已全部配置anchor_fields）
- **配置完成率**: 100%

**Schema分布（按Entity Type）**:

| Entity Type | 数量 | 占比 | 状态 |
|------------|------|------|------|
| PostProcessingEntity | 61 | 22.8% | ✅ 已配置 |
| PhotographyEntity | 41 | 15.4% | ✅ 已配置 |
| ResearchEntity | 37 | 13.9% | ✅ 已配置 |
| GovernmentEntity | 34 | 12.7% | ✅ 已配置 |
| PersonalEntity | 25 | 9.4% | ✅ 已配置 |
| TravelEntity | 21 | 7.9% | ✅ 已配置 |
| SportsEntity | 15 | 5.6% | ✅ 已配置 |
| GeneralEntity | 14 | 5.2% | ✅ 已配置 |
| 其他类型 | 19 | 7.1% | ✅ 已配置 |

**关键发现**:
- 实际Schema分布以**PostProcessingEntity**（后期处理）和**PhotographyEntity**（摄影）为主
- 原设计假设的EventEntity约80个，实际只有1个
- 这反映了系统的实际使用场景：摄影和图像处理领域

### 核心设计原则

1. **Schema实例是中间层**: Schema匹配后生成SchemaInstance，不直接生成Entity
2. **锚点指纹是唯一标识**: 用于判断"是不是同一个东西"的标准化键
3. **锚点重叠生成图**: 不同schema在同一锚点上合并，图节点才出现
4. **规则驱动，LLM辅助**: 锚点生成和合并由规则决定，LLM仅提供建议
5. **确定性和可追溯**: 相同输入必须产生相同锚点指纹

### 架构对比

**❌ 当前架构（错误）**:
```
Schema A 匹配 → Entity A (直接生成)
Schema B 匹配 → Entity B (直接生成)
↓
名称相似度判断 → 可能合并
```

**✅ 正确架构（锚点驱动）**:
```
Schema A 匹配 → SchemaInstance A → 锚点指纹 X
Schema B 匹配 → SchemaInstance B → 锚点指纹 X
↓
锚点相同 → 合并为 Entity (图节点出现)
```

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                   Document Input                         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              CKB + Field Extraction                      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Schema Matching                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │Schema A  │  │Schema B  │  │Schema C  │             │
│  │Match 0.9 │  │Match 0.8 │  │Match 0.7 │             │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘             │
└───────┼─────────────┼─────────────┼────────────────────┘
        │             │             │
        ▼             ▼             ▼
┌─────────────────────────────────────────────────────────┐
│          Schema Instance Generation (NEW)                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ Instance A   │ │ Instance B   │ │ Instance C   │   │
│  │ fields: {...}│ │ fields: {...}│ │ fields: {...}│   │
│  │ conf: 0.9    │ │ conf: 0.8    │ │ conf: 0.7    │   │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘   │
└─────────┼─────────────────┼─────────────────┼──────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────┐
│         Anchor Fingerprint Generation (NEW)              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ normalize(区域) + normalize(指标) + month(时间)   │  │
│  └──────────────────────────────────────────────────┘  │
│         │                 │                 │           │
│         ▼                 ▼                 ▼           │
│    anchor_X          anchor_X          anchor_Y         │
└─────────┼─────────────────┼─────────────────┼──────────┘
          │                 │                 │
          └────────┬────────┘                 │
                   ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│         Anchor-Based Entity Merging (NEW)                │
│  ┌────────────────────┐      ┌────────────────────┐    │
│  │  Entity 1          │      │  Entity 2          │    │
│  │  anchor: X         │      │  anchor: Y         │    │
│  │  schemas: [A, B]   │      │  schemas: [C]      │    │
│  │  confidence: 0.88  │      │  confidence: 0.7   │    │
│  └────────────────────┘      └────────────────────┘    │
└─────────────────────────────────────────────────────────┘
          │                          │
          └──────────┬───────────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Knowledge Graph Storage                     │
│         (Entities + Relations + Anchors)                 │
└─────────────────────────────────────────────────────────┘
```



### 模块划分

#### 1. Schema Instance Manager (`kg/schema/schema_instance.js`)

**职责**: 管理Schema实例的生命周期

**接口**:
```javascript
class SchemaInstance {
  constructor(schema, fields, ckbIds, confidence) {
    this.schema_name = schema.schema_name;
    this.schema_id = schema.schema_id;
    this.entity_type = schema.entity_type;
    this.fields = fields;  // { 区域: '阿里C区', 时间: '2025-01', ... }
    this.ckb_ids = ckbIds;
    this.confidence = confidence;
    this.created_at = new Date().toISOString();
  }
}

function createSchemaInstance(schemaScore, normalizedFields, ckb) {
  // 从schema匹配结果创建实例
}

function validateSchemaInstance(instance) {
  // 验证实例完整性
}
```

#### 2. Anchor Generator (`kg/entity/anchor_generator.js`)

**职责**: 生成标准化的锚点指纹

**核心算法**:
```javascript
/**
 * 生成锚点指纹
 * @param {SchemaInstance} instance - Schema实例
 * @param {Schema} schema - Schema定义（包含anchor_fields配置）
 * @returns {string} 锚点指纹
 */
function generateAnchorFingerprint(instance, schema) {
  const entityType = schema.entity_type;
  const anchorFields = schema.anchor_fields || inferAnchorFields(schema);
  
  const anchorValues = anchorFields.map(fieldConfig => {
    const fieldName = fieldConfig.name;
    const fieldValue = instance.fields[fieldName];
    const strategy = fieldConfig.normalization_strategy || 'default';
    
    return normalizeFieldValue(fieldValue, fieldName, strategy);
  });
  
  // 生成指纹: entity_type|value1|value2|...
  return `${entityType}|${anchorValues.join('|')}`;
}

/**
 * 字段值标准化
 */
function normalizeFieldValue(value, fieldName, strategy) {
  switch (strategy) {
    case 'time_month':
      // "2025-01-15" → "2025-01"
      return normalizeToMonth(value);
    
    case 'time_year':
      // "2025-01-15" → "2025"
      return normalizeToYear(value);
    
    case 'location':
      // "阿里C区" → "ali_c_zone"
      return normalizeLocation(value);
    
    case 'indicator':
      // "地下水位" → "groundwater_level"
      return normalizeIndicator(value);
    
    case 'lowercase':
      return value.toLowerCase().trim();
    
    default:
      return value.trim();
  }
}
```

**示例**:
```javascript
// Input
const instance = {
  schema_name: "地下水位变化事件",
  entity_type: "EventEntity",
  fields: {
    区域: "阿里C区",
    时间: "2025-01-15",
    指标: "地下水位"
  }
};

const schema = {
  anchor_fields: [
    { name: "区域", normalization_strategy: "location" },
    { name: "指标", normalization_strategy: "indicator" },
    { name: "时间", normalization_strategy: "time_month" }
  ]
};

// Output
const fingerprint = generateAnchorFingerprint(instance, schema);
// → "EventEntity|ali_c_zone|groundwater_level|2025-01"
```

#### 3. Anchor Merger (`kg/entity/anchor_merger.js`)

**职责**: 基于锚点指纹合并Schema实例为实体

**核心算法**:
```javascript
/**
 * 按锚点合并Schema实例
 * @param {Array<SchemaInstance>} instances - Schema实例列表
 * @param {Map<string, Schema>} schemaMap - Schema定义映射
 * @returns {Array<Entity>} 实体列表
 */
function mergeInstancesByAnchor(instances, schemaMap) {
  // Step 1: 生成锚点指纹并分组
  const anchorGroups = new Map(); // anchor → instances[]
  
  for (const instance of instances) {
    const schema = schemaMap.get(instance.schema_id);
    const anchor = generateAnchorFingerprint(instance, schema);
    
    if (!anchorGroups.has(anchor)) {
      anchorGroups.set(anchor, []);
    }
    anchorGroups.get(anchor).push({
      instance,
      schema,
      anchor
    });
  }
  
  // Step 2: 为每个锚点组生成实体
  const entities = [];
  
  for (const [anchor, group] of anchorGroups.entries()) {
    const entity = mergeGroupToEntity(anchor, group);
    entities.push(entity);
  }
  
  return entities;
}

/**
 * 将同一锚点的实例组合并为实体
 */
function mergeGroupToEntity(anchor, group) {
  // 提取所有schema信息
  const schemas = group.map(item => ({
    schema_name: item.instance.schema_name,
    schema_id: item.instance.schema_id,
    confidence: item.instance.confidence
  }));
  
  // 合并字段（优先高置信度）
  const mergedFields = mergeFields(group);
  
  // 收集所有支撑CKB
  const supportedBy = [...new Set(
    group.flatMap(item => item.instance.ckb_ids)
  )];
  
  // 计算综合置信度
  const confidence = calculateMergedConfidence(group);
  
  // 生成规范名称
  const canonicalName = generateCanonicalName(mergedFields, group[0].schema);
  
  // 提取锚点字段
  const anchorFields = extractAnchorFields(anchor, group[0].schema);
  
  return {
    entity_id: generateEntityId(anchor),
    entity_type: group[0].instance.entity_type,
    canonical_name: canonicalName,
    anchor_fingerprint: anchor,
    anchor_fields: anchorFields,
    schemas: schemas,
    fields: mergedFields,
    supported_by: supportedBy,
    confidence: confidence,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * 合并字段策略
 */
function mergeFields(group) {
  const mergedFields = {};
  const fieldSources = {}; // 记录字段来源
  
  // 按置信度排序
  const sortedGroup = [...group].sort((a, b) => 
    b.instance.confidence - a.instance.confidence
  );
  
  for (const item of sortedGroup) {
    for (const [fieldName, fieldValue] of Object.entries(item.instance.fields)) {
      if (!mergedFields[fieldName]) {
        // 首次出现，直接采用
        mergedFields[fieldName] = fieldValue;
        fieldSources[fieldName] = {
          schema: item.instance.schema_name,
          confidence: item.instance.confidence
        };
      } else if (mergedFields[fieldName] !== fieldValue) {
        // 字段冲突，记录警告
        console.warn(`[AnchorMerger] Field conflict: ${fieldName}`, {
          existing: mergedFields[fieldName],
          new: fieldValue,
          existing_source: fieldSources[fieldName],
          new_source: {
            schema: item.instance.schema_name,
            confidence: item.instance.confidence
          }
        });
        // 保持高置信度的值（已排序，所以不覆盖）
      }
    }
  }
  
  return mergedFields;
}

/**
 * 计算合并后的置信度
 */
function calculateMergedConfidence(group) {
  // 策略：多个schema支撑 → 更高置信度
  const schemaCount = group.length;
  const avgConfidence = group.reduce((sum, item) => 
    sum + item.instance.confidence, 0) / schemaCount;
  
  // 基础置信度 + schema数量加成
  let confidence = avgConfidence;
  
  if (schemaCount >= 2) confidence += 0.05;
  if (schemaCount >= 3) confidence += 0.05;
  if (schemaCount >= 4) confidence += 0.05;
  
  return Math.min(confidence, 0.99);
}
```



#### 4. Anchor Conflict Detector (`kg/entity/anchor_conflict_detector.js`)

**职责**: 检测锚点冲突和语义不一致

**核心逻辑**:
```javascript
/**
 * 检测锚点冲突
 * @param {string} anchor - 锚点指纹
 * @param {Array} group - 同一锚点的实例组
 * @returns {Object} 冲突检测结果
 */
function detectAnchorConflict(anchor, group) {
  const conflicts = [];
  
  // 1. 时间策略一致性检查
  const timeConflict = checkTimeConsistency(group);
  if (timeConflict) {
    conflicts.push(timeConflict);
  }
  
  // 2. 数值字段冲突检查
  const valueConflicts = checkValueConflicts(group);
  conflicts.push(...valueConflicts);
  
  // 3. 状态字段矛盾检查
  const stateConflicts = checkStateContradictions(group);
  conflicts.push(...stateConflicts);
  
  return {
    anchor,
    has_conflict: conflicts.length > 0,
    conflicts,
    severity: calculateConflictSeverity(conflicts),
    recommendation: conflicts.length > 0 ? 'review' : 'auto_merge'
  };
}

/**
 * 时间一致性检查
 */
function checkTimeConsistency(group) {
  const timeFields = group.map(item => 
    item.instance.fields['时间'] || item.instance.fields['Time']
  ).filter(Boolean);
  
  if (timeFields.length < 2) return null;
  
  // 检查是否在同一时间粒度
  const months = timeFields.map(t => extractMonth(t));
  const uniqueMonths = new Set(months);
  
  if (uniqueMonths.size > 1) {
    return {
      type: 'time_inconsistency',
      message: `时间字段不一致: ${Array.from(uniqueMonths).join(', ')}`,
      severity: 'high'
    };
  }
  
  return null;
}

/**
 * 数值冲突检查
 */
function checkValueConflicts(group) {
  const conflicts = [];
  const numericFields = ['数值', 'Value', '值'];
  
  for (const fieldName of numericFields) {
    const values = group
      .map(item => item.instance.fields[fieldName])
      .filter(v => v !== undefined && v !== null);
    
    if (values.length < 2) continue;
    
    // 转换为数值
    const numbers = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
    
    if (numbers.length < 2) continue;
    
    // 检查差异
    const max = Math.max(...numbers);
    const min = Math.min(...numbers);
    const diff = max - min;
    const diffPercent = (diff / Math.abs(min)) * 100;
    
    if (diffPercent > 10) { // 差异超过10%
      conflicts.push({
        type: 'value_conflict',
        field: fieldName,
        values: numbers,
        difference: diff,
        difference_percent: diffPercent.toFixed(2) + '%',
        severity: diffPercent > 50 ? 'high' : 'medium'
      });
    }
  }
  
  return conflicts;
}
```

#### 5. LLM Conflict Advisor (`kg/entity/llm_conflict_advisor.js`)

**职责**: 为冲突提供LLM建议（仅建议，不决策）

**核心原则**:
- ❌ LLM不能决定是否合并
- ✅ LLM只能建议是否需要人工审核
- ✅ LLM输出必须包含reasoning

**接口**:
```javascript
/**
 * LLM冲突建议
 * @param {Object} conflictResult - 冲突检测结果
 * @param {Array} group - 实例组
 * @returns {Promise<Object>} LLM建议
 */
async function adviseMergeConflict(conflictResult, group) {
  if (!conflictResult.has_conflict) {
    return {
      suggest_split: false,
      confidence: 1.0,
      reason: '无冲突，建议合并'
    };
  }
  
  const prompt = buildConflictAdvisoryPrompt(conflictResult, group);
  
  const response = await llmClient.callJSON(prompt, {
    temperature: 0.2,
    maxTokens: 400,
    systemPrompt: '你是一个知识图谱校正助手。'
  });
  
  return {
    suggest_split: response.suggest_split || false,
    confidence: response.confidence || 0,
    reason: response.reason || '',
    llm_advisory: true
  };
}

/**
 * 构建LLM Prompt
 */
function buildConflictAdvisoryPrompt(conflictResult, group) {
  const instancesText = group.map((item, i) => `
Schema ${i + 1}: ${item.instance.schema_name}
字段: ${JSON.stringify(item.instance.fields, null, 2)}
置信度: ${item.instance.confidence}
支撑CKB: ${item.instance.ckb_ids.join(', ')}
  `).join('\n');
  
  const conflictsText = conflictResult.conflicts.map(c => `
- 类型: ${c.type}
- 描述: ${c.message || JSON.stringify(c)}
- 严重性: ${c.severity}
  `).join('\n');
  
  return `你是一个知识图谱校正助手。

已通过规则系统检测到以下Schema实例具有相同的锚点指纹，但存在字段冲突。
请判断这些Schema实例是否应该合并为同一实体，还是需要拆分。

⚠️ 重要约束:
- 你不能新建或删除实体
- 你只能给出"建议是否拆分"及理由
- 所有判断必须基于证据
- 如果不确定，建议人工审核

锚点指纹: ${conflictResult.anchor}

Schema实例列表:
${instancesText}

检测到的冲突:
${conflictsText}

任务:
1. 判断这些冲突是否严重到需要拆分实体
2. 如果冲突可以通过字段合并解决，建议合并
3. 如果冲突表明是不同实体，建议拆分
4. 提供清晰的理由

输出 JSON 格式:
{
  "suggest_split": true/false,
  "confidence": 0.0-1.0,
  "reason": "详细说明判断理由，引用具体证据"
}`;
}
```



### Schema配置扩展

#### Schema Model更新

```javascript
// 扩展Schema定义
{
  "schema_id": "schema_001",
  "schema_name": "地下水位变化事件",
  "entity_type": "EventEntity",
  "scene": "科研/政府",
  
  // 核心字段（用于Schema匹配）
  "core_fields": [
    {"name": "区域", "weight": 0.3, "required": true},
    {"name": "时间", "weight": 0.2, "required": true},
    {"name": "指标", "weight": 0.2, "required": true},
    {"name": "数值", "weight": 0.2, "required": false},
    {"name": "单位", "weight": 0.1, "required": false}
  ],
  
  // 🆕 锚点字段（用于实体合并）
  "anchor_fields": [
    {
      "name": "区域",
      "normalization_strategy": "location",
      "priority": 1  // 优先级（可选）
    },
    {
      "name": "指标",
      "normalization_strategy": "indicator",
      "priority": 2
    },
    {
      "name": "时间",
      "normalization_strategy": "time_month",
      "priority": 3
    }
  ],
  
  // 🆕 锚点配置
  "anchor_config": {
    "time_granularity": "month",  // 时间粒度: day/month/year
    "allow_fuzzy_match": false,   // 是否允许模糊匹配
    "conflict_strategy": "llm_advisory"  // 冲突策略: auto/llm_advisory/manual
  },
  
  "threshold": 0.75,
  "relations": [...],
  "version": "2.0"
}
```

#### 不同实体类型的锚点配置示例

**1. EventEntity（事件实体）**
```javascript
{
  "entity_type": "EventEntity",
  "anchor_fields": [
    {"name": "区域", "normalization_strategy": "location"},
    {"name": "指标", "normalization_strategy": "indicator"},
    {"name": "时间", "normalization_strategy": "time_month"}
  ],
  "anchor_config": {
    "time_granularity": "month"
  }
}
// 锚点示例: "EventEntity|ali_c_zone|groundwater_level|2025-01"
```

**2. LocationEntity（地点实体）**
```javascript
{
  "entity_type": "LocationEntity",
  "anchor_fields": [
    {"name": "区域", "normalization_strategy": "location"}
  ],
  "anchor_config": {
    "allow_fuzzy_match": false
  }
}
// 锚点示例: "LocationEntity|ali_c_zone"
```

**3. TravelEntity（旅行实体）**
```javascript
{
  "entity_type": "TravelEntity",
  "anchor_fields": [
    {"name": "Location", "normalization_strategy": "location"},
    {"name": "Timestamp", "normalization_strategy": "time_day"}
  ],
  "anchor_config": {
    "time_granularity": "day"
  }
}
// 锚点示例: "TravelEntity|aomori_museum|2026-01-20"
```

**4. PhotographyEntity（摄影实体）**
```javascript
{
  "entity_type": "PhotographyEntity",
  "anchor_fields": [
    {"name": "Camera", "normalization_strategy": "lowercase"},
    {"name": "Lens", "normalization_strategy": "lowercase"},
    {"name": "Timestamp", "normalization_strategy": "time_day"}
  ],
  "anchor_config": {
    "time_granularity": "day"
  }
}
// 锚点示例: "PhotographyEntity|a7m4|35mm_f1.8|2026-01-20"
```

### Pipeline集成

#### 修改Universal Document Pipeline

```javascript
// 在 universal_document_pipeline.js 中

/**
 * 步骤5: 实体构建（修改）
 */
async function _buildEntities(context, finalOptions) {
  const { matchedSchemas, normalizedFields } = context.data;
  
  // 🆕 Step 5.1: 生成Schema实例
  const schemaInstances = [];
  for (const schemaScore of matchedSchemas) {
    const instance = createSchemaInstance(
      schemaScore,
      normalizedFields,
      context.data.ckb
    );
    schemaInstances.push(instance);
  }
  
  console.log(`[Pipeline] 生成 ${schemaInstances.length} 个Schema实例`);
  
  // 🆕 Step 5.2: 生成锚点指纹
  const schemaMap = await loadSchemaDefinitions(matchedSchemas);
  const instancesWithAnchors = schemaInstances.map(instance => {
    const schema = schemaMap.get(instance.schema_id);
    const anchor = generateAnchorFingerprint(instance, schema);
    return { instance, schema, anchor };
  });
  
  console.log(`[Pipeline] 生成锚点指纹完成`);
  
  // 🆕 Step 5.3: 按锚点合并为实体
  const entities = mergeInstancesByAnchor(schemaInstances, schemaMap);
  
  console.log(`[Pipeline] 合并为 ${entities.length} 个实体`);
  
  // 🆕 Step 5.4: 冲突检测
  const conflictResults = [];
  for (const entity of entities) {
    const group = instancesWithAnchors.filter(
      item => item.anchor === entity.anchor_fingerprint
    );
    
    const conflictResult = detectAnchorConflict(entity.anchor_fingerprint, group);
    
    if (conflictResult.has_conflict) {
      // LLM建议（可选）
      if (finalOptions.entityBuilding.useLLM) {
        const advisory = await adviseMergeConflict(conflictResult, group);
        conflictResult.llm_advisory = advisory;
      }
      
      conflictResults.push(conflictResult);
    }
  }
  
  if (conflictResults.length > 0) {
    console.warn(`[Pipeline] 检测到 ${conflictResults.length} 个锚点冲突`);
    context.warnings.push({
      step: 'entityBuilding',
      message: `检测到 ${conflictResults.length} 个锚点冲突，建议人工审核`,
      conflicts: conflictResults
    });
  }
  
  context.data.entities = entities;
  context.data.anchor_conflicts = conflictResults;
  context.metrics.entityCount = entities.length;
  
  return entities;
}
```

### 数据模型更新

#### Prisma Schema更新

```prisma
model KGEntity {
  id                String   @id
  type              String
  canonicalName     String
  
  // 🆕 锚点相关字段
  anchorFingerprint String?  @map("anchor_fingerprint")
  anchorFields      String?  @map("anchor_fields")  // JSON: {区域: "阿里C区", ...}
  
  aliases           String   // JSON array
  schemas           String   // JSON array: [{schema_name, confidence}, ...]
  supportedBy       String   @map("supported_by")  // JSON array of CKB IDs
  attributes        String   // JSON object
  confidence        Float
  llmEnriched       Boolean  @default(false) @map("llm_enriched")
  
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
  
  // 🆕 索引
  @@index([anchorFingerprint])
  @@index([type, anchorFingerprint])
  @@map("kg_entities")
}
```

#### 迁移脚本

```javascript
// prisma/migrations/add_anchor_fields.js

async function migrateToAnchorModel() {
  const entities = await prisma.kGEntity.findMany();
  
  for (const entity of entities) {
    // 尝试从现有数据推断锚点
    const anchor = inferAnchorFromEntity(entity);
    const anchorFields = extractAnchorFieldsFromEntity(entity);
    
    await prisma.kGEntity.update({
      where: { id: entity.id },
      data: {
        anchorFingerprint: anchor,
        anchorFields: JSON.stringify(anchorFields)
      }
    });
  }
  
  console.log(`Migrated ${entities.length} entities to anchor model`);
}
```



## Implementation Details

### 字段标准化策略

```javascript
// kg/entity/field_normalizers.js

const NORMALIZATION_STRATEGIES = {
  /**
   * 时间标准化 - 月份
   */
  time_month: (value) => {
    // "2025-01-15" → "2025-01"
    // "2025年1月" → "2025-01"
    const match = value.match(/(\d{4})[-年](\d{1,2})/);
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      return `${year}-${month}`;
    }
    return value;
  },
  
  /**
   * 时间标准化 - 年份
   */
  time_year: (value) => {
    const match = value.match(/(\d{4})/);
    return match ? match[1] : value;
  },
  
  /**
   * 时间标准化 - 日期
   */
  time_day: (value) => {
    // "2025-01-15" → "2025-01-15"
    const match = value.match(/(\d{4})[-年](\d{1,2})[-月](\d{1,2})/);
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return value;
  },
  
  /**
   * 地点标准化
   */
  location: (value) => {
    // "阿里C区" → "ali_c_zone"
    // "青森美术馆" → "aomori_museum"
    return value
      .toLowerCase()
      .replace(/[\s\-_]+/g, '_')
      .replace(/[区域]/g, '_zone')
      .replace(/[美术馆]/g, '_museum')
      .replace(/[公园]/g, '_park')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  },
  
  /**
   * 指标标准化
   */
  indicator: (value) => {
    // "地下水位" → "groundwater_level"
    // "水位" → "water_level"
    const indicatorMap = {
      '地下水位': 'groundwater_level',
      '水位': 'water_level',
      '温度': 'temperature',
      '湿度': 'humidity',
      '降雨量': 'rainfall'
    };
    
    return indicatorMap[value] || value.toLowerCase().replace(/\s+/g, '_');
  },
  
  /**
   * 小写标准化
   */
  lowercase: (value) => {
    return value.toLowerCase().trim();
  },
  
  /**
   * 默认标准化
   */
  default: (value) => {
    return value.trim();
  }
};

function normalizeFieldValue(value, fieldName, strategy) {
  if (!value) return '';
  
  const normalizer = NORMALIZATION_STRATEGIES[strategy] || NORMALIZATION_STRATEGIES.default;
  return normalizer(String(value));
}
```

### 实体ID生成策略

```javascript
/**
 * 从锚点指纹生成确定性的实体ID
 */
function generateEntityId(anchorFingerprint) {
  // 使用锚点指纹的hash作为实体ID
  const hash = crypto
    .createHash('sha256')
    .update(anchorFingerprint)
    .digest('hex')
    .substring(0, 16);
  
  return `entity_${hash}`;
}

// 示例
const anchor = "EventEntity|ali_c_zone|groundwater_level|2025-01";
const entityId = generateEntityId(anchor);
// → "entity_a3f5c8d9e2b1f4a7"

// 优点：
// 1. 确定性：相同锚点总是生成相同ID
// 2. 唯一性：不同锚点生成不同ID
// 3. 可追溯：从ID可以验证锚点
```

### 向后兼容策略

```javascript
/**
 * 兼容模式配置
 */
const COMPATIBILITY_MODE = {
  // 模式1: 纯锚点模式（新系统）
  ANCHOR_ONLY: 'anchor_only',
  
  // 模式2: 混合模式（过渡期）
  HYBRID: 'hybrid',
  
  // 模式3: 传统模式（旧系统）
  LEGACY: 'legacy'
};

/**
 * 实体构建（兼容版本）
 */
async function buildEntitiesCompatible(context, options) {
  const mode = options.entityBuilding.compatibilityMode || COMPATIBILITY_MODE.ANCHOR_ONLY;
  
  switch (mode) {
    case COMPATIBILITY_MODE.ANCHOR_ONLY:
      // 使用新的锚点驱动机制
      return await buildEntitiesWithAnchor(context, options);
    
    case COMPATIBILITY_MODE.HYBRID:
      // 混合模式：优先锚点，降级到传统
      try {
        return await buildEntitiesWithAnchor(context, options);
      } catch (error) {
        console.warn('[Pipeline] Anchor mode failed, fallback to legacy');
        return await buildEntitiesLegacy(context, options);
      }
    
    case COMPATIBILITY_MODE.LEGACY:
      // 使用旧的名称相似度机制
      return await buildEntitiesLegacy(context, options);
    
    default:
      throw new Error(`Unknown compatibility mode: ${mode}`);
  }
}
```

### 性能优化

#### 1. 锚点指纹缓存

```javascript
class AnchorFingerprintCache {
  constructor() {
    this.cache = new Map(); // (schema_id + fields_hash) → anchor
  }
  
  getCacheKey(schemaId, fields) {
    const fieldsStr = JSON.stringify(fields);
    const hash = crypto.createHash('md5').update(fieldsStr).digest('hex');
    return `${schemaId}_${hash}`;
  }
  
  get(schemaId, fields) {
    const key = this.getCacheKey(schemaId, fields);
    return this.cache.get(key);
  }
  
  set(schemaId, fields, anchor) {
    const key = this.getCacheKey(schemaId, fields);
    this.cache.set(key, anchor);
  }
  
  clear() {
    this.cache.clear();
  }
}
```

#### 2. 批量锚点生成

```javascript
/**
 * 批量生成锚点指纹
 */
function generateAnchorFingerprintsBatch(instances, schemaMap) {
  const results = [];
  
  for (const instance of instances) {
    const schema = schemaMap.get(instance.schema_id);
    const anchor = generateAnchorFingerprint(instance, schema);
    results.push({ instance, schema, anchor });
  }
  
  return results;
}
```

#### 3. 并行合并

```javascript
/**
 * 并行处理多个锚点组
 */
async function mergeInstancesByAnchorParallel(instances, schemaMap, options = {}) {
  const { concurrency = 5 } = options;
  
  // 分组
  const anchorGroups = groupByAnchor(instances, schemaMap);
  
  // 并行处理
  const entities = [];
  const groupEntries = Array.from(anchorGroups.entries());
  
  for (let i = 0; i < groupEntries.length; i += concurrency) {
    const batch = groupEntries.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(([anchor, group]) => mergeGroupToEntity(anchor, group))
    );
    entities.push(...batchResults);
  }
  
  return entities;
}
```

## Testing Strategy

### 单元测试

```javascript
// kg/entity/anchor_generator.test.js

describe('AnchorGenerator', () => {
  describe('generateAnchorFingerprint', () => {
    it('should generate consistent fingerprint for same input', () => {
      const instance = createTestInstance();
      const schema = createTestSchema();
      
      const anchor1 = generateAnchorFingerprint(instance, schema);
      const anchor2 = generateAnchorFingerprint(instance, schema);
      
      expect(anchor1).toBe(anchor2);
    });
    
    it('should generate different fingerprints for different inputs', () => {
      const instance1 = createTestInstance({ 区域: '阿里C区' });
      const instance2 = createTestInstance({ 区域: '阿里D区' });
      const schema = createTestSchema();
      
      const anchor1 = generateAnchorFingerprint(instance1, schema);
      const anchor2 = generateAnchorFingerprint(instance2, schema);
      
      expect(anchor1).not.toBe(anchor2);
    });
    
    it('should normalize time to month', () => {
      const instance = createTestInstance({ 时间: '2025-01-15' });
      const schema = createTestSchema({
        anchor_fields: [
          { name: '时间', normalization_strategy: 'time_month' }
        ]
      });
      
      const anchor = generateAnchorFingerprint(instance, schema);
      
      expect(anchor).toContain('2025-01');
      expect(anchor).not.toContain('2025-01-15');
    });
  });
});
```

### 集成测试

```javascript
// kg/entity/anchor_merger.test.js

describe('AnchorMerger', () => {
  it('should merge instances with same anchor', async () => {
    const instance1 = createSchemaInstance('Schema A', { 区域: '阿里C区', 时间: '2025-01' });
    const instance2 = createSchemaInstance('Schema B', { 区域: '阿里C区', 时间: '2025-01' });
    
    const schemaMap = createTestSchemaMap();
    const entities = mergeInstancesByAnchor([instance1, instance2], schemaMap);
    
    expect(entities).toHaveLength(1);
    expect(entities[0].schemas).toHaveLength(2);
    expect(entities[0].schemas.map(s => s.schema_name)).toContain('Schema A');
    expect(entities[0].schemas.map(s => s.schema_name)).toContain('Schema B');
  });
  
  it('should not merge instances with different anchors', async () => {
    const instance1 = createSchemaInstance('Schema A', { 区域: '阿里C区' });
    const instance2 = createSchemaInstance('Schema B', { 区域: '阿里D区' });
    
    const schemaMap = createTestSchemaMap();
    const entities = mergeInstancesByAnchor([instance1, instance2], schemaMap);
    
    expect(entities).toHaveLength(2);
  });
});
```

### 属性测试

```javascript
// kg/entity/anchor_generator.property.test.js

const fc = require('fast-check');

describe('AnchorGenerator Properties', () => {
  it('should be deterministic', () => {
    fc.assert(
      fc.property(
        fc.record({
          区域: fc.string(),
          时间: fc.string(),
          指标: fc.string()
        }),
        (fields) => {
          const instance = createSchemaInstance('Test', fields);
          const schema = createTestSchema();
          
          const anchor1 = generateAnchorFingerprint(instance, schema);
          const anchor2 = generateAnchorFingerprint(instance, schema);
          
          return anchor1 === anchor2;
        }
      )
    );
  });
  
  it('should be injective (different inputs → different outputs)', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.record({ 区域: fc.string(), 时间: fc.string() }),
          fc.record({ 区域: fc.string(), 时间: fc.string() })
        ).filter(([f1, f2]) => JSON.stringify(f1) !== JSON.stringify(f2)),
        ([fields1, fields2]) => {
          const instance1 = createSchemaInstance('Test', fields1);
          const instance2 = createSchemaInstance('Test', fields2);
          const schema = createTestSchema();
          
          const anchor1 = generateAnchorFingerprint(instance1, schema);
          const anchor2 = generateAnchorFingerprint(instance2, schema);
          
          return anchor1 !== anchor2;
        }
      )
    );
  });
});
```

## Deployment Plan

### Phase 1: 核心模块开发（3天）
- [ ] 实现AnchorGenerator
- [ ] 实现AnchorMerger
- [ ] 实现SchemaInstance管理
- [ ] 单元测试覆盖

### Phase 2: Schema配置扩展（2天）
- [ ] 更新Schema模型
- [ ] 为250个Schema配置anchor_fields
- [ ] Schema验证工具
- [ ] 配置文档

### Phase 3: Pipeline集成（2天）
- [ ] 修改universal_document_pipeline
- [ ] 实现兼容模式
- [ ] 集成测试
- [ ] 性能测试

### Phase 4: 冲突检测和LLM建议（2天）
- [ ] 实现AnchorConflictDetector
- [ ] 实现LLMConflictAdvisor
- [ ] Prompt优化
- [ ] 测试覆盖

### Phase 5: 数据库和迁移（1天）
- [ ] Prisma schema更新
- [ ] 迁移脚本
- [ ] 数据验证
- [ ] 回滚方案

### Phase 6: 文档和部署（1天）
- [ ] 架构文档
- [ ] API文档
- [ ] 迁移指南
- [ ] 部署和监控

## Success Criteria

1. **功能完整性**
   - ✅ 所有Schema实例生成锚点指纹
   - ✅ 相同锚点的实例正确合并
   - ✅ 冲突检测正常工作
   - ✅ LLM建议准确率 > 85%

2. **性能指标**
   - ✅ 锚点生成 < 10ms per instance
   - ✅ 合并处理 < 100ms for 1000 instances
   - ✅ 整体管线性能下降 < 5%

3. **质量指标**
   - ✅ 单元测试覆盖率 > 90%
   - ✅ 集成测试通过率 100%
   - ✅ 属性测试无失败

4. **业务指标**
   - ✅ 实体合并准确率 > 95%
   - ✅ 错误合并率 < 2%
   - ✅ Token消耗减少 > 30%

## Risks and Mitigations

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 锚点配置错误 | 高 | 中 | 配置验证工具、详细文档、示例 |
| 性能下降 | 中 | 低 | 性能测试、优化算法、缓存 |
| 数据迁移失败 | 高 | 低 | 迁移脚本测试、回滚方案 |
| LLM建议不准确 | 中 | 中 | Prompt优化、人工审核机制 |

## Appendix

### 术语表

- **Schema Instance**: Schema匹配后生成的结构化实例，包含字段和置信度
- **Anchor Fingerprint**: 锚点指纹，用于判断实体唯一性的标准化键
- **Anchor Fields**: Schema中定义的用于生成锚点的字段列表
- **Entity Merging**: 将相同锚点的Schema实例合并为单一实体的过程
- **Conflict Detection**: 检测同一锚点下实例的语义冲突

### 参考资料

- Schema-Driven Knowledge Graph Design Document
- Universal Document Pipeline Documentation
- Entity Builder Implementation Guide
