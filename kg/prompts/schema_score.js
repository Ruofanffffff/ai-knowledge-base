/**
 * Prompt 2: Field → Schema Trigger Judgment
 * 
 * This prompt is used sparingly to determine which schemas should be triggered
 * when field-to-schema mapping is ambiguous. Prefer rule-based schema matching
 * when possible to minimize token consumption.
 * 
 * Design Reference: Phase 2 - Prompt Module
 * Requirements: 3.4, 3.10, 11.2
 */

/**
 * Build schema scoring prompt for LLM
 * 
 * This prompt should only be used when:
 * 1. Multiple schemas have similar completeness scores
 * 2. Field-to-schema mapping is ambiguous
 * 3. Rule-based matching cannot confidently determine the best schema
 * 
 * @param {Array} fields - Extracted fields from CKB
 * @param {Array} candidateSchemas - Schemas with similar completeness scores
 * @param {Object} context - Additional context from CKB
 * @param {string} context.text - Original text from CKB
 * @param {number} context.sourceConfidence - Source confidence of CKB
 * @param {Object} options - Additional options
 * @param {boolean} options.includeExamples - Whether to include examples
 * @returns {string} Complete prompt for LLM
 */
function buildSchemaScoringPrompt(fields, candidateSchemas, context = {}, options = {}) {
  const {
    includeExamples = true
  } = options;

  // Build fields section
  const fieldsSection = buildFieldsSection(fields);
  
  // Build candidate schemas section
  const schemasSection = buildCandidateSchemasSection(candidateSchemas);
  
  // Build context section
  const contextSection = buildContextSection(context);
  
  // Build examples section
  const examplesSection = includeExamples ? buildExamplesSection() : '';
  
  // Build constraints section
  const constraintsSection = buildConstraintsSection();

  return `你是一个知识图谱 Schema 匹配专家。你的任务是根据提取的字段，判断哪些 Schema 应该被触发来构建实体。

${contextSection}

${fieldsSection}

${schemasSection}

## 任务要求
1. 评估每个候选 Schema 与提取字段的匹配程度
2. 为每个 Schema 计算匹配分数（0-1）
3. 识别每个 Schema 已匹配的字段和缺失的字段
4. **只基于已提取的字段进行判断，不要推理或假设未提取的字段**
5. 如果多个 Schema 都适用，可以同时触发多个

${examplesSection}

${constraintsSection}

## 输出格式
请严格按照以下 JSON 格式输出，不要包含其他文字：

{
  "schema_scores": [
    {
      "schema_name": "Schema名称",
      "match_score": 0.85,
      "matched_fields": ["字段1", "字段2"],
      "missing_fields": ["字段3"],
      "reasoning": "简短的匹配理由"
    }
  ],
  "recommended_schemas": ["推荐触发的Schema名称"]
}`;
}

/**
 * Build fields section
 * @param {Array} fields - Extracted fields
 * @returns {string} Formatted section
 */
function buildFieldsSection(fields) {
  if (!fields || fields.length === 0) {
    return '## 提取的字段\n无字段提取';
  }
  
  const fieldsList = fields
    .map(f => `- **${f.name}**: ${f.value} (类型: ${f.type}, 置信度: ${f.confidence})`)
    .join('\n');
  
  return `## 提取的字段
以下字段已从文本中提取：
${fieldsList}`;
}

/**
 * Build candidate schemas section
 * @param {Array} candidateSchemas - Candidate schemas to evaluate
 * @returns {string} Formatted section
 */
function buildCandidateSchemasSection(candidateSchemas) {
  if (!candidateSchemas || candidateSchemas.length === 0) {
    return '## 候选 Schema\n无候选 Schema';
  }
  
  const schemasList = candidateSchemas.map(schema => {
    const coreFieldsList = schema.core_fields
      .map(cf => `  - ${cf.name} (权重: ${cf.weight}, 必需: ${cf.required ? '是' : '否'})`)
      .join('\n');
    
    return `### ${schema.schema_name}
- **实体类型**: ${schema.entity_type}
- **完整度阈值**: ${schema.threshold}
- **核心字段**:
${coreFieldsList}`;
  }).join('\n\n');
  
  return `## 候选 Schema
以下是可能匹配的 Schema 定义：

${schemasList}`;
}

