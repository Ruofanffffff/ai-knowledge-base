/**
 * Tests for QualityValidator
 */

const QualityValidator = require('./quality_validator');
const { createEntity, createRelation, createExtractionResult } = require('./types');

describe('QualityValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new QualityValidator({
      minEntities: 2,
      minRelations: 1,
      minConfidence: 0.5,
      requiredFields: []
    });
  });

  describe('constructor', () => {
    it('should create validator with default config', () => {
      const v = new QualityValidator();
      const config = v.getConfig();
      
      expect(config.minEntities).toBe(0);
      expect(config.minRelations).toBe(0);
      expect(config.minConfidence).toBe(0.0);
      expect(config.requiredFields).toEqual([]);
    });

    it('should create validator with custom config', () => {
      const v = new QualityValidator({
        minEntities: 5,
        minRelations: 3,
        minConfidence: 0.7,
        requiredFields: ['description']
      });
      
      const config = v.getConfig();
      expect(config.minEntities).toBe(5);
      expect(config.minRelations).toBe(3);
      expect(config.minConfidence).toBe(0.7);
      expect(config.requiredFields).toEqual(['description']);
    });
  });

  describe('validate', () => {
    it('should validate valid extraction result', () => {
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' }),
          createEntity({ name: 'Entity2', type: 'lens', confidence: 0.8, source: 'algorithm' })
        ],
        relations: [
          createRelation({ type: 'suitable_for', source: 'Entity1', target: 'Entity2', confidence: 0.85 })
        ],
        metadata: {
          processingTime: 1000,
          status: 'success'
        }
      });

      const validation = validator.validate(result);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.entityValidation.total).toBe(2);
      expect(validation.relationValidation.total).toBe(1);
    });

    it('should detect missing entity name', () => {
      const result = createExtractionResult({
        entities: [
          { type: 'concept', confidence: 0.9, source: 'llm' } // Missing name
        ],
        relations: [],
        metadata: { processingTime: 1000, status: 'success' }
      });

      const validation = validator.validate(result);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('missing_field');
      expect(validation.errors[0].field).toBe('name');
    });

    it('should detect missing entity type', () => {
      const result = createExtractionResult({
        entities: [
          { name: 'Entity1', confidence: 0.9, source: 'llm' } // Missing type
        ],
        relations: [],
        metadata: { processingTime: 1000, status: 'success' }
      });

      const validation = validator.validate(result);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('missing_field');
      expect(validation.errors[0].field).toBe('type');
    });

    it('should detect missing entity confidence', () => {
      const result = createExtractionResult({
        entities: [
          { name: 'Entity1', type: 'concept', source: 'llm' } // Missing confidence
        ],
        relations: [],
        metadata: { processingTime: 1000, status: 'success' }
      });

      const validation = validator.validate(result);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('missing_field');
      expect(validation.errors[0].field).toBe('confidence');
    });

    it('should detect missing entity source', () => {
      const result = createExtractionResult({
        entities: [
          { name: 'Entity1', type: 'concept', confidence: 0.9 } // Missing source
        ],
        relations: [],
        metadata: { processingTime: 1000, status: 'success' }
      });

      const validation = validator.validate(result);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('missing_field');
      expect(validation.errors[0].field).toBe('source');
    });

    it('should detect invalid entity confidence range', () => {
      const result = createExtractionResult({
        entities: [
          { name: 'Entity1', type: 'concept', confidence: 1.5, source: 'llm' } // > 1, don't use createEntity as it normalizes
        ],
        relations: [],
        metadata: { processingTime: 1000, status: 'success' }
      });

      const validation = validator.validate(result);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('invalid_confidence');
      expect(validation.errors[0].value).toBe(1.5);
    });

    it('should warn about low entity confidence', () => {
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.3, source: 'llm' }), // < 0.5
          createEntity({ name: 'Entity2', type: 'lens', confidence: 0.8, source: 'algorithm' })
        ],
        relations: [],
        metadata: { processingTime: 1000, status: 'success' }
      });

      const validation = validator.validate(result);
      
      expect(validation.isValid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      const lowConfWarning = validation.warnings.find(w => w.type === 'low_confidence');
      expect(lowConfWarning).toBeDefined();
      expect(lowConfWarning.value).toBe(0.3);
    });

    it('should warn about entity count below minimum', () => {
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' })
        ], // Only 1, minimum is 2
        relations: [],
        metadata: { processingTime: 1000, status: 'success' }
      });

      const validation = validator.validate(result);
      
      expect(validation.isValid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      const countWarning = validation.warnings.find(w => w.type === 'entity_count');
      expect(countWarning).toBeDefined();
    });

    it('should detect missing relation type', () => {
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' }),
          createEntity({ name: 'Entity2', type: 'lens', confidence: 0.8, source: 'algorithm' })
        ],
        relations: [
          { source: 'Entity1', target: 'Entity2', confidence: 0.85 } // Missing type
        ],
        metadata: { processingTime: 1000, status: 'success' }
      });

      const validation = validator.validate(result);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('missing_field');
      expect(validation.errors[0].field).toBe('type');
    });

    it('should detect missing relation source', () => {
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' }),
          createEntity({ name: 'Entity2', type: 'lens', confidence: 0.8, source: 'algorithm' })
        ],
        relations: [
          { type: 'suitable_for', target: 'Entity2', confidence: 0.85 } // Missing source
        ],
        metadata: { processingTime: 1000, status: 'success' }
      });

      const validation = validator.validate(result);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('missing_field');
      expect(validation.errors[0].field).toBe('source');
    });

    it('should detect missing relation target', () => {
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' }),
          createEntity({ name: 'Entity2', type: 'lens', confidence: 0.8, source: 'algorithm' })
        ],
        relations: [
          { type: 'suitable_for', source: 'Entity1', confidence: 0.85 } // Missing target
        ],
        metadata: { processingTime: 1000, status: 'success' }
      });

      const validation = validator.validate(result);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('missing_field');
      expect(validation.errors[0].field).toBe('target');
    });

    it('should detect invalid relation confidence range', () => {
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' }),
          createEntity({ name: 'Entity2', type: 'lens', confidence: 0.8, source: 'algorithm' })
        ],
        relations: [
          { type: 'suitable_for', source: 'Entity1', target: 'Entity2', confidence: -0.1 } // < 0, don't use createRelation as it normalizes
        ],
        metadata: { processingTime: 1000, status: 'success' }
      });

      const validation = validator.validate(result);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('invalid_confidence');
      expect(validation.errors[0].value).toBe(-0.1);
    });

    it('should detect invalid entity reference in relation', () => {
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' })
        ],
        relations: [
          createRelation({ type: 'suitable_for', source: 'Entity1', target: 'NonExistent', confidence: 0.85 })
        ],
        metadata: { processingTime: 1000, status: 'success' }
      });

      const validation = validator.validate(result);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('invalid_entity_reference');
      expect(validation.errors[0].entity).toBe('NonExistent');
    });

    it('should warn about relation count below minimum', () => {
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' }),
          createEntity({ name: 'Entity2', type: 'lens', confidence: 0.8, source: 'algorithm' })
        ],
        relations: [], // 0 relations, minimum is 1
        metadata: { processingTime: 1000, status: 'success' }
      });

      const validation = validator.validate(result);
      
      expect(validation.isValid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      const countWarning = validation.warnings.find(w => w.type === 'relation_count');
      expect(countWarning).toBeDefined();
    });

    it('should warn about missing metadata fields', () => {
      // Don't use createExtractionResult as it adds default metadata
      const result = {
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' }),
          createEntity({ name: 'Entity2', type: 'lens', confidence: 0.8, source: 'algorithm' })
        ],
        relations: [
          createRelation({ type: 'suitable_for', source: 'Entity1', target: 'Entity2', confidence: 0.85 })
        ],
        metadata: {} // Missing required fields
      };

      const validation = validator.validate(result);
      
      // Should still be valid (warnings, not errors)
      expect(validation.isValid).toBe(true);
      
      // Should have warnings for missing metadata
      const metadataWarnings = validation.warnings.filter(w => w.type === 'missing_metadata');
      expect(metadataWarnings.length).toBeGreaterThan(0);
      
      // Should warn about processingTime and status
      const fields = metadataWarnings.map(w => w.field);
      expect(fields).toContain('processingTime');
      expect(fields).toContain('status');
    });

    it('should detect invalid processing time', () => {
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' })
        ],
        relations: [],
        metadata: {
          processingTime: -100, // Invalid
          status: 'success'
        }
      });

      const validation = validator.validate(result);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('invalid_metadata');
      expect(validation.errors[0].field).toBe('processingTime');
    });

    it('should detect invalid status', () => {
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' })
        ],
        relations: [],
        metadata: {
          processingTime: 1000,
          status: 'invalid_status' // Invalid
        }
      });

      const validation = validator.validate(result);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('invalid_metadata');
      expect(validation.errors[0].field).toBe('status');
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate metrics for valid result', () => {
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' }),
          createEntity({ name: 'Entity2', type: 'lens', confidence: 0.8, source: 'algorithm' })
        ],
        relations: [
          createRelation({ type: 'suitable_for', source: 'Entity1', target: 'Entity2', confidence: 0.85 })
        ],
        metadata: {
          processingTime: 1000,
          status: 'success'
        }
      });

      const metrics = validator.calculateMetrics(result);
      
      expect(metrics.totalEntities).toBe(2);
      expect(metrics.totalRelations).toBe(1);
      expect(metrics.algorithmEntities).toBe(1);
      expect(metrics.llmEntities).toBe(1);
      expect(metrics.entityCompleteness).toBe(1.0); // 2 entities, minimum 2
      expect(metrics.relationCompleteness).toBe(1.0); // 1 relation, minimum 1
      expect(metrics.averageConfidence).toBeCloseTo(0.85, 2); // (0.9 + 0.8 + 0.85) / 3
      expect(metrics.fieldCompleteness).toBe(1.0); // All required fields present
    });

    it('should calculate entity completeness correctly', () => {
      const v = new QualityValidator({ minEntities: 4 });
      
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' }),
          createEntity({ name: 'Entity2', type: 'lens', confidence: 0.8, source: 'algorithm' })
        ],
        relations: [],
        metadata: {}
      });

      const metrics = v.calculateMetrics(result);
      
      expect(metrics.entityCompleteness).toBe(0.5); // 2 / 4
    });

    it('should calculate relation completeness correctly', () => {
      const v = new QualityValidator({ minRelations: 3 });
      
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' }),
          createEntity({ name: 'Entity2', type: 'lens', confidence: 0.8, source: 'algorithm' })
        ],
        relations: [
          createRelation({ type: 'suitable_for', source: 'Entity1', target: 'Entity2', confidence: 0.85 })
        ],
        metadata: {}
      });

      const metrics = v.calculateMetrics(result);
      
      expect(metrics.relationCompleteness).toBeCloseTo(0.333, 2); // 1 / 3
    });

    it('should calculate average confidence correctly', () => {
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.6, source: 'llm' }),
          createEntity({ name: 'Entity2', type: 'lens', confidence: 0.8, source: 'algorithm' }),
          createEntity({ name: 'Entity3', type: 'technique', confidence: 1.0, source: 'llm' })
        ],
        relations: [
          createRelation({ type: 'suitable_for', source: 'Entity1', target: 'Entity2', confidence: 0.7 }),
          createRelation({ type: 'applies_to', source: 'Entity3', target: 'Entity1', confidence: 0.9 })
        ],
        metadata: {}
      });

      const metrics = validator.calculateMetrics(result);
      
      // (0.6 + 0.8 + 1.0 + 0.7 + 0.9) / 5 = 0.8
      expect(metrics.averageConfidence).toBeCloseTo(0.8, 2);
    });

    it('should handle empty result', () => {
      const result = createExtractionResult({
        entities: [],
        relations: [],
        metadata: {}
      });

      const metrics = validator.calculateMetrics(result);
      
      expect(metrics.totalEntities).toBe(0);
      expect(metrics.totalRelations).toBe(0);
      expect(metrics.entityCompleteness).toBe(0);
      expect(metrics.relationCompleteness).toBe(1.0); // No entities, so no relations expected
      expect(metrics.averageConfidence).toBe(0);
      expect(metrics.fieldCompleteness).toBe(1.0); // No entities to check
    });

    it('should calculate field completeness with missing fields', () => {
      const result = createExtractionResult({
        entities: [
          { name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' }, // All fields
          { name: 'Entity2', type: 'lens', source: 'algorithm' }, // Missing confidence
          { name: 'Entity3', confidence: 0.8, source: 'llm' } // Missing type
        ],
        relations: [],
        metadata: {}
      });

      const metrics = validator.calculateMetrics(result);
      
      // 3 entities * 4 required fields = 12 total
      // Entity1: 4/4, Entity2: 3/4, Entity3: 3/4 = 10/12
      expect(metrics.fieldCompleteness).toBeCloseTo(0.833, 2);
    });

    it('should count algorithm and LLM entities separately', () => {
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' }),
          createEntity({ name: 'Entity2', type: 'lens', confidence: 0.8, source: 'algorithm' }),
          createEntity({ name: 'Entity3', type: 'technique', confidence: 0.7, source: 'llm' }),
          createEntity({ name: 'Entity4', type: 'parameter', confidence: 1.0, source: 'algorithm' })
        ],
        relations: [],
        metadata: {}
      });

      const metrics = validator.calculateMetrics(result);
      
      expect(metrics.totalEntities).toBe(4);
      expect(metrics.algorithmEntities).toBe(2);
      expect(metrics.llmEntities).toBe(2);
    });

    it('should count algorithm and LLM relations separately', () => {
      const result = createExtractionResult({
        entities: [
          createEntity({ name: 'Entity1', type: 'concept', confidence: 0.9, source: 'llm' }),
          createEntity({ name: 'Entity2', type: 'lens', confidence: 0.8, source: 'algorithm' })
        ],
        relations: [
          { ...createRelation({ type: 'suitable_for', source: 'Entity1', target: 'Entity2', confidence: 0.85 }), extractionSource: 'llm' },
          { ...createRelation({ type: 'co_occurrence', source: 'Entity1', target: 'Entity2', confidence: 1.0 }), extractionSource: 'algorithm' }
        ],
        metadata: {}
      });

      const metrics = validator.calculateMetrics(result);
      
      expect(metrics.totalRelations).toBe(2);
      expect(metrics.algorithmRelations).toBe(1);
      expect(metrics.llmRelations).toBe(1);
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      validator.configure({
        minEntities: 10,
        minConfidence: 0.8
      });

      const config = validator.getConfig();
      expect(config.minEntities).toBe(10);
      expect(config.minConfidence).toBe(0.8);
      expect(config.minRelations).toBe(1); // Unchanged
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = validator.getConfig();
      
      expect(config).toHaveProperty('minEntities');
      expect(config).toHaveProperty('minRelations');
      expect(config).toHaveProperty('minConfidence');
      expect(config).toHaveProperty('requiredFields');
    });

    it('should return a copy of configuration', () => {
      const config1 = validator.getConfig();
      config1.minEntities = 999;
      
      const config2 = validator.getConfig();
      expect(config2.minEntities).toBe(2); // Original value
    });
  });
});
