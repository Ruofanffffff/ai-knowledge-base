/**
 * LLM Mapper - LLM-based Field Name Mapping
 * 
 * Uses LLM to map raw field names to schema-defined standard field names
 * when algorithm-based methods fail. Implements 50% probability sampling
 * and batch processing optimization to control token consumption.
 * 
 * Design Reference: Phase 2 - Field Normalization Module (Section 4.4)
 * Validates: Requirements 18.5, 18.6, 18.12
 * 
 * Key Features:
 * - LLM-based field name mapping with intelligent truncating
 * - 50% probability sampling for cost control
 * - Batch processing optimization (up to 10 fields per batch)
 * - Validation of LLM responses
 * - Integration with intelligent truncating for token savings
 */

require('dotenv').config();
const intelligentTruncating = require('./intelligent_truncating');
const performanceMonitor = require('../utils/performance_monitor');
const tokenBudgetManager = require('../utils/token_budget_manager');
const { createQwenClient } = require('../utils/qwen_client');

/**
 * Global LLM client instance
 */
let llmClient = null;

/**
 * Initialize LLM client
 */
function initLLMClient() {
  if (!llmClient && process.env.QWEN_API_KEY) {
    llmClient = createQwenClient(process.env.QWEN_API_KEY);
  }
  return llmClient;
}

/**
 * Set LLM client
 * 
 * Allows injection of custom LLM client for production use.
 * 
 * @param {Object} client - LLM client with call() method
 */
function setLLMClient(client) {
  if (!client || typeof client.call !== 'function') {
    throw new Error('LLM client must have a call() method');
  }
  llmClient = client;
}

/**
 * Map field name using LLM
 * 
 * Uses LLM to map a raw field name to a schema-defined standard field name.
 * Applies intelligent truncating to reduce token consumption.
 * 
 * @param {string} rawFieldName - Raw field name
 * @param {Array<string>} schemaFieldNames - Schema field names
 * @param {Object} field - Full field object for context
 * @param {Object} schema - Schema object (optional, for intelligent truncating)
 * @param {Object} options - Mapping options
 * @returns {Promise<Object|null>} Mapping result or null
 * 
 * @example
 * const mapping = await mapFieldNameWithLLM(
 *   '地区',
 *   ['区域', '时间', '指标', '数值', '单位'],
 *   { name: '地区', value: '阿里C区', type: 'location', confidence: 0.95 },
 *   schema
 * );
 * // Returns: {
 * //   mapped_name: '区域',
 * //   confidence: 0.85,
 * //   method: 'llm',
 * //   truncating_info: { ... }
 * // }
 */