/**
 * Build context section
 * @param {Object} context - Additional context
 * @returns {string} Formatted section
 */
function buildContextSection(context) {
  if (!context || !context.text) {
    return '';
  }
  
  let section = `## 原始文本\n${context.text}`;
  
  if (context.sourceConfidence !== undefined) {
    section += `\n\n**来源置信度**: ${context.sourceConfidence}`;
  }
  
  return section;
}

/**
 * Build examples section
 * @returns {string} Formatted section with examples
 */
function buildExamplesSection() {
  return `## 评分示例

**示例 1：单一明确匹配**

提取字段：
- 区域: 阿里C区 (location, 0.95)
- 时间: 2025-01 (time, 0.95)
- 指标: 水位 (indicator, 0.95)
- 数值: 10 (number, 0.95)
- 单位: 米 (unit, 0.95)
- 变化: 下降 (indicator, 0.9)

候选 Schema：
1. 地下水位变化事件 (阈值: 0.75)
   - 核心字段: 区域(0.3), 时间(0.2), 指标(0.2), 数值(0.2), 单位(0.1)
2. 区域环境监测 (阈值: 0.7)
   - 核心字段: 区域(0.4), 指标(0.3), 数值(0.3)

输出：
{
  "schema_scores": [
    {
      "schema_name": "地下水位变化事件",
      "match_score": 0.95,
      "matched_fields": ["区域", "时间", "指标", "数值", "单位"],
      "missing_fields": [],
      "reasoning": "所有核心字段都已匹配，且字段语义完全对应水位变化事件"
    },
    {
      "schema_name": "区域环境监测",
      "match_score": 0.85,
      "matched_fields": ["区域", "指标", "数值"],
      "missing_fields": [],
      "reasoning": "核心字段已匹配，但缺少时间维度，匹配度略低"
    }
  ],
  "recommended_schemas": ["地下水位变化事件"]
}

**示例 2：多 Schema 同时触发**

提取字段：
- 人名: 张三 (entity, 0.9)
- 组织: 阿里巴巴 (entity, 0.95)
- 职位: 工程师 (entity, 0.85)
- 时间: 2024-01 (time, 0.9)

候选 Schema：
1. 人物实体 (阈值: 0.6)
   - 核心字段: 人名(0.5), 职位(0.3), 组织(0.2)
2. 组织实体 (阈值: 0.7)
   - 核心字段: 组织名(0.6), 成立时间(0.4)
3. 雇佣关系事件 (阈值: 0.75)
   - 核心字段: 人名(0.3), 组织(0.3), 职位(0.2), 时间(0.2)

输出：
{
  "schema_scores": [
    {
      "schema_name": "人物实体",
      "match_score": 0.9,
      "matched_fields": ["人名", "职位", "组织"],
      "missing_fields": [],
      "reasoning": "人物相关的所有核心字段都已匹配"
    },
    {
      "schema_name": "组织实体",
      "match_score": 0.6,
      "matched_fields": ["组织名"],
      "missing_fields": ["成立时间"],
      "reasoning": "只匹配到组织名，缺少成立时间，低于阈值"
    },
    {
      "schema_name": "雇佣关系事件",
      "match_score": 0.85,
      "matched_fields": ["人名", "组织", "职位", "时间"],
      "missing_fields": [],
      "reasoning": "所有核心字段都已匹配，描述了完整的雇佣关系"
    }
  ],
  "recommended_schemas": ["人物实体", "雇佣关系事件"]
}

**示例 3：无明确匹配**

提取字段：
- 数值: 42 (number, 0.8)

候选 Schema：
1. 地下水位变化事件 (阈值: 0.75)
   - 核心字段: 区域(0.3), 时间(0.2), 指标(0.2), 数值(0.2), 单位(0.1)

输出：
{
  "schema_scores": [
    {
      "schema_name": "地下水位变化事件",
      "match_score": 0.2,
      "matched_fields": ["数值"],
      "missing_fields": ["区域", "时间", "指标", "单位"],
      "reasoning": "只匹配到数值字段，缺少关键的区域、时间、指标字段，无法构成完整事件"
    }
  ],
  "recommended_schemas": []
}`;
}

