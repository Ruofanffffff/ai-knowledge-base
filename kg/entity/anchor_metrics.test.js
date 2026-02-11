/**
 * Tests for Anchor Metrics Collector
 */

const anchorMetrics = require('./anchor_metrics');

describe('AnchorMetrics', () => {
  beforeEach(() => {
    // Reset metrics before each test
    anchorMetrics.reset();
  });

  describe('recordAnchorGeneration', () => {
    it('should record successful anchor generation', () => {
      anchorMetrics.recordAnchorGeneration(5, true);
      anchorMetrics.recordAnchorGeneration(10, true);
      anchorMetrics.recordAnchorGeneration(8, true);

      const metrics = anchorMetrics.getMetrics();

      expect(metrics.anchorGeneration.total).toBe(3);
      expect(metrics.anchorGeneration.successful).toBe(3);
      expect(metrics.anchorGeneration.failed).toBe(0);
      expect(metrics.anchorGeneration.avgDuration).toBeCloseTo(7.67, 1);
      expect(metrics.anchorGeneration.minDuration).toBe(5);
      expect(metrics.anchorGeneration.maxDuration).toBe(10);
    });

    it('should record failed anchor generation', () => {
      anchorMetrics.recordAnchorGeneration(5, true);
      anchorMetrics.recordAnchorGeneration(10, false);
      anchorMetrics.recordAnchorGeneration(8, false);

      const metrics = anchorMetrics.getMetrics();

      expect(metrics.anchorGeneration.total).toBe(3);
      expect(metrics.anchorGeneration.successful).toBe(1);
      expect(metrics.anchorGeneration.failed).toBe(2);
      expect(metrics.anchorGeneration.avgDuration).toBe(5); // Only successful counted
    });

    it('should track min and max duration correctly', () => {
      anchorMetrics.recordAnchorGeneration(15, true);
      anchorMetrics.recordAnchorGeneration(3, true);
      anchorMetrics.recordAnchorGeneration(20, true);
      anchorMetrics.recordAnchorGeneration(7, true);

      const metrics = anchorMetrics.getMetrics();

      expect(metrics.anchorGeneration.minDuration).toBe(3);
      expect(metrics.anchorGeneration.maxDuration).toBe(20);
    });
  });

  describe('recordMerging', () => {
    it('should record successful merging', () => {
      // 10 instances merged into 3 entities
      anchorMetrics.recordMerging(50, 3, 10, true);
      // 5 instances merged into 2 entities
      anchorMetrics.recordMerging(30, 2, 5, true);

      const metrics = anchorMetrics.getMetrics();

      expect(metrics.merging.total).toBe(2);
      expect(metrics.merging.successful).toBe(2);
      expect(metrics.merging.entitiesCreated).toBe(5);
      expect(metrics.merging.entitiesMerged).toBe(10); // (10-3) + (5-2)
      expect(metrics.merging.avgDuration).toBe(40);
    });

    it('should calculate merge ratio correctly', () => {
      // 10 instances → 2 entities (ratio = 10/2 = 5.0)
      anchorMetrics.recordMerging(50, 2, 10, true);

      const metrics = anchorMetrics.getMetrics();

      expect(metrics.merging.mergeRatio).toBe(5.0);
    });

    it('should record failed merging', () => {
      anchorMetrics.recordMerging(50, 3, 10, true);
      anchorMetrics.recordMerging(30, 0, 0, false);

      const metrics = anchorMetrics.getMetrics();

      expect(metrics.merging.total).toBe(2);
      expect(metrics.merging.successful).toBe(1);
      expect(metrics.merging.failed).toBe(1);
    });
  });

  describe('recordConflict', () => {
    it('should record conflicts by type', () => {
      anchorMetrics.recordConflict('time_inconsistency', 'high');
      anchorMetrics.recordConflict('value_conflict', 'medium');
      anchorMetrics.recordConflict('time_inconsistency', 'high');

      const metrics = anchorMetrics.getMetrics();

      expect(metrics.conflicts.total).toBe(3);
      expect(metrics.conflicts.byType.time_inconsistency).toBe(2);
      expect(metrics.conflicts.byType.value_conflict).toBe(1);
    });

    it('should record conflicts by severity', () => {
      anchorMetrics.recordConflict('time_inconsistency', 'high');
      anchorMetrics.recordConflict('value_conflict', 'medium');
      anchorMetrics.recordConflict('state_contradiction', 'low');
      anchorMetrics.recordConflict('value_conflict', 'high');

      const metrics = anchorMetrics.getMetrics();

      expect(metrics.conflicts.bySeverity.high).toBe(2);
      expect(metrics.conflicts.bySeverity.medium).toBe(1);
      expect(metrics.conflicts.bySeverity.low).toBe(1);
    });
  });

  describe('recordLLMCall', () => {
    it('should record successful LLM calls', () => {
      anchorMetrics.recordLLMCall(200, true);
      anchorMetrics.recordLLMCall(300, true);
      anchorMetrics.recordLLMCall(250, true);

      const metrics = anchorMetrics.getMetrics();

      expect(metrics.llm.total).toBe(3);
      expect(metrics.llm.successful).toBe(3);
      expect(metrics.llm.failed).toBe(0);
      expect(metrics.llm.avgDuration).toBeCloseTo(250, 0);
    });

    it('should record failed LLM calls', () => {
      anchorMetrics.recordLLMCall(200, true);
      anchorMetrics.recordLLMCall(300, false);

      const metrics = anchorMetrics.getMetrics();

      expect(metrics.llm.total).toBe(2);
      expect(metrics.llm.successful).toBe(1);
      expect(metrics.llm.failed).toBe(1);
    });
  });

  describe('updateCoverage', () => {
    it('should calculate coverage percentage', () => {
      anchorMetrics.updateCoverage(100, 95);

      const metrics = anchorMetrics.getMetrics();

      expect(metrics.coverage.totalEntities).toBe(100);
      expect(metrics.coverage.entitiesWithAnchors).toBe(95);
      expect(metrics.coverage.coveragePercent).toBe(95);
    });

    it('should handle zero entities', () => {
      anchorMetrics.updateCoverage(0, 0);

      const metrics = anchorMetrics.getMetrics();

      expect(metrics.coverage.coveragePercent).toBe(0);
    });
  });

  describe('getSummary', () => {
    it('should return formatted summary', () => {
      anchorMetrics.recordAnchorGeneration(5, true);
      anchorMetrics.recordAnchorGeneration(8, true);
      anchorMetrics.recordMerging(50, 2, 10, true);
      anchorMetrics.recordConflict('time_inconsistency', 'high');
      anchorMetrics.recordLLMCall(200, true);
      anchorMetrics.updateCoverage(100, 95);

      const summary = anchorMetrics.getSummary();

      expect(summary.anchorGeneration.total).toBe(2);
      expect(summary.anchorGeneration.successRate).toBe(100);
      expect(summary.anchorGeneration.performance).toBe('GOOD');
      
      expect(summary.merging.total).toBe(1);
      expect(summary.merging.successRate).toBe(100);
      
      expect(summary.conflicts.total).toBe(1);
      expect(summary.conflicts.mostCommon).toBe('time_inconsistency');
      
      expect(summary.llm.total).toBe(1);
      expect(summary.llm.successRate).toBe(100);
      
      expect(summary.coverage.status).toBe('GOOD');
    });

    it('should identify performance issues', () => {
      // Slow anchor generation (>10ms)
      anchorMetrics.recordAnchorGeneration(15, true);
      anchorMetrics.recordAnchorGeneration(20, true);

      const summary = anchorMetrics.getSummary();

      expect(summary.anchorGeneration.performance).toBe('NEEDS_IMPROVEMENT');
    });

    it('should identify coverage issues', () => {
      // Low coverage (<90%)
      anchorMetrics.updateCoverage(100, 85);

      const summary = anchorMetrics.getSummary();

      expect(summary.coverage.status).toBe('NEEDS_IMPROVEMENT');
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      anchorMetrics.recordAnchorGeneration(5, true);
      anchorMetrics.recordMerging(50, 2, 10, true);
      anchorMetrics.recordConflict('time_inconsistency', 'high');

      anchorMetrics.reset();

      const metrics = anchorMetrics.getMetrics();

      expect(metrics.anchorGeneration.total).toBe(0);
      expect(metrics.merging.total).toBe(0);
      expect(metrics.conflicts.total).toBe(0);
      expect(metrics.llm.total).toBe(0);
    });
  });

  describe('toJSON', () => {
    it('should export metrics as JSON', () => {
      anchorMetrics.recordAnchorGeneration(5, true);

      const json = anchorMetrics.toJSON();

      expect(json).toHaveProperty('anchorGeneration');
      expect(json).toHaveProperty('merging');
      expect(json).toHaveProperty('conflicts');
      expect(json).toHaveProperty('llm');
      expect(json).toHaveProperty('coverage');
      expect(json).toHaveProperty('uptime');
      expect(json).toHaveProperty('timestamp');
    });
  });

  describe('integration test', () => {
    it('should track complete workflow metrics', () => {
      // Simulate a complete anchor workflow
      
      // Generate 100 anchors (95 successful, 5 failed)
      for (let i = 0; i < 95; i++) {
        anchorMetrics.recordAnchorGeneration(Math.random() * 10, true);
      }
      for (let i = 0; i < 5; i++) {
        anchorMetrics.recordAnchorGeneration(0, false);
      }

      // Merge instances (100 instances → 30 entities)
      anchorMetrics.recordMerging(80, 30, 100, true);

      // Record some conflicts
      anchorMetrics.recordConflict('time_inconsistency', 'high');
      anchorMetrics.recordConflict('value_conflict', 'medium');
      anchorMetrics.recordConflict('time_inconsistency', 'high');

      // LLM advisory calls
      anchorMetrics.recordLLMCall(250, true);
      anchorMetrics.recordLLMCall(300, true);

      // Update coverage
      anchorMetrics.updateCoverage(30, 30);

      const summary = anchorMetrics.getSummary();

      expect(summary.anchorGeneration.total).toBe(100);
      expect(summary.anchorGeneration.successRate).toBe(95);
      expect(parseFloat(summary.merging.mergeRatio)).toBeCloseTo(3.33, 1);
      expect(summary.conflicts.total).toBe(3);
      expect(summary.conflicts.mostCommon).toBe('time_inconsistency');
      expect(summary.llm.total).toBe(2);
      expect(summary.coverage.percent).toBe('100.00%');
    });
  });
});
