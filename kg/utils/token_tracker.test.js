/**
 * Unit Tests for Token Tracker
 */

const tokenTracker = require('./token_tracker');

describe('Token Tracker', () => {
  beforeEach(() => {
    // Reset tracker state to ensure test isolation
    tokenTracker.reset();
    // Reset daily budget and usage
    tokenTracker.setDailyBudget(100000);
  });

  describe('recordTokenUsage', () => {
    it('should record token usage', () => {
      const usage = {
        module: 'field_extraction',
        operation: 'extract_fields',
        doc_id: 'doc_123',
        ckb_id: 'ckb_001',
        input_tokens: 100,
        output_tokens: 50,
        model: 'gpt-4',
        cost: 0.01
      };

      const record = tokenTracker.recordTokenUsage(usage);

      expect(record.id).toBeDefined();
      expect(record.module).toBe('field_extraction');
      expect(record.total_tokens).toBe(150);
      expect(record.timestamp).toBeDefined();
    });

    it('should calculate total tokens from input and output', () => {
      const usage = {
        module: 'entity_building',
        operation: 'build_entity',
        input_tokens: 200,
        output_tokens: 100
      };

      const record = tokenTracker.recordTokenUsage(usage);

      expect(record.total_tokens).toBe(300);
    });
  });

  describe('getTokenStats', () => {
    it('should return token statistics', () => {
      tokenTracker.recordTokenUsage({
        module: 'field_extraction',
        operation: 'extract',
        input_tokens: 100,
        output_tokens: 50,
        cost: 0.01
      });

      tokenTracker.recordTokenUsage({
        module: 'entity_building',
        operation: 'build',
        input_tokens: 200,
        output_tokens: 100,
        cost: 0.02
      });

      const stats = tokenTracker.getTokenStats();

      expect(stats.total_records).toBe(2);
      expect(stats.total_tokens).toBe(450);
      expect(stats.total_cost).toBeCloseTo(0.03);
      expect(stats.by_module).toHaveProperty('field_extraction');
      expect(stats.by_module).toHaveProperty('entity_building');
    });

    it('should filter by module', () => {
      tokenTracker.recordTokenUsage({
        module: 'field_extraction',
        operation: 'extract',
        input_tokens: 100,
        output_tokens: 50
      });

      tokenTracker.recordTokenUsage({
        module: 'entity_building',
        operation: 'build',
        input_tokens: 200,
        output_tokens: 100
      });

      const stats = tokenTracker.getTokenStats({
        module: 'field_extraction'
      });

      expect(stats.total_records).toBe(1);
      expect(stats.total_tokens).toBe(150);
    });

    it('should filter by date range', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      tokenTracker.recordTokenUsage({
        module: 'test',
        operation: 'test',
        input_tokens: 100,
        output_tokens: 50,
        timestamp: yesterday.toISOString()
      });

      const stats = tokenTracker.getTokenStats({
        startDate: now.toISOString()
      });

      expect(stats.total_records).toBe(0);
    });
  });

  describe('getTokenUsageTimeSeries', () => {
    it('should return time series data', () => {
      tokenTracker.recordTokenUsage({
        module: 'test',
        operation: 'test',
        input_tokens: 100,
        output_tokens: 50
      });

      const timeSeries = tokenTracker.getTokenUsageTimeSeries('day', 7);

      expect(Array.isArray(timeSeries)).toBe(true);
      expect(timeSeries).toHaveLength(7);
      expect(timeSeries[0]).toHaveProperty('period_start');
      expect(timeSeries[0]).toHaveProperty('total_tokens');
    });
  });

  describe('setDailyBudget', () => {
    it('should set daily token budget', () => {
      tokenTracker.setDailyBudget(50000);

      const status = tokenTracker.getDailyBudgetStatus();

      expect(status.budget).toBe(50000);
    });
  });

  describe('getDailyBudgetStatus', () => {
    it('should return budget status', () => {
      tokenTracker.setDailyBudget(1000);

      tokenTracker.recordTokenUsage({
        module: 'test',
        operation: 'test',
        input_tokens: 500,
        output_tokens: 300
      });

      const status = tokenTracker.getDailyBudgetStatus();

      expect(status.budget).toBe(1000);
      expect(status.used).toBe(800);
      expect(status.remaining).toBe(200);
      expect(status.percentage).toBe(80);
      expect(status.status).toBe('warning');
    });

    it('should show exceeded status when over budget', () => {
      tokenTracker.setDailyBudget(100);

      tokenTracker.recordTokenUsage({
        module: 'test',
        operation: 'test',
        input_tokens: 80,
        output_tokens: 50
      });

      const status = tokenTracker.getDailyBudgetStatus();

      expect(status.status).toBe('exceeded');
    });
  });

  describe('getOptimizationRecommendations', () => {
    it('should generate recommendations for high module usage', () => {
      tokenTracker.setDailyBudget(10000);

      // Create high usage for one module
      for (let i = 0; i < 10; i++) {
        tokenTracker.recordTokenUsage({
          module: 'field_extraction',
          operation: 'extract',
          input_tokens: 500,
          output_tokens: 300
        });
      }

      tokenTracker.recordTokenUsage({
        module: 'entity_building',
        operation: 'build',
        input_tokens: 100,
        output_tokens: 50
      });

      const recommendations = tokenTracker.getOptimizationRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
      const hasModuleRecommendation = recommendations.some(
        r => r.type === 'high_module_usage'
      );
      expect(hasModuleRecommendation).toBe(true);
    });

    it('should generate budget warning recommendation', () => {
      tokenTracker.setDailyBudget(100);

      tokenTracker.recordTokenUsage({
        module: 'test',
        operation: 'test',
        input_tokens: 60,
        output_tokens: 30
      });

      const recommendations = tokenTracker.getOptimizationRecommendations();

      const hasBudgetWarning = recommendations.some(
        r => r.type === 'budget_warning'
      );
      expect(hasBudgetWarning).toBe(true);
    });
  });

  describe('exportTokenUsage', () => {
    it('should export as JSON', () => {
      tokenTracker.recordTokenUsage({
        module: 'test',
        operation: 'test',
        input_tokens: 100,
        output_tokens: 50
      });

      const exported = tokenTracker.exportTokenUsage({}, 'json');

      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(parsed).toHaveProperty('total_tokens');
    });

    it('should export as CSV', () => {
      tokenTracker.recordTokenUsage({
        module: 'test',
        operation: 'test',
        doc_id: 'doc_123',
        input_tokens: 100,
        output_tokens: 50,
        cost: 0.01
      });

      const exported = tokenTracker.exportTokenUsage({}, 'csv');

      expect(typeof exported).toBe('string');
      expect(exported).toContain('timestamp,module,operation');
      expect(exported).toContain('test,test,doc_123');
    });
  });

  describe('clearOldRecords', () => {
    it('should clear records older than specified days', () => {
      // Clear existing records first
      const initialStats = tokenTracker.getTokenStats();
      const initialCount = initialStats.total_records;

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);

      tokenTracker.recordTokenUsage({
        module: 'test',
        operation: 'test',
        input_tokens: 100,
        output_tokens: 50,
        timestamp: oldDate.toISOString()
      });

      tokenTracker.recordTokenUsage({
        module: 'test',
        operation: 'test',
        input_tokens: 100,
        output_tokens: 50
      });

      const deleted = tokenTracker.clearOldRecords(30);

      expect(deleted).toBeGreaterThanOrEqual(1);

      const stats = tokenTracker.getTokenStats();
      // Should have at least one recent record
      expect(stats.total_records).toBeGreaterThanOrEqual(1);
    });
  });
});
