/**
 * Integration Tests for Backward Compatibility with Downstream Systems
 * 
 * Tests that enhanced knowledge graphs are compatible with existing
 * query patterns and parsers used by downstream systems.
 * 
 * Validates: Requirements 5.4
 */

const {
  ensureEntityFields,
  ensureRelationFields,
  addEnhancedEntityFields,
  addEnhancedRelationFields,
  validateKnowledgeGraphSchema
} = require('./backward_compatibility');

describe('Backward Compatibility Integration Tests', () => {
  describe('Query Pattern Compatibility', () => {
    it('should support entity lookup by canonical_name', () => {
      // Simulate existing query pattern
      const entities = [
        ensureEntityFields({
          entity_id: 'entity_1',
          canonical_name: 'Beijing',
          entity_type: 'LocationEntity'
        }),
        ensureEntityFields({
          entity_id: 'entity_2',
          canonical_name: 'Shanghai',
          entity_type: 'LocationEntity'
        })
      ];
      
      // Add enhancements
      const enhancedEntities = entities.map(e => 
        addEnhancedEntityFields(e, {
          llm_enriched: true,
          name_standardization: { method: 'algorithm', confidence: 0.8 }
        })
      );
      
      // Simulate downstream system query
      const findByName = (name) => enhancedEntities.find(e => e.canonical_name === name);
      
      const beijing = findByName('Beijing');
      expect(beijing).toBeDefined();
      expect(beijing.entity_id).toBe('entity_1');
      expect(beijing.canonical_name).toBe('Beijing');
    });
    
    it('should support entity filtering by entity_type', () => {
      const entities = [
        addEnhancedEntityFields(
          ensureEntityFields({
            entity_id: 'entity_1',
            canonical_name: 'Beijing',
            entity_type: 'LocationEntity'
          }),
          { llm_enriched: true }
        ),
        addEnhancedEntityFields(
          ensureEntityFields({
            entity_id: 'entity_2',
            canonical_name: 'Event1',
            entity_type: 'EventEntity'
          }),
          { llm_enriched: true }
        )
      ];
      
      // Simulate downstream system query
      const filterByType = (type) => entities.filter(e => e.entity_type === type);
      
      const locations = filterByType('LocationEntity');
      expect(locations).toHaveLength(1);
      expect(locations[0].canonical_name).toBe('Beijing');
    });
    
    it('should support relation lookup by source_id and target_id', () => {
      const relations = [
        ensureRelationFields({
          source_id: 'entity_1',
          target_id: 'entity_2',
          type: 'builtin',
          subtype: 'located_in'
        }),
        ensureRelationFields({
          source_id: 'entity_2',
          target_id: 'entity_3',
          type: 'builtin',
          subtype: 'part_of'
        })
      ];
      
      // Add enhancements
      const enhancedRelations = relations.map(r =>
        addEnhancedRelationFields(r, {
          description: 'Test description',
          description_method: 'template'
        })
      );
      
      // Simulate downstream system query
      const findBySourceAndTarget = (sourceId, targetId) => 
        enhancedRelations.find(r => r.source_id === sourceId && r.target_id === targetId);
      
      const relation = findBySourceAndTarget('entity_1', 'entity_2');
      expect(relation).toBeDefined();
      expect(relation.subtype).toBe('located_in');
    });
    
    it('should support relation filtering by type', () => {
      const relations = [
        addEnhancedRelationFields(
          ensureRelationFields({
            source_id: 'entity_1',
            target_id: 'entity_2',
            type: 'builtin',
            subtype: 'located_in'
          }),
          { description: 'Test' }
        ),
        addEnhancedRelationFields(
          ensureRelationFields({
            source_id: 'entity_2',
            target_id: 'entity_3',
            type: 'semantic',
            subtype: 'related_to'
          }),
          { description: 'Test' }
        )
      ];
      
      // Simulate downstream system query
      const filterByType = (type) => relations.filter(r => r.type === type);
      
      const builtinRelations = filterByType('builtin');
      expect(builtinRelations).toHaveLength(1);
      expect(builtinRelations[0].subtype).toBe('located_in');
    });
  });
  
  describe('Parser Compatibility', () => {
    it('should be parseable by JSON.parse', () => {
      const kg = {
        entities: [
          addEnhancedEntityFields(
            ensureEntityFields({
              entity_id: 'entity_1',
              canonical_name: 'Beijing',
              entity_type: 'LocationEntity'
            }),
            { llm_enriched: true }
          )
        ],
        relations: [
          addEnhancedRelationFields(
            ensureRelationFields({
              source_id: 'entity_1',
              target_id: 'entity_2',
              type: 'builtin',
              subtype: 'located_in'
            }),
            { description: 'Test' }
          )
        ]
      };
      
      // Serialize and parse
      const serialized = JSON.stringify(kg);
      const parsed = JSON.parse(serialized);
      
      expect(parsed.entities).toHaveLength(1);
      expect(parsed.relations).toHaveLength(1);
      expect(parsed.entities[0].canonical_name).toBe('Beijing');
    });
    
    it('should support attribute access via dot notation', () => {
      const entity = addEnhancedEntityFields(
        ensureEntityFields({
          entity_id: 'entity_1',
          canonical_name: 'Beijing',
          entity_type: 'LocationEntity',
          attributes: { city: 'Beijing', country: 'China' }
        }),
        { llm_enriched: true }
      );
      
      // Simulate downstream system accessing attributes
      expect(entity.entity_id).toBe('entity_1');
      expect(entity.canonical_name).toBe('Beijing');
      expect(entity.entity_type).toBe('LocationEntity');
      expect(entity.attributes.city).toBe('Beijing');
      expect(entity.attributes.country).toBe('China');
    });
    
    it('should support metadata parsing from JSON string', () => {
      const relation = addEnhancedRelationFields(
        ensureRelationFields({
          source_id: 'entity_1',
          target_id: 'entity_2',
          type: 'builtin',
          subtype: 'located_in',
          metadata: JSON.stringify({ schema_name: 'Location' })
        }),
        { description: 'Beijing is located in China' }
      );
      
      // Simulate downstream system parsing metadata
      const metadata = JSON.parse(relation.metadata);
      
      expect(metadata.schema_name).toBe('Location');
      expect(metadata.description).toBe('Beijing is located in China');
    });
  });
  
  describe('Response Format Compatibility', () => {
    it('should match expected API response structure', () => {
      const apiResponse = {
        success: true,
        data: {
          entities: [
            addEnhancedEntityFields(
              ensureEntityFields({
                entity_id: 'entity_1',
                canonical_name: 'Beijing',
                entity_type: 'LocationEntity'
              }),
              { llm_enriched: true }
            )
          ],
          relations: [
            addEnhancedRelationFields(
              ensureRelationFields({
                source_id: 'entity_1',
                target_id: 'entity_2',
                type: 'builtin',
                subtype: 'located_in'
              }),
              { description: 'Test' }
            )
          ]
        }
      };
      
      // Validate structure
      expect(apiResponse.success).toBe(true);
      expect(apiResponse.data).toBeDefined();
      expect(apiResponse.data.entities).toBeDefined();
      expect(apiResponse.data.relations).toBeDefined();
      expect(Array.isArray(apiResponse.data.entities)).toBe(true);
      expect(Array.isArray(apiResponse.data.relations)).toBe(true);
    });
    
    it('should support pagination metadata without breaking compatibility', () => {
      const paginatedResponse = {
        success: true,
        data: {
          entities: [
            addEnhancedEntityFields(
              ensureEntityFields({
                entity_id: 'entity_1',
                canonical_name: 'Beijing',
                entity_type: 'LocationEntity'
              }),
              { llm_enriched: true }
            )
          ],
          relations: [],
          pagination: {
            page: 1,
            pageSize: 10,
            total: 1
          }
        }
      };
      
      // Validate that pagination doesn't break entity/relation access
      expect(paginatedResponse.data.entities).toHaveLength(1);
      expect(paginatedResponse.data.relations).toHaveLength(0);
      expect(paginatedResponse.data.pagination.page).toBe(1);
    });
  });
  
  describe('Schema Validation Compatibility', () => {
    it('should pass schema validation for enhanced knowledge graphs', () => {
      const kg = {
        entities: [
          addEnhancedEntityFields(
            ensureEntityFields({
              entity_id: 'entity_1',
              canonical_name: 'Beijing',
              entity_type: 'LocationEntity'
            }),
            { llm_enriched: true, name_standardization: { method: 'algorithm' } }
          ),
          addEnhancedEntityFields(
            ensureEntityFields({
              entity_id: 'entity_2',
              canonical_name: 'Shanghai',
              entity_type: 'LocationEntity'
            }),
            { llm_enriched: false }
          )
        ],
        relations: [
          addEnhancedRelationFields(
            ensureRelationFields({
              source_id: 'entity_1',
              target_id: 'entity_2',
              type: 'builtin',
              subtype: 'near'
            }),
            { description: 'Beijing is near Shanghai', description_method: 'template' }
          )
        ]
      };
      
      const validation = validateKnowledgeGraphSchema(kg);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
    
    it('should handle empty knowledge graphs', () => {
      const emptyKG = {
        entities: [],
        relations: []
      };
      
      const validation = validateKnowledgeGraphSchema(emptyKG);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
  
  describe('Backward Compatibility with Existing Code', () => {
    it('should work with existing entity processing functions', () => {
      // Simulate existing function that processes entities
      function getEntityNames(entities) {
        return entities.map(e => e.canonical_name);
      }
      
      const entities = [
        addEnhancedEntityFields(
          ensureEntityFields({
            entity_id: 'entity_1',
            canonical_name: 'Beijing',
            entity_type: 'LocationEntity'
          }),
          { llm_enriched: true }
        ),
        addEnhancedEntityFields(
          ensureEntityFields({
            entity_id: 'entity_2',
            canonical_name: 'Shanghai',
            entity_type: 'LocationEntity'
          }),
          { llm_enriched: true }
        )
      ];
      
      const names = getEntityNames(entities);
      
      expect(names).toEqual(['Beijing', 'Shanghai']);
    });
    
    it('should work with existing relation processing functions', () => {
      // Simulate existing function that processes relations
      function getRelationPairs(relations) {
        return relations.map(r => ({ source: r.source_id, target: r.target_id }));
      }
      
      const relations = [
        addEnhancedRelationFields(
          ensureRelationFields({
            source_id: 'entity_1',
            target_id: 'entity_2',
            type: 'builtin',
            subtype: 'located_in'
          }),
          { description: 'Test' }
        )
      ];
      
      const pairs = getRelationPairs(relations);
      
      expect(pairs).toEqual([{ source: 'entity_1', target: 'entity_2' }]);
    });
    
    it('should work with existing confidence filtering', () => {
      // Simulate existing function that filters by confidence
      function getHighConfidenceEntities(entities, threshold = 0.8) {
        return entities.filter(e => e.confidence >= threshold);
      }
      
      const entities = [
        addEnhancedEntityFields(
          ensureEntityFields({
            entity_id: 'entity_1',
            canonical_name: 'Beijing',
            entity_type: 'LocationEntity',
            confidence: 0.9
          }),
          { llm_enriched: true }
        ),
        addEnhancedEntityFields(
          ensureEntityFields({
            entity_id: 'entity_2',
            canonical_name: 'Shanghai',
            entity_type: 'LocationEntity',
            confidence: 0.7
          }),
          { llm_enriched: true }
        )
      ];
      
      const highConfidence = getHighConfidenceEntities(entities);
      
      expect(highConfidence).toHaveLength(1);
      expect(highConfidence[0].canonical_name).toBe('Beijing');
    });
  });
});
