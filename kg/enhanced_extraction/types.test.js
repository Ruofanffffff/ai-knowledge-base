/**
 * Unit tests for core data models and types
 */

const { createEntity, createRelation, createExtractionResult } = require('./types');
const { ENTITY_TYPES, EXTRACTION_SOURCES } = require('./constants');

describe('Core Data Models', () => {
  describe('createEntity', () => {
    test('should create entity with required fields', () => {
      const entity = createEntity({
        type: ENTITY_TYPES.LENS,
        name: 'SEL35F18F'
      });

      expect(entity).toHaveProperty('id');
      expect(entity).toHaveProperty('type', ENTITY_TYPES.LENS);
      expect(entity).toHaveProperty('name', 'SEL35F18F');
      expect(entity).toHaveProperty('properties');
      expect(entity).toHaveProperty('confidence', 1.0);
      expect(entity).toHaveProperty('source', EXTRACTION_SOURCES.ALGORITHM);
      expect(entity).toHaveProperty('metadata');
      expect(entity.metadata).toHaveProperty('extractedAt');
    });

    test('should normalize confidence to [0, 1] range', () => {
      const entity1 = createEntity({
        type: ENTITY_TYPES.CONCEPT,
        name: 'Test',
        confidence: 1.5
      });
      expect(entity1.confidence).toBe(1.0);

      const entity2 = createEntity({
        type: ENTITY_TYPES.CONCEPT,
        name: 'Test',
        confidence: -0.5
      });
      expect(entity2.confidence).toBe(0);
    });

    test('should accept custom properties', () => {
      const entity = createEntity({
        type: ENTITY_TYPES.LENS,
        name: 'SEL35F18F',
        properties: {
          focalLength: '35mm',
          maxAperture: 'F1.8'
        }
      });

      expect(entity.properties.focalLength).toBe('35mm');
      expect(entity.properties.maxAperture).toBe('F1.8');
    });

    test('should accept custom metadata', () => {
      const entity = createEntity({
        type: ENTITY_TYPES.CONCEPT,
        name: 'Test',
        metadata: {
          context: 'test context'
        }
      });

      expect(entity.metadata.context).toBe('test context');
      expect(entity.metadata).toHaveProperty('extractedAt');
    });
  });

  describe('createRelation', () => {
    test('should create relation with required fields', () => {
      const relation = createRelation({
        type: 'suitable_for',
        source: 'SEL35F18F',
        target: '人文摄影'
      });

      expect(relation).toHaveProperty('id');
      expect(relation).toHaveProperty('type', 'suitable_for');
      expect(relation).toHaveProperty('source', 'SEL35F18F');
      expect(relation).toHaveProperty('target', '人文摄影');
      expect(relation).toHaveProperty('confidence', 1.0);
      expect(relation).toHaveProperty('extractionSource', EXTRACTION_SOURCES.ALGORITHM);
      expect(relation).toHaveProperty('metadata');
      expect(relation.metadata).toHaveProperty('extractedAt');
    });

    test('should normalize confidence to [0, 1] range', () => {
      const relation1 = createRelation({
        type: 'suitable_for',
        source: 'A',
        target: 'B',
        confidence: 2.0
      });
      expect(relation1.confidence).toBe(1.0);

      const relation2 = createRelation({
        type: 'suitable_for',
        source: 'A',
        target: 'B',
        confidence: -1.0
      });
      expect(relation2.confidence).toBe(0);
    });
  });

  describe('createExtractionResult', () => {
    test('should create extraction result with default values', () => {
      const result = createExtractionResult({});

      expect(result).toHaveProperty('entities', []);
      expect(result).toHaveProperty('relations', []);
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('quality');
      
      expect(result.metadata).toHaveProperty('status', 'success');
      expect(result.metadata).toHaveProperty('processingTime', 0);
      expect(result.metadata).toHaveProperty('tokensUsed', 0);
      
      expect(result.quality).toHaveProperty('entityCompleteness', 0);
      expect(result.quality).toHaveProperty('warnings', []);
    });

    test('should accept custom entities and relations', () => {
      const entity = createEntity({
        type: ENTITY_TYPES.LENS,
        name: 'Test Lens'
      });
      
      const relation = createRelation({
        type: 'suitable_for',
        source: 'Test Lens',
        target: 'Test Scene'
      });

      const result = createExtractionResult({
        entities: [entity],
        relations: [relation]
      });

      expect(result.entities).toHaveLength(1);
      expect(result.relations).toHaveLength(1);
      expect(result.entities[0]).toEqual(entity);
      expect(result.relations[0]).toEqual(relation);
    });

    test('should merge custom metadata', () => {
      const result = createExtractionResult({
        metadata: {
          documentId: 'doc123',
          language: 'zh',
          processingTime: 1000
        }
      });

      expect(result.metadata.documentId).toBe('doc123');
      expect(result.metadata.language).toBe('zh');
      expect(result.metadata.processingTime).toBe(1000);
      expect(result.metadata).toHaveProperty('status');
    });
  });
});
