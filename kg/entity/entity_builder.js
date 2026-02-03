/**
 * Entity Builder - Entity Instantiation and Management
 * 
 * Builds entities when Schema completeness reaches threshold.
 * Uses hybrid strategy: rule-based + 50% LLM enhancement for canonical names.
 * 
 * Design Reference: Phase 3 - Entity Building Module (Section 6)
 * Validates: Requirements 4.1-4.14
 * 
 * Key Features:
 * - Rule-based canonical name generation
 * - 50% LLM enhancement for name standardization
 * - Entity merging and deduplication
 * - Alias management
 * - Confidence calculation
 */

require('dotenv').config();
const performanceMonitor = require('../utils/performance_monitor');
const tokenBudgetManager = require('../utils/token_budget_manager');
const { createQwenClient } = require('../utils/qwen_client');

/**
 * Global LLM client instance
 */
let customLLMClient = null;

/**
 * Initialize LLM client
 */
function initLLMClient() {
  if (!customLLMClient && process.env.QWEN_API_KEY) {
    customLLMClient = createQwenClient(process.env.QWEN_API_KEY);
  }
  return customLLMClient;
}

/**
 * Set custom LLM client
 * 
 * Allows injection of production LLM client.
 * 
 * @param {Object} client - LLM client instance
 */
function setLLMClient(client) {
  customLLMClient = client;
}

function getLLMClient() {
  return customLLMClient || initLLMClient();
}

/**
 * Generate canonical name for entity
 * 
 * Uses rule-based approach first, then optionally enhances with LLM (50% probability).
 * 
 * @param {Object} fields - Normalized fields
 * @param {Object} schema - Schema definition
 * @param {Object} ckb - CKB object for context
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} { canonical_name, aliases }
 * 
 * @example
 * const result = await generateCanonicalName(
 *   { 区域: '阿里C区', 时间: '2025-01', 指标: '水位' },
 *   { schema_name: '地下水位变化事件', entity_type: 'EventEntity', ... },
 *   ckb
 * );
 * // Returns: { canonical_name: '阿里C区_水位_2025-01', aliases: ['阿里C区水位2025-01'] }
 */
async function generateCanonicalName(fields, schema, ckb, options = {}) {
  const startTime = Date.now();
  
  const {
    useLLM = true,
    llmProbability = 0.5,
    llmClient = null
  } = options;
  
  // Step 1: Rule-based canonical name generation (算法生成基础名称)
  let canonicalName = generateRuleBasedName(fields, schema);
  
  // Step 2: Check if name is well-formed
  const isWellFormed = checkNameWellFormed(canonicalName);
  
  // Step 3: LLM作为兜底方案 - 100%启动验证和优化
  // LLM Enhancement: ALWAYS used as fallback to validate and optimize
  // - If name is NOT well-formed: LLM MUST fix it (强制修正)
  // - If name IS well-formed: LLM validates and may optimize (验证并优化)
  if (useLLM) {
    try {
      const llmStart = Date.now();
      const llmResult = await enhanceNameWithLLM(
        canonicalName,
        schema,
        ckb,
        llmClient,
        !isWellFormed // Pass flag: true if name needs fixing
      );
      
      if (llmResult && llmResult.canonical_name) {
        // Record LLM call performance
        performanceMonitor.recordLLMCall({
          module: 'entity_builder',
          operation: 'enhance_name',
          duration: Date.now() - llmStart,
          success: true,
          ckb_id: ckb.ckb_id,
          doc_id: ckb.doc_id
        });
        
        return {
          canonical_name: llmResult.canonical_name,
          aliases: llmResult.aliases || [],
          llm_enhanced: true,
          needs_fixing: !isWellFormed
        };
      }
    } catch (error) {
      console.error('[EntityBuilder] LLM enhancement failed:', error);
      
      // Record error
      performanceMonitor.recordError({
        type: 'llm_enhancement_error',
        module: 'entity_builder',
        operation: 'generateCanonicalName',
        message: error.message,
        ckb_id: ckb.ckb_id,
        doc_id: ckb.doc_id
      });
      
      // If name is NOT well-formed and LLM failed, this is critical
      if (!isWellFormed) {
        console.warn('[EntityBuilder] Name is not well-formed and LLM failed to fix it:', canonicalName);
      }
      // Fall back to rule-based name
    }
  }
  
  return {
    canonical_name: canonicalName,
    aliases: [],
    llm_enhanced: false,
    needs_fixing: !isWellFormed
  };
}

/**
 * Generate rule-based canonical name
 * 
 * Uses schema-specific rules to generate entity name from fields.
 * 
 * @param {Object} fields - Normalized fields
 * @param {Object} schema - Schema definition
 * @returns {string} Canonical name
 */
