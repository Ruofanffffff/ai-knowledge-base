/**
 * Property-Based Tests for Cooccurrence Relation Builder
 * 
 * Tests universal properties that should hold for all cooccurrence relations.
 */

const fc = require('fast-check');
const {
  buildCooccurrenceRelations,
  updateCooccurrenceRelations,
  removeCooccurrenceRelations
} = require('./cooccurrence_relation_builder');

// Mock relation store
jest.mock('./relation_store', () => ({
  findRelation: jest.fn(),
  createRelation: jest.fn(),
  updateRelation: jest.fn(),
  deleteRelation: jest.fn(),
  findRelationsByEvidence: jest.fn(),
  getRelations: jest.fn()
}));

const relationStore = require('./relation_store');

describe('Cooccurrence Relation Builder - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 14: Co-occurrence Relation Weight Calculation
   * 
   * For any pair of entities, the co-occurrence relation weight should equal:
   * co_occurrence_count × average(source_confidence_values),
   * and should only be created if weight ≥ threshold.
   * 
   * **Validates: Requirements 6.3, 6.4**
   */
  describe('Property 14: Co-occurrence Relation Weight Calculation', () => {
    test('weight should equal count × average source confidence', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of CKBs with the same entity pair
          fc.array(
            fc.record({
              ckb_id: fc.string({ minLength: 5, maxLength: 15 }),
              entities: fc.constant([
                { id: 'entity_a', canonical_name: 'Entity A' },
                { id: 'entity_b', canonical_name: 'Entity B' }
              ]),
              quality: fc.record({
                source_confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) })
              })
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (ckbs) => {
            const result = await buildCooccurrenceRelations(ckbs, {
              weightThreshold: 0.1,
              minCooccurrences: 1
            });

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);

            const relation = result[0];
            const count = ckbs.length;
            const avgConfidence = ckbs.reduce((sum, ckb) => 
              sum + ckb.quality.source_confidence, 0) / count;
            const expectedWeight = count * avgConfidence;

            // Property: weight = count × average confidence
            expect(relation.weight).toBeCloseTo(expectedWeight, 2);
            expect(relation.metadata.cooccurrence_count).toBe(count);
            expect(relation.metadata.avg_source_weight).toBeCloseTo(avgConfidence, 2);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('relations should only be created if weight >= threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              ckb_id: fc.string({ minLength: 5, maxLength: 15 }),
              entities: fc.constant([
                { id: 'entity_a', canonical_name: 'Entity A' },
                { id: 'entity_b', canonical_name: 'Entity B' }
              ]),
              quality: fc.record({
                source_confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) })
              })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.float({ min: Math.fround(0.1), max: Math.fround(2.0) }),
          async (ckbs, threshold) => {
            // Filter out NaN values
            const validCkbs = ckbs.filter(ckb => 
              !isNaN(ckb.quality.source_confidence)
            );

            if (validCkbs.length === 0) {
              return; // Skip if no valid CKBs
            }

            const result = await buildCooccurrenceRelations(validCkbs, {
              weightThreshold: threshold,
              minCooccurrences: 1
            });

            // Calculate expected weight
            const count = validCkbs.length;
            const avgConfidence = validCkbs.reduce((sum, ckb) => 
              sum + ckb.quality.source_confidence, 0) / count;
            const weight = count * avgConfidence;

            // Property: relation created only if weight >= threshold
            if (weight >= threshold) {
              expect(result.length).toBeGreaterThan(0);
              expect(result[0].weight).toBeGreaterThanOrEqual(threshold);
            } else {
              expect(result.length).toBe(0);
            }
          }
        ),
        { numRuns: 25 }
      );
    });

    test('weight should respect minCooccurrences threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              ckb_id: fc.string({ minLength: 5, maxLength: 15 }),
              entities: fc.constant([
                { id: 'entity_a', canonical_name: 'Entity A' },
                { id: 'entity_b', canonical_name: 'Entity B' }
              ]),
              quality: fc.record({
                source_confidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) })
              })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.integer({ min: 1, max: 5 }),
          async (ckbs, minCooccurrences) => {
            const result = await buildCooccurrenceRelations(ckbs, {
              weightThreshold: 0.1,
              minCooccurrences
            });

            // Property: relation created only if count >= minCooccurrences
            if (ckbs.length >= minCooccurrences) {
              expect(result.length).toBeGreaterThan(0);
              expect(result[0].metadata.cooccurrence_count).toBeGreaterThanOrEqual(minCooccurrences);
            } else {
              expect(result.length).toBe(0);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('confidence should be normalized to 0-1 range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              ckb_id: fc.string({ minLength: 5, maxLength: 15 }),
              entities: fc.constant([
                { id: 'entity_a', canonical_name: 'Entity A' },
                { id: 'entity_b', canonical_name: 'Entity B' }
              ]),
              quality: fc.record({
                source_confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) })
              })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (ckbs) => {
            const result = await buildCooccurrenceRelations(ckbs, {
              weightThreshold: 0.1,
              minCooccurrences: 1
            });

            if (result.length > 0) {
              const relation = result[0];
              
              // Property: confidence is normalized (weight / 10, capped at 1.0)
              expect(relation.confidence).toBeGreaterThanOrEqual(0);
              expect(relation.confidence).toBeLessThanOrEqual(1);
              expect(relation.confidence).toBeCloseTo(Math.min(relation.weight / 10, 1.0), 2);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 15: Co-occurrence Relation Symmetry
   * 
   * For any two entities A and B, if a co-occurrence relation exists from A to B,
   * the weight and evidence_ckb should be identical to the relation from B to A
   * (undirected relation).
   * 
   * **Validates: Requirements 6.3, 6.4**
   */
  describe('Property 15: Co-occurrence Relation Symmetry', () => {
    test('relation should be symmetric (A-B same as B-A)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              ckb_id: fc.string({ minLength: 5, maxLength: 15 }),
              entities: fc.shuffledSubarray(
                [
                  { id: 'entity_a', canonical_name: 'Entity A' },
                  { id: 'entity_b', canonical_name: 'Entity B' }
                ],
                { minLength: 2, maxLength: 2 }
              ),
              quality: fc.record({
                source_confidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) })
              })
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (ckbs) => {
            const result = await buildCooccurrenceRelations(ckbs, {
              weightThreshold: 0.5,
              minCooccurrences: 1
            });

            expect(result).toBeDefined();
            
            if (result.length > 0) {
              const relation = result[0];
              
              // Property: Relation should connect entity_a and entity_b
              // regardless of order in CKB
              const hasEntityA = relation.source_id === 'entity_a' || relation.target_id === 'entity_a';
              const hasEntityB = relation.source_id === 'entity_b' || relation.target_id === 'entity_b';
              
              expect(hasEntityA).toBe(true);
              expect(hasEntityB).toBe(true);
              
              // Property: Only one relation should exist for the pair
              // (not separate A->B and B->A)
              expect(result.length).toBe(1);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('relation weight should be independent of entity order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              ckb_id: fc.string({ minLength: 5, maxLength: 15 }),
              quality: fc.record({
                source_confidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) })
              })
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (ckbData) => {
            // Create two sets of CKBs with different entity orders
            const ckbsAB = ckbData.map(data => ({
              ...data,
              entities: [
                { id: 'entity_a', canonical_name: 'Entity A' },
                { id: 'entity_b', canonical_name: 'Entity B' }
              ]
            }));

            const ckbsBA = ckbData.map(data => ({
              ...data,
              entities: [
                { id: 'entity_b', canonical_name: 'Entity B' },
                { id: 'entity_a', canonical_name: 'Entity A' }
              ]
            }));

            const resultAB = await buildCooccurrenceRelations(ckbsAB, {
              weightThreshold: 0.5,
              minCooccurrences: 1
            });

            const resultBA = await buildCooccurrenceRelations(ckbsBA, {
              weightThreshold: 0.5,
              minCooccurrences: 1
            });

            // Property: Weight should be the same regardless of entity order
            if (resultAB.length > 0 && resultBA.length > 0) {
              expect(resultAB[0].weight).toBeCloseTo(resultBA[0].weight, 2);
              expect(resultAB[0].confidence).toBeCloseTo(resultBA[0].confidence, 2);
              expect(resultAB[0].metadata.cooccurrence_count).toBe(resultBA[0].metadata.cooccurrence_count);
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    test('evidence_ckb should be identical for symmetric relations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              ckb_id: fc.string({ minLength: 5, maxLength: 15 }),
              entities: fc.constant([
                { id: 'entity_a', canonical_name: 'Entity A' },
                { id: 'entity_b', canonical_name: 'Entity B' }
              ]),
              quality: fc.record({
                source_confidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) })
              })
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (ckbs) => {
            const result = await buildCooccurrenceRelations(ckbs, {
              weightThreshold: 0.5,
              minCooccurrences: 1
            });

            if (result.length > 0) {
              const relation = result[0];
              const expectedCkbIds = ckbs.map(ckb => ckb.ckb_id);

              // Property: evidence_ckb should contain all CKB IDs
              expect(relation.evidence_ckb).toHaveLength(expectedCkbIds.length);
              
              for (const ckbId of expectedCkbIds) {
                expect(relation.evidence_ckb).toContain(ckbId);
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('multiple entity pairs should create separate symmetric relations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              ckb_id: fc.string({ minLength: 5, maxLength: 15 }),
              entities: fc.constant([
                { id: 'entity_a', canonical_name: 'Entity A' },
                { id: 'entity_b', canonical_name: 'Entity B' },
                { id: 'entity_c', canonical_name: 'Entity C' }
              ]),
              quality: fc.record({
                source_confidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) })
              })
            }),
            { minLength: 2, maxLength: 3 }
          ),
          async (ckbs) => {
            const result = await buildCooccurrenceRelations(ckbs, {
              weightThreshold: 0.5,
              minCooccurrences: 1
            });

            // Property: Should create 3 relations (A-B, A-C, B-C)
            // Each relation is symmetric (undirected)
            expect(result.length).toBe(3);

            // Property: Each relation should have the same weight
            // (since all pairs cooccur in the same CKBs)
            const weights = result.map(r => r.weight);
            const firstWeight = weights[0];
            for (const weight of weights) {
              expect(weight).toBeCloseTo(firstWeight, 2);
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Additional Property: Incremental Update Consistency
   * 
   * When updating cooccurrence relations incrementally,
   * the final result should be consistent with batch processing.
   */
  describe('Additional Property: Incremental Update Consistency', () => {
    test('incremental updates should produce same result as batch processing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              ckb_id: fc.string({ minLength: 5, maxLength: 15 }),
              entities: fc.constant([
                { id: 'entity_a', canonical_name: 'Entity A' },
                { id: 'entity_b', canonical_name: 'Entity B' }
              ]),
              quality: fc.record({
                source_confidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) })
              })
            }),
            { minLength: 2, maxLength: 4 }
          ),
          async (ckbs) => {
            // Batch processing
            const batchResult = await buildCooccurrenceRelations(ckbs, {
              weightThreshold: 0.5,
              minCooccurrences: 1
            });

            // Incremental processing
            relationStore.findRelation.mockImplementation(async (sourceId, targetId, type) => {
              // Simulate finding existing relation
              return null; // Start with no relation
            });

            let incrementalRelation = null;
            for (const ckb of ckbs) {
              relationStore.findRelation.mockResolvedValue(incrementalRelation);
              relationStore.createRelation.mockImplementation(async (rel) => {
                incrementalRelation = rel;
                return rel;
              });
              relationStore.updateRelation.mockImplementation(async (id, rel) => {
                incrementalRelation = rel;
                return rel;
              });

              await updateCooccurrenceRelations(ckb, {
                weightThreshold: 0.5
              });
            }

            // Property: Batch and incremental should produce similar results
            if (batchResult.length > 0 && incrementalRelation) {
              expect(incrementalRelation.metadata.cooccurrence_count).toBe(ckbs.length);
              // Weight might differ slightly due to rounding, but should be close
              expect(incrementalRelation.weight).toBeCloseTo(batchResult[0].weight, 1);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
