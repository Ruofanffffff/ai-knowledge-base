/**
 * LLM-Based Field Extractor
 * 
 * Fallback extraction method using LLM when rule-based methods fail
 * This method consumes tokens and should be used sparingly
 */

require('dotenv').config();
const { FieldType } = require('./rule_extractor');
const { 
  buildFieldExtractionPrompt, 
  buildSemanticFieldExtractionPrompt,
  buildTravelFieldExtractionPrompt,
  buildSimplifiedPrompt,
  validateExtractedFields 
} = require('../prompts/extract_fields');
const { createQwenClient } = require('../utils/qwen_client');
const tokenBudgetManager = require('../utils/token_budget_manager');

/**
 * LLM client instance
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
 * Extract fields using LLM (fallback method)
 * @param {Object} ckb - CKB object
 * @param {Array} existingFields - Fields already extracted by rules
 * @param {Object} options - Extraction options
 * @param {boolean} options.useSimplified - Use simplified prompt to save tokens
 * @param {boolean} options.useSemantic - Use semantic field names instead of type labels
 * @param {string} options.domain - Domain-specific extraction ('travel', 'medical', 'government', etc.)
 * @param {number} options.maxFields - Maximum number of fields to extract
 * @param {Object} options.schema - Target schema for validation (optional)
 * @param {boolean} options.enableSegmentation - Enable document segmentation for long documents (default: true)
 * @param {number} options.segmentSize - Maximum characters per segment (default: 10000)
 * @returns {Promise<Array>} Additional fields from LLM
 */
async function extractFieldsWithLLM(ckb, existingFields = [], options = {}) {
  const client = initLLMClient();
  
  if (!client) {
    console.warn('LLM API key not configured, skipping LLM extraction');
    return [];
  }
  
  const text = ckb.content.text;
  const { 
    useSimplified = false,
    useSemantic = true,  // 默认使用语义字段名
    domain = null,  // 领域特定提取
    maxFields = 30,
    schema = null,  // 目标schema
    enableSegmentation = true,  // 启用文档分段
    segmentSize = 10000  // 每段最大字符数
  } = options;
  
  // 如果文档太长且启用了分段,使用分段提取
  if (enableSegmentation && text.length > segmentSize) {
    console.log(`Document too long (${text.length} chars), using segmented extraction`);
    return await extractFieldsWithSegmentation(ckb, existingFields, options);
  }
  
  // Build prompt using the prompt module
  let prompt;
  if (domain === 'travel') {
    // 使用旅游领域专用prompt
    prompt = buildTravelFieldExtractionPrompt(text, { maxFields, schema, existingFields });
  } else if (useSemantic) {
    // 使用语义字段提取prompt
    prompt = buildSemanticFieldExtractionPrompt(text, { maxFields, schema, existingFields });
  } else if (useSimplified) {
    prompt = buildSimplifiedPrompt(text, existingFields);
  } else {
    prompt = buildFieldExtractionPrompt(text, existingFields);
  }
  
  try {
    const response = await client.call(prompt, {
      temperature: 0.1,
      maxTokens: 4000,  // 增加到4000以支持更长的输出(旅游文档可能有很多景点)
      systemPrompt: '你是一个专业的知识图谱字段提取专家。请严格按照JSON格式输出，确保JSON完整有效。'
    });
    
    const fields = parseLLMResponse(response, text);
    
    // Validate against schema if provided
    let validatedFields = fields;
    if (schema) {
      const { validateFieldsAgainstSchema } = require('../prompts/extract_fields');
      const validationResult = validateFieldsAgainstSchema(fields, schema);
      
      if (validationResult.warnings.length > 0) {
        console.warn('Schema validation warnings:', validationResult.warnings);
      }
      
      validatedFields = validationResult.validatedFields;
      console.log(`Schema validation: ${validationResult.matchedCount} matched, ${validationResult.unmatchedCount} unmatched`);
    }
    
    // Record token usage using tokenBudgetManager
    await tokenBudgetManager.recordUsage({
      module: 'field_extractor',
      operation: 'extract_fields',
      inputTokens: response.input_tokens || 0,
      outputTokens: response.output_tokens || 0,
      totalTokens: response.tokens || 0,
      ckbId: ckb.ckb_id,
      docId: ckb.doc_id,
      domain: domain || 'general'
    });
    
    return validatedFields;
  } catch (error) {
    console.error('LLM extraction error:', error);
    return [];
  }
}



