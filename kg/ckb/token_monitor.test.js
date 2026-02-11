/**
 * Tests for Token Monitor
 */

const { TokenMonitor, getTokenMonitor } = require('./token_monitor');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('TokenMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new TokenMonitor({
      budgetLimit: 10000,
      alertThreshold: 0.8,
      enableLogging: false, // Disable DB logging for tests
      enableAlerting: true
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Token Usage Recording', () => {
    test('should record token usage', async () => {
      const usage = await monitor.recordUsage({
        module: 'field_extraction',
        ckbId: 'ckb_test_1',
        modelName: 'gpt-3.5-turbo',
        inputTokens: 500,
        outputTokens: 100
      });

      expect(usage.totalTokens).toBe(600);
      expect(usage.cost).toBeGreaterThan(0);
    });

    test('should calculate cost correctly', async () => {
      const usage = await monitor.recordUsage({
        module: 'entity_naming',
        modelName: 'gpt-3.5-turbo',
        inputTokens: 1000,
        outputTokens: 200
      });

      // gpt-3.5-turbo: $0.0015/1K input, $0.002/1K output
      const expectedCost = (1000 / 1000) * 0.0015 + (200 / 1000) * 0.002;
      expect(usage.cost).toBeCloseTo(expectedCost, 4);
    });

    test('should calculate savings ratio when baseline provided', async () => {
      const usage = await monitor.recordUsage({
        module: 'field_extraction',
        inputTokens: 300,
        outputTokens: 100,
        optimized: true,
        baselineTokens: 2000
      });

      expect(usage.savingsRatio).toBeCloseTo(0.8, 2); // 80% savings
    });

    test('should update daily usage', async () => {
      await monitor.recordUsage({
        module: 'field_extraction',
        inputTokens: 500,
        outputTokens: 100
      });

      await monitor.recordUsage({
        module: 'entity_naming',
        inputTokens: 200,
        outputTokens: 50
      });

      const status = monitor.getBudgetStatus();
      expect(status.used).toBe(850); // 600 + 250
      expect(status.byModule['field_extraction']).toBe(600);
      expect(status.byModule['entity_naming']).toBe(250);
    });
  });

  describe('Budget Management', () => {
    test('should track budget status', async () => {
      await monitor.recordUsage({
        module: 'test',
        inputTokens: 5000,
        outputTokens: 1000
      });

      const status = monitor.getBudgetStatus();
      expect(status.budgetLimit).toBe(10000);
      expect(status.used).toBe(6000);
      expect(status.remaining).toBe(4000);
      expect(status.usagePercent).toBe(0.6);
      expect(status.isOverBudget).toBe(false);
      expect(status.isNearLimit).toBe(false);
    });

    test('should detect when near budget limit', async () => {
      await monitor.recordUsage({
        module: 'test',
        inputTokens: 8000,
        outputTokens: 500
      });

      const status = monitor.getBudgetStatus();
      expect(status.usagePercent).toBe(0.85);
      expect(status.isNearLimit).toBe(true);
      expect(status.isOverBudget).toBe(false);
    });

    test('should detect when over budget', async () => {
      await monitor.recordUsage({
        module: 'test',
        inputTokens: 10000,
        outputTokens: 1000
      });

      const status = monitor.getBudgetStatus();
      expect(status.isOverBudget).toBe(true);
      expect(status.remaining).toBe(0);
    });
  });

  describe('Alerting', () => {
    test('should create warning alert when near limit', async () => {
      await monitor.recordUsage({
        module: 'test',
        inputTokens: 8500,
        outputTokens: 0
      });

      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const warningAlert = alerts.find(a => a.type === 'budget_warning');
      expect(warningAlert).toBeDefined();
      expect(warningAlert.severity).toBe('warning');
    });

    test('should create critical alert when over budget', async () => {
      await monitor.recordUsage({
        module: 'test',
        inputTokens: 11000,
        outputTokens: 0
      });

      const alerts = monitor.getAlerts();
      const criticalAlert = alerts.find(a => a.type === 'budget_exceeded');
      
      expect(criticalAlert).toBeDefined();
      expect(criticalAlert.severity).toBe('critical');
    });

    test('should not create duplicate warning alerts', async () => {
      await monitor.recordUsage({
        module: 'test',
        inputTokens: 8000,
        outputTokens: 0
      });

      await monitor.recordUsage({
        module: 'test',
        inputTokens: 500,
        outputTokens: 0
      });

      const alerts = monitor.getAlerts();
      const warningAlerts = alerts.filter(a => a.type === 'budget_warning');
      
      expect(warningAlerts.length).toBe(1);
    });

    test('should clear alerts', async () => {
      await monitor.recordUsage({
        module: 'test',
        inputTokens: 9000,
        outputTokens: 0
      });

      expect(monitor.getAlerts().length).toBeGreaterThan(0);
      
      monitor.clearAlerts();
      expect(monitor.getAlerts().length).toBe(0);
    });
  });

  describe('Daily Usage Reset', () => {
    test('should reset usage for new day', () => {
      monitor.dailyUsage = {
        date: '2025-01-01',
        totalTokens: 5000,
        byModule: { test: 5000 }
      };

      monitor.resetDailyUsage();

      const today = new Date().toISOString().split('T')[0];
      expect(monitor.dailyUsage.date).toBe(today);
      expect(monitor.dailyUsage.totalTokens).toBe(0);
      expect(Object.keys(monitor.dailyUsage.byModule).length).toBe(0);
    });

    test('should not reset usage for same day', () => {
      const today = new Date().toISOString().split('T')[0];
      monitor.dailyUsage = {
        date: today,
        totalTokens: 5000,
        byModule: { test: 5000 }
      };

      monitor.resetDailyUsage();

      expect(monitor.dailyUsage.totalTokens).toBe(5000);
    });
  });

  describe('Statistics', () => {
    test('should aggregate stats by module', async () => {
      // Create test records
      const testRecords = [
        {
          module: 'field_extraction',
          totalTokens: 1000,
          cost: 0.01,
          createdAt: new Date(),
          modelName: 'gpt-3.5-turbo'
        },
        {
          module: 'field_extraction',
          totalTokens: 1500,
          cost: 0.015,
          createdAt: new Date(),
          modelName: 'gpt-3.5-turbo'
        },
        {
          module: 'entity_naming',
          totalTokens: 500,
          cost: 0.005,
          createdAt: new Date(),
          modelName: 'gpt-3.5-turbo'
        }
      ];

      const stats = monitor._aggregateStats(testRecords, 'module');

      expect(stats.totalTokens).toBe(3000);
      expect(stats.totalCost).toBeCloseTo(0.03, 3);
      expect(stats.recordCount).toBe(3);
      expect(stats.byModule['field_extraction'].totalTokens).toBe(2500);
      expect(stats.byModule['entity_naming'].totalTokens).toBe(500);
    });

    test('should group stats by date', async () => {
      const date1 = new Date('2025-01-01');
      const date2 = new Date('2025-01-02');

      const testRecords = [
        {
          module: 'test',
          totalTokens: 1000,
          cost: 0.01,
          createdAt: date1,
          modelName: 'gpt-3.5-turbo'
        },
        {
          module: 'test',
          totalTokens: 1500,
          cost: 0.015,
          createdAt: date2,
          modelName: 'gpt-3.5-turbo'
        }
      ];

      const stats = monitor._aggregateStats(testRecords, 'date');

      expect(stats.byDate['2025-01-01'].totalTokens).toBe(1000);
      expect(stats.byDate['2025-01-02'].totalTokens).toBe(1500);
    });
  });

  describe('Singleton Instance', () => {
    test('should return same instance', () => {
      const instance1 = getTokenMonitor();
      const instance2 = getTokenMonitor();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Cost Calculation', () => {
    test('should calculate cost for different models', () => {
      const models = [
        { name: 'gpt-4', input: 1000, output: 500, expectedMin: 0.06 },
        { name: 'gpt-3.5-turbo', input: 1000, output: 500, expectedMin: 0.002 },
        { name: 'qwen', input: 1000, output: 500, expectedMin: 0.0015 }
      ];

      for (const model of models) {
        const cost = monitor._calculateCost(model.name, model.input, model.output);
        expect(cost).toBeGreaterThanOrEqual(model.expectedMin);
      }
    });

    test('should handle unknown model', () => {
      const cost = monitor._calculateCost('unknown-model', 1000, 500);
      expect(cost).toBeGreaterThan(0);
    });
  });
});
