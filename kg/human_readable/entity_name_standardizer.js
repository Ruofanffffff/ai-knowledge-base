/**
 * Entity Name Standardizer
 * 
 * Standardizes entity names to be human-readable and descriptive.
 * Eliminates "unknown" names and provides meaningful alternatives.
 * 
 * @module human_readable/entity_name_standardizer
 */

/**
 * @typedef {Object} StandardizationResult
 * @property {string} standardizedName - The standardized entity name
 * @property {string} originalName - The original entity name
 * @property {string} method - Method used: 'algorithm' | 'llm' | 'fallback'
 * @property {number} confidence - Confidence score (0-1)
 * @property {Object} metadata - Additional metadata
 */

class EntityNameStandardizer {
  constructor(options = {}) {
    this.llmClient = options.llmClient || null;
    this.enableLLM = options.enableLLM !== false;
    this.contextWindow = options.contextWindow || 50; // characters before/after
  }

  /**
   * Standardize an entity name
   * @param {Object} entity - Entity object
   * @param {string} entity.name - Current entity name
   * @param {string} entity.type - Entity type
   * @param {Array<Object>} entity.ckbs - CKB evidence
   * @param {Object} options - Options
   * @returns {Promise<StandardizationResult>}
   */
  async standardizeName(entity, options = {}) {
    try {
      // Validate input
      if (!entity || typeof entity !== 'object') {
        console.error('[EntityNameStandardizer] Invalid entity: must be an object');
        return this._createErrorResult('', 'Invalid entity: must be an object');
      }

      const { name, type, ckbs = [] } = entity;
      const trimmedName = (name || '').trim();
      
      // If name is already good, return it
      if (this._isGoodName(trimmedName)) {
        return {
          standardizedName: trimmedName,
          originalName: name,
          method: 'none',
          confidence: 1.0,
          metadata: { reason: 'already_good' }
        };
      }

      // Try algorithm-based standardization first
      try {
        const algorithmResult = await this._standardizeWithAlgorithm(entity);
        if (algorithmResult.confidence >= 0.7) {
          return {
            ...algorithmResult,
            standardizedName: algorithmResult.standardizedName.trim()
          };
        }
      } catch (error) {
        console.error('[EntityNameStandardizer] Algorithm standardization failed:', error.message);
        // Continue to LLM or fallback
      }

      // Try LLM enhancement if enabled and available
      if (this.enableLLM && this.llmClient && ckbs.length > 0) {
        try {
          const llmResult = await this._standardizeWithLLM(entity);
          if (llmResult.confidence >= 0.6) {
            return {
              ...llmResult,
              standardizedName: llmResult.standardizedName.trim()
            };
          }
        } catch (error) {
          console.error('[EntityNameStandardizer] LLM standardization failed:', error.message);
          // Continue to fallback
        }
      }

      // Fallback to generic pattern
      const fallbackResult = this._standardizeWithFallback(entity);
      return {
        ...fallbackResult,
        standardizedName: fallbackResult.standardizedName.trim()
      };
    } catch (error) {
      console.error('[EntityNameStandardizer] Unexpected error in standardizeName:', error.message);
      return this._createErrorResult(entity?.name || '', error.message);
    }
  }

