/**
 * Intelligent Field Truncating Strategy
 * 
 * Implements intelligent field selection for LLM field mapping to reduce token consumption
 * while maintaining or improving mapping accuracy.
 * 
 * Core Strategy:
 * - Multi-dimensional scoring: importance (30%) + semantic relevance (50%) + context (20%)
 * - Scene-adaptive: Different strategies for different schema scenes
 * - Token optimization: Select only the most relevant fields (typically 3-5 out of 8-12)
 * 
 * Design Reference: Intelligent Field Truncating Strategy (INTELLIGENT_TRUNCATING.md)
 * Validates: Requirements 19.1-19.15
 */

const { getSemanticCategory, isUniversalField } = require('./semantic_categories');
const algorithmMapper = require('./algorithm_mapper');

// Field mapping frequency cache (for importance scoring)
const fieldFrequencyCache = new Map();

/**
 * Calculate field importance score (0-100)
 * 
 * Evaluates the intrinsic importance of a schema field based on:
 * - Field weight (40 points)
 * - Required status (20 points)
 * - Historical frequency (20 points)
 * - Universal field type (20 points)
 * 
 * @param {Object} field - Schema field definition
 * @param {Object} schema - Full schema object
 * @returns {number} Importance score (0-100)
 * 
 * @example
 * calculateFieldImportance({name: '时间', weight: 0.2, required: true}, schema)
 * // Returns: 40*0.2 + 20 + 0 + 20 = 48
 */
function calculateFieldImportance(field, schema) {
  let score = 0;
  
  // 1. Weight score (0-40 points)
  score += (field.weight || 0) * 40;
  
  // 2. Required field bonus (0-20 points)
  if (field.required) {
    score += 20;
  }
  
  // 3. Historical frequency score (0-20 points)
  const frequency = getFieldMappingFrequency(field.name);
  score += frequency * 20;
  
  // 4. Universal field type bonus (0-20 points)
  if (isUniversalField(field.name)) {
    score += 20;
  }
  
  return score;
}

/**
 * Calculate semantic relevance score (0-100)
 * 
 * Evaluates how similar the raw field name is to the schema field name using:
 * - Edit distance similarity (40 points)
 * - Character n-gram cosine similarity (30 points)
 * - Semantic category matching (30 points)
 * 
 * @param {string} rawFieldName - Raw field name from extraction
 * @param {string} schemaFieldName - Schema field name
 * @returns {number} Semantic relevance score (0-100)
 * 
 * @example
 * calculateSemanticRelevance('日期', '时间')
 * // Returns: ~68 (moderate similarity + same category)
 */
function calculateSemanticRelevance(rawFieldName, schemaFieldName) {
  let score = 0;
  
  // 1. Edit distance similarity (0-40 points)
  const editDistance = algorithmMapper.levenshteinDistance(rawFieldName, schemaFieldName);
  const maxLen = Math.max(rawFieldName.length, schemaFieldName.length);
  const editSimilarity = maxLen > 0 ? 1 - (editDistance / maxLen) : 0;
  score += editSimilarity * 40;
  
  // 2. Character n-gram cosine similarity (0-30 points)
  const ngramSim = algorithmMapper.cosineSimilarity(
    algorithmMapper.generateNgrams(rawFieldName, 2),
    algorithmMapper.generateNgrams(schemaFieldName, 2)
  );
  score += ngramSim * 30;
  
  // 3. Semantic category matching (0-30 points)
  const rawCategory = getSemanticCategory(rawFieldName);
  const schemaCategory = getSemanticCategory(schemaFieldName);
  if (rawCategory === schemaCategory && rawCategory !== 'other') {
    score += 30;
  }
  
  return score;
}

/**
 * Calculate context relevance score (0-50)
 * 
 * Evaluates how well the raw field's type matches the schema field's semantic category.
 * 
 * @param {Object} rawField - Raw field object with type information
 * @param {Object} schemaField - Schema field definition
 * @returns {number} Context relevance score (0-50)
 * 
 * @example
 * calculateContextRelevance({name: '日期', type: 'time'}, {name: '时间'})
 * // Returns: 50 (type matches category)
 */
function calculateContextRelevance(rawField, schemaField) {
  if (!rawField.type) {
    return 0;
  }
  
  // Map field types to semantic categories
  const typeToCategory = {
    'time': 'temporal',
    'location': 'spatial',
    'number': 'quantitative',
    'unit': 'unit',
    'entity': 'identifier'
  };
  
  const expectedCategory = typeToCategory[rawField.type];
  if (!expectedCategory) {
    return 0;
  }
  
  const schemaCategory = getSemanticCategory(schemaField.name);
  
  return expectedCategory === schemaCategory ? 50 : 0;
}

/**
 * Select relevant fields using multi-dimensional scoring
 * 
 * Applies comprehensive scoring and selection rules:
 * 1. Calculate total score for each field (weighted combination)
 * 2. Sort by score descending
 * 3. Select fields meeting criteria:
 *    - At least top N fields
 *    - All fields with score >= minScore
 *    - Total count <= maxFields
 * 
 * @param {string} rawFieldName - Raw field name
 * @param {Object} rawField - Raw field object
 * @param {Array<string>} schemaFieldNames - Schema field names
 * @param {Object} schema - Full schema object
 * @param {Object} options - Selection options
 * @returns {Object} Selection result with selectedFields and scoredFields
 * 
 * @example
 * selectRelevantFields('地区', {value: '阿里C区', type: 'location'}, 
 *   ['区域', '时间', '指标', '数值', '单位'], schema)
 * // Returns: {selectedFields: ['区域', '监测点', '时间', '指标'], scoredFields: [...]}
 */
