/**
 * Prompt: Schema Field Matching
 * 
 * This prompt is used by LLM to match unmatched fields to schema fields.
 * It acts as a fallback when algorithm-based mapping fails.
 * 
 * Design Reference: Phase 3 - Schema Matching Module (LLM Fallback)
 * Requirements: Three-stage matching (Algorithm → LLM → Merge)
 */

/**
 * Build schema matching prompt for LLM
 * 
 * @param {Array} unmatchedFields - Fields that weren't matched by algorithm
 * @param {Array} schemas - Candidate schemas to match against
 * @param {Object} options - Additional options
 * @returns {string} Complete prompt for LLM
 */
function buildSchemaMatchPrompt(unmatchedFields, schemas, options = {}) {
  const {
    context = '',
    maxSchemas = 10
  } = options;

  // Limit schemas to avoid token overflow
  const candidateSchemas = schemas.slice(0, maxSchemas);
  
  // Build unmatched fields section
  const fieldsSection = buildUnmatchedFieldsSection(unmatchedFields);
  
  // Build schemas section
  const schemasSection = buildSchemasSection(candidateSchemas);
  
  // Build context section
  const contextSection = context ? buildContextSection(context) : '';
  
  // Build examples section
  const examplesSection = buildMatchingExamplesSection();
  
  // Build constraints section
  const constraintsSection = buildMatchingConstraintsSection();

  return `你是一个Schema字段匹配专家。请判断未匹配的字段可能属于哪些Schema的哪些字段。

## 任务说明
以下字段在算法映射阶段未能匹配到任何Schema字段。请使用语义理解判断它们可能属于哪些Schema的哪些字段。

${fieldsSection}

${schemasSection}

${contextSection}

${examplesSection}

${constraintsSection}

## 输出格式
请严格按照以下 JSON 格式输出，不要包含其他文字：

{
  "matches": [
    {
      "field_name": "原始字段名（必须与未匹配字段列表中的字段名完全一致）",
      "schema_name": "Schema名称",
      "schema_field": "Schema字段名",
      "confidence": 0.85,
      "reason": "匹配理由（一句话）"
    }
  ]
}

**重要约束**:
1. **field_name必须完全匹配**: field_name必须与"未匹配字段列表"中的字段名完全一致，不能修改或替换
   - ✅ 正确: 如果列表中有"FocalLength"，就使用"FocalLength"
   - ❌ 错误: 不要使用"数值"、"焦距"等其他名称
2. **避免通用字段名**: 不要匹配名为"数值"、"单位"、"实体"、"区域"、"指标"等过于通用的字段
3. **优先匹配具体字段**: 优先匹配有明确含义的字段名（如FocalLength, Aperture, ISO等）
4. 如果某个字段无法匹配到任何Schema，不要在输出中包含它
5. 只输出置信度 >= 0.7 的匹配结果`;
}

/**
 * Build unmatched fields section
 * @param {Array} unmatchedFields - Unmatched fields
 * @returns {string} Formatted section
 */
function buildUnmatchedFieldsSection(unmatchedFields) {
  const fieldsList = unmatchedFields
    .map((field, index) => {
      const value = field.value ? `值: ${field.value}` : '';
      const type = field.type ? `类型: ${field.type}` : '';
      const info = [value, type].filter(x => x).join(', ');
      return `${index + 1}. **${field.name}** ${info ? `(${info})` : ''}`;
    })
    .join('\n');
  
  return `## 未匹配字段列表 (${unmatchedFields.length}个)
${fieldsList}`;
}

/**
 * Build schemas section
 * @param {Array} schemas - Candidate schemas
 * @returns {string} Formatted section
 */
function buildSchemasSection(schemas) {
  const schemasList = schemas
    .map((schema, index) => {
      const schemaName = schema.schema_name || schema.name;
      const scene = schema.scene || '通用';
      const entityType = schema.entity_type || 'Entity';
      const description = schema.description || '';
      
      // List core fields
      const coreFields = (schema.core_fields || [])
        .map(f => f.name)
        .join(', ');
      
      return `### ${index + 1}. ${schemaName}
- **场景**: ${scene}
- **实体类型**: ${entityType}
- **描述**: ${description}
- **核心字段**: ${coreFields}`;
    })
    .join('\n\n');
  
  return `## 候选Schema列表 (${schemas.length}个)
${schemasList}`;
}

/**
 * Build context section
 * @param {string} context - Additional context text
 * @returns {string} Formatted section
 */
