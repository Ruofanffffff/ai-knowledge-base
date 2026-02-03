/**
 * Prompt 5: Field Name Mapping
 * 
 * This prompt is used by the LLM mapper to map raw field names to standard schema field names.
 * It follows the design principle of "algorithm first, LLM fallback" to minimize token consumption.
 * 
 * Design Reference: Phase 2 - Field Normalizer Module
 * Requirements: 18.5, 18.6, 18.12
 */

/**
 * Build field mapping prompt for LLM
 * 
 * @param {string} rawFieldName - The raw field name extracted from document
 * @param {Object} rawField - The complete raw field object with value and type
 * @param {Array} schemaFields - List of standard field names from schema
 * @param {Object} schema - The schema object
 * @param {Object} options - Additional options
 * @param {string} options.context - Additional context from CKB
 * @param {boolean} options.includeExamples - Whether to include examples
 * @param {Array} options.selectedFields - Pre-selected relevant fields (for intelligent truncating)
 * @returns {string} Complete prompt for LLM
 */
function buildFieldMappingPrompt(rawFieldName, rawField, schemaFields, schema, options = {}) {
  const {
    context = '',
    includeExamples = true,
    selectedFields = null
  } = options;

  // Use selected fields if provided (intelligent truncating), otherwise use all
  const candidateFields = selectedFields || schemaFields;
  
  // Build field list section
  const fieldListSection = buildFieldListSection(candidateFields, schema);
  
  // Build context section
  const contextSection = buildContextSection(rawField, context);
  
  // Build examples section
  const examplesSection = includeExamples ? buildMappingExamplesSection() : '';
  
  // Build constraints section
  const constraintsSection = buildMappingConstraintsSection();

  return `你是一个字段映射专家。请将原始字段名映射到标准字段名。

## 原始字段信息
- **字段名**: ${rawFieldName}
- **字段值**: ${rawField.value || '未知'}
- **字段类型**: ${rawField.type || '未知'}

${contextSection}

## Schema 信息
- **Schema 名称**: ${schema.schema_name}
- **Schema 场景**: ${schema.scene || '通用'}
- **实体类型**: ${schema.entity_type}

${fieldListSection}

## 任务要求
1. 判断原始字段名应该映射到哪个标准字段
2. 如果无法确定映射（相似度太低或语义不匹配），返回 null
3. 评估映射的置信度（0-1）
4. 提供简短的映射理由

${examplesSection}

${constraintsSection}

## 输出格式
请严格按照以下 JSON 格式输出，不要包含其他文字：

{
  "mapped_name": "标准字段名" 或 null,
  "confidence": 0.85,
  "reason": "映射理由（一句话）"
}

如果无法确定映射，返回：
{
  "mapped_name": null,
  "confidence": 0.0,
  "reason": "原因说明"
}`;
}

/**
 * Build field list section with relevance ordering
 * @param {Array} candidateFields - Candidate standard field names
 * @param {Object} schema - Schema object for additional context
 * @returns {string} Formatted section
 */
function buildFieldListSection(candidateFields, schema) {
  // Get field definitions from schema for additional context
  const fieldDefs = schema.core_fields || [];
  const fieldMap = new Map(fieldDefs.map(f => [f.name, f]));
  
  const fieldsList = candidateFields
    .map((fieldName, index) => {
      const fieldDef = fieldMap.get(fieldName);
      const required = fieldDef?.required ? '（必需）' : '（可选）';
      const weight = fieldDef?.weight ? `权重:${fieldDef.weight}` : '';
      return `${index + 1}. **${fieldName}** ${required} ${weight}`;
    })
    .join('\n');
  
  return `## 候选标准字段（按相关性排序）
${fieldsList}

注意：以上字段已根据语义相关性排序，排在前面的字段更可能是正确映射。`;
}

/**
 * Build context section
 * @param {Object} rawField - Raw field object
 * @param {string} context - Additional context text
 * @returns {string} Formatted section
 */
