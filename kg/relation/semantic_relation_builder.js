/**
 * Semantic Relation Builder (Enhanced Version)
 * 
 * Extracts semantic relations using LLM with tiered triggering strategy:
 * - High priority: 30% (causal, comparison, 3+ entities)
 * - Random sampling: 20% (discover new patterns)
 * 
 * Uses enhanced prompts with 3-round validation.
 * 
 * Requirements: 7.1-7.16
 */

require('dotenv').config();
const relationStore = require('./relation_store');
const performanceMonitor = require('../utils/performance_monitor');
const tokenBudgetManager = require('../utils/token_budget_manager');
const { createQwenClient } = require('../utils/qwen_client');

// High priority keywords for semantic relation extraction
const CAUSAL_KEYWORDS = ['导致', '因为', '由于', '造成', '引起', '产生', '导致了', '使得', '令'];
const COMPARISON_KEYWORDS = ['优于', '劣于', '相比', '对比', '不同于', '类似于', '超过', '低于', '高于'];
const TEMPORAL_KEYWORDS = ['之前', '之后', '同时', '接着', '然后', '随后', '先', '后'];

/**
 * Global LLM client instance
 */
let llmClientInstance = null;

/**
 * Initialize LLM client
 */
function initLLMClient() {
  if (!llmClientInstance && process.env.QWEN_API_KEY) {
    llmClientInstance = createQwenClient(process.env.QWEN_API_KEY);
  }
  return llmClientInstance;
}

/**
 * Set LLM client
 */
function setLLMClient(client) {
  llmClientInstance = client;
}

/**
 * Check if CKB should trigger LLM semantic extraction
 * @param {Object} ckb - CKB with entity mentions
 * @param {Object} options - Configuration options
 * @returns {Object} Trigger decision and reason
 */
function shouldTriggerSemanticExtraction(ckb, options = {}) {
  const {
    highPriorityRate = 0.3,
    randomSamplingRate = 0.2
  } = options;

  // Check budget status and respect LLM participation rate
  const budgetStatus = tokenBudgetManager.getBudgetStatus();
  const effectiveHighPriorityRate = highPriorityRate * budgetStatus.llmParticipationRate;
  const effectiveRandomRate = randomSamplingRate * budgetStatus.llmParticipationRate;

  const text = ckb.content?.text || '';
  const entities = ckb.entities || [];

  // High priority conditions
  const hasCausalKeywords = CAUSAL_KEYWORDS.some(kw => text.includes(kw));
  const hasComparisonKeywords = COMPARISON_KEYWORDS.some(kw => text.includes(kw));
  const hasTemporalKeywords = TEMPORAL_KEYWORDS.some(kw => text.includes(kw));
  const hasMultipleEntities = entities.length >= 3;

  if (hasCausalKeywords || hasComparisonKeywords || hasTemporalKeywords || hasMultipleEntities) {
    // High priority: adjusted probability based on budget
    if (Math.random() < effectiveHighPriorityRate) {
      return {
        shouldTrigger: true,
        reason: 'high_priority',
        details: {
          causal: hasCausalKeywords,
          comparison: hasComparisonKeywords,
          temporal: hasTemporalKeywords,
          multiple_entities: hasMultipleEntities
        }
      };
    }
  }

  // Random sampling: adjusted probability based on budget
  if (Math.random() < effectiveRandomRate) {
    return {
      shouldTrigger: true,
      reason: 'random_sampling',
      details: {}
    };
  }

  return {
    shouldTrigger: false,
    reason: 'not_triggered',
    details: {}
  };
}

/**
 * Extract semantic relations from CKB using LLM
 * @param {Object} ckb - CKB with entity mentions
 * @param {Function|Object} llmClient - LLM client function or object
 * @param {Object} options - Configuration options
 * @returns {Promise<Array>} Extracted semantic relations
 */