function buildContextSection(context) {
  return `## 文档上下文
${context}

提示：可以利用文档上下文辅助判断字段的语义和所属领域。`;
}

/**
 * Build examples section
 * @returns {string} Formatted section with examples
 */
function buildMatchingExamplesSection() {
  return `## 匹配示例

**示例 1：摄影领域字段匹配**
未匹配字段：
1. **FocalLength** (值: 55)
2. **Aperture** (值: 1.8)
3. **ISO** (值: 100)
4. 数值 (值: 9)

候选Schema：
1. PhotographyEntity (摄影实体) - 核心字段: FocalLength, Aperture, ISO, ShutterSpeed
2. Lens-Recommendation (镜头推荐) - 核心字段: LensType, FocalLength, Usage

输出：
{
  "matches": [
    {
      "field_name": "FocalLength",
      "schema_name": "PhotographyEntity",
      "schema_field": "FocalLength",
      "confidence": 0.95,
      "reason": "焦距字段直接对应摄影实体的焦距字段"
    },
    {
      "field_name": "Aperture",
      "schema_name": "PhotographyEntity",
      "schema_field": "Aperture",
      "confidence": 0.95,
      "reason": "光圈字段直接对应摄影实体的光圈字段"
    },
    {
      "field_name": "ISO",
      "schema_name": "PhotographyEntity",
      "schema_field": "ISO",
      "confidence": 0.95,
      "reason": "ISO字段直接对应摄影实体的ISO字段"
    }
  ]
}

**注意**: 
- ✅ 使用了原始字段名"FocalLength"、"Aperture"、"ISO"
- ❌ 没有匹配通用字段"数值"（过于通用，应该被过滤）

**示例 2：科研领域字段匹配**
未匹配字段：
1. **SiteName** (值: 阿里C区)
2. **Trend** (值: 下降)
3. **Factor** (值: 降雨减少)
4. 指标 (值: 水位)

候选Schema：
1. EITV (实体-指标-时间-数值) - 核心字段: Entity, Indicator, Time, Value
2. Monitoring-Site (监测站点) - 核心字段: SiteName, Location, Type
3. Trend-Analysis (趋势分析) - 核心字段: Trend, Factor, Impact

输出：
{
  "matches": [
    {
      "field_name": "SiteName",
      "schema_name": "Monitoring-Site",
      "schema_field": "SiteName",
      "confidence": 0.95,
      "reason": "站点名称字段直接对应监测站点的名称字段"
    },
    {
      "field_name": "Trend",
      "schema_name": "Trend-Analysis",
      "schema_field": "Trend",
      "confidence": 0.95,
      "reason": "趋势字段直接对应趋势分析的趋势字段"
    },
    {
      "field_name": "Factor",
      "schema_name": "Trend-Analysis",
      "schema_field": "Factor",
      "confidence": 0.9,
      "reason": "因素字段对应趋势分析的因素字段"
    }
  ]
}

**注意**: 
- ✅ 使用了原始字段名"SiteName"、"Trend"、"Factor"
- ❌ 没有匹配通用字段"指标"（过于通用，应该被过滤）`;
}

/**
 * Build constraints section
 * @returns {string} Formatted section with constraints
 */
function buildMatchingConstraintsSection() {
  return `## 重要约束

1. **字段名必须完全匹配** ⚠️ 最重要
   - field_name必须与"未匹配字段列表"中的字段名完全一致
   - ✅ 正确: 如果列表中有"FocalLength"，就使用"FocalLength"
   - ❌ 错误: 不要使用"数值"、"焦距"等其他名称
   - ❌ 错误: 不要修改、翻译或替换字段名

2. **避免通用字段名** ⚠️ 重要
   - 不要匹配以下通用字段名:
     - "数值"、"值"、"内容"
     - "单位"、"类型"、"名称"
     - "实体"、"对象"、"项目"
     - "区域"、"位置"、"地点"
     - "指标"、"参数"、"属性"
   - 这些字段名过于通用，无法准确映射到Schema字段
   - 优先匹配有明确含义的字段名（如FocalLength, Aperture, ISO等）

3. **语义匹配优先**：基于字段的语义含义进行匹配，而非字面相似度
   - 考虑字段名称的含义
   - 考虑字段值的类型和内容
   - 考虑字段在文档中的上下文

4. **领域知识应用**：利用领域知识判断字段归属
   - 摄影领域：FocalLength, Aperture, ShutterSpeed, ISO等
   - 科研领域：Indicator, Monitoring, Trend, Value等
   - 旅游领域：Destination, Itinerary, Transportation, Accommodation等

5. **Schema场景匹配**：优先匹配与文档场景相关的Schema
   - 检查Schema的场景描述
   - 检查Schema的实体类型
   - 检查Schema的核心字段

6. **置信度评估标准**：
   - 0.9-1.0：字段语义完全匹配，领域明确
   - 0.8-0.9：字段语义相关，有一定推断
   - 0.7-0.8：字段可能相关，需要上下文支持
   - < 0.7：不要输出（置信度太低）

7. **宁缺毋滥**：如果不确定，不要输出匹配结果
   - 错误的匹配比不匹配更糟糕
   - 只输出置信度 >= 0.7 的匹配
   - 一个字段可以匹配多个Schema的不同字段

8. **字段唯一性**：每个字段在同一个Schema中只能匹配一个字段
   - ✅ 正确："FocalLength" → PhotographyEntity.FocalLength
   - ❌ 错误："FocalLength" → PhotographyEntity.FocalLength 和 PhotographyEntity.Lens

9. **考虑字段值**：字段值可以提供重要线索
   - 如果值是日期格式，可能是时间字段
   - 如果值是地名，可能是位置字段
   - 如果值是数字，检查字段名是否有明确含义

10. **多Schema匹配**：一个字段可以匹配多个不同Schema
    - ✅ 正确："Time" → EITV.Time 和 Event.Timestamp
    - 这样可以让多个Schema都有机会被触发`;
}

