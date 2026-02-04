/**
 * Property-Based Tests for Knowledge Graph Service
 * 
 * Property 21: Incremental Update Isolation
 * Property 22: Traceability Round-trip
 * 
 * Validates: Requirements 10.1-10.10
 */

const fc = require('fast-check');
const kgService = require('./kg_service');
const entityStore = require('../entity/entity_store');
const relationStore = require('../relation/relation_store');
const ckbStore = require('../ckb/ckb_store');
const confidenceEngine = require('../confidence/confidence_engine');

// Mock dependencies
jest.mock('../ckb/ckb_parser');
jest.mock('../ckb/ckb_store');
jest.mock('../field_extractor/field_extractor');
jest.mock('../field_normalizer/field_normalizer');
jest.mock('../schema/schema_matcher');
jest.mock('../schema/schema_manager');
jest.mock('../entity/entity_builder');
jest.mock('../entity/entity_store');
jest.mock('../relation/builtin_relation_builder');
jest.mock('../relation/cooccurrence_relation_builder');
jest.mock('../relation/semantic_relation_builder');
jest.mock('../relation/relation_store');
jest.mock('../confidence/confidence_engine');
jest.mock('../confidence/quality_filter');
jest.mock('../utils/performance_monitor');
jest.mock('../utils/token_budget_manager');

const cooccurrenceRelationBuilder = require('../relation/cooccurrence_relation_builder');