  /**
   * Check if a name is already good
   * @private
   */
  _isGoodName(name) {
    try {
      if (!name || name.trim().length === 0) return false;
      const trimmed = name.trim();
      if (trimmed.toLowerCase().includes('unknown')) return false;
      if (trimmed.match(/^[\d.]+$/)) return false; // Pure numbers
      if (trimmed.match(/^\s+$/)) return false; // Only whitespace
      if (trimmed.length < 2) return false;
      
      // Check if it has excessive whitespace
      if (/\s{2,}/.test(trimmed)) return false;
      
      // Check if it starts with a digit - these are likely parameters that need standardization
      if (/^\d/.test(trimmed)) {
        return false;
      }
      
      // Check if it's mostly numbers with minimal text (like "0:", "123:", etc.)
      const alphaCount = (trimmed.match(/[a-zA-Z\u4e00-\u9fa5]/g) || []).length;
      const digitCount = (trimmed.match(/\d/g) || []).length;
      if (digitCount > 0 && alphaCount === 0) {
        // Has digits but no letters - needs standardization
        return false;
      }
      
      // Check if it has at least some alphanumeric characters
      if (!/[a-zA-Z0-9\u4e00-\u9fa5]/.test(trimmed)) {
        // Only special characters - needs standardization
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('[EntityNameStandardizer] Error in _isGoodName:', error.message);
      return false;
    }
  }

  /**
   * Create error result
   * @private
   */
  _createErrorResult(originalName, errorMessage) {
    return {
      standardizedName: originalName || 'error_entity',
      originalName: originalName || '',
      method: 'error',
      confidence: 0.0,
      metadata: { 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Algorithm-based standardization
   * @private
   */
  async _standardizeWithAlgorithm(entity) {
    try {
      const { name, type, ckbs = [] } = entity;
      const trimmedName = (name || '').trim().replace(/\s+/g, ' ');
      
      // Handle empty names
      if (!trimmedName) {
        return {
          standardizedName: trimmedName,
          originalName: name,
          method: 'algorithm',
          confidence: 0.0,
          metadata: { reason: 'empty_name' }
        };
      }
      
      // Extract context from CKBs
      const context = this._extractContext(trimmedName, ckbs);
      
      // Extract core concept
      const coreConcept = this.extractCoreConcept(trimmedName, context);
      
      // Handle numeric parameters specially
      if (this._isNumericParameter(trimmedName)) {
        return this._standardizeNumericParameter(trimmedName, context, type);
      }

      // Use core concept if found and it's different and valid
      if (coreConcept && coreConcept !== trimmedName && coreConcept.trim().length > 0) {
        // Check if core concept has alphanumeric characters
        if (/[a-zA-Z0-9\u4e00-\u9fa5]/.test(coreConcept)) {
          return {
            standardizedName: coreConcept.trim(),
            originalName: name,
            method: 'algorithm',
            confidence: 0.8,
            metadata: { 
              extraction: 'core_concept',
              context_used: context.substring(0, 100)
            }
          };
        }
      }

      return {
        standardizedName: trimmedName,
        originalName: name,
        method: 'algorithm',
        confidence: 0.3,
        metadata: { reason: 'no_improvement' }
      };
    } catch (error) {
      console.error('[EntityNameStandardizer] Error in _standardizeWithAlgorithm:', error.message);
      throw error; // Re-throw to be caught by caller
    }
  }

  /**
   * Extract core concept from text fragment
   * @param {string} fragment - Text fragment
   * @param {string} context - Surrounding context
   * @returns {string} Core concept
   */
  extractCoreConcept(fragment, context) {
    try {
      // Remove common prefixes/suffixes
      let concept = fragment.trim();
      
      // Normalize whitespace first
      concept = concept.replace(/\s+/g, ' ');
      
      // Remove measurement units
      concept = concept.replace(/\s*(mm|cm|m|km|kg|g|mg|s|ms|°|度|米|厘米|毫米|千米|克|千克|毫克|秒|毫秒)\s*$/i, '');
      
      // Remove numbers at the end
      concept = concept.replace(/\s*[\d.]+\s*$/, '');
      
      // Extract noun phrases from context
      const contextWords = context.split(/\s+/);
      const fragmentIndex = contextWords.findIndex(w => w.includes(fragment));
      
      if (fragmentIndex >= 0) {
        // Look for descriptive words before the fragment
        const before = contextWords.slice(Math.max(0, fragmentIndex - 3), fragmentIndex);
        const descriptive = before.filter(w => 
          w.length > 1 && !w.match(/^[\d.]+$/) && !['的', '是', '和', 'the', 'a', 'an'].includes(w.toLowerCase())
        );
        
        if (descriptive.length > 0) {
          concept = descriptive[descriptive.length - 1] + concept;
        }
      }
      
      // Final cleanup - normalize whitespace again
      concept = concept.replace(/\s+/g, ' ').trim();
      
      return concept;
    } catch (error) {
      console.error('[EntityNameStandardizer] Error in extractCoreConcept:', error.message);
      return fragment; // Return original fragment on error
    }
  }

  /**
   * Check if name is a numeric parameter
   * @private
   */
  _isNumericParameter(name) {
    const trimmed = name.trim();
    // Check if starts with digit or contains mostly digits
    return /^\d/.test(trimmed) || /\d/.test(trimmed);
  }

  /**
   * Standardize numeric parameter
   * @private
   */
  _standardizeNumericParameter(name, context, type) {
    const trimmedName = name.trim();
    
    // Extract numeric part
    const numericPart = trimmedName.replace(/[^\d.]/g, '');
    
    // If no numeric part, treat as regular entity
    if (!numericPart || numericPart.length === 0) {
      // Check if it has alphanumeric characters - if not, use fallback
      if (!/[a-zA-Z0-9\u4e00-\u9fa5]/.test(trimmedName)) {
        return {
          standardizedName: type ? `${type}_entity` : 'special_char_entity',
          originalName: name,
          method: 'fallback',
          confidence: 0.2,
          metadata: { pattern: 'no_numeric_part_special_chars' }
        };
      }
      return {
        standardizedName: trimmedName,
        originalName: name,
        method: 'algorithm',
        confidence: 0.3,
        metadata: { pattern: 'no_numeric_part' }
      };
    }
    
    // Clean the numeric part - remove leading/trailing dots
    const cleanNumeric = numericPart.replace(/^\.+|\.+$/g, '');
    if (!cleanNumeric || cleanNumeric.length === 0) {
      // Check if it has alphanumeric characters - if not, use fallback
      if (!/[a-zA-Z0-9\u4e00-\u9fa5]/.test(trimmedName)) {
        return {
          standardizedName: type ? `${type}_entity` : 'special_char_entity',
          originalName: name,
          method: 'fallback',
          confidence: 0.2,
          metadata: { pattern: 'invalid_numeric_special_chars' }
        };
      }
      return {
        standardizedName: trimmedName,
        originalName: name,
        method: 'algorithm',
        confidence: 0.3,
        metadata: { pattern: 'invalid_numeric' }
      };
    }
    
    // Common parameter patterns
    const patterns = [
      { regex: /ISO\s*(\d+)/i, template: 'ISO感光度$1' },
      { regex: /(\d+)\s*mm/i, template: '$1毫米焦距' },
      { regex: /f[\/]?(\d+\.?\d*)/i, template: 'f/$1光圈' },
      { regex: /(\d+\/\d+)\s*s/i, template: '$1秒快门' },
      { regex: /(\d+)\s*°/i, template: '$1度' },
      { regex: /(\d+)\s*%/i, template: '$1百分比' }
    ];

    for (const pattern of patterns) {
      const match = context.match(pattern.regex) || trimmedName.match(pattern.regex);
      if (match) {
        const standardized = pattern.template.replace(/\$(\d+)/g, (_, n) => match[parseInt(n)]);
        return {
          standardizedName: standardized.trim(),
          originalName: name,
          method: 'algorithm',
          confidence: 0.85,
          metadata: { 
            pattern: 'numeric_parameter',
            matched_pattern: pattern.regex.toString()
          }
        };
      }
    }

    // Fallback: use context clues
    const contextLower = context.toLowerCase();
    
    if (contextLower.includes('iso') || contextLower.includes('感光')) {
      return {
        standardizedName: `ISO${cleanNumeric}`,
        originalName: name,
        method: 'algorithm',
        confidence: 0.7,
        metadata: { pattern: 'iso_inference' }
      };
    }

    if (contextLower.includes('焦距') || contextLower.includes('focal')) {
      return {
        standardizedName: `${cleanNumeric}焦距`,
        originalName: name,
        method: 'algorithm',
        confidence: 0.7,
        metadata: { pattern: 'focal_length_inference' }
      };
    }
    
    if (contextLower.includes('光圈') || contextLower.includes('aperture')) {
      return {
        standardizedName: `f/${cleanNumeric}光圈`,
        originalName: name,
        method: 'algorithm',
        confidence: 0.7,
        metadata: { pattern: 'aperture_inference' }
      };
    }

    // Generic fallback - use numeric part with descriptive prefix
    // Ensure the result doesn't contain special characters
    const cleanName = `参数${cleanNumeric}`.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
    return {
      standardizedName: cleanName || `参数${cleanNumeric}`,
      originalName: name,
      method: 'fallback',
      confidence: 0.5,
      metadata: { pattern: 'generic_parameter' }
    };
  }

  /**
   * Extract context around entity mention
   * @private
   */
  _extractContext(name, ckbs) {
    try {
      if (!ckbs || ckbs.length === 0) return '';
      
      // Get first CKB with text
      const ckb = ckbs.find(c => c.content && c.content.text);
      if (!ckb) return '';
      
      const text = ckb.content.text;
      const index = text.indexOf(name);
      
      if (index === -1) return text.substring(0, this.contextWindow * 2);
      
      // Extract ±contextWindow characters
      const start = Math.max(0, index - this.contextWindow);
      const end = Math.min(text.length, index + name.length + this.contextWindow);
      
      return text.substring(start, end);
    } catch (error) {
      console.error('[EntityNameStandardizer] Error in _extractContext:', error.message);
      return ''; // Return empty context on error
    }
  }

  /**
   * LLM-based standardization
   * @private
   */
  async _standardizeWithLLM(entity) {
    // Placeholder for LLM integration
    // Will be implemented in task 2.6
    return {
      standardizedName: entity.name,
      originalName: entity.name,
      method: 'llm',
      confidence: 0.0,
      metadata: { reason: 'not_implemented' }
    };
  }

  /**
   * Fallback standardization
   * @private
   */
  _standardizeWithFallback(entity) {
    const { name, type } = entity;
    const trimmedName = (name || '').trim().replace(/\s+/g, ' ').replace(/\n/g, '');
    
    // Handle empty or whitespace-only names
    if (!trimmedName || trimmedName.length === 0) {
      return {
        standardizedName: type ? `${type}_entity` : 'unnamed_entity',
        originalName: name,
        method: 'fallback',
        confidence: 0.2,
        metadata: { pattern: 'empty_name' }
      };
    }
    
    // Handle "unknown" names
    if (trimmedName.toLowerCase().includes('unknown')) {
      return {
        standardizedName: type ? `${type}_entity` : 'entity',
        originalName: name,
        method: 'fallback',
        confidence: 0.3,
        metadata: { pattern: 'unknown_replacement' }
      };
    }
    
    // Handle names with only special characters (no alphanumeric)
    if (!/[a-zA-Z0-9\u4e00-\u9fa5]/.test(trimmedName)) {
      return {
        standardizedName: type ? `${type}_entity` : 'special_char_entity',
        originalName: name,
        method: 'fallback',
        confidence: 0.2,
        metadata: { pattern: 'special_chars_only' }
      };
    }
    
    // Use type as prefix if available
    if (type && type !== 'unknown') {
      return {
        standardizedName: `${type}_${trimmedName}`,
        originalName: name,
        method: 'fallback',
        confidence: 0.4,
        metadata: { pattern: 'type_prefix' }
      };
    }

    // Generic fallback
    return {
      standardizedName: `实体_${trimmedName}`,
      originalName: name,
      method: 'fallback',
      confidence: 0.3,
      metadata: { pattern: 'generic_entity' }
    };
  }

  /**
   * Batch standardize multiple entities
   * @param {Array<Object>} entities - Array of entities
   * @param {Object} options - Options
   * @returns {Promise<Array<StandardizationResult>>}
   */
  async standardizeMany(entities, options = {}) {
    try {
      if (!Array.isArray(entities)) {
        console.error('[EntityNameStandardizer] Invalid input: entities must be an array');
        throw new Error('entities must be an array');
      }

      if (entities.length === 0) {
        return [];
      }

      if (entities.length > 1000) {
        console.warn(`[EntityNameStandardizer] Large batch size: ${entities.length} entities`);
      }

      const results = [];
      
      for (const entity of entities) {
        try {
          const result = await this.standardizeName(entity, options);
          results.push(result);
        } catch (error) {
          console.error('[EntityNameStandardizer] Error standardizing entity in batch:', error.message);
          // Add error result for this entity
          results.push(this._createErrorResult(entity?.name || '', error.message));
        }
      }
      
      return results;
    } catch (error) {
      console.error('[EntityNameStandardizer] Error in standardizeMany:', error.message);
      throw error;
    }
  }
}

module.exports = {
  EntityNameStandardizer
};
