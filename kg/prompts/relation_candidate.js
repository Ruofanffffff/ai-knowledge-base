/**
 * Prompt 4: Semantic Relation Candidate Extraction
 * 
 * This prompt is used by the semantic relation builder to extract semantic relations
 * between entities using LLM. It follows a hybrid strategy with layered triggering
 * to balance accuracy and token consumption.
 * 
 * Design Reference: Phase 2 - Prompt Module, Section 6.3 - Semantic Relation Builder
 * Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.15
 */

/**
 * Relation types supported by the system
 */
const RELATION_TYPES = {
  causal: {
    name: '因果关系',
    keywords: ['导致', '引起', '造成', '产生', '导致了', '引发', '促使', '使得'],
    examples: ['水位下降导致干旱', 'A引起B', 'X造成Y']
  },
  influence: {
    name: '影响关系',
    keywords: ['影响', '作用于', '改变', '影响了', '作用', '改变了'],
    examples: ['温度影响水位', 'A作用于B', 'X改变Y']
  },
  comparison: {
    name: '对比关系',
    keywords: ['优于', '劣于', '相似于', '不同于', '超过', '低于', '高于', '相比', '对比'],
    examples: ['A优于B', 'X相似于Y', 'M超过N']
  },
  containment: {
    name: '包含关系',
    keywords: ['包含', '属于', '是...的一部分', '包括', '含有', '组成'],
    examples: ['A包含B', 'X属于Y', 'M是N的一部分']
  },
  temporal: {
    name: '时序关系',
    keywords: ['先于', '后于', '同时发生', '之前', '之后', '期间', '随后'],
    examples: ['A先于B', 'X后于Y', 'M与N同时发生']
  },
  spatial: {
    name: '空间关系',
    keywords: ['位于', '邻近', '远离', '在...附近', '靠近', '距离'],
    examples: ['A位于B', 'X邻近Y', 'M远离N']
  }
};

/**
 * Build semantic relation extraction prompt for LLM
 * 
 * This prompt should be used when:
 * 1. Text contains causal keywords (导致、因为、由于)
 * 2. Text contains comparison keywords (优于、相比、不同于)
 * 3. CKB contains 3+ entities (complex multi-entity scenario)
 * 4. Random sampling (20% probability) to discover new patterns
 * 
 * @param {Object} ckb - CKB (Contextual Knowledge Block)
 * @param {string} ckb.content.text - Text content
 * @param {Array} entities - Entities identified in the CKB
 * @param {string} entities[].canonical_name - Entity canonical name
 * @param {string} entities[].entity_type - Entity type
 * @param {Object} options - Additional options
 * @param {boolean} options.includeExamples - Whether to include examples
 * @param {Array} options.targetRelationTypes - Specific relation types to focus on
 * @param {boolean} options.strictMode - Whether to enforce strict validation
 * @returns {string} Complete prompt for LLM
 */
function buildRelationExtractionPrompt(ckb, entities, options = {}) {
  const {
    includeExamples = true,
    targetRelationTypes = null,
    strictMode = true
  } = options;

  // Build entities section
  const entitiesSection = buildEntitiesSection(entities);
  
  // Build relation types section
  const relationTypesSection = buildRelationTypesSection(targetRelationTypes);
  
  // Build examples section
  const examplesSection = includeExamples ? buildExamplesSection() : '';
  
  // Build constraints section
  const constraintsSection = buildConstraintsSection(strictMode);

  return `你是一个知识图谱关系抽取专家。你的任务是从文本中识别实体间的语义关系。

## 原始文本
${ckb.content.text}

${entitiesSection}

${relationTypesSection}

## 任务要求
1. 识别文本中实体间的明确关系（因果、对比、包含、影响等）
2. 为每个关系评估置信度（0-1）
3. 提供支持该关系的文本片段（evidence_text）
4. **只输出明确的关系，不要推测或推理**
5. 置信度低于 0.7 的关系不要输出

${examplesSection}

${constraintsSection}

## 输出格式
请严格按照以下 JSON 格式输出，不要包含其他文字：

{
  "relations": [
    {
      "subject": "实体A的规范名称",
      "relation": "关系类型",
      "object": "实体B的规范名称",
      "confidence": 0.85,
      "evidence_text": "支持该关系的原文片段"
    }
  ]
}

如果没有明确的关系，返回：
{
  "relations": []
}`;
}