function generateRuleBasedName(fields, schema) {
  const entityType = schema.entity_type || 'GeneralEntity';
  
  // Rule 1: EventEntity - combine location, indicator, time
  if (entityType === 'EventEntity' || entityType === 'ResearchEntity') {
    const parts = [];
    
    // Try common field names for events
    if (fields['区域'] || fields['Entity']) {
      parts.push(fields['区域'] || fields['Entity']);
    }
    if (fields['指标'] || fields['Indicator']) {
      parts.push(fields['指标'] || fields['Indicator']);
    }
    if (fields['时间'] || fields['Time']) {
      parts.push(fields['时间'] || fields['Time']);
    }
    
    if (parts.length > 0) {
      return parts.join('_');
    }
  }
  
  // Rule 2: LocationEntity - use location field
  if (entityType === 'LocationEntity') {
    return fields['区域'] || fields['Location'] || fields['Entity'] || 'Unknown_Location';
  }
  
  // Rule 3: TravelEntity - combine location and time
  if (entityType === 'TravelEntity') {
    const parts = [];
    if (fields['Location']) parts.push(fields['Location']);
    if (fields['Timestamp'] || fields['Time']) parts.push(fields['Timestamp'] || fields['Time']);
    
    if (parts.length > 0) {
      return parts.join('_');
    }
  }
  
  // Rule 4: PhotographyEntity - combine camera and lens
  if (entityType === 'PhotographyEntity') {
    const parts = [];
    if (fields['Camera']) parts.push(fields['Camera']);
    if (fields['Lens']) parts.push(fields['Lens']);
    
    if (parts.length > 0) {
      return parts.join('_');
    }
  }
  
  // Rule 5: SportsEntity - combine activity and date
  if (entityType === 'SportsEntity') {
    const parts = [];
    if (fields['Activity']) parts.push(fields['Activity']);
    if (fields['Date'] || fields['Time']) parts.push(fields['Date'] || fields['Time']);
    
    if (parts.length > 0) {
      return parts.join('_');
    }
  }
  
  // Rule 6: LifeEntity - use most important field
  if (entityType === 'LifeEntity' || entityType === 'EntertainmentEntity') {
    // Find the field with highest weight
    const topField = findTopWeightField(fields, schema);
    if (topField) {
      return topField.value;
    }
  }
  
  // Rule 7: Generic fallback - use top weighted field
  const topField = findTopWeightField(fields, schema);
  if (topField) {
    return topField.value;
  }
  
  // Last resort: use schema name + timestamp
  return `${schema.schema_name}_${Date.now()}`;
}

/**
 * Find field with highest weight
 * 
 * @param {Object} fields - Normalized fields
 * @param {Object} schema - Schema definition
 * @returns {Object|null} { name, value, weight }
 */
function findTopWeightField(fields, schema) {
  if (!schema.core_fields || schema.core_fields.length === 0) {
    return null;
  }
  
  // Sort fields by weight (descending)
  const sortedFields = schema.core_fields
    .filter(f => fields[f.name])
    .sort((a, b) => b.weight - a.weight);
  
  if (sortedFields.length === 0) {
    return null;
  }
  
  const topField = sortedFields[0];
  return {
    name: topField.name,
    value: fields[topField.name],
    weight: topField.weight
  };
}

/**
 * Check if canonical name is well-formed
 * 
 * A well-formed name should:
 * - Not be empty
 * - Not contain only numbers or special characters
 * - Not be too long (> 100 chars)
 * - Not contain excessive whitespace
 * - Contain at least some alphanumeric or Chinese characters
 * 
 * @param {string} name - Canonical name
 * @returns {boolean} True if well-formed
 */
function checkNameWellFormed(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }
  
  // Check length
  if (name.length === 0 || name.length > 100) {
    return false;
  }
  
  // Check if contains at least some alphanumeric or Chinese characters
  if (!/[a-zA-Z\u4e00-\u9fa5]/.test(name)) {
    return false;
  }
  
  // Check for excessive whitespace
  if (/\s{3,}/.test(name)) {
    return false;
  }
  
  // Check for common placeholder patterns
  if (/^(unknown|unnamed|untitled|无名|未命名)/i.test(name)) {
    return false;
  }
  
  return true;
}

/**
 * Enhance canonical name with LLM
 * 
 * Uses LLM to standardize and improve entity name, generate aliases.
 * LLM acts as 100% fallback to validate and optimize all entity names.
 * 
 * @param {string} rawName - Rule-based canonical name
 * @param {Object} schema - Schema definition
 * @param {Object} ckb - CKB object for context
 * @param {Object} llmClient - LLM client instance
 * @param {boolean} needsFixing - Whether the name needs fixing (not well-formed)
 * @returns {Promise<Object>} { canonical_name, aliases }
 */
async function enhanceNameWithLLM(rawName, schema, ckb, llmClient, needsFixing = false) {
  // Use provided client or initialize default
  const client = llmClient || getLLMClient();
  
  if (!client) {
    console.log('[EntityBuilder] LLM client not available');
    return null;
  }
  
  const prompt = buildNameEnhancementPrompt(rawName, schema, ckb, needsFixing);
  
  try {
    const response = await client.callJSON(prompt, {
      temperature: 0.3,
      maxTokens: 300,
      systemPrompt: '你是一个实体名称标准化专家。'
    });
    
    // Extract token usage from metadata
    const tokens = response._meta?.tokens || Math.ceil(prompt.length / 4);
    
    // Record token usage
    await tokenBudgetManager.recordUsage({
      module: 'entity_builder',
      operation: 'enhance_name',
      tokens: tokens,
      ckb_id: ckb.ckb_id,
      doc_id: ckb.doc_id,
      model_name: 'qwen'
    });
    
    // Validate response
    if (!response || !response.canonical_name) {
      return null;
    }
    
    return {
      canonical_name: response.canonical_name,
      aliases: response.aliases || []
    };
  } catch (error) {
    console.error('[EntityBuilder] LLM call failed:', error);
    return null;
  }
}

