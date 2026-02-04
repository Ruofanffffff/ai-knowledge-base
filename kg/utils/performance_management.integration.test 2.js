/**
 * Performance Management Integration Tests
 * 
 * Tests the integration of all performance management modules:
 * - Performance Monitor
 * - Token Budget Manager
 * - Performance Optimizer
 * - Query Optimizer
 * - Resource Manager
 * - Cache Optimizer
 * - Cost-Benefit Analyzer
 * 
 * Validates: Requirements 21.1-21.20
 */

const performanceMonitor = require('./performance_monitor');
const tokenBudgetManager = require('./token_budget_manager');
const performanceOptimizer = require('./performance_optimizer');
const queryOptimizer = require('./query_optimizer');
const resourceManager = require('./resource_manager');
const cacheOptimizer = require('./cache_optimizer');
const costBenefitAnalyzer = require('./cost_benefit_analyzer');
const llmCache = require('./llm_cache');

describe('Performance Management Integration', () => {
  beforeEach(() => {
    // Reset all modules
    performanceMonitor.reset();
    tokenBudgetManager.reset();
    performanceOptimizer.reset();
    queryOptimizer.reset();
    resourceManager.reset();
    cacheOptimizer.reset();
    costBenefitAnalyzer.reset();
    llmCache.clear();
  });

  afterEach(() => {
    cacheOptimizer.stopMonitoring();
    llmCache.stopPeriodicCleanup();
  });

  describe('Requirements 21.1-21.5: Local Processing Performance', () => {
    test('should monitor local processing time and stay within 1 second budget', () => {
      // Simulate local processing
      const ckbData = {
        ckb_id: 'ckb_001',
        doc_id: 'doc_001',
        extract_time: 250,
        match_time: 150,
        normalize_time: 400,
        total_time: 800
      };

      const metric = performanceMonitor.recordLocalProcessing(ckbData);

      // Requirement 21.1: Local processing < 1s
      expect(metric.is_within_budget).toBe(true);
      expect(metric.total_time).toBeLessThan(1000);

      const stats = performanceMonitor.getStats();
      expect(stats.local_processing.avg_total_time).toBeLessThanOrEqual(1000);
    });

    test('should detect and alert on slow local processing', () => {
      const alerts = [];
      performanceMonitor.onAlert(alert => alerts.push(alert));

      // Simulate slow processing
      performanceMonitor.recordLocalProcessing({
        ckb_id: 'ckb_002',
        total_time: 1500
      });

      // Requirement 21.2: Alert on performance anomaly
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('local_processing_slow');
    });

    test('should track performance metrics over time', () => {
      // Record multiple operations
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: 500 + i * 50
        });
      }

      const stats = performanceMonitor.getStats();

      // Requirement 21.4: Record performance metrics
      expect(stats.local_processing.count).toBe(10);
      expect(stats.local_processing.avg_total_time).toBeGreaterThan(0);
      expect(stats.local_processing.within_budget_rate).toBeGreaterThan(0);
    });
  });

  describe('Requirements 21.3-21.5: LLM Call Performance', () => {
    test('should monitor LLM call duration with timeout control', () => {
      // Simulate LLM call
      const llmData = {
        module: 'field_normalizer',
        operation: 'map_field',
        ckb_id: 'ckb_001',
        duration: 4000,
        success: true,
        model: 'qwen',
        tokens: 500
      };

      const metric = performanceMonitor.recordLLMCall(llmData);

      // Requirement 21.3: LLM timeout 5-10s
      expect(metric.duration).toBeLessThan(10000);
      expect(metric.timeout).toBe(false);
    });

    test('should detect LLM timeouts', () => {
      performanceMonitor.recordLLMCall({
        module: 'entity_builder',
        operation: 'build',
        duration: 12000,
        timeout: true,
        success: false
      });

      const stats = performanceMonitor.getStats();
      expect(stats.llm_calls.count).toBe(1);
      expect(stats.llm_calls.success_rate).toBe(0);
    });

    test('should monitor total document processing time', () => {
      // Simulate document processing
      const docData = {
        doc_id: 'doc_001',
        total_time: 25000,
        ckb_count: 10,
        entity_count: 5,
        relation_count: 8,
        success: true
      };

      const metric = performanceMonitor.recordDocumentProcessing(docData);

      // Requirement 21.5: Total delay < 30s
      expect(metric.is_within_budget).toBe(true);
      expect(metric.total_time).toBeLessThan(30000);
    });
  });

  describe('Requirements 21.6-21.9: Token Budget Management', () => {
    test('should enforce daily Token limit', async () => {
      // Use 50% of budget
      await tokenBudgetManager.recordUsage({
        module: 'field_extraction',
        operation: 'extract',
        tokens: 50000,
        doc_id: 'doc_001'
      });

      const status = tokenBudgetManager.getBudgetStatus();

      // Requirement 21.6: Daily Token limit check
      expect(status.daily.usage).toBe(50000);
      expect(status.daily.remaining).toBe(50000);
      expect(status.daily.usageRate).toBe(0.5);
    });

    test('should enforce per-document Token limit', async () => {
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 3000,
        doc_id: 'doc_001'
      });

      // Requirement 21.7: Per-document Token limit
      const check = tokenBudgetManager.checkDocumentBudget('doc_001', 1500);
      expect(check.allowed).toBe(true);
      expect(check.remaining).toBe(500);
    });

    test('should trigger budget alerts at 80% and 100%', async () => {
      const alerts = [];
      tokenBudgetManager.onAlert(alert => alerts.push(alert));

      // Trigger 80% warning
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 80000
      });

      // Requirement 21.8: Budget alerts
      expect(alerts.some(a => a.type === 'budget_warning')).toBe(true);

      // Trigger 100% alert
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 20000
      });

      expect(alerts.some(a => a.type === 'budget_exceeded')).toBe(true);
    });

    test('should enable emergency mode when budget exceeded', async () => {
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 100000
      });

      const status = tokenBudgetManager.getBudgetStatus();

      // Requirement 21.9: Emergency mode
      expect(status.emergencyMode).toBe(true);
      expect(status.llmParticipationRate).toBe(0.2);
    });
  });

  describe('Requirement 21.10: Performance Monitoring Dashboard', () => {
    test('should provide real-time performance metrics', () => {
      // Record various metrics
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

      const dashboard = performanceMonitor.getDashboardMetrics();

      // Requirement 21.10: Real-time monitoring dashboard
      expect(dashboard).toHaveProperty('health');
      expect(dashboard).toHaveProperty('performance');
      expect(dashboard).toHaveProperty('throughput');
      expect(dashboard).toHaveProperty('errors');
      expect(dashboard.health.score).toBeGreaterThanOrEqual(0);
      expect(dashboard.health.score).toBeLessThanOrEqual(100);
    });

    test('should calculate health score', () => {
      // Record good metrics
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: 500
        });
      }

      const stats = performanceMonitor.getStats();
      expect(stats.health.score).toBeGreaterThan(80);
      expect(stats.health.status).toMatch(/excellent|good/);
    });
  });

  describe('Requirement 21.11: Automatic Performance Optimization', () => {
    test('should identify performance bottlenecks', () => {
      // Create bottleneck
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: 1500
        });
      }

      const analysis = performanceOptimizer.analyzePerformance();

      // Requirement 21.11: Bottleneck identification
      expect(analysis.bottlenecks.length).toBeGreaterThan(0);
      expect(analysis.bottlenecks[0].type).toBe('local_processing_slow');
    });

    test('should generate optimization recommendations', () => {
      // Create performance issue
      tokenBudgetManager.updateConfig({ dailyLimit: 1000 });
      for (let i = 0; i < 10; i++) {
        tokenBudgetManager.recordUsage({
          module: 'test',
          operation: 'test',
          tokens: 85
        });
      }

      const analysis = performanceOptimizer.analyzePerformance();

      // Requirement 21.11: Recommendation generation
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.recommendations[0]).toHaveProperty('strategy');
      expect(analysis.recommendations[0]).toHaveProperty('priority');
    });

    test('should apply optimizations automatically', () => {
      const result = performanceOptimizer.applyOptimization('REDUCE_LLM_RATE');

      // Requirement 21.11: Automatic optimization
      expect(result.applied).toBe(true);
      expect(result.changes.length).toBeGreaterThan(0);
    });
  });

  describe('Requirement 21.12: Query Optimization', () => {
    test('should record and analyze slow queries', () => {
      // Record slow queries
      for (let i = 0; i < 10; i++) {
        queryOptimizer.recordQuery({
          operation: 'select',
          table: 'kg_entities',
          duration: 700,
          rowCount: 100
        });
      }

      const stats = queryOptimizer.getSlowQueryStats();

      // Requirement 21.12: Slow query logging (> 500ms)
      expect(stats.count).toBe(10);
      expect(stats.avg_duration).toBeGreaterThan(500);
    });

    test('should provide index suggestions', () => {
      const suggestions = queryOptimizer.getIndexSuggestions('kg_entities');

      // Requirement 21.12: Index optimization
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty('table');
      expect(suggestions[0]).toHaveProperty('columns');
      expect(suggestions[0]).toHaveProperty('sql');
    });
  });

  describe('Requirements 21.13-21.15: Resource Management', () => {
    test('should monitor memory usage', () => {
      const metric = resourceManager.recordMemoryUsage();

      // Requirement 21.13: Memory monitoring
      expect(metric).toHaveProperty('heap_used');
      expect(metric).toHaveProperty('is_warning');
      expect(metric).toHaveProperty('is_critical');
    });

    test('should monitor queue size and enable degraded mode', () => {
      const alerts = [];
      resourceManager.onAlert(alert => alerts.push(alert));

      // Simulate queue buildup
      resourceManager.recordQueueSize(105);

      // Requirement 21.14: Queue monitoring
      expect(alerts.some(a => a.type === 'queue_critical')).toBe(true);

      const status = resourceManager.getStatus();
      expect(status.degraded_mode).toBe(true);
    });

    test('should implement rate limiting', () => {
      let throttledCount = 0;

      // Burst of requests
      for (let i = 0; i < 100; i++) {
        if (!resourceManager.recordRequest()) {
          throttledCount++;
        }
      }

      // Requirement 21.15: Rate limiting
      expect(throttledCount).toBeGreaterThan(0);
      expect(resourceManager.shouldThrottle()).toBe(true);
    });
  });

  describe('Requirements 21.16-21.17: Cache Optimization', () => {
    test('should manage cache TTL', () => {
      const result = cacheOptimizer.optimizeTTL();

      // Requirement 21.16: Cache TTL management
      expect(result).toHaveProperty('old_ttl_ms');
      expect(result).toHaveProperty('new_ttl_ms');
      expect(result.new_ttl_ms).toBeGreaterThanOrEqual(cacheOptimizer.CONFIG.MIN_TTL_MS);
      expect(result.new_ttl_ms).toBeLessThanOrEqual(cacheOptimizer.CONFIG.MAX_TTL_MS);
    });

    test('should track cache hit rate statistics', () => {
      // Add cache entries
      llmCache.set('prompt1', {}, { result: 'response1' });
      llmCache.get('prompt1', {});
      llmCache.get('prompt2', {});

      const stats = cacheOptimizer.getHitRateStats();

      // Requirement 21.17: Hit rate statistics
      expect(stats).toHaveProperty('current_hit_rate');
      expect(stats).toHaveProperty('avg_hit_rate');
      expect(stats).toHaveProperty('target_hit_rate');
      expect(stats.target_hit_rate).toBe(50);
    });

    test('should analyze cache usage patterns', () => {
      // Create usage pattern
      for (let i = 0; i < 5; i++) {
        llmCache.set(`prompt${i}`, {}, { result: `response${i}` });
      }

      for (let i = 0; i < 10; i++) {
        llmCache.get('prompt0', {});
      }

      const analysis = cacheOptimizer.analyzeCacheUsage();

      expect(analysis).toHaveProperty('entry_distribution');
      expect(analysis.entry_distribution).toHaveProperty('hot_entries');
      expect(analysis.entry_distribution).toHaveProperty('cold_entries');
    });
  });

  describe('Requirement 21.18: Load Management', () => {
    test('should handle high load with degraded mode', () => {
      // Simulate high load
      resourceManager.recordQueueSize(105);

      const status = resourceManager.getStatus();

      // Requirement 21.18: Load management
      expect(status.degraded_mode).toBe(true);
      expect(status.overall_health).toBe(false);
    });

    test('should recover from degraded mode', () => {
      resourceManager.recordQueueSize(105);
      expect(resourceManager.getStatus().degraded_mode).toBe(true);

      resourceManager.recordQueueSize(30);
      expect(resourceManager.getStatus().degraded_mode).toBe(false);
    });
  });

  describe('Requirements 21.19-21.20: Cost-Benefit Analysis', () => {
    test('should calculate average Token cost per document', () => {
      // Record document metrics
      for (let i = 0; i < 5; i++) {
        costBenefitAnalyzer.recordDocumentMetrics({
          doc_id: `doc${i}`,
          processing_time_ms: 3000,
          token_usage: {
            input_tokens: 1000,
            output_tokens: 500,
            total_tokens: 1500
          }
        });
      }

      const stats = costBenefitAnalyzer.getAverageTokenCost();

      // Requirement 21.19: Average Token cost
      expect(stats.avg_total_cost).toBeGreaterThan(0);
      expect(stats.document_count).toBe(5);
      expect(stats).toHaveProperty('target_cost');
    });

    test('should calculate average processing time per document', () => {
      for (let i = 0; i < 5; i++) {
        costBenefitAnalyzer.recordDocumentMetrics({
          doc_id: `doc${i}`,
          processing_time_ms: 3000 + i * 500,
          token_usage: {
            input_tokens: 1000,
            output_tokens: 500,
            total_tokens: 1500
          }
        });
      }

      const stats = costBenefitAnalyzer.getAverageProcessingTime();

      // Requirement 21.19: Average processing time
      expect(stats.avg_processing_time_ms).toBeGreaterThan(0);
      expect(stats.document_count).toBe(5);
      expect(stats).toHaveProperty('target_time_ms');
    });

    test('should provide optimization recommendations', () => {
      // Create high-cost scenario
      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc1',
        processing_time_ms: 10000,
        token_usage: {
          input_tokens: 50000,
          output_tokens: 25000,
          total_tokens: 75000
        }
      });

      const recommendations = costBenefitAnalyzer.getOptimizationRecommendations();

      // Requirement 21.20: Optimization recommendations
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]).toHaveProperty('priority');
      expect(recommendations[0]).toHaveProperty('category');
      expect(recommendations[0]).toHaveProperty('recommendation');
    });
  });

  describe('End-to-End Integration Scenarios', () => {
    test('should handle complete document processing workflow', async () => {
      const alerts = [];
      performanceMonitor.onAlert(alert => alerts.push(alert));
      tokenBudgetManager.onAlert(alert => alerts.push(alert));

      // 1. Start document processing
      const startTime = Date.now();

      // 2. Local processing (CKB parsing, field extraction, schema matching)
      performanceMonitor.recordLocalProcessing({
        ckb_id: 'ckb_001',
        doc_id: 'doc_001',
        extract_time: 250,
        match_time: 150,
        normalize_time: 400,
        total_time: 800
      });

      // 3. LLM call for field mapping
      await tokenBudgetManager.recordUsage({
        module: 'field_normalizer',
        operation: 'map_field',
        tokens: 500,
        doc_id: 'doc_001'
      });

      performanceMonitor.recordLLMCall({
        module: 'field_normalizer',
        operation: 'map_field',
        duration: 3000,
        success: true,
        tokens: 500
      });

      // 4. Database query
      queryOptimizer.recordQuery({
        operation: 'select',
        table: 'schemas',
        duration: 200
      });

      // 5. Complete document processing
      const endTime = Date.now();
      performanceMonitor.recordDocumentProcessing({
        doc_id: 'doc_001',
        total_time: endTime - startTime,
        ckb_count: 1,
        entity_count: 2,
        relation_count: 3,
        success: true
      });

      // 6. Record cost-benefit metrics
      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc_001',
        processing_time_ms: endTime - startTime,
        token_usage: {
          input_tokens: 300,
          output_tokens: 200,
          total_tokens: 500
        }
      });

      // Verify all systems recorded metrics
      const perfStats = performanceMonitor.getStats();
      expect(perfStats.local_processing.count).toBe(1);
      expect(perfStats.llm_calls.count).toBe(1);
      expect(perfStats.document_processing.count).toBe(1);

      const budgetStatus = tokenBudgetManager.getBudgetStatus();
      expect(budgetStatus.daily.usage).toBe(500);

      const costStats = costBenefitAnalyzer.getAverageTokenCost();
      expect(costStats.document_count).toBe(1);
    });

    test('should handle performance degradation scenario', async () => {
      // Simulate system under stress
      
      // 1. High Token usage
      tokenBudgetManager.updateConfig({ dailyLimit: 1000 });
      for (let i = 0; i < 10; i++) {
        await tokenBudgetManager.recordUsage({
          module: 'test',
          operation: 'test',
          tokens: 85
        });
      }

      // 2. Slow processing
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: 1500
        });
      }

      // 3. Queue buildup
      resourceManager.recordQueueSize(105);

      // 4. Analyze and optimize
      const analysis = performanceOptimizer.analyzePerformance();
      expect(analysis.bottlenecks.length).toBeGreaterThan(0);
      expect(analysis.recommendations.length).toBeGreaterThan(0);

      // 5. Check system health
      const perfStats = performanceMonitor.getStats();
      expect(perfStats.health.score).toBeLessThan(100);

      const resourceStatus = resourceManager.getStatus();
      expect(resourceStatus.degraded_mode).toBe(true);

      const budgetStatus = tokenBudgetManager.getBudgetStatus();
      // Emergency mode should be enabled when budget is exceeded (850/1000 = 85%)
      expect(budgetStatus.daily.usageRate).toBeGreaterThan(0.8);
    });

    test('should provide comprehensive system report', () => {
      // Record various metrics
      performanceMonitor.recordLocalProcessing({
        ckb_id: 'ckb_001',
        total_time: 800
      });

      tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 1000
      });

      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc_001',
        processing_time_ms: 3000,
        token_usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500
        }
      });

      // Get comprehensive reports
      const perfDashboard = performanceMonitor.getDashboardMetrics();
      const budgetStatus = tokenBudgetManager.getBudgetStatus();
      const costReport = costBenefitAnalyzer.getComprehensiveReport();
      const resourceStatus = resourceManager.getStatus();

      // Verify all reports are available
      expect(perfDashboard).toHaveProperty('health');
      expect(budgetStatus).toHaveProperty('daily');
      expect(costReport).toHaveProperty('analysis');
      expect(resourceStatus).toHaveProperty('overall_health');
    });
  });

  describe('Cross-Module Integration', () => {
    test('should coordinate between performance monitor and optimizer', () => {
      // Create performance issue
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordLocalProcessing({
          ckb_id: `ckb_${i}`,
          total_time: 1500
        });
      }

      // Optimizer should detect issue
      const analysis = performanceOptimizer.analyzePerformance();
      expect(analysis.bottlenecks.length).toBeGreaterThan(0);

      // Apply optimization
      const result = performanceOptimizer.applyOptimization('CLEAR_OLD_METRICS');
      expect(result.applied).toBe(true);
    });

    test('should coordinate between budget manager and cost analyzer', async () => {
      // Record Token usage
      await tokenBudgetManager.recordUsage({
        module: 'test',
        operation: 'test',
        tokens: 1500,
        doc_id: 'doc_001'
      });

      // Record cost metrics
      costBenefitAnalyzer.recordDocumentMetrics({
        doc_id: 'doc_001',
        processing_time_ms: 3000,
        token_usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500
        }
      });

      // Both should track the same document
      const budgetStatus = tokenBudgetManager.getBudgetStatus();
      const costStats = costBenefitAnalyzer.getAverageTokenCost();

      expect(budgetStatus.documentCount).toBe(1);
      expect(costStats.document_count).toBe(1);
    });

    test('should coordinate between resource manager and performance optimizer', () => {
      // Trigger resource issues
      resourceManager.recordQueueSize(105);

      // Optimizer should consider resource state
      const analysis = performanceOptimizer.analyzePerformance();
      const resourceStatus = resourceManager.getStatus();

      expect(resourceStatus.degraded_mode).toBe(true);
      expect(resourceStatus.overall_health).toBe(false);
    });
  });
});
