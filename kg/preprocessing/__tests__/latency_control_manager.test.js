/**
 * Unit Tests for Latency Control Manager
 * 
 * Tests:
 * - Timeout control
 * - Concurrency control
 * - Cache mechanism
 * - Smart triggering logic
 * - Performance metrics
 * 
 * Requirements: 9.3
 */

const { LatencyControlManager, LRUCache } = require('../latency_control_manager');

describe('LRUCache', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache(3, 1000); // 最大3项，1秒TTL
  });

  test('should store and retrieve values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  test('should return null for non-existent keys', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  test('should evict oldest item when cache is full', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    cache.set('key4', 'value4'); // 应该驱逐key1

    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBe('value2');
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  test('should update access order on get', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    
    // 访问key1，使其成为最近使用
    cache.get('key1');
    
    // 添加key4，应该驱逐key2（最久未使用）
    cache.set('key4', 'value4');

    expect(cache.get('key1')).toBe('value1');
    expect(cache.get('key2')).toBeNull();
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  test('should expire items after TTL', async () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');

    // 等待超过TTL
    await new Promise(resolve => setTimeout(resolve, 1100));

    expect(cache.get('key1')).toBeNull();
  });

  test('should clear all items', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    
    cache.clear();
    
    expect(cache.size()).toBe(0);
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBeNull();
  });

  test('should report correct size', () => {
    expect(cache.size()).toBe(0);
    
    cache.set('key1', 'value1');
    expect(cache.size()).toBe(1);
    
    cache.set('key2', 'value2');
    expect(cache.size()).toBe(2);
  });
});