async function extractSemanticRelations(ckb, llmClient, options = {}) {
  const startTime = Date.now();
  
  const {
    confidenceThreshold = 0.7,
    maxRelations = 10
  } = options;

  if (!ckb.entities || ckb.entities.length < 2) {
    return [];
  }

  // Initialize client if not provided
  const client = llmClient || initLLMClient();
  
  if (!client) {
    console.log('[SemanticRelationBuilder] LLM client not available');
    return [];
  }

  // Build enhanced prompt
  const prompt = buildSemanticExtractionPrompt(ckb);

  try {
    // Call LLM - handle both function and object clients
    let response;
    if (typeof client === 'function') {
      response = await client(prompt);
    } else {
      const result = await client.call(prompt, {
        temperature: 0.2,
        maxTokens: 800,
        systemPrompt: '你是一个知识图谱关系抽取专家。'
      });
      response = result.content;
    }
    
    // Estimate tokens (rough estimate: prompt length / 4)
    const estimatedTokens = Math.ceil(prompt.length / 4);
    
    // Record token usage
    await tokenBudgetManager.recordUsage({
      module: 'semantic_relation_builder',
      operation: 'extract_relations',
      tokens: estimatedTokens,
      ckb_id: ckb.ckb_id,
      doc_id: ckb.doc_id,
      model_name: 'qwen'
    });
    
    // Record LLM call performance
    performanceMonitor.recordLLMCall({
      module: 'semantic_relation_builder',
      operation: 'extract_relations',
      duration: Date.now() - startTime,
      success: true,
      tokens: estimatedTokens,
      ckb_id: ckb.ckb_id,
      doc_id: ckb.doc_id
    });
    
    const candidates = parseSemanticRelationResponse(response);

    // Validate candidates (3-round validation)
    const validatedRelations = [];

    for (const candidate of candidates) {
      const validation = await validateSemanticRelation(candidate, ckb, client);

      if (validation.isValid && validation.confidence >= confidenceThreshold) {
        const relation = {
          source_id: candidate.subject_id,
          target_id: candidate.object_id,
          type: 'semantic',
          subtype: candidate.relation_type,
          weight: validation.confidence,
          confidence: validation.confidence * 0.9, // LLM confidence discount
          evidence_ckb: [ckb.ckb_id],
          metadata: {
            relation_label: candidate.relation,
            evidence_text: candidate.evidence_text,
            validation_score: validation.score,
            extraction_method: 'llm_enhanced'
          }
        };

        validatedRelations.push(relation);

        if (validatedRelations.length >= maxRelations) {
          break;
        }
      }
    }

    return validatedRelations;
  } catch (error) {
    console.error('Semantic relation extraction failed:', error);
    
    // Record error
    performanceMonitor.recordLLMCall({
      module: 'semantic_relation_builder',
      operation: 'extract_relations',
      duration: Date.now() - startTime,
      success: false,
      error: error.message,
      ckb_id: ckb.ckb_id,
      doc_id: ckb.doc_id
    });
    
    performanceMonitor.recordError({
      type: 'semantic_extraction_error',
      module: 'semantic_relation_builder',
      operation: 'extractSemanticRelations',
      message: error.message,
      ckb_id: ckb.ckb_id,
      doc_id: ckb.doc_id
    });
    
    return [];
  }
}

/**
 * Build enhanced prompt for semantic relation extraction
 * @param {Object} ckb - CKB with entity mentions
 * @returns {string} Prompt text
 */
function buildSemanticExtractionPrompt(ckb) {
  const text = ckb.content?.text || '';
  const entities = ckb.entities || [];

  const entityList = entities.map((e, i) => 
    `${i + 1}. ${e.canonical_name} (ID: ${e.id}, Type: ${e.type})`
  ).join('\n');

  return `你是一个知识图谱关系抽取专家。请从以下文本中抽取实体之间的语义关系。

文本: ${text}

实体列表:
${entityList}

关系类型说明:
- causal: 因果关系 (A 导致 B)
- comparison: 对比关系 (A 优于/劣于 B)
- temporal: 时序关系 (A 在 B 之前/之后)
- association: 关联关系 (A 与 B 相关)
- composition: 组成关系 (A 包含 B)
- attribute: 属性关系 (A 具有属性 B)

要求:
1. 只抽取文本中明确提到的关系,不要推理
2. 关系必须连接实体列表中的实体
3. 提供证据文本(原文中的片段)
4. 评估置信度(0-1)

输出 JSON 格式:
{
  "relations": [
    {
      "subject": "实体名称",
      "subject_id": "实体ID",
      "relation": "关系描述",
      "relation_type": "关系类型",
      "object": "实体名称",
      "object_id": "实体ID",
      "evidence_text": "证据文本",
      "confidence": 0.85
    }
  ]
}`;
}

/**
 * Parse LLM response for semantic relations
 * @param {string} response - LLM response text
 * @returns {Array} Parsed relation candidates
 */
function parseSemanticRelationResponse(response) {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return [];
    }

    const data = JSON.parse(jsonMatch[0]);
    return data.relations || [];
  } catch (error) {
    console.error('Failed to parse semantic relation response:', error);
    return [];
  }
}

/**
 * Validate semantic relation candidate (3-round validation)
 * @param {Object} candidate - Relation candidate
 * @param {Object} ckb - Source CKB
 * @param {Function|Object} llmClient - LLM client function or object
 * @returns {Promise<Object>} Validation result
 */
