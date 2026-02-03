/**
 * Unit Tests for Performance Monitor
 */

const performanceMonitor = require('./performance_monitor');

describe('Performance Monitor', () => {
  beforeEach(() => {
    performanceMonitor.reset();
  });

  describe('recordLocalProcessing', () => {
    it('should record local processing metrics', () => {
      const data = {
        ckb_id: 'ckb_001',
        doc_id: 'doc_001',
        extract_time: 250,
        match_time: 150,
        normalize_time: 400,
        total_time: 800
      };

      const metric = performanceMonitor.recordLocalProcessing(data);

      expect(metric.ckb_id).toBe('ckb_001');
      expect(metric.total_time).toBe(800);
      expect(metric.is_within_budget).toBe(true); // < 1000ms
      expect(metric.timestamp).toBeDefined();
    });

    it('should mark as exceeding budget when over threshold', () => {
      const data = {
        ckb_id: 'ckb_002',
        total_time: 1500
      };

      const metric = performanceMonitor.recordLocalProcessing(data);

      expect(metric.is_within_budget).toBe(false);
      expect(metric.total_time).toBe(1500);
    });

    it('should calculate total time from components', () => {
      const data = {
        ckb_id: 'ckb_003',
        extract_time: 300,
        match_time: 200,
        normalize_time: 400
      };

      const metric = performanceMonitor.recordLocalProcessing(data);

      expect(metric.total_time).toBe(900);
    });
  });

  describe('recordLLMCall', () => {
    it('should record LLM call metrics', () => {
      const data = {
        module: 'field_extraction',
        operation: 'extract',
        ckb_id: 'ckb_001',
        duration: 3000,
        success: true,
        model: 'qwen',
        tokens: 500
      };

      const metric = performanceMonitor.recordLLMCall(data);

      expect(metric.module).toBe('field_extraction');
      expect(metric.duration).toBe(3000);
      expect(metric.success).toBe(true);
      expect(metric.timeout).toBe(false);
    });

    it('should record timeout', () => {
      const data = {
        module: 'entity_building',
        operation: 'build',
        duration: 12000,
        timeout: true,
        success: false
      };

      const metric = performanceMonitor.recordLLMCall(data);

      expect(metric.timeout).toBe(true);
      expect(metric.success).toBe(false);
    });
  });

  describe('recordDocumentProcessing', () => {
    it('should record document processing metrics', () => {
      const data = {
        doc_id: 'doc_001',
        total_time: 25000,
        ckb_count: 10,
        entity_count: 5,
        relation_count: 8,
        success: true
      };

      const metric = performanceMonitor.recordDocumentProcessing(data);

      expect(metric.doc_id).toBe('doc_001');
      expect(metric.total_time).toBe(25000);
      expect(metric.is_within_budget).toBe(true); // < 30000ms
      expect(metric.ckb_count).toBe(10);
    });

    it('should mark as exceeding budget when over threshold', () => {
      const data = {
        doc_id: 'doc_002',
        total_time: 35000,
        success: true
      };

      const metric = performanceMonitor.recordDocumentProcessing(data);

      expect(metric.is_within_budget).toBe(false);
    });
  });

  describe('recordError', () => {
    it('should record error', () => {
      const data = {
        type: 'timeout',
        module: 'field_extraction',
        operation: 'extract',
        message: 'Operation timeout',
        ckb_id: 'ckb_001'
      };

      const error = performanceMonitor.recordError(data);

      expect(error.type).toBe('timeout');
      expect(error.module).toBe('field_extraction');
      expect(error.message).toBe('Operation timeout');
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      // Record some test metrics
      performanceMonitor.recordLocalProcessing({
        ckb_id: 'ckb_001',
        total_time: 800
      });
      performanceMonitor.recordLocalProcessing({
        ckb_id: 'ckb_002',
        total_time: 1200
      });
      performanceMonitor.recordLLMCall({
        module: 'test',
        operation: 'test',
        duration: 3000,
        success: true
      });
      performanceMonitor.recordDocumentProcessing({
        doc_id: 'doc_001',
        total_time: 25000,
        success: true
      });
    });

    it('should return performance statistics', () => {
      const stats = performanceMonitor.getStats();

      expect(stats.local_processing.count).toBe(2);
      expect(stats.llm_calls.count).toBe(1);
      expect(stats.document_processing.count).toBe(1);
      expect(stats.health).toBeDefined();
      expect(stats.health.score).toBeGreaterThanOrEqual(0);
      expect(stats.health.score).toBeLessThanOrEqual(100);
    });

    it('should calculate averages correctly', () => {
      const stats = performanceMonitor.getStats();

      expect(stats.local_processing.avg_total_time).toBe(1000); // (800 + 1200) / 2
      expect(stats.llm_calls.avg_duration).toBe(3000);
    });

    it('should calculate within budget rates', () => {
      const stats = performanceMonitor.getStats();

      expect(stats.local_processing.within_budget_rate).toBe(0.5); // 1 out of 2
      expect(stats.document_processing.within_budget_rate).toBe(1); // 1 out of 1
    });
  });

  describe('calculateHealthScore', () => {
    it('should return excellent health for good metrics', () => {
      const metrics = {
        localProcessing: {
          within_budget_rate: 0.95
        },
        llmCalls: {
          success_rate: 0.98
        },
        documentProcessing: {
          within_budget_rate: 0.92
        },
        errors: {
          error_rate: 0.01
        }
      };

      const health = performanceMonitor.calculateHealthScore(metrics);

      expect(health.score).toBeGreaterThanOrEqual(90);
      expect(health.status).toBe('excellent');
      expect(health.issues).toHaveLength(0);
    });

    it('should return poor health for bad metrics', () => {
      const metrics = {
        localProcessing: {
          within_budget_rate: 0.5
        },
        llmCalls: {
          success_rate: 0.7
        },
        documentProcessing: {
          within_budget_rate: 0.6
        },
        errors: {
          error_rate: 0.15
        }
      };

      const health = performanceMonitor.calculateHealthScore(metrics);

      expect(health.score).toBeLessThan(60);
      expect(health.status).toMatch(/poor|critical/);
      expect(health.issues.length).toBeGreaterThan(0);
    });

    it('should identify specific issues', () => {
      const metrics = {
        localProcessing: {
          within_budget_rate: 0.7
        },
        llmCalls: {
          success_rate: 0.95
        },
        documentProcessing: {
          within_budget_rate: 0.95
        },
        errors: {
          error_rate: 0.02
        }
      };

      const health = performanceMonitor.calculateHealthScore(metrics);

      expect(health.issues.length).toBeGreaterThan(0);
      expect(health.issues[0].category).toBe('local_processing');
    });
  });

  describe('getDashboardMetrics', () => {
    beforeEach(() => {
      // Record some test metrics
      performanceMonitor.recordLocalProcessing({
        ckb_id: 'ckb_001',
        total_time: 800
      });
      performanceMonitor.recordLLMCall({
        module: 'test',
        operation: 'test',
        duration: 3000,
        success: true
      });
      performanceMonitor.recordDocumentProcessing({
        doc_id: 'doc_001',
        total_time: 25000,
        success: true
      });
    });

    it('should return dashboard metrics', () => {
      const dashboard = performanceMonitor.getDashboardMetrics();

      expect(dashboard.health).toBeDefined();
      expect(dashboard.performance).toBeDefined();
      expect(dashboard.throughput).toBeDefined();
      expect(dashboard.errors).toBeDefined();
    });

    it('should include performance thresholds', () => {
      const dashboard = performanceMonitor.getDashboardMetrics();

      expect(dashboard.performance.local_processing.threshold).toBe(1000);
      expect(dashboard.performance.document_processing.threshold).toBe(30000);
    });
  });

  describe('onAlert', () => {
    it('should register alert callback', () => {
      const callback = jest.fn();
      performanceMonitor.onAlert(callback);

      // Trigger an alert by recording slow processing
      performanceMonitor.recordLocalProcessing({
        ckb_id: 'ckb_001',
        total_time: 1500
      });

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].type).toBe('local_processing_slow');
    });
  });

  describe('clearOldMetrics', () => {
    it('should clear old metrics', async () => {
      // Record some metrics
      performanceMonitor.recordLocalProcessing({
        ckb_id: 'ckb_001',
        total_time: 800
      });

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Clear metrics older than 5ms (should clear the metric we just recorded)
      const cleared = performanceMonitor.clearOldMetrics(5);

      expect(cleared.localProcessing).toBe(1);

      // Verify metrics are cleared
      const stats = performanceMonitor.getStats();
      expect(stats.local_processing.count).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      // Record some metrics
      performanceMonitor.recordLocalProcessing({
        ckb_id: 'ckb_001',
        total_time: 800
      });
      performanceMonitor.recordLLMCall({
        module: 'test',
        operation: 'test',
        duration: 3000,
        success: true
      });

      // Reset
      performanceMonitor.reset();

      // Verify all metrics are cleared
      const stats = performanceMonitor.getStats();
      expect(stats.local_processing.count).toBe(0);
      expect(stats.llm_calls.count).toBe(0);
    });
  });
});