/**
 * Build entities section
 * @param {Array} entities - Entities in the CKB
 * @returns {string} Formatted section
 */
function buildEntitiesSection(entities) {
  if (!entities || entities.length === 0) {
    return '## 已识别实体\n无实体';
  }
  
  const entitiesList = entities
    .map(e => `- **${e.canonical_name}** (类型: ${e.entity_type})`)
    .join('\n');
  
  return `## 已识别实体
以下实体已在文本中识别：
${entitiesList}

请从这些实体中识别关系。`;
}

/**
 * Build relation types section
 * @param {Array|null} targetRelationTypes - Specific types to focus on, or null for all
 * @returns {string} Formatted section
 */
function buildRelationTypesSection(targetRelationTypes) {
  const types = targetRelationTypes || Object.keys(RELATION_TYPES);
  
  const typesList = types
    .map(typeKey => {
      const type = RELATION_TYPES[typeKey];
      if (!type) return '';
      const keywords = type.keywords.slice(0, 5).join('、');
      return `- **${type.name}**: ${keywords}等`;
    })
    .filter(s => s.length > 0)
    .join('\n');
  
  return `## 关系类型说明
${typesList}

注意：关系类型应该是具体的动词或关系词（如"导致"、"影响"、"包含"），而不是类别名称（如"因果关系"）。`;
}

/**
 * Build examples section
 * @returns {string} Formatted section with examples
 */
function buildExamplesSection() {
  return `## 抽取示例

**示例 1：因果关系**

文本："阿里C区水位下降导致地下水资源减少"
已识别实体：
- 阿里C区水位下降 (EventEntity)
- 地下水资源 (IndicatorEntity)

输出：
{
  "relations": [
    {
      "subject": "阿里C区水位下降",
      "relation": "导致",
      "object": "地下水资源减少",
      "confidence": 0.95,
      "evidence_text": "阿里C区水位下降导致地下水资源减少"
    }
  ]
}

**示例 2：对比关系**

文本："2024年GDP增长率优于2023年"
已识别实体：
- 2024年GDP增长率 (IndicatorEntity)
- 2023年GDP增长率 (IndicatorEntity)

输出：
{
  "relations": [
    {
      "subject": "2024年GDP增长率",
      "relation": "优于",
      "object": "2023年GDP增长率",
      "confidence": 0.9,
      "evidence_text": "2024年GDP增长率优于2023年"
    }
  ]
}

**示例 3：多实体关系**

文本："张三在阿里巴巴担任工程师，负责开发知识图谱系统"
已识别实体：
- 张三 (PersonEntity)
- 阿里巴巴 (OrganizationEntity)
- 工程师 (entity)
- 知识图谱系统 (entity)

输出：
{
  "relations": [
    {
      "subject": "张三",
      "relation": "工作于",
      "object": "阿里巴巴",
      "confidence": 0.95,
      "evidence_text": "张三在阿里巴巴担任工程师"
    },
    {
      "subject": "张三",
      "relation": "担任",
      "object": "工程师",
      "confidence": 0.95,
      "evidence_text": "张三在阿里巴巴担任工程师"
    },
    {
      "subject": "张三",
      "relation": "负责",
      "object": "知识图谱系统",
      "confidence": 0.9,
      "evidence_text": "张三负责开发知识图谱系统"
    }
  ]
}

**示例 4：包含关系**

文本："北京市包括朝阳区、海淀区等16个区"
已识别实体：
- 北京市 (LocationEntity)
- 朝阳区 (LocationEntity)
- 海淀区 (LocationEntity)

输出：
{
  "relations": [
    {
      "subject": "北京市",
      "relation": "包含",
      "object": "朝阳区",
      "confidence": 0.95,
      "evidence_text": "北京市包括朝阳区、海淀区等16个区"
    },
    {
      "subject": "北京市",
      "relation": "包含",
      "object": "海淀区",
      "confidence": 0.95,
      "evidence_text": "北京市包括朝阳区、海淀区等16个区"
    }
  ]
}

**示例 5：无明确关系**

文本："阿里C区水位10米，温度25度"
已识别实体：
- 阿里C区 (LocationEntity)
- 水位 (IndicatorEntity)
- 温度 (IndicatorEntity)

输出：
{
  "relations": []
}

说明：虽然文本提到了多个实体，但它们之间没有明确的语义关系（只是并列描述），因此不输出关系。`;
}

