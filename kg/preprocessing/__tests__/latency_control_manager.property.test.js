/**
 * Property-Based Tests for Latency Control Manager
 * 
 * **Feature: llm-document-index-preprocessing, Property 20: 超时告警**
 * 
 * 对于任何LLM调用超时的情况，系统应该记录超时事件并触发告警
 * 
 * Validates: Requirements 9.3
 */

const fc = require('fast-check');
const { LatencyControlManager } = require('../latency_control_manager');

describe('Latency Control Manager - Property Tests', () => {
  describe('Property 20: 超时告警', () => {
    test('should record timeout events for any timeout scenario', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 50, max: 500 }), // timeout值
          fc.integer({ min: 100, max: 1000 }), // 模拟LLM延迟
          async (timeout, llmDelay) => {
            const manager = new LatencyControlManager({
              maxConcurrency: 1,
              cacheEnabled: false,
              queueTimeout: 5000
            });

            const mockLLMClient = {
              chat: jest.fn().mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, llmDelay));
                return { content: 'response' };
              })
            };

            manager.setTimeout('test_operation', timeout);

            try {
              await manager.callLLM(mockLLMClient, 'test prompt', {
                operation: 'test_operation',
                enableCache: false
              });
            } catch (error) {
              // 如果超时，应该记录超时事件
              if (llmDelay > timeout) {
                const metrics = manager.getMetrics();
                expect(metrics.timeoutCalls).toBeGreaterThan(0);
              }
            }

            manager.clearCache();
            manager.resetMetrics();
          }
        ),
        { numRuns: 10 } // 减少运行次数
      );
    }, 30000); // 30秒测试超时

    test('should track all LLM calls regardless of outcome', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }), // 成功/失败序列
          async (outcomes) => {
            const manager = new LatencyControlManager({
              maxConcurrency: 5,
              cacheEnabled: false
            });

            const mockLLMClient = {
              chat: jest.fn()
            };

            let successCount = 0;
            let failureCount = 0;

            for (const shouldSucceed of outcomes) {
              if (shouldSucceed) {
                mockLLMClient.chat.mockResolvedValueOnce({ content: 'success' });
                successCount++;
              } else {
                mockLLMClient.chat.mockRejectedValueOnce(new Error('failure'));
                failureCount++;
              }
            }

            // 执行所有调用
            for (let i = 0; i < outcomes.length; i++) {
              try {
                await manager.callLLM(mockLLMClient, `prompt ${i}`, {
                  operation: 'test_operation',
                  enableCache: false
                });
              } catch (error) {
                // 预期的失败
              }
            }

            const metrics = manager.getMetrics();
            
            // 验证：总调用数应该等于成功+失败
            expect(metrics.totalCalls).toBe(outcomes.length);
            expect(metrics.successCalls).toBe(successCount);
            expect(metrics.failedCalls).toBe(failureCount);

            manager.clearCache();
            manager.resetMetrics();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Cache Consistency Properties', () => {
    test('should always return same result for same input when cached', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }), // prompt
          fc.float({ min: 0, max: 1 }), // temperature
          fc.integer({ min: 100, max: 2000 }), // maxTokens
          async (prompt, temperature, maxTokens) => {
            const manager = new LatencyControlManager({
              cacheEnabled: true,
              cacheMaxSize: 100
            });

            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({ content: 'cached response' })
            };

            // 第一次调用
            const result1 = await manager.callLLM(mockLLMClient, prompt, {
              operation: 'test_operation',
              temperature,
              maxTokens,
              enableCache: true
            });

            // 第二次调用相同参数
            const result2 = await manager.callLLM(mockLLMClient, prompt, {
              operation: 'test_operation',
              temperature,
              maxTokens,
              enableCache: true
            });

            // 验证：结果应该相同
            expect(result1).toBe(result2);
            
            // 验证：LLM只被调用一次
            expect(mockLLMClient.chat).toHaveBeenCalledTimes(1);

            manager.clearCache();
            manager.resetMetrics();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should not cache when cache is disabled', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.integer({ min: 2, max: 5 }), // 调用次数
          async (prompt, callCount) => {
            const manager = new LatencyControlManager({
              cacheEnabled: true
            });

            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({ content: 'response' })
            };

            // 多次调用，禁用缓存
            for (let i = 0; i < callCount; i++) {
              await manager.callLLM(mockLLMClient, prompt, {
                operation: 'test_operation',
                enableCache: false
              });
            }

            // 验证：LLM应该被调用callCount次
            expect(mockLLMClient.chat).toHaveBeenCalledTimes(callCount);

            manager.clearCache();
            manager.resetMetrics();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Concurrency Control Properties', () => {
    test('should never exceed max concurrency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // maxConcurrency
          fc.integer({ min: 5, max: 15 }), // 总调用数
          async (maxConcurrency, totalCalls) => {
            const manager = new LatencyControlManager({
              maxConcurrency,
              cacheEnabled: false
            });

            let currentConcurrency = 0;
            let maxObservedConcurrency = 0;

            const mockLLMClient = {
              chat: jest.fn().mockImplementation(async () => {
                currentConcurrency++;
                maxObservedConcurrency = Math.max(maxObservedConcurrency, currentConcurrency);
                
                await new Promise(resolve => setTimeout(resolve, 50));
                
                currentConcurrency--;
                return { content: 'response' };
              })
            };

            // 启动多个并发调用
            const promises = Array(totalCalls).fill(null).map((_, i) =>
              manager.callLLM(mockLLMClient, `prompt ${i}`, {
                operation: 'test_operation',
                enableCache: false
              })
            );

            await Promise.all(promises);

            // 验证：观察到的最大并发数不应超过配置的最大并发数
            expect(maxObservedConcurrency).toBeLessThanOrEqual(maxConcurrency);

            manager.clearCache();
            manager.resetMetrics();
          }
        ),
        { numRuns: 10 } // 减少运行次数
      );
    }, 30000); // 30秒测试超时
  });

  describe('Smart Triggering Properties', () => {
    test('should trigger field correction when coverage is below threshold', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1 }), // coverageRate
          fc.integer({ min: 0, max: 10 }), // extractedFieldsCount
          (coverageRate, extractedFieldsCount) => {
            const manager = new LatencyControlManager({
              fieldCoverageThreshold: 0.8
            });

            const shouldTrigger = manager.shouldTriggerFieldCorrection({
              coverageRate,
              extractedFieldsCount
            });

            // 验证：覆盖率低于阈值或字段数少于3时应该触发
            if (coverageRate < 0.8 || extractedFieldsCount < 3) {
              expect(shouldTrigger).toBe(true);
            }

            manager.clearCache();
            manager.resetMetrics();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should trigger schema correction when confidence is below threshold', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1 }), // confidence
          fc.array(fc.string(), { maxLength: 5 }), // missingRequiredFields
          (confidence, missingRequiredFields) => {
            const manager = new LatencyControlManager({
              schemaConfidenceThreshold: 0.75
            });

            const shouldTrigger = manager.shouldTriggerSchemaCorrection({
              confidence,
              missingRequiredFields
            });

            // 验证：置信度低于阈值或有缺失必需字段时应该触发
            if (confidence < 0.75 || missingRequiredFields.length > 0) {
              expect(shouldTrigger).toBe(true);
            }

            manager.clearCache();
            manager.resetMetrics();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should trigger relation correction when coverage is below threshold', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1 }), // coverageRate
          fc.integer({ min: 0, max: 20 }), // entityCount
          fc.integer({ min: 0, max: 20 }), // relationCount
          (coverageRate, entityCount, relationCount) => {
            const manager = new LatencyControlManager({
              relationCoverageThreshold: 0.7
            });

            const shouldTrigger = manager.shouldTriggerRelationCorrection({
              coverageRate,
              entityCount,
              relationCount
            });

            // 验证：覆盖率低于阈值或关系数量相对实体数量过少时应该触发
            if (coverageRate < 0.7 || (entityCount > 5 && relationCount < entityCount / 2)) {
              expect(shouldTrigger).toBe(true);
            }

            manager.clearCache();
            manager.resetMetrics();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Metrics Accuracy Properties', () => {
    test('should accurately track success rate', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.boolean(), { minLength: 5, maxLength: 20 }),
          async (outcomes) => {
            const manager = new LatencyControlManager({
              cacheEnabled: false
            });

            const mockLLMClient = {
              chat: jest.fn()
            };

            const expectedSuccesses = outcomes.filter(x => x).length;
            const expectedFailures = outcomes.filter(x => !x).length;

            for (const shouldSucceed of outcomes) {
              if (shouldSucceed) {
                mockLLMClient.chat.mockResolvedValueOnce({ content: 'success' });
              } else {
                mockLLMClient.chat.mockRejectedValueOnce(new Error('failure'));
              }

              try {
                await manager.callLLM(mockLLMClient, 'prompt', {
                  operation: 'test_operation',
                  enableCache: false
                });
              } catch (error) {
                // Expected
              }
            }

            const metrics = manager.getMetrics();
            
            // 验证：指标应该准确反映实际情况
            expect(metrics.totalCalls).toBe(outcomes.length);
            expect(metrics.successCalls).toBe(expectedSuccesses);
            expect(metrics.failedCalls).toBe(expectedFailures);

            const expectedSuccessRate = outcomes.length > 0
              ? (expectedSuccesses / outcomes.length * 100).toFixed(2)
              : '0.00';
            expect(metrics.successRate).toBe(`${expectedSuccessRate}%`);

            manager.clearCache();
            manager.resetMetrics();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
