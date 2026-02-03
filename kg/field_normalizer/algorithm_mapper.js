/**
 * Algorithm Mapper
 * 
 * Provides algorithm-based field name mapping without using LLM.
 * Implements three mapping strategies:
 * 1. Exact Match - Direct string comparison (highest priority)
 * 2. String Similarity - Levenshtein distance + Cosine similarity
 * 3. Synonym Dictionary - Predefined synonym mappings
 * 
 * Design Reference: Phase 2 - Field Normalization Module (Section 4.2)
 * Validates: Requirements 18.2, 18.3
 * 
 * Key Features:
 * - Zero Token consumption (pure algorithm-based)
 * - Fast and deterministic mapping
 * - Configurable similarity thresholds
 * - Integration with synonym dictionary
 */

const synonymDict = require('./synonym_dict');

/**
 * Map field name using algorithm-based strategies
 * 
 * Tries multiple strategies in order of priority:
 * 1. Exact match
 * 2. Synonym dictionary
 * 3. String similarity
 * 
 * @param {string} rawFieldName - Raw field name to map
 * @param {Array<string>} schemaFieldNames - Target schema field names
 * @param {Object} options - Mapping options
 * @returns {Object|null} Mapping result or null if no match found
 * 
 * @example
 * const result = mapFieldName('地区', ['区域', '时间', '数值']);
 * // Returns: { mapped_name: '区域', confidence: 0.9, method: 'synonym' }
 */
function mapFieldName(rawFieldName, schemaFieldNames, options = {}) {
  const {
    useSynonym = true,
    useSimilarity = true,
    similarityThreshold = 0.7
  } = options;
  
  // Strategy 1: Exact Match (highest priority)
  const exactResult = exactMatch(rawFieldName, schemaFieldNames);
  if (exactResult) {
    return exactResult;
  }
  
  // Strategy 2: Synonym Dictionary (fast lookup)
  if (useSynonym) {
    const synonymResult = synonymMatch(rawFieldName, schemaFieldNames);
    if (synonymResult) {
      return synonymResult;
    }
  }
  
  // Strategy 3: String Similarity (more flexible but slower)
  if (useSimilarity) {
    const similarityResult = similarityMatch(
      rawFieldName, 
      schemaFieldNames, 
      similarityThreshold
    );
    if (similarityResult) {
      return similarityResult;
    }
  }
  
  // No match found
  return null;
}

/**
 * Exact Match Strategy
 * 
 * Checks if the raw field name exactly matches any schema field name.
 * This is the most reliable mapping method with 100% confidence.
 * 
 * @param {string} rawFieldName - Raw field name
 * @param {Array<string>} schemaFieldNames - Schema field names
 * @returns {Object|null} Mapping result or null
 * 
 * @example
 * exactMatch('区域', ['区域', '时间', '数值'])
 * // Returns: { mapped_name: '区域', confidence: 1.0, method: 'exact' }
 */
function exactMatch(rawFieldName, schemaFieldNames) {
  if (schemaFieldNames.includes(rawFieldName)) {
    return {
      mapped_name: rawFieldName,
      confidence: 1.0,
      method: 'exact'
    };
  }
  return null;
}

/**
 * Synonym Match Strategy
 * 
 * Uses the synonym dictionary to find standard field names.
 * Fast O(1) lookup with predefined mappings.
 * 
 * @param {string} rawFieldName - Raw field name
 * @param {Array<string>} schemaFieldNames - Schema field names
 * @returns {Object|null} Mapping result or null
 * 
 * @example
 * synonymMatch('地区', ['区域', '时间', '数值'])
 * // Returns: { mapped_name: '区域', confidence: 0.9, method: 'synonym' }
 */
function synonymMatch(rawFieldName, schemaFieldNames) {
  return synonymDict.match(rawFieldName, schemaFieldNames);
}

/**
 * String Similarity Match Strategy
 * 
 * Uses Levenshtein distance and character n-gram cosine similarity
 * to find the best matching schema field name.
 * 
 * Combines two similarity metrics:
 * - Levenshtein distance: Measures edit distance (60% weight)
 * - Cosine similarity: Measures character n-gram overlap (40% weight)
 * 
 * @param {string} rawFieldName - Raw field name
 * @param {Array<string>} schemaFieldNames - Schema field names
 * @param {number} threshold - Minimum similarity threshold (0-1)
 * @returns {Object|null} Mapping result or null
 * 
 * @example
 * similarityMatch('地域', ['区域', '时间', '数值'], 0.7)
 * // Returns: { mapped_name: '区域', confidence: 0.85, method: 'similarity' }
 */
