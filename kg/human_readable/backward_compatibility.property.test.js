/**
 * Property-Based Tests for Backward Compatibility Module
 * 
 * Feature: human-readable-knowledge-graph
 * Property 11: Backward Compatibility - Field Preservation
 * Validates: Requirements 5.1, 5.2
 * 
 * Tests that enhanced knowledge graph output preserves all original fields.
 */

const fc = require('fast-check');
const {
  ORIGINAL_ENTITY_FIELDS,
  ORIGINAL_RELATION_FIELDS,
  validateEntityFieldPreservation,
  validateRelationFieldPreservation,
  addEnhancedEntityFields,
  addEnhancedRelationFields
} = require('./backward_compatibility');

describe('Property-Based Tests: Backward Compatibility', () => {
  describe('Property 11: Backward Compatibility - Field Preservation', () => {
    /**
     * Property: For any entity, when enhanced fields are added,
     * all original fields must be preserved without modification.
     */
    it('should preserve all original entity fields when adding enhancements', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary entity
          fc.record({
            entity_id: fc.string({ minLength: 1, maxLength: 50 }),
            entity_type: fc.constantFrom('LocationEntity', 'EventEntity', 'GeneralEntity', 'PhotographyEntity'),
            canonical_name: fc.string({ minLength: 1, maxLength: 100 }),
            aliases: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }),
            schemas: fc.array(
              fc.record({
                schema_name: fc.string({ minLength: 1, maxLength: 50 }),
                confidence: fc.float({ min: 0, max: 1, noNaN: true })
              }),
              { maxLength: 3 }
            ),
            supported_by: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }),
            attributes: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.string({ minLength: 1, maxLength: 100 })
            ),
            confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            created_at: fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2030-12-31").getTime() }).map(t => new Date(t).toISOString()),
            updated_at: fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2030-12-31").getTime() }).map(t => new Date(t).toISOString())
          }),
          // Generate arbitrary enhancements
          fc.record({
            llm_enriched: fc.boolean(),
            name_standardization: fc.record({
              method: fc.constantFrom('algorithm', 'llm', 'fallback'),
              confidence: fc.float({ min: 0, max: 1, noNaN: true })
            }),
            original_name: fc.string({ minLength: 1, maxLength: 100 })
          }),
          (originalEntity, enhancements) => {
            // Add enhanced fields
            const enhancedEntity = addEnhancedEntityFields(originalEntity, enhancements);
            
            // Validate field preservation
            const validation = validateEntityFieldPreservation(originalEntity, enhancedEntity);
            
            // Assert: All original fields must be preserved
            expect(validation.valid).toBe(true);
            expect(validation.missingFields).toHaveLength(0);
            expect(validation.modifiedFields).toHaveLength(0);
            
            // Assert: All original field values must be unchanged
            for (const field of ORIGINAL_ENTITY_FIELDS) {
              if (typeof originalEntity[field] !== 'object') {
                expect(enhancedEntity[field]).toEqual(originalEntity[field]);
              }
            }
            
            // Assert: Enhanced fields should be present
            for (const key of Object.keys(enhancements)) {
              expect(key in enhancedEntity).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: For any relation, when enhanced fields are added to metadata,
     * all original fields must be preserved without modification.
     */
    it('should preserve all original relation fields when adding enhancements', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary relation
          fc.record({
            source_id: fc.string({ minLength: 1, maxLength: 50 }),
            target_id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('builtin', 'semantic', 'cooccurrence', 'hierarchical'),
            subtype: fc.string({ minLength: 1, maxLength: 50 }),
            confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            evidence_ckb: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }).map(arr => JSON.stringify(arr)),
            evidence_text: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 200 })),
            metadata: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.string({ minLength: 1, maxLength: 100 })
            ).map(obj => JSON.stringify(obj))
          }),
          // Generate arbitrary enhancements
          fc.record({
            description: fc.string({ minLength: 5, maxLength: 100 }),
            description_method: fc.constantFrom('template', 'llm', 'fallback'),
            description_confidence: fc.float({ min: 0, max: 1, noNaN: true })
          }),
          (originalRelation, enhancements) => {
            // Add enhanced fields
            const enhancedRelation = addEnhancedRelationFields(originalRelation, enhancements);
            
            // Validate field preservation
            const validation = validateRelationFieldPreservation(originalRelation, enhancedRelation);
            
            // Assert: All original fields must be preserved
            expect(validation.valid).toBe(true);
            expect(validation.missingFields).toHaveLength(0);
            expect(validation.modifiedFields).toHaveLength(0);
            
            // Assert: All original field values must be unchanged (except metadata which can be extended)
            for (const field of ORIGINAL_RELATION_FIELDS) {
              if (field !== 'metadata' && typeof originalRelation[field] !== 'object') {
                expect(enhancedRelation[field]).toEqual(originalRelation[field]);
              }
            }
            
            // Assert: Original metadata fields should be preserved
            const originalMetadata = JSON.parse(originalRelation.metadata);
            const enhancedMetadata = JSON.parse(enhancedRelation.metadata);
            
            for (const key of Object.keys(originalMetadata)) {
              expect(enhancedMetadata[key]).toEqual(originalMetadata[key]);
            }
            
            // Assert: Enhanced fields should be present in metadata
            for (const key of Object.keys(enhancements)) {
              expect(key in enhancedMetadata).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: For any knowledge graph with entities and relations,
     * when enhancements are applied, the count of entities and relations
     * must remain the same.
     */
    it('should preserve entity and relation counts when adding enhancements', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary knowledge graph
          fc.record({
            entities: fc.array(
              fc.record({
                entity_id: fc.string({ minLength: 1, maxLength: 50 }),
                entity_type: fc.constantFrom('LocationEntity', 'EventEntity', 'GeneralEntity'),
                canonical_name: fc.string({ minLength: 1, maxLength: 100 }),
                aliases: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 3 }),
                schemas: fc.array(
                  fc.record({
                    schema_name: fc.string({ minLength: 1, maxLength: 50 }),
                    confidence: fc.float({ min: 0, max: 1, noNaN: true })
                  }),
                  { maxLength: 2 }
                ),
                supported_by: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 3 }),
                attributes: fc.dictionary(
                  fc.string({ minLength: 1, maxLength: 20 }),
                  fc.string({ minLength: 1, maxLength: 100 })
                ),
                confidence: fc.float({ min: 0, max: 1, noNaN: true }),
                created_at: fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2030-12-31").getTime() }).map(t => new Date(t).toISOString()),
                updated_at: fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2030-12-31").getTime() }).map(t => new Date(t).toISOString())
              }),
              { minLength: 1, maxLength: 10 }
            ),
            relations: fc.array(
              fc.record({
                source_id: fc.string({ minLength: 1, maxLength: 50 }),
                target_id: fc.string({ minLength: 1, maxLength: 50 }),
                type: fc.constantFrom('builtin', 'semantic', 'cooccurrence'),
                subtype: fc.string({ minLength: 1, maxLength: 50 }),
                confidence: fc.float({ min: 0, max: 1, noNaN: true }),
                evidence_ckb: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 3 }).map(arr => JSON.stringify(arr)),
                evidence_text: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 200 })),
                metadata: fc.dictionary(
                  fc.string({ minLength: 1, maxLength: 20 }),
                  fc.string({ minLength: 1, maxLength: 100 })
                ).map(obj => JSON.stringify(obj))
              }),
              { minLength: 0, maxLength: 10 }
            )
          }),
          (originalKG) => {
            // Create enhanced knowledge graph by adding enhancements to each entity and relation
            const enhancedKG = {
              entities: originalKG.entities.map(entity => 
                addEnhancedEntityFields(entity, {
                  llm_enriched: true,
                  name_standardization: { method: 'algorithm', confidence: 0.8 }
                })
              ),
              relations: originalKG.relations.map(relation =>
                addEnhancedRelationFields(relation, {
                  description: 'Test description',
                  description_method: 'template'
                })
              )
            };
            
            // Assert: Entity count must be preserved
            expect(enhancedKG.entities.length).toBe(originalKG.entities.length);
            
            // Assert: Relation count must be preserved
            expect(enhancedKG.relations.length).toBe(originalKG.relations.length);
            
            // Assert: All entity IDs must be preserved
            const originalEntityIds = originalKG.entities.map(e => e.entity_id).sort();
            const enhancedEntityIds = enhancedKG.entities.map(e => e.entity_id).sort();
            expect(enhancedEntityIds).toEqual(originalEntityIds);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: For any entity with arbitrary fields,
     * adding the same enhancements multiple times should be idempotent.
     */
    it('should be idempotent when adding enhancements multiple times', () => {
      fc.assert(
        fc.property(
          fc.record({
            entity_id: fc.string({ minLength: 1, maxLength: 50 }),
            entity_type: fc.constantFrom('LocationEntity', 'EventEntity', 'GeneralEntity'),
            canonical_name: fc.string({ minLength: 1, maxLength: 100 }),
            aliases: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 3 }),
            schemas: fc.array(
              fc.record({
                schema_name: fc.string({ minLength: 1, maxLength: 50 }),
                confidence: fc.float({ min: 0, max: 1, noNaN: true })
              }),
              { maxLength: 2 }
            ),
            supported_by: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 3 }),
            attributes: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.string({ minLength: 1, maxLength: 100 })
            ),
            confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            created_at: fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2030-12-31").getTime() }).map(t => new Date(t).toISOString()),
            updated_at: fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2030-12-31").getTime() }).map(t => new Date(t).toISOString())
          }),
          fc.record({
            llm_enriched: fc.boolean(),
            name_standardization: fc.record({
              method: fc.constantFrom('algorithm', 'llm', 'fallback'),
              confidence: fc.float({ min: 0, max: 1, noNaN: true })
            })
          }),
          (entity, enhancements) => {
            // Add enhancements once
            const enhanced1 = addEnhancedEntityFields(entity, enhancements);
            
            // Add same enhancements again
            const enhanced2 = addEnhancedEntityFields(enhanced1, enhancements);
            
            // Assert: Result should be the same (idempotent)
            expect(enhanced2).toEqual(enhanced1);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 12: Backward Compatibility - Schema Structure', () => {
    /**
     * Property: For any enhanced knowledge graph,
     * the schema structure must conform to the original schema.
     */
    it('should maintain valid schema structure for enhanced knowledge graphs', () => {
      const { validateKnowledgeGraphSchema } = require('./backward_compatibility');
      
      fc.assert(
        fc.property(
          // Generate arbitrary knowledge graph
          fc.record({
            entities: fc.array(
              fc.record({
                entity_id: fc.string({ minLength: 1, maxLength: 50 }),
                entity_type: fc.constantFrom('LocationEntity', 'EventEntity', 'GeneralEntity', 'PhotographyEntity'),
                canonical_name: fc.string({ minLength: 1, maxLength: 100 }),
                aliases: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }),
                schemas: fc.array(
                  fc.record({
                    schema_name: fc.string({ minLength: 1, maxLength: 50 }),
                    confidence: fc.float({ min: 0, max: 1, noNaN: true })
                  }),
                  { maxLength: 3 }
                ),
                supported_by: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }),
                attributes: fc.dictionary(
                  fc.string({ minLength: 1, maxLength: 20 }),
                  fc.string({ minLength: 1, maxLength: 100 })
                ),
                confidence: fc.float({ min: 0, max: 1, noNaN: true }),
                created_at: fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2030-12-31").getTime() }).map(t => new Date(t).toISOString()),
                updated_at: fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2030-12-31").getTime() }).map(t => new Date(t).toISOString())
              }),
              { minLength: 1, maxLength: 10 }
            ),
            relations: fc.array(
              fc.record({
                source_id: fc.string({ minLength: 1, maxLength: 50 }),
                target_id: fc.string({ minLength: 1, maxLength: 50 }),
                type: fc.constantFrom('builtin', 'semantic', 'cooccurrence', 'hierarchical'),
                subtype: fc.string({ minLength: 1, maxLength: 50 }),
                confidence: fc.float({ min: 0, max: 1, noNaN: true }),
                evidence_ckb: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }).map(arr => JSON.stringify(arr)),
                evidence_text: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 200 })),
                metadata: fc.dictionary(
                  fc.string({ minLength: 1, maxLength: 20 }),
                  fc.string({ minLength: 1, maxLength: 100 })
                ).map(obj => JSON.stringify(obj))
              }),
              { minLength: 0, maxLength: 10 }
            )
          }),
          (knowledgeGraph) => {
            // Add enhancements to create enhanced knowledge graph
            const enhancedKG = {
              entities: knowledgeGraph.entities.map(entity => 
                addEnhancedEntityFields(entity, {
                  llm_enriched: true,
                  name_standardization: { method: 'algorithm', confidence: 0.8 },
                  original_name: entity.canonical_name
                })
              ),
              relations: knowledgeGraph.relations.map(relation =>
                addEnhancedRelationFields(relation, {
                  description: 'Test description for relation',
                  description_method: 'template',
                  description_confidence: 0.9
                })
              )
            };
            
            // Validate schema structure
            const validation = validateKnowledgeGraphSchema(enhancedKG);
            
            // Assert: Schema must be valid
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
            
            // Assert: Must have entities and relations arrays
            expect(Array.isArray(enhancedKG.entities)).toBe(true);
            expect(Array.isArray(enhancedKG.relations)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: For any enhanced entity,
     * all required fields must have correct types.
     */
    it('should maintain correct field types for enhanced entities', () => {
      const { validateEntitySchema } = require('./backward_compatibility');
      
      fc.assert(
        fc.property(
          fc.record({
            entity_id: fc.string({ minLength: 1, maxLength: 50 }),
            entity_type: fc.constantFrom('LocationEntity', 'EventEntity', 'GeneralEntity'),
            canonical_name: fc.string({ minLength: 1, maxLength: 100 }),
            aliases: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }),
            schemas: fc.array(
              fc.record({
                schema_name: fc.string({ minLength: 1, maxLength: 50 }),
                confidence: fc.float({ min: 0, max: 1, noNaN: true })
              }),
              { maxLength: 3 }
            ),
            supported_by: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }),
            attributes: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.string({ minLength: 1, maxLength: 100 })
            ),
            confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            created_at: fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2030-12-31").getTime() }).map(t => new Date(t).toISOString()),
            updated_at: fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2030-12-31").getTime() }).map(t => new Date(t).toISOString())
          }),
          (entity) => {
            // Add enhancements
            const enhancedEntity = addEnhancedEntityFields(entity, {
              llm_enriched: true,
              name_standardization: { method: 'algorithm', confidence: 0.8 }
            });
            
            // Validate entity schema
            const validation = validateEntitySchema(enhancedEntity);
            
            // Assert: Schema must be valid
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
            
            // Assert: Field types must be correct
            expect(typeof enhancedEntity.entity_id).toBe('string');
            expect(typeof enhancedEntity.entity_type).toBe('string');
            expect(typeof enhancedEntity.canonical_name).toBe('string');
            expect(Array.isArray(enhancedEntity.aliases)).toBe(true);
            expect(Array.isArray(enhancedEntity.schemas)).toBe(true);
            expect(Array.isArray(enhancedEntity.supported_by)).toBe(true);
            expect(typeof enhancedEntity.attributes).toBe('object');
            expect(typeof enhancedEntity.confidence).toBe('number');
            expect(enhancedEntity.confidence).toBeGreaterThanOrEqual(0);
            expect(enhancedEntity.confidence).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: For any enhanced relation,
     * all required fields must have correct types.
     */
    it('should maintain correct field types for enhanced relations', () => {
      const { validateRelationSchema } = require('./backward_compatibility');
      
      fc.assert(
        fc.property(
          fc.record({
            source_id: fc.string({ minLength: 1, maxLength: 50 }),
            target_id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('builtin', 'semantic', 'cooccurrence', 'hierarchical'),
            subtype: fc.string({ minLength: 1, maxLength: 50 }),
            confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            evidence_ckb: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }).map(arr => JSON.stringify(arr)),
            evidence_text: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 200 })),
            metadata: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.string({ minLength: 1, maxLength: 100 })
            ).map(obj => JSON.stringify(obj))
          }),
          (relation) => {
            // Add enhancements
            const enhancedRelation = addEnhancedRelationFields(relation, {
              description: 'Test description',
              description_method: 'template',
              description_confidence: 0.9
            });
            
            // Validate relation schema
            const validation = validateRelationSchema(enhancedRelation);
            
            // Assert: Schema must be valid
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
            
            // Assert: Field types must be correct
            expect(typeof enhancedRelation.source_id).toBe('string');
            expect(typeof enhancedRelation.target_id).toBe('string');
            expect(typeof enhancedRelation.type).toBe('string');
            expect(typeof enhancedRelation.subtype).toBe('string');
            expect(typeof enhancedRelation.confidence).toBe('number');
            expect(enhancedRelation.confidence).toBeGreaterThanOrEqual(0);
            expect(enhancedRelation.confidence).toBeLessThanOrEqual(1);
            expect(typeof enhancedRelation.metadata).toBe('string');
            
            // Assert: Metadata must be valid JSON
            expect(() => JSON.parse(enhancedRelation.metadata)).not.toThrow();
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: For any knowledge graph,
     * enhanced output must be parseable by systems expecting the original format.
     */
    it('should be parseable as original format', () => {
      fc.assert(
        fc.property(
          fc.record({
            entities: fc.array(
              fc.record({
                entity_id: fc.string({ minLength: 1, maxLength: 50 }),
                entity_type: fc.constantFrom('LocationEntity', 'EventEntity', 'GeneralEntity'),
                canonical_name: fc.string({ minLength: 1, maxLength: 100 }),
                aliases: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 3 }),
                schemas: fc.array(
                  fc.record({
                    schema_name: fc.string({ minLength: 1, maxLength: 50 }),
                    confidence: fc.float({ min: 0, max: 1, noNaN: true })
                  }),
                  { maxLength: 2 }
                ),
                supported_by: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 3 }),
                attributes: fc.dictionary(
                  fc.string({ minLength: 1, maxLength: 20 }),
                  fc.string({ minLength: 1, maxLength: 100 })
                ),
                confidence: fc.float({ min: 0, max: 1, noNaN: true }),
                created_at: fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2030-12-31").getTime() }).map(t => new Date(t).toISOString()),
                updated_at: fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2030-12-31").getTime() }).map(t => new Date(t).toISOString())
              }),
              { minLength: 1, maxLength: 5 }
            ),
            relations: fc.array(
              fc.record({
                source_id: fc.string({ minLength: 1, maxLength: 50 }),
                target_id: fc.string({ minLength: 1, maxLength: 50 }),
                type: fc.constantFrom('builtin', 'semantic', 'cooccurrence'),
                subtype: fc.string({ minLength: 1, maxLength: 50 }),
                confidence: fc.float({ min: 0, max: 1, noNaN: true }),
                evidence_ckb: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 3 }).map(arr => JSON.stringify(arr)),
                evidence_text: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 200 })),
                metadata: fc.dictionary(
                  fc.string({ minLength: 1, maxLength: 20 }),
                  fc.string({ minLength: 1, maxLength: 100 })
                ).map(obj => JSON.stringify(obj))
              }),
              { minLength: 0, maxLength: 5 }
            )
          }),
          (knowledgeGraph) => {
            // Add enhancements
            const enhancedKG = {
              entities: knowledgeGraph.entities.map(entity => 
                addEnhancedEntityFields(entity, {
                  llm_enriched: true,
                  name_standardization: { method: 'algorithm', confidence: 0.8 }
                })
              ),
              relations: knowledgeGraph.relations.map(relation =>
                addEnhancedRelationFields(relation, {
                  description: 'Test description',
                  description_method: 'template'
                })
              )
            };
            
            // Serialize to JSON (simulating API response)
            const serialized = JSON.stringify(enhancedKG);
            
            // Parse back (simulating client parsing)
            const parsed = JSON.parse(serialized);
            
            // Assert: Must be parseable
            expect(parsed).toBeDefined();
            expect(parsed.entities).toBeDefined();
            expect(parsed.relations).toBeDefined();
            
            // Assert: All original fields must be accessible
            for (const entity of parsed.entities) {
              expect(entity.entity_id).toBeDefined();
              expect(entity.entity_type).toBeDefined();
              expect(entity.canonical_name).toBeDefined();
              expect(entity.aliases).toBeDefined();
              expect(entity.schemas).toBeDefined();
              expect(entity.supported_by).toBeDefined();
              expect(entity.attributes).toBeDefined();
              expect(entity.confidence).toBeDefined();
            }
            
            for (const relation of parsed.relations) {
              expect(relation.source_id).toBeDefined();
              expect(relation.target_id).toBeDefined();
              expect(relation.type).toBeDefined();
              expect(relation.subtype).toBeDefined();
              expect(relation.confidence).toBeDefined();
              expect(relation.evidence_ckb).toBeDefined();
              expect(relation.metadata).toBeDefined();
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
