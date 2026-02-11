/**
 * Property-Based Tests for LLMCacheWrapper
 * 
 * Feature: llm-enhanced-entity-extraction
 * Property 8: Cache Effectiveness
 * Validates: Requirements 5.1
 * 
 * Tests that cache effectively reduces LLM calls and processing time
 */

const fc = require('fast-check');
const { LLMCacheWrapper } = require('./llm_cache_wrapper');
const llmCache = require('../utils/llm_cache');

// Mock the llm_cache module
jest.mock('../utils/llm_cache');

describe('Property 8: Cache Effectiveness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock cache with realistic behavior
    const mockCache = new Map();
    
    llmCache.configure = jest.fn();
    
    llmCache.get = jest.fn((prompt, options) => {
      const key = JSON.stringify({ prompt, options });
      return mockCache.get(key) || null;
    });
    
    llmCache.set = jest.fn((prompt, options, response, ttl, tags) => {
      const key = JSON.stringify({ prompt, options });
      mockCache.set(key, response);
      return key;
    });
    
    llmCache.has = jest.fn((prompt, options) => {
      const key = JSON.stringify({ prompt, options });
      return mockCache.has(key);
    });
    
    llmCache.clear = jest.fn(() => {
      const size = mockCache.size;
      mockCache.clear();
      return size;
    });
    
    llmCache.getStats = jest.fn(() => ({
      hits: 0,
      misses: 0,
      hit_rate: 0
    }));
  });

  /**
   * Property: For any identical input processed twice, the second processing
   * should use cached results, resulting in zero LLM calls and significantly
   * reduced processing time.
   */
  it('should use cache on second call with identical input', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }), // prompt
        fc.record({
          model: fc.constantFrom('qwen-turbo', 'qwen-plus', 'qwen-max'),
          temperature: fc.double({ min: 0, max: 1 })
        }), // options
        async (prompt, options) => {
          const wrapper = new LLMCacheWrapper({ enabled: true });
          
          let llmCallCount = 0;
          const mockLLMFunction = jest.fn(async (p, o) => {
            llmCallCount++;
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 10));
            return {
              content: `Response to: ${p}`,
              tokens: 100,
              processingTime: 10
            };
          });

          // First call - should call LLM
          const startTime1 = Date.now();
          const result1 = await wrapper.cachedCall(mockLLMFunction, prompt, options);
          const time1 = Date.now() - startTime1;

          // Second call - should use cache
          const startTime2 = Date.now();
          const result2 = await wrapper.cachedCall(mockLLMFunction, prompt, options);
          const time2 = Date.now() - startTime2;

          // Assertions
          expect(llmCallCount).toBe(1); // LLM called only once
          expect(result1._cached).toBe(false); // First call not cached
          expect(result2._cached).toBe(true); // Second call cached
          expect(result1.content).toBe(result2.content); // Same content
          expect(time2).toBeLessThan(time1); // Second call faster
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Cache should distinguish between different prompts
   */
  it('should not return cached result for different prompts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.string({ minLength: 10, maxLength: 100 }),
        async (prompt1, prompt2) => {
          // Skip if prompts are identical or too similar
          fc.pre(prompt1 !== prompt2 && prompt1.trim() !== prompt2.trim());

          const wrapper = new LLMCacheWrapper({ enabled: true });
          
          let callCount = 0;
          const mockLLMFunction = jest.fn(async (p) => {
            callCount++;
            return {
              content: `Response ${callCount} to: ${p}`,
              tokens: 100
            };
          });

          // Call with first prompt
          const result1 = await wrapper.cachedCall(mockLLMFunction, prompt1);
          
          // Call with second prompt
          const result2 = await wrapper.cachedCall(mockLLMFunction, prompt2);

          // Both should call LLM (no cache hit)
          expect(callCount).toBe(2);
          expect(result1._cached).toBe(false);
          expect(result2._cached).toBe(false);
          expect(result1.content).not.toBe(result2.content);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Cache should distinguish between different options
   */
  it('should not return cached result for different options', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.double({ min: 0, max: 1 }),
        fc.double({ min: 0, max: 1 }),
        async (prompt, temp1, temp2) => {
          // Skip if temperatures are too similar
          fc.pre(Math.abs(temp1 - temp2) > 0.1);

          const wrapper = new LLMCacheWrapper({ enabled: true });
          
          let callCount = 0;
          const mockLLMFunction = jest.fn(async () => {
            callCount++;
            return {
              content: `Response ${callCount}`,
              tokens: 100
            };
          });

          // Call with first temperature
          const result1 = await wrapper.cachedCall(
            mockLLMFunction,
            prompt,
            { temperature: temp1 }
          );
          
          // Call with second temperature
          const result2 = await wrapper.cachedCall(
            mockLLMFunction,
            prompt,
            { temperature: temp2 }
          );

          // Both should call LLM (different options)
          expect(callCount).toBe(2);
          expect(result1._cached).toBe(false);
          expect(result2._cached).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Disabled cache should always call LLM
   */
  it('should always call LLM when cache is disabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.nat({ max: 5 }), // number of calls
        async (prompt, numCalls) => {
          fc.pre(numCalls > 0);

          const wrapper = new LLMCacheWrapper({ enabled: false });
          
          let callCount = 0;
          const mockLLMFunction = jest.fn(async () => {
            callCount++;
            return {
              content: `Response ${callCount}`,
              tokens: 100
            };
          });

          // Make multiple calls with same prompt
          for (let i = 0; i < numCalls; i++) {
            await wrapper.cachedCall(mockLLMFunction, prompt);
          }

          // Should call LLM every time
          expect(callCount).toBe(numCalls);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Cache hit should preserve response data
   */
  it('should preserve all response data on cache hit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.record({
          content: fc.string(),
          tokens: fc.nat({ max: 10000 }),
          inputTokens: fc.nat({ max: 5000 }),
          outputTokens: fc.nat({ max: 5000 }),
          model: fc.constantFrom('qwen-turbo', 'qwen-plus')
        }),
        async (prompt, mockResponse) => {
          const wrapper = new LLMCacheWrapper({ enabled: true });
          
          const mockLLMFunction = jest.fn(async () => mockResponse);

          // First call
          const result1 = await wrapper.cachedCall(mockLLMFunction, prompt);
          
          // Second call (cached)
          const result2 = await wrapper.cachedCall(mockLLMFunction, prompt);

          // All fields should be preserved
          expect(result2.content).toBe(result1.content);
          expect(result2.tokens).toBe(result1.tokens);
          expect(result2.inputTokens).toBe(result1.inputTokens);
          expect(result2.outputTokens).toBe(result1.outputTokens);
          expect(result2.model).toBe(result1.model);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Cache invalidation should force new LLM call
   */
  it('should call LLM again after cache invalidation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        async (prompt) => {
          const wrapper = new LLMCacheWrapper({ enabled: true });
          
          let callCount = 0;
          const mockLLMFunction = jest.fn(async () => {
            callCount++;
            return {
              content: `Response ${callCount}`,
              tokens: 100
            };
          });

          // First call
          await wrapper.cachedCall(mockLLMFunction, prompt);
          expect(callCount).toBe(1);

          // Second call (cached)
          await wrapper.cachedCall(mockLLMFunction, prompt);
          expect(callCount).toBe(1); // Still 1

          // Clear cache
          wrapper.clear();

          // Third call (should call LLM again)
          await wrapper.cachedCall(mockLLMFunction, prompt);
          expect(callCount).toBe(2); // Now 2
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Multiple identical calls should only call LLM once
   */
  it('should call LLM only once for multiple identical calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 2, max: 10 }), // number of identical calls
        async (prompt, numCalls) => {
          fc.pre(numCalls >= 2 && prompt.trim().length > 0); // Ensure valid inputs
          
          const wrapper = new LLMCacheWrapper({ enabled: true });
          
          let callCount = 0;
          const mockLLMFunction = jest.fn(async () => {
            callCount++;
            return {
              content: `Response`,
              tokens: 100
            };
          });

          // Make multiple identical calls
          const results = [];
          for (let i = 0; i < numCalls; i++) {
            results.push(await wrapper.cachedCall(mockLLMFunction, prompt));
          }

          // Should only call LLM once
          expect(callCount).toBe(1);
          
          // First result not cached, rest are cached
          expect(results[0]._cached).toBe(false);
          for (let i = 1; i < numCalls; i++) {
            expect(results[i]._cached).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
