/**
 * Performance Optimizer Tests
 * 
 * Tests for automatic performance optimization:
 * - Bottleneck identification
 * - Recommendation generation
 * - Optimization application
 * 
 * Validates: Requirement 21.11
 */

const performanceOptimizer = require('./performance_optimizer');
const performanceMonitor = require('./performance_monitor');
const tokenBudgetManager = require('./token_budget_manager');

describe('Performance Optimizer', () => {
  beforeEach(() => {
    // Reset all modules
    performanceMonitor.reset();
    tokenBudgetManager.reset();
    performanceOptimizer.reset();
  });

  describe('Requirement 21.11: Performance Bottleneck Identification', () => {
    test('should identify local processing bottleneck', () => {
      // Simulate slow local processing
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          doc_id: 'doc_1',
          total_time: 1500  // Exceeds 1000ms threshold
        });
      }

      const analysis = performanceOptimizer.analyzePerformance();

      expect(analysis.bottlenecks).toContainEqual(
        expect.objectContaining({
          type: 'local_processing_slow',
          severity: 'high'
        })
      );
    });

    test('should identify LLM timeout bottleneck', () => {
      // Simulate LLM timeouts
      for (let i = 0; i < 5; i++) {
        performanceMonitor.recordLLMCall({
          module: 'field_normalizer',
          operation: 'map_field',
          duration: 11000,
          timeout: true,
          success: false
        });
      }

      for (let i = 0; i < 5; i++) {
        performanceMonitor.recordLLMCall({
          module: 'field_normalizer',
          operation: 'map_field',
          duration: 3000,
          success: true
        });
      }

      const analysis = performanceOptimizer.analyzePerformance();

      const timeoutBottleneck = analysis.bottlenecks.find(b => b.type === 'llm_timeout_high');
      expect(timeoutBottleneck).toBeDefined();
      expect(timeoutBottleneck.severity).toBe('medium');
    });

    test('should identify high token usage bottleneck', () => {
      // Simulate high token usage
      tokenBudgetManager.updateConfig({ dailyLimit: 1000 });
      
      for (let i = 0; i < 10; i++) {
        tokenBudgetManager.recordUsage({
          module: 'field_normalizer',
          operation: 'llm_map',
          tokens: 85,
          doc_id: 'doc_1'
        });
      }

      const analysis = performanceOptimizer.analyzePerformance();

      expect(analysis.bottlenecks).toContainEqual(
        expect.objectContaining({
          type: 'token_usage_high',
          severity: 'high'
        })
      );
    });

    test('should identify multiple bottlenecks', () => {
      // Simulate multiple issues
      
      // Slow local processing
      for (let i = 0; i < 5; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: 1500
        });
      }

      // High token usage
      tokenBudgetManager.updateConfig({ dailyLimit: 1000 });
      for (let i = 0; i < 10; i++) {
        tokenBudgetManager.recordUsage({
          module: 'test',
          operation: 'test',
          tokens: 85
        });
      }

      const analysis = performanceOptimizer.analyzePerformance();

      expect(analysis.bottlenecks.length).toBeGreaterThanOrEqual(2);
      expect(analysis.bottlenecks.some(b => b.type === 'local_processing_slow')).toBe(true);
      expect(analysis.bottlenecks.some(b => b.type === 'token_usage_high')).toBe(true);
    });

    test('should not identify bottlenecks when performance is good', () => {
      // Simulate good performance
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: 500  // Within budget
        });
      }

      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLLMCall({
          module: 'test',
          operation: 'test',
          duration: 3000,
          success: true
        });
      }

      const analysis = performanceOptimizer.analyzePerformance();

      expect(analysis.bottlenecks.length).toBe(0);
    });
  });

  describe('Requirement 21.11: Optimization Suggestion Generation', () => {
    test('should generate recommendations for local processing bottleneck', () => {
      // Simulate slow local processing
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: 1500
        });
      }

      const analysis = performanceOptimizer.analyzePerformance();

      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.recommendations).toContainEqual(
        expect.objectContaining({
          strategy: 'ENABLE_BATCH_PROCESSING'
        })
      );
    });

    test('should generate recommendations for token usage bottleneck', () => {
      // Simulate high token usage
      tokenBudgetManager.updateConfig({ dailyLimit: 1000 });
      for (let i = 0; i < 10; i++) {
        tokenBudgetManager.recordUsage({
          module: 'test',
          operation: 'test',
          tokens: 85
        });
      }

      const analysis = performanceOptimizer.analyzePerformance();

      expect(analysis.recommendations.length).toBeGreaterThan(0);
      
      const strategies = analysis.recommendations.map(r => r.strategy);
      expect(strategies).toContain('REDUCE_LLM_RATE');
    });

    test('should prioritize recommendations by impact and risk', () => {
      // Simulate multiple bottlenecks
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: 1500
        });
      }

      tokenBudgetManager.updateConfig({ dailyLimit: 1000 });
      for (let i = 0; i < 10; i++) {
        tokenBudgetManager.recordUsage({
          module: 'test',
          operation: 'test',
          tokens: 85
        });
      }

      const analysis = performanceOptimizer.analyzePerformance();

      expect(analysis.recommendations.length).toBeGreaterThan(0);
      
      // Check that recommendations are prioritized
      analysis.recommendations.forEach(rec => {
        expect(rec).toHaveProperty('priority');
        expect(rec).toHaveProperty('priorityScore');
        expect(['high', 'medium', 'low']).toContain(rec.priority);
      });

      // High priority should come first
      if (analysis.recommendations.length > 1) {
        const priorities = analysis.recommendations.map(r => r.priorityScore);
        for (let i = 1; i < priorities.length; i++) {
          expect(priorities[i]).toBeLessThanOrEqual(priorities[i - 1]);
        }
      }
    });

    test('should include expected improvement in recommendations', () => {
      // Simulate bottleneck
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: 1500
        });
      }

      const analysis = performanceOptimizer.analyzePerformance();

      analysis.recommendations.forEach(rec => {
        expect(rec).toHaveProperty('expectedImprovement');
        expect(typeof rec.expectedImprovement).toBe('string');
        expect(rec.expectedImprovement.length).toBeGreaterThan(0);
      });
    });

    test('should not generate duplicate recommendations', () => {
      // Simulate multiple related bottlenecks
      tokenBudgetManager.updateConfig({ dailyLimit: 1000 });
      for (let i = 0; i < 10; i++) {
        tokenBudgetManager.recordUsage({
          module: 'test',
          operation: 'test',
          tokens: 85
        });
      }

      const analysis = performanceOptimizer.analyzePerformance();

      const strategies = analysis.recommendations.map(r => r.strategy);
      const uniqueStrategies = new Set(strategies);
      
      expect(strategies.length).toBe(uniqueStrategies.size);
    });
  });

  describe('Requirement 21.11: Automatic Optimization Application', () => {
    test('should apply REDUCE_LLM_RATE optimization', () => {
      const initialRate = tokenBudgetManager.BUDGET_CONFIG.NORMAL_LLM_RATE;
      
      const result = performanceOptimizer.applyOptimization('REDUCE_LLM_RATE');

      expect(result.applied).toBe(true);
      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.changes[0].parameter).toBe('llm_participation_rate');
      expect(result.changes[0].after).toBeLessThan(initialRate);
    });

    test('should apply CLEAR_OLD_METRICS optimization', () => {
      // Add some old metrics
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: 500
        });
      }

      const result = performanceOptimizer.applyOptimization('CLEAR_OLD_METRICS');

      expect(result.applied).toBe(true);
      expect(result.changes.length).toBeGreaterThan(0);
    });

    test('should handle unsupported optimizations gracefully', () => {
      const result = performanceOptimizer.applyOptimization('INCREASE_CACHE_TTL');

      expect(result.applied).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.changes[0].note).toContain('Manual');
    });

    test('should track applied optimizations', () => {
      performanceOptimizer.applyOptimization('REDUCE_LLM_RATE');
      performanceOptimizer.applyOptimization('CLEAR_OLD_METRICS');

      const state = performanceOptimizer.getOptimizationState();

      expect(state.appliedOptimizations.length).toBe(2);
      expect(state.lastOptimization).toBeDefined();
      expect(state.lastOptimization.strategy).toBe('CLEAR_OLD_METRICS');
    });

    test('should handle optimization errors', () => {
      const result = performanceOptimizer.applyOptimization('INVALID_STRATEGY');

      expect(result.applied).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Unknown strategy');
    });
  });

  describe('Auto-Apply Optimizations', () => {
    test('should auto-apply high priority optimizations', () => {
      // Simulate bottleneck
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: 1500
        });
      }

      const result = performanceOptimizer.autoApplyOptimizations({
        maxOptimizations: 2,
        minPriority: 'high'
      });

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.results).toBeDefined();
    });

    test('should respect maxOptimizations limit', () => {
      // Simulate multiple bottlenecks
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: 1500
        });
      }

      tokenBudgetManager.updateConfig({ dailyLimit: 1000 });
      for (let i = 0; i < 10; i++) {
        tokenBudgetManager.recordUsage({
          module: 'test',
          operation: 'test',
          tokens: 85
        });
      }

      const result = performanceOptimizer.autoApplyOptimizations({
        maxOptimizations: 1
      });

      expect(result.results.length).toBeLessThanOrEqual(1);
    });

    test('should support dry run mode', () => {
      // Simulate bottleneck
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: 1500
        });
      }

      const result = performanceOptimizer.autoApplyOptimizations({
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Dry run');
      expect(result.recommendations).toBeDefined();
      expect(result.results).toBeUndefined();
    });

    test('should return success when no optimizations needed', () => {
      // Good performance - no bottlenecks
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: 500
        });
      }

      const result = performanceOptimizer.autoApplyOptimizations();

      expect(result.success).toBe(true);
      expect(result.message).toContain('No optimizations needed');
    });

    test('should respect enabled state', () => {
      performanceOptimizer.setEnabled(false);

      const result = performanceOptimizer.autoApplyOptimizations();

      expect(result.success).toBe(false);
      expect(result.message).toContain('disabled');

      performanceOptimizer.setEnabled(true);
    });
  });

  describe('Optimization State Management', () => {
    test('should track optimization state', () => {
      const state = performanceOptimizer.getOptimizationState();

      expect(state).toHaveProperty('enabled');
      expect(state).toHaveProperty('autoApply');
      expect(state).toHaveProperty('appliedOptimizations');
      expect(state).toHaveProperty('lastAnalysis');
      expect(state).toHaveProperty('lastOptimization');
    });

    test('should enable/disable optimizer', () => {
      performanceOptimizer.setEnabled(false);
      let state = performanceOptimizer.getOptimizationState();
      expect(state.enabled).toBe(false);

      performanceOptimizer.setEnabled(true);
      state = performanceOptimizer.getOptimizationState();
      expect(state.enabled).toBe(true);
    });

    test('should enable/disable auto-apply', () => {
      performanceOptimizer.setAutoApply(true);
      let state = performanceOptimizer.getOptimizationState();
      expect(state.autoApply).toBe(true);

      performanceOptimizer.setAutoApply(false);
      state = performanceOptimizer.getOptimizationState();
      expect(state.autoApply).toBe(false);
    });

    test('should reset state', () => {
      performanceOptimizer.applyOptimization('REDUCE_LLM_RATE');
      performanceOptimizer.setAutoApply(true);

      performanceOptimizer.reset();

      const state = performanceOptimizer.getOptimizationState();
      expect(state.appliedOptimizations.length).toBe(0);
      expect(state.autoApply).toBe(false);
      expect(state.lastOptimization).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    test('should provide complete analysis with bottlenecks and recommendations', () => {
      // Simulate realistic scenario
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: i < 4 ? 1500 : 500  // 40% slow
        });
      }

      const analysis = performanceOptimizer.analyzePerformance();

      expect(analysis).toHaveProperty('timestamp');
      expect(analysis).toHaveProperty('health');
      expect(analysis).toHaveProperty('bottlenecks');
      expect(analysis).toHaveProperty('recommendations');
      expect(analysis).toHaveProperty('stats');
      expect(analysis).toHaveProperty('budget');

      if (analysis.bottlenecks.length > 0) {
        expect(analysis.recommendations.length).toBeGreaterThan(0);
      }
    });

    test('should handle complex multi-bottleneck scenario', () => {
      // Simulate multiple issues
      
      // Slow processing
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: 1500
        });
      }

      // LLM timeouts
      for (let i = 0; i < 3; i++) {
        performanceMonitor.recordLLMCall({
          module: 'test',
          operation: 'test',
          duration: 11000,
          timeout: true,
          success: false
        });
      }

      // High token usage
      tokenBudgetManager.updateConfig({ dailyLimit: 1000 });
      for (let i = 0; i < 10; i++) {
        tokenBudgetManager.recordUsage({
          module: 'test',
          operation: 'test',
          tokens: 85
        });
      }

      const analysis = performanceOptimizer.analyzePerformance();

      expect(analysis.bottlenecks.length).toBeGreaterThanOrEqual(2);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.health.score).toBeLessThan(100);
    });
  });
});