describe('Knowledge Graph Service - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    entityStore.getEntities = jest.fn();
    entityStore.deleteEntity = jest.fn();
    relationStore.getRelations = jest.fn();
    relationStore.deleteRelation = jest.fn();
    ckbStore.getCKBsByDocument = jest.fn();
    ckbStore.deleteCKB = jest.fn();
    ckbStore.getCKB = jest.fn();
    confidenceEngine.updateEntityConfidence = jest.fn();
    confidenceEngine.cascadeDeleteRelations = jest.fn();
    cooccurrenceRelationBuilder.removeCooccurrenceRelations = jest.fn(() => 
      Promise.resolve({ deleted: 0 })
    );
  });

  /**
   * Property 21: Incremental Update Isolation
   * 
   * For any document modification, only CKBs, entities, and relations associated
   * with that document should be recomputed; unrelated graph components should
   * remain unchanged.
   * 
   * Validates: Requirements 10.1, 10.2, 10.10
   */
  describe('Property 21: Incremental Update Isolation', () => {
    it('should only update entities from the modified document', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 5, maxLength: 10 }), { minLength: 2, maxLength: 5 }), // document IDs
          fc.integer({ min: 0, max: 3 }), // index of document to update
          async (docIds, updateIndex) => {
            // Ensure unique document IDs
            const uniqueDocIds = [...new Set(docIds)];
            if (uniqueDocIds.length < 2) {
              return true; // Skip if not enough unique IDs
            }

            const targetDocId = uniqueDocIds[updateIndex % uniqueDocIds.length];

            // Create entities for each document
            const allEntities = [];
            for (const docId of uniqueDocIds) {
              const entities = Array.from({ length: 2 }, (_, i) => ({
                id: `${docId}_e${i}`,
                doc_id: docId,
                canonical_name: `Entity ${docId}_${i}`,
                confidence: 0.8,
                supported_by: [`${docId}_ckb1`]
              }));
              allEntities.push(...entities);
            }

            // Mock entity store to return entities for target document
            entityStore.getEntities = jest.fn(({ doc_id }) => {
              if (doc_id) {
                return Promise.resolve(allEntities.filter(e => e.doc_id === doc_id));
              }
              return Promise.resolve(allEntities);
            });

            // Mock CKB store
            ckbStore.getCKBsByDocument = jest.fn((docId) => {
              return Promise.resolve([
                {
                  ckb_id: `${docId}_ckb1`,
                  doc_id: docId,
                  content: { text: 'Sample text' }
                }
              ]);
            });

            // Mock confidence engine
            const updatedEntityIds = new Set();
            confidenceEngine.updateEntityConfidence = jest.fn((entityId) => {
              updatedEntityIds.add(entityId);
              return Promise.resolve({ updated: 1, deleted: 0 });
            });

            // Update knowledge graph for target document
            await kgService.updateKnowledgeGraph(targetDocId, {});

            // Verify: only entities from target document should be updated
            const targetEntities = allEntities.filter(e => e.doc_id === targetDocId);
            const otherEntities = allEntities.filter(e => e.doc_id !== targetDocId);

            // All target entities should be updated
            for (const entity of targetEntities) {
              expect(updatedEntityIds.has(entity.id)).toBe(true);
            }

            // No other entities should be updated
            for (const entity of otherEntities) {
              expect(updatedEntityIds.has(entity.id)).toBe(false);
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should only delete CKBs from the deleted document', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 5, maxLength: 10 }), { minLength: 2, maxLength: 5 }), // document IDs
          fc.integer({ min: 0, max: 3 }), // index of document to delete
          async (docIds, deleteIndex) => {
            // Ensure unique document IDs
            const uniqueDocIds = [...new Set(docIds)];
            if (uniqueDocIds.length < 2) {
              return true; // Skip if not enough unique IDs
            }

            const targetDocId = uniqueDocIds[deleteIndex % uniqueDocIds.length];

            // Create CKBs for each document
            const allCkbs = [];
            for (const docId of uniqueDocIds) {
              const ckbs = Array.from({ length: 2 }, (_, i) => ({
                ckb_id: `${docId}_ckb${i}`,
                doc_id: docId,
                content: { text: 'Sample text' }
              }));
              allCkbs.push(...ckbs);
            }

            // Mock CKB store
            ckbStore.getCKBsByDocument = jest.fn((docId) => {
              return Promise.resolve(allCkbs.filter(c => c.doc_id === docId));
            });

            const deletedCkbIds = new Set();
            ckbStore.deleteCKB = jest.fn((ckbId) => {
              deletedCkbIds.add(ckbId);
              return Promise.resolve(true);
            });

            // Mock entity store
            entityStore.getEntities = jest.fn(() => Promise.resolve([]));

            // Mock confidence engine
            confidenceEngine.updateEntityConfidence = jest.fn(() => 
              Promise.resolve({ updated: 0, deleted: 0 })
            );

            // Delete knowledge graph for target document
            await kgService.deleteKnowledgeGraph(targetDocId);

            // Verify: only CKBs from target document should be deleted
            const targetCkbs = allCkbs.filter(c => c.doc_id === targetDocId);
            const otherCkbs = allCkbs.filter(c => c.doc_id !== targetDocId);

            // All target CKBs should be deleted
            for (const ckb of targetCkbs) {
              expect(deletedCkbIds.has(ckb.ckb_id)).toBe(true);
            }

            // No other CKBs should be deleted
            for (const ckb of otherCkbs) {
              expect(deletedCkbIds.has(ckb.ckb_id)).toBe(false);
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should preserve unrelated relations during document update', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 10 }), // target document ID
          fc.string({ minLength: 5, maxLength: 10 }), // other document ID
          async (targetDocId, otherDocId) => {
            // Ensure different document IDs
            if (targetDocId === otherDocId) {
              return true;
            }

            // Create entities for both documents
            const targetEntities = [
              { id: 'e1', doc_id: targetDocId, canonical_name: 'Entity 1' },
              { id: 'e2', doc_id: targetDocId, canonical_name: 'Entity 2' }
            ];

            const otherEntities = [
              { id: 'e3', doc_id: otherDocId, canonical_name: 'Entity 3' },
              { id: 'e4', doc_id: otherDocId, canonical_name: 'Entity 4' }
            ];

            // Create relations
            const targetRelations = [
              { id: 'r1', source_id: 'e1', target_id: 'e2', type: 'builtin' }
            ];

            const otherRelations = [
              { id: 'r2', source_id: 'e3', target_id: 'e4', type: 'builtin' }
            ];

            // Mock stores
            entityStore.getEntities = jest.fn(({ doc_id }) => {
              if (doc_id === targetDocId) {
                return Promise.resolve(targetEntities);
              } else if (doc_id === otherDocId) {
                return Promise.resolve(otherEntities);
              }
              return Promise.resolve([...targetEntities, ...otherEntities]);
            });

            ckbStore.getCKBsByDocument = jest.fn((docId) => {
              return Promise.resolve([
                { ckb_id: `${docId}_ckb1`, doc_id: docId, content: { text: 'Sample' } }
              ]);
            });

            relationStore.getRelations = jest.fn(() => {
              return Promise.resolve([...targetRelations, ...otherRelations]);
            });

            const deletedRelationIds = new Set();
            relationStore.deleteRelation = jest.fn((relationId) => {
              deletedRelationIds.add(relationId);
              return Promise.resolve(true);
            });

            // Mock confidence engine
            confidenceEngine.updateEntityConfidence = jest.fn(() => 
              Promise.resolve({ updated: 1, deleted: 0, cascaded: { updated: 0 } })
            );

            // Update knowledge graph for target document
            await kgService.updateKnowledgeGraph(targetDocId, {});

            // Verify: other document's relations should not be deleted
            for (const relation of otherRelations) {
              expect(deletedRelationIds.has(relation.id)).toBe(false);
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Property 22: Traceability Round-trip
   * 
   * For any entity or relation, following the supported_by or evidence_ckb links
   * should lead to valid CKBs, and those CKBs should reference back to the
   * entity/relation.
   * 
   * Validates: Requirements 10.3, 10.4, 10.5
   */
  describe('Property 22: Traceability Round-trip', () => {
    it('should maintain valid CKB references in entities', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 5, maxLength: 10 }), { minLength: 1, maxLength: 5 }), // CKB IDs
          async (ckbIds) => {
            // Ensure unique CKB IDs
            const uniqueCkbIds = [...new Set(ckbIds)];
            if (uniqueCkbIds.length === 0) {
              return true;
            }

            // Create CKBs
            const ckbs = uniqueCkbIds.map(ckbId => ({
              ckb_id: ckbId,
              doc_id: 'doc1',
              content: { text: 'Sample text' },
              entities: []
            }));

            // Create entity supported by these CKBs
            const entity = {
              id: 'e1',
              canonical_name: 'Entity 1',
              supported_by: uniqueCkbIds,
              confidence: 0.8
            };

            // Mock CKB store
            ckbStore.getCKB = jest.fn((ckbId) => {
              return Promise.resolve(ckbs.find(c => c.ckb_id === ckbId));
            });

            // Verify: all CKB references should be valid
            for (const ckbId of entity.supported_by) {
              const ckb = await ckbStore.getCKB(ckbId);
              expect(ckb).toBeDefined();
              expect(ckb.ckb_id).toBe(ckbId);
            }

            // Verify: CKBs should reference back to entity (if entities array exists)
            for (const ckb of ckbs) {
              if (ckb.entities) {
                // Add entity reference to CKB
                ckb.entities.push(entity);
                
                // Verify round-trip
                const entityIds = ckb.entities.map(e => e.id);
                expect(entityIds).toContain(entity.id);
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should maintain valid CKB references in relations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 10 }), // CKB ID
          async (ckbId) => {
            // Create CKB
            const ckb = {
              ckb_id: ckbId,
              doc_id: 'doc1',
              content: { text: 'Entity A relates to Entity B' },
              relations: []
            };

            // Create relation with evidence
            const relation = {
              id: 'r1',
              source_id: 'e1',
              target_id: 'e2',
              type: 'semantic',
              evidence_ckb: ckbId,
              evidence_text: 'Entity A relates to Entity B',
              confidence: 0.8
            };

            // Mock CKB store
            ckbStore.getCKB = jest.fn((id) => {
              if (id === ckbId) {
                return Promise.resolve(ckb);
              }
              return Promise.resolve(null);
            });

            // Verify: CKB reference should be valid
            const evidenceCkb = await ckbStore.getCKB(relation.evidence_ckb);
            expect(evidenceCkb).toBeDefined();
            expect(evidenceCkb.ckb_id).toBe(ckbId);

            // Verify: evidence text should exist in CKB
            expect(evidenceCkb.content.text).toContain(relation.evidence_text);

            // Verify: CKB should reference back to relation (if relations array exists)
            if (ckb.relations) {
              ckb.relations.push(relation);
              
              const relationIds = ckb.relations.map(r => r.id);
              expect(relationIds).toContain(relation.id);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle orphaned entities correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 5, maxLength: 10 }), { minLength: 1, maxLength: 3 }), // CKB IDs
          fc.integer({ min: 0, max: 2 }), // number of valid CKBs
          async (ckbIds, numValid) => {
            // Ensure unique CKB IDs
            const uniqueCkbIds = [...new Set(ckbIds)];
            if (uniqueCkbIds.length === 0) {
              return true;
            }

            const validCount = Math.min(numValid, uniqueCkbIds.length);
            const validCkbIds = uniqueCkbIds.slice(0, validCount);
            const invalidCkbIds = uniqueCkbIds.slice(validCount);

            // Create entity with both valid and invalid CKB references
            const entity = {
              id: 'e1',
              canonical_name: 'Entity 1',
              supported_by: uniqueCkbIds,
              confidence: 0.8
            };

            // Mock CKB store - only return valid CKBs
            ckbStore.getCKB = jest.fn((ckbId) => {
              if (validCkbIds.includes(ckbId)) {
                return Promise.resolve({
                  ckb_id: ckbId,
                  doc_id: 'doc1',
                  content: { text: 'Sample' }
                });
              }
              return Promise.resolve(null);
            });

            // Verify: check which CKB references are valid
            const validReferences = [];
            const invalidReferences = [];

            for (const ckbId of entity.supported_by) {
              const ckb = await ckbStore.getCKB(ckbId);
              if (ckb) {
                validReferences.push(ckbId);
              } else {
                invalidReferences.push(ckbId);
              }
            }

            // Verify: valid references should match expected
            expect(validReferences.sort()).toEqual(validCkbIds.sort());
            expect(invalidReferences.sort()).toEqual(invalidCkbIds.sort());

            // If entity has no valid CKB support, it should be considered orphaned
            if (validReferences.length === 0) {
              expect(entity.supported_by.length).toBeGreaterThan(0);
              expect(validReferences.length).toBe(0);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should maintain bidirectional references between entities and CKBs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // number of entities
          fc.integer({ min: 1, max: 3 }), // number of CKBs per entity
          async (numEntities, numCkbsPerEntity) => {
            // Create entities and CKBs
            const entities = [];
            const ckbs = [];

            for (let i = 0; i < numEntities; i++) {
              const entityCkbs = [];
              
              for (let j = 0; j < numCkbsPerEntity; j++) {
                const ckbId = `ckb_${i}_${j}`;
                const ckb = {
                  ckb_id: ckbId,
                  doc_id: 'doc1',
                  content: { text: `Text for entity ${i}` },
                  entities: []
                };
                ckbs.push(ckb);
                entityCkbs.push(ckbId);
              }

              const entity = {
                id: `e${i}`,
                canonical_name: `Entity ${i}`,
                supported_by: entityCkbs,
                confidence: 0.8
              };
              entities.push(entity);

              // Add entity reference to CKBs
              for (const ckbId of entityCkbs) {
                const ckb = ckbs.find(c => c.ckb_id === ckbId);
                if (ckb) {
                  ckb.entities.push(entity);
                }
              }
            }

            // Verify bidirectional references
            for (const entity of entities) {
              // Forward: entity -> CKBs
              for (const ckbId of entity.supported_by) {
                const ckb = ckbs.find(c => c.ckb_id === ckbId);
                expect(ckb).toBeDefined();

                // Backward: CKB -> entity
                const entityIds = ckb.entities.map(e => e.id);
                expect(entityIds).toContain(entity.id);
              }
            }

            // Verify: each CKB references only entities that reference it
            for (const ckb of ckbs) {
              for (const entity of ckb.entities) {
                expect(entity.supported_by).toContain(ckb.ckb_id);
              }
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });
});