/**
 * Extract fields from long documents using segmentation
 * Splits document into smaller segments and extracts fields from each segment
 * 
 * @param {Object} ckb - CKB object
 * @param {Array} existingFields - Fields already extracted by rules
 * @param {Object} options - Extraction options
 * @returns {Promise<Array>} Extracted fields from all segments
 */
async function extractFieldsWithSegmentation(ckb, existingFields = [], options = {}) {
  const {
    segmentSize = 10000,
    maxFields = 50,  // 每段最多提取的字段数
    domain = null,
    schema = null,
    useSemantic = true
  } = options;
  
  const text = ckb.content.text;
  const segments = splitTextIntoSegments(text, segmentSize);
  
  console.log(`Split document into ${segments.length} segments`);
  
  const allFields = [];
  const fieldNames = new Set();  // 用于去重
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    console.log(`Processing segment ${i + 1}/${segments.length} (${segment.length} chars)`);
    
    // 创建临时CKB对象
    const segmentCKB = {
      ...ckb,
      content: {
        ...ckb.content,
        text: segment
      }
    };
    
    try {
      // 对每个段落进行提取
      const segmentFields = await extractFieldsFromSegment(
        segmentCKB,
        existingFields,
        {
          domain,
          schema,
          useSemantic,
          maxFields: Math.ceil(maxFields / segments.length)  // 平均分配字段配额
        }
      );
      
      // 去重并合并字段
      for (const field of segmentFields) {
        const fieldKey = `${field.name}:${field.value}`;
        if (!fieldNames.has(fieldKey)) {
          fieldNames.add(fieldKey);
          allFields.push(field);
        }
      }
      
      console.log(`Segment ${i + 1}: extracted ${segmentFields.length} fields, total: ${allFields.length}`);
    } catch (error) {
      console.error(`Error processing segment ${i + 1}:`, error.message);
      // 继续处理下一个段落
    }
  }
  
  console.log(`Segmented extraction complete: ${allFields.length} total fields from ${segments.length} segments`);
  
  return allFields;
}

/**
 * Split text into segments of approximately equal size
 * Tries to split at sentence boundaries to preserve context
 * 
 * @param {string} text - Text to split
 * @param {number} segmentSize - Target size for each segment
 * @returns {Array<string>} Array of text segments
 */
function splitTextIntoSegments(text, segmentSize) {
  const segments = [];
  let currentSegment = '';
  
  // 按句子分割(中文句号、英文句号、换行符)
  const sentences = text.split(/([。.!?！？\n]+)/);
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    // 如果当前段落加上这个句子不会超过限制,就添加
    if (currentSegment.length + sentence.length <= segmentSize) {
      currentSegment += sentence;
    } else {
      // 否则,保存当前段落并开始新段落
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }
      currentSegment = sentence;
    }
  }
  
  // 添加最后一个段落
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }
  
  return segments;
}

/**
 * Extract fields from a single segment
 * 
 * @param {Object} segmentCKB - CKB object for the segment
 * @param {Array} existingFields - Already extracted fields
 * @param {Object} options - Extraction options
 * @returns {Promise<Array>} Extracted fields
 */