function buildContextSection(rawField, context) {
  if (!context && !rawField.context) {
    return '';
  }
  
  const contextText = context || rawField.context || '';
  return `## 上下文信息
${contextText}

提示：可以利用上下文信息辅助判断字段的语义。`;
}

/**
 * Build examples section
 * @returns {string} Formatted section with examples
 */
function buildMappingExamplesSection() {
  return `## 映射示例

**示例 1：简单同义词映射**
原始字段名：地区
候选字段：["区域", "时间", "指标", "数值", "单位"]
输出：
{
  "mapped_name": "区域",
  "confidence": 0.95,
  "reason": "地区和区域是同义词，语义完全匹配"
}

**示例 2：口语化表达映射**
原始字段名：啥时候
候选字段：["时间", "地点", "人物", "事件"]
输出：
{
  "mapped_name": "时间",
  "confidence": 0.85,
  "reason": "啥时候是时间的口语化表达"
}

**示例 3：基于字段值的推断**
原始字段名：发生地
字段值：北京市
候选字段：["区域", "时间", "状态"]
输出：
{
  "mapped_name": "区域",
  "confidence": 0.9,
  "reason": "发生地表示位置，且字段值是地名，应映射到区域"
}

**示例 4：无法确定映射**
原始字段名：备注
候选字段：["区域", "时间", "指标", "数值"]
输出：
{
  "mapped_name": null,
  "confidence": 0.0,
  "reason": "备注字段与候选字段语义差异太大，无法映射"
}

**示例 5：中英文混合**
原始字段名：location
候选字段：["区域", "时间", "类型"]
输出：
{
  "mapped_name": "区域",
  "confidence": 0.95,
  "reason": "location是区域的英文表达"
}`;
}

/**
 * Build constraints section
 * @returns {string} Formatted section with constraints
 */
function buildMappingConstraintsSection() {
  return `## 重要约束
1. **语义匹配优先**：优先考虑语义相似度，而非字面相似度
   - ✅ 正确："日期" → "时间"（语义相同）
   - ❌ 错误："日期" → "日程"（字面相似但语义不同）

2. **利用字段类型**：结合字段类型辅助判断
   - 如果字段类型是 "time"，优先映射到时间相关字段
   - 如果字段类型是 "location"，优先映射到区域/地点字段
   - 如果字段类型是 "number"，优先映射到数值相关字段

3. **利用字段值**：字段值可以提供重要线索
   - 如果值是日期格式（2025-01），很可能是时间字段
   - 如果值是地名（北京市），很可能是区域字段
   - 如果值是数字（10.5），很可能是数值字段

4. **考虑场景上下文**：不同场景的字段含义可能不同
   - 科研场景："指标" 可能指 "监测指标"、"参数"
   - 旅行场景："地点" 可能指 "景点"、"目的地"
   - 摄影场景："参数" 可能指 "光圈"、"快门"

5. **置信度评估标准**：
   - 0.9-1.0：完全同义词或标准表达（如 "地区" → "区域"）
   - 0.8-0.9：语义明确相关（如 "发生时间" → "时间"）
   - 0.7-0.8：需要一定推断但合理（如 "啥时候" → "时间"）
   - < 0.7：不要输出（置信度太低，宁可不映射）

6. **宁缺毋滥**：如果不确定，返回 null
   - 错误的映射比不映射更糟糕
   - 置信度 < 0.7 的映射不要输出

7. **不要创造字段**：只能映射到候选列表中的字段
   - ❌ 错误：返回候选列表中不存在的字段名
   - ✅ 正确：只返回候选列表中的字段名，或返回 null

8. **考虑字段权重**：权重高的字段更重要，在不确定时优先考虑
   - 必需字段（required）比可选字段更重要
   - 权重高的字段在 Schema 中更核心`;
}

