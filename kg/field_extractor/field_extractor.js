/**
 * Field Extractor - Main Logic
 * 
 * Orchestrates field extraction using multiple methods:
 * 1. Rule-based extraction (0 Token)
 * 2. NER extraction (0 Token)
 * 3. LLM extraction (fallback, consumes tokens)
 * 
 * Enhanced with domain detection and strategy selection
 */

const ruleExtractor = require('./rule_extractor');
const nerExtractor = require('./ner_extractor');
const llmExtractor = require('./llm_extractor');
const domainDetector = require('./domain_detector');
const strategySelector = require('./strategy_selector');
const performanceMonitor = require('../utils/performance_monitor');
const crypto = require('crypto');

// Extraction cache
const extractionCache = new Map();

/**
 * Extract fields from CKB (Enhanced)
 * @param {Object} ckb - CKB object
 * @param {Object} options - Extraction options
 * @param {boolean} options.useLLM - Enable LLM extraction (default: true)
 * @param {boolean} options.useRules - Enable rule extraction (default: true)
 * @param {boolean} options.useNER - Enable NER extraction (default: true)
 * @param {number} options.minFieldCount - Minimum fields before LLM fallback (default: 3)
 * @param {boolean} options.forceLLM - Force LLM extraction (default: false)
 * @param {string} options.domain - Override domain detection (optional)
 * @param {string} options.strategy - Override strategy selection (optional)
 * @param {Object} options.schema - Target schema for validation (optional)
 * @param {boolean} options.enableDomainDetection - Enable automatic domain detection (default: true)
 * @param {boolean} options.trackTokens - Track token usage (default: true)
 * @param {boolean} options.useCache - Enable extraction caching (default: true)
 * @returns {Promise<Array>} Extracted fields
 */
async function extractFields(ckb, options = {}) {
  const startTime = Date.now();
  
  const {
    // Existing options
    useLLM = true,
    useRules = true,
    useNER = true,
    minFieldCount = 3,
    llmFallbackThreshold = 0.5,
    forceLLM = false,
    
    // New options
    domain = null,
    strategy = null,
    schema = null,
    enableDomainDetection = true,
    trackTokens = true,
    useCache = true
  } = options;
  
  // Check cache if enabled
  if (useCache) {
    const cacheKey = generateCacheKey(ckb, options);
    const cachedResult = extractionCache.get(cacheKey);
    
    if (cachedResult) {
      console.log(`Cache hit for CKB ${ckb.ckb_id}`);
      
      // Record cache hit
      performanceMonitor.recordMetric({
        metric: 'extraction_cache',
        ckb_id: ckb.ckb_id,
        doc_id: ckb.doc_id,
        cacheHit: true,
        cacheSize: extractionCache.size
      });
      
      performanceMonitor.recordLocalProcessing({
        ckb_id: ckb.ckb_id,
        doc_id: ckb.doc_id,
        extract_time: Date.now() - startTime,
        metadata: {
          method: 'field_extraction',
          fields_count: cachedResult.length,
          cache_hit: true
        }
      });
      
      return cachedResult;
    }
  }
  
  const text = ckb.content.text;
  
  if (!text || text.trim().length === 0) {
    return [];
  }
  
  try {
    let allFields = [];
    let detectedDomain = domain;
    let selectedStrategy = strategy;
    
    // Step 1: Domain Detection (if enabled and not overridden)
    const domainDetectionStart = Date.now();
    let domainDetectionResult = null;
    
    if (!detectedDomain && enableDomainDetection) {
      domainDetectionResult = domainDetector.detectDomain(ckb);
      detectedDomain = domainDetectionResult.domain;
      console.log(`Detected domain: ${detectedDomain} (confidence: ${domainDetectionResult.confidence})`);
      
      // Record domain detection metrics
      performanceMonitor.recordMetric({
        metric: 'domain_detection',
        ckb_id: ckb.ckb_id,
        doc_id: ckb.doc_id,
        domain: detectedDomain,
        confidence: domainDetectionResult.confidence,
        executionTime: Date.now() - domainDetectionStart,
        keywordCount: domainDetectionResult.metadata?.keywordCount || 0,
        keywordDensity: domainDetectionResult.metadata?.keywordDensity || 0
      });
    } else if (detectedDomain) {
      console.log(`Using provided domain: ${detectedDomain}`);
    } else {
      detectedDomain = 'general';
      console.log('Domain detection disabled, using general domain');
    }
    
    // Step 2: Strategy Selection (if not overridden)
    const strategySelectionStart = Date.now();
    let strategySelectionResult = null;
    
    if (!selectedStrategy) {
      strategySelectionResult = strategySelector.selectStrategy(detectedDomain, options);
      selectedStrategy = strategySelectionResult.strategy;
      console.log(`Selected strategy: ${selectedStrategy} (${strategySelectionResult.reason})`);
      
      // Record strategy selection metrics
      performanceMonitor.recordMetric({
        metric: 'strategy_selection',
        ckb_id: ckb.ckb_id,
        doc_id: ckb.doc_id,
        domain: detectedDomain,
        strategy: selectedStrategy,
        executionTime: Date.now() - strategySelectionStart,
        reason: strategySelectionResult.reason
      });
    } else {
      console.log(`Using provided strategy: ${selectedStrategy}`);
    }
    
    // Step 3: Execute extraction based on strategy
    const extractionStart = Date.now();
    allFields = await executeStrategy(
      ckb,
      selectedStrategy,
      detectedDomain,
      schema,
      {
        useLLM,
        useRules,
        useNER,
        minFieldCount,
        forceLLM,
        trackTokens
      }
    );
    const extractionTime = Date.now() - extractionStart;
    
    // Sort by confidence (descending)
    allFields.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
    console.log(`Total fields extracted: ${allFields.length}`);
    
    // Record extraction metrics
    performanceMonitor.recordMetric({
      metric: 'field_extraction',
      ckb_id: ckb.ckb_id,
      doc_id: ckb.doc_id,
      domain: detectedDomain,
      strategy: selectedStrategy,
      fieldCount: allFields.length,
      executionTime: extractionTime,
      usedLLM: selectedStrategy === 'semantic-only' || selectedStrategy === 'llm-first' || selectedStrategy === 'hybrid',
      hasSchema: !!schema
    });
    
    // Store in cache if enabled
    if (useCache) {
      const cacheKey = generateCacheKey(ckb, options);
      extractionCache.set(cacheKey, allFields);
      console.log(`Cached extraction result for CKB ${ckb.ckb_id}`);
      
      // Record cache metrics
      performanceMonitor.recordMetric({
        metric: 'extraction_cache',
        ckb_id: ckb.ckb_id,
        doc_id: ckb.doc_id,
        cacheHit: false,
        cacheSize: extractionCache.size
      });
    }
    
    // Record performance
    performanceMonitor.recordLocalProcessing({
      ckb_id: ckb.ckb_id,
      doc_id: ckb.doc_id,
      extract_time: Date.now() - startTime,
      metadata: {
        method: 'field_extraction',
        fields_count: allFields.length,
        domain: detectedDomain,
        strategy: selectedStrategy,
        used_llm: selectedStrategy === 'semantic-only' || selectedStrategy === 'llm-first' || selectedStrategy === 'hybrid'
      }
    });
    
    return allFields;
  } catch (error) {
    // Record error
    performanceMonitor.recordError({
      type: 'extraction_error',
      module: 'field_extractor',
      operation: 'extractFields',
      message: error.message,
      ckb_id: ckb.ckb_id,
      doc_id: ckb.doc_id
    });
    throw error;
  }
}