describe('LatencyControlManager', () => {
  let manager;
  let mockLLMClient;

  beforeEach(() => {
    manager = new LatencyControlManager({
      maxConcurrency: 2,
      cacheEnabled: true,
      cacheMaxSize: 10,
      cacheTTL: 1000,
      queueTimeout: 5000 // 5秒队列超时用于测试
    });

    mockLLMClient = {
      chat: jest.fn()
    };
  });

  afterEach(() => {
    manager.clearCache();
    manager.resetMetrics();
  });

  describe('Timeout Control', () => {
    test('should complete successfully within timeout', async () => {
      mockLLMClient.chat.mockResolvedValue({
        content: 'LLM response'
      });

      const response = await manager.callLLM(mockLLMClient, 'test prompt', {
        operation: 'field_correction'
      });

      expect(response).toBe('LLM response');
      
      const metrics = manager.getMetrics();
      expect(metrics.successCalls).toBe(1);
      expect(metrics.timeoutCalls).toBe(0);
    });

    test('should handle LLM errors', async () => {
      mockLLMClient.chat.mockRejectedValue(new Error('LLM error'));

      await expect(
        manager.callLLM(mockLLMClient, 'test prompt', {
          operation: 'field_correction'
        })
      ).rejects.toThrow('LLM error');

      const metrics = manager.getMetrics();
      expect(metrics.failedCalls).toBe(1);
    });

    test('should use configured timeout for operations', () => {
      expect(manager.getTimeout('field_correction')).toBe(15000);
      expect(manager.getTimeout('document_index')).toBe(30000);
      
      manager.setTimeout('custom_operation', 5000);
      expect(manager.getTimeout('custom_operation')).toBe(5000);
    });
  });

  describe('Concurrency Control', () => {
    test('should limit concurrent LLM calls', async () => {
      let concurrentCalls = 0;
      let maxConcurrentCalls = 0;

      mockLLMClient.chat.mockImplementation(async () => {
        concurrentCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        concurrentCalls--;
        return { content: 'response' };
      });

      // 启动5个并发调用，但最大并发应该是2
      const promises = Array(5).fill(null).map((_, i) => 
        manager.callLLM(mockLLMClient, `prompt ${i}`, {
          operation: 'field_correction',
          enableCache: false // 禁用缓存以确保每次都调用
        })
      );

      await Promise.all(promises);

      expect(maxConcurrentCalls).toBeLessThanOrEqual(2);
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(5);
    });

    test('should report queue status', async () => {
      mockLLMClient.chat.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { content: 'response' };
      });

      // 启动多个调用
      const promises = Array(5).fill(null).map((_, i) => 
        manager.callLLM(mockLLMClient, `prompt ${i}`, {
          operation: 'field_correction',
          enableCache: false
        })
      );

      // 检查队列状态
      await new Promise(resolve => setTimeout(resolve, 10));
      const status = manager.getQueueStatus();
      
      expect(status.concurrency).toBe(2);
      expect(status.size + status.pending).toBeGreaterThan(0);

      await Promise.all(promises);
    });
  });

  describe('Cache Mechanism', () => {
    test('should cache LLM responses', async () => {
      mockLLMClient.chat.mockResolvedValue({
        content: 'cached response'
      });

      // 第一次调用
      const response1 = await manager.callLLM(mockLLMClient, 'test prompt', {
        operation: 'field_correction'
      });

      // 第二次调用相同的prompt
      const response2 = await manager.callLLM(mockLLMClient, 'test prompt', {
        operation: 'field_correction'
      });

      expect(response1).toBe('cached response');
      expect(response2).toBe('cached response');
      
      // LLM应该只被调用一次
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(1);

      const metrics = manager.getMetrics();
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.cacheMisses).toBe(1);
    });

    test('should not cache when cache is disabled', async () => {
      mockLLMClient.chat.mockResolvedValue({
        content: 'response'
      });

      // 第一次调用
      await manager.callLLM(mockLLMClient, 'test prompt', {
        operation: 'field_correction',
        enableCache: false
      });

      // 第二次调用
      await manager.callLLM(mockLLMClient, 'test prompt', {
        operation: 'field_correction',
        enableCache: false
      });

      // LLM应该被调用两次
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(2);
    });

    test('should use custom cache key', async () => {
      mockLLMClient.chat.mockResolvedValue({
        content: 'response'
      });

      // 使用自定义缓存键
      await manager.callLLM(mockLLMClient, 'prompt 1', {
        operation: 'field_correction',
        cacheKey: 'custom_key'
      });

      // 使用相同的缓存键但不同的prompt
      await manager.callLLM(mockLLMClient, 'prompt 2', {
        operation: 'field_correction',
        cacheKey: 'custom_key'
      });

      // 应该命中缓存
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(1);
    });

    test('should clear cache', async () => {
      mockLLMClient.chat.mockResolvedValue({
        content: 'response'
      });

      await manager.callLLM(mockLLMClient, 'test prompt', {
        operation: 'field_correction'
      });

      manager.clearCache();

      await manager.callLLM(mockLLMClient, 'test prompt', {
        operation: 'field_correction'
      });

      // 清空缓存后应该再次调用LLM
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(2);
    });
  });

  describe('Smart Triggering', () => {
    test('should trigger field correction when coverage is low', () => {
      expect(manager.shouldTriggerFieldCorrection({
        coverageRate: 0.7,
        extractedFieldsCount: 5
      })).toBe(true);

      expect(manager.shouldTriggerFieldCorrection({
        coverageRate: 0.9,
        extractedFieldsCount: 5
      })).toBe(false);
    });

    test('should trigger field correction when few fields extracted', () => {
      expect(manager.shouldTriggerFieldCorrection({
        extractedFieldsCount: 2
      })).toBe(true);

      expect(manager.shouldTriggerFieldCorrection({
        extractedFieldsCount: 5
      })).toBe(false);
    });

    test('should trigger schema correction when confidence is low', () => {
      expect(manager.shouldTriggerSchemaCorrection({
        confidence: 0.7
      })).toBe(true);

      expect(manager.shouldTriggerSchemaCorrection({
        confidence: 0.8
      })).toBe(false);
    });

    test('should trigger schema correction when required fields missing', () => {
      expect(manager.shouldTriggerSchemaCorrection({
        confidence: 0.9,
        missingRequiredFields: ['field1']
      })).toBe(true);

      expect(manager.shouldTriggerSchemaCorrection({
        confidence: 0.9,
        missingRequiredFields: []
      })).toBe(false);
    });

    test('should trigger merge correction when conflict exists', () => {
      expect(manager.shouldTriggerMergeCorrection({
        hasConflict: true
      })).toBe(true);

      expect(manager.shouldTriggerMergeCorrection({
        hasConflict: false
      })).toBe(false);
    });

    test('should trigger merge correction when entity types mismatch', () => {
      expect(manager.shouldTriggerMergeCorrection({
        entityTypeMismatch: true
      })).toBe(true);
    });

    test('should trigger relation correction when coverage is low', () => {
      expect(manager.shouldTriggerRelationCorrection({
        coverageRate: 0.6
      })).toBe(true);

      expect(manager.shouldTriggerRelationCorrection({
        coverageRate: 0.8
      })).toBe(false);
    });

    test('should trigger relation correction when few relations for many entities', () => {
      expect(manager.shouldTriggerRelationCorrection({
        entityCount: 10,
        relationCount: 3
      })).toBe(true);

      expect(manager.shouldTriggerRelationCorrection({
        entityCount: 10,
        relationCount: 8
      })).toBe(false);
    });
  });

  describe('Performance Metrics', () => {
    test('should track successful calls', async () => {
      mockLLMClient.chat.mockResolvedValue({
        content: 'response'
      });

      await manager.callLLM(mockLLMClient, 'prompt 1', {
        operation: 'field_correction',
        enableCache: false
      });

      await manager.callLLM(mockLLMClient, 'prompt 2', {
        operation: 'schema_correction',
        enableCache: false
      });

      const metrics = manager.getMetrics();
      expect(metrics.totalCalls).toBe(2);
      expect(metrics.successCalls).toBe(2);
      expect(metrics.failedCalls).toBe(0);
    });

    test('should track failed calls', async () => {
      mockLLMClient.chat.mockRejectedValue(new Error('LLM error'));

      await expect(
        manager.callLLM(mockLLMClient, 'test prompt', {
          operation: 'field_correction'
        })
      ).rejects.toThrow('LLM error');

      const metrics = manager.getMetrics();
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.successCalls).toBe(0);
      expect(metrics.failedCalls).toBe(1);
    });

    test('should track operation latencies', async () => {
      mockLLMClient.chat.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { content: 'response' };
      });

      await manager.callLLM(mockLLMClient, 'prompt 1', {
        operation: 'field_correction',
        enableCache: false
      });

      await manager.callLLM(mockLLMClient, 'prompt 2', {
        operation: 'field_correction',
        enableCache: false
      });

      const metrics = manager.getMetrics();
      expect(metrics.operationLatencies.field_correction).toBeDefined();
      expect(metrics.operationLatencies.field_correction.count).toBe(2);
      expect(metrics.operationLatencies.field_correction.avg).toBeGreaterThan(40);
    });

    test('should calculate success rate', async () => {
      mockLLMClient.chat
        .mockResolvedValueOnce({ content: 'response 1' })
        .mockRejectedValueOnce(new Error('error'))
        .mockResolvedValueOnce({ content: 'response 2' });

      await manager.callLLM(mockLLMClient, 'prompt 1', {
        operation: 'field_correction',
        enableCache: false
      });

      try {
        await manager.callLLM(mockLLMClient, 'prompt 2', {
          operation: 'field_correction',
          enableCache: false
        });
      } catch (e) {
        // Expected
      }

      await manager.callLLM(mockLLMClient, 'prompt 3', {
        operation: 'field_correction',
        enableCache: false
      });

      const metrics = manager.getMetrics();
      expect(metrics.successRate).toBe('66.67%');
    });

    test('should reset metrics', async () => {
      mockLLMClient.chat.mockResolvedValue({
        content: 'response'
      });

      await manager.callLLM(mockLLMClient, 'test prompt', {
        operation: 'field_correction'
      });

      manager.resetMetrics();

      const metrics = manager.getMetrics();
      expect(metrics.totalCalls).toBe(0);
      expect(metrics.successCalls).toBe(0);
      expect(metrics.cacheHits).toBe(0);
    });
  });

  describe('Configuration', () => {
    test('should get timeout for operation', () => {
      expect(manager.getTimeout('field_correction')).toBe(15000);
      expect(manager.getTimeout('unknown_operation')).toBe(15000);
    });

    test('should set timeout for operation', () => {
      manager.setTimeout('custom_operation', 5000);
      expect(manager.getTimeout('custom_operation')).toBe(5000);
    });
  });
});