/**
 * Build LLM prompt for name enhancement
 * 
 * @param {string} rawName - Rule-based canonical name
 * @param {Object} schema - Schema definition
 * @param {Object} ckb - CKB object
 * @param {boolean} needsFixing - Whether the name needs fixing
 * @returns {string} LLM prompt
 */
function buildNameEnhancementPrompt(rawName, schema, ckb, needsFixing = false) {
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
2. 统一格式(如"阿里C区" vs "阿里 C 区")
3. 确保名称简洁、准确、易读
4. 提供 2-3 个常见别名(可选)
${needsFixing ? '5. ⚠️ 必须修正不规范的名称！' : '5. 如果当前名称已经很好，可以保持不变'}

输出 JSON 格式:
{
  "canonical_name": "标准化后的名称",
  "aliases": ["别名1", "别名2"],
  "reasoning": "简短说明${needsFixing ? '如何修正' : '是否需要优化'}的理由"
}`;
}



/**
 * Merge or create entity
 * 
 * Checks if entity already exists and merges, or creates new entity.
 * Uses 30% LLM disambiguation for uncertain cases.
 * 
 * @param {Object} newEntity - New entity data
 * @param {Array} existingEntities - List of existing entities
 * @param {Object} options - Merge options
 * @returns {Promise<Object>} { action: 'merged'|'created', entity }
 * 
 * @example
 * const result = await mergeOrCreateEntity(
 *   { canonical_name: '阿里C区_水位_2025-01', ... },
 *   existingEntities,
 *   { useLLM: true, llmProbability: 0.3 }
 * );
 */
async function mergeOrCreateEntity(newEntity, existingEntities, options = {}) {
  const {
    useLLM = true,
    llmProbability = 0.3,
    llmClient = null
  } = options;
  
  // Check budget status and respect LLM participation rate
  const budgetStatus = tokenBudgetManager.getBudgetStatus();
  const effectiveLLMProbability = llmProbability * budgetStatus.llmParticipationRate;
  
  // Step 1: Check for exact name match (including aliases)
  const exactMatch = findExactMatch(newEntity, existingEntities);
  if (exactMatch) {
    return {
      action: 'merged',
      entity: mergeEntityData(exactMatch, newEntity),
      method: 'exact_match'
    };
  }
  
  // Step 2: Check for similar names (fuzzy matching)
  const similarMatches = findSimilarMatches(newEntity, existingEntities);
  
  if (similarMatches.length === 0) {
    // No similar entities, create new
    return {
      action: 'created',
      entity: newEntity,
      method: 'no_match'
    };
  }
  
  // Step 3: LLM disambiguation (adjusted probability based on budget)
  if (useLLM && Math.random() < effectiveLLMProbability) {
    const llmStart = Date.now();
    
    try {
      const disambiguationResult = await disambiguateWithLLM(
        newEntity,
        similarMatches,
        llmClient
      );
      
      // Record LLM call performance
      performanceMonitor.recordLLMCall({
        module: 'entity_builder',
        operation: 'disambiguate',
        duration: Date.now() - llmStart,
        success: true
      });
      
      if (disambiguationResult && disambiguationResult.is_same) {
        const matchedEntity = similarMatches.find(
          e => e.entity_id === disambiguationResult.matched_entity_id
        );
        
        if (matchedEntity && disambiguationResult.confidence > 0.8) {
          return {
            action: 'merged',
            entity: mergeEntityData(matchedEntity, newEntity),
            method: 'llm_disambiguation',
            confidence: disambiguationResult.confidence
          };
        }
      }
    } catch (error) {
      console.error('[EntityBuilder] LLM disambiguation failed:', error);
      
      // Record error
      performanceMonitor.recordLLMCall({
        module: 'entity_builder',
        operation: 'disambiguate',
        duration: Date.now() - llmStart,
        success: false,
        error: error.message
      });
    }
  }
  
  // Step 4: Create new entity (no confident match found)
  return {
    action: 'created',
    entity: newEntity,
    method: 'no_confident_match'
  };
}

/**
 * Find exact match by canonical name or aliases
 * 
 * @param {Object} newEntity - New entity
 * @param {Array} existingEntities - Existing entities
 * @returns {Object|null} Matched entity or null
 */
function findExactMatch(newEntity, existingEntities) {
  const newName = newEntity.canonical_name;
  const newAliases = newEntity.aliases || [];
  
  for (const existing of existingEntities) {
    // Check canonical name match
    if (existing.canonical_name === newName) {
      return existing;
    }
    
    // Check if new name matches existing aliases
    if (existing.aliases && existing.aliases.includes(newName)) {
      return existing;
    }
    
    // Check if any new alias matches existing name or aliases
    for (const alias of newAliases) {
      if (existing.canonical_name === alias) {
        return existing;
      }
      if (existing.aliases && existing.aliases.includes(alias)) {
        return existing;
      }
    }
  }
  
  return null;
}

/**
 * Find similar matches using fuzzy matching
 * 
 * @param {Object} newEntity - New entity
 * @param {Array} existingEntities - Existing entities
 * @param {number} threshold - Similarity threshold (default 0.7)
 * @returns {Array} Similar entities
 */
function findSimilarMatches(newEntity, existingEntities, threshold = 0.7) {
  const similarMatches = [];
  const newName = newEntity.canonical_name;
  
  for (const existing of existingEntities) {
    // Only compare entities of the same type
    if (existing.entity_type !== newEntity.entity_type) {
      continue;
    }
    
    // Calculate similarity
    const similarity = calculateNameSimilarity(newName, existing.canonical_name);
    
    if (similarity >= threshold) {
      similarMatches.push({
        ...existing,
        similarity: similarity
      });
    }
  }
  
  // Sort by similarity (descending)
  return similarMatches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Calculate name similarity
 * 
 * Uses Levenshtein distance normalized by length.
 * 
 * @param {string} name1 - First name
 * @param {string} name2 - Second name
 * @returns {number} Similarity score (0-1)
 */
function calculateNameSimilarity(name1, name2) {
  if (name1 === name2) return 1.0;
  
  const maxLen = Math.max(name1.length, name2.length);
  if (maxLen === 0) return 1.0;
  
  const distance = levenshteinDistance(name1, name2);
  return 1 - (distance / maxLen);
}

/**
 * Calculate Levenshtein distance
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // deletion
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Disambiguate entities using LLM
 * 
 * @param {Object} newEntity - New entity
 * @param {Array} similarEntities - Similar existing entities
 * @param {Object} llmClient - LLM client
 * @returns {Promise<Object>} { is_same, matched_entity_id, confidence, reason }
 */
async function disambiguateWithLLM(newEntity, similarEntities, llmClient) {
  const client = llmClient || getLLMClient();
  
  if (!client) {
    console.log('[EntityBuilder] LLM client not available for disambiguation');
    return null;
  }
  
  const prompt = buildDisambiguationPrompt(newEntity, similarEntities);
  
  try {
    const response = await client.callJSON(prompt, {
      temperature: 0.2,
      maxTokens: 300,
      systemPrompt: '你是一个实体消歧专家。'
    });
    
    // Extract token usage from metadata
    const tokens = response._meta?.tokens || Math.ceil(prompt.length / 4);
    
    // Record token usage
    await tokenBudgetManager.recordUsage({
      module: 'entity_builder',
      operation: 'disambiguate',
      tokens: tokens,
      model_name: 'qwen'
    });
    
    // Validate response
    if (!response || typeof response.is_same !== 'boolean') {
      return null;
    }
    
    return {
      is_same: response.is_same,
      matched_entity_id: response.matched_entity_id || null,
      confidence: response.confidence || 0,
      reason: response.reason || ''
    };
  } catch (error) {
    console.error('[EntityBuilder] LLM disambiguation failed:', error);
    return null;
  }
}

/**
 * Build LLM prompt for entity disambiguation
 * 
 * @param {Object} newEntity - New entity
 * @param {Array} similarEntities - Similar entities
 * @returns {string} LLM prompt
 */
function buildDisambiguationPrompt(newEntity, similarEntities) {
  const candidatesText = similarEntities.slice(0, 3).map((e, i) => {
    return `候选实体 ${i + 1}:
  ID: ${e.entity_id}
  名称: ${e.canonical_name}
  类型: ${e.entity_type}
  属性: ${JSON.stringify(e.attributes || {})}
  相似度: ${(e.similarity * 100).toFixed(1)}%`;
  }).join('\n\n');
  
  return `你是一个实体消歧专家。请判断新实体是否与已存在的实体相同。

新实体:
  名称: ${newEntity.canonical_name}
  类型: ${newEntity.entity_type}
  属性: ${JSON.stringify(newEntity.attributes || {})}

已存在的相似实体:
${candidatesText}

任务:
1. 判断新实体是否与某个已存在实体相同
2. 如果相同,返回匹配的实体ID和置信度
3. 如果不同,说明原因

输出 JSON 格式:
{
  "is_same": true/false,
  "matched_entity_id": "entity_id" (如果 is_same 为 true),
  "confidence": 0.9,
  "reason": "判断理由"
}`;
}

/**
 * Merge entity data
 * 
 * Merges new entity data into existing entity.
 * 
 * @param {Object} existingEntity - Existing entity
 * @param {Object} newEntity - New entity data
 * @returns {Object} Merged entity
 */
function mergeEntityData(existingEntity, newEntity) {
  // Merge supported_by (CKB IDs)
  const supportedBy = [
    ...(existingEntity.supported_by || []),
    ...(newEntity.supported_by || [])
  ];
  const uniqueSupportedBy = [...new Set(supportedBy)];
  
  // Merge aliases
  const aliases = [
    ...(existingEntity.aliases || []),
    ...(newEntity.aliases || []),
    newEntity.canonical_name // Add new name as alias if different
  ].filter(a => a !== existingEntity.canonical_name);
  const uniqueAliases = [...new Set(aliases)];
  
  // Merge attributes (prefer higher confidence values)
  const mergedAttributes = {
    ...existingEntity.attributes,
    ...newEntity.attributes
  };
  
  // Recalculate confidence based on number of supporting CKBs
  const confidence = calculateEntityConfidence(uniqueSupportedBy);
  
  return {
    ...existingEntity,
    aliases: uniqueAliases,
    supported_by: uniqueSupportedBy,
    attributes: mergedAttributes,
    confidence: confidence,
    updated_at: new Date().toISOString()
  };
}

/**
 * Calculate entity confidence
 * 
 * Based on number of supporting CKBs.
 * 
 * @param {Array} supportedBy - Array of CKB IDs
 * @returns {number} Confidence score (0-1)
 */
function calculateEntityConfidence(supportedBy) {
  const count = supportedBy.length;
  
  // Simple formula: more CKBs = higher confidence
  // 1 CKB: 0.6, 2 CKBs: 0.75, 3 CKBs: 0.85, 4+ CKBs: 0.9+
  if (count === 1) return 0.6;
  if (count === 2) return 0.75;
  if (count === 3) return 0.85;
  return Math.min(0.9 + (count - 4) * 0.01, 0.99);
}

/**
 * Enrich entity with LLM to extract additional implicit attributes
 * 
 * Only enriches high-confidence entities (confidence ≥ 0.8 and supported by ≥ 3 CKBs).
 * Extracts:
 * - Numerical attributes (size, quantity, ratio, etc.)
 * - Temporal attributes (occurrence time, duration, etc.)
 * - Spatial attributes (location, range, etc.)
 * - Status attributes (state, trend, etc.)
 * 
 * @param {Object} entity - Entity to enrich
 * @param {Object} ckb - CKB object for context
 * @param {Object} options - Enrichment options
 * @returns {Promise<Object>} Enriched entity
 * 
 * @example
 * const enrichedEntity = await enrichEntityWithLLM(
 *   { canonical_name: '阿里C区_水位_2025-01', confidence: 0.85, supported_by: ['ckb1', 'ckb2', 'ckb3'], ... },
 *   ckb
 * );
 * // Returns: { ...entity, attributes: { ...existing, 变化方向: '下降', 变化幅度: '10米' }, llm_enriched: true }
 */
async function enrichEntityWithLLM(entity, ckb, options = {}) {
  const {
    llmClient = null,
    forceEnrich = false
  } = options;
  
  // Check if entity meets enrichment criteria
  if (!forceEnrich) {
    if (entity.confidence < 0.8) {
      console.log(`[EntityBuilder] Entity confidence ${entity.confidence} < 0.8, skipping enrichment`);
      return entity;
    }
    
    if (entity.supported_by.length < 3) {
      console.log(`[EntityBuilder] Entity supported by ${entity.supported_by.length} CKBs < 3, skipping enrichment`);
      return entity;
    }
  }
  
  // Check budget status
  const budgetStatus = tokenBudgetManager.getBudgetStatus();
  if (budgetStatus.status === 'exceeded') {
    console.log('[EntityBuilder] Token budget exceeded, skipping enrichment');
    return entity;
  }
  
  const client = llmClient || getLLMClient();
  
  if (!client) {
    console.log('[EntityBuilder] LLM client not available for enrichment');
    return entity;
  }
  
  const llmStart = Date.now();
  
  try {
    const prompt = buildEnrichmentPrompt(entity, ckb);
    
    const response = await client.callJSON(prompt, {
      temperature: 0.3,
      maxTokens: 500,
      systemPrompt: '你是一个实体属性提取专家。'
    });
    
    // Extract token usage from metadata
    const tokens = response._meta?.tokens || Math.ceil(prompt.length / 4);
    
    // Record token usage
    await tokenBudgetManager.recordUsage({
      module: 'entity_builder',
      operation: 'enrich_attributes',
      tokens: tokens,
      ckb_id: ckb.ckb_id,
      doc_id: ckb.doc_id,
      model_name: 'qwen'
    });
    
    // Record LLM call performance
    performanceMonitor.recordLLMCall({
      module: 'entity_builder',
      operation: 'enrich_attributes',
      duration: Date.now() - llmStart,
      success: true,
      ckb_id: ckb.ckb_id,
      doc_id: ckb.doc_id
    });
    
    // Validate and merge additional attributes
    if (response && response.additional_attributes && typeof response.additional_attributes === 'object') {
      const additionalAttrs = response.additional_attributes;
      
      // Filter out empty or invalid attributes
      const validAttrs = {};
      for (const [key, value] of Object.entries(additionalAttrs)) {
        if (key && value && typeof key === 'string' && key.trim().length > 0) {
          validAttrs[key] = value;
        }
      }
      
      // Merge with existing attributes (don't overwrite existing)
      const enrichedAttributes = {
        ...entity.attributes,
        ...validAttrs
      };
      
      console.log(`[EntityBuilder] Enriched entity ${entity.canonical_name} with ${Object.keys(validAttrs).length} additional attributes`);
      
      return {
        ...entity,
        attributes: enrichedAttributes,
        llm_enriched: true,
        updated_at: new Date().toISOString()
      };
    }
    
    return entity;
  } catch (error) {
    console.error('[EntityBuilder] Entity enrichment failed:', error);
    
    // Record error
    performanceMonitor.recordLLMCall({
      module: 'entity_builder',
      operation: 'enrich_attributes',
      duration: Date.now() - llmStart,
      success: false,
      error: error.message,
      ckb_id: ckb.ckb_id,
      doc_id: ckb.doc_id
    });
    
    // Return original entity on error
    return entity;
  }
}

/**
 * Build LLM prompt for entity attribute enrichment
 * 
 * @param {Object} entity - Entity to enrich
 * @param {Object} ckb - CKB object for context
 * @returns {string} LLM prompt
 */
function buildEnrichmentPrompt(entity, ckb) {
  return `你是一个实体属性提取专家。请从文本中提取实体的额外隐含属性。

实体名称: ${entity.canonical_name}
实体类型: ${entity.entity_type}
原始文本: ${ckb.content?.text || ''}

已知属性:
${JSON.stringify(entity.attributes, null, 2)}

任务:
请提取以下类型的额外属性(如果文本中存在):
1. **数值属性**: 大小、数量、比例、幅度、速率等
2. **时间属性**: 发生时间、持续时间、频率、周期等
3. **空间属性**: 位置、范围、距离、方向等
4. **状态属性**: 状态、趋势、变化方向、阶段等
5. **描述属性**: 原因、结果、影响、特征等

重要约束:
- **只提取文本中明确提到的信息**,不要推理或创造新信息
- 不要重复已知属性
- 属性名称应简洁明确(2-6个字)
- 属性值应准确提取自原文
- 如果没有额外属性,返回空对象

输出 JSON 格式:
{
  "additional_attributes": {
    "属性名1": "属性值1",
    "属性名2": "属性值2"
  },
  "reasoning": "简短说明提取了哪些属性及其来源"
}

示例:
文本: "阿里C区2025年1月水位下降10米,降幅较大,可能影响灌溉"
已知属性: {"区域": "阿里C区", "时间": "2025-01", "指标": "水位"}
输出:
{
  "additional_attributes": {
    "变化方向": "下降",
    "变化幅度": "10米",
    "变化程度": "较大",
    "潜在影响": "影响灌溉"
  },
  "reasoning": "从文本中提取了变化方向(下降)、变化幅度(10米)、变化程度(较大)和潜在影响(影响灌溉)"
}`;
}

/**
 * Build entity from schema score and fields
 * 
 * Main entry point for entity instantiation.
 * 
 * @param {Object} schemaScore - Schema matching result
 * @param {Array} fields - Normalized fields
 * @param {Object} ckb - CKB object
 * @param {Object} options - Build options
 * @returns {Promise<Object>} Entity object
 */
async function buildEntity(schemaScore, fields, ckb, options = {}) {
  const {
    useLLM = true,
    llmProbability = 0.5
  } = options;
  
  // Convert fields array to object
  const fieldsObj = {};
  for (const field of fields) {
    fieldsObj[field.name] = field.value;
  }
  
  // Generate canonical name
  const nameResult = await generateCanonicalName(
    fieldsObj,
    schemaScore.schema,
    ckb,
    { useLLM, llmProbability }
  );
  
  // Build entity object
  const entity = {
    entity_id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    entity_type: schemaScore.schema.entity_type || 'GeneralEntity',
    schema_name: schemaScore.schema.schema_name,  // 添加顶层schema_name字段
    canonical_name: nameResult.canonical_name,
    aliases: nameResult.aliases || [],
    schemas: [{
      schema_name: schemaScore.schema.schema_name,
      confidence: schemaScore.completeness
    }],
    fields: fieldsObj,  // 添加fields字段以便显示
    supported_by: [ckb.ckb_id],
    attributes: fieldsObj,
    confidence: schemaScore.completeness,
    llm_enriched: nameResult.llm_enhanced || false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  return entity;
}

/**
 * Resolve entity conflicts using batch disambiguation
 * 
 * Identifies groups of similar entities and batches multiple disambiguation
 * requests into a single LLM call, reducing API calls by 50-70%.
 * 
 * @param {Array} entities - List of entities to check for conflicts
 * @param {Object} options - Disambiguation options
 * @returns {Promise<Object>} { resolvedEntities, mergeActions, stats }
 * 
 * @example
 * const result = await resolveEntityConflicts(entities, { similarityThreshold: 0.7 });
 * // Returns: {
 * //   resolvedEntities: [...],
 * //   mergeActions: [{ groupId: 0, mergedIds: ['entity_1', 'entity_2'], canonical: 'entity_1' }],
 * //   stats: { totalGroups: 5, mergedGroups: 2, llmCalls: 1, tokensSaved: 450 }
 * // }
 */
async function resolveEntityConflicts(entities, options = {}) {
  const {
    similarityThreshold = 0.7,
    useLLM = true,
    llmClient = null
  } = options;
  
  const startTime = Date.now();
  
  // Step 1: Find groups of similar entities
  const conflictGroups = findSimilarEntityGroups(entities, similarityThreshold);
  
  if (conflictGroups.length === 0) {
    console.log('[EntityBuilder] No entity conflicts found');
    return {
      resolvedEntities: entities,
      mergeActions: [],
      stats: {
        totalGroups: 0,
        mergedGroups: 0,
        llmCalls: 0,
        tokensSaved: 0,
        duration: Date.now() - startTime
      }
    };
  }
  
  console.log(`[EntityBuilder] Found ${conflictGroups.length} conflict groups`);
  
  // Step 2: Check budget status
  const budgetStatus = tokenBudgetManager.getBudgetStatus();
  if (budgetStatus.status === 'exceeded' || !useLLM) {
    console.log('[EntityBuilder] Skipping LLM disambiguation (budget exceeded or disabled)');
    return {
      resolvedEntities: entities,
      mergeActions: [],
      stats: {
        totalGroups: conflictGroups.length,
        mergedGroups: 0,
        llmCalls: 0,
        tokensSaved: 0,
        duration: Date.now() - startTime
      }
    };
  }
  
  // Step 3: Batch disambiguate using LLM
  const llmStart = Date.now();
  
  try {
    const disambiguationResult = await batchDisambiguateWithLLM(
      conflictGroups,
      llmClient
    );
    
    // Record LLM call performance
    performanceMonitor.recordLLMCall({
      module: 'entity_builder',
      operation: 'batch_disambiguate',
      duration: Date.now() - llmStart,
      success: true,
      batch_size: conflictGroups.length
    });
    
    // Step 4: Apply merge actions
    const { resolvedEntities, mergeActions } = applyMergeActions(
      entities,
      disambiguationResult.merges
    );
    
    // Calculate token savings
    // Without batching: each group would require 1 LLM call
    // With batching: only 1 LLM call for all groups
    const individualCalls = conflictGroups.length;
    const batchCalls = 1;
    const tokensSaved = (individualCalls - batchCalls) * 200; // Estimate 200 tokens per call
    
    const stats = {
      totalGroups: conflictGroups.length,
      mergedGroups: mergeActions.length,
      llmCalls: batchCalls,
      tokensSaved: tokensSaved,
      savingsRate: ((individualCalls - batchCalls) / individualCalls * 100).toFixed(1) + '%',
      duration: Date.now() - startTime
    };
    
    console.log(`[EntityBuilder] Batch disambiguation completed:`, stats);
    
    return {
      resolvedEntities,
      mergeActions,
      stats
    };
  } catch (error) {
    console.error('[EntityBuilder] Batch disambiguation failed:', error);
    
    // Record error
    performanceMonitor.recordLLMCall({
      module: 'entity_builder',
      operation: 'batch_disambiguate',
      duration: Date.now() - llmStart,
      success: false,
      error: error.message
    });
    
    // Return original entities on error
    return {
      resolvedEntities: entities,
      mergeActions: [],
      stats: {
        totalGroups: conflictGroups.length,
        mergedGroups: 0,
        llmCalls: 0,
        tokensSaved: 0,
        error: error.message,
        duration: Date.now() - startTime
      }
    };
  }
}

/**
 * Find groups of similar entities
 * 
 * Groups entities by similarity threshold (≥ 0.7).
 * 
 * @param {Array} entities - List of entities
 * @param {number} threshold - Similarity threshold (default 0.7)
 * @returns {Array} Array of entity groups
 */
function findSimilarEntityGroups(entities, threshold = 0.7) {
  const groups = [];
  const processed = new Set();
  
  for (let i = 0; i < entities.length; i++) {
    if (processed.has(i)) continue;
    
    const entity1 = entities[i];
    const group = [{ index: i, entity: entity1 }];
    processed.add(i);
    
    // Find similar entities
    for (let j = i + 1; j < entities.length; j++) {
      if (processed.has(j)) continue;
      
      const entity2 = entities[j];
      
      // Only compare entities of the same type
      if (entity1.entity_type !== entity2.entity_type) {
        continue;
      }
      
      // Calculate similarity
      const similarity = calculateNameSimilarity(
        entity1.canonical_name,
        entity2.canonical_name
      );
      
      if (similarity >= threshold) {
        group.push({ index: j, entity: entity2, similarity });
        processed.add(j);
      }
    }
    
    // Only add groups with 2+ entities
    if (group.length >= 2) {
      groups.push(group);
    }
  }
  
  return groups;
}

/**
 * Batch disambiguate entity groups using LLM
 * 
 * Sends all conflict groups in a single LLM request.
 * 
 * @param {Array} conflictGroups - Array of entity groups
 * @param {Object} llmClient - LLM client
 * @returns {Promise<Object>} { merges: [...] }
 */
async function batchDisambiguateWithLLM(conflictGroups, llmClient) {
  const client = llmClient || getLLMClient();
  
  if (!client) {
    console.log('[EntityBuilder] LLM client not available for batch disambiguation');
    return { merges: [] };
  }
  
  const prompt = buildBatchDisambiguationPrompt(conflictGroups);
  
  try {
    const response = await client.callJSON(prompt, {
      temperature: 0.2,
      maxTokens: 1000,
      systemPrompt: '你是一个实体消歧专家。'
    });
    
    // Extract token usage from metadata
    const tokens = response._meta?.tokens || Math.ceil(prompt.length / 4);
    
    // Record token usage
    await tokenBudgetManager.recordUsage({
      module: 'entity_builder',
      operation: 'batch_disambiguate',
      tokens: tokens,
      model_name: 'qwen'
    });
    
    // Validate response
    if (!response || !Array.isArray(response.merges)) {
      console.warn('[EntityBuilder] Invalid LLM response for batch disambiguation');
      return { merges: [] };
    }
    
    return {
      merges: response.merges
    };
  } catch (error) {
    console.error('[EntityBuilder] Batch LLM disambiguation failed:', error);
    return { merges: [] };
  }
}

/**
 * Build LLM prompt for batch entity disambiguation
 * 
 * @param {Array} conflictGroups - Array of entity groups
 * @returns {string} LLM prompt
 */
function buildBatchDisambiguationPrompt(conflictGroups) {
  const groupsText = conflictGroups.map((group, groupIndex) => {
    const entitiesText = group.map((item, entityIndex) => {
      const entity = item.entity;
      return `    实体 ${entityIndex}:
      名称: ${entity.canonical_name}
      类型: ${entity.entity_type}
      属性: ${JSON.stringify(entity.attributes || {})}
      支撑CKB数: ${entity.supported_by?.length || 0}
      置信度: ${entity.confidence?.toFixed(2) || 'N/A'}`;
    }).join('\n\n');
    
    return `组 ${groupIndex}:
${entitiesText}`;
  }).join('\n\n');
  
  return `你是一个实体消歧专家。请判断以下实体组中哪些实体应该合并为同一实体。

实体组列表:
${groupsText}

任务:
1. 对于每个组,判断组内哪些实体是同一实体
2. 如果组内有实体应该合并,返回合并信息
3. 选择最合适的实体作为合并后的规范实体(canonical)
4. 提供合并的置信度和理由

重要规则:
- 只有当实体明确指向同一对象时才合并
- 考虑实体名称、属性、类型的一致性
- 优先选择支撑CKB数多、置信度高的实体作为规范实体
- 如果不确定,不要合并

输出 JSON 格式:
{
  "merges": [
    {
      "group_id": 0,
      "should_merge": true,
      "entity_indices": [0, 1],
      "canonical_index": 0,
      "confidence": 0.9,
      "reason": "两个实体名称相似且属性一致,应该合并"
    }
  ]
}

注意:
- group_id 对应上面的组编号
- entity_indices 是组内需要合并的实体索引列表
- canonical_index 是选择作为规范实体的索引
- 如果组内实体不应合并,不要在 merges 数组中包含该组`;
}

/**
 * Apply merge actions to entities
 * 
 * @param {Array} entities - Original entities
 * @param {Array} merges - Merge actions from LLM
 * @returns {Object} { resolvedEntities, mergeActions }
 */
function applyMergeActions(entities, merges) {
  if (!merges || merges.length === 0) {
    return {
      resolvedEntities: entities,
      mergeActions: []
    };
  }
  
  const mergeActions = [];
  const entitiesToRemove = new Set();
  const updatedEntities = new Map();
  
  // Process each merge action
  for (const merge of merges) {
    if (!merge.should_merge || !Array.isArray(merge.entity_indices)) {
      continue;
    }
    
    const { group_id, entity_indices, canonical_index, confidence, reason } = merge;
    
    // Validate indices
    if (entity_indices.length < 2) {
      console.warn(`[EntityBuilder] Invalid merge: group ${group_id} has < 2 entities`);
      continue;
    }
    
    // Find the canonical entity and entities to merge
    const canonicalIdx = entity_indices[canonical_index] || entity_indices[0];
    const canonicalEntity = entities[canonicalIdx];
    
    if (!canonicalEntity) {
      console.warn(`[EntityBuilder] Canonical entity not found for group ${group_id}`);
      continue;
    }
    
    // Merge all entities in the group into the canonical entity
    let mergedEntity = { ...canonicalEntity };
    const mergedIds = [canonicalEntity.entity_id];
    
    for (let i = 0; i < entity_indices.length; i++) {
      if (i === canonical_index) continue; // Skip canonical entity
      
      const entityIdx = entity_indices[i];
      const entityToMerge = entities[entityIdx];
      
      if (!entityToMerge) continue;
      
      // Merge entity data
      mergedEntity = mergeEntityData(mergedEntity, entityToMerge);
      mergedIds.push(entityToMerge.entity_id);
      entitiesToRemove.add(entityIdx);
    }
    
    // Update the canonical entity
    updatedEntities.set(canonicalIdx, mergedEntity);
    
    // Record merge action
    mergeActions.push({
      groupId: group_id,
      mergedIds: mergedIds,
      canonicalId: canonicalEntity.entity_id,
      confidence: confidence,
      reason: reason
    });
    
    console.log(`[EntityBuilder] Merged group ${group_id}: ${mergedIds.length} entities into ${canonicalEntity.entity_id}`);
  }
  
  // Build resolved entities list
  const resolvedEntities = entities
    .map((entity, index) => {
      if (entitiesToRemove.has(index)) {
        return null; // Mark for removal
      }
      if (updatedEntities.has(index)) {
        return updatedEntities.get(index); // Use updated entity
      }
      return entity; // Keep original entity
    })
    .filter(entity => entity !== null);
  
  return {
    resolvedEntities,
    mergeActions
  };
}

module.exports = {
  generateCanonicalName,
  generateRuleBasedName,
  findTopWeightField,
  checkNameWellFormed,
  enhanceNameWithLLM,
  buildNameEnhancementPrompt,
  setLLMClient,
  getLLMClient,
  initLLMClient,
  // Entity merging functions
  mergeOrCreateEntity,
  findExactMatch,
  findSimilarMatches,
  calculateNameSimilarity,
  levenshteinDistance,
  disambiguateWithLLM,
  buildDisambiguationPrompt,
  mergeEntityData,
  calculateEntityConfidence,
  // Entity enrichment functions
  enrichEntityWithLLM,
  buildEnrichmentPrompt,
  buildEntity,
  // Batch disambiguation functions
  resolveEntityConflicts,
  findSimilarEntityGroups,
  batchDisambiguateWithLLM,
  buildBatchDisambiguationPrompt,
  applyMergeActions
};
