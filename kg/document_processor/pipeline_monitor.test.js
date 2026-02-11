/**
 * Unit Tests for Pipeline Monitor
 * 
 * Tests monitoring startup, stage recording, progress queries,
 * bottleneck identification, and timeout detection
 */

const pipelineMonitor = require('./pipeline_monitor');
const { STAGES } = require('./pipeline_monitor');
const { PrismaClient } = require('@prisma/client');

// Mock alert_manager to avoid circular dependency issues
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

describe('PipelineMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startMonitoring', () => {
    it('should create a new monitor record', async () => {
      const docId = 'doc-123';
      prisma.processingMonitor.create.mockResolvedValue({
        monitorId: 'monitor-123',
        docId: docId,
        startTime: new Date(),
        stages: '[]'
      });

      const monitorId = await pipelineMonitor.startMonitoring(docId);

      expect(monitorId).toBeDefined();
      expect(typeof monitorId).toBe('string');
      expect(prisma.processingMonitor.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          monitorId: expect.any(String),
          docId: docId,
          startTime: expect.any(Date),
          stages: '[]'
        })
      });
    });

    it('should generate unique monitor IDs', async () => {
      prisma.processingMonitor.create.mockResolvedValue({});

      const id1 = await pipelineMonitor.startMonitoring('doc-1');
      const id2 = await pipelineMonitor.startMonitoring('doc-2');

      expect(id1).not.toBe(id2);
    });
  });

  describe('recordStage', () => {
    it('should record a new stage start', async () => {
      const monitorId = 'monitor-123';
      const stageName = STAGES.STRUCTURE_ANALYSIS;

      prisma.processingMonitor.findUnique.mockResolvedValue({
        monitorId: monitorId,
        docId: 'doc-123',
        stages: '[]'
      });
      prisma.processingMonitor.update.mockResolvedValue({});

      await pipelineMonitor.recordStage(monitorId, stageName, 'started');

      expect(prisma.processingMonitor.update).toHaveBeenCalledWith({
        where: { monitorId: monitorId },
        data: {
          stages: expect.stringContaining(stageName)
        }
      });
    });

    it('should record stage completion with duration', async () => {
      const monitorId = 'monitor-123';
      const stageName = STAGES.STRUCTURE_ANALYSIS;
      const startTime = new Date('2024-01-01T10:00:00Z');

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

      await pipelineMonitor.recordStage(monitorId, stageName, 'completed');

      const updateCall = prisma.processingMonitor.update.mock.calls[0][0];
      const stages = JSON.parse(updateCall.data.stages);
      const stage = stages.find(s => s.stage_name === stageName);

      expect(stage.status).toBe('completed');
      expect(stage.end_time).toBeDefined();
      expect(stage.duration_ms).toBeGreaterThan(0);
    });

    it('should record stage failure with error message', async () => {
      const monitorId = 'monitor-123';
      const stageName = STAGES.CKB_PARSING;
      const errorMessage = 'Parsing failed';

      prisma.processingMonitor.findUnique.mockResolvedValue({
        monitorId: monitorId,
        docId: 'doc-123',
        stages: JSON.stringify([{
          stage_name: stageName,
          start_time: new Date().toISOString(),
          status: 'started',
          metadata: {}
        }])
      });
      prisma.processingMonitor.update.mockResolvedValue({});

      await pipelineMonitor.recordStage(monitorId, stageName, 'failed', {
        error: errorMessage
      });

      const updateCall = prisma.processingMonitor.update.mock.calls[0][0];
      const stages = JSON.parse(updateCall.data.stages);
      const stage = stages.find(s => s.stage_name === stageName);

      expect(stage.status).toBe('failed');
      expect(stage.error_message).toBe(errorMessage);
    });

    it('should throw error if monitor not found', async () => {
      prisma.processingMonitor.findUnique.mockResolvedValue(null);

      await expect(
        pipelineMonitor.recordStage('invalid-id', STAGES.STRUCTURE_ANALYSIS, 'started')
      ).rejects.toThrow('Monitor invalid-id not found');
    });

    it('should update metadata when provided', async () => {
      const monitorId = 'monitor-123';
      const stageName = STAGES.FIELD_EXTRACTION;
      const metadata = { fields_extracted: 10, llm_calls: 3 };

      prisma.processingMonitor.findUnique.mockResolvedValue({
        monitorId: monitorId,
        docId: 'doc-123',
        stages: JSON.stringify([{
          stage_name: stageName,
          start_time: new Date().toISOString(),
          status: 'started',
          metadata: {}
        }])
      });
      prisma.processingMonitor.update.mockResolvedValue({});

      await pipelineMonitor.recordStage(monitorId, stageName, 'completed', metadata);

      const updateCall = prisma.processingMonitor.update.mock.calls[0][0];
      const stages = JSON.parse(updateCall.data.stages);
      const stage = stages.find(s => s.stage_name === stageName);

      expect(stage.metadata).toMatchObject(metadata);
    });

    it('should set end time when all stages complete', async () => {
      const monitorId = 'monitor-123';
      const allStages = [
        { stage_name: STAGES.STRUCTURE_ANALYSIS, status: 'completed', start_time: new Date().toISOString(), duration_ms: 1000, metadata: {} },
        { stage_name: STAGES.CONTENT_FILTERING, status: 'started', start_time: new Date().toISOString(), metadata: {} }
      ];

      prisma.processingMonitor.findUnique.mockResolvedValue({
        monitorId: monitorId,
        docId: 'doc-123',
        stages: JSON.stringify(allStages)
      });
      prisma.processingMonitor.update.mockResolvedValue({});

      await pipelineMonitor.recordStage(monitorId, STAGES.CONTENT_FILTERING, 'completed');

      const updateCall = prisma.processingMonitor.update.mock.calls[0][0];
      expect(updateCall.data.endTime).toBeDefined();
    });
  });

  describe('getProgress', () => {
    it('should calculate progress percentage correctly', async () => {
      const monitorId = 'monitor-123';
      const stages = [
        { stage_name: STAGES.STRUCTURE_ANALYSIS, status: 'completed', duration_ms: 1000 },
        { stage_name: STAGES.CONTENT_FILTERING, status: 'completed', duration_ms: 500 },
        { stage_name: STAGES.CKB_PARSING, status: 'started' }
      ];

      prisma.processingMonitor.findUnique.mockResolvedValue({
        monitorId: monitorId,
        docId: 'doc-123',
        stages: JSON.stringify(stages)
      });

      const progress = await pipelineMonitor.getProgress(monitorId);

      expect(progress.completed_stages).toHaveLength(2);
      expect(progress.current_stage).toBe(STAGES.CKB_PARSING);
      expect(progress.progress_percentage).toBeCloseTo(22.22, 1); // 2/9 stages
    });

    it('should estimate remaining time based on average duration', async () => {
      const monitorId = 'monitor-123';
      const stages = [
        { stage_name: STAGES.STRUCTURE_ANALYSIS, status: 'completed', duration_ms: 1000 },
        { stage_name: STAGES.CONTENT_FILTERING, status: 'completed', duration_ms: 2000 },
        { stage_name: STAGES.CKB_PARSING, status: 'started' }
      ];

      prisma.processingMonitor.findUnique.mockResolvedValue({
        monitorId: monitorId,
        docId: 'doc-123',
        stages: JSON.stringify(stages)
      });

      const progress = await pipelineMonitor.getProgress(monitorId);

      // Average duration: (1000 + 2000) / 2 = 1500
      // Remaining stages: 9 - 2 = 7
      // Estimated time: 1500 * 7 = 10500
      expect(progress.estimated_remaining_time_ms).toBe(10500);
    });

    it('should return null for current stage when all complete', async () => {
      const monitorId = 'monitor-123';
      const stages = Object.keys(STAGES).map(key => ({
        stage_name: STAGES[key],
        status: 'completed',
        duration_ms: 1000
      }));

      prisma.processingMonitor.findUnique.mockResolvedValue({
        monitorId: monitorId,
        docId: 'doc-123',
        stages: JSON.stringify(stages)
      });

      const progress = await pipelineMonitor.getProgress(monitorId);

      expect(progress.current_stage).toBeNull();
      expect(progress.progress_percentage).toBe(100);
      expect(progress.estimated_remaining_time_ms).toBeNull();
    });

    it('should throw error if monitor not found', async () => {
      prisma.processingMonitor.findUnique.mockResolvedValue(null);

      await expect(
        pipelineMonitor.getProgress('invalid-id')
      ).rejects.toThrow('Monitor invalid-id not found');
    });
  });

  describe('identifyBottleneck', () => {
    it('should identify the slowest stage', async () => {
      const monitorId = 'monitor-123';
      const stages = [
        { stage_name: STAGES.STRUCTURE_ANALYSIS, status: 'completed', duration_ms: 1000 },
        { stage_name: STAGES.CONTENT_FILTERING, status: 'completed', duration_ms: 500 },
        { stage_name: STAGES.FIELD_EXTRACTION, status: 'completed', duration_ms: 5000 },
        { stage_name: STAGES.SCHEMA_MATCHING, status: 'completed', duration_ms: 2000 }
      ];

      prisma.processingMonitor.findUnique.mockResolvedValue({
        monitorId: monitorId,
        docId: 'doc-123',
        stages: JSON.stringify(stages)
      });

      const bottleneck = await pipelineMonitor.identifyBottleneck(monitorId);

      expect(bottleneck.slowest_stage).toBe(STAGES.FIELD_EXTRACTION);
      expect(bottleneck.duration_ms).toBe(5000);
      expect(bottleneck.percentage_of_total).toBeCloseTo(58.82, 1); // 5000/8500
      expect(bottleneck.recommendations).toBeDefined();
      expect(bottleneck.recommendations.length).toBeGreaterThan(0);
    });

    it('should return null if no completed stages', async () => {
      const monitorId = 'monitor-123';
      const stages = [
        { stage_name: STAGES.STRUCTURE_ANALYSIS, status: 'started' }
      ];

      prisma.processingMonitor.findUnique.mockResolvedValue({
        monitorId: monitorId,
        docId: 'doc-123',
        stages: JSON.stringify(stages)
      });

      const bottleneck = await pipelineMonitor.identifyBottleneck(monitorId);

      expect(bottleneck).toBeNull();
    });

    it('should return null if monitor not found', async () => {
      prisma.processingMonitor.findUnique.mockResolvedValue(null);

      const bottleneck = await pipelineMonitor.identifyBottleneck('invalid-id');

      expect(bottleneck).toBeNull();
    });

    it('should generate appropriate recommendations for each stage', () => {
      const testCases = [
        { stage_name: STAGES.STRUCTURE_ANALYSIS, duration_ms: 5000 },
        { stage_name: STAGES.CKB_PARSING, duration_ms: 5000 },
        { stage_name: STAGES.FIELD_EXTRACTION, duration_ms: 5000 },
        { stage_name: STAGES.SCHEMA_MATCHING, duration_ms: 5000 },
        { stage_name: STAGES.ENTITY_BUILDING, duration_ms: 5000 },
        { stage_name: STAGES.RELATION_BUILDING, duration_ms: 5000 }
      ];

      for (const testCase of testCases) {
        const recommendations = pipelineMonitor.generateBottleneckRecommendations(testCase);
        expect(recommendations).toBeDefined();
        expect(recommendations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('exportMonitoringData', () => {
    it('should export data in JSON format', async () => {
      const monitorId = 'monitor-123';
      const docId = 'doc-123';
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:05:00Z');
      const stages = [
        { stage_name: STAGES.STRUCTURE_ANALYSIS, status: 'completed', duration_ms: 1000 }
      ];

      prisma.processingMonitor.findUnique.mockResolvedValue({
        monitorId: monitorId,
        docId: docId,
        startTime: startTime,
        endTime: endTime,
        stages: JSON.stringify(stages)
      });

      const exported = await pipelineMonitor.exportMonitoringData(monitorId, 'json');
      const parsed = JSON.parse(exported);

      expect(parsed.monitor_id).toBe(monitorId);
      expect(parsed.doc_id).toBe(docId);
      expect(parsed.stages).toEqual(stages);
    });

    it('should export data in CSV format', async () => {
      const monitorId = 'monitor-123';
      const stages = [
        {
          stage_name: STAGES.STRUCTURE_ANALYSIS,
          status: 'completed',
          start_time: '2024-01-01T10:00:00Z',
          end_time: '2024-01-01T10:00:01Z',
          duration_ms: 1000,
          error_message: null
        },
        {
          stage_name: STAGES.CONTENT_FILTERING,
          status: 'failed',
          start_time: '2024-01-01T10:00:01Z',
          end_time: '2024-01-01T10:00:02Z',
          duration_ms: 1000,
          error_message: 'Filter error'
        }
      ];

      prisma.processingMonitor.findUnique.mockResolvedValue({
        monitorId: monitorId,
        docId: 'doc-123',
        stages: JSON.stringify(stages)
      });

      const exported = await pipelineMonitor.exportMonitoringData(monitorId, 'csv');

      expect(exported).toContain('Stage,Status,Start Time,End Time,Duration (ms),Error');
      expect(exported).toContain(STAGES.STRUCTURE_ANALYSIS);
      expect(exported).toContain('completed');
      expect(exported).toContain(STAGES.CONTENT_FILTERING);
      expect(exported).toContain('failed');
      expect(exported).toContain('Filter error');
    });

    it('should throw error for unsupported format', async () => {
      prisma.processingMonitor.findUnique.mockResolvedValue({
        monitorId: 'monitor-123',
        docId: 'doc-123',
        stages: '[]'
      });

      await expect(
        pipelineMonitor.exportMonitoringData('monitor-123', 'xml')
      ).rejects.toThrow('Unsupported format: xml');
    });

    it('should throw error if monitor not found', async () => {
      prisma.processingMonitor.findUnique.mockResolvedValue(null);

      await expect(
        pipelineMonitor.exportMonitoringData('invalid-id', 'json')
      ).rejects.toThrow('Monitor invalid-id not found');
    });
  });

  describe('endMonitoring', () => {
    it('should set end time for monitor', async () => {
      const monitorId = 'monitor-123';
      prisma.processingMonitor.update.mockResolvedValue({});

      await pipelineMonitor.endMonitoring(monitorId);

      expect(prisma.processingMonitor.update).toHaveBeenCalledWith({
        where: { monitorId: monitorId },
        data: {
          endTime: expect.any(Date)
        }
      });
    });
  });

  describe('checkPendingTasks', () => {
    it('should find monitors older than 1 hour without end time', async () => {
      const oldMonitor = {
        monitorId: 'monitor-old',
        docId: 'doc-123',
        startTime: new Date(Date.now() - 7200000), // 2 hours ago
        endTime: null,
        stages: JSON.stringify([
          { stage_name: STAGES.STRUCTURE_ANALYSIS, status: 'started' }
        ])
      };

      prisma.processingMonitor.findMany.mockResolvedValue([oldMonitor]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await pipelineMonitor.checkPendingTasks();

      expect(prisma.processingMonitor.findMany).toHaveBeenCalledWith({
        where: {
          endTime: null,
          startTime: {
            lt: expect.any(Date)
          }
        }
      });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Found 1 pending monitors'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('stuck at stage'));

      consoleSpy.mockRestore();
    });

    it('should handle no pending monitors', async () => {
      prisma.processingMonitor.findMany.mockResolvedValue([]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await pipelineMonitor.checkPendingTasks();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Found 0 pending monitors'));

      consoleSpy.mockRestore();
    });
  });
});
