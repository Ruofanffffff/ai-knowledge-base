/**
 * Unit Tests for Quality Filter
 */

const qualityFilter = require('./quality_filter');
const entityStore = require('../entity/entity_store');
const relationStore = require('../relation/relation_store');
const confidenceEngine = require('./confidence_engine');

// Mock dependencies
jest.mock('../entity/entity_store');
jest.mock('../relation/relation_store');
jest.mock('./confidence_engine');

describe('Quality Filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks
    entityStore.getEntities = jest.fn();
    entityStore.deleteEntity = jest.fn();
    relationStore.getRelations = jest.fn();
    relationStore.deleteRelation = jest.fn();
    confidenceEngine.cascadeDeleteRelations = jest.fn();
  });

  describe('filterLowQualityEntities', () => {
    it('should filter entities below quality threshold', async () => {
      const mockEntities = [
        { id: 'e1', confidence: 0.9 },
        { id: 'e2', confidence: 0.5 },
        { id: 'e3', confidence: 0.3 }
      ];

      entityStore.getEntities.mockResolvedValue(mockEntities);
      entityStore.deleteEntity.mockResolvedValue(true);
      confidenceEngine.cascadeDeleteRelations.mockResolvedValue(2);

      const result = await qualityFilter.filterLowQualityEntities({
        minConfidence: 0.6,
        deleteThreshold: 0.4,
        dryRun: false
      });

      expect(result.stats.total).toBe(3);
      expect(result.stats.low_quality).toBe(2);
      expect(result.stats.deleted).toBe(1);
      expect(result.stats.kept).toBe(1);
    });

    it('should not delete entities in dry run mode', async () => {
      const mockEntities = [
        { id: 'e1', confidence: 0.3 }
      ];

      entityStore.getEntities.mockResolvedValue(mockEntities);

      const result = await qualityFilter.filterLowQualityEntities({
        deleteThreshold: 0.4,
        dryRun: true
      });

      expect(result.stats.deleted).toBe(1);
      expect(entityStore.deleteEntity).not.toHaveBeenCalled();
    });
  });

  describe('filterLowQualityRelations', () => {
    it('should filter relations below quality threshold', async () => {
      const mockRelations = [
        { id: 'r1', confidence: 0.8 },
        { id: 'r2', confidence: 0.4 },
        { id: 'r3', confidence: 0.2 }
      ];

      relationStore.getRelations.mockResolvedValue(mockRelations);
      relationStore.deleteRelation.mockResolvedValue(true);

      const result = await qualityFilter.filterLowQualityRelations({
        minConfidence: 0.5,
        deleteThreshold: 0.3,
        dryRun: false
      });

      expect(result.stats.total).toBe(3);
      expect(result.stats.low_quality).toBe(2);
      expect(result.stats.deleted).toBe(1);
    });
  });

  describe('resolveEntityConflicts', () => {
    it('should resolve conflicts using confidence-weighted strategy', async () => {
      const entity = {
        id: 'e1',
        attributes: {}
      };

      const ckbs = [
        {
          extracted_fields: [
            { name: 'location', value: 'Beijing' }
          ],
          quality: { source_confidence: 0.9 }
        },
        {
          extracted_fields: [
            { name: 'location', value: 'Shanghai' }
          ],
          quality: { source_confidence: 0.6 }
        }
      ];

      const resolved = await qualityFilter.resolveEntityConflicts(entity, ckbs, {
        strategy: 'confidence_weighted'
      });

      expect(resolved.attributes.location).toBe('Beijing');
      expect(resolved.conflict_resolution).toBeDefined();
    });

    it('should resolve conflicts using voting strategy', async () => {
      const entity = {
        id: 'e1',
        attributes: {}
      };

      const ckbs = [
        {
          extracted_fields: [
            { name: 'status', value: 'active' }
          ],
          quality: { source_confidence: 0.7 }
        },
        {
          extracted_fields: [
            { name: 'status', value: 'active' }
          ],
          quality: { source_confidence: 0.6 }
        },
        {
          extracted_fields: [
            { name: 'status', value: 'inactive' }
          ],
          quality: { source_confidence: 0.9 }
        }
      ];

      const resolved = await qualityFilter.resolveEntityConflicts(entity, ckbs, {
        strategy: 'voting'
      });

      expect(resolved.attributes.status).toBe('active');
    });

    it('should resolve conflicts using latest strategy', async () => {
      const entity = {
        id: 'e1',
        attributes: {}
      };

      const ckbs = [
        {
          extracted_fields: [
            { name: 'value', value: 'old' }
          ],
          quality: { source_confidence: 0.8 },
          timestamps: { created_at: '2024-01-01T00:00:00Z' }
        },
        {
          extracted_fields: [
            { name: 'value', value: 'new' }
          ],
          quality: { source_confidence: 0.7 },
          timestamps: { created_at: '2024-01-02T00:00:00Z' }
        }
      ];

      const resolved = await qualityFilter.resolveEntityConflicts(entity, ckbs, {
        strategy: 'latest'
      });

      expect(resolved.attributes.value).toBe('new');
    });
  });

  describe('cleanOrphanedEntities', () => {
    it('should clean entities with no CKB support', async () => {
      const mockEntities = [
        { id: 'e1', supported_by: ['ckb1'] },
        { id: 'e2', supported_by: [] },
        { id: 'e3', supported_by: null }
      ];

      entityStore.getEntities.mockResolvedValue(mockEntities);
      entityStore.deleteEntity.mockResolvedValue(true);
      confidenceEngine.cascadeDeleteRelations.mockResolvedValue(1);

      const result = await qualityFilter.cleanOrphanedEntities({
        dryRun: false
      });

      expect(result.stats.total).toBe(3);
      expect(result.stats.orphaned).toBe(2);
      expect(result.stats.deleted).toBe(2);
    });
  });

  describe('runQualityCheck', () => {
    it('should run comprehensive quality check', async () => {
      const mockEntities = [
        { id: 'e1', confidence: 0.9 },
        { id: 'e2', confidence: 0.5 },
        { id: 'e3', confidence: 0.3 }
      ];

      const mockRelations = [
        { id: 'r1', confidence: 0.8 },
        { id: 'r2', confidence: 0.4 }
      ];

      entityStore.getEntities.mockResolvedValue(mockEntities);
      relationStore.getRelations.mockResolvedValue(mockRelations);
      entityStore.deleteEntity.mockResolvedValue(true);
      relationStore.deleteRelation.mockResolvedValue(true);
      confidenceEngine.cascadeDeleteRelations.mockResolvedValue(1);

      const report = await qualityFilter.runQualityCheck({
        entityMinConfidence: 0.6,
        relationMinConfidence: 0.5,
        dryRun: true
      });

      expect(report.timestamp).toBeDefined();
      expect(report.entities).toBeDefined();
      expect(report.relations).toBeDefined();
      expect(report.orphaned).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should generate recommendations for high low-quality rate', async () => {
      const mockEntities = Array(10).fill(null).map((_, i) => ({
        id: `e${i}`,
        confidence: i < 3 ? 0.9 : 0.4
      }));

      entityStore.getEntities.mockResolvedValue(mockEntities);
      relationStore.getRelations.mockResolvedValue([]);

      const report = await qualityFilter.runQualityCheck({
        entityMinConfidence: 0.6,
        dryRun: true
      });

      const hasRecommendation = report.recommendations.some(
        r => r.type === 'high_low_quality_entities'
      );
      expect(hasRecommendation).toBe(true);
    });
  });
});
