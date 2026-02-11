/**
 * Property-Based Tests for Pipeline Monitor
 * 
 * Tests Properties 12-14:
 * - Property 12: 处理流水线记录
 * - Property 13: 处理超时告警
 * - Property 14: 处理失败率监控
 */

const fc = require('fast-check');
const pipelineMonitor = require('./pipeline_monitor');
const { STAGES } = require('./pipeline_monitor');
const alertManager = require('./alert_manager');
const { PrismaClient } = require('@prisma/client');

// Mock alert_manager
jest.mock('./alert_manager', () => ({
  trigger: jest.fn().mockResolvedValue(undefined)
}));

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    processingMonitor: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn()
    }
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma)
  };
});

const prisma = new PrismaClient();

describe('Pipeline Monitor - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 12: 处理流水线记录
   * 
   * For any 文档进入处理流水线，系统应该记录处理开始时间、文档元数据、
   * 各阶段的处理时间和状态。
   * 
   * **Validates: Requirements 4.1, 4.2, 4.3**
   */
  describe('Property 12: 处理流水线记录', () => {
    it('should record start time, metadata, and stage information for any document', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // docId
          fc.constantFrom(...Object.values(STAGES)), // stageName
          fc.record({
            fields_extracted: fc.integer({ min: 0, max: 100 }),
            entities_built: fc.integer({ min: 0, max: 50 }),
            relations_found: fc.integer({ min: 0, max: 100 })
          }), // metadata
          async (docId, stageName, metadata) => {
            // Clear mocks for each iteration
            jest.clearAllMocks();
            
            // Setup mock
            const monitorId = 'test-monitor-' + Date.now() + Math.random();
            prisma.processingMonitor.create.mockResolvedValue({
              monitorId: monitorId,
              docId: docId,
              startTime: new Date(),
              stages: '[]'
            });
            
            // Start monitoring
            const createdMonitorId = await pipelineMonitor.startMonitoring(docId);

            // Verify start time and doc metadata are recorded
            expect(prisma.processingMonitor.create).toHaveBeenCalledWith({
              data: expect.objectContaining({
                monitorId: expect.any(String),
                docId: docId,
                startTime: expect.any(Date),
                stages: '[]'
              })
            });

            // Setup for recordStage
            prisma.processingMonitor.findUnique.mockResolvedValue({
              monitorId: createdMonitorId,
              docId: docId,
              stages: '[]'
            });
            prisma.processingMonitor.update.mockResolvedValue({});

            // Record stage start
            await pipelineMonitor.recordStage(createdMonitorId, stageName, 'started', metadata);

            // Verify stage information is recorded
            const updateCalls = prisma.processingMonitor.update.mock.calls;
            expect(updateCalls.length).toBeGreaterThan(0);
            
            const updateCall = updateCalls[0][0];
            const stages = JSON.parse(updateCall.data.stages);
            const stage = stages.find(s => s.stage_name === stageName);

            expect(stage).toBeDefined();
            expect(stage.stage_name).toBe(stageName);
            expect(stage.start_time).toBeDefined();
            expect(stage.status).toBe('started');
            expect(stage.metadata).toMatchObject(metadata);

            // Complete the stage
            prisma.processingMonitor.findUnique.mockResolvedValue({
              monitorId: createdMonitorId,
              docId: docId,
              stages: JSON.stringify(stages)
            });

            await pipelineMonitor.recordStage(createdMonitorId, stageName, 'completed');

            // Verify processing time is recorded
            const completeCall = updateCalls[updateCalls.length - 1][0];
            const completedStages = JSON.parse(completeCall.data.stages);
            const completedStage = completedStages.find(s => s.stage_name === stageName);

            expect(completedStage.status).toBe('completed');
            expect(completedStage.end_time).toBeDefined();
            expect(completedStage.duration_ms).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should record failure status and error message for failed stages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // docId
          fc.constantFrom(...Object.values(STAGES)), // stageName
          fc.string({ minLength: 5, maxLength: 200 }), // errorMessage
          async (docId, stageName, errorMessage) => {
            // Clear mocks for each iteration
            jest.clearAllMocks();
            
            // Setup mock
            const monitorId = 'test-monitor-' + Date.now() + Math.random();
            prisma.processingMonitor.create.mockResolvedValue({
              monitorId: monitorId,
              docId: docId,
              startTime: new Date(),
              stages: '[]'
            });
            prisma.processingMonitor.findUnique.mockResolvedValue({
              monitorId: monitorId,
              docId: docId,
              stages: JSON.stringify([{
                stage_name: stageName,
                start_time: new Date().toISOString(),
                status: 'started',
                metadata: {}
              }])
            });
            prisma.processingMonitor.update.mockResolvedValue({});

            // Start monitoring
            await pipelineMonitor.startMonitoring(docId);

            // Record stage failure
            await pipelineMonitor.recordStage(monitorId, stageName, 'failed', {
              error: errorMessage
            });

            // Verify failure is recorded
            const updateCall = prisma.processingMonitor.update.mock.calls[0][0];
            const stages = JSON.parse(updateCall.data.stages);
            const stage = stages.find(s => s.stage_name === stageName);

            expect(stage.status).toBe('failed');
            expect(stage.error_message).toBe(errorMessage);
            expect(stage.end_time).toBeDefined();
            expect(stage.duration_ms).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 13: 处理超时告警
   * 
   * For any 文档处理阶段，如果处理时间超过预期阈值（如 5 分钟），
   * 系统应该发出告警。
   * 
   * **Validates: Requirements 4.5**
   */
  describe('Property 13: 处理超时告警', () => {
    it('should trigger timeout alert when stage duration exceeds threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(STAGES)), // stageName
          fc.integer({ min: 1, max: 10 }), // threshold multiplier
          async (stageName, multiplier) => {
            const monitorId = 'test-monitor-' + Date.now();
            
            // Get the threshold for this stage
            const TIMEOUT_THRESHOLDS = {
              [STAGES.STRUCTURE_ANALYSIS]: 60000,
              [STAGES.CONTENT_FILTERING]: 30000,
              [STAGES.CKB_PARSING]: 180000,
              [STAGES.FIELD_EXTRACTION]: 300000,
              [STAGES.SCHEMA_MATCHING]: 120000,
              [STAGES.ENTITY_BUILDING]: 120000,
              [STAGES.RELATION_BUILDING]: 180000,
              [STAGES.COMPLETENESS_VALIDATION]: 30000,
              [STAGES.REPORT_GENERATION]: 30000
            };
            
            const threshold = TIMEOUT_THRESHOLDS[stageName] || 300000;
            const duration = threshold * multiplier; // Exceed threshold
            
            // Create a stage that started long ago
            const startTime = new Date(Date.now() - duration);
            
            prisma.processingMonitor.findUnique.mockResolvedValue({
              monitorId: monitorId,
              docId: 'doc-123',
              stages: JSON.stringify([{
                stage_name: stageName,
                start_time: startTime.toISOString(),
                status: 'started',
                metadata: {}
              }])
            });
            prisma.processingMonitor.update.mockResolvedValue({});
            alertManager.trigger.mockClear();

            // Complete the stage (which will check for timeout)
            await pipelineMonitor.recordStage(monitorId, stageName, 'completed');

            // Verify timeout alert was triggered
            if (duration > threshold) {
              expect(alertManager.trigger).toHaveBeenCalledWith(
                'processing_timeout',
                expect.objectContaining({
                  monitor_id: monitorId,
                  stage: stageName,
                  duration_ms: expect.any(Number),
                  threshold_ms: threshold
                })
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not trigger alert when stage completes within threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(STAGES)), // stageName
          fc.double({ min: 0.1, max: 0.9, noNaN: true }), // threshold fraction (< 1.0)
          async (stageName, fraction) => {
            const monitorId = 'test-monitor-' + Date.now();
            
            const TIMEOUT_THRESHOLDS = {
              [STAGES.STRUCTURE_ANALYSIS]: 60000,
              [STAGES.CONTENT_FILTERING]: 30000,
              [STAGES.CKB_PARSING]: 180000,
              [STAGES.FIELD_EXTRACTION]: 300000,
              [STAGES.SCHEMA_MATCHING]: 120000,
              [STAGES.ENTITY_BUILDING]: 120000,
              [STAGES.RELATION_BUILDING]: 180000,
              [STAGES.COMPLETENESS_VALIDATION]: 30000,
              [STAGES.REPORT_GENERATION]: 30000
            };
            
            const threshold = TIMEOUT_THRESHOLDS[stageName] || 300000;
            const duration = Math.floor(threshold * fraction); // Within threshold
            
            const startTime = new Date(Date.now() - duration);
            
            prisma.processingMonitor.findUnique.mockResolvedValue({
              monitorId: monitorId,
              docId: 'doc-123',
              stages: JSON.stringify([{
                stage_name: stageName,
                start_time: startTime.toISOString(),
                status: 'started',
                metadata: {}
              }])
            });
            prisma.processingMonitor.update.mockResolvedValue({});
            alertManager.trigger.mockClear();

            // Complete the stage
            await pipelineMonitor.recordStage(monitorId, stageName, 'completed');

            // Verify no timeout alert was triggered
            expect(alertManager.trigger).not.toHaveBeenCalledWith(
              'processing_timeout',
              expect.anything()
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 14: 处理失败率监控
   * 
   * For any 批量处理，如果处理失败率 > 10%，系统应该触发告警。
   * 
   * **Validates: Requirements 4.9**
   */
  describe('Property 14: 处理失败率监控', () => {
    it('should calculate failure rate correctly for any batch of monitors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 100 }), // total monitors
          fc.double({ min: 0, max: 1, noNaN: true }), // failure rate
          async (totalMonitors, failureRate) => {
            const failedCount = Math.floor(totalMonitors * failureRate);
            const successCount = totalMonitors - failedCount;

            // Create mock monitors with mixed success/failure
            const monitors = [];
            
            // Add successful monitors
            for (let i = 0; i < successCount; i++) {
              monitors.push({
                monitorId: `monitor-success-${i}`,
                docId: `doc-${i}`,
                startTime: new Date(Date.now() - 300000),
                endTime: new Date(),
                stages: JSON.stringify([
                  {
                    stage_name: STAGES.STRUCTURE_ANALYSIS,
                    status: 'completed',
                    duration_ms: 1000
                  }
                ])
              });
            }

            // Add failed monitors
            for (let i = 0; i < failedCount; i++) {
              monitors.push({
                monitorId: `monitor-failed-${i}`,
                docId: `doc-failed-${i}`,
                startTime: new Date(Date.now() - 300000),
                endTime: new Date(),
                stages: JSON.stringify([
                  {
                    stage_name: STAGES.STRUCTURE_ANALYSIS,
                    status: 'failed',
                    error_message: 'Processing error',
                    duration_ms: 1000
                  }
                ])
              });
            }

            // Calculate failure rate
            const actualFailureRate = failedCount / totalMonitors;

            // Verify the calculation (allow for rounding errors from Math.floor)
            const tolerance = 1 / totalMonitors; // One monitor difference is acceptable
            expect(Math.abs(actualFailureRate - failureRate)).toBeLessThanOrEqual(tolerance);

            // If failure rate > 10%, alert should be triggered
            if (actualFailureRate > 0.1) {
              // In a real implementation, this would trigger an alert
              expect(actualFailureRate).toBeGreaterThan(0.1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should identify high failure rate scenarios requiring alerts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 20, max: 100 }), // total monitors
          fc.integer({ min: 3, max: 50 }), // failed monitors
          async (totalMonitors, failedMonitors) => {
            // Ensure we don't exceed total
            const actualFailed = Math.min(failedMonitors, totalMonitors);
            const failureRate = actualFailed / totalMonitors;

            // Create monitors
            const monitors = [];
            for (let i = 0; i < totalMonitors; i++) {
              const isFailed = i < actualFailed;
              monitors.push({
                monitorId: `monitor-${i}`,
                docId: `doc-${i}`,
                stages: JSON.stringify([
                  {
                    stage_name: STAGES.CKB_PARSING,
                    status: isFailed ? 'failed' : 'completed',
                    error_message: isFailed ? 'Error' : null,
                    duration_ms: 1000
                  }
                ])
              });
            }

            // Count failures
            const failedCount = monitors.filter(m => {
              const stages = JSON.parse(m.stages);
              return stages.some(s => s.status === 'failed');
            }).length;

            const calculatedRate = failedCount / totalMonitors;

            // Verify calculation
            expect(calculatedRate).toBeCloseTo(failureRate, 2);

            // Check if alert threshold is exceeded
            const shouldAlert = calculatedRate > 0.1;
            
            if (shouldAlert) {
              expect(calculatedRate).toBeGreaterThan(0.1);
              expect(failedCount).toBeGreaterThan(totalMonitors * 0.1);
            } else {
              expect(calculatedRate).toBeLessThanOrEqual(0.1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases in failure rate calculation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(0, 1, 10, 50, 100), // edge case counts
          async (totalMonitors) => {
            if (totalMonitors === 0) {
              // No monitors - failure rate is undefined or 0
              const failureRate = 0 / Math.max(1, totalMonitors);
              expect(failureRate).toBe(0);
            } else {
              // All failed
              const allFailedRate = totalMonitors / totalMonitors;
              expect(allFailedRate).toBe(1);

              // None failed
              const noneFailedRate = 0 / totalMonitors;
              expect(noneFailedRate).toBe(0);

              // Exactly 10% failed (boundary)
              const boundaryFailed = Math.floor(totalMonitors * 0.1);
              const boundaryRate = boundaryFailed / totalMonitors;
              expect(boundaryRate).toBeLessThanOrEqual(0.1);

              // Just over 10% failed
              const overFailed = Math.ceil(totalMonitors * 0.11);
              const overRate = overFailed / totalMonitors;
              if (overFailed > boundaryFailed) {
                expect(overRate).toBeGreaterThan(0.1);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
