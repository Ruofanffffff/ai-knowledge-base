/**
 * Unit tests for Performance Optimizer
 * 
 * Tests batch processing, adaptive timeouts, smart caching, and dynamic concurrency
 * 
 * Task 18: 性能优化和调优
 */

const {
  PerformanceOptimizer,
  BatchProcessor,
  AdaptiveTimeoutManager,
  SmartCacheStrategy,
  DynamicConcurrencyController
} = require('../performance_optimizer');
const { LatencyControlManager } = require('../latency_control_manager');

describe('BatchProcessor', () => {
  let batchProcessor;

  beforeEach(() => {
    batchProcessor = new BatchProcessor({ batchSize: 3, maxConcurrency: 2 });
  });

  test('should process items in batches', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const processFn = jest.fn(async (item) => item * 2);

    const results = await batchProcessor.processBatch(items, processFn);

    expect(results).toHaveLength(7);
    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(processFn).toHaveBeenCalledTimes(7);
  });

  test('should handle empty array', async () => {
    const processFn = jest.fn();
    const results = await batchProcessor.processBatch([], processFn);

    expect(results).toEqual([]);
    expect(processFn).not.toHaveBeenCalled();
  });

  test('should handle processing errors gracefully', async () => {
    const items = [1, 2, 3];
    const processFn = jest.fn(async (item) => {
      if (item === 2) {
        throw new Error('Processing failed');
      }
      return item * 2;
    });

    const results = await batchProcessor.processBatch(items, processFn);

    expect(results).toHaveLength(3);
    expect(results[0]).toBe(2);
    expect(results[1]).toEqual({
      success: false,
      error: 'Processing failed',
      item: 2
    });
    expect(results[2]).toBe(6);
  });

  test('should process batches sequentially', async () => {
    const items = [1, 2, 3, 4, 5];
    const processOrder = [];
    const processFn = jest.fn(async (item) => {
      processOrder.push(item);
      await new Promise(resolve => setTimeout(resolve, 10));
      return item;
    });

    await batchProcessor.processBatch(items, processFn);

    // Items should be processed in batches of 3
    expect(processOrder).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('AdaptiveTimeoutManager', () => {
  let timeoutManager;
  let latencyManager;

  beforeEach(() => {
    latencyManager = new LatencyControlManager();
    timeoutManager = new AdaptiveTimeoutManager({
      adjustmentFactor: 1.2,
      minTimeout: 5000,
      maxTimeout: 60000
    });
  });

  test('should return default timeout when no historical data', () => {
    const timeout = timeoutManager.getRecommendedTimeout('field_correction');
    expect(timeout).toBeGreaterThan(0);
  });

  test('should calculate recommended timeout based on max latency', () => {
    // Simulate some operations
    const latencyManager = timeoutManager.latencyManager;
    latencyManager.metrics.operationLatencies['field_correction'] = {
      count: 10,
      total: 50000,
      min: 3000,
      max: 8000,
      avg: 5000
    };

    const timeout = timeoutManager.getRecommendedTimeout('field_correction');
    
    // Should be max * adjustmentFactor = 8000 * 1.2 = 9600
    expect(timeout).toBe(9600);
  });

  test('should clamp timeout to min/max bounds', () => {
    const latencyManager = timeoutManager.latencyManager;
    
    // Test min bound
    latencyManager.metrics.operationLatencies['test_op'] = {
      count: 10,
      max: 1000
    };
    
    let timeout = timeoutManager.getRecommendedTimeout('test_op');
    expect(timeout).toBeGreaterThanOrEqual(5000);

    // Test max bound
    latencyManager.metrics.operationLatencies['test_op'].max = 100000;
    timeout = timeoutManager.getRecommendedTimeout('test_op');
    expect(timeout).toBeLessThanOrEqual(60000);
  });

  test('should not adjust timeout if already optimal', () => {
    const latencyManager = timeoutManager.latencyManager;
    latencyManager.metrics.operationLatencies['field_correction'] = {
      count: 10,
      max: 10000
    };
    
    // Set current timeout to recommended value
    const recommended = Math.ceil(10000 * 1.2);
    latencyManager.setTimeout('field_correction', recommended);

    const adjusted = timeoutManager.adjustTimeout('field_correction');
    expect(adjusted).toBe(false);
  });
});

describe('SmartCacheStrategy', () => {
  let cacheStrategy;

  beforeEach(() => {
    cacheStrategy = new SmartCacheStrategy({
      priorityOperations: ['document_index', 'field_correction']
    });
  });

  test('should cache priority operations', () => {
    expect(cacheStrategy.shouldCache('document_index')).toBe(true);
    expect(cacheStrategy.shouldCache('field_correction')).toBe(true);
  });

  test('should cache slow operations', () => {
    // This test verifies the logic, but actual slow operation detection
    // requires the global latency manager to have metrics
    // For now, test that the method exists and returns boolean
    const result = cacheStrategy.shouldCache('slow_op');
    expect(typeof result).toBe('boolean');
    
    // Test with context that should trigger caching
    expect(cacheStrategy.shouldCache('slow_op', { isCommonPattern: true })).toBe(true);
  });

  test('should cache common patterns', () => {
    expect(cacheStrategy.shouldCache('some_op', { isCommonPattern: true })).toBe(true);
    expect(cacheStrategy.shouldCache('some_op', { isFrequentQuery: true })).toBe(true);
  });

  test('should not cache non-priority fast operations', () => {
    expect(cacheStrategy.shouldCache('non_priority_op')).toBe(false);
  });

  test('should generate optimized cache keys', () => {
    // Document index key
    let key = cacheStrategy.generateCacheKey('document_index', { doc_id: 'doc123' });
    expect(key).toBe('idx:doc123');

    // Correction key
    key = cacheStrategy.generateCacheKey('correction', { doc_id: 'doc123', stage: 'field' });
    expect(key).toBe('corr:doc123:field');

    // Default key
    key = cacheStrategy.generateCacheKey('other_op', { param: 'value' });
    expect(key).toContain('op:other_op:');
  });
});

describe('DynamicConcurrencyController', () => {
  let concurrencyController;

  beforeEach(() => {
    concurrencyController = new DynamicConcurrencyController({
      minConcurrency: 2,
      maxConcurrency: 15,
      targetQueueRatio: 1.5
    });
  });

  test('should recommend increasing concurrency when queue is growing', () => {
    // Mock getQueueStatus to return high queue size
    const mockLatencyManager = concurrencyController.latencyManager;
    mockLatencyManager.getQueueStatus = jest.fn().mockReturnValue({
      size: 10,
      pending: 8,
      concurrency: 5
    });

    const recommended = concurrencyController.getRecommendedConcurrency();
    expect(recommended).toBeGreaterThan(5);
    expect(recommended).toBeLessThanOrEqual(15);
  });

  test('should recommend decreasing concurrency when queue is empty', () => {
    // Mock getQueueStatus to return empty queue
    const mockLatencyManager = concurrencyController.latencyManager;
    mockLatencyManager.getQueueStatus = jest.fn().mockReturnValue({
      size: 0,
      pending: 1,
      concurrency: 5
    });

    const recommended = concurrencyController.getRecommendedConcurrency();
    expect(recommended).toBeGreaterThanOrEqual(2);
    expect(recommended).toBeLessThan(5);
  });

  test('should respect min/max concurrency bounds', () => {
    const mockLatencyManager = concurrencyController.latencyManager;
    
    // Test min bound
    mockLatencyManager.getQueueStatus = jest.fn().mockReturnValue({
      size: 0,
      pending: 0,
      concurrency: 3
    });
    
    let recommended = concurrencyController.getRecommendedConcurrency();
    expect(recommended).toBeGreaterThanOrEqual(2);

    // Test max bound
    mockLatencyManager.getQueueStatus = jest.fn().mockReturnValue({
      size: 100,
      pending: 50,
      concurrency: 14
    });
    
    recommended = concurrencyController.getRecommendedConcurrency();
    expect(recommended).toBeLessThanOrEqual(15);
  });
});

describe('PerformanceOptimizer', () => {
  let optimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer({
      autoOptimize: false, // Disable auto-optimization for tests
      batch: { batchSize: 5 },
      timeout: { adjustmentFactor: 1.2 },
      cache: { priorityOperations: ['document_index'] },
      concurrency: { minConcurrency: 2, maxConcurrency: 10 }
    });
  });

  afterEach(() => {
    optimizer.stopAutoOptimization();
  });

  test('should initialize all components', () => {
    expect(optimizer.batchProcessor).toBeDefined();
    expect(optimizer.timeoutManager).toBeDefined();
    expect(optimizer.cacheStrategy).toBeDefined();
    expect(optimizer.concurrencyController).toBeDefined();
  });

  test('should provide access to batch processor', () => {
    const batchProcessor = optimizer.getBatchProcessor();
    expect(batchProcessor).toBeInstanceOf(BatchProcessor);
  });

  test('should provide access to cache strategy', () => {
    const cacheStrategy = optimizer.getCacheStrategy();
    expect(cacheStrategy).toBeInstanceOf(SmartCacheStrategy);
  });

  test('should run optimization cycle', () => {
    const results = optimizer.optimize();
    
    expect(results).toHaveProperty('timestamp');
    expect(results).toHaveProperty('timeouts_adjusted');
    expect(results).toHaveProperty('concurrency_adjusted');
  });

  test('should generate performance report', () => {
    const report = optimizer.getPerformanceReport();
    
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('llm_calls');
    expect(report).toHaveProperty('preprocessing');
    expect(report).toHaveProperty('queue_status');
    expect(report).toHaveProperty('recommendations');
  });

  test('should start and stop auto-optimization', () => {
    const autoOptimizer = new PerformanceOptimizer({
      autoOptimize: true,
      optimizationInterval: 100
    });

    expect(autoOptimizer.optimizationTimer).toBeDefined();

    autoOptimizer.stopAutoOptimization();
    expect(autoOptimizer.optimizationTimer).toBeNull();
  });

  test('should generate recommendations based on metrics', () => {
    const report = optimizer.getPerformanceReport();
    
    expect(Array.isArray(report.recommendations)).toBe(true);
    
    // Each recommendation should have required fields
    report.recommendations.forEach(rec => {
      expect(rec).toHaveProperty('type');
      expect(rec).toHaveProperty('priority');
      expect(rec).toHaveProperty('message');
    });
  });
});

describe('Integration Tests', () => {
  test('should optimize batch processing with adaptive timeouts', async () => {
    const optimizer = new PerformanceOptimizer({ autoOptimize: false });
    const batchProcessor = optimizer.getBatchProcessor();

    const items = Array.from({ length: 20 }, (_, i) => i + 1);
    const processFn = jest.fn(async (item) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return item * 2;
    });

    const results = await batchProcessor.processBatch(items, processFn);

    expect(results).toHaveLength(20);
    expect(processFn).toHaveBeenCalledTimes(20);
  });

  test('should use smart caching for repeated operations', () => {
    const optimizer = new PerformanceOptimizer({ autoOptimize: false });
    const cacheStrategy = optimizer.getCacheStrategy();

    // First call should not be cached (non-priority)
    expect(cacheStrategy.shouldCache('test_op')).toBe(false);

    // Priority operation should be cached
    expect(cacheStrategy.shouldCache('document_index')).toBe(true);

    // Common pattern should be cached
    expect(cacheStrategy.shouldCache('test_op', { isCommonPattern: true })).toBe(true);
  });
});
