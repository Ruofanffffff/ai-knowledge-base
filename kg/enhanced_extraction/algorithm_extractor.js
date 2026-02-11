/**
 * Algorithm Extractor - Wrapper for existing universal_extractor
 * 
 * This class wraps the existing universal_extractor to provide a standardized
 * interface for the enhanced extraction system. It extracts numerical parameters
 * and structured data using rule-based algorithms.
 */

const UniversalExtractor = require('../field_extractor/universal_extractor');
const { createEntity, createExtractionResult } = require('./types');
const { ENTITY_TYPES, EXTRACTION_SOURCES } = require('./constants');

class AlgorithmExtractor {
  constructor() {
    this.extractor = new UniversalExtractor();
  }

  /**
   * Extract entities using algorithm-based extraction
   * @param {string} text - Document text
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Extraction result with standardized format
   */
  async extract(text, options = {}) {
    const startTime = Date.now();
    
    try {
      // Validate input
      if (!text || typeof text !== 'string') {
        throw new Error('Invalid input: text must be a non-empty string');
      }

      // Create a mock CKB object for the universal extractor
      const mockCkb = {
        ckb_id: options.ckbId || 'temp_ckb',
        doc_id: options.docId || 'temp_doc',
        content: { text }
      };

      // Extract fields using universal extractor
      const extractedFields = await this.extractor.extractFields(mockCkb, {
        maxFields: options.maxFields || 100,
        minKeywordScore: options.minKeywordScore || 0.01,
        includeStructured: true,
        includeKeywords: true
      });

      // Convert extracted fields to standardized entities
      const entities = this._convertFieldsToEntities(extractedFields);

      // Calculate processing time (ensure at least 1ms)
      const processingTime = Math.max(1, Date.now() - startTime);

      // Create standardized extraction result
      return createExtractionResult({
        entities,
        relations: [], // Algorithm extractor doesn't extract relations
        metadata: {
          extractionTime: processingTime,
          algorithmTime: processingTime,
          parametersFound: entities.length,
          extractorType: 'universal',
          status: 'success'
        }
      });
    } catch (error) {
      const processingTime = Math.max(1, Date.now() - startTime);
      
      return createExtractionResult({
        entities: [],
        relations: [],
        metadata: {
          extractionTime: processingTime,
          algorithmTime: processingTime,
          parametersFound: 0,
          extractorType: 'universal',
          status: 'failed',
          error: error.message
        }
      });
    }
  }

  /**
   * Convert extracted fields to standardized entities
   * @private
   */
  _convertFieldsToEntities(fields) {
    return fields.map(field => {
      // Determine entity type based on field characteristics
      const entityType = this._determineEntityType(field);
      
      // Create standardized entity
      return createEntity({
        type: entityType,
        name: field.field_name || field.key || 'unknown',
        properties: {
          value: field.field_value || field.value,
          rawValue: field.raw_value,
          valueType: field.value_type,
          extractionMethod: field.extraction_method,
          confidence: field.confidence || 1.0,
          context: field.context
        },
        confidence: 1.0, // Algorithm extraction has 100% confidence in what it extracts
        source: EXTRACTION_SOURCES.ALGORITHM,
        metadata: {
          originalField: field,
          extractionMethod: field.extraction_method
        }
      });
    });
  }

  /**
   * Determine entity type based on field characteristics
   * @private
   */
  _determineEntityType(field) {
    const valueType = field.value_type;
    const fieldName = (field.field_name || field.key || '').toLowerCase();
    
    // Check if it's a numerical parameter
    if (valueType === 'number' || valueType === 'percentage') {
      return ENTITY_TYPES.NUMERICAL_PARAMETER;
    }
    
    // Check for photography-specific parameters
    if (this._isPhotographyParameter(fieldName)) {
      return ENTITY_TYPES.NUMERICAL_PARAMETER;
    }
    
    // Default to numerical parameter for structured data
    if (field.extraction_method === 'structured') {
      return ENTITY_TYPES.NUMERICAL_PARAMETER;
    }
    
    // For keywords and other types, use concept
    return ENTITY_TYPES.CONCEPT;
  }

  /**
   * Check if field name indicates a photography parameter
   * @private
   */
  _isPhotographyParameter(fieldName) {
    const photographyKeywords = [
      'focal', 'aperture', 'shutter', 'iso', 'exposure',
      '焦距', '光圈', '快门', '感光度', '曝光',
      'f/', 'mm', 'f1.', 'f2.', 'f4.', 'f8.'
    ];
    
    return photographyKeywords.some(keyword => 
      fieldName.includes(keyword.toLowerCase())
    );
  }

  /**
   * Get extractor metadata
   * @returns {Object}
   */
  getMetadata() {
    return {
      name: 'AlgorithmExtractor',
      version: '1.0.0',
      type: 'algorithm',
      capabilities: [
        'numerical_parameters',
        'structured_data',
        'keyword_extraction'
      ],
      accuracy: 1.0 // 100% accuracy for what it extracts
    };
  }
}

module.exports = AlgorithmExtractor;
