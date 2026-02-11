/**
 * Tests for Latency Monitor
 */

const { LatencyMonitor, getLatencyMonitor } = require('./latency_monitor');

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    kGLatencyMetric: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([])
    }
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma)
  };
});

describe('LatencyMonitor', () => {
  let monitor;
  
  beforeEach(() => {
    monitor = new LatencyMonitor({
      warningThreshold: 5000,
      criticalThreshold: 10000,
      loggingEnabled: false,
      targetLatency: {
        document_processing: 5000,
        field_extraction: 2000,
        entity_building: 1000,
        relation_extraction: 2000
      }
    });
  });
  
  afterEach(() => {
    monitor.resetSession();
    monitor.clearAlerts();
  });
  
  describe('Timer operations', () => {
    it('should start and stop timer', async () => {
      const timerId = monitor.startTimer('test_op', {
        module: 'field_extraction',
        optimized: false
      });
      
      expect(timerId).toBeDefined();
      expect(monitor.activeTimers.has(timerId)).toBe(true);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = await monitor.stopTimer(timerId);
      
      expect(result.latency).toBeGreaterThanOrEqual(100);
      expect(result.module).toBe('field_extraction');
      expect(monitor.activeTimers.has(timerId)).toBe(false);
    });
    
    it('should throw error for invalid timer ID', async () => {
      await expect(
        monitor.stopTimer('invalid_timer_id')
      ).rejects.toThrow('Timer not found');
    });
  });
  
  describe('recordLatency', () => {
    it('should record baseline latency', async () => {
      const result = await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_001',
        latency: 1500,
        optimized: false
      });
      
      expect(result).toMatchObject({
        module: 'field_extraction',
        operationId: 'extract_001',
        latency: 1500,
        optimized: false
      });
      expect(result.timestamp).toBeDefined();
    });
    
    it('should record optimized latency', async () => {
      const result = await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_002',
        latency: 500,
        optimized: true
      });
      
      expect(result.optimized).toBe(true);
      expect(result.latency).toBe(500);
    });
    
    it('should throw error if module or latency missing', async () => {
      await expect(
        monitor.recordLatency({
          operationId: 'test'
        })
      ).rejects.toThrow('Module and latency are required');
    });
    
    it('should store latency in session cache', async () => {
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_003',
        latency: 1500,
        optimized: false
      });
      
      const status = monitor.getLatencyStatus();
      expect(status.fieldExtraction.baseline.count).toBe(1);
      expect(status.fieldExtraction.baseline.avgLatency).toBe(1500);
    });
  });
  
  describe('getLatencyStatus', () => {
    it('should return status for all modules', async () => {
      // Record baseline
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_004',
        latency: 2000,
        optimized: false
      });
      
      // Record optimized
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_005',
        latency: 800,
        optimized: true
      });
      
      const status = monitor.getLatencyStatus();
      
      expect(status.fieldExtraction).toBeDefined();
      expect(status.fieldExtraction.baseline.avgLatency).toBe(2000);
      expect(status.fieldExtraction.optimized.avgLatency).toBe(800);
      expect(status.fieldExtraction.improvement).toBe(0.6);
      expect(status.fieldExtraction.improvementPercent).toBe(60);
    });
    
    it('should calculate percentiles correctly', async () => {
      // Record multiple latencies
      const latencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      
      for (const latency of latencies) {
        await monitor.recordLatency({
          module: 'field_extraction',
          operationId: 'extract',
          latency,
          optimized: true
        });
      }
      
      const status = monitor.getLatencyStatus();
      
      expect(status.fieldExtraction.optimized.p50).toBeGreaterThanOrEqual(500);
      expect(status.fieldExtraction.optimized.p95).toBeGreaterThanOrEqual(900);
      expect(status.fieldExtraction.optimized.p99).toBeGreaterThanOrEqual(900);
    });
    
    it('should indicate if target is met', async () => {
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_006',
        latency: 1500,
        optimized: true
      });
      
      const status = monitor.getLatencyStatus();
      expect(status.fieldExtraction.meetsTarget).toBe(true); // 1500 < 2000
      expect(status.fieldExtraction.targetLatency).toBe(2000);
    });
    
    it('should indicate if target is not met', async () => {
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_007',
        latency: 3000,
        optimized: true
      });
      
      const status = monitor.getLatencyStatus();
      expect(status.fieldExtraction.meetsTarget).toBe(false); // 3000 > 2000
    });
  });
  
  describe('Performance alerts', () => {
    it('should create warning alert for high latency', async () => {
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_008',
        latency: 6000, // Above warning threshold (5000)
        optimized: true
      });
      
      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('high_latency');
      expect(alerts[0].severity).toBe('warning');
    });
    
    it('should create critical alert for very high latency', async () => {
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_009',
        latency: 12000, // Above critical threshold (10000)
        optimized: true
      });
      
      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('critical_latency');
      expect(alerts[0].severity).toBe('critical');
    });
    
    it('should not create duplicate alerts within 1 minute', async () => {
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_010',
        latency: 6000,
        optimized: true
      });
      
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_011',
        latency: 6000,
        optimized: true
      });
      
      const alerts = monitor.getAlerts();
      expect(alerts.length).toBe(1); // Only one alert
    });
  });
  
  describe('identifyBottlenecks', () => {
    it('should identify target exceeded bottleneck', async () => {
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_012',
        latency: 3000, // Exceeds target of 2000
        optimized: true
      });
      
      const bottlenecks = monitor.identifyBottlenecks();
      
      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks[0].type).toBe('target_exceeded');
      expect(bottlenecks[0].module).toBe('field_extraction');
    });
    
    it('should identify high p95 bottleneck', async () => {
      // Record latencies with high p95
      for (let i = 0; i < 10; i++) {
        await monitor.recordLatency({
          module: 'field_extraction',
          operationId: 'extract',
          latency: i < 9 ? 1000 : 5000, // Last one is very high
          optimized: true
        });
      }
      
      const bottlenecks = monitor.identifyBottlenecks();
      
      const highP95 = bottlenecks.find(b => b.type === 'high_p95');
      expect(highP95).toBeDefined();
    });
    
    it('should sort bottlenecks by severity', async () => {
      // Create critical bottleneck
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract',
        latency: 15000,
        optimized: true
      });
      
      // Create warning bottleneck
      await monitor.recordLatency({
        module: 'entity_building',
        operationId: 'build',
        latency: 2000,
        optimized: true
      });
      
      const bottlenecks = monitor.identifyBottlenecks();
      
      if (bottlenecks.length > 1) {
        expect(bottlenecks[0].severity).toBe('critical');
      }
    });
  });
  
  describe('getLatencyBreakdown', () => {
    it('should return breakdown by operation', async () => {
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_op1',
        latency: 1000,
        optimized: true
      });
      
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_op2',
        latency: 2000,
        optimized: true
      });
      
      const breakdown = monitor.getLatencyBreakdown({ module: 'field_extraction' });
      
      expect(breakdown.optimized.extract_op1).toBeDefined();
      expect(breakdown.optimized.extract_op2).toBeDefined();
      expect(breakdown.optimized.extract_op1.avgLatency).toBe(1000);
      expect(breakdown.optimized.extract_op2.avgLatency).toBe(2000);
    });
  });
  
  describe('resetSession', () => {
    it('should reset all session metrics', async () => {
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_013',
        latency: 1500,
        optimized: false
      });
      
      monitor.resetSession();
      
      const status = monitor.getLatencyStatus();
      expect(status.fieldExtraction.baseline.count).toBe(0);
    });
    
    it('should reset specific module metrics', async () => {
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_014',
        latency: 1500,
        optimized: false
      });
      
      await monitor.recordLatency({
        module: 'entity_building',
        operationId: 'build_001',
        latency: 800,
        optimized: false
      });
      
      monitor.resetSession('field_extraction');
      
      const status = monitor.getLatencyStatus();
      expect(status.fieldExtraction.baseline.count).toBe(0);
      expect(status.entityBuilding.baseline.count).toBe(1);
    });
  });
  
  describe('clearAlerts', () => {
    it('should clear all alerts', async () => {
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract_015',
        latency: 6000,
        optimized: true
      });
      
      expect(monitor.getAlerts().length).toBeGreaterThan(0);
      
      monitor.clearAlerts();
      
      expect(monitor.getAlerts()).toEqual([]);
    });
  });
  
  describe('getLatencyMonitor singleton', () => {
    it('should return same instance', () => {
      const monitor1 = getLatencyMonitor();
      const monitor2 = getLatencyMonitor();
      
      expect(monitor1).toBe(monitor2);
    });
  });
  
  describe('Multiple modules', () => {
    it('should track latency for multiple modules independently', async () => {
      await monitor.recordLatency({
        module: 'field_extraction',
        operationId: 'extract',
        latency: 1500,
        optimized: true
      });
      
      await monitor.recordLatency({
        module: 'entity_building',
        operationId: 'build',
        latency: 800,
        optimized: true
      });
      
      await monitor.recordLatency({
        module: 'relation_extraction',
        operationId: 'relate',
        latency: 1200,
        optimized: true
      });
      
      const status = monitor.getLatencyStatus();
      expect(status.fieldExtraction.optimized.avgLatency).toBe(1500);
      expect(status.entityBuilding.optimized.avgLatency).toBe(800);
      expect(status.relationExtraction.optimized.avgLatency).toBe(1200);
    });
  });
});
