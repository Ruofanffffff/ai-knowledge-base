/**
 * Unit Tests for Confidence Engine
 */

const confidenceEngine = require('./confidence_engine');
const entityStore = require('../entity/entity_store');
const relationStore = require('../relation/relation_store');

// Mock dependencies
jest.mock('../entity/entity_store');
jest.mock('../relation/relation_store');

describe('Confidence Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks
    entityStore.getEntity = jest.fn();
    entityStore.getEntities = jest.fn();
    entityStore.updateEntity = jest.fn();
    entityStore.deleteEntity = jest.fn();
    relationStore.getRelation = jest.fn();
    relationStore.getRelations = jest.fn();
    relationStore.updateRelation = jest.fn();
    relationStore.deleteRelation = jest.fn();
  });

  describe('calculateEntityConfidence', () => {
    it('should calculate entity confidence from CKBs', () => {
      const entity = { id: 'e1', supported_by: ['ckb1', 'ckb2'] };
      const ckbs = [
        { quality: { source_confidence: 0.8 } },
        { quality: { source_confidence: 0.9 } }
      ];

      const confidence = confidenceEngine.calculateEntityConfidence(entity, ckbs);

      expect(confidence).toBeCloseTo(0.85);
    });

    it('should return 0 for entity with no CKBs', () => {
      const entity = { id: 'e1', supported_by: [] };
      const ckbs = [];

      const confidence = confidenceEngine.calculateEntityConfidence(entity, ckbs);

      expect(confidence).toBe(0);
    });

    it('should use default confidence for CKBs without quality', () => {
      const entity = { id: 'e1', supported_by: ['ckb1'] };
      const ckbs = [{}];

      const confidence = confidenceEngine.calculateEntityConfidence(entity, ckbs);

      expect(confidence).toBe(0.5);
    });
  });

  describe('calculateRelationConfidence', () => {
    it('should calculate builtin relation confidence from entities', () => {
      const relation = { type: 'builtin' };
      const sourceEntity = { confidence: 0.8 };
      const targetEntity = { confidence: 0.9 };

      const confidence = confidenceEngine.calculateRelationConfidence(
        relation,
        sourceEntity,
        targetEntity
      );

      expect(confidence).toBeCloseTo(0.85);
    });

    it('should calculate cooccurrence relation confidence with weight', () => {
      const relation = { type: 'co_occurrence', weight: 5 };
      const sourceEntity = { confidence: 0.8 };
      const targetEntity = { confidence: 0.8 };

      const confidence = confidenceEngine.calculateRelationConfidence(
        relation,
        sourceEntity,
        targetEntity
      );

      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should calculate semantic relation confidence with LLM score', () => {
      const relation = {
        type: 'semantic',
        metadata: { validation_score: 0.9 }
      };
      const sourceEntity = { confidence: 0.7 };
      const targetEntity = { confidence: 0.7 };

      const confidence = confidenceEngine.calculateRelationConfidence(
        relation,
        sourceEntity,
        targetEntity
      );

      expect(confidence).toBeGreaterThan(0.7);
      expect(confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('updateEntityConfidence', () => {
    it('should update entity confidence and cascade to relations', async () => {
      const mockEntity = {
        id: 'e1',
        confidence: 0.5,
        supported_by: ['ckb1', 'ckb2']
      };

      const mockCKBs = [
        { quality: { source_confidence: 0.8 } },
        { quality: { source_confidence: 0.9 } }
      ];

      entityStore.getEntity.mockResolvedValue(mockEntity);
      entityStore.updateEntity.mockResolvedValue(mockEntity);
      relationStore.getRelations.mockResolvedValue([]);

      // Mock getCKBsForEntity
      const ckbStore = require('../ckb/ckb_store');
      ckbStore.getCKB = jest.fn()
        .mockResolvedValueOnce(mockCKBs[0])
        .mockResolvedValueOnce(mockCKBs[1]);

      const result = await confidenceEngine.updateEntityConfidence('e1');

      expect(result.updated).toBe(1);
      expect(result.deleted).toBe(0);
      expect(entityStore.updateEntity).toHaveBeenCalled();
    });

    it('should delete entity if confidence below delete threshold', async () => {
      const mockEntity = {
        id: 'e1',
        confidence: 0.3,
        supported_by: ['ckb1']
      };

      const mockCKBs = [
        { quality: { source_confidence: 0.2 } }
      ];

      entityStore.getEntity.mockResolvedValue(mockEntity);
      entityStore.deleteEntity.mockResolvedValue(true);
      relationStore.getRelations.mockResolvedValue([]);

      const ckbStore = require('../ckb/ckb_store');
      ckbStore.getCKB = jest.fn().mockResolvedValue(mockCKBs[0]);

      const result = await confidenceEngine.updateEntityConfidence('e1', {
        deleteThreshold: 0.4
      });

      expect(result.deleted).toBe(1);
      expect(entityStore.deleteEntity).toHaveBeenCalled();
    });
  });

  describe('updateRelationConfidence', () => {
    it('should update relation confidence', async () => {
      const mockRelation = {
        id: 'r1',
        source_id: 'e1',
        target_id: 'e2',
        type: 'builtin',
        confidence: 0.5
      };

      const mockSourceEntity = { id: 'e1', confidence: 0.8 };
      const mockTargetEntity = { id: 'e2', confidence: 0.9 };

      relationStore.getRelation.mockResolvedValue(mockRelation);
      relationStore.updateRelation.mockResolvedValue(mockRelation);
      entityStore.getEntity
        .mockResolvedValueOnce(mockSourceEntity)
        .mockResolvedValueOnce(mockTargetEntity);

      const result = await confidenceEngine.updateRelationConfidence('r1');

      expect(result.updated).toBe(1);
      expect(result.deleted).toBe(0);
      expect(relationStore.updateRelation).toHaveBeenCalled();
    });

    it('should delete relation if entity not found', async () => {
      const mockRelation = {
        id: 'r1',
        source_id: 'e1',
        target_id: 'e2',
        type: 'builtin'
      };

      relationStore.getRelation.mockResolvedValue(mockRelation);
      relationStore.deleteRelation.mockResolvedValue(true);
      entityStore.getEntity.mockResolvedValue(null);

      const result = await confidenceEngine.updateRelationConfidence('r1');

      expect(result.deleted).toBe(1);
      expect(relationStore.deleteRelation).toHaveBeenCalled();
    });
  });

  describe('batchUpdateEntityConfidence', () => {
    it('should batch update multiple entities', async () => {
      const entityIds = ['e1', 'e2', 'e3'];

      entityStore.getEntity.mockResolvedValue({
        id: 'e1',
        confidence: 0.7,
        supported_by: ['ckb1']
      });
      entityStore.updateEntity.mockResolvedValue({});
      relationStore.getRelations.mockResolvedValue([]);

      const ckbStore = require('../ckb/ckb_store');
      ckbStore.getCKB = jest.fn().mockResolvedValue({
        quality: { source_confidence: 0.8 }
      });

      const stats = await confidenceEngine.batchUpdateEntityConfidence(entityIds);

      expect(stats.total).toBe(3);
      expect(stats.updated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getConfidenceStats', () => {
    it('should return confidence statistics', async () => {
      const mockEntities = [
        { id: 'e1', confidence: 0.9 },
        { id: 'e2', confidence: 0.7 },
        { id: 'e3', confidence: 0.5, quality_flag: 'low_quality' }
      ];

      const mockRelations = [
        { id: 'r1', confidence: 0.8 },
        { id: 'r2', confidence: 0.6 }
      ];

      entityStore.getAllEntities.mockResolvedValue(mockEntities);
      relationStore.getAllRelations.mockResolvedValue(mockRelations);

      const stats = await confidenceEngine.getConfidenceStats();

      expect(stats.entities.total).toBe(3);
      expect(stats.entities.low_quality).toBe(1);
      expect(stats.relations.total).toBe(2);
      expect(stats.entities.avg_confidence).toBeCloseTo(0.7);
    });
  });
});
