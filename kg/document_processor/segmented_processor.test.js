/**
 * Unit Tests for Segmented Processor
 * 
 * Tests segmentation triggering, document segmentation, segment processing,
 * result merging, failure recovery, and parallel processing
 */

const segmentedProcessor = require('./segmented_processor');
const contentFilter = require('./content_filter');
const completenessValidator = require('./completeness_validator');
const alertManager = require('./alert_manager');
const { PrismaClient } = require('@prisma/client');

// Mock dependencies
jest.mock('./content_filter');
jest.mock('./completeness_validator');
jest.mock('./alert_manager');
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    segmentProcessing: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    }
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma)
  };
});

const prisma = new PrismaClient();

describe('SegmentedProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldUseSegmentation', () => {
    it('should return true for documents larger than 10MB', () => {
      const docSize = 11 * 1024 * 1024; // 11MB
      const unitCount = 1000;

      const result = segmentedProcessor.shouldUseSegmentation(docSize, unitCount);

      expect(result).toBe(true);
    });

    it('should return true for documents with more than 5000 units', () => {
      const docSize = 5 * 1024 * 1024; // 5MB
      const unitCount = 5001;

      const result = segmentedProcessor.shouldUseSegmentation(docSize, unitCount);

      expect(result).toBe(true);
    });

    it('should return false for small documents', () => {
      const docSize = 5 * 1024 * 1024; // 5MB
      const unitCount = 1000;

      const result = segmentedProcessor.shouldUseSegmentation(docSize, unitCount);

      expect(result).toBe(false);
    });

    it('should return true when either threshold is exceeded', () => {
      // Large size, small unit count
      expect(segmentedProcessor.shouldUseSegmentation(15 * 1024 * 1024, 100)).toBe(true);
      
      // Small size, large unit count
      expect(segmentedProcessor.shouldUseSegmentation(1 * 1024 * 1024, 6000)).toBe(true);
    });
  });

  describe('segmentDocument', () => {
    it('should segment document into equal-sized chunks', () => {
      const structure = {
        doc_id: 'doc-123',
        units: Array.from({ length: 2500 }, (_, i) => ({
          unit_id: `unit-${i}`,
          content: `Content ${i}`,
          type: 'paragraph'
        }))
      };

      const segments = segmentedProcessor.segmentDocument(structure, 1000);

      expect(segments).toHaveLength(3);
      expect(segments[0].units).toHaveLength(1000);
      expect(segments[1].units).toHaveLength(1000);
      expect(segments[2].units).toHaveLength(500);
    });

    it('should set correct segment metadata', () => {
      const structure = {
        doc_id: 'doc-123',
        units: Array.from({ length: 1500 }, (_, i) => ({
          unit_id: `unit-${i}`,
          content: `Content ${i}`
        }))
      };

      const segments = segmentedProcessor.segmentDocument(structure, 1000);

      expect(segments[0]).toMatchObject({
        segment_id: 'doc-123_seg_0',
        doc_id: 'doc-123',
        segment_index: 0,
        total_segments: 2,
        start_unit_id: 'unit-0',
        end_unit_id: 'unit-999'
      });

      expect(segments[1]).toMatchObject({
        segment_id: 'doc-123_seg_1',
        doc_id: 'doc-123',
        segment_index: 1,
        total_segments: 2,
        start_unit_id: 'unit-1000',
        end_unit_id: 'unit-1499'
      });
    });

    it('should handle documents smaller than segment size', () => {
      const structure = {
        doc_id: 'doc-123',
        units: Array.from({ length: 500 }, (_, i) => ({
          unit_id: `unit-${i}`,
          content: `Content ${i}`
        }))
      };

      const segments = segmentedProcessor.segmentDocument(structure, 1000);

      expect(segments).toHaveLength(1);
      expect(segments[0].units).toHaveLength(500);
    });

    it('should use custom segment size', () => {
      const structure = {
        doc_id: 'doc-123',
        units: Array.from({ length: 1000 }, (_, i) => ({
          unit_id: `unit-${i}`,
          content: `Content ${i}`
        }))
      };

      const segments = segmentedProcessor.segmentDocument(structure, 250);

      expect(segments).toHaveLength(4);
      segments.forEach(seg => {
        expect(seg.units.length).toBeLessThanOrEqual(250);
      });
    });
  });

  describe('processSegment', () => {
    it('should process segment successfully', async () => {
      const segment = {
        segment_id: 'doc-123_seg_0',
        doc_id: 'doc-123',
        segment_index: 0,
        total_segments: 2,
        units: [
          { unit_id: 'unit-1', content: 'Content 1', type: 'paragraph' },
          { unit_id: 'unit-2', content: 'Content 2', type: 'paragraph' }
        ]
      };

      const mockCKBs = [
        { ckb_id: 'ckb-1', content: { text: 'CKB 1' } },
        { ckb_id: 'ckb-2', content: { text: 'CKB 2' } }
      ];

      const ckbGenerator = jest.fn()
        .mockResolvedValueOnce(mockCKBs[0])
        .mockResolvedValueOnce(mockCKBs[1]);

      contentFilter.applyFilters.mockReturnValue({
        filtered_units: segment.units,
        skipped_units: [],
        stats: { total_units: 2, filtered_units: 2, skipped_by_rule: {} }
      });

      completenessValidator.validate.mockResolvedValue({
        doc_id: 'doc-123',
        total_structural_units: 2,
        ckb_count: 2,
        skipped_count: 0,
        coverage_rate: 1.0,
        missing_units: [],
        low_quality_ckbs: [],
        is_complete: true,
        warnings: []
      });

      prisma.segmentProcessing.create.mockResolvedValue({});
      prisma.segmentProcessing.update.mockResolvedValue({});

      const result = await segmentedProcessor.processSegment(segment, ckbGenerator);

      expect(result.segment_id).toBe('doc-123_seg_0');
      expect(result.ckbs).toHaveLength(2);
      expect(result.validation).toBeDefined();
      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
      expect(result.resource_usage).toBeDefined();
      expect(prisma.segmentProcessing.create).toHaveBeenCalled();
      expect(prisma.segmentProcessing.update).toHaveBeenCalledWith({
        where: { segmentId: 'doc-123_seg_0' },
        data: { status: 'completed' }
      });
    });

    it('should handle CKB generation errors gracefully', async () => {
      const segment = {
        segment_id: 'doc-123_seg_0',
        doc_id: 'doc-123',
        segment_index: 0,
        total_segments: 1,
        units: [
          { unit_id: 'unit-1', content: 'Content 1' },
          { unit_id: 'unit-2', content: 'Content 2' }
        ]
      };

      const ckbGenerator = jest.fn()
        .mockResolvedValueOnce({ ckb_id: 'ckb-1' })
        .mockRejectedValueOnce(new Error('CKB generation failed'));

      contentFilter.applyFilters.mockReturnValue({
        filtered_units: segment.units,
        skipped_units: [],
        stats: {}
      });

      completenessValidator.validate.mockResolvedValue({
        doc_id: 'doc-123',
        total_structural_units: 2,
        ckb_count: 1,
        skipped_count: 0,
        coverage_rate: 0.5,
        missing_units: [],
        low_quality_ckbs: [],
        is_complete: false,
        warnings: []
      });

      prisma.segmentProcessing.create.mockResolvedValue({});
      prisma.segmentProcessing.update.mockResolvedValue({});

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await segmentedProcessor.processSegment(segment, ckbGenerator);

      expect(result.ckbs).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should save failure state on processing error', async () => {
      const segment = {
        segment_id: 'doc-123_seg_0',
        doc_id: 'doc-123',
        segment_index: 0,
        total_segments: 1,
        units: []
      };

      const ckbGenerator = jest.fn();

      contentFilter.applyFilters.mockImplementation(() => {
        throw new Error('Filter error');
      });

      prisma.segmentProcessing.create.mockResolvedValue({});
      prisma.segmentProcessing.update.mockResolvedValue({});

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        segmentedProcessor.processSegment(segment, ckbGenerator)
      ).rejects.toThrow('Filter error');

      expect(prisma.segmentProcessing.update).toHaveBeenCalledWith({
        where: { segmentId: 'doc-123_seg_0' },
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: 'Filter error',
          failedAt: expect.any(Date)
        })
      });

      consoleSpy.mockRestore();
    });
  });

  describe('mergeSegmentResults', () => {
    it('should merge multiple segment results correctly', async () => {
      const results = [
        {
          segment_id: 'seg-0',
          ckbs: [{ ckb_id: 'ckb-1' }, { ckb_id: 'ckb-2' }],
          validation: {
            doc_id: 'doc-123',
            total_structural_units: 100,
            ckb_count: 2,
            skipped_count: 10,
            missing_units: [],
            low_quality_ckbs: []
          },
          processing_time_ms: 1000,
          resource_usage: { memory_mb: 50, cpu_percentage: 0 }
        },
        {
          segment_id: 'seg-1',
          ckbs: [{ ckb_id: 'ckb-3' }],
          validation: {
            doc_id: 'doc-123',
            total_structural_units: 100,
            ckb_count: 1,
            skipped_count: 15,
            missing_units: [],
            low_quality_ckbs: []
          },
          processing_time_ms: 800,
          resource_usage: { memory_mb: 40, cpu_percentage: 0 }
        }
      ];

      const merged = await segmentedProcessor.mergeSegmentResults(results);

      expect(merged.doc_id).toBe('doc-123');
      expect(merged.total_ckbs).toBe(3);
      expect(merged.merged_validation.total_structural_units).toBe(200);
      expect(merged.merged_validation.ckb_count).toBe(3);
      expect(merged.merged_validation.skipped_count).toBe(25);
      expect(merged.merged_validation.coverage_rate).toBeCloseTo(0.14, 2); // (3+25)/200
      expect(merged.total_processing_time_ms).toBe(1800);
      expect(merged.segment_count).toBe(2);
      expect(merged.total_memory_usage_mb).toBe(90);
    });

    it('should calculate coverage rate correctly', async () => {
      const results = [
        {
          segment_id: 'seg-0',
          ckbs: Array(90).fill({ ckb_id: 'ckb' }),
          validation: {
            doc_id: 'doc-123',
            total_structural_units: 100,
            ckb_count: 90,
            skipped_count: 5,
            missing_units: [],
            low_quality_ckbs: []
          },
          processing_time_ms: 1000,
          resource_usage: { memory_mb: 50, cpu_percentage: 0 }
        }
      ];

      const merged = await segmentedProcessor.mergeSegmentResults(results);

      expect(merged.merged_validation.coverage_rate).toBe(0.95); // (90+5)/100
      expect(merged.merged_validation.is_complete).toBe(true);
    });

    it('should add warning for low coverage', async () => {
      const results = [
        {
          segment_id: 'seg-0',
          ckbs: Array(80).fill({ ckb_id: 'ckb' }),
          validation: {
            doc_id: 'doc-123',
            total_structural_units: 100,
            ckb_count: 80,
            skipped_count: 5,
            missing_units: [],
            low_quality_ckbs: []
          },
          processing_time_ms: 1000,
          resource_usage: { memory_mb: 50, cpu_percentage: 0 }
        }
      ];

      const merged = await segmentedProcessor.mergeSegmentResults(results);

      expect(merged.merged_validation.coverage_rate).toBe(0.85);
      expect(merged.merged_validation.is_complete).toBe(false);
      expect(merged.merged_validation.warnings).toHaveLength(1);
      expect(merged.merged_validation.warnings[0]).toContain('覆盖率 85.0% 低于 95%');
    });

    it('should merge missing units and low quality CKBs', async () => {
      const results = [
        {
          segment_id: 'seg-0',
          ckbs: [],
          validation: {
            doc_id: 'doc-123',
            total_structural_units: 100,
            ckb_count: 0,
            skipped_count: 0,
            missing_units: [{ unit_id: 'unit-1' }],
            low_quality_ckbs: [{ ckb_id: 'ckb-1' }]
          },
          processing_time_ms: 1000,
          resource_usage: { memory_mb: 50, cpu_percentage: 0 }
        },
        {
          segment_id: 'seg-1',
          ckbs: [],
          validation: {
            doc_id: 'doc-123',
            total_structural_units: 100,
            ckb_count: 0,
            skipped_count: 0,
            missing_units: [{ unit_id: 'unit-2' }],
            low_quality_ckbs: [{ ckb_id: 'ckb-2' }]
          },
          processing_time_ms: 1000,
          resource_usage: { memory_mb: 50, cpu_percentage: 0 }
        }
      ];

      const merged = await segmentedProcessor.mergeSegmentResults(results);

      expect(merged.merged_validation.missing_units).toHaveLength(2);
      expect(merged.merged_validation.low_quality_ckbs).toHaveLength(2);
    });
  });

  describe('recoverFromFailure', () => {
    it('should throw error if segment not found', async () => {
      prisma.segmentProcessing.findUnique.mockResolvedValue(null);

      await expect(
        segmentedProcessor.recoverFromFailure('invalid-seg', jest.fn())
      ).rejects.toThrow('Segment invalid-seg not found');
    });

    it('should throw error if segment is not in failed state', async () => {
      prisma.segmentProcessing.findUnique.mockResolvedValue({
        segmentId: 'seg-123',
        status: 'completed'
      });

      await expect(
        segmentedProcessor.recoverFromFailure('seg-123', jest.fn())
      ).rejects.toThrow('Segment seg-123 is not in failed state');
    });

    it('should indicate manual intervention needed', async () => {
      prisma.segmentProcessing.findUnique.mockResolvedValue({
        segmentId: 'seg-123',
        status: 'failed'
      });

      await expect(
        segmentedProcessor.recoverFromFailure('seg-123', jest.fn())
      ).rejects.toThrow('manual intervention');
    });
  });

  describe('adjustSegmentSize', () => {
    it('should reduce size when memory usage is high', () => {
      const currentSize = 1000;
      const resourceUsage = { memory_mb: 600 }; // > 500MB threshold

      const newSize = segmentedProcessor.adjustSegmentSize(currentSize, resourceUsage);

      expect(newSize).toBe(800); // 80% of 1000
    });

    it('should increase size when memory usage is low', () => {
      const currentSize = 1000;
      const resourceUsage = { memory_mb: 200 }; // < 250MB (50% of 500MB)

      const newSize = segmentedProcessor.adjustSegmentSize(currentSize, resourceUsage);

      expect(newSize).toBe(1200); // 120% of 1000
    });

    it('should keep size unchanged when memory usage is moderate', () => {
      const currentSize = 1000;
      const resourceUsage = { memory_mb: 300 }; // Between 250MB and 500MB

      const newSize = segmentedProcessor.adjustSegmentSize(currentSize, resourceUsage);

      expect(newSize).toBe(1000);
    });
  });
});