/**
 * Build constraints section
 * @param {boolean} strictMode - Whether to enforce strict validation
 * @returns {string} Formatted section with constraints
 */
function buildConstraintsSection(strictMode) {
  const baseConstraints = `## 重要约束

1. **只输出明确关系**：关系必须在文本中明确表述，不要推测
   - ❌ 错误：文本说"水位下降"，推测"可能导致干旱"
   - ✅ 正确：只输出文本中明确的关系

2. **实体必须存在**：subject 和 object 必须是已识别实体的规范名称
   - ❌ 错误：输出文本中未识别的实体
   - ✅ 正确：只使用"已识别实体"列表中的实体

3. **证据文本验证**：evidence_text 必须是原文的片段
   - ❌ 错误：改写或总结原文
   - ✅ 正确：直接引用原文中的句子或短语

4. **关系方向性**：注意关系的方向
   - 因果关系：原因 → 结果（"A导致B"，A是subject，B是object）
   - 对比关系：比较主体 → 比较对象（"A优于B"，A是subject，B是object）
   - 包含关系：整体 → 部分（"A包含B"，A是subject，B是object）

5. **置信度评估**：
   - 0.9-1.0：关系在文本中明确表述，使用明确的关系词
   - 0.7-0.9：关系在文本中表述，但关系词不够明确或需要理解上下文
   - < 0.7：不要输出（置信度太低）

6. **避免重复**：
   - 不要输出相同的关系（相同的 subject、relation、object）
   - 不要输出反向重复（如同时输出"A包含B"和"B属于A"）`;

  const strictConstraints = strictMode ? `

7. **严格模式约束**：
   - 关系词必须在原文中出现（不能用同义词替换）
   - 不要输出隐含关系（即使语义上成立）
   - 优先输出高置信度关系（≥0.9）
   - 当不确定时，宁可不输出` : '';

  return baseConstraints + strictConstraints;
}

/**
 * Build a simplified prompt for quick relation extraction (fewer tokens)
 * 
 * @param {Object} ckb - CKB with text content
 * @param {Array} entities - Entities in the CKB
 * @returns {string} Simplified prompt
 */
function buildSimplifiedPrompt(ckb, entities) {
  const entitiesStr = entities.map(e => e.canonical_name).join('、');
  
  return `从文本识别实体间的明确关系。只输出明确关系，不推测。置信度<0.7不输出。

文本：${ckb.content.text}

实体：${entitiesStr}

关系类型：导致、影响、优于、包含、属于、位于等

输出JSON：
{
  "relations": [
    {"subject":"实体A","relation":"关系词","object":"实体B","confidence":0.9,"evidence_text":"原文片段"}
  ]
}

约束：
- subject/object必须是已识别实体
- evidence_text必须是原文片段
- 注意关系方向
- 无明确关系返回{"relations":[]}`;
}

/**
 * Build batch relation extraction prompt for multiple CKBs
 * 
 * This prompt processes up to 5 CKBs in a single LLM call to reduce
 * network overhead and improve throughput.
 * 
 * @param {Array} ckbBatch - Array of CKBs (max 5)
 * @param {Array} entitiesBatch - Array of entity arrays, one per CKB
 * @param {Object} options - Additional options
 * @returns {string} Batch prompt
 */
