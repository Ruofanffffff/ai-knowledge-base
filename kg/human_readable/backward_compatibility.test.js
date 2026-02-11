/**
 * Unit Tests for Backward Compatibility Module
 * 
 * Tests field preservation, schema validation, and compatibility reporting.
 */

const {
  ORIGINAL_ENTITY_FIELDS,
  ORIGINAL_RELATION_FIELDS,
  validateEntityFieldPreservation,
  validateRelationFieldPreservation,
  validateKnowledgeGraphSchema,
  validateEntitySchema,
  validateRelationSchema,
  ensureEntityFields,
  ensureRelationFields,
  addEnhancedEntityFields,
  addEnhancedRelationFields,
  generateCompatibilityReport
} = require('./backward_compatibility');

describe('Backward Compatibility Module', () => {
  describe('validateEntityFieldPreservation', () => {
    it('should validate when all fields are preserved', () => {
      const original = {
        entity_id: 'entity_1',
        entity_type: 'LocationEntity',
        canonical_name: 'Beijing',
        aliases: ['北京'],
        schemas: [{ schema_name: 'Location', confidence: 0.9 }],
        supported_by: ['ckb_1'],
        attributes: { city: 'Beijing' },
        confidence: 0.9,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      };
      
      const enhanced = {
        ...original,
        llm_enriched: true,
        name_standardization: { method: 'algorithm' }
      };
      
      const result = validateEntityFieldPreservation(original, enhanced);
      
      expect(result.valid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
      expect(result.modifiedFields).toHaveLength(0);
      expect(result.preservedFields).toHaveLength(ORIGINAL_ENTITY_FIELDS.length);
    });
    
    it('should detect missing fields', () => {
      const original = {
        entity_id: 'entity_1',
        entity_type: 'LocationEntity',
        canonical_name: 'Beijing',
        aliases: [],
        schemas: [],
        supported_by: [],
        attributes: {},
        confidence: 0.9,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      };
      
      const enhanced = {
        entity_id: 'entity_1',
        entity_type: 'LocationEntity',
        canonical_name: 'Beijing'
        // Missing: aliases, schemas, supported_by, attributes, confidence, created_at, updated_at
      };
      
      const result = validateEntityFieldPreservation(original, enhanced);
      
      expect(result.valid).toBe(false);
      expect(result.missingFields.length).toBeGreaterThan(0);
      expect(result.missingFields).toContain('aliases');
      expect(result.missingFields).toContain('schemas');
    });
    
    it('should detect modified fields', () => {
      const original = {
        entity_id: 'entity_1',
        entity_type: 'LocationEntity',
        canonical_name: 'Beijing',
        aliases: [],
        schemas: [],
        supported_by: [],
        attributes: {},
        confidence: 0.9,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      };
      
      const enhanced = {
        ...original,
        canonical_name: 'Shanghai', // Modified
        confidence: 0.8 // Modified
      };
      
      const result = validateEntityFieldPreservation(original, enhanced);
      
      expect(result.valid).toBe(false);
      expect(result.modifiedFields.length).toBeGreaterThan(0);
      expect(result.modifiedFields.some(f => f.field === 'canonical_name')).toBe(true);
      expect(result.modifiedFields.some(f => f.field === 'confidence')).toBe(true);
    });
  });
  
  describe('validateRelationFieldPreservation', () => {
    it('should validate when all fields are preserved', () => {
      const original = {
        source_id: 'entity_1',
        target_id: 'entity_2',
        type: 'builtin',
        subtype: 'located_in',
        confidence: 0.9,
        evidence_ckb: JSON.stringify(['ckb_1']),
        evidence_text: 'Beijing is in China',
        metadata: JSON.stringify({ schema_name: 'Location' })
      };
      
      const enhanced = {
        ...original,
        metadata: JSON.stringify({
          schema_name: 'Location',
          description: 'Beijing is located in China',
          description_method: 'template'
        })
      };
      
      const result = validateRelationFieldPreservation(original, enhanced);
      
      expect(result.valid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
      expect(result.modifiedFields).toHaveLength(0);
    });
    
    it('should detect missing fields', () => {
      const original = {
        source_id: 'entity_1',
        target_id: 'entity_2',
        type: 'builtin',
        subtype: 'located_in',
        confidence: 0.9,
        evidence_ckb: JSON.stringify(['ckb_1']),
        evidence_text: 'Beijing is in China',
        metadata: JSON.stringify({})
      };
      
      const enhanced = {
        source_id: 'entity_1',
        target_id: 'entity_2',
        type: 'builtin'
        // Missing: subtype, confidence, evidence_ckb, evidence_text, metadata
      };
      
      const result = validateRelationFieldPreservation(original, enhanced);
      
      expect(result.valid).toBe(false);
      expect(result.missingFields.length).toBeGreaterThan(0);
    });
  });
  
  describe('ensureEntityFields', () => {
    it('should add missing required fields with defaults', () => {
      const entity = {
        canonical_name: 'Beijing'
      };
      
      const ensured = ensureEntityFields(entity);
      
      expect(ensured.entity_id).toBeDefined();
      expect(ensured.entity_type).toBe('GeneralEntity');
      expect(ensured.canonical_name).toBe('Beijing');
      expect(ensured.aliases).toEqual([]);
      expect(ensured.schemas).toEqual([]);
      expect(ensured.supported_by).toEqual([]);
      expect(ensured.attributes).toEqual({});
      expect(ensured.confidence).toBe(0.5);
      expect(ensured.created_at).toBeDefined();
      expect(ensured.updated_at).toBeDefined();
    });
    
    it('should not overwrite existing fields', () => {
      const entity = {
        entity_id: 'entity_1',
        entity_type: 'LocationEntity',
        canonical_name: 'Beijing',
        aliases: ['北京'],
        schemas: [{ schema_name: 'Location', confidence: 0.9 }],
        supported_by: ['ckb_1'],
        attributes: { city: 'Beijing' },
        confidence: 0.9,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      };
      
      const ensured = ensureEntityFields(entity);
      
      expect(ensured.entity_id).toBe('entity_1');
      expect(ensured.entity_type).toBe('LocationEntity');
      expect(ensured.canonical_name).toBe('Beijing');
      expect(ensured.aliases).toEqual(['北京']);
      expect(ensured.confidence).toBe(0.9);
    });
  });
  
  describe('ensureRelationFields', () => {
    it('should add missing required fields with defaults', () => {
      const relation = {
        source_id: 'entity_1',
        target_id: 'entity_2'
      };
      
      const ensured = ensureRelationFields(relation);
      
      expect(ensured.source_id).toBe('entity_1');
      expect(ensured.target_id).toBe('entity_2');
      expect(ensured.type).toBe('unknown');
      expect(ensured.subtype).toBe('unknown');
      expect(ensured.confidence).toBe(0.5);
      expect(ensured.evidence_ckb).toBe(JSON.stringify([]));
      expect(ensured.evidence_text).toBeNull();
      expect(ensured.metadata).toBe(JSON.stringify({}));
    });
    
    it('should throw error if source_id or target_id is missing', () => {
      const relation = {
        type: 'builtin'
      };
      
      expect(() => ensureRelationFields(relation)).toThrow('Relation must have source_id');
    });
  });
  
  describe('addEnhancedEntityFields', () => {
    it('should add enhanced fields without overwriting existing fields', () => {
      const entity = {
        entity_id: 'entity_1',
        canonical_name: 'Beijing',
        confidence: 0.9
      };
      
      const enhancements = {
        llm_enriched: true,
        name_standardization: { method: 'algorithm' },
        confidence: 0.8 // Should not overwrite
      };
      
      const enhanced = addEnhancedEntityFields(entity, enhancements);
      
      expect(enhanced.llm_enriched).toBe(true);
      expect(enhanced.name_standardization).toEqual({ method: 'algorithm' });
      expect(enhanced.confidence).toBe(0.9); // Original value preserved
    });
  });
  
  describe('addEnhancedRelationFields', () => {
    it('should add enhanced fields to metadata', () => {
      const relation = {
        source_id: 'entity_1',
        target_id: 'entity_2',
        type: 'builtin',
        metadata: JSON.stringify({ schema_name: 'Location' })
      };
      
      const enhancements = {
        description: 'Beijing is located in China',
        description_method: 'template',
        description_confidence: 0.9
      };
      
      const enhanced = addEnhancedRelationFields(relation, enhancements);
      
      const metadata = JSON.parse(enhanced.metadata);
      expect(metadata.schema_name).toBe('Location');
      expect(metadata.description).toBe('Beijing is located in China');
      expect(metadata.description_method).toBe('template');
      expect(metadata.description_confidence).toBe(0.9);
    });
    
    it('should handle non-JSON metadata gracefully', () => {
      const relation = {
        source_id: 'entity_1',
        target_id: 'entity_2',
        type: 'builtin',
        metadata: 'invalid json'
      };
      
      const enhancements = {
        description: 'Test description'
      };
      
      const enhanced = addEnhancedRelationFields(relation, enhancements);
      
      const metadata = JSON.parse(enhanced.metadata);
      expect(metadata.description).toBe('Test description');
    });
  });
  
  describe('validateEntitySchema', () => {
    it('should validate correct entity schema', () => {
      const entity = {
        entity_id: 'entity_1',
        entity_type: 'LocationEntity',
        canonical_name: 'Beijing',
        aliases: ['北京'],
        schemas: [{ schema_name: 'Location', confidence: 0.9 }],
        supported_by: ['ckb_1'],
        attributes: { city: 'Beijing' },
        confidence: 0.9,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      };
      
      const result = validateEntitySchema(entity);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect missing required fields', () => {
      const entity = {
        entity_id: 'entity_1',
        canonical_name: 'Beijing'
      };
      
      const result = validateEntitySchema(entity);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should detect invalid field types', () => {
      const entity = {
        entity_id: 123, // Should be string
        entity_type: 'LocationEntity',
        canonical_name: 'Beijing',
        aliases: 'not an array', // Should be array
        schemas: [],
        supported_by: [],
        attributes: {},
        confidence: 1.5, // Should be 0-1
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      };
      
      const result = validateEntitySchema(entity);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('entity_id'))).toBe(true);
      expect(result.errors.some(e => e.includes('aliases'))).toBe(true);
      expect(result.errors.some(e => e.includes('confidence'))).toBe(true);
    });
  });
  
  describe('validateRelationSchema', () => {
    it('should validate correct relation schema', () => {
      const relation = {
        source_id: 'entity_1',
        target_id: 'entity_2',
        type: 'builtin',
        subtype: 'located_in',
        confidence: 0.9,
        evidence_ckb: JSON.stringify(['ckb_1']),
        evidence_text: 'Beijing is in China',
        metadata: JSON.stringify({ schema_name: 'Location' })
      };
      
      const result = validateRelationSchema(relation);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect invalid metadata JSON', () => {
      const relation = {
        source_id: 'entity_1',
        target_id: 'entity_2',
        type: 'builtin',
        subtype: 'located_in',
        confidence: 0.9,
        evidence_ckb: JSON.stringify(['ckb_1']),
        evidence_text: 'Beijing is in China',
        metadata: 'invalid json'
      };
      
      const result = validateRelationSchema(relation);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('metadata'))).toBe(true);
    });
  });
  
  describe('validateKnowledgeGraphSchema', () => {
    it('should validate correct knowledge graph', () => {
      const kg = {
        entities: [
          {
            entity_id: 'entity_1',
            entity_type: 'LocationEntity',
            canonical_name: 'Beijing',
            aliases: [],
            schemas: [],
            supported_by: [],
            attributes: {},
            confidence: 0.9,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z'
          }
        ],
        relations: [
          {
            source_id: 'entity_1',
            target_id: 'entity_2',
            type: 'builtin',
            subtype: 'located_in',
            confidence: 0.9,
            evidence_ckb: JSON.stringify([]),
            evidence_text: null,
            metadata: JSON.stringify({})
          }
        ]
      };
      
      const result = validateKnowledgeGraphSchema(kg);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect missing entities or relations arrays', () => {
      const kg = {
        entities: []
        // Missing relations
      };
      
      const result = validateKnowledgeGraphSchema(kg);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('relations'))).toBe(true);
    });
  });
  
  describe('generateCompatibilityReport', () => {
    it('should generate report for compatible knowledge graphs', () => {
      const original = {
        entities: [
          {
            entity_id: 'entity_1',
            entity_type: 'LocationEntity',
            canonical_name: 'Beijing',
            aliases: [],
            schemas: [],
            supported_by: [],
            attributes: {},
            confidence: 0.9,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z'
          }
        ],
        relations: [
          {
            source_id: 'entity_1',
            target_id: 'entity_2',
            type: 'builtin',
            subtype: 'located_in',
            confidence: 0.9,
            evidence_ckb: JSON.stringify([]),
            evidence_text: null,
            metadata: JSON.stringify({})
          }
        ]
      };
      
      const enhanced = {
        entities: [
          {
            ...original.entities[0],
            llm_enriched: true
          }
        ],
        relations: [
          {
            ...original.relations[0],
            metadata: JSON.stringify({ description: 'Test' })
          }
        ]
      };
      
      const report = generateCompatibilityReport(original, enhanced);
      
      expect(report.summary.totalEntities).toBe(1);
      expect(report.summary.totalRelations).toBe(1);
      expect(report.summary.entitiesPreserved).toBe(1);
      expect(report.summary.relationsPreserved).toBe(1);
      expect(report.summary.entitiesWithIssues).toBe(0);
      expect(report.summary.relationsWithIssues).toBe(0);
      expect(report.schemaValidation.valid).toBe(true);
    });
    
    it('should detect compatibility issues', () => {
      const original = {
        entities: [
          {
            entity_id: 'entity_1',
            entity_type: 'LocationEntity',
            canonical_name: 'Beijing',
            aliases: [],
            schemas: [],
            supported_by: [],
            attributes: {},
            confidence: 0.9,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z'
          }
        ],
        relations: []
      };
      
      const enhanced = {
        entities: [
          {
            entity_id: 'entity_1',
            entity_type: 'LocationEntity',
            canonical_name: 'Beijing'
            // Missing required fields
          }
        ],
        relations: []
      };
      
      const report = generateCompatibilityReport(original, enhanced);
      
      expect(report.summary.entitiesWithIssues).toBe(1);
      expect(report.entityIssues.length).toBeGreaterThan(0);
    });
  });
});
