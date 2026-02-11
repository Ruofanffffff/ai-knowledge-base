/**
 * Property-Based Tests for Segmented Processor
 * 
 * Tests Properties 15-21:
 * - Property 15: 分段处理触发条件
 * - Property 16: 分段结构连续性
 * - Property 17: 分段结果合并完整性
 * - Property 18: 分段处理失败恢复
 * - Property 19: 分段资源记录
 * - Property 20: 资源不足自适应
 * - Property 21: 跨分段实体关联
 */

const fc = require('fast-check');
const segmentedProcessor = require('./segmented_processor');
const contentFilter = require('./content_filter');
const completenessValidator = require('./completeness_validator');
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

describe('Segmented Processor - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 15: 分段处理触发条件
   * 
   * For any 文档，如果文档大小 > 10MB 或结构单元数量 > 5000，
   * 系统应该采用分段处理策略。
   * 
   * **Validates: Requirements 5.1, 5.2**
   */
  describe('Property 15: 分段处理触发条件', () => {
    it('should trigger segmentation for documents exceeding size threshold', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 11, max: 100 }), // Size in MB (> 10MB)
          fc.integer({ min: 100, max: 5000 }), // Unit count (< 5000)
          (sizeMB, unitCount) => {
            const docSize = sizeMB * 1024 * 1024;
            const result = segmentedProcessor.shouldUseSegmentation(docSize, unitCount);
            
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should trigger segmentation for documents exceeding unit count threshold', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // Size in MB (< 10MB)
          fc.integer({ min: 5001, max: 20000 }), // Unit count (> 5000)
          (sizeMB, unitCount) => {
            const docSize = sizeMB * 1024 * 1024;
            const result = segmentedProcessor.shouldUseSegmentation(docSize, unitCount);
            
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not trigger segmentation for small documents', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // Size in MB (<= 10MB)
          fc.integer({ min: 100, max: 5000 }), // Unit count (<= 5000)
          (sizeMB, unitCount) => {
            const docSize = sizeMB * 1024 * 1024;
            const result = segmentedProcessor.shouldUseSegmentation(docSize, unitCount);
            
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 16: 分段结构连续性
   * 
   * For any 分段处理的文档，所有分段的结构单元应该保持原文档的
   * 层级结构和顺序。
   * 
   * **Validates: Requirements 5.3**
   */
  describe('Property 16: 分段结构连续性', () => {
    it('should maintain unit order across segments', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 5000 }), // Total units
          fc.integer({ min: 50, max: 500 }), // Segment size
          (totalUnits, segmentSize) => {
            const structure = {
              doc_id: 'doc-test',
              units: Array.from({ length: totalUnits }, (_, i) => ({
                unit_id: `unit-${i}`,
                content: `Content ${i}`,
                type: 'paragraph'
              }))
            };

            const segments = segmentedProcessor.segmentDocument(structure, segmentSize);

            // Verify all units are included
            const allSegmentUnits = segments.flatMap(seg => seg.units);
            expect(allSegmentUnits.length).toBe(totalUnits);

            // Verify order is maintained
            for (let i = 0; i < allSegmentUnits.length; i++) {
              expect(allSegmentUnits[i].unit_id).toBe(`unit-${i}`);
            }

            // Verify no gaps or overlaps
            let expectedIndex = 0;
            for (const segment of segments) {
              for (const unit of segment.units) {
                const actualIndex = parseInt(unit.unit_id.split('-')[1]);
                expect(actualIndex).toBe(expectedIndex);
                expectedIndex++;
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve start and end unit IDs correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 1000 }),
          fc.integer({ min: 50, max: 200 }),
          (totalUnits, segmentSize) => {
            const structure = {
              doc_id: 'doc-test',
              units: Array.from({ length: totalUnits }, (_, i) => ({
                unit_id: `unit-${i}`,
                content: `Content ${i}`
              }))
            };

            const segments = segmentedProcessor.segmentDocument(structure, segmentSize);

            for (let i = 0; i < segments.length; i++) {
              const segment = segments[i];
              const firstUnit = segment.units[0];
              const lastUnit = segment.units[segment.units.length - 1];

              expect(segment.start_unit_id).toBe(firstUnit.unit_id);
              expect(segment.end_unit_id).toBe(lastUnit.unit_id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 17: 分段结果合并完整性
   * 
   * For any 分段处理完成后，合并后的 CKB 总数应该等于所有分段的
   * CKB 数量之和。
   * 
   * **Validates: Requirements 5.4, 5.10**
   */
  describe('Property 17: 分段结果合并完整性', () => {
    it('should preserve total CKB count when merging segments', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              ckb_count: fc.integer({ min: 0, max: 100 }),
              total_units: fc.integer({ min: 10, max: 200 }),
              skipped_count: fc.integer({ min: 0, max: 50 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (segmentData) => {
            const results = segmentData.map((data, index) => ({
              segment_id: `seg-${index}`,
              ckbs: Array(data.ckb_count).fill({ ckb_id: `ckb-${index}` }),
              validation: {
                doc_id: 'doc-test',
                total_structural_units: data.total_units,
                ckb_count: data.ckb_count,
                skipped_count: data.skipped_count,
                missing_units: [],
                low_quality_ckbs: []
              },
              processing_time_ms: 1000,
              resource_usage: { memory_mb: 50, cpu_percentage: 0 }
            }));

            const merged = await segmentedProcessor.mergeSegmentResults(results);

            // Total CKBs should equal sum of all segment CKBs
            const expectedTotal = segmentData.reduce((sum, data) => sum + data.ckb_count, 0);
            expect(merged.total_ckbs).toBe(expectedTotal);
            expect(merged.merged_validation.ckb_count).toBe(expectedTotal);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly sum processing times and resource usage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              processing_time: fc.integer({ min: 100, max: 5000 }),
              memory_usage: fc.integer({ min: 10, max: 200 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (segmentData) => {
            const results = segmentData.map((data, index) => ({
              segment_id: `seg-${index}`,
              ckbs: [],
              validation: {
                doc_id: 'doc-test',
                total_structural_units: 100,
                ckb_count: 0,
                skipped_count: 0,
                missing_units: [],
                low_quality_ckbs: []
              },
              processing_time_ms: data.processing_time,
              resource_usage: { memory_mb: data.memory_usage, cpu_percentage: 0 }
            }));

            const merged = await segmentedProcessor.mergeSegmentResults(results);

            const expectedTime = segmentData.reduce((sum, data) => sum + data.processing_time, 0);
            const expectedMemory = segmentData.reduce((sum, data) => sum + data.memory_usage, 0);

            expect(merged.total_processing_time_ms).toBe(expectedTime);
            expect(merged.total_memory_usage_mb).toBe(expectedMemory);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 18: 分段处理失败恢复
   * 
   * For any 分段处理失败，系统应该保存失败状态，并支持从失败点恢复，
   * 而不需要重新处理整个文档。
   * 
   * **Validates: Requirements 5.5**
   */
  describe('Property 18: 分段处理失败恢复', () => {
    it('should save failure state for any failed segment', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }), // segment ID
          fc.string({ minLength: 5, maxLength: 20 }), // doc ID
          fc.string({ minLength: 10, maxLength: 100 }), // error message
          async (segmentId, docId, errorMessage) => {
            const segment = {
              segment_id: segmentId,
              doc_id: docId,
              segment_index: 0,
              total_segments: 1,
              units: []
            };

            const ckbGenerator = jest.fn();
            contentFilter.applyFilters.mockImplementation(() => {
              throw new Error(errorMessage);
            });

            prisma.segmentProcessing.create.mockResolvedValue({});
            prisma.segmentProcessing.update.mockResolvedValue({});

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            await expect(
              segmentedProcessor.processSegment(segment, ckbGenerator)
            ).rejects.toThrow(errorMessage);

            // Verify failure state was saved
            expect(prisma.segmentProcessing.update).toHaveBeenCalledWith({
              where: { segmentId: segmentId },
              data: expect.objectContaining({
                status: 'failed',
                errorMessage: errorMessage,
                failedAt: expect.any(Date)
              })
            });

            consoleSpy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 19: 分段资源记录
   * 
   * For any 分段处理，系统应该记录每个分段的处理时间和资源消耗
   * （内存、CPU）。
   * 
   * **Validates: Requirements 5.6**
   */
  describe('Property 19: 分段资源记录', () => {
    it('should record processing time and resource usage for any segment', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // Number of units
          async (unitCount) => {
            const segment = {
              segment_id: 'seg-test',
              doc_id: 'doc-test',
              segment_index: 0,
              total_segments: 1,
              units: Array.from({ length: unitCount }, (_, i) => ({
                unit_id: `unit-${i}`,
                content: `Content ${i}`,
                type: 'paragraph'
              }))
            };

            const ckbGenerator = jest.fn().mockResolvedValue({ ckb_id: 'ckb-1' });

            contentFilter.applyFilters.mockReturnValue({
              filtered_units: segment.units,
              skipped_units: [],
              stats: {}
            });

            completenessValidator.validate.mockResolvedValue({
              doc_id: 'doc-test',
              total_structural_units: unitCount,
              ckb_count: unitCount,
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

            // Verify resource usage is recorded
            expect(result.processing_time_ms).toBeDefined();
            expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
            expect(result.resource_usage).toBeDefined();
            expect(result.resource_usage.memory_mb).toBeDefined();
            expect(typeof result.resource_usage.memory_mb).toBe('number');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 20: 资源不足自适应
   * 
   * For any 系统资源不足的情况，系统应该自动调整分段大小
   * （减少每批处理的单元数）。
   * 
   * **Validates: Requirements 5.7**
   */
  describe('Property 20: 资源不足自适应', () => {
    it('should reduce segment size when memory usage exceeds threshold', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 2000 }), // Current segment size
          fc.integer({ min: 501, max: 1000 }), // Memory usage (> 500MB threshold)
          (currentSize, memoryUsage) => {
            const resourceUsage = { memory_mb: memoryUsage };
            const newSize = segmentedProcessor.adjustSegmentSize(currentSize, resourceUsage);

            // Should reduce by 20%
            expect(newSize).toBe(Math.floor(currentSize * 0.8));
            expect(newSize).toBeLessThan(currentSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should increase segment size when memory usage is low', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 2000 }), // Current segment size
          fc.integer({ min: 10, max: 249 }), // Memory usage (< 250MB, which is 50% of 500MB)
          (currentSize, memoryUsage) => {
            const resourceUsage = { memory_mb: memoryUsage };
            const newSize = segmentedProcessor.adjustSegmentSize(currentSize, resourceUsage);

            // Should increase by 20%
            expect(newSize).toBe(Math.floor(currentSize * 1.2));
            expect(newSize).toBeGreaterThan(currentSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should keep segment size unchanged for moderate memory usage', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 2000 }), // Current segment size
          fc.integer({ min: 250, max: 500 }), // Memory usage (between 250MB and 500MB)
          (currentSize, memoryUsage) => {
            const resourceUsage = { memory_mb: memoryUsage };
            const newSize = segmentedProcessor.adjustSegmentSize(currentSize, resourceUsage);

            expect(newSize).toBe(currentSize);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 21: 跨分段实体关联
   * 
   * For any 分段处理的文档，跨分段的实体和关系应该能够正确关联
   * （通过 doc_id 和 unit_id）。
   * 
   * **Validates: Requirements 5.8**
   */
  describe('Property 21: 跨分段实体关联', () => {
    it('should maintain doc_id consistency across all segments', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 20 }), // doc_id
          fc.integer({ min: 100, max: 1000 }), // total units
          fc.integer({ min: 50, max: 200 }), // segment size
          (docId, totalUnits, segmentSize) => {
            const structure = {
              doc_id: docId,
              units: Array.from({ length: totalUnits }, (_, i) => ({
                unit_id: `unit-${i}`,
                content: `Content ${i}`
              }))
            };

            const segments = segmentedProcessor.segmentDocument(structure, segmentSize);

            // All segments should have the same doc_id
            for (const segment of segments) {
              expect(segment.doc_id).toBe(docId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve unique unit_ids across segments for entity association', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 1000 }),
          fc.integer({ min: 50, max: 200 }),
          (totalUnits, segmentSize) => {
            const structure = {
              doc_id: 'doc-test',
              units: Array.from({ length: totalUnits }, (_, i) => ({
                unit_id: `unit-${i}`,
                content: `Content ${i}`
              }))
            };

            const segments = segmentedProcessor.segmentDocument(structure, segmentSize);

            // Collect all unit_ids from all segments
            const allUnitIds = segments.flatMap(seg => seg.units.map(u => u.unit_id));

            // All unit_ids should be unique
            const uniqueUnitIds = new Set(allUnitIds);
            expect(uniqueUnitIds.size).toBe(totalUnits);

            // All unit_ids should be present
            for (let i = 0; i < totalUnits; i++) {
              expect(allUnitIds).toContain(`unit-${i}`);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