function buildBatchPrompt(ckbBatch, entitiesBatch, options = {}) {
  const {
    includeExamples = false
  } = options;

  if (ckbBatch.length !== entitiesBatch.length) {
    throw new Error('ckbBatch and entitiesBatch must have the same length');
  }

  if (ckbBatch.length > 5) {
    throw new Error('Batch size cannot exceed 5 CKBs');
  }

  // Build batch items
  const batchItems = ckbBatch.map((ckb, index) => {
    const entities = entitiesBatch[index];
    const entitiesList = entities
      .map(e => `  - ${e.canonical_name} (${e.entity_type})`)
      .join('\n');
    
    return `### 文本 ${index + 1}
**内容**: ${ckb.content.text}

**实体**:
${entitiesList}`;
  }).join('\n\n');

  const examplesSection = includeExamples ? buildBatchExamplesSection() : '';

  return `你是一个知识图谱关系抽取专家。你的任务是从多个文本中批量识别实体间的语义关系。

${batchItems}

## 任务要求
1. 为每个文本识别实体间的明确关系
2. 只输出明确的关系，不要推测
3. 置信度低于 0.7 的关系不要输出
4. subject 和 object 必须是对应文本中的已识别实体

${examplesSection}

## 输出格式
请严格按照以下 JSON 格式输出，不要包含其他文字：

{
  "batch_results": [
    {
      "text_index": 1,
      "relations": [
        {"subject":"实体A","relation":"关系词","object":"实体B","confidence":0.9,"evidence_text":"原文片段"}
      ]
    },
    {
      "text_index": 2,
      "relations": []
    }
  ]
}

注意：
- text_index 从 1 开始
- 如果某个文本没有明确关系，relations 为空数组
- evidence_text 必须是对应文本的原文片段`;
}

/**
 * Build batch examples section
 * @returns {string} Formatted section with batch examples
 */
function buildBatchExamplesSection() {
  return `## 批量抽取示例

输入：
文本1："阿里C区水位下降导致地下水资源减少"
实体：阿里C区水位下降、地下水资源

文本2："北京市GDP增长5.2%"
实体：北京市、GDP

输出：
{
  "batch_results": [
    {
      "text_index": 1,
      "relations": [
        {"subject":"阿里C区水位下降","relation":"导致","object":"地下水资源减少","confidence":0.95,"evidence_text":"阿里C区水位下降导致地下水资源减少"}
      ]
    },
    {
      "text_index": 2,
      "relations": []
    }
  ]
}`;
}

/**
 * Validate relation extraction result from LLM response
 * 
 * @param {Object} result - Result to validate
 * @param {Array} entities - Original entities list
 * @param {string} originalText - Original text for validation
 * @returns {Object} Validation result with valid relations and errors
 */
function validateRelationExtractionResult(result, entities, originalText) {
  const validRelations = [];
  const errors = [];

  // Validate result structure
  if (!result || typeof result !== 'object') {
    errors.push('Result must be an object');
    return { validRelations, errors };
  }

  if (!Array.isArray(result.relations)) {
    errors.push('relations must be an array');
    return { validRelations, errors };
  }

  // Build entity name set for validation
  const entityNames = new Set(entities.map(e => e.canonical_name));

  // Validate each relation
  result.relations.forEach((relation, index) => {
    const relationErrors = [];

    // Validate required properties
    if (!relation.subject) {
      relationErrors.push('Missing subject');
    } else if (!entityNames.has(relation.subject)) {
      relationErrors.push(`Unknown subject entity: ${relation.subject}`);
    }

    if (!relation.relation) {
      relationErrors.push('Missing relation');
    }

    if (!relation.object) {
      relationErrors.push('Missing object');
    } else if (!entityNames.has(relation.object)) {
      relationErrors.push(`Unknown object entity: ${relation.object}`);
    }

    // Validate confidence
    if (relation.confidence === undefined) {
      relationErrors.push('Missing confidence');
    } else if (typeof relation.confidence !== 'number' || relation.confidence < 0 || relation.confidence > 1) {
      relationErrors.push(`Invalid confidence: ${relation.confidence}`);
    } else if (relation.confidence < 0.7) {
      relationErrors.push(`Confidence too low: ${relation.confidence} (threshold: 0.7)`);
    }

    // Validate evidence_text
    if (!relation.evidence_text) {
      relationErrors.push('Missing evidence_text');
    } else if (originalText && !originalText.includes(relation.evidence_text)) {
      relationErrors.push(`evidence_text not found in original text: "${relation.evidence_text}"`);
    }

    // Check for self-reference
    if (relation.subject === relation.object) {
      relationErrors.push('subject and object cannot be the same entity');
    }

    // Only add to valid relations if no errors
    if (relationErrors.length === 0) {
      validRelations.push({
        subject: relation.subject,
        relation: relation.relation,
        object: relation.object,
        confidence: relation.confidence,
        evidence_text: relation.evidence_text
      });
    } else {
      errors.push(`Relation ${index}: ${relationErrors.join(', ')}`);
    }
  });

  return { validRelations, errors };
}