/**
 * Build constraints section
 * @returns {string} Formatted section with constraints
 */
function buildConstraintsSection() {
  return `## 重要约束

1. **基于已提取字段**：只根据已提取的字段进行评分，不要假设或推理未提取的字段
   - ❌ 错误：假设"水位下降可能导致干旱"，推荐"干旱事件"Schema
   - ✅ 正确：只根据"水位"、"下降"等已提取字段评分

2. **匹配分数计算**：
   - 考虑字段覆盖度：匹配的核心字段数量 / 总核心字段数量
   - 考虑字段权重：高权重字段匹配应提高分数
   - 考虑必需字段：缺少必需字段应显著降低分数
   - 考虑字段置信度：低置信度字段应适当降低分数

3. **阈值判断**：
   - 匹配分数 ≥ Schema 阈值：推荐触发
   - 匹配分数 < Schema 阈值：不推荐触发
   - 边界情况（分数接近阈值 ±0.05）：在 reasoning 中说明不确定性

4. **多 Schema 触发**：
   - 如果多个 Schema 都满足阈值，可以同时推荐
   - 不同类型的 Schema（如实体 Schema 和事件 Schema）可以共存
   - 相似的 Schema 应选择匹配分数最高的

5. **推理说明**：
   - reasoning 字段应简短（1-2句话）
   - 说明匹配的关键字段和缺失的重要字段
   - 对于边界情况，说明不确定性的原因

6. **输出完整性**：
   - 必须为所有候选 Schema 提供评分
   - recommended_schemas 只包含匹配分数 ≥ 阈值的 Schema
   - 如果没有 Schema 满足阈值，recommended_schemas 为空数组`;
}

/**
 * Build a simplified prompt for quick schema scoring (fewer tokens)
 * 
 * @param {Array} fields - Extracted fields
 * @param {Array} candidateSchemas - Candidate schemas
 * @param {Object} context - Additional context
 * @returns {string} Simplified prompt
 */
function buildSimplifiedPrompt(fields, candidateSchemas, context = {}) {
  const fieldsStr = fields.map(f => `${f.name}:${f.value}(${f.type})`).join(', ');
  
  const schemasStr = candidateSchemas.map(s => {
    const coreFields = s.core_fields.map(cf => `${cf.name}(${cf.weight})`).join(',');
    return `${s.schema_name}[阈值:${s.threshold},字段:${coreFields}]`;
  }).join('; ');

  return `评估字段与Schema匹配度。只基于已提取字段，不推理。

字段：${fieldsStr}

Schema：${schemasStr}

输出JSON：
{
  "schema_scores": [
    {"schema_name":"名称","match_score":0.85,"matched_fields":["字段"],"missing_fields":["字段"],"reasoning":"理由"}
  ],
  "recommended_schemas": ["满足阈值的Schema"]
}

约束：
- 匹配分数=字段覆盖度×权重×置信度
- 分数≥阈值才推荐
- 可同时推荐多个Schema`;
}

/**
 * Validate schema scoring result from LLM response
 * 
 * @param {Object} result - Result to validate
 * @param {Array} candidateSchemas - Original candidate schemas
 * @returns {Object} Validation result with valid scores and errors
 */