/**
 * Validate schema matching result from LLM response
 * 
 * @param {Object} result - Matching result to validate
 * @param {Array} unmatchedFields - Original unmatched fields
 * @param {Array} schemas - Candidate schemas
 * @returns {Object} Validation result with valid matches and errors
 */
function validateSchemaMatchResult(result, unmatchedFields, schemas) {
  const errors = [];
  const validMatches = [];

  // Validate structure
  if (!result || typeof result !== 'object') {
    errors.push('Result must be an object');
    return { validMatches, errors };
  }

  if (!Array.isArray(result.matches)) {
    errors.push('Result.matches must be an array');
    return { validMatches, errors };
  }

  // Create lookup maps
  const fieldNames = new Set(unmatchedFields.map(f => f.name));
  const schemaMap = new Map(schemas.map(s => [s.schema_name || s.name, s]));

  // Validate each match
  for (const match of result.matches) {
    const matchErrors = [];

    // Validate field_name
    if (!match.field_name || !fieldNames.has(match.field_name)) {
      matchErrors.push(`Invalid field_name: ${match.field_name}`);
    }

    // Validate schema_name
    if (!match.schema_name || !schemaMap.has(match.schema_name)) {
      matchErrors.push(`Invalid schema_name: ${match.schema_name}`);
    }

    // Validate schema_field
    if (!match.schema_field) {
      matchErrors.push('Missing schema_field');
    } else if (match.schema_name && schemaMap.has(match.schema_name)) {
      const schema = schemaMap.get(match.schema_name);
      const schemaFieldNames = (schema.core_fields || []).map(f => f.name);
      if (!schemaFieldNames.includes(match.schema_field)) {
        matchErrors.push(`schema_field "${match.schema_field}" not in schema "${match.schema_name}"`);
      }
    }

    // Validate confidence
    if (typeof match.confidence !== 'number' || match.confidence < 0 || match.confidence > 1) {
      matchErrors.push(`Invalid confidence: ${match.confidence}`);
    }

    // Only add valid matches with confidence >= 0.7
    if (matchErrors.length === 0 && match.confidence >= 0.7) {
      validMatches.push({
        field_name: match.field_name,
        schema_name: match.schema_name,
        schema_field: match.schema_field,
        confidence: match.confidence * 0.9, // LLM confidence discount
        reason: match.reason || 'LLM matching',
        method: 'llm'
      });
    } else if (matchErrors.length > 0) {
      errors.push(`Match validation failed: ${matchErrors.join(', ')}`);
    }
  }

  return { validMatches, errors };
}

/**
 * Get prompt statistics (for token estimation)
 * 
 * @param {string} prompt - The prompt text
 * @returns {Object} Statistics about the prompt
 */
function getPromptStats(prompt) {
  const lines = prompt.split('\n').length;
  const chars = prompt.length;
  // Rough token estimation: ~4 chars per token for Chinese text
  const estimatedTokens = Math.ceil(chars / 4);

  return {
    lines,
    chars,
    estimatedTokens
  };
}

module.exports = {
  buildSchemaMatchPrompt,
  validateSchemaMatchResult,
  getPromptStats
};
