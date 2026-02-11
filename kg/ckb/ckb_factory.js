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
    sourceConfidence = 0.8,
    chunks = null  // Optional: pre-computed chunks
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
  
  // Add chunks if provided (backward compatible)
  if (chunks && Array.isArray(chunks)) {
    ckb.chunks = chunks;
  }
  
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
  createCKB,
  createFromDocument
};

/**
 * Create CKBs from a document
 * @param {Object} document - Document object with id, type, and content
 * @returns {Array} Array of CKB objects
 */
function createFromDocument(document) {
  if (!document || !document.content) {
    throw new Error('Invalid document: must have content');
  }
  
  // For now, create a single CKB from the entire document
  // In a real implementation, might split into multiple CKBs based on structure
  const ckb = createCKB({
    docId: document.id || 'unknown',
    sourceType: document.type || 'text',
    sourceMeta: {
      originalType: document.type
    },
    text: document.content,
    language: detectLanguage(document.content)
  });
  
  return [ckb];
}

/**
 * Detect language of text (simple heuristic)
 * @param {string} text - Text to analyze
 * @returns {string} Language code ('zh' or 'en')
 */
function detectLanguage(text) {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const totalChars = text.length;
  
  return chineseChars / totalChars > 0.3 ? 'zh' : 'en';
}
