/**
 * Tests for Field Extractor Caching
 */

const fieldExtractor = require('./field_extractor');

describe('Field Extractor - Caching', () => {
  beforeEach(() => {
    // Clear cache before each test
    fieldExtractor.clearCache();
  });
  
  describe('generateCacheKey', () => {
    test('generates consistent cache key for same input', () => {
      const ckb = {
        ckb_id: 'test-001',
        content: { text: '杭州旅游攻略' }
      };
      const options = { domain: 'travel', strategy: 'semantic-only' };
      
      const key1 = fieldExtractor.generateCacheKey(ckb, options);
      const key2 = fieldExtractor.generateCacheKey(ckb, options);
      
      expect(key1).toBe(key2);
    });
    
    test('generates different cache keys for different content', () => {
      const ckb1 = {
        ckb_id: 'test-001',
        content: { text: '杭州旅游攻略' }
      };
      const ckb2 = {
        ckb_id: 'test-002',
        content: { text: '上海旅游攻略' }
      };
      const options = { domain: 'travel' };
      
      const key1 = fieldExtractor.generateCacheKey(ckb1, options);
      const key2 = fieldExtractor.generateCacheKey(ckb2, options);
      
      expect(key1).not.toBe(key2);
    });
    
    test('generates different cache keys for different options', () => {
      const ckb = {
        ckb_id: 'test-001',
        content: { text: '杭州旅游攻略' }
      };
      
      const key1 = fieldExtractor.generateCacheKey(ckb, { domain: 'travel' });
      const key2 = fieldExtractor.generateCacheKey(ckb, { domain: 'general' });
      
      expect(key1).not.toBe(key2);
    });
    
    test('ignores non-extraction options in cache key', () => {
      const ckb = {
        ckb_id: 'test-001',
        content: { text: '杭州旅游攻略' }
      };
      
      const key1 = fieldExtractor.generateCacheKey(ckb, { 
        domain: 'travel',
        trackTokens: true
      });
      const key2 = fieldExtractor.generateCacheKey(ckb, { 
        domain: 'travel',
        trackTokens: false
      });
      
      // trackTokens doesn't affect extraction results, so keys should be same
      expect(key1).toBe(key2);
    });
  });
  
  describe('Cache behavior', () => {
    test('caches extraction results', async () => {
      const ckb = {
        ckb_id: 'test-001',
        doc_id: 'doc-001',
        content: {
          text: '杭州是一个美丽的城市，有西湖、灵隐寺等著名景点。'
        }
      };
      
      // First extraction
      const fields1 = await fieldExtractor.extractFields(ckb, {
        useRules: true,
        useNER: false,
        useLLM: false,
        useCache: true
      });
      
      // Second extraction (should use cache)
      const fields2 = await fieldExtractor.extractFields(ckb, {
        useRules: true,
        useNER: false,
        useLLM: false,
        useCache: true
      });
      
      // Results should be identical
      expect(fields2).toEqual(fields1);
      
      // Cache should have one entry
      const stats = fieldExtractor.getCacheStats();
      expect(stats.size).toBe(1);
    });
    
    test('cache can be disabled', async () => {
      const ckb = {
        ckb_id: 'test-001',
        doc_id: 'doc-001',
        content: {
          text: '杭州是一个美丽的城市。'
        }
      };
      
      // First extraction with cache disabled
      await fieldExtractor.extractFields(ckb, {
        useRules: true,
        useNER: false,
        useLLM: false,
        useCache: false
      });
      
      // Cache should be empty
      const stats = fieldExtractor.getCacheStats();
      expect(stats.size).toBe(0);
    });
    
    test('clearCache removes all entries', async () => {
      const ckb1 = {
        ckb_id: 'test-001',
        doc_id: 'doc-001',
        content: { text: '杭州旅游' }
      };
      const ckb2 = {
        ckb_id: 'test-002',
        doc_id: 'doc-002',
        content: { text: '上海旅游' }
      };
      
      // Extract from both CKBs
      await fieldExtractor.extractFields(ckb1, {
        useRules: true,
        useNER: false,
        useLLM: false
      });
      await fieldExtractor.extractFields(ckb2, {
        useRules: true,
        useNER: false,
        useLLM: false
      });
      
      // Cache should have 2 entries
      let stats = fieldExtractor.getCacheStats();
      expect(stats.size).toBe(2);
      
      // Clear cache
      fieldExtractor.clearCache();
      
      // Cache should be empty
      stats = fieldExtractor.getCacheStats();
      expect(stats.size).toBe(0);
    });
    
    test('clearCache can remove specific entry', async () => {
      const ckb = {
        ckb_id: 'test-001',
        doc_id: 'doc-001',
        content: { text: '杭州旅游' }
      };
      const options = {
        useRules: true,
        useNER: false,
        useLLM: false
      };
      
      // Extract
      await fieldExtractor.extractFields(ckb, options);
      
      // Get cache key
      const cacheKey = fieldExtractor.generateCacheKey(ckb, options);
      
      // Clear specific entry
      fieldExtractor.clearCache(cacheKey);
      
      // Cache should be empty
      const stats = fieldExtractor.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });
  
  describe('Cache effectiveness', () => {
    test('repeated extraction with same options uses cache', async () => {
      const ckb = {
        ckb_id: 'test-001',
        doc_id: 'doc-001',
        content: {
          text: '杭州旅游攻略，主要景点有西湖、灵隐寺。'
        }
      };
      const options = {
        useRules: true,
        useNER: false,
        useLLM: false,
        useCache: true
      };
      
      // First extraction
      const startTime1 = Date.now();
      const fields1 = await fieldExtractor.extractFields(ckb, options);
      const duration1 = Date.now() - startTime1;
      
      // Second extraction (should use cache)
      const startTime2 = Date.now();
      const fields2 = await fieldExtractor.extractFields(ckb, options);
      const duration2 = Date.now() - startTime2;
      
      // Results should be identical
      expect(fields2).toEqual(fields1);
      
      // Second call should be faster (cache hit)
      // Note: This is a soft assertion as timing can vary
      console.log(`First extraction: ${duration1}ms, Second extraction: ${duration2}ms`);
    });
    
    test('different options bypass cache', async () => {
      const ckb = {
        ckb_id: 'test-001',
        doc_id: 'doc-001',
        content: {
          text: '杭州旅游攻略'
        }
      };
      
      // First extraction with domain: travel
      await fieldExtractor.extractFields(ckb, {
        domain: 'travel',
        useRules: true,
        useNER: false,
        useLLM: false
      });
      
      // Second extraction with domain: general
      await fieldExtractor.extractFields(ckb, {
        domain: 'general',
        useRules: true,
        useNER: false,
        useLLM: false
      });
      
      // Cache should have 2 entries (different options)
      const stats = fieldExtractor.getCacheStats();
      expect(stats.size).toBe(2);
    });
  });
  
  describe('getCacheStats', () => {
    test('returns correct cache statistics', async () => {
      const ckb1 = {
        ckb_id: 'test-001',
        doc_id: 'doc-001',
        content: { text: '杭州旅游' }
      };
      const ckb2 = {
        ckb_id: 'test-002',
        doc_id: 'doc-002',
        content: { text: '上海旅游' }
      };
      
      // Extract from both CKBs
      await fieldExtractor.extractFields(ckb1, {
        useRules: true,
        useNER: false,
        useLLM: false
      });
      await fieldExtractor.extractFields(ckb2, {
        useRules: true,
        useNER: false,
        useLLM: false
      });
      
      const stats = fieldExtractor.getCacheStats();
      
      expect(stats.size).toBe(2);
      expect(Array.isArray(stats.keys)).toBe(true);
      expect(stats.keys.length).toBe(2);
    });
    
    test('returns empty stats for empty cache', () => {
      const stats = fieldExtractor.getCacheStats();
      
      expect(stats.size).toBe(0);
      expect(stats.keys.length).toBe(0);
    });
  });
});