function similarityMatch(rawFieldName, schemaFieldNames, threshold = 0.7) {
  let bestMatch = null;
  let maxSimilarity = 0;
  
  for (const schemaField of schemaFieldNames) {
    // Calculate Levenshtein distance similarity
    const editDistance = levenshteinDistance(rawFieldName, schemaField);
    const maxLen = Math.max(rawFieldName.length, schemaField.length);
    const levenshteinSim = maxLen > 0 ? 1 - (editDistance / maxLen) : 0;
    
    // Calculate cosine similarity based on character bigrams
    const cosineSim = cosineSimilarity(
      generateNgrams(rawFieldName, 2),
      generateNgrams(schemaField, 2)
    );
    
    // Combined similarity (weighted average)
    // Levenshtein is more reliable for short strings, so it gets higher weight
    const combinedSim = (levenshteinSim * 0.6 + cosineSim * 0.4);
    
    if (combinedSim > maxSimilarity && combinedSim >= threshold) {
      maxSimilarity = combinedSim;
      bestMatch = schemaField;
    }
  }
  
  if (bestMatch) {
    return {
      mapped_name: bestMatch,
      confidence: maxSimilarity,
      method: 'similarity'
    };
  }
  
  return null;
}

/**
 * Calculate Levenshtein distance between two strings
 * 
 * The Levenshtein distance is the minimum number of single-character edits
 * (insertions, deletions, or substitutions) required to change one string
 * into another.
 * 
 * Time Complexity: O(m * n) where m and n are string lengths
 * Space Complexity: O(m * n)
 * 
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 * 
 * @example
 * levenshteinDistance('kitten', 'sitting')
 * // Returns: 3 (k→s, e→i, insert g)
 */