async function validateSemanticRelation(candidate, ckb, llmClient) {
  const text = ckb.content?.text || '';
  const entities = ckb.entities || [];

  // Round 1: Entity existence validation
  const subjectExists = entities.some(e => e.id === candidate.subject_id);
  const objectExists = entities.some(e => e.id === candidate.object_id);

  if (!subjectExists || !objectExists) {
    return {
      isValid: false,
      confidence: 0,
      score: 0,
      reason: 'entity_not_found'
    };
  }

  // Round 2: Evidence text validation
  if (!candidate.evidence_text || !text.includes(candidate.evidence_text)) {
    return {
      isValid: false,
      confidence: 0,
      score: 0,
      reason: 'evidence_not_found'
    };
  }

  // Round 3: Relation directionality validation
  const validationPrompt = `验证以下关系是否正确:

文本: ${text}
关系: ${candidate.subject} ${candidate.relation} ${candidate.object}
证据: ${candidate.evidence_text}

请判断:
1. 关系方向是否正确?
2. 关系类型是否准确?
3. 证据是否充分?

输出 JSON:
{
  "is_valid": true/false,
  "confidence": 0.85,
  "reason": "验证理由"
}`;

  try {
    // Call LLM - handle both function and object clients
    let validationResponse;
    if (typeof llmClient === 'function') {
      validationResponse = await llmClient(validationPrompt);
    } else {
      const result = await llmClient.call(validationPrompt, {
        temperature: 0.1,
        maxTokens: 200,
        systemPrompt: '你是一个关系验证专家。'
      });
      validationResponse = result.content;
    }
    
    // Estimate tokens for validation
    const estimatedTokens = Math.ceil(validationPrompt.length / 4);
    
    // Record token usage for validation
    await tokenBudgetManager.recordUsage({
      module: 'semantic_relation_builder',
      operation: 'validate_relation',
      tokens: estimatedTokens,
      ckb_id: ckb.ckb_id,
      doc_id: ckb.doc_id,
      model_name: 'qwen'
    });
    
    const validationResult = parseValidationResponse(validationResponse);

    return {
      isValid: validationResult.is_valid,
      confidence: validationResult.confidence,
      score: validationResult.confidence,
      reason: validationResult.reason
    };
  } catch (error) {
    console.error('Validation failed:', error);
    return {
      isValid: false,
      confidence: 0,
      score: 0,
      reason: 'validation_error'
    };
  }
}

/**
 * Parse validation response
 * @param {string} response - LLM response text
 * @returns {Object} Parsed validation result
 */
function parseValidationResponse(response) {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { is_valid: false, confidence: 0, reason: 'parse_error' };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    return { is_valid: false, confidence: 0, reason: 'parse_error' };
  }
}

/**
 * Batch process CKBs for semantic relation extraction
 * @param {Array} ckbs - List of CKBs
 * @param {Function} llmClient - LLM client function
 * @param {Object} options - Configuration options
 * @returns {Promise<Array>} All extracted relations
 */
async function batchExtractSemanticRelations(ckbs, llmClient, options = {}) {
  const {
    batchSize = 5,
    highPriorityRate = 0.3,
    randomSamplingRate = 0.2
  } = options;

  const allRelations = [];
  const triggeredCkbs = [];

  // Filter CKBs that should trigger extraction
  for (const ckb of ckbs) {
    const trigger = shouldTriggerSemanticExtraction(ckb, {
      highPriorityRate,
      randomSamplingRate
    });

    if (trigger.shouldTrigger) {
      triggeredCkbs.push({ ckb, trigger });
    }
  }

  console.log(`Triggered semantic extraction for ${triggeredCkbs.length}/${ckbs.length} CKBs`);

  // Process in batches
  for (let i = 0; i < triggeredCkbs.length; i += batchSize) {
    const batch = triggeredCkbs.slice(i, i + batchSize);

    const batchPromises = batch.map(({ ckb }) =>
      extractSemanticRelations(ckb, llmClient, options)
    );

    const batchResults = await Promise.all(batchPromises);

    for (const relations of batchResults) {
      allRelations.push(...relations);
    }

    console.log(`Processed batch ${Math.floor(i / batchSize) + 1}, extracted ${batchResults.flat().length} relations`);
  }

  return allRelations;
}

/**
 * Get semantic relation statistics
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Statistics
 */
async function getSemanticRelationStats(filters = {}) {
  const relations = await relationStore.getRelations({
    ...filters,
    type: 'semantic'
  });

  const stats = {
    total_relations: relations.length,
    avg_confidence: 0,
    subtype_distribution: {},
    validation_score_distribution: {
      high: 0,   // >= 0.8
      medium: 0, // 0.6 - 0.8
      low: 0     // < 0.6
    }
  };

  if (relations.length === 0) {
    return stats;
  }

  let totalConfidence = 0;

  for (const relation of relations) {
    totalConfidence += relation.confidence;

    // Count subtypes
    const subtype = relation.subtype || 'unknown';
    stats.subtype_distribution[subtype] = (stats.subtype_distribution[subtype] || 0) + 1;

    // Count validation scores
    const validationScore = relation.metadata?.validation_score || 0;
    if (validationScore >= 0.8) {
      stats.validation_score_distribution.high++;
    } else if (validationScore >= 0.6) {
      stats.validation_score_distribution.medium++;
    } else {
      stats.validation_score_distribution.low++;
    }
  }

  stats.avg_confidence = totalConfidence / relations.length;

  return stats;
}

module.exports = {
  shouldTriggerSemanticExtraction,
  extractSemanticRelations,
  batchExtractSemanticRelations,
  getSemanticRelationStats,
  buildSemanticExtractionPrompt,
  validateSemanticRelation,
  initLLMClient,
  setLLMClient
};