function validateSchemaScoringResult(result, candidateSchemas) {
  const errors = [];

  // Validate result structure
  if (!result || typeof result !== 'object') {
    errors.push('Result must be an object');
    return { validResult: null, errors };
  }

  if (!Array.isArray(result.schema_scores)) {
    errors.push('schema_scores must be an array');
    return { validResult: null, errors };
  }

  if (!Array.isArray(result.recommended_schemas)) {
    errors.push('recommended_schemas must be an array');
    return { validResult: null, errors };
  }

  // Validate each schema score
  const validSchemaScores = [];
  const schemaNames = new Set(candidateSchemas.map(s => s.schema_name));

  result.schema_scores.forEach((score, index) => {
    const scoreErrors = [];

    // Validate required properties
    if (!score.schema_name) {
      scoreErrors.push('Missing schema_name');
    } else if (!schemaNames.has(score.schema_name)) {
      scoreErrors.push(`Unknown schema: ${score.schema_name}`);
    }

    if (score.match_score === undefined) {
      scoreErrors.push('Missing match_score');
    } else if (typeof score.match_score !== 'number' || score.match_score < 0 || score.match_score > 1) {
      scoreErrors.push(`Invalid match_score: ${score.match_score}`);
    }

    if (!Array.isArray(score.matched_fields)) {
      scoreErrors.push('matched_fields must be an array');
    }

    if (!Array.isArray(score.missing_fields)) {
      scoreErrors.push('missing_fields must be an array');
    }

    // Validate reasoning (optional but recommended)
    if (score.reasoning && typeof score.reasoning !== 'string') {
      scoreErrors.push('reasoning must be a string');
    }

    // Only add to valid scores if no errors
    if (scoreErrors.length === 0) {
      validSchemaScores.push({
        schema_name: score.schema_name,
        match_score: score.match_score,
        matched_fields: score.matched_fields || [],
        missing_fields: score.missing_fields || [],
        reasoning: score.reasoning || ''
      });
    } else {
      errors.push(`Schema score ${index}: ${scoreErrors.join(', ')}`);
    }
  });

  // Validate recommended schemas
  const validRecommendedSchemas = [];
  result.recommended_schemas.forEach((schemaName, index) => {
    if (typeof schemaName !== 'string') {
      errors.push(`Recommended schema ${index}: must be a string`);
    } else if (!schemaNames.has(schemaName)) {
      errors.push(`Recommended schema ${index}: unknown schema "${schemaName}"`);
    } else {
      validRecommendedSchemas.push(schemaName);
    }
  });

  // Check consistency: recommended schemas should have match_score >= threshold
  const schemaThresholds = new Map(candidateSchemas.map(s => [s.schema_name, s.threshold]));
  validRecommendedSchemas.forEach(schemaName => {
    const score = validSchemaScores.find(s => s.schema_name === schemaName);
    const threshold = schemaThresholds.get(schemaName);
    
    if (score && threshold !== undefined && score.match_score < threshold) {
      errors.push(`Warning: ${schemaName} recommended but match_score (${score.match_score}) < threshold (${threshold})`);
    }
  });

  const validResult = {
    schema_scores: validSchemaScores,
    recommended_schemas: validRecommendedSchemas
  };

  return { validResult, errors };
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

/**
 * Calculate rule-based completeness score (for comparison)
 * This is the preferred method; LLM should only be used when ambiguous
 * 
 * @param {Array} fields - Extracted fields
 * @param {Object} schema - Schema definition
 * @param {number} sourceConfidence - Source confidence from CKB
 * @returns {Object} Completeness calculation result
 */
function calculateRuleBasedCompleteness(fields, schema, sourceConfidence = 1.0) {
  const fieldNames = new Set(fields.map(f => f.name));
  const matchedFields = [];
  const missingFields = [];
  let totalScore = 0;

  schema.core_fields.forEach(coreField => {
    if (fieldNames.has(coreField.name)) {
      matchedFields.push(coreField.name);
      totalScore += coreField.weight;
    } else {
      missingFields.push(coreField.name);
    }
  });

  const completeness = totalScore * sourceConfidence;

  return {
    schema_name: schema.schema_name,
    schema: schema,  // Include the full schema object
    completeness,
    matched_fields: matchedFields,
    missing_fields: missingFields,
    meets_threshold: completeness >= schema.threshold
  };
}

module.exports = {
  buildSchemaScoringPrompt,
  buildSimplifiedPrompt,
  validateSchemaScoringResult,
  getPromptStats,
  calculateRuleBasedCompleteness
};
