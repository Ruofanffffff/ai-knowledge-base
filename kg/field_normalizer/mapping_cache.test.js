/**
 * Mapping Cache Tests
 * 
 * Tests for field name mapping cache functionality.
 */

const { MappingCache, getGlobalCache, resetGlobalCache } = require('./mapping_cache');
const fs = require('fs');
const path = require('path');

describe('Mapping Cache', () => {
  let cache;
  
  beforeEach(() => {
    cache = new MappingCache({
      enablePersistence: false,
      maxSize: 100,
      ttl: 1000 // 1 second for testing
    });
  });
  
  afterEach(() => {
    if (cache && cache._persistenceTimeout) {
      clearTimeout(cache._persistenceTimeout);
    }
    cache.clear();
  });
  
  describe('Basic Operations', () => {
    test('should set and get mapping', () => {
      const mapping = {
        mapped_name: '区域',
        confidence: 0.9,
        method: 'synonym'
      };
      
      cache.set('地区', 'TestSchema', mapping);
      const retrieved = cache.get('地区', 'TestSchema');
      
      expect(retrieved).toEqual(mapping);
    });
    
    test('should return null for non-existent mapping', () => {
      const retrieved = cache.get('不存在', 'TestSchema');
      
      expect(retrieved).toBeNull();
    });
    
    test('should check if mapping exists', () => {
      const mapping = {
        mapped_name: '区域',
        confidence: 0.9,
        method: 'synonym'
      };
      
      cache.set('地区', 'TestSchema', mapping);
      
      expect(cache.has('地区', 'TestSchema')).toBe(true);
      expect(cache.has('不存在', 'TestSchema')).toBe(false);
    });
    
    test('should delete mapping', () => {
      const mapping = {
        mapped_name: '区域',
        confidence: 0.9,
        method: 'synonym'
      };
      
      cache.set('地区', 'TestSchema', mapping);
      expect(cache.has('地区', 'TestSchema')).toBe(true);
      
      cache.delete('地区', 'TestSchema');
      expect(cache.has('地区', 'TestSchema')).toBe(false);
    });
    
    test('should clear all mappings', () => {
      cache.set('地区', 'Schema1', { mapped_name: '区域', confidence: 0.9, method: 'synonym' });
      cache.set('日期', 'Schema2', { mapped_name: '时间', confidence: 0.9, method: 'synonym' });
      
      expect(cache.size()).toBe(2);
      
      cache.clear();
      
      expect(cache.size()).toBe(0);
    });
  });
  
  describe('Cache Size Management', () => {
    test('should respect max size limit', () => {
      const smallCache = new MappingCache({ maxSize: 3 });
      
      smallCache.set('field1', 'Schema', { mapped_name: 'f1', confidence: 0.9, method: 'exact' });
      smallCache.set('field2', 'Schema', { mapped_name: 'f2', confidence: 0.9, method: 'exact' });
      smallCache.set('field3', 'Schema', { mapped_name: 'f3', confidence: 0.9, method: 'exact' });
      
      expect(smallCache.size()).toBe(3);
      
      // Adding 4th entry should evict the oldest
      smallCache.set('field4', 'Schema', { mapped_name: 'f4', confidence: 0.9, method: 'exact' });
      
      expect(smallCache.size()).toBe(3);
      expect(smallCache.has('field1', 'Schema')).toBe(false); // Evicted
      expect(smallCache.has('field4', 'Schema')).toBe(true);
    });
    
    test('should track evictions', () => {
      const smallCache = new MappingCache({ maxSize: 2 });
      
      smallCache.set('field1', 'Schema', { mapped_name: 'f1', confidence: 0.9, method: 'exact' });
      smallCache.set('field2', 'Schema', { mapped_name: 'f2', confidence: 0.9, method: 'exact' });
      smallCache.set('field3', 'Schema', { mapped_name: 'f3', confidence: 0.9, method: 'exact' });
      
      const stats = smallCache.getStats();
      expect(stats.evictions).toBe(1);
    });
  });
  
  describe('TTL (Time To Live)', () => {
    test('should expire entries after TTL', async () => {
      const shortTTLCache = new MappingCache({ ttl: 100 }); // 100ms
      
      shortTTLCache.set('地区', 'TestSchema', {
        mapped_name: '区域',
        confidence: 0.9,
        method: 'synonym'
      });
      
      expect(shortTTLCache.has('地区', 'TestSchema')).toBe(true);
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(shortTTLCache.has('地区', 'TestSchema')).toBe(false);
    });
    
    test('should invalidate expired entries', async () => {
      const shortTTLCache = new MappingCache({ ttl: 100 });
      
      shortTTLCache.set('field1', 'Schema', { mapped_name: 'f1', confidence: 0.9, method: 'exact' });
      shortTTLCache.set('field2', 'Schema', { mapped_name: 'f2', confidence: 0.9, method: 'exact' });
      
      expect(shortTTLCache.size()).toBe(2);
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const invalidated = shortTTLCache.invalidateExpired();
      
      expect(invalidated).toBe(2);
      expect(shortTTLCache.size()).toBe(0);
    });
  });
  
  describe('Statistics', () => {
    test('should track hits and misses', () => {
      cache.set('地区', 'TestSchema', {
        mapped_name: '区域',
        confidence: 0.9,
        method: 'synonym'
      });
      
      // Hit
      cache.get('地区', 'TestSchema');
      
      // Miss
      cache.get('不存在', 'TestSchema');
      
      const stats = cache.getStats();
      
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5, 2);
    });
    
    test('should track sets', () => {
      cache.set('field1', 'Schema', { mapped_name: 'f1', confidence: 0.9, method: 'exact' });
      cache.set('field2', 'Schema', { mapped_name: 'f2', confidence: 0.9, method: 'exact' });
      
      const stats = cache.getStats();
      
      expect(stats.sets).toBe(2);
    });
    
    test('should calculate hit rate', () => {
      cache.set('field1', 'Schema', { mapped_name: 'f1', confidence: 0.9, method: 'exact' });
      
      cache.get('field1', 'Schema'); // Hit
      cache.get('field1', 'Schema'); // Hit
      cache.get('field2', 'Schema'); // Miss
      
      const stats = cache.getStats();
      
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });
  });
  
  describe('Learning from LLM', () => {
    test('should learn from high-confidence LLM mappings', () => {
      const learningCache = new MappingCache({
        learnFromLLM: true,
        llmConfidenceThreshold: 0.9
      });
      
      // High confidence LLM mapping
      learningCache.set('地区', 'TestSchema', {
        mapped_name: '区域',
        confidence: 0.95,
        method: 'llm'
      });
      
      const stats = learningCache.getStats();
      expect(stats.learned).toBe(1);
    });
    
    test('should not learn from low-confidence LLM mappings', () => {
      const learningCache = new MappingCache({
        learnFromLLM: true,
        llmConfidenceThreshold: 0.9
      });
      
      // Low confidence LLM mapping
      learningCache.set('地区', 'TestSchema', {
        mapped_name: '区域',
        confidence: 0.75,
        method: 'llm'
      });
      
      const stats = learningCache.getStats();
      expect(stats.learned).toBe(0);
    });
    
    test('should not learn from non-LLM mappings', () => {
      const learningCache = new MappingCache({
        learnFromLLM: true,
        llmConfidenceThreshold: 0.9
      });
      
      // Synonym mapping (not LLM)
      learningCache.set('地区', 'TestSchema', {
        mapped_name: '区域',
        confidence: 0.95,
        method: 'synonym'
      });
      
      const stats = learningCache.getStats();
      expect(stats.learned).toBe(0);
    });
  });
  
  describe('Export and Import', () => {
    test('should export cache entries', () => {
      cache.set('field1', 'Schema1', { mapped_name: 'f1', confidence: 0.9, method: 'exact' });
      cache.set('field2', 'Schema2', { mapped_name: 'f2', confidence: 0.8, method: 'synonym' });
      
      const entries = cache.export();
      
      expect(entries).toHaveLength(2);
      expect(entries[0]).toHaveProperty('schemaName');
      expect(entries[0]).toHaveProperty('rawFieldName');
      expect(entries[0]).toHaveProperty('mapping');
      expect(entries[0]).toHaveProperty('timestamp');
    });
    
    test('should import cache entries', () => {
      const entries = [
        {
          schemaName: 'Schema1',
          rawFieldName: 'field1',
          mapping: { mapped_name: 'f1', confidence: 0.9, method: 'exact' }
        },
        {
          schemaName: 'Schema2',
          rawFieldName: 'field2',
          mapping: { mapped_name: 'f2', confidence: 0.8, method: 'synonym' }
        }
      ];
      
      const imported = cache.import(entries);
      
      expect(imported).toBe(2);
      expect(cache.size()).toBe(2);
      expect(cache.has('field1', 'Schema1')).toBe(true);
      expect(cache.has('field2', 'Schema2')).toBe(true);
    });
  });
  
  describe('Persistence', () => {
    const testCachePath = path.join(__dirname, '.cache', 'test_cache.json');
    let persistentCache;
    
    afterEach(() => {
      // Clear timeout if exists
      if (persistentCache && persistentCache._persistenceTimeout) {
        clearTimeout(persistentCache._persistenceTimeout);
      }
      
      // Clean up test cache file
      try {
        if (fs.existsSync(testCachePath)) {
          fs.unlinkSync(testCachePath);
        }
        const dir = path.dirname(testCachePath);
        if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
          fs.rmdirSync(dir);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    });
    
    test('should save cache to disk', () => {
      persistentCache = new MappingCache({
        enablePersistence: true,
        persistencePath: testCachePath
      });
      
      persistentCache.set('field1', 'Schema', {
        mapped_name: 'f1',
        confidence: 0.9,
        method: 'exact'
      });
      
      persistentCache.saveToDisk();
      
      expect(fs.existsSync(testCachePath)).toBe(true);
    });
    
    test('should load cache from disk', () => {
      // Create a cache and save it
      const cache1 = new MappingCache({
        enablePersistence: true,
        persistencePath: testCachePath
      });
      
      cache1.set('field1', 'Schema', {
        mapped_name: 'f1',
        confidence: 0.9,
        method: 'exact'
      });
      
      cache1.saveToDisk();
      
      // Clear timeout
      if (cache1._persistenceTimeout) {
        clearTimeout(cache1._persistenceTimeout);
      }
      
      // Create a new cache and load from disk
      persistentCache = new MappingCache({
        enablePersistence: true,
        persistencePath: testCachePath
      });
      
      expect(persistentCache.size()).toBe(1);
      expect(persistentCache.has('field1', 'Schema')).toBe(true);
    });
  });
  
  describe('Global Cache', () => {
    afterEach(() => {
      resetGlobalCache();
    });
    
    test('should get global cache instance', () => {
      const cache1 = getGlobalCache();
      const cache2 = getGlobalCache();
      
      expect(cache1).toBe(cache2); // Same instance
    });
    
    test('should reset global cache', () => {
      const cache1 = getGlobalCache();
      cache1.set('field1', 'Schema', { mapped_name: 'f1', confidence: 0.9, method: 'exact' });
      
      expect(cache1.size()).toBe(1);
      
      resetGlobalCache();
      
      const cache2 = getGlobalCache();
      expect(cache2.size()).toBe(0);
    });
  });
});
