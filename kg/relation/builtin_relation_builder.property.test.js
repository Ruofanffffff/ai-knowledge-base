/**
 * Property-Based Tests for Built-in Relation Builder
 * 
 * Tests universal properties that should hold for all built-in relations.
 */

const fc = require('fast-check');
const {
  buildRelations,
  buildRelationFromTemplate,
  validateRelation,
  buildRelationsBatch
} = require('./builtin_relation_builder');

// Mock entity store
jest.mock('../entity/entity_store', () => ({
  getEntityByCanonicalName: jest.fn(),
  searchEntities: jest.fn(),
  saveEntity: jest.fn()
}));

const entityStore = require('../entity/entity_store');

describe('Built-in Relation Builder - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 12: Built-in Relation Determinism
   * 
   * For any entity instantiated from a schema with relation templates,
   * the same set of built-in relations should be generated every time
   * (given the same target entities exist).
   * 
   * **Validates: Requirements 5.1, 5.2, 5.7**
   */
  describe('Property 12: Built-in Relation Determinism', () => {
    test('should generate identical relations for the same entity and schema', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary entity
          fc.record({
            entity_id: fc.string({ minLength: 5, maxLength: 20 }),
            entity_type: fc.constantFrom('LocationEntity', 'TimeEntity', 'EventEntity'),
            canonical_name: fc.string({ minLength: 3, maxLength: 30 }),
            schemas: fc.array(
              fc.record({
                schema_name: fc.string({ minLength: 3, maxLength: 20 })
              }),
              { minLength: 1, maxLength: 1 }
            )
          }),
          // Generate arbitrary schema with relation templates
          fc.record({
            schema_name: fc.string({ minLength: 3, maxLength: 20 }),
            relations: fc.array(
              fc.record({
                type: fc.constantFrom('located_in', 'occurred_at', 'has_attribute'),
                target_field: fc.constantFrom('区域', '时间', '指标'),
                direction: fc.constantFrom('outgoing', 'incoming')
              }),
              { minLength: 1, maxLength: 3 }
            )
          }),
          // Generate arbitrary fields
          fc.array(
            fc.record({
              name: fc.constantFrom('区域', '时间', '指标', '数值'),
              value: fc.string({ minLength: 2, maxLength: 20 }),
              type: fc.constantFrom('location', 'time', 'indicator', 'number')
            }),
            { minLength: 1, maxLength: 5 }
          ),
          // Generate CKB IDs
          fc.array(fc.string({ minLength: 5, maxLength: 15 }), { minLength: 1, maxLength: 3 }),
          async (entity, schema, fields, ckbIds) => {
            // Mock entity store to return consistent target entities
            const mockTargetEntity = {
              entity_id: 'target_entity_123',
              canonical_name: 'Target Entity',
              entity_type: 'AttributeEntity'
            };

            entityStore.getEntityByCanonicalName.mockResolvedValue(mockTargetEntity);
            entityStore.searchEntities.mockResolvedValue([mockTargetEntity]);
            entityStore.saveEntity.mockResolvedValue(mockTargetEntity);

            // Build relations twice with the same inputs
            const relations1 = await buildRelations(entity, schema, fields, ckbIds);
            const relations2 = await buildRelations(entity, schema, fields, ckbIds);

            // Property: Relations should be identical (deterministic)
            expect(relations1.length).toBe(relations2.length);

            for (let i = 0; i < relations1.length; i++) {
              expect(relations1[i].source_id).toBe(relations2[i].source_id);
              expect(relations1[i].target_id).toBe(relations2[i].target_id);
              expect(relations1[i].type).toBe(relations2[i].type);
              expect(relations1[i].subtype).toBe(relations2[i].subtype);
              expect(relations1[i].confidence).toBe(relations2[i].confidence);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should generate consistent relations across multiple runs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entity_id: fc.string({ minLength: 5, maxLength: 20 }),
            entity_type: fc.constantFrom('EventEntity', 'LocationEntity'),
            canonical_name: fc.string({ minLength: 3, maxLength: 30 }),
            schemas: fc.array(
              fc.record({
                schema_name: fc.string({ minLength: 3, maxLength: 20 })
              }),
              { minLength: 1, maxLength: 1 }
            )
          }),
          fc.record({
            schema_name: fc.string({ minLength: 3, maxLength: 20 }),
            relations: fc.array(
              fc.record({
                type: fc.constantFrom('located_in', 'occurred_at'),
                target_field: fc.constantFrom('区域', '时间'),
                direction: fc.constant('outgoing')
              }),
              { minLength: 1, maxLength: 2 }
            )
          }),
          fc.array(
            fc.record({
              name: fc.constantFrom('区域', '时间'),
              value: fc.string({ minLength: 2, maxLength: 20 }),
              type: fc.constantFrom('location', 'time')
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (entity, schema, fields) => {
            const mockTargetEntity = {
              entity_id: 'consistent_target',
              canonical_name: 'Consistent Target',
              entity_type: 'LocationEntity'
            };

            entityStore.getEntityByCanonicalName.mockResolvedValue(mockTargetEntity);
            entityStore.searchEntities.mockResolvedValue([mockTargetEntity]);
            entityStore.saveEntity.mockResolvedValue(mockTargetEntity);

            // Run multiple times
            const results = [];
            for (let i = 0; i < 3; i++) {
              const relations = await buildRelations(entity, schema, fields, []);
              results.push(relations);
            }

            // Property: All runs should produce the same number of relations
            const firstLength = results[0].length;
            for (const result of results) {
              expect(result.length).toBe(firstLength);
            }

            // Property: Relation types should be consistent
            if (firstLength > 0) {
              const firstTypes = results[0].map(r => r.subtype).sort();
              for (const result of results) {
                const types = result.map(r => r.subtype).sort();
                expect(types).toEqual(firstTypes);
              }
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Property 13: Built-in Relation Confidence
   * 
   * For any built-in relation generated from schema templates,
   * the confidence should always be 1.0 (deterministic relation).
   * 
   * **Validates: Requirements 5.1, 5.2, 5.7**
   */
  describe('Property 13: Built-in Relation Confidence', () => {
    test('all built-in relations should have confidence = 1.0', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entity_id: fc.string({ minLength: 5, maxLength: 20 }),
            entity_type: fc.constantFrom('EventEntity', 'LocationEntity', 'TimeEntity'),
            canonical_name: fc.string({ minLength: 3, maxLength: 30 }),
            schemas: fc.array(
              fc.record({
                schema_name: fc.string({ minLength: 3, maxLength: 20 })
              }),
              { minLength: 1, maxLength: 1 }
            )
          }),
          fc.record({
            schema_name: fc.string({ minLength: 3, maxLength: 20 }),
            relations: fc.array(
              fc.record({
                type: fc.constantFrom('located_in', 'occurred_at', 'has_attribute', 'caused_by'),
                target_field: fc.constantFrom('区域', '时间', '指标', '原因'),
                direction: fc.constantFrom('outgoing', 'incoming')
              }),
              { minLength: 1, maxLength: 4 }
            )
          }),
          fc.array(
            fc.record({
              name: fc.constantFrom('区域', '时间', '指标', '原因', '数值'),
              value: fc.string({ minLength: 2, maxLength: 20 }),
              type: fc.constantFrom('location', 'time', 'indicator', 'entity', 'number')
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.array(fc.string({ minLength: 5, maxLength: 15 }), { minLength: 1, maxLength: 3 }),
          async (entity, schema, fields, ckbIds) => {
            const mockTargetEntity = {
              entity_id: 'target_entity_456',
              canonical_name: 'Target Entity',
              entity_type: 'AttributeEntity'
            };

            entityStore.getEntityByCanonicalName.mockResolvedValue(mockTargetEntity);
            entityStore.searchEntities.mockResolvedValue([mockTargetEntity]);
            entityStore.saveEntity.mockResolvedValue(mockTargetEntity);

            const relations = await buildRelations(entity, schema, fields, ckbIds);

            // Property: All built-in relations must have confidence = 1.0
            for (const relation of relations) {
              expect(relation.type).toBe('builtin');
              expect(relation.confidence).toBe(1.0);
            }
          }
        ),
        { numRuns: 25 }
      );
    });

    test('confidence should remain 1.0 regardless of entity or field variations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entity_id: fc.string({ minLength: 5, maxLength: 20 }),
            entity_type: fc.constantFrom('EventEntity', 'LocationEntity'),
            canonical_name: fc.string({ minLength: 3, maxLength: 30 }),
            schemas: fc.array(
              fc.record({
                schema_name: fc.string({ minLength: 3, maxLength: 20 })
              }),
              { minLength: 1, maxLength: 1 }
            )
          }),
          fc.record({
            schema_name: fc.string({ minLength: 3, maxLength: 20 }),
            relations: fc.array(
              fc.record({
                type: fc.string({ minLength: 3, maxLength: 15 }),
                target_field: fc.constantFrom('区域', '时间'),
                direction: fc.constantFrom('outgoing', 'incoming')
              }),
              { minLength: 1, maxLength: 2 }
            )
          }),
          fc.array(
            fc.record({
              name: fc.constantFrom('区域', '时间'),
              value: fc.string({ minLength: 1, maxLength: 50 }), // Vary value length
              type: fc.constantFrom('location', 'time')
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (entity, schema, fields) => {
            const mockTargetEntity = {
              entity_id: 'target_entity_789',
              canonical_name: 'Target Entity',
              entity_type: 'LocationEntity'
            };

            entityStore.getEntityByCanonicalName.mockResolvedValue(mockTargetEntity);
            entityStore.searchEntities.mockResolvedValue([mockTargetEntity]);
            entityStore.saveEntity.mockResolvedValue(mockTargetEntity);

            const relations = await buildRelations(entity, schema, fields, []);

            // Property: Confidence is always 1.0, regardless of variations
            for (const relation of relations) {
              expect(relation.confidence).toBe(1.0);
              expect(relation.type).toBe('builtin');
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('batch processing should maintain confidence = 1.0 for all relations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              entity: fc.record({
                entity_id: fc.string({ minLength: 5, maxLength: 20 }),
                entity_type: fc.constantFrom('EventEntity', 'LocationEntity'),
                canonical_name: fc.string({ minLength: 3, maxLength: 30 }),
                schemas: fc.array(
                  fc.record({
                    schema_name: fc.string({ minLength: 3, maxLength: 20 })
                  }),
                  { minLength: 1, maxLength: 1 }
                )
              }),
              schema: fc.record({
                schema_name: fc.string({ minLength: 3, maxLength: 20 }),
                relations: fc.array(
                  fc.record({
                    type: fc.constantFrom('located_in', 'occurred_at'),
                    target_field: fc.constantFrom('区域', '时间'),
                    direction: fc.constant('outgoing')
                  }),
                  { minLength: 1, maxLength: 2 }
                )
              }),
              fields: fc.array(
                fc.record({
                  name: fc.constantFrom('区域', '时间'),
                  value: fc.string({ minLength: 2, maxLength: 20 }),
                  type: fc.constantFrom('location', 'time')
                }),
                { minLength: 1, maxLength: 3 }
              ),
              ckbIds: fc.array(fc.string({ minLength: 5, maxLength: 15 }), { minLength: 1, maxLength: 2 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (entitiesData) => {
            const mockTargetEntity = {
              entity_id: 'batch_target',
              canonical_name: 'Batch Target',
              entity_type: 'LocationEntity'
            };

            entityStore.getEntityByCanonicalName.mockResolvedValue(mockTargetEntity);
            entityStore.searchEntities.mockResolvedValue([mockTargetEntity]);
            entityStore.saveEntity.mockResolvedValue(mockTargetEntity);

            const allRelations = await buildRelationsBatch(entitiesData);

            // Property: All relations in batch should have confidence = 1.0
            for (const relation of allRelations) {
              expect(relation.type).toBe('builtin');
              expect(relation.confidence).toBe(1.0);
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Additional Property: Relation Validation
   * 
   * All generated relations should pass validation checks.
   */
  describe('Additional Property: Relation Validation', () => {
    test('all generated relations should be valid', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entity_id: fc.string({ minLength: 5, maxLength: 20 }),
            entity_type: fc.constantFrom('EventEntity', 'LocationEntity'),
            canonical_name: fc.string({ minLength: 3, maxLength: 30 }),
            schemas: fc.array(
              fc.record({
                schema_name: fc.string({ minLength: 3, maxLength: 20 })
              }),
              { minLength: 1, maxLength: 1 }
            )
          }),
          fc.record({
            schema_name: fc.string({ minLength: 3, maxLength: 20 }),
            relations: fc.array(
              fc.record({
                type: fc.constantFrom('located_in', 'occurred_at'),
                target_field: fc.constantFrom('区域', '时间'),
                direction: fc.constant('outgoing')
              }),
              { minLength: 1, maxLength: 2 }
            )
          }),
          fc.array(
            fc.record({
              name: fc.constantFrom('区域', '时间'),
              value: fc.string({ minLength: 2, maxLength: 20 }),
              type: fc.constantFrom('location', 'time')
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (entity, schema, fields) => {
            const mockTargetEntity = {
              entity_id: 'valid_target',
              canonical_name: 'Valid Target',
              entity_type: 'LocationEntity'
            };

            entityStore.getEntityByCanonicalName.mockResolvedValue(mockTargetEntity);
            entityStore.searchEntities.mockResolvedValue([mockTargetEntity]);
            entityStore.saveEntity.mockResolvedValue(mockTargetEntity);

            const relations = await buildRelations(entity, schema, fields, []);

            // Property: All relations should pass validation
            for (const relation of relations) {
              const validation = validateRelation(relation);
              expect(validation.valid).toBe(true);
              expect(relation.source_id).toBeTruthy();
              expect(relation.target_id).toBeTruthy();
              expect(relation.source_id).not.toBe(relation.target_id);
              expect(relation.confidence).toBeGreaterThanOrEqual(0);
              expect(relation.confidence).toBeLessThanOrEqual(1);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
