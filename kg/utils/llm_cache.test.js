/**
 * Unit Tests for LLM Cache
 */

const llmCache = require('./llm_cache');

describe('LLM Cache', () => {
  beforeEach(() => {
    llmCache.clear();
    llmCache.configure({
      maxSize: 100,
      defaultTTL: 60000, // 1 minute for testing
      cleanupInterval: 10000,
      enableAutoCleanup: true,
      enableContentTracking: true
    });
  });

  afterAll(() => {
    llmCache.stopPeriodicCleanup();
  });

  describe('set and get', () => {
    it('should cache and retrieve LLM responses', () => {
      const prompt = 'What is the capital of France?';
      const response = { answer: 'Paris' };

      llmCache.set(prompt, {}, response);

      const cached = llmCache.get(prompt, {});

      expect(cached).toEqual(response);
    });

    it('should return null for cache miss', () => {
      const cached = llmCache.get('non-existent prompt', {});

      expect(cached).toBeNull();
    });

    it('should generate same key for same prompt and options', () => {
      const prompt = 'Test prompt';
      const options = { model: 'gpt-4', temperature: 0.7 };
      const response = { answer: 'Test' };

      llmCache.set(prompt, options, response);

      const cached = llmCache.get(prompt, options);

      expect(cached).toEqual(response);
    });

    it('should generate different keys for different options', () => {
      const prompt = 'Test prompt';
      const response1 = { answer: 'Test 1' };
      const response2 = { answer: 'Test 2' };

      llmCache.set(prompt, { temperature: 0.5 }, response1);
      llmCache.set(prompt, { temperature: 0.9 }, response2);

      const cached1 = llmCache.get(prompt, { temperature: 0.5 });
      const cached2 = llmCache.get(prompt, { temperature: 0.9 });

      expect(cached1).toEqual(response1);
      expect(cached2).toEqual(response2);
    });
  });

  describe('has', () => {
    it('should check if prompt is cached', () => {
      const prompt = 'Test prompt';
      const response = { answer: 'Test' };

      expect(llmCache.has(prompt)).toBe(false);

      llmCache.set(prompt, {}, response);

      expect(llmCache.has(prompt)).toBe(true);
    });
  });

  describe('invalidate', () => {
    it('should invalidate cache entry', () => {
      const prompt = 'Test prompt';
      const response = { answer: 'Test' };

      llmCache.set(prompt, {}, response);
      expect(llmCache.has(prompt)).toBe(true);

      llmCache.invalidate(prompt);
      expect(llmCache.has(prompt)).toBe(false);
    });
  });

  describe('invalidateBy', () => {
    it('should invalidate entries matching predicate', () => {
      llmCache.set('prompt1', {}, { answer: '1' });
      llmCache.set('prompt2', {}, { answer: '2' });
      llmCache.set('prompt3', {}, { answer: '3' });

      // Access prompt1 to increase hit count
      llmCache.get('prompt1');
      llmCache.get('prompt1');

      const count = llmCache.invalidateBy(entry => entry.hit_count === 0);

      expect(count).toBe(2); // prompt2 and prompt3
      expect(llmCache.has('prompt1')).toBe(true);
      expect(llmCache.has('prompt2')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', () => {
      llmCache.set('prompt1', {}, { answer: '1' });
      llmCache.set('prompt2', {}, { answer: '2' });

      const count = llmCache.clear();

      expect(count).toBe(2);
      expect(llmCache.has('prompt1')).toBe(false);
      expect(llmCache.has('prompt2')).toBe(false);
    });
  });

  describe('TTL and expiration', () => {
    it('should expire entries after TTL', async () => {
      const prompt = 'Test prompt';
      const response = { answer: 'Test' };

      llmCache.set(prompt, {}, response, 100); // 100ms TTL

      expect(llmCache.has(prompt)).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(llmCache.has(prompt)).toBe(false);
    });

    it('should return null for expired entries', async () => {
      const prompt = 'Test prompt';
      const response = { answer: 'Test' };

      llmCache.set(prompt, {}, response, 100);

      await new Promise(resolve => setTimeout(resolve, 150));

      const cached = llmCache.get(prompt);

      expect(cached).toBeNull();
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entry when cache is full', () => {
      llmCache.configure({ maxSize: 3 });

      llmCache.set('prompt1', {}, { answer: '1' });
      llmCache.set('prompt2', {}, { answer: '2' });
      llmCache.set('prompt3', {}, { answer: '3' });

      // Access prompt2 to make it more recently used
      llmCache.get('prompt2');

      // Add new entry, should evict prompt1 (least recently used)
      llmCache.set('prompt4', {}, { answer: '4' });

      expect(llmCache.has('prompt1')).toBe(false);
      expect(llmCache.has('prompt2')).toBe(true);
      expect(llmCache.has('prompt3')).toBe(true);
      expect(llmCache.has('prompt4')).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should clean up expired entries', async () => {
      llmCache.set('prompt1', {}, { answer: '1' }, 100);
      llmCache.set('prompt2', {}, { answer: '2' }, 100);
      llmCache.set('prompt3', {}, { answer: '3' }, 10000);

      await new Promise(resolve => setTimeout(resolve, 150));

      const cleaned = llmCache.cleanup();

      expect(cleaned).toBe(2);
      expect(llmCache.has('prompt1')).toBe(false);
      expect(llmCache.has('prompt2')).toBe(false);
      expect(llmCache.has('prompt3')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      llmCache.set('prompt1', {}, { answer: '1' });
      llmCache.set('prompt2', {}, { answer: '2' });

      llmCache.get('prompt1'); // Hit
      llmCache.get('prompt1'); // Hit
      llmCache.get('prompt3'); // Miss

      const stats = llmCache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hit_rate).toBeCloseTo(66.67, 1);
    });

    it('should track saved tokens', () => {
      const prompt = 'This is a test prompt with some content';
      llmCache.set(prompt, {}, { answer: 'Test' });

      llmCache.get(prompt); // Hit

      const stats = llmCache.getStats();

      expect(stats.total_saved_tokens).toBeGreaterThan(0);
    });
  });

  describe('getEntries', () => {
    it('should return cache entries info', () => {
      llmCache.set('prompt1', {}, { answer: '1' });
      llmCache.set('prompt2', {}, { answer: '2' });

      llmCache.get('prompt1');
      llmCache.get('prompt1');

      const entries = llmCache.getEntries();

      expect(Array.isArray(entries)).toBe(true);
      expect(entries).toHaveLength(2);
      expect(entries[0]).toHaveProperty('key');
      expect(entries[0]).toHaveProperty('hit_count');
      expect(entries[0]).toHaveProperty('created_at');

      // Should be sorted by hit count descending
      expect(entries[0].hit_count).toBeGreaterThanOrEqual(entries[1].hit_count);
    });
  });

  describe('cachedLLMCall', () => {
    it('should cache LLM function calls', async () => {
      const mockLLMFunction = jest.fn().mockResolvedValue({ answer: 'Paris' });

      const prompt = 'What is the capital of France?';

      // First call - should call LLM
      const result1 = await llmCache.cachedLLMCall(mockLLMFunction, prompt);
      expect(result1).toEqual({ answer: 'Paris' });
      expect(mockLLMFunction).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await llmCache.cachedLLMCall(mockLLMFunction, prompt);
      expect(result2).toEqual({ answer: 'Paris' });
      expect(mockLLMFunction).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('configure', () => {
    it('should update cache configuration', () => {
      llmCache.configure({
        maxSize: 500,
        defaultTTL: 120000
      });

      const config = llmCache.getConfig();

      expect(config.maxSize).toBe(500);
      expect(config.defaultTTL).toBe(120000);
    });

    it('should enable/disable auto cleanup', () => {
      llmCache.configure({ enableAutoCleanup: false });
      const config = llmCache.getConfig();
      expect(config.enableAutoCleanup).toBe(false);

      llmCache.configure({ enableAutoCleanup: true });
      const config2 = llmCache.getConfig();
      expect(config2.enableAutoCleanup).toBe(true);
    });

    it('should enable/disable content tracking', () => {
      llmCache.configure({ enableContentTracking: false });
      const config = llmCache.getConfig();
      expect(config.enableContentTracking).toBe(false);
    });
  });

  describe('invalidation strategies', () => {
    describe('invalidateByTags', () => {
      it('should invalidate entries by tags', () => {
        llmCache.set('prompt1', {}, { answer: '1' }, null, ['tag1', 'tag2']);
        llmCache.set('prompt2', {}, { answer: '2' }, null, ['tag2', 'tag3']);
        llmCache.set('prompt3', {}, { answer: '3' }, null, ['tag3']);

        const count = llmCache.invalidateByTags(['tag1']);

        expect(count).toBe(1);
        expect(llmCache.has('prompt1')).toBe(false);
        expect(llmCache.has('prompt2')).toBe(true);
        expect(llmCache.has('prompt3')).toBe(true);
      });

      it('should invalidate multiple entries with matching tags', () => {
        llmCache.set('prompt1', {}, { answer: '1' }, null, ['tag1']);
        llmCache.set('prompt2', {}, { answer: '2' }, null, ['tag1', 'tag2']);
        llmCache.set('prompt3', {}, { answer: '3' }, null, ['tag2']);

        const count = llmCache.invalidateByTags(['tag1', 'tag2']);

        expect(count).toBe(3);
        expect(llmCache.has('prompt1')).toBe(false);
        expect(llmCache.has('prompt2')).toBe(false);
        expect(llmCache.has('prompt3')).toBe(false);
      });

      it('should return 0 for empty tags', () => {
        llmCache.set('prompt1', {}, { answer: '1' });
        const count = llmCache.invalidateByTags([]);
        expect(count).toBe(0);
      });
    });

    describe('invalidateOlderThan', () => {
      it('should invalidate entries older than specified age', async () => {
        llmCache.set('prompt1', {}, { answer: '1' });
        
        await new Promise(resolve => setTimeout(resolve, 150));
        
        llmCache.set('prompt2', {}, { answer: '2' });

        const count = llmCache.invalidateOlderThan(100);

        expect(count).toBe(1);
        expect(llmCache.has('prompt1')).toBe(false);
        expect(llmCache.has('prompt2')).toBe(true);
      });
    });

    describe('invalidateIdle', () => {
      it('should invalidate entries not accessed recently', async () => {
        llmCache.set('prompt1', {}, { answer: '1' });
        llmCache.set('prompt2', {}, { answer: '2' });

        await new Promise(resolve => setTimeout(resolve, 150));

        // Access prompt2 to update last_accessed
        llmCache.get('prompt2');

        const count = llmCache.invalidateIdle(100);

        expect(count).toBe(1);
        expect(llmCache.has('prompt1')).toBe(false);
        expect(llmCache.has('prompt2')).toBe(true);
      });
    });

    describe('invalidateLowHitCount', () => {
      it('should invalidate entries with low hit count', () => {
        llmCache.set('prompt1', {}, { answer: '1' });
        llmCache.set('prompt2', {}, { answer: '2' });
        llmCache.set('prompt3', {}, { answer: '3' });

        // Access prompt1 multiple times
        llmCache.get('prompt1');
        llmCache.get('prompt1');
        llmCache.get('prompt1');

        // Access prompt2 once
        llmCache.get('prompt2');

        const count = llmCache.invalidateLowHitCount(2);

        expect(count).toBe(2); // prompt2 and prompt3
        expect(llmCache.has('prompt1')).toBe(true);
        expect(llmCache.has('prompt2')).toBe(false);
        expect(llmCache.has('prompt3')).toBe(false);
      });
    });

    describe('updateTTL', () => {
      it('should update TTL for matching entries', () => {
        llmCache.set('prompt1', {}, { answer: '1' }, 1000);
        llmCache.set('prompt2', {}, { answer: '2' }, 1000);

        const count = llmCache.updateTTL(
          entry => entry.value.answer === '1',
          10000
        );

        expect(count).toBe(1);
      });
    });

    describe('extendHotEntries', () => {
      it('should extend TTL for frequently accessed entries', () => {
        llmCache.set('prompt1', {}, { answer: '1' }, 1000);
        llmCache.set('prompt2', {}, { answer: '2' }, 1000);

        // Access prompt1 multiple times
        for (let i = 0; i < 6; i++) {
          llmCache.get('prompt1');
        }

        const count = llmCache.extendHotEntries(5, 20000);

        expect(count).toBe(1);
      });
    });

    describe('detectContentChange', () => {
      it('should detect and invalidate entries with content changes', () => {
        const prompt = 'Test prompt';
        const oldResponse = { answer: 'Old answer' };
        const newResponse = { answer: 'New answer' };

        llmCache.set(prompt, {}, oldResponse);
        expect(llmCache.has(prompt)).toBe(true);

        const changed = llmCache.detectContentChange(prompt, {}, newResponse);

        expect(changed).toBe(true);
        expect(llmCache.has(prompt)).toBe(false);
      });

      it('should not invalidate if content is the same', () => {
        const prompt = 'Test prompt';
        const response = { answer: 'Same answer' };

        llmCache.set(prompt, {}, response);
        expect(llmCache.has(prompt)).toBe(true);

        const changed = llmCache.detectContentChange(prompt, {}, response);

        expect(changed).toBe(false);
        expect(llmCache.has(prompt)).toBe(true);
      });

      it('should return false if entry does not exist', () => {
        const changed = llmCache.detectContentChange('non-existent', {}, { answer: 'Test' });
        expect(changed).toBe(false);
      });

      it('should respect enableContentTracking config', () => {
        llmCache.configure({ enableContentTracking: false });

        const prompt = 'Test prompt';
        llmCache.set(prompt, {}, { answer: 'Old' });

        const changed = llmCache.detectContentChange(prompt, {}, { answer: 'New' });

        expect(changed).toBe(false);
      });
    });
  });

  describe('health metrics', () => {
    describe('getHealthMetrics', () => {
      it('should return comprehensive health metrics', () => {
        llmCache.set('prompt1', {}, { answer: '1' });
        llmCache.set('prompt2', {}, { answer: '2' });

        llmCache.get('prompt1');
        llmCache.get('prompt1');

        const metrics = llmCache.getHealthMetrics();

        expect(metrics).toHaveProperty('size');
        expect(metrics).toHaveProperty('hits');
        expect(metrics).toHaveProperty('misses');
        expect(metrics).toHaveProperty('hit_rate');
        expect(metrics).toHaveProperty('avg_age_ms');
        expect(metrics).toHaveProperty('avg_hit_count');
        expect(metrics).toHaveProperty('expired_count');
        expect(metrics).toHaveProperty('estimated_memory_mb');
        expect(metrics).toHaveProperty('health_score');

        expect(metrics.size).toBe(2);
        expect(metrics.avg_hit_count).toBeGreaterThan(0);
        expect(metrics.health_score).toBeGreaterThan(0);
        expect(metrics.health_score).toBeLessThanOrEqual(100);
      });

      it('should calculate health score correctly', () => {
        // Create a healthy cache
        for (let i = 0; i < 10; i++) {
          llmCache.set(`prompt${i}`, {}, { answer: `${i}` });
          llmCache.get(`prompt${i}`);
          llmCache.get(`prompt${i}`);
        }

        const metrics = llmCache.getHealthMetrics();

        expect(metrics.health_score).toBeGreaterThan(70);
        expect(metrics.hit_rate).toBeGreaterThan(50);
      });

      it('should penalize low hit rate', () => {
        // Create entries but don't access them
        for (let i = 0; i < 10; i++) {
          llmCache.set(`prompt${i}`, {}, { answer: `${i}` });
        }

        // Access a few to create hits
        llmCache.get('prompt0');
        llmCache.get('prompt1');

        // Create many misses
        for (let i = 10; i < 20; i++) {
          llmCache.get(`prompt${i}`); // These will be misses
        }

        const metrics = llmCache.getHealthMetrics();

        expect(metrics.hit_rate).toBeLessThan(50);
        expect(metrics.health_score).toBeLessThan(100);
      });
    });
  });

  describe('optimize', () => {
    it('should remove expired and low-value entries', async () => {
      // Add some entries
      llmCache.set('prompt1', {}, { answer: '1' }, 100); // Will expire
      llmCache.set('prompt2', {}, { answer: '2' }, 10000); // Won't expire
      llmCache.set('prompt3', {}, { answer: '3' }, 10000); // Won't expire

      // Access prompt2 to make it valuable
      llmCache.get('prompt2');
      llmCache.get('prompt2');

      // Wait for prompt1 to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const result = llmCache.optimize();

      expect(result.expired_removed).toBeGreaterThan(0);
      expect(result.size_after).toBeLessThan(result.size_before);
      expect(llmCache.has('prompt1')).toBe(false);
      expect(llmCache.has('prompt2')).toBe(true);
    });

    it('should extend hot entries', () => {
      llmCache.set('prompt1', {}, { answer: '1' }, 1000);

      // Make it hot
      for (let i = 0; i < 6; i++) {
        llmCache.get('prompt1');
      }

      const result = llmCache.optimize();

      expect(result.hot_entries_extended).toBeGreaterThan(0);
    });
  });
});
