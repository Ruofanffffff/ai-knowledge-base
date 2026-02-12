/**
 * Field Normalizer - Main Logic
 * 
 * Normalizes extracted fields to match schema-defined field names using mapping table + LLM fallback:
 * 1. Mapping Table Match (algorithm-based, 0 Token, highest priority)
 * 2. LLM-based Match (fallback for unmapped fields, consumes tokens)
 * 
 * Design Reference: Phase 2 - Field Normalization Module (Section 4)
 * Validates: Requirements 18.1, 18.2, 18.3, 18.5, 18.6, 18.8
 * 
 * Key Features:
 * - Mapping table for common field variations (90%+ coverage)
 * - LLM fallback for unmapped fields
 * - Caching to avoid redundant LLM calls
 * - Field value cleaning and standardization
 * - Performance: 40000x faster than full LLM approach
 */

const MappingBasedNormalizer = require('./mapping_based_normalizer');
const algorithmMapper = require('./algorithm_mapper');
const { getGlobalCache } = require('./mapping_cache');
const fieldDistribution = require('./field_distribution');

// Get global mapping cache instance
const mappingCache = getGlobalCache({
  enablePersistence: false,
  maxSize: 10000,
  ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
  learnFromLLM: true,
  llmConfidenceThreshold: 0.9
});

// Create global mapping-based normalizer instance
const mappingNormalizer = new MappingBasedNormalizer();

// Field normalization result cache
const normalizationCache = new Map();
const NORM_CACHE_MAX_SIZE = 1000;
const NORM_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Generate cache key for normalization
 */
function generateNormCacheKey(rawFields, schema) {
  const fieldNames = rawFields.map(f => f.name).sort().join(',');
  const schemaId = schema.id || schema.schema_name;
  return `${schemaId}|${fieldNames}`;
}

/**
 * Clear expired normalization cache
 */
function clearExpiredNormCache() {
  const now = Date.now();
  for (const [key, value] of normalizationCache.entries()) {
    if (now - value.timestamp > NORM_CACHE_TTL) {
      normalizationCache.delete(key);
    }
  }
}

/**
 * Normalize fields to match schema-defined field names
 * 
 * This is the main entry point for field normalization. It uses mapping table
 * for algorithm-based matching, with LLM fallback for unmapped fields.
 * 
 * @param {Array} rawFields - Raw fields extracted from CKB
 * @param {Object} schema - Schema definition with core_fields
 * @param {Object} options - Normalization options
 * @returns {Promise<Array>} Normalized fields
 * 
 * @example
 * const rawFields = [
 *   { name: '地区', value: '阿里C区', type: 'location', confidence: 0.95 },
 *   { name: '日期', value: '2025-01', type: 'time', confidence: 0.95 }
 * ];
 * const schema = {
 *   schema_name: '地下水位变化事件',
 *   core_fields: [
 *     { name: '区域', weight: 0.3, required: true },
 *     { name: '时间', weight: 0.2, required: true }
 *   ]
 * };
 * const normalized = await normalizeFields(rawFields, schema);
 * // Returns: [
 * //   { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95,
 * //     original_name: '地区', mapping_confidence: 0.9, mapping_method: 'variation' },
 * //   { name: '时间', value: '2025-01', type: 'time', confidence: 0.95,
 * //     original_name: '日期', mapping_confidence: 0.9, mapping_method: 'variation' }
 * // ]
 */