/**
 * Build a simplified prompt for quick mapping (fewer tokens)
 * 
 * @param {string} rawFieldName - Raw field name
 * @param {Object} rawField - Raw field object
 * @param {Array} candidateFields - Candidate standard field names
 * @param {Object} schema - Schema object
 * @returns {string} Simplified prompt
 */
function buildSimplifiedMappingPrompt(rawFieldName, rawField, candidateFields, schema) {
  const fieldsList = candidateFields.map((f, i) => `${i+1}.${f}`).join(' ');
  
  return `将原始字段名映射到标准字段。

原始：${rawFieldName}
值：${rawField.value || ''}
类型：${rawField.type || ''}

候选：${fieldsList}

Schema：${schema.schema_name}（${schema.scene}）

输出JSON：{"mapped_name":"标准字段名或null","confidence":0.85,"reason":"理由"}

约束：
- 语义匹配优先
- 利用字段类型和值
- 置信度<0.7返回null
- 只返回候选列表中的字段`;
}

/**
 * Build batch mapping prompt for multiple fields (token optimization)
 * 
 * @param {Array} rawFields - Array of {name, value, type} objects
 * @param {Array} schemaFields - Standard field names
 * @param {Object} schema - Schema object
 * @returns {string} Batch mapping prompt
 */
function buildBatchMappingPrompt(rawFields, schemaFields, schema) {
  const fieldsList = rawFields
    .map((f, i) => `${i+1}. ${f.name}（值:${f.value || '?'}, 类型:${f.type || '?'}）`)
    .join('\n');
  
  const candidatesList = schemaFields.map((f, i) => `${i+1}. ${f}`).join(', ');
  
  return `批量映射原始字段到标准字段。

## 原始字段列表
${fieldsList}

## 候选标准字段
${candidatesList}

## Schema
- 名称：${schema.schema_name}
- 场景：${schema.scene || '通用'}

## 输出格式
{
  "mappings": [
    {"index": 1, "mapped_name": "标准字段名或null", "confidence": 0.85, "reason": "理由"},
    {"index": 2, "mapped_name": "标准字段名或null", "confidence": 0.9, "reason": "理由"}
  ]
}

约束：语义匹配优先，置信度<0.7返回null，只返回候选列表中的字段。`;
}

/**
 * Validate mapping result from LLM response
 * 
 * @param {Object} result - Mapping result to validate
 * @param {Array} candidateFields - Valid candidate field names
 * @returns {Object} Validation result with valid mapping and errors
 */
function validateMappingResult(result, candidateFields) {
  const errors = [];
  let validMapping = null;

  // Validate structure
  if (!result || typeof result !== 'object') {
    errors.push('Result must be an object');
    return { validMapping, errors };
  }

  // Validate mapped_name
  if (result.mapped_name !== null && result.mapped_name !== undefined) {
    if (typeof result.mapped_name !== 'string') {
      errors.push('mapped_name must be a string or null');
    } else if (!candidateFields.includes(result.mapped_name)) {
      errors.push(`mapped_name "${result.mapped_name}" not in candidate list`);
    }
  }

  // Validate confidence
  if (result.confidence !== undefined) {
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      errors.push(`Invalid confidence: ${result.confidence}`);
    }
  }

  // Validate reason
  if (result.reason && typeof result.reason !== 'string') {
    errors.push('reason must be a string');
  }

  // Only create valid mapping if no errors and confidence is acceptable
  if (errors.length === 0 && result.mapped_name && result.confidence >= 0.7) {
    validMapping = {
      mapped_name: result.mapped_name,
      confidence: result.confidence * 0.9, // LLM confidence discount
      reason: result.reason || 'LLM mapping',
      method: 'llm'
    };
  }

  return { validMapping, errors };
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
  buildFieldMappingPrompt,
  buildSimplifiedMappingPrompt,
  buildBatchMappingPrompt,
  validateMappingResult,
  getPromptStats
};