async function mapFieldNameWithLLM(rawFieldName, schemaFieldNames, field, schema = null, options = {}) {
  const startTime = Date.now();
  
  const {
    minConfidence = 0.7,
    validateResponse = true
  } = options;
  
  // Check budget status and respect LLM participation rate
  const budgetStatus = tokenBudgetManager.getBudgetStatus();
  
  // Respect LLM participation rate (50% normally, 20% in emergency)
  if (Math.random() > budgetStatus.llmParticipationRate) {
    console.log(`[LLM Mapper] Skipping LLM call due to budget (rate: ${budgetStatus.llmParticipationRate})`);
    return null; // Skip LLM call based on budget
  }
  
  // Apply intelligent truncating if schema is provided
  let selectedFields = schemaFieldNames;
  let truncatingInfo = null;
  
  if (schema && schemaFieldNames.length > 3) {
    // Get scene-adaptive strategy
    const strategy = intelligentTruncating.adaptTruncatingStrategy(schema);
    
    // Select most relevant fields
    const selection = intelligentTruncating.selectRelevantFields(
      rawFieldName,
      field,
      schemaFieldNames,
      schema,
      strategy
    );
    
    selectedFields = selection.selectedFields;
    
    // Calculate token savings
    const tokenSaved = (schemaFieldNames.length - selectedFields.length) * 2;
    
    truncatingInfo = {
      total_fields: schemaFieldNames.length,
      selected_fields: selectedFields.length,
      token_saved: tokenSaved,
      strategy: strategy
    };
  }
  
  // Build LLM prompt
  const prompt = buildMappingPrompt(rawFieldName, selectedFields, field, schema);
  
  try {
    // Initialize LLM client
    const client = llmClient || initLLMClient();
    
    if (!client) {
      console.log('[LLM Mapper] LLM client not available');
      return null;
    }
    
    // Call LLM
    const result = await client.callJSON(prompt, {
      temperature: 0.1,
      maxTokens: 200,
      systemPrompt: '你是一个字段映射专家。'
    });
    
    // Extract token usage from metadata
    const tokens = result._meta?.tokens || Math.ceil(prompt.length / 4);
    
    // Record token usage
    await tokenBudgetManager.recordUsage({
      module: 'field_normalizer',
      operation: 'llm_match',
      tokens: tokens,
      ckb_id: field.ckb_id,
      doc_id: field.doc_id,
      model_name: 'qwen'
    });
    
    // Record performance
    performanceMonitor.recordLLMCall({
      module: 'field_normalizer',
      operation: 'llm_match',
      duration: Date.now() - startTime,
      success: true,
      tokens: tokens,
      model: 'qwen',
      ckb_id: field.ckb_id,
      doc_id: field.doc_id
    });
    
    // Validate response
    if (validateResponse) {
      const validation = validateLLMResponse(result, selectedFields, schemaFieldNames);
      if (!validation.valid) {
        console.warn(`LLM response validation failed: ${validation.reason}`);
        return null;
      }
    }
    
    // Check confidence threshold
    if (!result.mapped_name || result.confidence < minConfidence) {
      return null;
    }
    
    // Return mapping result
    return {
      mapped_name: result.mapped_name,
      confidence: result.confidence * 0.9, // LLM confidence discount
      method: 'llm',
      reason: result.reason,
      truncating_info: truncatingInfo
    };
  } catch (error) {
    console.error('LLM mapping error:', error);
    
    // Record error
    performanceMonitor.recordLLMCall({
      module: 'field_normalizer',
      operation: 'llm_match',
      duration: Date.now() - startTime,
      success: false,
      error: error.message,
      ckb_id: field.ckb_id,
      doc_id: field.doc_id
    });
    
    performanceMonitor.recordError({
      type: 'llm_mapping_error',
      module: 'field_normalizer',
      operation: 'mapFieldNameWithLLM',
      message: error.message,
      ckb_id: field.ckb_id,
      doc_id: field.doc_id
    });
    
    return null;
  }
}

/**
 * Build LLM mapping prompt
 * 
 * Constructs a detailed prompt for LLM field name mapping.
 * 
 * @param {string} rawFieldName - Raw field name
 * @param {Array<string>} selectedFields - Selected candidate field names
 * @param {Object} field - Full field object for context
 * @param {Object} schema - Schema object (optional)
 * @returns {string} LLM prompt
 */
function buildMappingPrompt(rawFieldName, selectedFields, field, schema = null) {
  const prompt = `你是一个字段映射专家。请将原始字段名映射到标准字段名。

原始字段名: ${rawFieldName}
字段值: ${field.value || '未知'}
字段类型: ${field.type || '未知'}

候选标准字段(按相关性排序):
${selectedFields.map((name, i) => `${i + 1}. ${name}`).join('\n')}

${schema ? `Schema 场景: ${schema.scene || '通用'}
Schema 名称: ${schema.schema_name}` : ''}

任务:
1. 判断原始字段名应该映射到哪个标准字段
2. 如果无法确定映射,返回 null
3. 评估映射的置信度(0-1)

输出 JSON:
{
  "mapped_name": "标准字段名" 或 null,
  "confidence": 0.85,
  "reason": "映射理由"
}`;

  return prompt;
}