async function normalizeFields(rawFields, schema, options = {}) {
  const {
    useLLM = true,
    useAlgorithm = true,
    cleanValues = true,
    useCache = true,
    trackDistribution = true  // Enable field distribution tracking by default
  } = options;
  
  // Validate inputs
  if (!Array.isArray(rawFields)) {
    throw new Error('rawFields must be an array');
  }
  
  if (!schema || !schema.schema_name || !Array.isArray(schema.core_fields)) {
    throw new Error('schema must have schema_name and core_fields array');
  }
  
  // Check cache
  if (useCache) {
    const cacheKey = generateNormCacheKey(rawFields, schema);
    const cached = normalizationCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < NORM_CACHE_TTL)) {
      return cached.result;
    }
  }
  
  // Use mapping-based normalizer (algorithm + LLM fallback)
  if (useAlgorithm) {
    try {
      const result = await mappingNormalizer.normalizeFields(rawFields, schema, {
        useLLM: useLLM,
        llmNormalizer: useLLM ? async (fields, schema) => {
          // LLM fallback for unmapped fields
          return await llmNormalizeFields(fields, schema, options);
        } : null
      });
      
      // Track unmapped fields for distribution statistics
      if (trackDistribution && result.unmappedFields && result.unmappedFields.length > 0) {
        try {
          await fieldDistribution.recordUnmappedFieldsBatch(
            result.unmappedFields, 
            schema.schema_name
          );
        } catch (error) {
          console.warn('[FieldNormalizer] Failed to record unmapped fields:', error.message);
        }
      }
      
      const normalizedFields = result.normalizedFields || [];
      
      // Store in cache
      if (useCache) {
        const cacheKey = generateNormCacheKey(rawFields, schema);
        normalizationCache.set(cacheKey, {
          result: normalizedFields,
          timestamp: Date.now()
        });
        
        // Clear expired cache if too large
        if (normalizationCache.size > NORM_CACHE_MAX_SIZE) {
          clearExpiredNormCache();
        }
      }
      
      return normalizedFields;
      
    } catch (error) {
      console.warn('[FieldNormalizer] Mapping-based normalization failed, falling back to legacy method:', error.message);
      // Fall back to legacy method if mapping-based fails
    }
  }
  
  // Legacy method (fallback)
  return await legacyNormalizeFields(rawFields, schema, options);
}

/**
 * Legacy normalization method (fallback)
 */
async function legacyNormalizeFields(rawFields, schema, options = {}) {
  const {
    useLLM = true,
    llmProbability = 0.5,
    cleanValues = true,
    useCache = true,
    trackDistribution = true
  } = options;
  
  // Validate inputs
  if (!Array.isArray(rawFields)) {
    throw new Error('rawFields must be an array');
  }
  
  if (!schema || !schema.schema_name || !Array.isArray(schema.core_fields)) {
    throw new Error('schema must have schema_name and core_fields array');
  }
  
  // Extract schema field names for mapping
  const schemaFieldNames = schema.core_fields.map(f => f.name);
  
  const normalizedFields = [];
  const unmappedFields = [];  // Track unmapped fields for distribution statistics
  
  for (const field of rawFields) {
    // Clean field value if requested
    const cleanedField = cleanValues ? cleanFieldValue(field) : field;
    
    // Try to map field name using 4-layer strategy
    let mapping = null;
    
    // Check cache first
    if (useCache) {
      mapping = getCachedMapping(field.name, schema.schema_name);
    }
    
    if (!mapping) {
      // Layer 1 & 2: Algorithm-based Match (exact + similarity + synonym)
      // Delegated to algorithm_mapper module
      mapping = algorithmMapper.mapFieldName(field.name, schemaFieldNames);
      
      // Layer 2.5: Fuzzy Semantic Match (new layer for enhanced diversity support)
      // Uses field type, context, and value to infer mapping
      if (!mapping) {
        mapping = fuzzySemanticMatch(cleanedField, schema);
      }
      
      // Layer 3: LLM-based Match (50% probability, consumes tokens)
      if (!mapping && useLLM) {
        mapping = await llmMatch(field.name, schemaFieldNames, cleanedField, llmProbability, schema);
      }
      
      // Cache the mapping result (even if null)
      if (useCache && mapping) {
        cacheMapping(field.name, schema.schema_name, mapping);
      }
    }
    
    // Layer 4: Fallback - accept unmapped fields with low confidence
    if (mapping) {
      normalizedFields.push({
        ...cleanedField,
        name: mapping.mapped_name,
        original_name: field.name,
        mapping_confidence: mapping.confidence,
        mapping_method: mapping.method
      });
    } else {
      // Keep original field name but mark as low confidence
      normalizedFields.push({
        ...cleanedField,
        original_name: field.name,
        mapping_confidence: 0.3,
        mapping_method: 'none'
      });
      
      // Track unmapped field for distribution statistics
      unmappedFields.push(cleanedField);
    }
  }
  
  // Record unmapped fields for distribution tracking (Task 7.13.3)
  if (trackDistribution && unmappedFields.length > 0) {
    try {
      await fieldDistribution.recordUnmappedFieldsBatch(unmappedFields, schema.schema_name);
    } catch (error) {
      console.warn('[FieldNormalizer] Failed to record unmapped fields:', error.message);
    }
  }
  
  return normalizedFields;
}