async function extractFieldsFromSegment(segmentCKB, existingFields, options) {
  const client = initLLMClient();
  const text = segmentCKB.content.text;
  const { 
    domain = null,
    schema = null,
    useSemantic = true,
    maxFields = 30
  } = options;
  
  // Build prompt
  let prompt;
  if (domain === 'travel') {
    prompt = buildTravelFieldExtractionPrompt(text, { maxFields, schema, existingFields });
  } else if (useSemantic) {
    prompt = buildSemanticFieldExtractionPrompt(text, { maxFields, schema, existingFields });
  } else {
    prompt = buildFieldExtractionPrompt(text, existingFields);
  }
  
  try {
    const response = await client.call(prompt, {
      temperature: 0.1,
      maxTokens: 4000,
      systemPrompt: '你是一个专业的知识图谱字段提取专家。请严格按照JSON格式输出，确保JSON完整有效。'
    });
    
    const fields = parseLLMResponse(response, text);
    
    // Validate against schema if provided
    let validatedFields = fields;
    if (schema) {
      const { validateFieldsAgainstSchema } = require('../prompts/extract_fields');
      const validationResult = validateFieldsAgainstSchema(fields, schema);
      
      if (validationResult.warnings.length > 0) {
        console.warn('Schema validation warnings:', validationResult.warnings);
      }
      
      validatedFields = validationResult.validatedFields;
    }
    
    // Record token usage
    await tokenBudgetManager.recordUsage({
      module: 'field_extractor',
      operation: 'extract_fields_segment',
      inputTokens: response.input_tokens || 0,
      outputTokens: response.output_tokens || 0,
      totalTokens: response.tokens || 0,
      ckbId: segmentCKB.ckb_id,
      docId: segmentCKB.doc_id,
      domain: domain || 'general'
    });
    
    return validatedFields;
  } catch (error) {
    console.error('Segment extraction error:', error);
    return [];
  }
}

/**
 * Parse LLM response to extract fields
 * @param {Object} response - LLM response (from QwenClient)
 * @param {string} originalText - Original text for validation
 * @returns {Array} Extracted fields
 */
function parseLLMResponse(response, originalText) {
  try {
    const client = initLLMClient();
    const parsed = client.parseJSON(response.content);
    
    if (!parsed.fields || !Array.isArray(parsed.fields)) {
      console.warn('Invalid fields format in LLM response');
      return [];
    }
    
    // Validate fields using the prompt module's validator
    const { validFields, errors } = validateExtractedFields(parsed.fields, originalText);
    
    if (errors.length > 0) {
      console.warn('Field validation warnings:', errors);
    }
    
    return validFields;
  } catch (error) {
    console.error('Error parsing LLM response:', error);
    return [];
  }
}

/**
 * Check if LLM extraction should be used
 * @param {Array} ruleFields - Fields from rule extraction
 * @param {number} minFieldCount - Minimum expected field count
 * @returns {boolean} Whether to use LLM
 */
function shouldUseLLM(ruleFields, minFieldCount = 3) {
  // Use LLM if rule-based extraction found too few fields
  return ruleFields.length < minFieldCount;
}

/**
 * Get prompt builder function for domain
 * @param {string} domain - Domain name
 * @returns {Function} Prompt builder function
 */
function getPromptBuilderForDomain(domain) {
  const { PROMPT_BUILDERS } = require('./extraction_config');
  const builderName = PROMPT_BUILDERS[domain] || 'buildFieldExtractionPrompt';
  
  // Map builder name to actual function
  const builders = {
    'buildTravelFieldExtractionPrompt': buildTravelFieldExtractionPrompt,
    'buildSemanticFieldExtractionPrompt': buildSemanticFieldExtractionPrompt,
    'buildFieldExtractionPrompt': buildFieldExtractionPrompt
  };
  
  return builders[builderName] || buildFieldExtractionPrompt;
}

module.exports = {
  extractFieldsWithLLM,
  extractFieldsWithSegmentation,
  splitTextIntoSegments,
  shouldUseLLM,
  parseLLMResponse,
  initLLMClient,
  getPromptBuilderForDomain
};
