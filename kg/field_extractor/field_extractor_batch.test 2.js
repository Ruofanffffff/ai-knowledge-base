/**
 * Tests for Field Extractor Batch Processing
 */

const fieldExtractor = require('./field_extractor');

describe('Field Extractor - Batch Processing', () => {
  beforeEach(() => {
    // Clear cache before each test
    fieldExtractor.clearCache();
  });
  
  describe('extractFieldsFromCKBs', () => {
    test('processes multiple CKBs successfully', async () => {
      const ckbs = [
        {
          ckb_id: 'test-001',
          doc_id: 'doc-001',
          content: {
            text: '杭州旅游攻略，主要景点有西湖、灵隐寺。'
          }
        },
        {
          ckb_id: 'test-002',
          doc_id: 'doc-002',
          content: {
            text: '上海是一个现代化的城市，有东方明珠、外滩等景点。'
          }
        }
      ];
      
      const results = await fieldExtractor.extractFieldsFromCKBs(ckbs, {
        useRules: true,
        useNER: false,
        useLLM: false,
        enableDomainDetection: true
      });
      
      expect(results).toHaveLength(2);
      expect(results[0].ckbId).toBe('test-001');
      expect(results[1].ckbId).toBe('test-002');
      expect(Array.isArray(results[0].fields)).toBe(true);
      expect(Array.isArray(results[1].fields)).toBe(true);
    });
    
    test('includes domain and strategy in results', async () => {
      const ckbs = [
        {
          ckb_id: 'test-001',
          doc_id: 'doc-001',
          content: {
            text: '杭州旅游攻略，主要景点有西湖、灵隐寺。'
          }
        }
      ];
      
      const results = await fieldExtractor.extractFieldsFromCKBs(ckbs, {
        useRules: true,
        useNER: false,
        useLLM: false,
        enableDomainDetection: true
      });
      
      expect(results[0].domain).toBeDefined();
      expect(results[0].strategy).toBeDefined();
      expect(results[0].fieldCount).toBeDefined();
      expect(typeof results[0].fieldCount).toBe('number');
    });
    
    test('detects different domains for different CKBs', async () => {
      const ckbs = [
        {
          ckb_id: 'test-001',
          doc_id: 'doc-001',
          content: {
            text: '杭州旅游攻略，主要景点有西湖、灵隐寺、雷峰塔。'
          }
        },
        {
          ckb_id: 'test-002',
          doc_id: 'doc-002',
          content: {
            text: '这是一段普通的文本，没有特定领域特征。'
          }
        }
      ];
      
      const results = await fieldExtractor.extractFieldsFromCKBs(ckbs, {
        useRules: true,
        useNER: false,
        useLLM: false,
        enableDomainDetection: true
      });
      
      // First CKB should be detected as travel
      expect(results[0].domain).toBe('travel');
      
      // Second CKB should be detected as general
      expect(results[1].domain).toBe('general');
    });
    
    test('uses different strategies for different domains', async () => {
      const ckbs = [
        {
          ckb_id: 'test-001',
          doc_id: 'doc-001',
          content: {
            text: '杭州旅游攻略，主要景点有西湖、灵隐寺、雷峰塔。'
          }
        },
        {
          ckb_id: 'test-002',
          doc_id: 'doc-002',
          content: {
            text: '这是一段普通的文本。'
          }
        }
      ];
      
      const results = await fieldExtractor.extractFieldsFromCKBs(ckbs, {
        useRules: true,
        useNER: false,
        useLLM: false,
        enableDomainDetection: true
      });
      
      // Travel domain should use semantic-only strategy
      expect(results[0].strategy).toBe('semantic-only');
      
      // General domain should use rule-first strategy
      expect(results[1].strategy).toBe('rule-first');
    });
    
    test('handles errors gracefully in batch mode', async () => {
      const ckbs = [
        {
          ckb_id: 'test-001',
          doc_id: 'doc-001',
          content: {
            text: '杭州旅游攻略'
          }
        },
        {
          ckb_id: 'test-002',
          doc_id: 'doc-002',
          content: null  // Invalid content
        },
        {
          ckb_id: 'test-003',
          doc_id: 'doc-003',
          content: {
            text: '上海旅游'
          }
        }
      ];
      
      const results = await fieldExtractor.extractFieldsFromCKBs(ckbs, {
        useRules: true,
        useNER: false,
        useLLM: false
      });
      
      // Should have results for all CKBs
      expect(results).toHaveLength(3);
      
      // First CKB should succeed
      expect(results[0].error).toBeUndefined();
      expect(results[0].fields.length).toBeGreaterThanOrEqual(0);
      
      // Second CKB should have error
      expect(results[1].error).toBeDefined();
      expect(results[1].fields).toEqual([]);
      
      // Third CKB should succeed
      expect(results[2].error).toBeUndefined();
      expect(results[2].fields.length).toBeGreaterThanOrEqual(0);
    });
    
    test('respects domain override in batch mode', async () => {
      const ckbs = [
        {
          ckb_id: 'test-001',
          doc_id: 'doc-001',
          content: {
            text: '杭州旅游攻略'
          }
        },
        {
          ckb_id: 'test-002',
          doc_id: 'doc-002',
          content: {
            text: '上海旅游'
          }
        }
      ];
      
      const results = await fieldExtractor.extractFieldsFromCKBs(ckbs, {
        domain: 'general',  // Override domain
        useRules: true,
        useNER: false,
        useLLM: false
      });
      
      // Both should use general domain (override)
      expect(results[0].domain).toBe('general');
      expect(results[1].domain).toBe('general');
    });
    
    test('respects strategy override in batch mode', async () => {
      const ckbs = [
        {
          ckb_id: 'test-001',
          doc_id: 'doc-001',
          content: {
            text: '杭州旅游攻略'
          }
        },
        {
          ckb_id: 'test-002',
          doc_id: 'doc-002',
          content: {
            text: '上海旅游'
          }
        }
      ];
      
      const results = await fieldExtractor.extractFieldsFromCKBs(ckbs, {
        strategy: 'hybrid',  // Override strategy
        useRules: true,
        useNER: false,
        useLLM: false,
        enableDomainDetection: true
      });
      
      // Both should use hybrid strategy (override)
      expect(results[0].strategy).toBe('hybrid');
      expect(results[1].strategy).toBe('hybrid');
    });
    
    test('uses cache in batch mode', async () => {
      const ckbs = [
        {
          ckb_id: 'test-001',
          doc_id: 'doc-001',
          content: {
            text: '杭州旅游攻略'
          }
        },
        {
          ckb_id: 'test-001',  // Same CKB again
          doc_id: 'doc-001',
          content: {
            text: '杭州旅游攻略'
          }
        }
      ];
      
      const results = await fieldExtractor.extractFieldsFromCKBs(ckbs, {
        useRules: true,
        useNER: false,
        useLLM: false,
        useCache: true
      });
      
      // Both should succeed
      expect(results).toHaveLength(2);
      expect(results[0].fields).toEqual(results[1].fields);
      
      // Cache should have one entry (same content)
      const stats = fieldExtractor.getCacheStats();
      expect(stats.size).toBe(1);
    });
    
    test('returns empty array for empty input', async () => {
      const results = await fieldExtractor.extractFieldsFromCKBs([], {
        useRules: true,
        useNER: false,
        useLLM: false
      });
      
      expect(results).toEqual([]);
    });
    
    test('includes field count in results', async () => {
      const ckbs = [
        {
          ckb_id: 'test-001',
          doc_id: 'doc-001',
          content: {
            text: '杭州是一个美丽的城市，有西湖、灵隐寺等著名景点。'
          }
        }
      ];
      
      const results = await fieldExtractor.extractFieldsFromCKBs(ckbs, {
        useRules: true,
        useNER: false,
        useLLM: false
      });
      
      expect(results[0].fieldCount).toBe(results[0].fields.length);
    });
  });
  
  describe('Batch extraction performance', () => {
    test('processes multiple CKBs efficiently', async () => {
      const ckbs = Array.from({ length: 5 }, (_, i) => ({
        ckb_id: `test-${i + 1}`,
        doc_id: `doc-${i + 1}`,
        content: {
          text: `杭州旅游攻略 ${i + 1}`
        }
      }));
      
      const startTime = Date.now();
      const results = await fieldExtractor.extractFieldsFromCKBs(ckbs, {
        useRules: true,
        useNER: false,
        useLLM: false,
        enableDomainDetection: true
      });
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(5);
      console.log(`Batch extraction of 5 CKBs took ${duration}ms`);
      
      // All should succeed
      results.forEach(result => {
        expect(result.error).toBeUndefined();
        expect(result.domain).toBeDefined();
        expect(result.strategy).toBeDefined();
      });
    });
  });
});