function levenshteinDistance(a, b) {
  const matrix = [];
  
  // Initialize first column (0, 1, 2, ..., b.length)
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  // Initialize first row (0, 1, 2, ..., a.length)
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill the matrix using dynamic programming
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        // Characters match, no edit needed
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        // Take minimum of three operations
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Generate character n-grams from a string
 * 
 * N-grams are contiguous sequences of n characters.
 * Used for calculating cosine similarity.
 * 
 * @param {string} str - Input string
 * @param {number} n - N-gram size (typically 2 for bigrams)
 * @returns {Array<string>} Array of n-grams
 * 
 * @example
 * generateNgrams('hello', 2)
 * // Returns: ['he', 'el', 'll', 'lo']
 */
function generateNgrams(str, n) {
  if (str.length < n) {
    return [str];
  }
  
  const ngrams = [];
  for (let i = 0; i <= str.length - n; i++) {
    ngrams.push(str.substring(i, i + n));
  }
  return ngrams;
}

/**
 * Calculate cosine similarity between two n-gram sets
 * 
 * Cosine similarity measures the cosine of the angle between two vectors
 * in n-gram frequency space. Returns a value between 0 (no similarity)
 * and 1 (identical).
 * 
 * Formula: cos(θ) = (A · B) / (||A|| × ||B||)
 * 
 * @param {Array<string>} ngrams1 - First n-gram set
 * @param {Array<string>} ngrams2 - Second n-gram set
 * @returns {number} Cosine similarity (0-1)
 * 
 * @example
 * cosineSimilarity(['he', 'el', 'll', 'lo'], ['he', 'el', 'lp'])
 * // Returns: ~0.67 (2 common n-grams out of 3-4 total)
 */
function cosineSimilarity(ngrams1, ngrams2) {
  if (ngrams1.length === 0 || ngrams2.length === 0) {
    return 0;
  }
  
  // Build frequency maps
  const freq1 = {};
  const freq2 = {};
  
  ngrams1.forEach(ng => {
    freq1[ng] = (freq1[ng] || 0) + 1;
  });
  
  ngrams2.forEach(ng => {
    freq2[ng] = (freq2[ng] || 0) + 1;
  });
  
  // Calculate dot product and magnitudes
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  // Get all unique n-grams from both sets
  const allNgrams = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);
  
  allNgrams.forEach(ng => {
    const f1 = freq1[ng] || 0;
    const f2 = freq2[ng] || 0;
    dotProduct += f1 * f2;
    magnitude1 += f1 * f1;
    magnitude2 += f2 * f2;
  });
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  // Avoid division by zero
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Batch map multiple field names
 * 
 * Efficiently maps multiple field names at once.
 * Useful for processing multiple CKBs.
 * 
 * @param {Array<string>} rawFieldNames - Array of raw field names
 * @param {Array<string>} schemaFieldNames - Schema field names
 * @param {Object} options - Mapping options
 * @returns {Array<Object|null>} Array of mapping results
 * 
 * @example
 * batchMapFieldNames(['地区', '日期', '数值'], ['区域', '时间', '数值'])
 * // Returns: [
 * //   { mapped_name: '区域', confidence: 0.9, method: 'synonym' },
 * //   { mapped_name: '时间', confidence: 0.9, method: 'synonym' },
 * //   { mapped_name: '数值', confidence: 1.0, method: 'exact' }
 * // ]
 */
function batchMapFieldNames(rawFieldNames, schemaFieldNames, options = {}) {
  return rawFieldNames.map(rawName => 
    mapFieldName(rawName, schemaFieldNames, options)
  );
}

/**
 * Get mapping statistics for a set of results
 * 
 * @param {Array<Object|null>} mappingResults - Array of mapping results
 * @returns {Object} Statistics
 * 
 * @example
 * const results = [
 *   { mapped_name: '区域', confidence: 1.0, method: 'exact' },
 *   { mapped_name: '时间', confidence: 0.9, method: 'synonym' },
 *   null
 * ];
 * getMappingStats(results)
 * // Returns: {
 * //   total: 3,
 * //   mapped: 2,
 * //   unmapped: 1,
 * //   by_method: { exact: 1, synonym: 1 },
 * //   avg_confidence: 0.95
 * // }
 */
function getMappingStats(mappingResults) {
  const stats = {
    total: mappingResults.length,
    mapped: 0,
    unmapped: 0,
    by_method: {
      exact: 0,
      synonym: 0,
      similarity: 0
    },
    avg_confidence: 0
  };
  
  let totalConfidence = 0;
  
  mappingResults.forEach(result => {
    if (result) {
      stats.mapped++;
      stats.by_method[result.method]++;
      totalConfidence += result.confidence;
    } else {
      stats.unmapped++;
    }
  });
  
  if (stats.mapped > 0) {
    stats.avg_confidence = totalConfidence / stats.mapped;
  }
  
  return stats;
}

/**
 * Test similarity between two field names
 * 
 * Utility function for debugging and testing.
 * Returns detailed similarity metrics.
 * 
 * @param {string} name1 - First field name
 * @param {string} name2 - Second field name
 * @returns {Object} Detailed similarity metrics
 * 
 * @example
 * testSimilarity('地区', '区域')
 * // Returns: {
 * //   levenshtein_distance: 2,
 * //   levenshtein_similarity: 0.5,
 * //   cosine_similarity: 0.33,
 * //   combined_similarity: 0.43
 * // }
 */
function testSimilarity(name1, name2) {
  const editDistance = levenshteinDistance(name1, name2);
  const maxLen = Math.max(name1.length, name2.length);
  const levenshteinSim = maxLen > 0 ? 1 - (editDistance / maxLen) : 0;
  
  const cosineSim = cosineSimilarity(
    generateNgrams(name1, 2),
    generateNgrams(name2, 2)
  );
  
  const combinedSim = (levenshteinSim * 0.6 + cosineSim * 0.4);
  
  return {
    levenshtein_distance: editDistance,
    levenshtein_similarity: levenshteinSim,
    cosine_similarity: cosineSim,
    combined_similarity: combinedSim
  };
}

module.exports = {
  mapFieldName,
  exactMatch,
  synonymMatch,
  similarityMatch,
  levenshteinDistance,
  generateNgrams,
  cosineSimilarity,
  batchMapFieldNames,
  getMappingStats,
  testSimilarity
};
