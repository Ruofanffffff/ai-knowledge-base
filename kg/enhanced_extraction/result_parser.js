/**
 * Result Parser for LLM-Enhanced Entity Extraction
 * 
 * Parses and validates LLM responses, handling format errors gracefully.
 * Normalizes confidence scores and ensures data integrity.
 */

const { createEntity, createRelation } = require('./types');

class ResultParser {
  constructor(options = {}) {
    this.strictMode = options.strictMode || false;
  }

  /**
   * Parse entity extraction results from LLM response
   * @param {string} llmResponse - Raw LLM response (JSON string)
   * @returns {Array<Entity>} Parsed entities
   */
  parseEntities(llmResponse) {
    try {
      // Try to parse JSON
      const parsed = this._parseJSON(llmResponse);
      
      // Validate structure
      if (!parsed || typeof parsed !== 'object') {
        return this._handleFormatError('Invalid response structure', []);
      }

      // Extract entities array
      const entities = parsed.entities || [];
      
      if (!Array.isArray(entities)) {
        return this._handleFormatError('Entities is not an array', []);
      }

      // Parse and validate each entity
      return entities
        .map(entity => this._parseEntity(entity))
        .filter(entity => entity !== null);
    } catch (error) {
      return this._handleFormatError(`Parse error: ${error.message}`, []);
    }
  }

  /**
   * Parse relation extraction results from LLM response
   * @param {string} llmResponse - Raw LLM response (JSON string)
   * @returns {Array<Relation>} Parsed relations
   */
  parseRelations(llmResponse) {
    try {
      // Try to parse JSON
      const parsed = this._parseJSON(llmResponse);
      
      // Validate structure
      if (!parsed || typeof parsed !== 'object') {
        return this._handleFormatError('Invalid response structure', []);
      }

      // Extract relations array
      const relations = parsed.relations || [];
      
      if (!Array.isArray(relations)) {
        return this._handleFormatError('Relations is not an array', []);
      }

      // Parse and validate each relation
      return relations
        .map(relation => this._parseRelation(relation))
        .filter(relation => relation !== null);
    } catch (error) {
      return this._handleFormatError(`Parse error: ${error.message}`, []);
    }
  }

  /**
   * Parse a single entity object
   * @private
   * @param {Object} entityData - Raw entity data
   * @returns {Entity|null} Parsed entity or null if invalid
   */
  _parseEntity(entityData) {
    try {
      // Validate required fields
      if (!entityData.type || !entityData.name) {
        if (this.strictMode) {
          throw new Error('Missing required fields: type or name');
        }
        return null;
      }

      // Normalize confidence score
      const confidence = this.normalizeConfidence(entityData.confidence);

      // Create entity with validated data
      return createEntity({
        type: entityData.type,
        name: entityData.name,
        properties: entityData.properties || {},
        confidence,
        source: 'llm',
        metadata: entityData.metadata || {}
      });
    } catch (error) {
      if (this.strictMode) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Parse a single relation object
   * @private
   * @param {Object} relationData - Raw relation data
   * @returns {Relation|null} Parsed relation or null if invalid
   */
  _parseRelation(relationData) {
    try {
      // Validate required fields
      if (!relationData.type || !relationData.source || !relationData.target) {
        if (this.strictMode) {
          throw new Error('Missing required fields: type, source, or target');
        }
        return null;
      }

      // Normalize confidence score
      const confidence = this.normalizeConfidence(relationData.confidence);

      // Create relation with validated data
      return createRelation({
        type: relationData.type,
        source: relationData.source,
        target: relationData.target,
        confidence,
        extractionSource: 'llm',
        metadata: relationData.metadata || {}
      });
    } catch (error) {
      if (this.strictMode) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Parse JSON string, handling common format issues
   * @private
   * @param {string} jsonString - JSON string to parse
   * @returns {Object} Parsed object
   */
  _parseJSON(jsonString) {
    // Handle string input
    if (typeof jsonString !== 'string') {
      // If already an object, return it
      if (typeof jsonString === 'object') {
        return jsonString;
      }
      throw new Error('Input must be a string or object');
    }

    // Try to extract JSON from markdown code blocks
    // Match the innermost json code block
    const codeBlockMatch = jsonString.match(/```json\s*\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1];
    } else {
      // Try generic code block
      const genericMatch = jsonString.match(/```\s*\n([\s\S]*?)\n```/);
      if (genericMatch) {
        jsonString = genericMatch[1];
      } else {
        // Try to find JSON object in the text
        const jsonObjectMatch = jsonString.match(/\{[\s\S]*"(entities|relations)"[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonString = jsonObjectMatch[0];
        }
      }
    }

    // Trim whitespace
    jsonString = jsonString.trim();

    // Parse JSON
    return JSON.parse(jsonString);
  }

  /**
   * Normalize confidence score to [0, 1] range
   * @param {number|string|undefined} confidence - Raw confidence value
   * @returns {number} Normalized confidence in [0, 1]
   */
  normalizeConfidence(confidence) {
    // Handle undefined or null
    if (confidence === undefined || confidence === null) {
      return 0.5; // Default confidence
    }

    // Convert string to number
    if (typeof confidence === 'string') {
      confidence = parseFloat(confidence);
    }

    // Handle NaN
    if (isNaN(confidence)) {
      return 0.5;
    }

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Handle format errors gracefully
   * @private
   * @param {string} message - Error message
   * @param {*} defaultValue - Default value to return
   * @returns {*} Default value
   */
  _handleFormatError(message, defaultValue) {
    if (this.strictMode) {
      throw new Error(`Format error: ${message}`);
    }
    
    // Log warning in non-strict mode
    console.warn(`[ResultParser] Format error (using default): ${message}`);
    
    return defaultValue;
  }

  /**
   * Validate parsed result structure
   * @param {Object} result - Parsed result
   * @returns {boolean} True if valid
   */
  validateResult(result) {
    if (!result || typeof result !== 'object') {
      return false;
    }

    // Check entities
    if (result.entities && !Array.isArray(result.entities)) {
      return false;
    }

    // Check relations
    if (result.relations && !Array.isArray(result.relations)) {
      return false;
    }

    return true;
  }

  /**
   * Set strict mode
   * @param {boolean} enabled - Enable strict mode
   */
  setStrictMode(enabled) {
    this.strictMode = enabled;
  }
}

module.exports = ResultParser;