/**
 * Execute extraction strategy
 * @param {Object} ckb - CKB object
 * @param {string} strategy - Strategy name
 * @param {string} domain - Domain name
 * @param {Object} schema - Target schema (optional)
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Extracted fields
 */
async function executeStrategy(ckb, strategy, domain, schema, options) {
  const text = ckb.content.text;
  
  switch (strategy) {
    case 'rule-first':
      return executeRuleFirst(ckb, text, options);
    
    case 'llm-first':
      return executeLLMFirst(ckb, text, domain, schema, options);
    
    case 'semantic-only':
      return executeSemanticOnly(ckb, text, domain, schema, options);
    
    case 'hybrid':
      return executeHybrid(ckb, text, domain, schema, options);
    
    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}

/**
 * Execute rule-first strategy
 * Rule+NER extraction first, LLM fallback if insufficient
 */
async function executeRuleFirst(ckb, text, options) {
  const { useRules, useNER, useLLM, minFieldCount } = options;
  let allFields = [];
  
  // Step 1: Rule-based extraction
  if (useRules) {
    const ruleFields = ruleExtractor.extractFields(text);
    console.log(`Rule extraction found ${ruleFields.length} fields`);
    allFields = ruleFields;
  }
  
  // Step 2: NER extraction
  if (useNER) {
    const nerEntities = nerExtractor.extractEntities(text);
    console.log(`NER extraction found ${nerEntities.length} entities`);
    allFields = nerExtractor.mergeWithRuleFields(allFields, nerEntities);
  }
  
  // Deduplicate
  allFields = ruleExtractor.deduplicateFields(allFields);
  
  // Step 3: LLM fallback if insufficient fields
  if (useLLM && llmExtractor.shouldUseLLM(allFields, minFieldCount)) {
    console.log('Rule+NER extraction insufficient, using LLM fallback');
    
    try {
      const llmFields = await llmExtractor.extractFieldsWithLLM(ckb, allFields);
      console.log(`LLM extraction found ${llmFields.length} additional fields`);
      
      allFields = [...allFields, ...llmFields];
      allFields = ruleExtractor.deduplicateFields(allFields);
    } catch (error) {
      console.error('LLM extraction failed:', error);
    }
  }
  
  return allFields;
}

/**
 * Execute LLM-first strategy
 * LLM extraction first, Rule+NER fallback if LLM fails
 */
async function executeLLMFirst(ckb, text, domain, schema, options) {
  const { useRules, useNER, useLLM } = options;
  let allFields = [];
  
  // Step 1: Try LLM extraction first
  if (useLLM) {
    try {
      const llmFields = await llmExtractor.extractFieldsWithLLM(ckb, [], {
        domain,
        useSemantic: true,
        schema
      });
      console.log(`LLM extraction found ${llmFields.length} fields`);
      allFields = llmFields;
    } catch (error) {
      console.error('LLM extraction failed, falling back to Rule+NER:', error);
      
      // Fallback to Rule+NER
      if (useRules) {
        const ruleFields = ruleExtractor.extractFields(text);
        console.log(`Rule extraction found ${ruleFields.length} fields`);
        allFields = ruleFields;
      }
      
      if (useNER) {
        const nerEntities = nerExtractor.extractEntities(text);
        console.log(`NER extraction found ${nerEntities.length} entities`);
        allFields = nerExtractor.mergeWithRuleFields(allFields, nerEntities);
      }
      
      allFields = ruleExtractor.deduplicateFields(allFields);
    }
  }
  
  return allFields;
}

/**
 * Execute semantic-only strategy
 * LLM semantic extraction only, no rule-based methods
 */
async function executeSemanticOnly(ckb, text, domain, schema, options) {
  const { useRules, useNER, useLLM } = options;
  let allFields = [];
  
  if (useLLM) {
    try {
      const llmFields = await llmExtractor.extractFieldsWithLLM(ckb, [], {
        domain,
        useSemantic: true,
        schema
      });
      console.log(`LLM semantic extraction found ${llmFields.length} fields`);
      allFields = llmFields;
    } catch (error) {
      console.error('LLM extraction failed, falling back to Rule+NER:', error);
      
      // Fallback to Rule+NER even in semantic-only mode
      if (useRules) {
        const ruleFields = ruleExtractor.extractFields(text);
        console.log(`Rule extraction found ${ruleFields.length} fields`);
        allFields = ruleFields;
      }
      
      if (useNER) {
        const nerEntities = nerExtractor.extractEntities(text);
        console.log(`NER extraction found ${nerEntities.length} entities`);
        allFields = nerExtractor.mergeWithRuleFields(allFields, nerEntities);
      }
      
      allFields = ruleExtractor.deduplicateFields(allFields);
    }
  }
  
  return allFields;
}

/**
 * Execute hybrid strategy
 * Run Rule+NER and LLM in parallel, merge results
 */
async function executeHybrid(ckb, text, domain, schema, options) {
  const { useRules, useNER, useLLM } = options;
  
  // Run Rule+NER and LLM in parallel
  const promises = [];
  
  // Rule+NER extraction
  const ruleNerPromise = (async () => {
    let fields = [];
    
    if (useRules) {
      const ruleFields = ruleExtractor.extractFields(text);
      fields = ruleFields;
    }
    
    if (useNER) {
      const nerEntities = nerExtractor.extractEntities(text);
      fields = nerExtractor.mergeWithRuleFields(fields, nerEntities);
    }
    
    return ruleExtractor.deduplicateFields(fields);
  })();
  
  promises.push(ruleNerPromise);
  
  // LLM extraction
  if (useLLM) {
    const llmPromise = llmExtractor.extractFieldsWithLLM(ckb, [], {
      domain,
      useSemantic: true,
      schema
    }).catch(error => {
      console.error('LLM extraction failed in hybrid mode:', error);
      return [];
    });
    
    promises.push(llmPromise);
  }
  
  // Wait for both to complete
  const results = await Promise.all(promises);
  
  // Merge results
  let allFields = [];
  for (const fields of results) {
    allFields = [...allFields, ...fields];
  }
  
  // Deduplicate merged results
  allFields = ruleExtractor.deduplicateFields(allFields);
  
  console.log(`Hybrid extraction found ${allFields.length} total fields`);
  
  return allFields;
}

/**
 * Extract fields from multiple CKBs
 * @param {Array} ckbs - Array of CKB objects
 * @param {Object} options - Extraction options
 * @returns {Promise<Array>} Array of {ckbId, fields, domain, strategy} objects
 */
async function extractFieldsFromCKBs(ckbs, options = {}) {
  const results = [];
  
  for (const ckb of ckbs) {
    try {
      // Detect domain for this CKB if enabled
      let detectedDomain = options.domain;
      if (!detectedDomain && options.enableDomainDetection !== false) {
        const domainResult = domainDetector.detectDomain(ckb);
        detectedDomain = domainResult.domain;
      }
      
      // Extract fields
      const fields = await extractFields(ckb, options);
      
      // Get strategy used
      let strategy = options.strategy;
      if (!strategy) {
        const strategyResult = strategySelector.selectStrategy(
          detectedDomain || 'general',
          options
        );
        strategy = strategyResult.strategy;
      }
      
      results.push({
        ckbId: ckb.ckb_id,
        fields: fields,
        domain: detectedDomain || 'general',
        strategy: strategy,
        fieldCount: fields.length
      });
    } catch (error) {
      console.error(`Error extracting fields from CKB ${ckb.ckb_id}:`, error);
      
      // Record error
      performanceMonitor.recordError({
        type: 'batch_extraction_error',
        module: 'field_extractor',
        operation: 'extractFieldsFromCKBs',
        message: error.message,
        ckb_id: ckb.ckb_id
      });
      
      results.push({
        ckbId: ckb.ckb_id,
        fields: [],
        error: error.message,
        domain: null,
        strategy: null,
        fieldCount: 0
      });
    }
  }
  
  return results;
}

/**
 * Get field statistics
 * @param {Array} fields - Array of fields
 * @returns {Object} Statistics
 */
function getFieldStatistics(fields) {
  const stats = {
    total: fields.length,
    byType: {},
    bySource: {},
    avgConfidence: 0
  };
  
  fields.forEach(field => {
    // Count by type
    stats.byType[field.type] = (stats.byType[field.type] || 0) + 1;
    
    // Count by source
    const source = field.source || 'rule';
    stats.bySource[source] = (stats.bySource[source] || 0) + 1;
  });
  
  // Calculate average confidence
  if (fields.length > 0) {
    const totalConfidence = fields.reduce((sum, f) => sum + (f.confidence || 0), 0);
    stats.avgConfidence = totalConfidence / fields.length;
  }
  
  return stats;
}

/**
 * Filter fields by type
 * @param {Array} fields - Array of fields
 * @param {string|Array} types - Field type(s) to filter
 * @returns {Array} Filtered fields
 */
function filterFieldsByType(fields, types) {
  const typeArray = Array.isArray(types) ? types : [types];
  return fields.filter(field => typeArray.includes(field.type));
}

/**
 * Filter fields by confidence threshold
 * @param {Array} fields - Array of fields
 * @param {number} threshold - Minimum confidence (0-1)
 * @returns {Array} Filtered fields
 */
function filterFieldsByConfidence(fields, threshold = 0.7) {
  return fields.filter(field => (field.confidence || 0) >= threshold);
}

/**
 * Group fields by name
 * @param {Array} fields - Array of fields
 * @returns {Object} Fields grouped by name
 */
function groupFieldsByName(fields) {
  const grouped = {};
  
  fields.forEach(field => {
    if (!grouped[field.name]) {
      grouped[field.name] = [];
    }
    grouped[field.name].push(field);
  });
  
  return grouped;
}

/**
 * Generate cache key from CKB content and options
 * @param {Object} ckb - CKB object
 * @param {Object} options - Extraction options
 * @returns {string} Cache key
 */
function generateCacheKey(ckb, options) {
  // Create a stable representation of the options that affect extraction
  const cacheOptions = {
    domain: options.domain,
    strategy: options.strategy,
    useLLM: options.useLLM,
    useRules: options.useRules,
    useNER: options.useNER,
    enableDomainDetection: options.enableDomainDetection,
    schemaId: options.schema ? options.schema.id : null
  };
  
  // Create hash from CKB content and options
  const content = JSON.stringify({
    text: ckb.content.text,
    options: cacheOptions
  });
  
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Clear extraction cache
 * @param {string} cacheKey - Optional specific cache key to clear
 */
function clearCache(cacheKey = null) {
  if (cacheKey) {
    extractionCache.delete(cacheKey);
    console.log(`Cleared cache entry: ${cacheKey}`);
  } else {
    extractionCache.clear();
    console.log('Cleared all extraction cache');
  }
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
function getCacheStats() {
  return {
    size: extractionCache.size,
    keys: Array.from(extractionCache.keys())
  };
}

module.exports = {
  extractFields,
  extractFieldsFromCKBs,
  getFieldStatistics,
  filterFieldsByType,
  filterFieldsByConfidence,
  groupFieldsByName,
  executeStrategy,
  executeRuleFirst,
  executeLLMFirst,
  executeSemanticOnly,
  executeHybrid,
  generateCacheKey,
  clearCache,
  getCacheStats
};
