/**
 * Tests for Monitoring Dashboard
 */

const { MonitoringDashboard } = require('./monitoring_dashboard');

describe('MonitoringDashboard', () => {
  let dashboard;

  beforeEach(() => {
    dashboard = new MonitoringDashboard({
      refreshInterval: 1000,
      historyWindow: 3600000
    });
  });

  afterEach(() => {
    dashboard.stopAutoRefresh();
  });

  describe('Constructor', () => {
    test('should initialize with default config', () => {
      const dash = new MonitoringDashboard();
      expect(dash.config.refreshInterval).toBe(5000);
      expect(dash.config.historyWindow).toBe(3600000);
      expect(dash.config.enableAutoRefresh).toBe(true);
    });

    test('should accept custom config', () => {
      const dash = new MonitoringDashboard({
        refreshInterval: 10000,
        historyWindow: 7200000
      });
      expect(dash.config.refreshInterval).toBe(10000);
      expect(dash.config.historyWindow).toBe(7200000);
    });

    test('should initialize monitors', () => {
      expect(dashboard.tokenMonitor).toBeDefined();
      expect(dashboard.accuracyMonitor).toBeDefined();
      expect(dashboard.latencyMonitor).toBeDefined();
    });
  });

  describe('getDashboardData', () => {
    test('should return complete dashboard data structure', async () => {
      const data = await dashboard.getDashboardData();

      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('tokenMetrics');
      expect(data).toHaveProperty('accuracyMetrics');
      expect(data).toHaveProperty('latencyMetrics');
      expect(data).toHaveProperty('systemHealth');
      expect(data).toHaveProperty('alerts');
    });

    test('should include token metrics', async () => {
      const data = await dashboard.getDashboardData();

      expect(data.tokenMetrics).toHaveProperty('current');
      expect(data.tokenMetrics).toHaveProperty('savings');
      expect(data.tokenMetrics).toHaveProperty('budget');
      expect(data.tokenMetrics).toHaveProperty('trend');
    });

    test('should include accuracy metrics', async () => {
      const data = await dashboard.getDashboardData();

      expect(data.accuracyMetrics).toHaveProperty('fieldExtraction');
      expect(data.accuracyMetrics).toHaveProperty('entityRecognition');
      expect(data.accuracyMetrics).toHaveProperty('relationExtraction');
      expect(data.accuracyMetrics).toHaveProperty('degradation');
    });

    test('should include latency metrics', async () => {
      const data = await dashboard.getDashboardData();

      expect(data.latencyMetrics).toHaveProperty('documentProcessing');
      expect(data.latencyMetrics).toHaveProperty('fieldExtraction');
      expect(data.latencyMetrics).toHaveProperty('entityBuilding');
      expect(data.latencyMetrics).toHaveProperty('relationExtraction');
    });

    test('should include system health', async () => {
      const data = await dashboard.getDashboardData();

      expect(data.systemHealth).toHaveProperty('overall');
      expect(data.systemHealth).toHaveProperty('components');
      expect(data.systemHealth.overall).toHaveProperty('score');
      expect(data.systemHealth.overall).toHaveProperty('status');
    });
  });

  describe('getTokenMetrics', () => {
    test('should return token metrics structure', async () => {
      const metrics = await dashboard.getTokenMetrics();

      expect(metrics).toHaveProperty('current');
      expect(metrics).toHaveProperty('savings');
      expect(metrics).toHaveProperty('budget');
      expect(metrics).toHaveProperty('trend');
    });

    test('should calculate budget utilization', async () => {
      const metrics = await dashboard.getTokenMetrics();

      expect(metrics.budget).toHaveProperty('limit');
      expect(metrics.budget).toHaveProperty('used');
      expect(metrics.budget).toHaveProperty('remaining');
      expect(metrics.budget).toHaveProperty('utilizationPercent');
      expect(metrics.budget.utilizationPercent).toBeGreaterThanOrEqual(0);
      expect(metrics.budget.utilizationPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('getAccuracyMetrics', () => {
    test('should return accuracy metrics structure', async () => {
      const metrics = await dashboard.getAccuracyMetrics();

      expect(metrics).toHaveProperty('fieldExtraction');
      expect(metrics).toHaveProperty('entityRecognition');
      expect(metrics).toHaveProperty('relationExtraction');
      expect(metrics).toHaveProperty('degradation');
    });

    test('should include baseline and optimized values', async () => {
      const metrics = await dashboard.getAccuracyMetrics();

      expect(metrics.fieldExtraction).toHaveProperty('baseline');
      expect(metrics.fieldExtraction).toHaveProperty('optimized');
      expect(metrics.fieldExtraction).toHaveProperty('delta');
      expect(metrics.fieldExtraction).toHaveProperty('status');
    });
  });

  describe('getLatencyMetrics', () => {
    test('should return latency metrics structure', async () => {
      const metrics = await dashboard.getLatencyMetrics();

      expect(metrics).toHaveProperty('documentProcessing');
      expect(metrics).toHaveProperty('fieldExtraction');
      expect(metrics).toHaveProperty('entityBuilding');
      expect(metrics).toHaveProperty('relationExtraction');
      expect(metrics).toHaveProperty('bottlenecks');
    });

    test('should include improvement percentages', async () => {
      const metrics = await dashboard.getLatencyMetrics();

      expect(metrics.documentProcessing).toHaveProperty('improvement');
      expect(metrics.fieldExtraction).toHaveProperty('improvement');
      expect(metrics.entityBuilding).toHaveProperty('improvement');
      expect(metrics.relationExtraction).toHaveProperty('improvement');
    });
  });

  describe('getSystemHealth', () => {
    test('should return system health structure', async () => {
      const health = await dashboard.getSystemHealth();

      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('components');
      expect(health).toHaveProperty('uptime');
    });

    test('should calculate overall health score', async () => {
      const health = await dashboard.getSystemHealth();

      expect(health.overall.score).toBeGreaterThanOrEqual(0);
      expect(health.overall.score).toBeLessThanOrEqual(100);
      expect(health.overall).toHaveProperty('status');
      expect(health.overall).toHaveProperty('message');
    });

    test('should include component health', async () => {
      const health = await dashboard.getSystemHealth();

      expect(health.components).toHaveProperty('tokenUsage');
      expect(health.components).toHaveProperty('accuracy');
      expect(health.components).toHaveProperty('latency');

      expect(health.components.tokenUsage).toHaveProperty('score');
      expect(health.components.tokenUsage).toHaveProperty('status');
    });
  });

  describe('getAllAlerts', () => {
    test('should return array of alerts', () => {
      const alerts = dashboard.getAllAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    test('should sort alerts by severity', () => {
      const alerts = dashboard.getAllAlerts();
      
      if (alerts.length > 1) {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        for (let i = 0; i < alerts.length - 1; i++) {
          expect(severityOrder[alerts[i].severity]).toBeLessThanOrEqual(
            severityOrder[alerts[i + 1].severity]
          );
        }
      }
    });
  });

  describe('getSummaryStats', () => {
    test('should return summary statistics', async () => {
      const summary = await dashboard.getSummaryStats();

      expect(summary).toHaveProperty('optimization');
      expect(summary).toHaveProperty('performance');
      expect(summary).toHaveProperty('usage');
    });

    test('should include optimization metrics', async () => {
      const summary = await dashboard.getSummaryStats();

      expect(summary.optimization).toHaveProperty('tokenSavings');
      expect(summary.optimization).toHaveProperty('latencyImprovement');
      expect(summary.optimization).toHaveProperty('accuracyImpact');
    });
  });

  describe('Auto-refresh', () => {
    test('should start auto-refresh', () => {
      dashboard.startAutoRefresh();
      expect(dashboard.autoRefreshTimer).not.toBeNull();
    });

    test('should stop auto-refresh', () => {
      dashboard.startAutoRefresh();
      dashboard.stopAutoRefresh();
      expect(dashboard.autoRefreshTimer).toBeNull();
    });

    test('should not create multiple timers', () => {
      dashboard.startAutoRefresh();
      const firstTimer = dashboard.autoRefreshTimer;
      dashboard.startAutoRefresh();
      expect(dashboard.autoRefreshTimer).toBe(firstTimer);
    });
  });

  describe('exportData', () => {
    test('should export as JSON', async () => {
      const data = await dashboard.exportData('json');
      expect(() => JSON.parse(data)).not.toThrow();
    });

    test('should export as CSV', async () => {
      const data = await dashboard.exportData('csv');
      expect(typeof data).toBe('string');
      expect(data).toContain('Metric,Value');
    });

    test('should throw error for unsupported format', async () => {
      await expect(dashboard.exportData('xml')).rejects.toThrow('Unsupported export format');
    });
  });

  describe('Helper methods', () => {
    test('should calculate health status correctly', () => {
      expect(dashboard._getHealthStatus(90)).toBe('healthy');
      expect(dashboard._getHealthStatus(75)).toBe('caution');
      expect(dashboard._getHealthStatus(60)).toBe('warning');
      expect(dashboard._getHealthStatus(40)).toBe('critical');
    });

    test('should calculate accuracy status correctly', () => {
      expect(dashboard._getAccuracyStatus(-0.005)).toBe('healthy');
      expect(dashboard._getAccuracyStatus(-0.012)).toBe('caution');
      expect(dashboard._getAccuracyStatus(-0.018)).toBe('warning');
      expect(dashboard._getAccuracyStatus(-0.025)).toBe('critical');
    });

    test('should calculate latency status correctly', () => {
      expect(dashboard._getLatencyStatus(3000)).toBe('healthy');
      expect(dashboard._getLatencyStatus(6000)).toBe('caution');
      expect(dashboard._getLatencyStatus(8000)).toBe('warning');
      expect(dashboard._getLatencyStatus(12000)).toBe('critical');
    });

    test('should calculate throughput correctly', () => {
      expect(dashboard._calculateThroughput(1000)).toBe(1); // 1 doc/sec
      expect(dashboard._calculateThroughput(500)).toBe(2); // 2 docs/sec
      expect(dashboard._calculateThroughput(100)).toBe(10); // 10 docs/sec
      expect(dashboard._calculateThroughput(0)).toBe(0);
    });

    test('should calculate trend correctly', () => {
      const increasingData = [
        { value: 10 }, { value: 12 }, { value: 15 }, { value: 18 }, { value: 20 }
      ];
      expect(dashboard._calculateTrend(increasingData)).toBe('increasing');

      const decreasingData = [
        { value: 20 }, { value: 18 }, { value: 15 }, { value: 12 }, { value: 10 }
      ];
      expect(dashboard._calculateTrend(decreasingData)).toBe('decreasing');

      const stableData = [
        { value: 15 }, { value: 15 }, { value: 16 }, { value: 15 }, { value: 15 }
      ];
      expect(dashboard._calculateTrend(stableData)).toBe('stable');
    });
  });
});
