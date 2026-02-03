/**
 * Unit Tests for Cooccurrence Relation Builder
 */

const cooccurrenceRelationBuilder = require('./cooccurrence_relation_builder');
const relationStore = require('./relation_store');
const entityStore = require('../entity/entity_store');
const ckbStore = require('../ckb/ckb_store');

// Mock dependencies
jest.mock('./relation_store');
jest.mock('../entity/entity_store');
jest.mock('../ckb/ckb_store');

describe('Cooccurrence Relation Builder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Add missing mock methods
    entityStore.getEntitiesByDocument = jest.fn();
    relationStore.getRelationByEntities = jest.fn();
    relationStore.getRelationsByCKB = jest.fn();
    relationStore.getRelationsByType = jest.fn();
    relationStore.createRelation = jest.fn();
    relationStore.updateRelation = jest.fn();
    relationStore.findRelation = jest.fn();
    relationStore.findRelationsByEvidence = jest.fn();
    relationStore.getRelations = jest.fn();
  });

  describe('buildCooccurrenceRelations', () => {
    it('should build cooccurrence relations from CKBs', async () => {
      // Mock data - CKBs with entities
      const mockCKBs = [
        {
          ckb_id: 'ckb_001',
          entities: [
            { id: 'entity_a', canonical_name: 'Entity A' },
            { id: 'entity_b', canonical_name: 'Entity B' }
          ],
          quality: { source_confidence: 0.9 }
        },
        {
          ckb_id: 'ckb_002',
          entities: [
            { id: 'entity_a', canonical_name: 'Entity A' },
            { id: 'entity_b', canonical_name: 'Entity B' }
          ],
          quality: { source_confidence: 0.8 }
        }
      ];

      const result = await cooccurrenceRelationBuilder.buildCooccurrenceRelations(mockCKBs);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('co_occurrence');
    });

    it('should calculate correct weight for cooccurrence relations', async () => {
      const mockCKBs = [
        {
          ckb_id: 'ckb_001',
          entities: [
            { id: 'entity_a', canonical_name: 'Entity A' },
            { id: 'entity_b', canonical_name: 'Entity B' }
          ],
          quality: { source_confidence: 0.9 }
        },
        {
          ckb_id: 'ckb_002',
          entities: [
            { id: 'entity_a', canonical_name: 'Entity A' },
            { id: 'entity_b', canonical_name: 'Entity B' }
          ],
          quality: { source_confidence: 0.7 }
        }
      ];

      const result = await cooccurrenceRelationBuilder.buildCooccurrenceRelations(mockCKBs);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].weight).toBeGreaterThan(0);
      expect(result[0].type).toBe('co_occurrence');
      expect(result[0].evidence_ckb).toContain('ckb_001');
      expect(result[0].evidence_ckb).toContain('ckb_002');
    });

    it('should not create relations below weight threshold', async () => {
      const mockCKBs = [
        {
          ckb_id: 'ckb_001',
          entities: [
            { id: 'entity_a', canonical_name: 'Entity A' },
            { id: 'entity_b', canonical_name: 'Entity B' }
          ],
          quality: { source_confidence: 0.1 }
        }
      ];

      const result = await cooccurrenceRelationBuilder.buildCooccurrenceRelations(mockCKBs, {
        weightThreshold: 0.5
      });

      expect(result).toBeDefined();
      expect(result.length).toBe(0);
    });
  });

  describe('updateCooccurrenceRelations', () => {
    it('should update existing cooccurrence relations', async () => {
      const mockCKB = {
        ckb_id: 'ckb_new',
        entities: [
          { id: 'entity_a', canonical_name: 'Entity A' },
          { id: 'entity_b', canonical_name: 'Entity B' }
        ],
        quality: { source_confidence: 0.9 }
      };

      const mockExistingRelation = {
        id: 'rel_001',
        source_id: 'entity_a',
        target_id: 'entity_b',
        type: 'co_occurrence',
        weight: 0.8,
        evidence_ckb: ['ckb_001'],
        metadata: {
          cooccurrence_count: 1,
          avg_source_weight: 0.8
        }
      };

      relationStore.findRelation.mockResolvedValue(mockExistingRelation);
      relationStore.updateRelation.mockResolvedValue({ ...mockExistingRelation, weight: 1.7 });

      const result = await cooccurrenceRelationBuilder.updateCooccurrenceRelations(mockCKB);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(relationStore.updateRelation).toHaveBeenCalled();
    });
  });

  describe('removeCooccurrenceRelations', () => {
    it('should remove or update relations when CKB is deleted', async () => {
      const mockRelations = [
        {
          id: 'rel_001',
          source_id: 'entity_a',
          target_id: 'entity_b',
          type: 'co_occurrence',
          weight: 0.8,
          evidence_ckb: ['ckb_001', 'ckb_002'],
          metadata: {
            cooccurrence_count: 2,
            avg_source_weight: 0.8
          }
        }
      ];

      relationStore.findRelationsByEvidence.mockResolvedValue(mockRelations);
      relationStore.updateRelation.mockResolvedValue({ id: 'rel_001' });

      const result = await cooccurrenceRelationBuilder.removeCooccurrenceRelations('ckb_001');

      expect(result).toBeDefined();
      expect(result.updated).toBeGreaterThanOrEqual(0);
      expect(relationStore.updateRelation).toHaveBeenCalled();
    });

    it('should delete relation if weight falls below threshold', async () => {
      const mockRelations = [
        {
          id: 'rel_001',
          source_id: 'entity_a',
          target_id: 'entity_b',
          type: 'co_occurrence',
          weight: 0.3,
          evidence_ckb: ['ckb_001'],
          metadata: {
            cooccurrence_count: 1,
            avg_source_weight: 0.3
          }
        }
      ];

      relationStore.findRelationsByEvidence.mockResolvedValue(mockRelations);
      relationStore.deleteRelation.mockResolvedValue(true);

      const result = await cooccurrenceRelationBuilder.removeCooccurrenceRelations('ckb_001', {
        weightThreshold: 0.5
      });

      expect(result).toBeDefined();
      expect(result.deleted).toBeGreaterThan(0);
      expect(relationStore.deleteRelation).toHaveBeenCalled();
    });
  });

  describe('getCooccurrenceStats', () => {
    it('should return cooccurrence statistics', async () => {
      const mockRelations = [
        {
          id: 'rel_001',
          type: 'co_occurrence',
          weight: 0.8,
          evidence_ckb: ['ckb_001', 'ckb_002'],
          metadata: {
            cooccurrence_count: 2,
            avg_source_weight: 0.8
          }
        },
        {
          id: 'rel_002',
          type: 'co_occurrence',
          weight: 0.6,
          evidence_ckb: ['ckb_003'],
          metadata: {
            cooccurrence_count: 1,
            avg_source_weight: 0.6
          }
        }
      ];

      relationStore.getRelations.mockResolvedValue(mockRelations);

      const stats = await cooccurrenceRelationBuilder.getCooccurrenceStats();

      expect(stats).toHaveProperty('total_relations');
      expect(stats).toHaveProperty('avg_weight');
      expect(stats).toHaveProperty('weight_distribution');
      expect(stats.total_relations).toBe(2);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle CKBs with no entities', async () => {
      const mockCKBs = [
        {
          ckb_id: 'ckb_001',
          entities: []
        }
      ];

      const result = await cooccurrenceRelationBuilder.buildCooccurrenceRelations(mockCKBs);

      expect(result).toBeDefined();
      expect(result.length).toBe(0);
    });

    it('should handle CKBs with single entity', async () => {
      const mockCKBs = [
        {
          ckb_id: 'ckb_001',
          entities: [
            { id: 'entity_a', canonical_name: 'Entity A' }
          ],
          quality: { source_confidence: 0.9 }
        }
      ];

      const result = await cooccurrenceRelationBuilder.buildCooccurrenceRelations(mockCKBs);

      expect(result).toBeDefined();
      expect(result.length).toBe(0);
    });

    it('should handle multiple entity pairs in same CKB', async () => {
      const mockCKBs = [
        {
          ckb_id: 'ckb_001',
          entities: [
            { id: 'entity_a', canonical_name: 'Entity A' },
            { id: 'entity_b', canonical_name: 'Entity B' },
            { id: 'entity_c', canonical_name: 'Entity C' }
          ],
          quality: { source_confidence: 0.9 }
        }
      ];

      const result = await cooccurrenceRelationBuilder.buildCooccurrenceRelations(mockCKBs, {
        weightThreshold: 0.5,
        minCooccurrences: 1  // Allow single cooccurrence
      });

      expect(result).toBeDefined();
      // Should create relations for all pairs: A-B, A-C, B-C
      // With weight = 1 × 0.9 = 0.9 for each pair
      expect(result.length).toBe(3);
    });

    it('should handle missing quality information', async () => {
      const mockCKBs = [
        {
          ckb_id: 'ckb_001',
          entities: [
            { id: 'entity_a', canonical_name: 'Entity A' },
            { id: 'entity_b', canonical_name: 'Entity B' }
          ]
          // No quality field
        }
      ];

      const result = await cooccurrenceRelationBuilder.buildCooccurrenceRelations(mockCKBs);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should create new relation when none exists', async () => {
      const mockCKB = {
        ckb_id: 'ckb_new',
        entities: [
          { id: 'entity_a', canonical_name: 'Entity A' },
          { id: 'entity_b', canonical_name: 'Entity B' }
        ],
        quality: { source_confidence: 0.9 }
      };

      relationStore.findRelation.mockResolvedValue(null);
      relationStore.createRelation.mockResolvedValue({
        id: 'rel_new',
        source_id: 'entity_a',
        target_id: 'entity_b',
        type: 'co_occurrence'
      });

      const result = await cooccurrenceRelationBuilder.updateCooccurrenceRelations(mockCKB);

      expect(result).toBeDefined();
      expect(relationStore.createRelation).toHaveBeenCalled();
    });

    it('should not create relation below weight threshold', async () => {
      const mockCKB = {
        ckb_id: 'ckb_new',
        entities: [
          { id: 'entity_a', canonical_name: 'Entity A' },
          { id: 'entity_b', canonical_name: 'Entity B' }
        ],
        quality: { source_confidence: 0.3 }
      };

      relationStore.findRelation.mockResolvedValue(null);

      const result = await cooccurrenceRelationBuilder.updateCooccurrenceRelations(mockCKB, {
        weightThreshold: 0.5
      });

      expect(result).toBeDefined();
      expect(result.length).toBe(0);
      expect(relationStore.createRelation).not.toHaveBeenCalled();
    });

    it('should handle empty relations list in removeCooccurrenceRelations', async () => {
      relationStore.findRelationsByEvidence.mockResolvedValue([]);

      const result = await cooccurrenceRelationBuilder.removeCooccurrenceRelations('ckb_001');

      expect(result).toBeDefined();
      expect(result.updated).toBe(0);
      expect(result.deleted).toBe(0);
    });

    it('should handle empty relations in getCooccurrenceStats', async () => {
      relationStore.getRelations.mockResolvedValue([]);

      const stats = await cooccurrenceRelationBuilder.getCooccurrenceStats();

      expect(stats).toBeDefined();
      expect(stats.total_relations).toBe(0);
      expect(stats.avg_weight).toBe(0);
      expect(stats.avg_cooccurrence_count).toBe(0);
    });
  });

  describe('Weight Calculation', () => {
    it('should calculate weight as count × average source weight', async () => {
      const mockCKBs = [
        {
          ckb_id: 'ckb_001',
          entities: [
            { id: 'entity_a', canonical_name: 'Entity A' },
            { id: 'entity_b', canonical_name: 'Entity B' }
          ],
          quality: { source_confidence: 0.8 }
        },
        {
          ckb_id: 'ckb_002',
          entities: [
            { id: 'entity_a', canonical_name: 'Entity A' },
            { id: 'entity_b', canonical_name: 'Entity B' }
          ],
          quality: { source_confidence: 0.6 }
        }
      ];

      const result = await cooccurrenceRelationBuilder.buildCooccurrenceRelations(mockCKBs);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      
      const relation = result[0];
      expect(relation.metadata.cooccurrence_count).toBe(2);
      expect(relation.metadata.avg_source_weight).toBeCloseTo(0.7, 1);
      expect(relation.weight).toBeCloseTo(1.4, 1); // 2 × 0.7
    });

    it('should normalize confidence to 0-1 range', async () => {
      const mockCKBs = [
        {
          ckb_id: 'ckb_001',
          entities: [
            { id: 'entity_a', canonical_name: 'Entity A' },
            { id: 'entity_b', canonical_name: 'Entity B' }
          ],
          quality: { source_confidence: 0.9 }
        }
      ];

      const result = await cooccurrenceRelationBuilder.buildCooccurrenceRelations(mockCKBs, {
        weightThreshold: 0.5,
        minCooccurrences: 1  // Allow single cooccurrence
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      
      const relation = result[0];
      expect(relation.confidence).toBeGreaterThanOrEqual(0);
      expect(relation.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Bidirectional Pair Handling', () => {
    it('should treat (A, B) and (B, A) as the same pair', async () => {
      const mockCKBs = [
        {
          ckb_id: 'ckb_001',
          entities: [
            { id: 'entity_a', canonical_name: 'Entity A' },
            { id: 'entity_b', canonical_name: 'Entity B' }
          ],
          quality: { source_confidence: 0.9 }
        },
        {
          ckb_id: 'ckb_002',
          entities: [
            { id: 'entity_b', canonical_name: 'Entity B' },
            { id: 'entity_a', canonical_name: 'Entity A' }
          ],
          quality: { source_confidence: 0.8 }
        }
      ];

      const result = await cooccurrenceRelationBuilder.buildCooccurrenceRelations(mockCKBs);

      expect(result).toBeDefined();
      // Should create only one relation for the pair, not two
      expect(result.length).toBe(1);
      expect(result[0].metadata.cooccurrence_count).toBe(2);
    });
  });

  describe('Minimum Cooccurrences Threshold', () => {
    it('should respect minCooccurrences threshold', async () => {
      const mockCKBs = [
        {
          ckb_id: 'ckb_001',
          entities: [
            { id: 'entity_a', canonical_name: 'Entity A' },
            { id: 'entity_b', canonical_name: 'Entity B' }
          ],
          quality: { source_confidence: 0.9 }
        }
      ];

      const result = await cooccurrenceRelationBuilder.buildCooccurrenceRelations(mockCKBs, {
        minCooccurrences: 2
      });

      expect(result).toBeDefined();
      expect(result.length).toBe(0); // Only 1 cooccurrence, below threshold of 2
    });

    it('should create relation when meeting minCooccurrences threshold', async () => {
      const mockCKBs = [
        {
          ckb_id: 'ckb_001',
          entities: [
            { id: 'entity_a', canonical_name: 'Entity A' },
            { id: 'entity_b', canonical_name: 'Entity B' }
          ],
          quality: { source_confidence: 0.9 }
        },
        {
          ckb_id: 'ckb_002',
          entities: [
            { id: 'entity_a', canonical_name: 'Entity A' },
            { id: 'entity_b', canonical_name: 'Entity B' }
          ],
          quality: { source_confidence: 0.8 }
        }
      ];

      const result = await cooccurrenceRelationBuilder.buildCooccurrenceRelations(mockCKBs, {
        minCooccurrences: 2
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].metadata.cooccurrence_count).toBeGreaterThanOrEqual(2);
    });
  });
});
