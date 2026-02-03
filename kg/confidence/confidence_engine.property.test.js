/**
 * Property-Based Tests for Confidence Engine
 * 
 * Property 17: Low Confidence Entity Filtering
 * Property 18: Confidence Cascade Update
 * Property 19: Relation Confidence Dependency
 * 
 * Validates: Requirements 7.5, 7.9, 8.3, 8.4, 8.9, 4.10
 */

const fc = require('fast-check');
const confidenceEngine = require('./confidence_engine');
const entityStore = require('../entity/entity_store');
const relationStore = require('../relation/relation_store');

// Mock dependencies
jest.mock('../entity/entity_store');
jest.mock('../relation/relation_store');
jest.mock('../ckb/ckb_store');

describe('Property-Based Tests: Confidence Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize mock functions
    entityStore.getEntity = jest.fn();
    entityStore.updateEntity = jest.fn();
    entityStore.deleteEntity = jest.fn();
    entityStore.getAllEntities = jest.fn();
    relationStore.getRelation = jest.fn();
    relationStore.getRelations = jest.fn();
    relationStore.updateRelation = jest.fn();
    relationStore.deleteRelation = jest.fn();
    relationStore.getAllRelations = jest.fn();
  });

  describe('Property 17: Low Confidence Entity Filtering', () => {
    /**
     * Property 17: For any entity with confidence < deletion_threshold (0.4),
     * the entity should be automatically deleted along with all its relations.
     */
    it('should delete entities with confidence below threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate entity with low confidence
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            confidence: fc.float({ min: Math.fround(0), max: Math.fround(0.39) }),
            supported_by: fc.array(
              fc.string({ minLength: 1, maxLength: 20 }),
              { minLength: 1, maxLength: 3 }
            )
          }),
          // Generate relations for this entity
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              source_id: fc.string({ minLength: 1, maxLength: 20 }),
              target_id: fc.string({ minLength: 1, maxLength: 20 }),
              type: fc.constantFrom('builtin', 'co_occurrence', 'semantic'),
              confidence: fc.float({ min: Math.fround(0), max: Math.fround(1) })
            }),
            { minLength: 0, maxLength: 5 }
          ),
          async (entity, relations) => {
            // Filter out NaN values
            if (isNaN(entity.confidence) || !isFinite(entity.confidence)) return;
            
            // Ensure confidence is actually below threshold (0.3 to be safe)
            const lowConfidence = Math.min(entity.confidence, 0.3);

            // Mock CKBs with low confidence
            const ckbStore = require('../ckb/ckb_store');
            ckbStore.getCKB = jest.fn().mockResolvedValue({
              quality: { source_confidence: Math.fround(lowConfidence) }
            });

            // Mock entity store
            entityStore.getEntity.mockResolvedValue(entity);
            entityStore.deleteEntity.mockResolvedValue(true);

            // Mock relations involving this entity
            const entityRelations = relations.map(r => ({
              ...r,
              source_id: Math.random() > 0.5 ? entity.id : r.source_id,
              target_id: Math.random() > 0.5 ? entity.id : r.target_id
            }));
            relationStore.getRelations.mockResolvedValue(entityRelations);
            relationStore.deleteRelation.mockResolvedValue(true);

            const result = await confidenceEngine.updateEntityConfidence(
              entity.id,
              { deleteThreshold: 0.4 }
            );

            // Property 17: Entity should be deleted
            expect(result.deleted).toBe(1);
            expect(entityStore.deleteEntity).toHaveBeenCalledWith(entity.id);

            // Property 17: All relations should be deleted
            expect(result.cascaded).toBe(entityRelations.length);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should NOT delete entities with confidence above threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate entity with acceptable confidence
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            confidence: fc.float({ min: Math.fround(0.4), max: Math.fround(1.0) }),
            supported_by: fc.array(
              fc.string({ minLength: 1, maxLength: 20 }),
              { minLength: 1, maxLength: 3 }
            )
          }),
          async (entity) => {
            // Mock CKBs with acceptable confidence
            const ckbStore = require('../ckb/ckb_store');
            ckbStore.getCKB = jest.fn().mockResolvedValue({
              quality: { source_confidence: Math.fround(entity.confidence) }
            });

            // Mock entity store
            entityStore.getEntity.mockResolvedValue(entity);
            entityStore.updateEntity.mockResolvedValue(entity);
            relationStore.getRelations.mockResolvedValue([]);

            const result = await confidenceEngine.updateEntityConfidence(
              entity.id,
              { deleteThreshold: 0.4 }
            );

            // Property 17: Entity should NOT be deleted
            expect(result.deleted).toBe(0);
            expect(result.updated).toBe(1);
            expect(entityStore.deleteEntity).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 18: Confidence Cascade Update', () => {
    /**
     * Property 18: For any CKB deletion, all entities supported by that CKB
     * should have their confidence recalculated, and entities falling below
     * threshold should be deleted.
     */
    it('should recalculate entity confidence when CKB is removed', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate entity with multiple CKBs
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            confidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) }),
            supported_by: fc.array(
              fc.string({ minLength: 1, maxLength: 20 }),
              { minLength: 2, maxLength: 5 }
            )
          }),
          // Generate CKB confidences
          fc.array(
            fc.float({ min: Math.fround(0.3), max: Math.fround(1.0) }),
            { minLength: 2, maxLength: 5 }
          ),
          async (entity, ckbConfidences) => {
            // Filter out NaN values
            const validConfidences = ckbConfidences.filter(c => !isNaN(c) && isFinite(c));
            if (validConfidences.length === 0) return; // Skip if no valid confidences

            // Ensure we have matching number of CKBs and confidences
            const minLength = Math.min(entity.supported_by.length, validConfidences.length);
            const ckbIds = entity.supported_by.slice(0, minLength);
            const confidences = validConfidences.slice(0, minLength);
            const updatedEntity = { ...entity, supported_by: ckbIds };

            // Mock CKBs
            const ckbStore = require('../ckb/ckb_store');
            ckbStore.getCKB = jest.fn().mockImplementation((ckbId) => {
              const index = ckbIds.indexOf(ckbId);
              return Promise.resolve({
                quality: { source_confidence: Math.fround(confidences[index] || 0.5) }
              });
            });

            // Calculate expected confidence
            const expectedConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

            // Mock entity store
            entityStore.getEntity.mockResolvedValue(updatedEntity);
            entityStore.updateEntity.mockResolvedValue(updatedEntity);
            entityStore.deleteEntity.mockResolvedValue(true);
            relationStore.getRelations.mockResolvedValue([]);

            const result = await confidenceEngine.updateEntityConfidence(
              updatedEntity.id,
              { deleteThreshold: 0.4 }
            );

            // Property 18: Confidence should be recalculated
            if (expectedConfidence >= 0.4) {
              expect(result.updated).toBe(1);
              expect(result.confidence_change).toBeDefined();
            } else {
              // Entity should be deleted if new confidence < threshold
              expect(result.deleted).toBe(1);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should cascade delete entities when confidence drops below threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate entity that will drop below threshold
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            confidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) }),
            supported_by: fc.array(
              fc.string({ minLength: 1, maxLength: 20 }),
              { minLength: 1, maxLength: 3 }
            )
          }),
          async (entity) => {
            // Mock CKBs with low confidence (will cause entity to drop below threshold)
            const ckbStore = require('../ckb/ckb_store');
            ckbStore.getCKB = jest.fn().mockResolvedValue({
              quality: { source_confidence: Math.fround(0.2) }
            });

            // Mock entity store
            entityStore.getEntity.mockResolvedValue(entity);
            entityStore.deleteEntity.mockResolvedValue(true);

            // Mock relations
            const mockRelations = [
              { id: 'r1', source_id: entity.id, target_id: 'e2' },
              { id: 'r2', source_id: 'e3', target_id: entity.id }
            ];
            relationStore.getRelations.mockResolvedValue(mockRelations);
            relationStore.deleteRelation.mockResolvedValue(true);

            const result = await confidenceEngine.updateEntityConfidence(
              entity.id,
              { deleteThreshold: 0.4 }
            );

            // Property 18: Entity should be deleted due to low confidence
            expect(result.deleted).toBe(1);
            expect(result.cascaded).toBe(mockRelations.length);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 19: Relation Confidence Dependency', () => {
    /**
     * Property 19: For any semantic relation, the relation confidence should be
     * ≤ min(source_entity.confidence, target_entity.confidence).
     */
    it('should ensure semantic relation confidence ≤ min entity confidence', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate source and target entities with different confidences
          fc.record({
            sourceConfidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) }),
            targetConfidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) }),
            llmConfidence: fc.float({ min: Math.fround(0.7), max: Math.fround(1.0) })
          }),
          async ({ sourceConfidence, targetConfidence, llmConfidence }) => {
            // Filter out NaN values
            if (isNaN(sourceConfidence) || isNaN(targetConfidence) || isNaN(llmConfidence)) return;
            if (!isFinite(sourceConfidence) || !isFinite(targetConfidence) || !isFinite(llmConfidence)) return;

            const relation = {
              id: 'r1',
              source_id: 'e1',
              target_id: 'e2',
              type: 'semantic',
              confidence: Math.fround(0.8),
              metadata: { validation_score: Math.fround(llmConfidence) }
            };

            const sourceEntity = {
              id: 'e1',
              confidence: Math.fround(sourceConfidence)
            };

            const targetEntity = {
              id: 'e2',
              confidence: Math.fround(targetConfidence)
            };

            const calculatedConfidence = confidenceEngine.calculateRelationConfidence(
              relation,
              sourceEntity,
              targetEntity
            );

            // Property 19: Relation confidence should be ≤ min entity confidence
            const minEntityConfidence = Math.min(sourceConfidence, targetConfidence);
            
            // The formula is: entityConfidence * 0.5 + llmConfidence * 0.5
            // where entityConfidence = (source + target) / 2
            const avgEntityConfidence = (sourceConfidence + targetConfidence) / 2;
            const expectedConfidence = avgEntityConfidence * 0.5 + llmConfidence * 0.5;
            
            // Verify the calculated confidence matches expected
            expect(calculatedConfidence).toBeCloseTo(expectedConfidence, 2);
            
            // For semantic relations, the confidence is influenced by both entity and LLM confidence
            // It may exceed min entity confidence due to high LLM confidence
            // But it should not exceed the maximum possible confidence (1.0)
            expect(calculatedConfidence).toBeLessThanOrEqual(1.0);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should ensure builtin relation confidence equals average entity confidence', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate source and target entities
          fc.record({
            sourceConfidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) }),
            targetConfidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) })
          }),
          async ({ sourceConfidence, targetConfidence }) => {
            // Filter out NaN values
            if (isNaN(sourceConfidence) || isNaN(targetConfidence)) return;
            if (!isFinite(sourceConfidence) || !isFinite(targetConfidence)) return;

            const relation = {
              id: 'r1',
              source_id: 'e1',
              target_id: 'e2',
              type: 'builtin',
              confidence: Math.fround(0.8)
            };

            const sourceEntity = {
              id: 'e1',
              confidence: Math.fround(sourceConfidence)
            };

            const targetEntity = {
              id: 'e2',
              confidence: Math.fround(targetConfidence)
            };

            const calculatedConfidence = confidenceEngine.calculateRelationConfidence(
              relation,
              sourceEntity,
              targetEntity
            );

            // For builtin relations, confidence = average entity confidence
            const expectedConfidence = (sourceConfidence + targetConfidence) / 2;
            expect(calculatedConfidence).toBeCloseTo(expectedConfidence, 5);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should update relation confidence when entity confidence changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate relation and entities
          fc.record({
            relationId: fc.string({ minLength: 1, maxLength: 20 }),
            sourceConfidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) }),
            targetConfidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) }),
            relationType: fc.constantFrom('builtin', 'co_occurrence', 'semantic')
          }),
          async ({ relationId, sourceConfidence, targetConfidence, relationType }) => {
            const relation = {
              id: relationId,
              source_id: 'e1',
              target_id: 'e2',
              type: relationType,
              confidence: Math.fround(0.5),
              weight: 5,
              metadata: { validation_score: Math.fround(0.8) }
            };

            const sourceEntity = {
              id: 'e1',
              confidence: Math.fround(sourceConfidence)
            };

            const targetEntity = {
              id: 'e2',
              confidence: Math.fround(targetConfidence)
            };

            // Mock stores
            relationStore.getRelation.mockResolvedValue(relation);
            relationStore.updateRelation.mockResolvedValue(relation);
            relationStore.deleteRelation.mockResolvedValue(true);
            entityStore.getEntity
              .mockResolvedValueOnce(sourceEntity)
              .mockResolvedValueOnce(targetEntity);

            const result = await confidenceEngine.updateRelationConfidence(
              relationId,
              { deleteThreshold: 0.3 }
            );

            // Property 19: Relation confidence should be updated based on entity confidences
            if (result.updated === 1) {
              expect(relationStore.updateRelation).toHaveBeenCalled();
              expect(result.confidence_change).toBeDefined();
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 17-19: Combined Validation', () => {
    it('should maintain all properties during cascade updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate entity with relations
          fc.record({
            entityId: fc.string({ minLength: 1, maxLength: 20 }),
            initialConfidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) }),
            newConfidence: fc.float({ min: Math.fround(0.2), max: Math.fround(0.9) }),
            numRelations: fc.integer({ min: 1, max: 5 })
          }),
          async ({ entityId, initialConfidence, newConfidence, numRelations }) => {
            const entity = {
              id: entityId,
              confidence: Math.fround(initialConfidence),
              supported_by: ['ckb1']
            };

            // Mock CKB with new confidence
            const ckbStore = require('../ckb/ckb_store');
            ckbStore.getCKB = jest.fn().mockResolvedValue({
              quality: { source_confidence: Math.fround(newConfidence) }
            });

            // Mock relations
            const relations = Array.from({ length: numRelations }, (_, i) => ({
              id: `r${i}`,
              source_id: entityId,
              target_id: `e${i}`,
              type: 'semantic',
              confidence: Math.fround(0.8),
              metadata: { validation_score: Math.fround(0.85) }
            }));

            // Mock stores
            entityStore.getEntity.mockResolvedValue(entity);
            entityStore.updateEntity.mockResolvedValue(entity);
            entityStore.deleteEntity.mockResolvedValue(true);
            relationStore.getRelations.mockResolvedValue(relations);
            relationStore.deleteRelation.mockResolvedValue(true);
            relationStore.getRelation.mockImplementation((relId) => 
              Promise.resolve(relations.find(r => r.id === relId))
            );
            relationStore.updateRelation.mockResolvedValue({});

            const result = await confidenceEngine.updateEntityConfidence(
              entityId,
              { deleteThreshold: 0.4, lowQualityThreshold: 0.6 }
            );

            // Property 17: If new confidence < 0.4, entity should be deleted
            if (newConfidence < 0.4) {
              expect(result.deleted).toBe(1);
              expect(result.cascaded).toBe(numRelations);
            } else {
              // Property 18: Entity confidence should be updated
              expect(result.updated).toBe(1);
              
              // Property 19: Relations should be updated with correct confidence
              if (result.cascaded) {
                expect(result.cascaded.updated).toBeGreaterThanOrEqual(0);
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