/**
 * Validate batch relation extraction result
 * 
 * @param {Object} result - Batch result to validate
 * @param {Array} ckbBatch - Original CKB batch
 * @param {Array} entitiesBatch - Original entities batch
 * @returns {Object} Validation result with valid batch results and errors
 */
function validateBatchResult(result, ckbBatch, entitiesBatch) {
  const validBatchResults = [];
  const errors = [];

  // Validate result structure
  if (!result || typeof result !== 'object') {
    errors.push('Result must be an object');
    return { validBatchResults, errors };
  }

  if (!Array.isArray(result.batch_results)) {
    errors.push('batch_results must be an array');
    return { validBatchResults, errors };
  }

  // Validate each batch item
  result.batch_results.forEach((batchItem, index) => {
    const batchErrors = [];

    // Validate text_index
    if (batchItem.text_index === undefined) {
      batchErrors.push('Missing text_index');
    } else if (typeof batchItem.text_index !== 'number') {
      batchErrors.push('text_index must be a number');
    } else if (batchItem.text_index < 1 || batchItem.text_index > ckbBatch.length) {
      batchErrors.push(`Invalid text_index: ${batchItem.text_index} (must be 1-${ckbBatch.length})`);
    }

    // Validate relations
    if (!Array.isArray(batchItem.relations)) {
      batchErrors.push('relations must be an array');
    }

    if (batchErrors.length > 0) {
      errors.push(`Batch item ${index}: ${batchErrors.join(', ')}`);
      return;
    }

    // Validate individual relations
    const textIndex = batchItem.text_index - 1; // Convert to 0-based index
    const ckb = ckbBatch[textIndex];
    const entities = entitiesBatch[textIndex];

    const { validRelations, errors: relationErrors } = validateRelationExtractionResult(
      { relations: batchItem.relations },
      entities,
      ckb.content.text
    );

    if (relationErrors.length > 0) {
      errors.push(`Batch item ${index} (text ${batchItem.text_index}): ${relationErrors.join('; ')}`);
    }

    validBatchResults.push({
      text_index: batchItem.text_index,
      relations: validRelations
    });
  });

  return { validBatchResults, errors };
}

/**
 * Determine if LLM should be used for relation extraction
 * 
 * This function implements the layered triggering strategy:
 * - High priority (30%): Causal/comparison keywords or 3+ entities
 * - Random sampling (20%): Discover new patterns
 * 
 * @param {Object} ckb - CKB to analyze
 * @param {Array} entities - Entities in the CKB
 * @param {Object} options - Additional options
 * @param {number} options.samplingRate - Random sampling rate (default: 0.2)
 * @returns {Object} Decision result with shouldUse flag and reason
 */
function shouldUseLLMExtraction(ckb, entities, options = {}) {
  const {
    samplingRate = 0.2
  } = options;

  const text = ckb.content.text;

  // High priority: Causal keywords
  const causalKeywords = RELATION_TYPES.causal.keywords;
  if (causalKeywords.some(keyword => text.includes(keyword))) {
    return {
      shouldUse: true,
      reason: 'causal_keywords',
      priority: 'high'
    };
  }

  // High priority: Comparison keywords
  const comparisonKeywords = RELATION_TYPES.comparison.keywords;
  if (comparisonKeywords.some(keyword => text.includes(keyword))) {
    return {
      shouldUse: true,
      reason: 'comparison_keywords',
      priority: 'high'
    };
  }

  // High priority: Multi-entity scenario (3+ entities)
  if (entities.length >= 3) {
    return {
      shouldUse: true,
      reason: 'multi_entity',
      priority: 'high'
    };
  }

  // Medium priority: Random sampling
  if (Math.random() < samplingRate) {
    return {
      shouldUse: true,
      reason: 'random_sampling',
      priority: 'medium'
    };
  }

  // Low priority: Skip LLM extraction
  return {
    shouldUse: false,
    reason: 'no_trigger',
    priority: 'low'
  };
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
  buildRelationExtractionPrompt,
  buildSimplifiedPrompt,
  buildBatchPrompt,
  validateRelationExtractionResult,
  validateBatchResult,
  shouldUseLLMExtraction,
  getPromptStats,
  RELATION_TYPES
};