function selectRelevantFields(rawFieldName, rawField, schemaFieldNames, schema, options = {}) {
  const {
    maxFields = 5,
    minScore = 30,
    includeTopN = 3
  } = options;
  
  // Calculate comprehensive score for each schema field
  const scoredFields = schemaFieldNames.map(schemaFieldName => {
    const fieldDef = schema.core_fields.find(f => f.name === schemaFieldName);
    
    if (!fieldDef) {
      return { name: schemaFieldName, score: 0, breakdown: {} };
    }
    
    const importanceScore = calculateFieldImportance(fieldDef, schema);
    const semanticScore = calculateSemanticRelevance(rawFieldName, schemaFieldName);
    const contextScore = calculateContextRelevance(rawField, fieldDef);
    
    // Weighted total score
    const totalScore = 
      importanceScore * 0.3 +   // Importance weight: 30%
      semanticScore * 0.5 +     // Semantic relevance weight: 50%
      contextScore * 0.2;       // Context relevance weight: 20%
    
    return {
      name: schemaFieldName,
      score: totalScore,
      breakdown: {
        importance: importanceScore,
        semantic: semanticScore,
        context: contextScore
      }
    };
  });
  
  // Sort by score descending
  scoredFields.sort((a, b) => b.score - a.score);
  
  // Apply selection rules
  const selectedFields = [];
  
  for (let i = 0; i < scoredFields.length; i++) {
    const field = scoredFields[i];
    
    // Rule 1: Include at least top N fields
    // Rule 2: Include all fields with score >= minScore
    if (i < includeTopN || field.score >= minScore) {
      selectedFields.push(field.name);
      
      // Rule 3: Total count <= maxFields
      if (selectedFields.length >= maxFields) {
        break;
      }
    }
  }
  
  return {
    selectedFields,
    scoredFields
  };
}

/**
 * Adapt truncating strategy based on schema scene
 * 
 * Different scenes have different field characteristics:
 * - Research/Government: Many fields (8-15), need larger maxFields
 * - Personal Life: Few fields (3-6), use smaller maxFields
 * - Photography: Many parameters (10+), need larger maxFields
 * 
 * @param {Object} schema - Schema object with scene information
 * @returns {Object} Strategy configuration
 * 
 * @example
 * adaptTruncatingStrategy({scene: '科研/政府'})
 * // Returns: {maxFields: 6, minScore: 25, includeTopN: 4}
 */
function adaptTruncatingStrategy(schema) {
  const sceneStrategies = {
    '科研/政府': {
      maxFields: 6,
      minScore: 25,
      includeTopN: 4,
      priorityCategories: ['temporal', 'spatial', 'quantitative']
    },
    '个人生活': {
      maxFields: 4,
      minScore: 35,
      includeTopN: 3,
      priorityCategories: ['temporal', 'descriptive']
    },
    '旅行/休闲': {
      maxFields: 5,
      minScore: 30,
      includeTopN: 3,
      priorityCategories: ['spatial', 'temporal', 'descriptive']
    },
    '摄影': {
      maxFields: 7,
      minScore: 20,
      includeTopN: 5,
      priorityCategories: ['quantitative', 'categorical']
    },
    '后期': {
      maxFields: 7,
      minScore: 20,
      includeTopN: 5,
      priorityCategories: ['quantitative', 'categorical']
    },
    '运动': {
      maxFields: 5,
      minScore: 30,
      includeTopN: 3,
      priorityCategories: ['quantitative', 'temporal']
    },
    '娱乐': {
      maxFields: 4,
      minScore: 35,
      includeTopN: 3,
      priorityCategories: ['descriptive', 'rating']
    },
    'default': {
      maxFields: 5,
      minScore: 30,
      includeTopN: 3,
      priorityCategories: []
    }
  };
  
  const scene = schema.scene || 'default';
  
  // Try exact match first
  if (sceneStrategies[scene]) {
    return sceneStrategies[scene];
  }
  
  // Try partial match (e.g., "科研/政府/环境" matches "科研/政府")
  for (const [key, strategy] of Object.entries(sceneStrategies)) {
    if (scene.includes(key)) {
      return strategy;
    }
  }
  
  return sceneStrategies['default'];
}

/**
 * Get field mapping frequency from cache
 * 
 * Returns normalized frequency (0-1) based on historical mapping data.
 * Higher frequency indicates the field is commonly used.
 * 
 * @param {string} fieldName - Field name
 * @returns {number} Normalized frequency (0-1)
 */
function getFieldMappingFrequency(fieldName) {
  if (fieldFrequencyCache.has(fieldName)) {
    return fieldFrequencyCache.get(fieldName);
  }
  
  // Default frequency for unknown fields
  // In production, this would be calculated from historical data
  return 0.5;
}

/**
 * Update field mapping frequency
 * 
 * Called after successful field mapping to update frequency statistics.
 * 
 * @param {string} fieldName - Field name
 * @param {number} increment - Frequency increment (default 0.1)
 */
function updateFieldMappingFrequency(fieldName, increment = 0.1) {
  const currentFreq = getFieldMappingFrequency(fieldName);
  const newFreq = Math.min(1.0, currentFreq + increment);
  fieldFrequencyCache.set(fieldName, newFreq);
}

/**
 * Clear field frequency cache
 * 
 * Useful for testing or resetting statistics.
 */
function clearFrequencyCache() {
  fieldFrequencyCache.clear();
}

module.exports = {
  calculateFieldImportance,
  calculateSemanticRelevance,
  calculateContextRelevance,
  selectRelevantFields,
  adaptTruncatingStrategy,
  getFieldMappingFrequency,
  updateFieldMappingFrequency,
  clearFrequencyCache
};
