/**
 * Tests for Accuracy Monitor
 */

const { AccuracyMonitor, getAccuracyMonitor } = require('./accuracy_monitor');

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    kGAccuracyMetric: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([])
    }
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma)
  };
});

describe('AccuracyMonitor', () => {
  let monitor;
  
  beforeEach(() => {
    monitor = new AccuracyMonitor({
      maxAccuracyDrop: 0.02,
      warningThreshold: 0.015,
      autoDegradationEnabled: true,
      degradationThreshold: 0.02,
      minTestSetSize: 3,
      loggingEnabled: false
    });
  });
  
  afterEach(() => {
    monitor.resetSession();
    monitor.clearAlerts();
  });
  
  describe('recordAccuracy', () => {
    it('should record baseline accuracy metrics', async () => {
      const result = await monitor.recordAccuracy({
        module: 'field_extraction',
        testCaseId: 'test_001',
        metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
        optimized: false
      });
      
      expect(result).toMatchObject({
        module: 'field_extraction',
        testCaseId: 'test_001',
        metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
        optimized: false
      });
      expect(result.timestamp).toBeDefined();
    });
    
    it('should record optimized accuracy metrics', async () => {
      const result = await monitor.recordAccuracy({
        module: 'field_extraction',
        testCaseId: 'test_002',
        metrics: { precision: 0.83, recall: 0.78, f1: 0.805 },
        optimized: true
      });
      
      expect(result.optimized).toBe(true);
    });
    
    it('should throw error if metrics are incomplete', async () => {
      await expect(
        monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: 'test_003',
          metrics: { precision: 0.85 }, // Missing recall and f1
          optimized: false
        })
      ).rejects.toThrow('Metrics must include precision, recall, and f1');
    });
    
    it('should store metrics in session cache', async () => {
      await monitor.recordAccuracy({
        module: 'field_extraction',
        testCaseId: 'test_004',
        metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
        optimized: false
      });
      
      const status = monitor.getAccuracyStatus();
      expect(status.fieldExtraction.baseline.count).toBe(1);
      expect(status.fieldExtraction.baseline.f1).toBe(0.825);
    });
  });
  
  describe('getAccuracyStatus', () => {
    it('should return status for all modules', async () => {
      // Record some metrics
      await monitor.recordAccuracy({
        module: 'field_extraction',
        testCaseId: 'test_005',
        metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
        optimized: false
      });
      
      await monitor.recordAccuracy({
        module: 'field_extraction',
        testCaseId: 'test_006',
        metrics: { precision: 0.83, recall: 0.78, f1: 0.805 },
        optimized: true
      });
      
      const status = monitor.getAccuracyStatus();
      
      expect(status.fieldExtraction).toBeDefined();
      expect(status.fieldExtraction.baseline.f1).toBe(0.825);
      expect(status.fieldExtraction.optimized.f1).toBe(0.805);
      expect(status.fieldExtraction.drop).toBeCloseTo(0.0242, 3);
      expect(status.fieldExtraction.dropPercent).toBeCloseTo(2.42, 1);
    });
    
    it('should indicate acceptable accuracy drop', async () => {
      await monitor.recordAccuracy({
        module: 'field_extraction',
        testCaseId: 'test_007',
        metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
        optimized: false
      });
      
      await monitor.recordAccuracy({
        module: 'field_extraction',
        testCaseId: 'test_008',
        metrics: { precision: 0.84, recall: 0.79, f1: 0.815 },
        optimized: true
      });
      
      const status = monitor.getAccuracyStatus();
      expect(status.fieldExtraction.isAcceptable).toBe(true);
      expect(status.fieldExtraction.drop).toBeLessThan(0.02);
    });
    
    it('should indicate unacceptable accuracy drop', async () => {
      await monitor.recordAccuracy({
        module: 'field_extraction',
        testCaseId: 'test_009',
        metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
        optimized: false
      });
      
      await monitor.recordAccuracy({
        module: 'field_extraction',
        testCaseId: 'test_010',
        metrics: { precision: 0.80, recall: 0.75, f1: 0.775 },
        optimized: true
      });
      
      const status = monitor.getAccuracyStatus();
      expect(status.fieldExtraction.isAcceptable).toBe(false);
      expect(status.fieldExtraction.drop).toBeGreaterThan(0.02);
    });
  });
  
  describe('Auto-degradation', () => {
    it('should trigger degradation when threshold exceeded', async () => {
      // Record baseline metrics (need minTestSetSize = 3)
      for (let i = 0; i < 3; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_baseline_${i}`,
          metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
          optimized: false
        });
      }
      
      // Record optimized metrics with significant drop
      for (let i = 0; i < 3; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_optimized_${i}`,
          metrics: { precision: 0.80, recall: 0.75, f1: 0.775 },
          optimized: true
        });
      }
      
      expect(monitor.isDegraded('field_extraction')).toBe(true);
      
      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('accuracy_degradation');
      expect(alerts[0].severity).toBe('critical');
    });
    
    it('should not trigger degradation with acceptable drop', async () => {
      // Record baseline metrics
      for (let i = 0; i < 3; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_baseline_${i}`,
          metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
          optimized: false
        });
      }
      
      // Record optimized metrics with small drop
      for (let i = 0; i < 3; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_optimized_${i}`,
          metrics: { precision: 0.84, recall: 0.79, f1: 0.815 },
          optimized: true
        });
      }
      
      expect(monitor.isDegraded('field_extraction')).toBe(false);
    });
    
    it('should create warning alert for moderate drop', async () => {
      // Record baseline metrics
      for (let i = 0; i < 3; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_baseline_${i}`,
          metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
          optimized: false
        });
      }
      
      // Record optimized metrics with moderate drop (between warning and degradation threshold)
      // Drop should be ~1.7% (between 1.5% warning and 2% degradation)
      for (let i = 0; i < 3; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_optimized_${i}`,
          metrics: { precision: 0.83, recall: 0.79, f1: 0.811 },
          optimized: true
        });
      }
      
      const alerts = monitor.getAlerts();
      const warningAlert = alerts.find(a => a.type === 'accuracy_warning');
      expect(warningAlert).toBeDefined();
      expect(warningAlert.severity).toBe('warning');
    });
    
    it('should not trigger degradation with insufficient test cases', async () => {
      // Record only 2 baseline metrics (less than minTestSetSize)
      for (let i = 0; i < 2; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_baseline_${i}`,
          metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
          optimized: false
        });
      }
      
      // Record 2 optimized metrics with significant drop
      for (let i = 0; i < 2; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_optimized_${i}`,
          metrics: { precision: 0.80, recall: 0.75, f1: 0.775 },
          optimized: true
        });
      }
      
      expect(monitor.isDegraded('field_extraction')).toBe(false);
    });
  });
  
  describe('isDegraded', () => {
    it('should return false initially', () => {
      expect(monitor.isDegraded('field_extraction')).toBe(false);
    });
    
    it('should return true after degradation triggered', async () => {
      // Trigger degradation
      for (let i = 0; i < 3; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_baseline_${i}`,
          metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
          optimized: false
        });
      }
      
      for (let i = 0; i < 3; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_optimized_${i}`,
          metrics: { precision: 0.80, recall: 0.75, f1: 0.775 },
          optimized: true
        });
      }
      
      expect(monitor.isDegraded('field_extraction')).toBe(true);
    });
  });
  
  describe('resetDegradation', () => {
    it('should reset degradation state', async () => {
      // Trigger degradation
      for (let i = 0; i < 3; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_baseline_${i}`,
          metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
          optimized: false
        });
      }
      
      for (let i = 0; i < 3; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_optimized_${i}`,
          metrics: { precision: 0.80, recall: 0.75, f1: 0.775 },
          optimized: true
        });
      }
      
      expect(monitor.isDegraded('field_extraction')).toBe(true);
      
      monitor.resetDegradation('field_extraction');
      
      expect(monitor.isDegraded('field_extraction')).toBe(false);
    });
    
    it('should clear related alerts', async () => {
      // Trigger degradation
      for (let i = 0; i < 3; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_baseline_${i}`,
          metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
          optimized: false
        });
      }
      
      for (let i = 0; i < 3; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_optimized_${i}`,
          metrics: { precision: 0.80, recall: 0.75, f1: 0.775 },
          optimized: true
        });
      }
      
      expect(monitor.getAlerts().length).toBeGreaterThan(0);
      
      monitor.resetDegradation('field_extraction');
      
      const degradationAlerts = monitor.getAlerts().filter(
        a => a.type === 'accuracy_degradation' && a.module === 'field_extraction'
      );
      expect(degradationAlerts.length).toBe(0);
    });
  });
  
  describe('getAlerts', () => {
    it('should return empty array initially', () => {
      expect(monitor.getAlerts()).toEqual([]);
    });
    
    it('should return alerts after degradation', async () => {
      // Trigger degradation
      for (let i = 0; i < 3; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_baseline_${i}`,
          metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
          optimized: false
        });
      }
      
      for (let i = 0; i < 3; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_optimized_${i}`,
          metrics: { precision: 0.80, recall: 0.75, f1: 0.775 },
          optimized: true
        });
      }
      
      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0]).toHaveProperty('type');
      expect(alerts[0]).toHaveProperty('severity');
      expect(alerts[0]).toHaveProperty('message');
      expect(alerts[0]).toHaveProperty('timestamp');
    });
  });
  
  describe('clearAlerts', () => {
    it('should clear all alerts', async () => {
      // Trigger degradation
      for (let i = 0; i < 3; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_baseline_${i}`,
          metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
          optimized: false
        });
      }
      
      for (let i = 0; i < 3; i++) {
        await monitor.recordAccuracy({
          module: 'field_extraction',
          testCaseId: `test_optimized_${i}`,
          metrics: { precision: 0.80, recall: 0.75, f1: 0.775 },
          optimized: true
        });
      }
      
      expect(monitor.getAlerts().length).toBeGreaterThan(0);
      
      monitor.clearAlerts();
      
      expect(monitor.getAlerts()).toEqual([]);
    });
  });
  
  describe('resetSession', () => {
    it('should reset all session metrics', async () => {
      await monitor.recordAccuracy({
        module: 'field_extraction',
        testCaseId: 'test_011',
        metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
        optimized: false
      });
      
      monitor.resetSession();
      
      const status = monitor.getAccuracyStatus();
      expect(status.fieldExtraction.baseline.count).toBe(0);
    });
    
    it('should reset specific module metrics', async () => {
      await monitor.recordAccuracy({
        module: 'field_extraction',
        testCaseId: 'test_012',
        metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
        optimized: false
      });
      
      await monitor.recordAccuracy({
        module: 'entity_recognition',
        testCaseId: 'test_013',
        metrics: { precision: 0.80, recall: 0.75, f1: 0.775 },
        optimized: false
      });
      
      monitor.resetSession('field_extraction');
      
      const status = monitor.getAccuracyStatus();
      expect(status.fieldExtraction.baseline.count).toBe(0);
      expect(status.entityRecognition.baseline.count).toBe(1);
    });
  });
  
  describe('getAccuracyMonitor singleton', () => {
    it('should return same instance', () => {
      const monitor1 = getAccuracyMonitor();
      const monitor2 = getAccuracyMonitor();
      
      expect(monitor1).toBe(monitor2);
    });
  });
  
  describe('Multiple modules', () => {
    it('should track accuracy for multiple modules independently', async () => {
      // Field extraction
      await monitor.recordAccuracy({
        module: 'field_extraction',
        testCaseId: 'test_014',
        metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
        optimized: false
      });
      
      // Entity recognition
      await monitor.recordAccuracy({
        module: 'entity_recognition',
        testCaseId: 'test_015',
        metrics: { precision: 0.80, recall: 0.75, f1: 0.775 },
        optimized: false
      });
      
      // Relation extraction
      await monitor.recordAccuracy({
        module: 'relation_extraction',
        testCaseId: 'test_016',
        metrics: { precision: 0.75, recall: 0.70, f1: 0.725 },
        optimized: false
      });
      
      const status = monitor.getAccuracyStatus();
      expect(status.fieldExtraction.baseline.f1).toBe(0.825);
      expect(status.entityRecognition.baseline.f1).toBe(0.775);
      expect(status.relationExtraction.baseline.f1).toBe(0.725);
    });
  });
});
