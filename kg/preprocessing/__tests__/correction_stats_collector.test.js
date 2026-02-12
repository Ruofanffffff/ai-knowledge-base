/**
 * Unit Tests for Correction Statistics Collector
 * 
 * Tests:
 * 1. 矫正记录功能
 * 2. 统计信息收集
 * 3. 准确率计算
 * 4. 缓存机制
 * 5. 批量操作
 * 
 * Requirements: 2.3, 3.5, 4.4, 5.4, 6.5, 9.2
 */

const CorrectionStatsCollector = require('../correction_stats_collector');

describe('CorrectionStatsCollector', () => {
  let collector;
  let mockPrisma;
  
  beforeEach(() => {
    // Mock Prisma client
    mockPrisma = {
      correctionRecord: {
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn()
      },
      correctionStats: {
        upsert: jest.fn(),
        findMany: jest.fn()
      },
      $disconnect: jest.fn()
    };
    
    collector = new CorrectionStatsCollector({
      prisma: mockPrisma,
      enablePersistence: true
    });
  });
  
  afterEach(async () => {
    await collector.close();
    jest.clearAllMocks();
  });
  
  describe('recordCorrection', () => {
    it('should record a single correction to database', async () => {
      const docId = 'doc-123';
      const stage = 'field_correction';
      const correction = {
        type: 'supplement',
        originalValue: { fields: [] },
        correctedValue: { fields: [{ name: '地点', value: '海口' }] },
        confidenceBefore: 0.6,
        confidenceAfter: 0.9,
        metadata: { source: 'llm_validation' }
      };
      
      mockPrisma.correctionRecord.create.mockResolvedValue({
        id: 'record-123',
        docId,
        stage,
        correctionType: correction.type,
        originalValue: JSON.stringify(correction.originalValue),
        correctedValue: JSON.stringify(correction.correctedValue),
        confidenceBefore: correction.confidenceBefore,
        confidenceAfter: correction.confidenceAfter,
        metadata: JSON.stringify(correction.metadata),
        createdAt: new Date()
      });
      
      const result = await collector.recordCorrection(docId, stage, correction);
      
      expect(result.success).toBe(true);
      expect(result.recordId).toBe('record-123');
      expect(mockPrisma.correctionRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          docId,
          stage,
          correctionType: 'supplement',
          confidenceBefore: 0.6,
          confidenceAfter: 0.9
        })
      });
    });
    
    it('should cache correction in memory', async () => {
      const docId = 'doc-123';
      const stage = 'field_correction';
      const correction = {
        type: 'supplement',
        originalValue: null,
        correctedValue: { field: 'value' }
      };
      
      mockPrisma.correctionRecord.create.mockResolvedValue({ id: 'record-123' });
      
      await collector.recordCorrection(docId, stage, correction);
      
      // Check cache
      const cached = collector._getCorrectionsFromCache(docId, stage);
      expect(cached).toHaveLength(1);
      expect(cached[0].type).toBe('supplement');
    });
    
    it('should handle missing parameters gracefully', async () => {
      const result = await collector.recordCorrection(null, 'stage', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing parameters');
      expect(mockPrisma.correctionRecord.create).not.toHaveBeenCalled();
    });
    
    it('should handle database errors gracefully', async () => {
      mockPrisma.correctionRecord.create.mockRejectedValue(new Error('DB error'));
      
      const result = await collector.recordCorrection('doc-123', 'field_correction', {
        type: 'supplement'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });
  
  describe('recordCorrections', () => {
    it('should batch record multiple corrections', async () => {
      const docId = 'doc-123';
      const stage = 'field_correction';
      const corrections = [
        { type: 'supplement', correctedValue: { field1: 'value1' } },
        { type: 'filter', correctedValue: { field2: 'value2' } },
        { type: 'verify', correctedValue: { field3: 'value3' } }
      ];
      
      mockPrisma.correctionRecord.createMany.mockResolvedValue({ count: 3 });
      
      const result = await collector.recordCorrections(docId, stage, corrections);
      
      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(mockPrisma.correctionRecord.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ correctionType: 'supplement' }),
          expect.objectContaining({ correctionType: 'filter' }),
          expect.objectContaining({ correctionType: 'verify' })
        ])
      });
    });
    
    it('should handle empty corrections array', async () => {
      const result = await collector.recordCorrections('doc-123', 'field_correction', []);
      
      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(mockPrisma.correctionRecord.createMany).not.toHaveBeenCalled();
    });
  });
  
  describe('updateStats', () => {
    it('should update statistics in database', async () => {
      const docId = 'doc-123';
      const stage = 'field_correction';
      const stats = {
        totalCorrections: 5,
        accuracyBefore: 0.7,
        accuracyAfter: 0.9,
        recallBefore: 0.6,
        recallAfter: 0.85,
        precisionBefore: 0.75,
        precisionAfter: 0.92,
        metadata: { avgConfidenceImprovement: 0.2 }
      };
      
      mockPrisma.correctionStats.upsert.mockResolvedValue({
        id: 'stats-123',
        docId,
        stage,
        ...stats,
        metadata: JSON.stringify(stats.metadata),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const result = await collector.updateStats(docId, stage, stats);
      
      expect(result.success).toBe(true);
      expect(result.statsId).toBe('stats-123');
      expect(mockPrisma.correctionStats.upsert).toHaveBeenCalledWith({
        where: {
          docId_stage: { docId, stage }
        },
        update: expect.objectContaining({
          totalCorrections: 5,
          accuracyBefore: 0.7,
          accuracyAfter: 0.9
        }),
        create: expect.objectContaining({
          docId,
          stage,
          totalCorrections: 5
        })
      });
    });
    
    it('should cache stats in memory', async () => {
      const docId = 'doc-123';
      const stage = 'field_correction';
      const stats = {
        totalCorrections: 5,
        accuracyBefore: 0.7,
        accuracyAfter: 0.9
      };
      
      mockPrisma.correctionStats.upsert.mockResolvedValue({ id: 'stats-123' });
      
      await collector.updateStats(docId, stage, stats);
      
      // Check cache
      const cached = collector._getStatsFromCache(docId, stage);
      expect(cached).toBeDefined();
      expect(cached.totalCorrections).toBe(5);
      expect(cached.accuracyBefore).toBe(0.7);
    });
    
    it('should handle missing parameters gracefully', async () => {
      const result = await collector.updateStats(null, 'stage', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing parameters');
    });
  });
  
  describe('getStats', () => {
    it('should retrieve stats from database for specific stage', async () => {
      const docId = 'doc-123';
      const stage = 'field_correction';
      
      mockPrisma.correctionStats.findMany.mockResolvedValue([
        {
          id: 'stats-123',
          docId,
          stage,
          totalCorrections: 5,
          accuracyBefore: 0.7,
          accuracyAfter: 0.9,
          recallBefore: 0.6,
          recallAfter: 0.85,
          precisionBefore: 0.75,
          precisionAfter: 0.92,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
      
      const stats = await collector.getStats(docId, stage);
      
      expect(stats).toBeDefined();
      expect(stats.totalCorrections).toBe(5);
      expect(stats.accuracyBefore).toBe(0.7);
      expect(stats.accuracyAfter).toBe(0.9);
    });
    
    it('should retrieve stats for all stages', async () => {
      const docId = 'doc-123';
      
      mockPrisma.correctionStats.findMany.mockResolvedValue([
        {
          id: 'stats-1',
          docId,
          stage: 'field_correction',
          totalCorrections: 5,
          accuracyBefore: 0.7,
          accuracyAfter: 0.9,
          recallBefore: null,
          recallAfter: null,
          precisionBefore: null,
          precisionAfter: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'stats-2',
          docId,
          stage: 'schema_correction',
          totalCorrections: 3,
          accuracyBefore: 0.8,
          accuracyAfter: 0.95,
          recallBefore: null,
          recallAfter: null,
          precisionBefore: null,
          precisionAfter: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
      
      const allStats = await collector.getStats(docId);
      
      expect(allStats).toBeDefined();
      expect(allStats.field_correction).toBeDefined();
      expect(allStats.schema_correction).toBeDefined();
      expect(allStats.field_correction.totalCorrections).toBe(5);
      expect(allStats.schema_correction.totalCorrections).toBe(3);
    });
    
    it('should return from cache if available', async () => {
      const docId = 'doc-123';
      const stage = 'field_correction';
      
      // Populate cache
      collector._updateStatsCache(docId, stage, {
        totalCorrections: 5,
        accuracyBefore: 0.7,
        accuracyAfter: 0.9
      });
      
      const stats = await collector.getStats(docId, stage);
      
      expect(stats).toBeDefined();
      expect(stats.totalCorrections).toBe(5);
      expect(mockPrisma.correctionStats.findMany).not.toHaveBeenCalled();
    });
  });
  
  describe('getCorrections', () => {
    it('should retrieve corrections from database', async () => {
      const docId = 'doc-123';
      const stage = 'field_correction';
      
      mockPrisma.correctionRecord.findMany.mockResolvedValue([
        {
          id: 'record-1',
          docId,
          stage,
          correctionType: 'supplement',
          originalValue: null,
          correctedValue: '{"field":"value"}',
          confidenceBefore: 0.6,
          confidenceAfter: 0.9,
          metadata: null,
          createdAt: new Date()
        }
      ]);
      
      const corrections = await collector.getCorrections(docId, stage);
      
      expect(corrections).toHaveLength(1);
      expect(corrections[0].type).toBe('supplement');
      expect(corrections[0].correctedValue).toEqual({ field: 'value' });
    });
    
    it('should return from cache if available', async () => {
      const docId = 'doc-123';
      const stage = 'field_correction';
      
      // Populate cache
      collector._addToCache(docId, stage, {
        type: 'supplement',
        correctedValue: { field: 'value' }
      });
      
      const corrections = await collector.getCorrections(docId, stage);
      
      expect(corrections).toHaveLength(1);
      expect(corrections[0].type).toBe('supplement');
      expect(mockPrisma.correctionRecord.findMany).not.toHaveBeenCalled();
    });
  });
  
  describe('calculateAccuracyImprovement', () => {
    it('should calculate accuracy improvement for a stage', async () => {
      const stage = 'field_correction';
      
      mockPrisma.correctionStats.findMany.mockResolvedValue([
        {
          accuracyBefore: 0.7,
          accuracyAfter: 0.9,
          recallBefore: 0.6,
          recallAfter: 0.85,
          precisionBefore: 0.75,
          precisionAfter: 0.92,
          totalCorrections: 5
        },
        {
          accuracyBefore: 0.65,
          accuracyAfter: 0.88,
          recallBefore: 0.55,
          recallAfter: 0.82,
          precisionBefore: 0.72,
          precisionAfter: 0.90,
          totalCorrections: 4
        }
      ]);
      
      const improvement = await collector.calculateAccuracyImprovement(stage);
      
      expect(improvement).toBeDefined();
      expect(improvement.stage).toBe(stage);
      expect(improvement.count).toBe(2);
      expect(improvement.avgAccuracyBefore).toBeCloseTo(0.675, 2);
      expect(improvement.avgAccuracyAfter).toBeCloseTo(0.89, 2);
      expect(improvement.accuracyImprovement).toBeGreaterThan(0);
      expect(improvement.totalCorrections).toBe(9);
    });
    
    it('should handle empty results', async () => {
      mockPrisma.correctionStats.findMany.mockResolvedValue([]);
      
      const improvement = await collector.calculateAccuracyImprovement('field_correction');
      
      expect(improvement).toBeDefined();
      expect(improvement.count).toBe(0);
      expect(improvement.avgAccuracyBefore).toBe(0);
      expect(improvement.avgAccuracyAfter).toBe(0);
    });
  });
  
  describe('getAllStageImprovements', () => {
    it('should calculate improvements for all stages', async () => {
      mockPrisma.correctionStats.findMany.mockImplementation(({ where }) => {
        const stage = where.stage;
        return Promise.resolve([
          {
            accuracyBefore: 0.7,
            accuracyAfter: 0.9,
            recallBefore: 0.6,
            recallAfter: 0.85,
            precisionBefore: 0.75,
            precisionAfter: 0.92,
            totalCorrections: 5
          }
        ]);
      });
      
      const improvements = await collector.getAllStageImprovements();
      
      expect(improvements).toBeDefined();
      expect(improvements.cbk_correction).toBeDefined();
      expect(improvements.field_correction).toBeDefined();
      expect(improvements.schema_correction).toBeDefined();
      expect(improvements.merge_correction).toBeDefined();
      expect(improvements.relation_correction).toBeDefined();
    });
  });
  
  describe('clearCache', () => {
    it('should clear cache for specific document', () => {
      const docId = 'doc-123';
      
      // Populate cache
      collector._addToCache(docId, 'field_correction', { type: 'supplement' });
      collector._updateStatsCache(docId, 'field_correction', { totalCorrections: 5 });
      
      collector.clearCache(docId);
      
      const corrections = collector._getCorrectionsFromCache(docId);
      const stats = collector._getStatsFromCache(docId, 'field_correction');
      
      expect(corrections).toHaveLength(0);
      expect(stats).toBeNull();
    });
    
    it('should clear all cache when no docId specified', () => {
      // Populate cache for multiple documents
      collector._addToCache('doc-1', 'field_correction', { type: 'supplement' });
      collector._addToCache('doc-2', 'schema_correction', { type: 'verify' });
      
      collector.clearCache();
      
      const corrections1 = collector._getCorrectionsFromCache('doc-1');
      const corrections2 = collector._getCorrectionsFromCache('doc-2');
      
      expect(corrections1).toHaveLength(0);
      expect(corrections2).toHaveLength(0);
    });
  });
  
  describe('persistence disabled', () => {
    beforeEach(() => {
      collector = new CorrectionStatsCollector({
        prisma: mockPrisma,
        enablePersistence: false
      });
    });
    
    it('should only cache corrections when persistence disabled', async () => {
      const result = await collector.recordCorrection('doc-123', 'field_correction', {
        type: 'supplement'
      });
      
      expect(result.success).toBe(true);
      expect(result.cached).toBe(true);
      expect(mockPrisma.correctionRecord.create).not.toHaveBeenCalled();
    });
    
    it('should only cache stats when persistence disabled', async () => {
      const result = await collector.updateStats('doc-123', 'field_correction', {
        totalCorrections: 5
      });
      
      expect(result.success).toBe(true);
      expect(result.cached).toBe(true);
      expect(mockPrisma.correctionStats.upsert).not.toHaveBeenCalled();
    });
  });
  
  describe('statistics calculation edge cases', () => {
    it('should handle null confidence values in corrections', async () => {
      const correction = {
        type: 'supplement',
        originalValue: null,
        correctedValue: { field: 'value' },
        confidenceBefore: null,
        confidenceAfter: null
      };
      
      mockPrisma.correctionRecord.create.mockResolvedValue({ id: 'record-123' });
      
      const result = await collector.recordCorrection('doc-123', 'field_correction', correction);
      
      expect(result.success).toBe(true);
      expect(mockPrisma.correctionRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          confidenceBefore: null,
          confidenceAfter: null
        })
      });
    });
    
    it('should handle complex nested objects in correction values', async () => {
      const correction = {
        type: 'supplement',
        originalValue: {
          entities: [{ name: 'Entity1', type: 'Person' }],
          metadata: { source: 'rule_extraction' }
        },
        correctedValue: {
          entities: [
            { name: 'Entity1', type: 'Person' },
            { name: 'Entity2', type: 'Location' }
          ],
          metadata: { source: 'llm_validation', confidence: 0.9 }
        }
      };
      
      mockPrisma.correctionRecord.create.mockResolvedValue({ id: 'record-123' });
      
      const result = await collector.recordCorrection('doc-123', 'field_correction', correction);
      
      expect(result.success).toBe(true);
      
      // Verify serialization
      const call = mockPrisma.correctionRecord.create.mock.calls[0][0];
      expect(typeof call.data.originalValue).toBe('string');
      expect(typeof call.data.correctedValue).toBe('string');
      
      // Verify can be parsed back
      const parsed = JSON.parse(call.data.correctedValue);
      expect(parsed.entities).toHaveLength(2);
    });
    
    it('should calculate stats with zero values correctly', async () => {
      const stats = {
        totalCorrections: 0,
        accuracyBefore: 0,
        accuracyAfter: 0,
        recallBefore: 0,
        recallAfter: 0,
        precisionBefore: 0,
        precisionAfter: 0
      };
      
      mockPrisma.correctionStats.upsert.mockResolvedValue({ id: 'stats-123' });
      
      const result = await collector.updateStats('doc-123', 'field_correction', stats);
      
      expect(result.success).toBe(true);
      expect(mockPrisma.correctionStats.upsert).toHaveBeenCalledWith({
        where: expect.any(Object),
        update: expect.objectContaining({
          totalCorrections: 0,
          accuracyBefore: 0,
          accuracyAfter: 0
        }),
        create: expect.any(Object)
      });
    });
    
    it('should handle stats with only some metrics defined', async () => {
      const stats = {
        totalCorrections: 3,
        accuracyBefore: 0.7,
        accuracyAfter: 0.9
        // recall and precision not provided
      };
      
      mockPrisma.correctionStats.upsert.mockResolvedValue({ id: 'stats-123' });
      
      const result = await collector.updateStats('doc-123', 'field_correction', stats);
      
      expect(result.success).toBe(true);
      expect(mockPrisma.correctionStats.upsert).toHaveBeenCalledWith({
        where: expect.any(Object),
        update: expect.objectContaining({
          totalCorrections: 3,
          accuracyBefore: 0.7,
          accuracyAfter: 0.9,
          recallBefore: undefined,
          recallAfter: undefined
        }),
        create: expect.any(Object)
      });
    });
  });
  
  describe('correction record types', () => {
    it('should record supplement type corrections', async () => {
      const correction = {
        type: 'supplement',
        originalValue: { fields: [] },
        correctedValue: { fields: [{ name: '地点', value: '海口' }] }
      };
      
      mockPrisma.correctionRecord.create.mockResolvedValue({ id: 'record-123' });
      
      await collector.recordCorrection('doc-123', 'field_correction', correction);
      
      expect(mockPrisma.correctionRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          correctionType: 'supplement'
        })
      });
    });
    
    it('should record filter type corrections', async () => {
      const correction = {
        type: 'filter',
        originalValue: { fields: [{ name: 'redundant', value: 'data' }] },
        correctedValue: { fields: [] }
      };
      
      mockPrisma.correctionRecord.create.mockResolvedValue({ id: 'record-123' });
      
      await collector.recordCorrection('doc-123', 'field_correction', correction);
      
      expect(mockPrisma.correctionRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          correctionType: 'filter'
        })
      });
    });
    
    it('should record verify type corrections', async () => {
      const correction = {
        type: 'verify',
        originalValue: { schema: 'SchemaA' },
        correctedValue: { schema: 'SchemaB' }
      };
      
      mockPrisma.correctionRecord.create.mockResolvedValue({ id: 'record-123' });
      
      await collector.recordCorrection('doc-123', 'schema_correction', correction);
      
      expect(mockPrisma.correctionRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          correctionType: 'verify'
        })
      });
    });
    
    it('should record adjust type corrections', async () => {
      const correction = {
        type: 'adjust',
        originalValue: { shouldMerge: false },
        correctedValue: { shouldMerge: true }
      };
      
      mockPrisma.correctionRecord.create.mockResolvedValue({ id: 'record-123' });
      
      await collector.recordCorrection('doc-123', 'merge_correction', correction);
      
      expect(mockPrisma.correctionRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          correctionType: 'adjust'
        })
      });
    });
    
    it('should default to adjust type when type not specified', async () => {
      const correction = {
        originalValue: { value: 'old' },
        correctedValue: { value: 'new' }
      };
      
      mockPrisma.correctionRecord.create.mockResolvedValue({ id: 'record-123' });
      
      await collector.recordCorrection('doc-123', 'field_correction', correction);
      
      expect(mockPrisma.correctionRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          correctionType: 'adjust'
        })
      });
    });
  });
  
  describe('multiple stages', () => {
    it('should track corrections across different stages', async () => {
      const stages = [
        'cbk_correction',
        'field_correction',
        'schema_correction',
        'merge_correction',
        'relation_correction'
      ];
      
      mockPrisma.correctionRecord.create.mockResolvedValue({ id: 'record-123' });
      
      for (const stage of stages) {
        await collector.recordCorrection('doc-123', stage, {
          type: 'supplement',
          correctedValue: { data: 'test' }
        });
      }
      
      // Verify all stages were recorded
      expect(mockPrisma.correctionRecord.create).toHaveBeenCalledTimes(stages.length);
      
      // Verify cache has all stages
      const docCache = collector.cache.get('doc-123');
      expect(docCache.size).toBe(stages.length);
    });
    
    it('should calculate improvements for each stage independently', async () => {
      const stageStats = {
        field_correction: [
          { accuracyBefore: 0.7, accuracyAfter: 0.9, recallBefore: 0.6, recallAfter: 0.85, precisionBefore: 0.75, precisionAfter: 0.92, totalCorrections: 5 }
        ],
        schema_correction: [
          { accuracyBefore: 0.8, accuracyAfter: 0.95, recallBefore: 0.75, recallAfter: 0.9, precisionBefore: 0.85, precisionAfter: 0.96, totalCorrections: 3 }
        ]
      };
      
      mockPrisma.correctionStats.findMany.mockImplementation(({ where }) => {
        return Promise.resolve(stageStats[where.stage] || []);
      });
      
      const fieldImprovement = await collector.calculateAccuracyImprovement('field_correction');
      const schemaImprovement = await collector.calculateAccuracyImprovement('schema_correction');
      
      expect(fieldImprovement.avgAccuracyBefore).toBe(0.7);
      expect(fieldImprovement.avgAccuracyAfter).toBe(0.9);
      expect(schemaImprovement.avgAccuracyBefore).toBe(0.8);
      expect(schemaImprovement.avgAccuracyAfter).toBe(0.95);
    });
  });
  
  describe('error handling edge cases', () => {
    it('should handle missing docId in getStats', async () => {
      const result = await collector.getStats(null);
      
      expect(result).toBeNull();
      expect(mockPrisma.correctionStats.findMany).not.toHaveBeenCalled();
    });
    
    it('should handle missing docId in getCorrections', async () => {
      const result = await collector.getCorrections(null);
      
      expect(result).toEqual([]);
      expect(mockPrisma.correctionRecord.findMany).not.toHaveBeenCalled();
    });
    
    it('should handle missing stage in calculateAccuracyImprovement', async () => {
      const result = await collector.calculateAccuracyImprovement(null);
      
      expect(result).toBeNull();
    });
    
    it('should handle database errors in getStats', async () => {
      mockPrisma.correctionStats.findMany.mockRejectedValue(new Error('DB error'));
      
      const result = await collector.getStats('doc-123', 'field_correction');
      
      expect(result).toBeNull();
    });
    
    it('should handle database errors in getCorrections', async () => {
      mockPrisma.correctionRecord.findMany.mockRejectedValue(new Error('DB error'));
      
      const result = await collector.getCorrections('doc-123', 'field_correction');
      
      expect(result).toEqual([]);
    });
    
    it('should handle database errors in calculateAccuracyImprovement', async () => {
      mockPrisma.correctionStats.findMany.mockRejectedValue(new Error('DB error'));
      
      const result = await collector.calculateAccuracyImprovement('field_correction');
      
      expect(result).toBeNull();
    });
    
    it('should handle database errors in recordCorrections', async () => {
      mockPrisma.correctionRecord.createMany.mockRejectedValue(new Error('DB error'));
      
      const result = await collector.recordCorrections('doc-123', 'field_correction', [
        { type: 'supplement', correctedValue: { field: 'value' } }
      ]);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
    
    it('should handle database errors in updateStats', async () => {
      mockPrisma.correctionStats.upsert.mockRejectedValue(new Error('DB error'));
      
      const result = await collector.updateStats('doc-123', 'field_correction', {
        totalCorrections: 5
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });
  
  describe('serialization edge cases', () => {
    it('should handle serialization of undefined values', async () => {
      const correction = {
        type: 'supplement',
        originalValue: undefined,
        correctedValue: undefined
      };
      
      mockPrisma.correctionRecord.create.mockResolvedValue({ id: 'record-123' });
      
      const result = await collector.recordCorrection('doc-123', 'field_correction', correction);
      
      expect(result.success).toBe(true);
      expect(mockPrisma.correctionRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          originalValue: null,
          correctedValue: null
        })
      });
    });
    
    it('should handle string values without JSON parsing', async () => {
      const correction = {
        type: 'supplement',
        originalValue: 'simple string',
        correctedValue: 'another string'
      };
      
      mockPrisma.correctionRecord.create.mockResolvedValue({ id: 'record-123' });
      
      const result = await collector.recordCorrection('doc-123', 'field_correction', correction);
      
      expect(result.success).toBe(true);
      expect(mockPrisma.correctionRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          originalValue: 'simple string',
          correctedValue: 'another string'
        })
      });
    });
  });
  
  describe('cache retrieval with no stage', () => {
    it('should retrieve all corrections from cache when no stage specified', async () => {
      const docId = 'doc-123';
      
      // Populate cache with multiple stages
      collector._addToCache(docId, 'field_correction', { type: 'supplement', data: 'field' });
      collector._addToCache(docId, 'schema_correction', { type: 'verify', data: 'schema' });
      
      const corrections = await collector.getCorrections(docId);
      
      expect(corrections.length).toBeGreaterThan(0);
      expect(mockPrisma.correctionRecord.findMany).not.toHaveBeenCalled();
    });
    
    it('should retrieve all stats from cache when no stage specified', async () => {
      const docId = 'doc-123';
      
      // Populate cache with multiple stages
      collector._updateStatsCache(docId, 'field_correction', { totalCorrections: 5 });
      collector._updateStatsCache(docId, 'schema_correction', { totalCorrections: 3 });
      
      // Clear persistence to force cache usage
      collector.enablePersistence = false;
      
      const stats = await collector.getStats(docId);
      
      expect(stats).toBeDefined();
      expect(stats.field_correction).toBeDefined();
      expect(stats.schema_correction).toBeDefined();
    });
  });
});
