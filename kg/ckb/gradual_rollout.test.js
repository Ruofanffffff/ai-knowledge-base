/**
 * Tests for Gradual Rollout Manager
 */

const { GradualRolloutManager, resetGradualRolloutManager } = require('./gradual_rollout');
const { getTokenMonitor } = require('./token_monitor');
const { getAccuracyMonitor } = require('./accuracy_monitor');
const { getLatencyMonitor } = require('./latency_monitor');

describe('GradualRolloutManager', () => {
  let rolloutManager;
  let tokenMonitor;
  let accuracyMonitor;
  let latencyMonitor;
  
  beforeEach(() => {
    resetGradualRolloutManager();
    rolloutManager = new GradualRolloutManager({
      enabled: true,
      phaseDurationDays: 0.001, // Very short for testing (86 seconds)
    });
    
    tokenMonitor = getTokenMonitor();
    accuracyMonitor = getAccuracyMonitor();
    latencyMonitor = getLatencyMonitor();
  });
  
  describe('Traffic Splitting', () => {
    test('should not use optimization when rollout is disabled', () => {
      rolloutManager.rolloutEnabled = false;
      
      const result = rolloutManager.shouldUseOptimization('doc_123');
      
      expect(result).toBe(false);
    });
    
    test('should not use optimization in phase 0', () => {
      rolloutManager.currentPhase = 0;
      
      const result = rolloutManager.shouldUseOptimization('doc_123');
      
      expect(result).toBe(false);
    });
    
    test('should use optimization for all requests in phase 3', () => {
      rolloutManager.currentPhase = 3;
      
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(rolloutManager.shouldUseOptimization(`doc_${i}`));
      }
      
      expect(results.every(r => r === true)).toBe(true);
    });
    
    test('should split traffic approximately 10% in phase 1', () => {
      rolloutManager.currentPhase = 1;
      
      let optimizedCount = 0;
      const totalRequests = 1000;
      
      for (let i = 0; i < totalRequests; i++) {
        if (rolloutManager.shouldUseOptimization(`doc_${i}`)) {
          optimizedCount++;
        }
      }
      
      const percentage = (optimizedCount / totalRequests) * 100;
      
      // Should be approximately 10% (allow 5% variance)
      expect(percentage).toBeGreaterThan(5);
      expect(percentage).toBeLessThan(15);
    });
    
    test('should split traffic approximately 50% in phase 2', () => {
      rolloutManager.currentPhase = 2;
      
      let optimizedCount = 0;
      const totalRequests = 1000;
      
      for (let i = 0; i < totalRequests; i++) {
        if (rolloutManager.shouldUseOptimization(`doc_${i}`)) {
          optimizedCount++;
        }
      }
      
      const percentage = (optimizedCount / totalRequests) * 100;
      
      // Should be approximately 50% (allow 10% variance)
      expect(percentage).toBeGreaterThan(40);
      expect(percentage).toBeLessThan(60);
    });
    
    test('should use consistent hashing for same document ID', () => {
      rolloutManager.currentPhase = 1;
      
      const docId = 'doc_consistent_test';
      const result1 = rolloutManager.shouldUseOptimization(docId);
      const result2 = rolloutManager.shouldUseOptimization(docId);
      const result3 = rolloutManager.shouldUseOptimization(docId);
      
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
    
    test('should track metrics correctly', () => {
      rolloutManager.currentPhase = 1;
      
      for (let i = 0; i < 100; i++) {
        rolloutManager.shouldUseOptimization(`doc_${i}`);
      }
      
      expect(rolloutManager.metrics.totalRequests).toBe(100);
      expect(rolloutManager.metrics.optimizedRequests + rolloutManager.metrics.baselineRequests).toBe(100);
    });
  });
  
  describe('Phase Management', () => {
    test('should start phase 1 successfully', () => {
      const result = rolloutManager.startPhase(1);
      
      expect(result.phase).toBe(1);
      expect(result.percentage).toBe(10);
      expect(result.previousPhase).toBe(0);
      expect(rolloutManager.currentPhase).toBe(1);
      expect(rolloutManager.phaseStartTime).toBeTruthy();
    });
    
    test('should not allow starting invalid phase', () => {
      expect(() => rolloutManager.startPhase(0)).toThrow();
      expect(() => rolloutManager.startPhase(4)).toThrow();
      expect(() => rolloutManager.startPhase(-1)).toThrow();
    });
    
    test('should not allow starting lower phase', () => {
      rolloutManager.startPhase(2);
      
      expect(() => rolloutManager.startPhase(1)).toThrow();
    });
    
    test('should record phase history', () => {
      rolloutManager.startPhase(1);
      rolloutManager.startPhase(2);
      
      expect(rolloutManager.phaseHistory).toHaveLength(2);
      expect(rolloutManager.phaseHistory[0].phase).toBe(1);
      expect(rolloutManager.phaseHistory[1].phase).toBe(2);
    });
  });
  
  describe('Phase Progress', () => {
    test('should not progress if phase duration not met', () => {
      rolloutManager.startPhase(1);
      
      const result = rolloutManager.checkPhaseProgress();
      
      expect(result.canProgress).toBe(false);
      expect(result.reason).toContain('Phase duration not met');
    });
    
    test('should progress if phase duration met and quality good', async () => {
      rolloutManager.config.phaseDurationDays = 0; // Instant for testing
      rolloutManager.startPhase(1);
      
      // Simulate good metrics
      tokenMonitor.recordUsage('baseline', 1000, 0);
      tokenMonitor.recordUsage('optimized', 200, 0);
      
      accuracyMonitor.recordAccuracy('baseline', 0.85);
      accuracyMonitor.recordAccuracy('optimized', 0.84);
      
      latencyMonitor.recordLatency('baseline', 1000);
      latencyMonitor.recordLatency('optimized', 400);
      
      const result = rolloutManager.checkPhaseProgress();
      
      expect(result.canProgress).toBe(true);
      expect(result.nextPhase).toBe(2);
    });
    
    test('should not progress if quality metrics fail', async () => {
      rolloutManager.config.phaseDurationDays = 0;
      rolloutManager.startPhase(1);
      
      // Simulate bad accuracy
      accuracyMonitor.recordAccuracy('baseline', 0.85);
      accuracyMonitor.recordAccuracy('optimized', 0.70); // 15% drop
      
      const result = rolloutManager.checkPhaseProgress();
      
      expect(result.canProgress).toBe(false);
      expect(result.reason).toContain('Quality metrics not met');
    });
    
    test('should not progress from phase 0', () => {
      const result = rolloutManager.checkPhaseProgress();
      
      expect(result.canProgress).toBe(false);
      expect(result.reason).toContain('Rollout not started');
    });
    
    test('should not progress from phase 3', () => {
      rolloutManager.currentPhase = 3;
      
      const result = rolloutManager.checkPhaseProgress();
      
      expect(result.canProgress).toBe(false);
      expect(result.reason).toContain('Already at 100%');
    });
  });
  
  describe('Quality Metrics', () => {
    test('should pass quality check with good metrics', () => {
      // Simulate good metrics
      tokenMonitor.recordUsage('baseline', 1000, 0);
      tokenMonitor.recordUsage('optimized', 200, 0);
      
      accuracyMonitor.recordAccuracy('baseline', 0.85);
      accuracyMonitor.recordAccuracy('optimized', 0.84);
      
      latencyMonitor.recordLatency('baseline', 1000);
      latencyMonitor.recordLatency('optimized', 400);
      
      const result = rolloutManager.checkQualityMetrics();
      
      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });
    
    test('should fail quality check with high accuracy drop', () => {
      accuracyMonitor.recordAccuracy('baseline', 0.85);
      accuracyMonitor.recordAccuracy('optimized', 0.70); // 15% drop
      
      const result = rolloutManager.checkQualityMetrics();
      
      expect(result.passed).toBe(false);
      expect(result.failures.some(f => f.metric === 'accuracy')).toBe(true);
    });
    
    test('should fail quality check with high error rate', () => {
      rolloutManager.metrics.totalRequests = 100;
      rolloutManager.metrics.errors = 10; // 10% error rate
      
      const result = rolloutManager.checkQualityMetrics();
      
      expect(result.passed).toBe(false);
      expect(result.failures.some(f => f.metric === 'errorRate')).toBe(true);
    });
    
    test('should fail quality check with high latency increase', () => {
      latencyMonitor.recordLatency('baseline', 1000);
      latencyMonitor.recordLatency('optimized', 3000); // 3x increase
      
      const result = rolloutManager.checkQualityMetrics();
      
      expect(result.passed).toBe(false);
      expect(result.failures.some(f => f.metric === 'latency')).toBe(true);
    });
    
    test('should fail quality check with low token savings', () => {
      tokenMonitor.recordUsage('baseline', 1000, 0);
      tokenMonitor.recordUsage('optimized', 900, 0); // Only 10% savings
      
      const result = rolloutManager.checkQualityMetrics();
      
      expect(result.passed).toBe(false);
      expect(result.failures.some(f => f.metric === 'tokenSavings')).toBe(true);
    });
  });
  
  describe('Emergency Rollback', () => {
    test('should trigger emergency rollback', () => {
      rolloutManager.startPhase(2);
      
      const result = rolloutManager.emergencyRollback('Test rollback');
      
      expect(result.previousPhase).toBe(2);
      expect(result.reason).toBe('Test rollback');
      expect(rolloutManager.currentPhase).toBe(0);
      expect(rolloutManager.rolloutEnabled).toBe(false);
      expect(rolloutManager.metrics.rollbacks).toBe(1);
    });
    
    test('should record rollback in phase history', () => {
      rolloutManager.startPhase(1);
      rolloutManager.emergencyRollback('Quality degradation');
      
      const lastEntry = rolloutManager.phaseHistory[rolloutManager.phaseHistory.length - 1];
      
      expect(lastEntry.rollback).toBe(true);
      expect(lastEntry.reason).toBe('Quality degradation');
    });
    
    test('should auto-trigger rollback on quality failure', () => {
      rolloutManager.startPhase(1);
      
      // Simulate bad accuracy
      accuracyMonitor.recordAccuracy('baseline', 0.85);
      accuracyMonitor.recordAccuracy('optimized', 0.70);
      
      const result = rolloutManager.checkEmergencyRollback();
      
      expect(result).toBeTruthy();
      expect(result.reason).toContain('Quality metrics failed');
      expect(rolloutManager.currentPhase).toBe(0);
    });
    
    test('should not trigger rollback when already rolled back', () => {
      rolloutManager.currentPhase = 0;
      
      const result = rolloutManager.checkEmergencyRollback();
      
      expect(result).toBeNull();
    });
  });
  
  describe('Status and Reporting', () => {
    test('should return current status', () => {
      rolloutManager.startPhase(1);
      
      const status = rolloutManager.getStatus();
      
      expect(status.enabled).toBe(true);
      expect(status.currentPhase).toBe(1);
      expect(status.percentage).toBe(10);
      expect(status.metrics).toBeDefined();
      expect(status.qualityCheck).toBeDefined();
      expect(status.progressCheck).toBeDefined();
    });
    
    test('should generate comprehensive report', () => {
      rolloutManager.startPhase(1);
      
      // Add some metrics
      for (let i = 0; i < 100; i++) {
        rolloutManager.shouldUseOptimization(`doc_${i}`);
      }
      
      const report = rolloutManager.generateReport();
      
      expect(report.summary).toBeDefined();
      expect(report.performance).toBeDefined();
      expect(report.quality).toBeDefined();
      expect(report.progress).toBeDefined();
      expect(report.history).toBeDefined();
      
      expect(report.summary.phase).toBe(1);
      expect(report.summary.totalRequests).toBe(100);
    });
    
    test('should calculate metrics correctly', () => {
      rolloutManager.currentPhase = 1;
      
      for (let i = 0; i < 100; i++) {
        rolloutManager.shouldUseOptimization(`doc_${i}`);
      }
      
      rolloutManager.recordError();
      rolloutManager.recordError();
      
      const status = rolloutManager.getStatus();
      
      expect(status.metrics.totalRequests).toBe(100);
      expect(status.metrics.errors).toBe(2);
      expect(status.metrics.errorRate).toBeCloseTo(0.02);
    });
  });
  
  describe('Metrics Management', () => {
    test('should record errors', () => {
      rolloutManager.recordError();
      rolloutManager.recordError();
      
      expect(rolloutManager.metrics.errors).toBe(2);
    });
    
    test('should reset metrics', () => {
      rolloutManager.metrics.totalRequests = 100;
      rolloutManager.metrics.errors = 5;
      rolloutManager.metrics.rollbacks = 2;
      
      rolloutManager.resetMetrics();
      
      expect(rolloutManager.metrics.totalRequests).toBe(0);
      expect(rolloutManager.metrics.errors).toBe(0);
      expect(rolloutManager.metrics.rollbacks).toBe(2); // Preserved
    });
  });
  
  describe('Configuration', () => {
    test('should use custom phase percentages', () => {
      const customManager = new GradualRolloutManager({
        phase1Percentage: 20,
        phase2Percentage: 60,
        phase3Percentage: 100,
      });
      
      customManager.currentPhase = 1;
      expect(customManager._getCurrentPercentage()).toBe(20);
      
      customManager.currentPhase = 2;
      expect(customManager._getCurrentPercentage()).toBe(60);
    });
    
    test('should use custom quality thresholds', () => {
      const customManager = new GradualRolloutManager({
        maxAccuracyDrop: 0.10,
        maxErrorRate: 0.10,
      });
      
      expect(customManager.config.maxAccuracyDrop).toBe(0.10);
      expect(customManager.config.maxErrorRate).toBe(0.10);
    });
  });
});