/**
 * Validate LLM response
 * 
 * Validates that the LLM response is well-formed and the mapped field
 * exists in the candidate list.
 * 
 * @param {Object} response - LLM response
 * @param {Array<string>} selectedFields - Selected candidate field names
 * @param {Array<string>} allFields - All schema field names
 * @returns {Object} Validation result
 */
function validateLLMResponse(response, selectedFields, allFields) {
  // Check response structure
  if (!response || typeof response !== 'object') {
    return {
      valid: false,
      reason: 'Response is not an object'
    };
  }
  
  // Check required fields
  if (!('mapped_name' in response) || !('confidence' in response)) {
    return {
      valid: false,
      reason: 'Response missing required fields (mapped_name, confidence)'
    };
  }
  
  // If no mapping, that's valid
  if (response.mapped_name === null) {
    return { valid: true };
  }
  
  // Check confidence range
  if (typeof response.confidence !== 'number' || 
      response.confidence < 0 || 
      response.confidence > 1) {
    return {
      valid: false,
      reason: 'Confidence must be a number between 0 and 1'
    };
  }
  
  // Check if mapped field is in candidate list
  if (!selectedFields.includes(response.mapped_name)) {
    console.warn(`LLM returned field not in candidate list: ${response.mapped_name}`);
    
    // Check if it's in the full field list
    if (!allFields.includes(response.mapped_name)) {
      return {
        valid: false,
        reason: `Mapped field "${response.mapped_name}" not in schema fields`
      };
    }
  }
  
  return { valid: true };
}

/**
 * Batch map field names using LLM
 * 
 * Efficiently processes multiple field mappings at once.
 * Groups up to 10 fields per batch to reduce API calls.
 * 
 * @param {Array} fieldMappingRequests - Array of mapping requests
 * @param {Object} options - Batch options
 * @returns {Promise<Array>} Array of mapping results
 * 
 * @example
 * const requests = [
 *   { rawFieldName: '地区', schemaFieldNames: [...], field: {...}, schema: {...} },
 *   { rawFieldName: '日期', schemaFieldNames: [...], field: {...}, schema: {...} }
 * ];
 * const results = await batchMapFieldNames(requests);
 */
async function batchMapFieldNames(fieldMappingRequests, options = {}) {
  const {
    batchSize = 10,
    minConfidence = 0.7
  } = options;
  
  const results = [];
  
  // Process in batches
  for (let i = 0; i < fieldMappingRequests.length; i += batchSize) {
    const batch = fieldMappingRequests.slice(i, i + batchSize);
    
    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(request => 
        mapFieldNameWithLLM(
          request.rawFieldName,
          request.schemaFieldNames,
          request.field,
          request.schema,
          { minConfidence }
        )
      )
    );
    
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Get LLM mapping statistics
 * 
 * Provides statistics about LLM mapping performance.
 * 
 * @param {Array} mappingResults - Array of mapping results
 * @returns {Object} Statistics
 */
function getLLMStats(mappingResults) {
  const stats = {
    total: mappingResults.length,
    successful: 0,
    failed: 0,
    avg_confidence: 0,
    total_tokens_saved: 0,
    avg_tokens_saved: 0
  };
  
  let totalConfidence = 0;
  let totalTokensSaved = 0;
  
  mappingResults.forEach(result => {
    if (result && result.mapped_name) {
      stats.successful++;
      totalConfidence += result.confidence;
      
      if (result.truncating_info) {
        totalTokensSaved += result.truncating_info.token_saved;
      }
    } else {
      stats.failed++;
    }
  });
  
  if (stats.successful > 0) {
    stats.avg_confidence = totalConfidence / stats.successful;
  }
  
  if (mappingResults.length > 0) {
    stats.total_tokens_saved = totalTokensSaved;
    stats.avg_tokens_saved = totalTokensSaved / mappingResults.length;
  }
  
  return stats;
}

module.exports = {
  mapFieldNameWithLLM,
  batchMapFieldNames,
  buildMappingPrompt,
  validateLLMResponse,
  getLLMStats,
  setLLMClient,
  initLLMClient
};
