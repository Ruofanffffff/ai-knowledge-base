/**
 * CKB Factory
 * 
 * Creates CKB objects with proper structure and validation
 */

const crypto = require('crypto');

// 生成UUID v4格式的唯一ID
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = crypto.randomBytes(1)[0] % 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Create a CKB object
 * @param {Object} params - CKB parameters
 * @returns {Object} CKB object
 */
function createCKB(params) {
  const {
    docId,
    sourceType,
    sourceMeta = {},
    structure = {},
    text = '',
    language = 'zh',
    sourceConfidence = 0.8
  } = params;
  
  // Validate required fields
  if (!docId || !sourceType) {
    throw new Error('docId and sourceType are required');
  }
  
  // Calculate quality metrics
  const quality = calculateQuality(text, sourceConfidence);
  
  // Create CKB object
  const ckb = {
    ckb_id: uuidv4(),
    doc_id: docId,
    source_type: sourceType,
    source_meta: sourceMeta,
    structure: structure,
    content: {
      text: text,
      language: language,
      length: text.length
    },
    quality: quality,
    timestamps: {
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    }
  };
  
  return ckb;
}

/**
 * Calculate quality metrics for CKB
 * @param {string} text - Text content
 * @param {number} sourceConfidence - Source confidence (0-1)
 * @returns {Object} Quality metrics
 */
function calculateQuality(text, sourceConfidence) {
  const length = text.length;
  
  // Validate sourceConfidence
  if (typeof sourceConfidence !== 'number' || isNaN(sourceConfidence) || sourceConfidence < 0 || sourceConfidence > 1) {
    sourceConfidence = 0.8;  // Default value
  }
  
  // Length score (prefer 50-500 characters)
  let lengthScore = 0;
  if (length < 20) {
    lengthScore = 0.3;
  } else if (length < 50) {
    lengthScore = 0.6;
  } else if (length <= 500) {
    lengthScore = 1.0;
  } else if (length <= 1000) {
    lengthScore = 0.8;
  } else {
    lengthScore = 0.6;
  }
  
  // Information density (simple heuristic based on unique characters)
  const uniqueChars = new Set(text).size;
  const densityScore = Math.min(uniqueChars / 50, 1.0);
  
  // Overall quality score
  const overallScore = (sourceConfidence * 0.5) + (lengthScore * 0.3) + (densityScore * 0.2);
  
  return {
    overall_score: Math.round(overallScore * 100) / 100,
    length_score: Math.round(lengthScore * 100) / 100,
    density_score: Math.round(densityScore * 100) / 100,
    source_confidence: sourceConfidence
  };
}

module.exports = {
  createCKB
};