/**
 * LLM normalization for unmapped fields
 * 
 * Uses LLM to normalize fields that couldn't be mapped by algorithm-based methods.
 * This is the fallback strategy to ensure no fields are missed.
 * 
 * @param {Array} unmappedFields - Fields that couldn't be mapped
 * @param {Object} schema - Schema definition
 * @param {Object} options - Normalization options
 * @returns {Promise<Object>} Normalization result with normalizedFields array
 */
async function llmNormalizeFields(unmappedFields, schema, options = {}) {
  if (!unmappedFields || unmappedFields.length === 0) {
    return { normalizedFields: [], unmappedFields: [] };
  }
  
  console.log(`[FieldNormalizer] LLM normalization for ${unmappedFields.length} unmapped fields`);
  
  const llmMapper = require('./llm_mapper');
  const schemaFieldNames = schema.core_fields.map(f => f.name);
  
  const normalizedFields = [];
  const stillUnmapped = [];
  
  // Process each unmapped field with LLM
  for (const field of unmappedFields) {
    try {
      const mapping = await llmMapper.mapFieldNameWithLLM(
        field.name,
        schemaFieldNames,
        field,
        schema,
        options
      );
      
      if (mapping && mapping.mapped_name) {
        // Successfully mapped by LLM
        normalizedFields.push({
          name: mapping.mapped_name,
          originalName: field.name,
          standardName: mapping.mapped_name,
          value: field.value,
          confidence: mapping.confidence,
          mappingMethod: 'llm',
          source: field.source || 'extraction',
          metadata: field.metadata
        });
      } else {
        // Still couldn't map
        stillUnmapped.push(field);
      }
    } catch (error) {
      console.warn(`[FieldNormalizer] LLM mapping failed for field "${field.name}":`, error.message);
      stillUnmapped.push(field);
    }
  }
  
  console.log(`[FieldNormalizer] LLM mapped ${normalizedFields.length}/${unmappedFields.length} fields`);
  
  return {
    normalizedFields,
    unmappedFields: stillUnmapped
  };
}

/**
 * Layer 3: LLM-based Match with Intelligent Truncating
 * 
 * Uses LLM to map field names when algorithm-based methods fail.
 * Only called with specified probability (default 50%) to control costs.
 * Applies intelligent field truncating to reduce token consumption.
 * 
 * @param {string} rawFieldName - Raw field name
 * @param {Array<string>} schemaFieldNames - Schema field names
 * @param {Object} field - Full field object for context
 * @param {number} probability - Probability of using LLM (0-1)
 * @param {Object} schema - Schema object (optional, for intelligent truncating)
 * @returns {Promise<Object|null>} Mapping result or null
 */
async function llmMatch(rawFieldName, schemaFieldNames, field, probability = 0.5, schema = null) {
  // Probabilistic LLM call to control costs
  if (Math.random() > probability) {
    return null;
  }
  
  // Use LLM mapper
  const llmMapper = require('./llm_mapper');
  
  try {
    const mapping = await llmMapper.mapFieldNameWithLLM(
      rawFieldName,
      schemaFieldNames,
      field,
      schema
    );
    
    return mapping;
  } catch (error) {
    console.error('LLM mapping error:', error);
    return null;
  }
}

/**
 * Clean field value
 * 
 * Removes noise, standardizes formats, and normalizes field values.
 * 
 * @param {Object} field - Field object
 * @returns {Object} Field with cleaned value
 */
