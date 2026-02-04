/**
 * Tests for Resource Manager Module
 * 
 * Validates: Requirements 21.13, 21.14, 21.15, 21.18
 */

const resourceManager = require('./resource_manager');

describe('Resource Manager', () => {
  beforeEach(() => {
    resourceManager.reset();
  });

  describe('Memory Management', () => {
    it('should get current memory usage', () => {
      const usage = resourceManager.getMemoryUsage();

      expect(usage).toHaveProperty('heapUsed');
      expect(usage).toHaveProperty('heapTotal');
      expect(usage).toHaveProperty('rss');
      expect(usage).toHaveProperty('external');
      expect(usage).toHaveProperty('timestamp');
      expect(typeof usage.heapUsed).toBe('number');
    });

    it('should record memory usage', () => {
      const metric = resourceManager.recordMemoryUsage();

      expect(metric).toHaveProperty('id');
      expect(metric).toHaveProperty('timestamp');
      expect(metric).toHaveProperty('heap_used');
      expect(metric).toHaveProperty('is_warning');
      expect(metric).toHaveProperty('is_critical');
    });

    it('should detect memory warning threshold', () => {
      const alerts = [];
      resourceManager.onAlert(alert => alerts.push(alert));

      // Mock high memory usage
      const originalConfig = { ...resourceManager.CONFIG };
      resourceManager.CONFIG.MEMORY_WARNING_MB = 0;
      resourceManager.CONFIG.MEMORY_THRESHOLD_MB = 999999;

      resourceManager.recordMemoryUsage();

      resourceManager.CONFIG.MEMORY_WARNING_MB = originalConfig.MEMORY_WARNING_MB;
      resourceManager.CONFIG.MEMORY_THRESHOLD_MB = originalConfig.MEMORY_THRESHOLD_MB;

      const memoryWarning = alerts.find(a => a.type === 'memory_warning');
      expect(memoryWarning).toBeDefined();
    });

    it('should detect memory critical threshold', () => {
      const alerts = [];
      resourceManager.onAlert(alert => alerts.push(alert));

      // Mock critical memory usage
      const originalConfig = { ...resourceManager.CONFIG };
      resourceManager.CONFIG.MEMORY_THRESHOLD_MB = 0;

      resourceManager.recordMemoryUsage();

      resourceManager.CONFIG.MEMORY_THRESHOLD_MB = originalConfig.MEMORY_THRESHOLD_MB;

      const memoryCritical = alerts.find(a => a.type === 'memory_critical');
      expect(memoryCritical).toBeDefined();
    });
  });

  describe('Queue Management', () => {
    it('should record queue size', () => {
      const metric = resourceManager.recordQueueSize(50);

      expect(metric.size).toBe(50);
      expect(metric.is_warning).toBe(false);
      expect(metric.is_critical).toBe(false);
    });

    it('should detect queue warning threshold', () => {
      const alerts = [];
      resourceManager.onAlert(alert => alerts.push(alert));

      resourceManager.recordQueueSize(85);

      const queueWarning = alerts.find(a => a.type === 'queue_warning');
      expect(queueWarning).toBeDefined();
      expect(queueWarning.data.size).toBe(85);
    });

    it('should detect queue critical threshold', () => {
      const alerts = [];
      resourceManager.onAlert(alert => alerts.push(alert));

      resourceManager.recordQueueSize(105);

      const queueCritical = alerts.find(a => a.type === 'queue_critical');
      expect(queueCritical).toBeDefined();
      expect(queueCritical.data.size).toBe(105);
    });

    it('should enable degraded mode when queue is critical', () => {
      resourceManager.recordQueueSize(105);

      const status = resourceManager.getStatus();
      expect(status.degraded_mode).toBe(true);
    });

    it('should disable degraded mode when queue recovers', () => {
      // First trigger degraded mode
      resourceManager.recordQueueSize(105);
      expect(resourceManager.getStatus().degraded_mode).toBe(true);

      // Then recover
      resourceManager.recordQueueSize(30);
      expect(resourceManager.getStatus().degraded_mode).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests under rate limit', () => {
      for (let i = 0; i < 50; i++) {
        const allowed = resourceManager.recordRequest();
        expect(allowed).toBe(true);
      }
    });

    it('should throttle requests over rate limit', () => {
      // Fill up to limit
      for (let i = 0; i < 60; i++) {
        resourceManager.recordRequest();
      }

      // Next request should be throttled
      const allowed = resourceManager.recordRequest();
      expect(allowed).toBe(false);
    });

    it('should check if should throttle', () => {
      // Under limit
      expect(resourceManager.shouldThrottle()).toBe(false);

      // Fill up to limit
      for (let i = 0; i < 60; i++) {
        resourceManager.recordRequest();
      }

      // Should throttle
      expect(resourceManager.shouldThrottle()).toBe(true);
    });

    it('should trigger rate limit alert', () => {
      const alerts = [];
      resourceManager.onAlert(alert => alerts.push(alert));

      // Fill up to limit
      for (let i = 0; i < 61; i++) {
        resourceManager.recordRequest();
      }

      const rateLimitAlert = alerts.find(a => a.type === 'rate_limit_exceeded');
      expect(rateLimitAlert).toBeDefined();
    });

    it('should recover from throttling', (done) => {
      // Fill up to limit
      for (let i = 0; i < 60; i++) {
        resourceManager.recordRequest();
      }

      expect(resourceManager.shouldThrottle()).toBe(true);

      // Wait for window to pass (use shorter window for testing)
      const originalWindow = resourceManager.CONFIG.THROTTLE_WINDOW_MS;
      resourceManager.CONFIG.THROTTLE_WINDOW_MS = 100;

      setTimeout(() => {
        expect(resourceManager.shouldThrottle()).toBe(false);
        resourceManager.CONFIG.THROTTLE_WINDOW_MS = originalWindow;
        done();
      }, 150);
    });
  });

  describe('Statistics', () => {
    it('should get resource statistics', () => {
      resourceManager.recordMemoryUsage();
      resourceManager.recordQueueSize(50);
      resourceManager.recordRequest();

      const stats = resourceManager.getStats();

      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('queue');
      expect(stats).toHaveProperty('throttle');
      expect(stats).toHaveProperty('state');
      expect(stats.memory).toHaveProperty('current');
      expect(stats.queue).toHaveProperty('current_size');
      expect(stats.throttle).toHaveProperty('total_requests');
    });

    it('should calculate memory statistics', () => {
      for (let i = 0; i < 5; i++) {
        resourceManager.recordMemoryUsage();
      }

      const stats = resourceManager.getStats();

      expect(stats.memory.avg_heap_used).toBeGreaterThan(0);
      expect(stats.memory.max_heap_used).toBeGreaterThan(0);
      expect(stats.memory.threshold).toBe(resourceManager.CONFIG.MEMORY_THRESHOLD_MB);
    });

    it('should calculate queue statistics', () => {
      resourceManager.recordQueueSize(10);
      resourceManager.recordQueueSize(50);
      resourceManager.recordQueueSize(30);

      const stats = resourceManager.getStats();

      expect(stats.queue.current_size).toBe(30);
      expect(stats.queue.avg_size).toBeCloseTo(30, 0);
      expect(stats.queue.max_size).toBe(50);
    });

    it('should calculate throttle statistics', () => {
      for (let i = 0; i < 70; i++) {
        resourceManager.recordRequest();
      }

      const stats = resourceManager.getStats();

      expect(stats.throttle.total_requests).toBeGreaterThan(0);
      expect(stats.throttle.allowed_requests).toBeGreaterThan(0);
      expect(stats.throttle.throttled_requests).toBeGreaterThan(0);
      expect(stats.throttle.throttle_rate).toBeGreaterThan(0);
    });

    it('should filter statistics by time range', () => {
      resourceManager.recordMemoryUsage();
      resourceManager.recordQueueSize(50);

      const stats = resourceManager.getStats({ timeRange: 1000 }); // 1 second

      expect(stats.time_range).toBe(1000);
    });
  });

  describe('System Status', () => {
    it('should get current system status', () => {
      const status = resourceManager.getStatus();

      expect(status).toHaveProperty('timestamp');
      expect(status).toHaveProperty('memory');
      expect(status).toHaveProperty('queue');
      expect(status).toHaveProperty('throttle');
      expect(status).toHaveProperty('degraded_mode');
      expect(status).toHaveProperty('overall_health');
    });

    it('should report healthy status when all metrics are good', () => {
      resourceManager.recordQueueSize(10);

      const status = resourceManager.getStatus();

      expect(status.memory.is_healthy).toBe(true);
      expect(status.queue.is_healthy).toBe(true);
      expect(status.overall_health).toBe(true);
    });

    it('should report unhealthy status when queue is critical', () => {
      resourceManager.recordQueueSize(105);

      const status = resourceManager.getStatus();

      expect(status.queue.is_healthy).toBe(false);
      expect(status.degraded_mode).toBe(true);
      expect(status.overall_health).toBe(false);
    });

    it('should report unhealthy status when throttled', () => {
      for (let i = 0; i < 61; i++) {
        resourceManager.recordRequest();
      }

      const status = resourceManager.getStatus();

      expect(status.throttle.is_throttled).toBe(true);
      expect(status.overall_health).toBe(false);
    });
  });

  describe('Alert System', () => {
    it('should register alert callbacks', () => {
      const callback = jest.fn();
      resourceManager.onAlert(callback);

      resourceManager.recordQueueSize(105);

      expect(callback).toHaveBeenCalled();
    });

    it('should call multiple alert callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      resourceManager.onAlert(callback1);
      resourceManager.onAlert(callback2);

      resourceManager.recordQueueSize(105);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = () => {
        throw new Error('Test error');
      };
      const goodCallback = jest.fn();

      resourceManager.onAlert(errorCallback);
      resourceManager.onAlert(goodCallback);

      resourceManager.recordQueueSize(105);

      // Good callback should still be called
      expect(goodCallback).toHaveBeenCalled();
    });
  });

  describe('Degraded Mode', () => {
    it('should enable degraded mode manually', () => {
      resourceManager.enableDegradedMode();

      const status = resourceManager.getStatus();
      expect(status.degraded_mode).toBe(true);
    });

    it('should disable degraded mode manually', () => {
      resourceManager.enableDegradedMode();
      resourceManager.disableDegradedMode();

      const status = resourceManager.getStatus();
      expect(status.degraded_mode).toBe(false);
    });

    it('should trigger alerts when entering degraded mode', () => {
      const alerts = [];
      resourceManager.onAlert(alert => alerts.push(alert));

      resourceManager.enableDegradedMode();

      const degradedAlert = alerts.find(a => a.type === 'degraded_mode_enabled');
      expect(degradedAlert).toBeDefined();
    });

    it('should trigger alerts when exiting degraded mode', () => {
      const alerts = [];
      resourceManager.onAlert(alert => alerts.push(alert));

      resourceManager.enableDegradedMode();
      alerts.length = 0; // Clear previous alerts

      resourceManager.disableDegradedMode();

      const recoveredAlert = alerts.find(a => a.type === 'degraded_mode_disabled');
      expect(recoveredAlert).toBeDefined();
    });
  });

  describe('Metrics Cleanup', () => {
    it('should clear old metrics', () => {
      for (let i = 0; i < 10; i++) {
        resourceManager.recordMemoryUsage();
        resourceManager.recordQueueSize(i * 10);
        resourceManager.recordRequest();
      }

      const cleared = resourceManager.clearOldMetrics(0);

      expect(cleared.memory).toBe(10);
      expect(cleared.queue).toBe(10);
      expect(cleared.throttle).toBe(10);

      const stats = resourceManager.getStats();
      expect(stats.memory.current).toBeDefined();
      expect(stats.queue.current_size).toBe(90);
    });

    it('should keep recent metrics', () => {
      for (let i = 0; i < 5; i++) {
        resourceManager.recordMemoryUsage();
      }

      const cleared = resourceManager.clearOldMetrics(86400000); // 24 hours

      expect(cleared.memory).toBe(0);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete resource monitoring workflow', () => {
      const alerts = [];
      resourceManager.onAlert(alert => alerts.push(alert));

      // Normal operation
      resourceManager.recordMemoryUsage();
      resourceManager.recordQueueSize(20);
      resourceManager.recordRequest();

      let status = resourceManager.getStatus();
      expect(status.overall_health).toBe(true);

      // Queue starts growing
      resourceManager.recordQueueSize(85);
      expect(alerts.some(a => a.type === 'queue_warning')).toBe(true);

      // Queue becomes critical
      resourceManager.recordQueueSize(105);
      expect(alerts.some(a => a.type === 'queue_critical')).toBe(true);

      status = resourceManager.getStatus();
      expect(status.degraded_mode).toBe(true);
      expect(status.overall_health).toBe(false);

      // Queue recovers
      resourceManager.recordQueueSize(30);
      status = resourceManager.getStatus();
      expect(status.degraded_mode).toBe(false);
    });

    it('should handle rate limiting scenario', () => {
      const alerts = [];
      resourceManager.onAlert(alert => alerts.push(alert));

      // Burst of requests
      let allowedCount = 0;
      let throttledCount = 0;

      for (let i = 0; i < 100; i++) {
        if (resourceManager.recordRequest()) {
          allowedCount++;
        } else {
          throttledCount++;
        }
      }

      expect(allowedCount).toBeLessThanOrEqual(60);
      expect(throttledCount).toBeGreaterThan(0);
      expect(alerts.some(a => a.type === 'rate_limit_exceeded')).toBe(true);

      const stats = resourceManager.getStats();
      expect(stats.throttle.throttled_requests).toBeGreaterThan(0);
    });

    it('should provide comprehensive statistics', () => {
      // Simulate various operations
      for (let i = 0; i < 10; i++) {
        resourceManager.recordMemoryUsage();
        resourceManager.recordQueueSize(i * 5);
        resourceManager.recordRequest();
      }

      const stats = resourceManager.getStats();

      expect(stats.memory.avg_heap_used).toBeGreaterThan(0);
      expect(stats.queue.avg_size).toBeGreaterThan(0);
      expect(stats.throttle.total_requests).toBe(10);
      expect(stats.state.is_throttled).toBe(false);
      expect(stats.state.is_degraded).toBe(false);
    });
  });
});