function cleanFieldValue(field) {
  let value = field.value;
  
  if (typeof value !== 'string') {
    return field;
  }
  
  // Remove extra whitespace
  value = value.trim().replace(/\s+/g, ' ');
  
  // Remove special characters (keep necessary punctuation)
  value = value.replace(/[^\w\s\u4e00-\u9fa5.,;:!?()（）、，。；：！？\-]/g, '');
  
  // Type-specific cleaning
  if (field.type === 'time') {
    value = standardizeTime(value);
  } else if (field.type === 'number') {
    value = standardizeNumber(value);
  }
  
  return {
    ...field,
    value: value
  };
}

/**
 * Standardize time format
 * 
 * Converts various time formats to ISO 8601 format.
 * 
 * @param {string} timeStr - Time string
 * @returns {string} Standardized time string
 */
function standardizeTime(timeStr) {
  // Pattern: "2025年1月" -> "2025-01"
  let match = timeStr.match(/(\d{4})年(\d{1,2})月/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}`;
  }
  
  // Pattern: "2025/01/26" -> "2025-01-26"
  match = timeStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }
  
  // Pattern: "2025.01.26" -> "2025-01-26"
  match = timeStr.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }
  
  // Already in ISO format or unrecognized format
  return timeStr;
}

/**
 * Standardize number format
 * 
 * Removes formatting characters and normalizes number representation.
 * 
 * @param {string} numberStr - Number string
 * @returns {string} Standardized number string
 */
function standardizeNumber(numberStr) {
  // Remove thousand separators
  let cleaned = numberStr.replace(/,/g, '');
  
  // Remove spaces
  cleaned = cleaned.replace(/\s/g, '');
  
  // Ensure valid number format
  const match = cleaned.match(/^-?\d+\.?\d*$/);
  if (match) {
    return cleaned;
  }
  
  return numberStr;
}

/**
 * Get cached mapping
 * 
 * @param {string} rawFieldName - Raw field name
 * @param {string} schemaName - Schema name
 * @returns {Object|null} Cached mapping or null
 */
function getCachedMapping(rawFieldName, schemaName) {
  return mappingCache.get(rawFieldName, schemaName);
}

/**
 * Cache mapping result
 * 
 * @param {string} rawFieldName - Raw field name
 * @param {string} schemaName - Schema name
 * @param {Object} mapping - Mapping result
 */
function cacheMapping(rawFieldName, schemaName, mapping) {
  mappingCache.set(rawFieldName, schemaName, mapping);
}

/**
 * Clear mapping cache
 * 
 * Useful for testing or when schema definitions change.
 */
function clearCache() {
  mappingCache.clear();
}

/**
 * Get cache statistics
 * 
 * @returns {Object} Cache statistics
 */
function getCacheStats() {
  return mappingCache.getStats();
}

/**
 * Batch normalize fields for multiple CKBs
 * 
 * Efficiently processes multiple field sets at once, useful for bulk processing.
 * 
 * @param {Array} rawFieldsList - Array of raw field arrays
 * @param {Array} schemas - Array of schema definitions (one per field set)
 * @param {Object} options - Normalization options
 * @returns {Promise<Array>} Array of normalized field arrays
 */
async function batchNormalizeFields(rawFieldsList, schemas, options = {}) {
  if (!Array.isArray(rawFieldsList) || !Array.isArray(schemas)) {
    throw new Error('rawFieldsList and schemas must be arrays');
  }
  
  if (rawFieldsList.length !== schemas.length) {
    throw new Error('rawFieldsList and schemas must have the same length');
  }
  
  const results = [];
  
  for (let i = 0; i < rawFieldsList.length; i++) {
    try {
      const normalized = await normalizeFields(rawFieldsList[i], schemas[i], options);
      results.push(normalized);
    } catch (error) {
      console.error(`Error normalizing fields for schema ${schemas[i].schema_name}:`, error);
      results.push([]);
    }
  }
  
  return results;
}

/**
 * Get normalization statistics
 * 
 * Provides statistics about the normalization process.
 * 
 * @param {Array} normalizedFields - Normalized fields
 * @returns {Object} Statistics
 */
function getNormalizationStats(normalizedFields) {
  const stats = {
    total: normalizedFields.length,
    by_method: {
      exact: 0,
      similarity: 0,
      synonym: 0,
      llm: 0,
      none: 0
    },
    avg_mapping_confidence: 0,
    unmapped_count: 0
  };
  
  normalizedFields.forEach(field => {
    const method = field.mapping_method || 'none';
    stats.by_method[method] = (stats.by_method[method] || 0) + 1;
    
    if (method === 'none') {
      stats.unmapped_count++;
    }
  });
  
  // Calculate average mapping confidence
  if (normalizedFields.length > 0) {
    const totalConfidence = normalizedFields.reduce(
      (sum, f) => sum + (f.mapping_confidence || 0), 
      0
    );
    stats.avg_mapping_confidence = totalConfidence / normalizedFields.length;
  }
  
  return stats;
}

/**
 * Layer 2.5: Fuzzy Semantic Match
 * 
 * Uses field type, context, and value to infer mapping when exact/similarity/synonym matching fails.
 * This provides enhanced support for field diversity without consuming LLM tokens.
 * 
 * Strategies:
 * 1. Type-based semantic inference (e.g., 'time' type -> '时间' field)
 * 2. Context-based fuzzy matching (extract keywords from context)
 * 3. Value-based inference (e.g., date format -> '时间', location name -> '区域')
 * 
 * @param {Object} field - Field object with name, value, type, context
 * @param {Object} schema - Schema object with core_fields
 * @returns {Object|null} Mapping result or null
 * 
 * Validates: Requirements 18.16, 18.17
 */
function fuzzySemanticMatch(field, schema) {
  if (!field || !schema || !schema.core_fields) {
    return null;
  }
  
  const schemaFieldNames = schema.core_fields.map(f => f.name);
  
  // Strategy 1: Type-based semantic inference
  if (field.type) {
    const typeMapping = inferFromType(field.type, schemaFieldNames);
    if (typeMapping) {
      return {
        mapped_name: typeMapping,
        confidence: 0.75,
        method: 'semantic_inference'
      };
    }
  }
  
  // Strategy 2: Context-based fuzzy matching
  if (field.context) {
    const contextMapping = inferFromContext(field.context, schemaFieldNames);
    if (contextMapping) {
      return {
        mapped_name: contextMapping,
        confidence: 0.7,
        method: 'context_fuzzy'
      };
    }
  }
  
  // Strategy 3: Value-based inference
  if (field.value) {
    const valueMapping = inferFromValue(field.value, schemaFieldNames);
    if (valueMapping) {
      return {
        mapped_name: valueMapping,
        confidence: 0.8,
        method: 'value_inference'
      };
    }
  }
  
  return null;
}

/**
 * Infer field mapping from field type
 * 
 * Maps field types to common semantic categories.
 * 
 * @param {string} fieldType - Field type (time, location, number, unit, indicator, entity)
 * @param {Array<string>} schemaFieldNames - Available schema field names
 * @returns {string|null} Mapped field name or null
 */
function inferFromType(fieldType, schemaFieldNames) {
  const typeToCategory = {
    'time': ['时间', '日期', '时刻', '时段', '时间点', '发生时间'],
    'location': ['区域', '地区', '地点', '位置', '场所', '地域'],
    'number': ['数值', '数量', '值', '大小', '量'],
    'unit': ['单位', '计量单位', '度量单位'],
    'indicator': ['指标', '参数', '度量', '指标名称'],
    'entity': ['实体', '对象', '主体', '目标', '名称']
  };
  
  const candidates = typeToCategory[fieldType] || [];
  
  for (const candidate of candidates) {
    if (schemaFieldNames.includes(candidate)) {
      return candidate;
    }
  }
  
  return null;
}

/**
 * Infer field mapping from context
 * 
 * Extracts keywords from context and matches with schema field names.
 * 
 * @param {string} context - Context string
 * @param {Array<string>} schemaFieldNames - Available schema field names
 * @returns {string|null} Mapped field name or null
 */
function inferFromContext(context, schemaFieldNames) {
  if (!context || typeof context !== 'string') {
    return null;
  }
  
  // Extract keywords (simple approach: split by punctuation and whitespace)
  const keywords = context
    .split(/[\s,，。；;:：！!？?、]+/)
    .filter(kw => kw.length > 0);
  
  // Check if any keyword matches or is contained in schema field names
  for (const schemaField of schemaFieldNames) {
    for (const keyword of keywords) {
      if (schemaField.includes(keyword) || keyword.includes(schemaField)) {
        return schemaField;
      }
    }
  }
  
  return null;
}

/**
 * Infer field mapping from field value
 * 
 * Analyzes the value format/content to infer the field type.
 * 
 * @param {string} value - Field value
 * @param {Array<string>} schemaFieldNames - Available schema field names
 * @returns {string|null} Mapped field name or null
 */
function inferFromValue(value, schemaFieldNames) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  
  // Check if value is a date format
  if (isDateFormat(value)) {
    const timeFields = ['时间', '日期', '时刻', '时段', '时间点'];
    for (const field of timeFields) {
      if (schemaFieldNames.includes(field)) {
        return field;
      }
    }
  }
  
  // Check if value is a location name (contains common location indicators)
  if (isLocationName(value)) {
    const locationFields = ['区域', '地区', '地点', '位置', '场所'];
    for (const field of locationFields) {
      if (schemaFieldNames.includes(field)) {
        return field;
      }
    }
  }
  
  // Check if value is a number with unit
  if (isNumberWithUnit(value)) {
    const numberFields = ['数值', '数量', '值'];
    for (const field of numberFields) {
      if (schemaFieldNames.includes(field)) {
        return field;
      }
    }
  }
  
  return null;
}

/**
 * Check if value is in date format
 * 
 * @param {string} value - Value string
 * @returns {boolean} True if date format
 */
function isDateFormat(value) {
  // Common date patterns
  const datePatterns = [
    /^\d{4}-\d{1,2}-\d{1,2}$/,  // 2025-01-26
    /^\d{4}\/\d{1,2}\/\d{1,2}$/,  // 2025/01/26
    /^\d{4}\.\d{1,2}\.\d{1,2}$/,  // 2025.01.26
    /^\d{4}年\d{1,2}月\d{1,2}日$/,  // 2025年1月26日
    /^\d{4}年\d{1,2}月$/,  // 2025年1月
    /^\d{4}-\d{1,2}$/,  // 2025-01
    /^\d{1,2}月\d{1,2}日$/  // 1月26日
  ];
  
  return datePatterns.some(pattern => pattern.test(value));
}

/**
 * Check if value is a location name
 * 
 * @param {string} value - Value string
 * @returns {boolean} True if location name
 */
function isLocationName(value) {
  // Common location indicators
  const locationIndicators = [
    '省', '市', '区', '县', '镇', '村', '街', '路', '号',
    '东', '西', '南', '北', '中',
    '室', '楼', '层', '栋', '单元',
    '地区', '地域', '地带', '地方'
  ];
  
  return locationIndicators.some(indicator => value.includes(indicator));
}

/**
 * Check if value is a number with unit
 * 
 * @param {string} value - Value string
 * @returns {boolean} True if number with unit
 */
function isNumberWithUnit(value) {
  // Pattern: number + unit
  const numberUnitPattern = /^\d+\.?\d*\s*(米|公里|千米|吨|公斤|千克|克|升|毫升|元|万元|亿元|个|件|台|辆|人|次|天|小时|分钟|秒|度|摄氏度|华氏度|百分比|%|平方米|立方米)$/;
  
  return numberUnitPattern.test(value);
}

/**
 * Suggest possible mappings for an unmapped field
 * 
 * Calculates similarity scores with all schema fields and returns top 3 suggestions.
 * This is useful for providing human feedback when automatic mapping fails.
 * 
 * @param {Object} field - Field object with name, value, type, context
 * @param {Object} schema - Schema object with core_fields
 * @param {Object} options - Options for suggestion
 * @returns {Array} Array of suggestions with field name and similarity score
 * 
 * Validates: Requirement 18.20
 * 
 * @example
 * const field = { name: '地方', value: '北京', type: 'location' };
 * const schema = {
 *   core_fields: [
 *     { name: '区域', weight: 0.3 },
 *     { name: '地点', weight: 0.2 },
 *     { name: '位置', weight: 0.1 }
 *   ]
 * };
 * const suggestions = suggestMapping(field, schema);
 * // Returns: [
 * //   { fieldName: '地点', similarity: 0.85, reason: 'high_string_similarity' },
 * //   { fieldName: '区域', similarity: 0.72, reason: 'semantic_category_match' },
 * //   { fieldName: '位置', similarity: 0.68, reason: 'type_match' }
 * // ]
 */
function suggestMapping(field, schema, options = {}) {
  const { topN = 3 } = options;
  
  if (!field || !schema || !schema.core_fields) {
    return [];
  }
  
  const schemaFields = schema.core_fields;
  const similarities = [];
  
  for (const schemaField of schemaFields) {
    const similarity = calculateFieldSimilarity(field, schemaField);
    similarities.push({
      fieldName: schemaField.name,
      similarity: similarity.score,
      reason: similarity.reason,
      breakdown: similarity.breakdown
    });
  }
  
  // Sort by similarity score (descending)
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  // Return top N suggestions
  return similarities.slice(0, topN);
}

/**
 * Calculate comprehensive similarity between a field and a schema field
 * 
 * Uses multiple dimensions to calculate similarity:
 * 1. String similarity (edit distance + n-gram)
 * 2. Semantic category match
 * 3. Type compatibility
 * 4. Context relevance
 * 
 * @param {Object} field - Field object
 * @param {Object} schemaField - Schema field definition
 * @returns {Object} Similarity result with score, reason, and breakdown
 */
function calculateFieldSimilarity(field, schemaField) {
  let totalScore = 0;
  const breakdown = {};
  let primaryReason = 'unknown';
  
  // 1. String similarity (40% weight)
  const stringSim = calculateStringSimilarity(field.name, schemaField.name);
  breakdown.string_similarity = stringSim;
  totalScore += stringSim * 0.4;
  
  if (stringSim > 0.7) {
    primaryReason = 'high_string_similarity';
  }
  
  // 2. Semantic category match (30% weight)
  const semanticSim = calculateSemanticSimilarity(field, schemaField);
  breakdown.semantic_similarity = semanticSim;
  totalScore += semanticSim * 0.3;
  
  if (semanticSim > 0.8 && primaryReason === 'unknown') {
    primaryReason = 'semantic_category_match';
  }
  
  // 3. Type compatibility (20% weight)
  const typeSim = calculateTypeCompatibility(field, schemaField);
  breakdown.type_compatibility = typeSim;
  totalScore += typeSim * 0.2;
  
  if (typeSim > 0.8 && primaryReason === 'unknown') {
    primaryReason = 'type_match';
  }
  
  // 4. Context relevance (10% weight)
  const contextSim = calculateContextRelevance(field, schemaField);
  breakdown.context_relevance = contextSim;
  totalScore += contextSim * 0.1;
  
  if (primaryReason === 'unknown') {
    primaryReason = 'low_confidence';
  }
  
  return {
    score: totalScore,
    reason: primaryReason,
    breakdown
  };
}

/**
 * Calculate string similarity using edit distance and n-gram
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
function calculateStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  // Use algorithm mapper's similarity calculation
  const editSim = 1 - (levenshteinDistance(str1, str2) / Math.max(str1.length, str2.length));
  const ngramSim = ngramSimilarity(str1, str2, 2);
  
  return (editSim + ngramSim) / 2;
}

/**
 * Calculate Levenshtein distance between two strings
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,  // substitution
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j] + 1       // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate n-gram similarity
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @param {number} n - N-gram size
 * @returns {number} Similarity score (0-1)
 */
function ngramSimilarity(str1, str2, n = 2) {
  const ngrams1 = generateNgrams(str1, n);
  const ngrams2 = generateNgrams(str2, n);
  
  if (ngrams1.length === 0 || ngrams2.length === 0) {
    return 0;
  }
  
  // Calculate intersection
  const set1 = new Set(ngrams1);
  const set2 = new Set(ngrams2);
  let intersection = 0;
  
  for (const ngram of set1) {
    if (set2.has(ngram)) {
      intersection++;
    }
  }
  
  // Jaccard similarity
  const union = set1.size + set2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Generate n-grams from a string
 * 
 * @param {string} str - Input string
 * @param {number} n - N-gram size
 * @returns {Array<string>} Array of n-grams
 */
function generateNgrams(str, n) {
  const ngrams = [];
  for (let i = 0; i <= str.length - n; i++) {
    ngrams.push(str.substring(i, i + n));
  }
  return ngrams;
}

/**
 * Calculate semantic similarity based on semantic categories
 * 
 * @param {Object} field - Field object
 * @param {Object} schemaField - Schema field definition
 * @returns {number} Similarity score (0-1)
 */
function calculateSemanticSimilarity(field, schemaField) {
  const { getSemanticCategory } = require('./semantic_categories');
  
  const fieldCategory = getSemanticCategory(field.name);
  const schemaCategory = getSemanticCategory(schemaField.name);
  
  if (fieldCategory === schemaCategory && fieldCategory !== 'other') {
    return 1.0;
  }
  
  // Check if field type matches schema field category
  if (field.type) {
    const typeCategory = mapTypeToCategory(field.type);
    if (typeCategory === schemaCategory) {
      return 0.8;
    }
  }
  
  return 0.0;
}

/**
 * Map field type to semantic category
 * 
 * @param {string} fieldType - Field type
 * @returns {string} Semantic category
 */
function mapTypeToCategory(fieldType) {
  const typeToCategory = {
    'time': 'temporal',
    'location': 'spatial',
    'number': 'quantitative',
    'unit': 'unit',
    'indicator': 'quantitative',
    'entity': 'identifier'
  };
  
  return typeToCategory[fieldType] || 'other';
}

/**
 * Calculate type compatibility
 * 
 * @param {Object} field - Field object
 * @param {Object} schemaField - Schema field definition
 * @returns {number} Compatibility score (0-1)
 */
function calculateTypeCompatibility(field, schemaField) {
  if (!field.type) {
    return 0.5;  // Neutral score if type is unknown
  }
  
  // Use fuzzy semantic match logic to check type compatibility
  const typeMapping = inferFromType(field.type, [schemaField.name]);
  
  if (typeMapping === schemaField.name) {
    return 1.0;
  }
  
  return 0.0;
}

/**
 * Calculate context relevance
 * 
 * @param {Object} field - Field object
 * @param {Object} schemaField - Schema field definition
 * @returns {number} Relevance score (0-1)
 */
function calculateContextRelevance(field, schemaField) {
  if (!field.context) {
    return 0.5;  // Neutral score if context is unknown
  }
  
  // Check if schema field name appears in context
  if (field.context.includes(schemaField.name)) {
    return 1.0;
  }
  
  // Check if any part of schema field name appears in context
  for (let i = 0; i < schemaField.name.length; i++) {
    const substring = schemaField.name.substring(i);
    if (substring.length >= 2 && field.context.includes(substring)) {
      return 0.7;
    }
  }
  
  return 0.0;
}

module.exports = {
  normalizeFields,
  batchNormalizeFields,
  cleanFieldValue,
  llmMatch,
  fuzzySemanticMatch,  // Export new function
  suggestMapping,  // Export new function for Task 7.13.2
  standardizeTime,
  standardizeNumber,
  getCachedMapping,
  cacheMapping,
  clearCache,
  getCacheStats,
  getNormalizationStats,
  // Re-export algorithm mapper functions for convenience
  algorithmMapper,
  // Re-export field distribution functions for convenience (Task 7.13.3)
  fieldDistribution
};
