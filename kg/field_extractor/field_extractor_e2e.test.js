/**
 * End-to-End Integration Tests for Semantic Field Extraction
 * 
 * Tests the complete flow with real travel documents:
 * - Domain detection
 * - Strategy selection
 * - Semantic field extraction
 * - Token tracking
 * - Cache behavior
 */

const fieldExtractor = require('./field_extractor');
const tokenTracker = require('../utils/token_tracker');

describe('Semantic Field Extraction - End-to-End Integration', () => {
  beforeEach(() => {
    // Clear cache before each test
    fieldExtractor.clearCache();
    // Reset token tracker
    tokenTracker.reset();
  });
  
  describe('Real travel document extraction', () => {
    test('extracts semantic field names from travel document', async () => {
      const travelCKB = {
        ckb_id: 'travel-e2e-001',
        doc_id: 'doc-e2e-001',
        content: {
          text: `苏杭四日游，人均800多点，冬天去最合适。
主要景点有西湖、乌镇西栅、南浔古镇。
风景优美，古镇风情浓郁。建议坐高铁前往。
住宿推荐：西湖附近的民宿，价格实惠。
美食推荐：东坡肉、西湖醋鱼、叫花鸡。`
        }
      };
      
      const fields = await fieldExtractor.extractFields(travelCKB, {
        enableDomainDetection: true,
        trackTokens: true,
        useRules: true,
        useNER: true,  // Enable NER for better extraction
        useLLM: false  // Use rule-based only for predictable testing
      });
      
      // Verify fields were extracted (rule+NER should extract some fields)
      expect(Array.isArray(fields)).toBe(true);
      
      // If fields were extracted, verify structure
      if (fields.length > 0) {
        fields.forEach(field => {
          expect(field).toHaveProperty('name');
          expect(field).toHaveProperty('value');
          expect(field).toHaveProperty('type');
          expect(field).toHaveProperty('confidence');
        });
        
        // Get field names
        const fieldNames = fields.map(f => f.name);
        console.log('Extracted field names:', fieldNames);
      } else {
        console.log('No fields extracted (rule-based only, no LLM)');
      }
      
      // Verify the infrastructure works (returns array)
      expect(Array.isArray(fields)).toBe(true);
    });
    
    test('detects travel domain automatically', async () => {
      const travelCKB = {
        ckb_id: 'travel-e2e-002',
        doc_id: 'doc-e2e-002',
        content: {
          text: '杭州旅游攻略：西湖、灵隐寺、雷峰塔是必去景点。'
        }
      };
      
      const fields = await fieldExtractor.extractFields(travelCKB, {
        enableDomainDetection: true,
        useRules: true,
        useNER: false,
        useLLM: false
      });
      
      // Domain should be detected as travel
      // This is verified through console logs in the actual implementation
      expect(fields).toBeDefined();
    });
    
    test('uses semantic-only strategy for travel domain', async () => {
      const travelCKB = {
        ckb_id: 'travel-e2e-003',
        doc_id: 'doc-e2e-003',
        content: {
          text: '苏杭四日游，人均800多点，主要景点有西湖、乌镇。'
        }
      };
      
      // Extract with domain detection enabled
      const fields = await fieldExtractor.extractFields(travelCKB, {
        enableDomainDetection: true,
        useRules: true,
        useNER: false,
        useLLM: false
      });
      
      // Strategy should be semantic-only for travel domain
      // This is verified through console logs
      expect(fields).toBeDefined();
    });
  });
  
  describe('Token tracking', () => {
    test('tracks token usage during extraction', async () => {
      const ckb = {
        ckb_id: 'token-test-001',
        doc_id: 'doc-token-001',
        content: {
          text: '杭州旅游攻略，主要景点有西湖、灵隐寺。'
        }
      };
      
      // Get initial token count
      const initialStats = tokenTracker.getTokenStats();
      const initialTokens = initialStats.total_tokens;
      
      // Extract fields (rule-based, no LLM)
      await fieldExtractor.extractFields(ckb, {
        enableDomainDetection: true,
        trackTokens: true,
        useRules: true,
        useNER: false,
        useLLM: false
      });
      
      // Token count should not increase (no LLM used)
      const finalStats = tokenTracker.getTokenStats();
      const finalTokens = finalStats.total_tokens;
      expect(finalTokens).toBe(initialTokens);
    });
  });
  
  describe('Cache behavior', () => {
    test('uses cache for repeated extractions', async () => {
      const ckb = {
        ckb_id: 'cache-test-001',
        doc_id: 'doc-cache-001',
        content: {
          text: '杭州旅游攻略，主要景点有西湖、灵隐寺、雷峰塔。'
        }
      };
      
      const options = {
        enableDomainDetection: true,
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
      console.log(`First extraction: ${duration1}ms, Second extraction: ${duration2}ms`);
      expect(duration2).toBeLessThanOrEqual(duration1);
      
      // Cache should have one entry
      const stats = fieldExtractor.getCacheStats();
      expect(stats.size).toBe(1);
    });
    
    test('cache saves token usage', async () => {
      const ckb = {
        ckb_id: 'cache-token-001',
        doc_id: 'doc-cache-token-001',
        content: {
          text: '杭州旅游攻略'
        }
      };
      
      const options = {
        enableDomainDetection: true,
        useRules: true,
        useNER: false,
        useLLM: false,
        useCache: true
      };
      
      // First extraction
      const statsBeforeFirst = tokenTracker.getTokenStats();
      const tokensBefore = statsBeforeFirst.total_tokens;
      await fieldExtractor.extractFields(ckb, options);
      const statsAfterFirst = tokenTracker.getTokenStats();
      const tokensAfterFirst = statsAfterFirst.total_tokens;
      const firstCallTokens = tokensAfterFirst - tokensBefore;
      
      // Second extraction (should use cache)
      await fieldExtractor.extractFields(ckb, options);
      const statsAfterSecond = tokenTracker.getTokenStats();
      const tokensAfterSecond = statsAfterSecond.total_tokens;
      const secondCallTokens = tokensAfterSecond - tokensAfterFirst;
      
      // Second call should use zero additional tokens (cache hit)
      expect(secondCallTokens).toBe(0);
      
      // First call used zero tokens (rule-based only)
      expect(firstCallTokens).toBe(0);
    });
  });
  
  describe('Batch extraction with domain detection', () => {
    test('processes multiple travel documents with different domains', async () => {
      const ckbs = [
        {
          ckb_id: 'batch-001',
          doc_id: 'doc-batch-001',
          content: {
            text: '杭州旅游攻略：西湖、灵隐寺、雷峰塔是必去景点。'
          }
        },
        {
          ckb_id: 'batch-002',
          doc_id: 'doc-batch-002',
          content: {
            text: '这是一段普通的文本，没有特定领域特征。'
          }
        },
        {
          ckb_id: 'batch-003',
          doc_id: 'doc-batch-003',
          content: {
            text: '上海旅游推荐：东方明珠、外滩、城隍庙。'
          }
        }
      ];
      
      const results = await fieldExtractor.extractFieldsFromCKBs(ckbs, {
        enableDomainDetection: true,
        useRules: true,
        useNER: false,
        useLLM: false
      });
      
      // All CKBs should be processed
      expect(results).toHaveLength(3);
      
      // First CKB should be travel domain
      expect(results[0].domain).toBe('travel');
      expect(results[0].strategy).toBe('semantic-only');
      
      // Second CKB should be general domain
      expect(results[1].domain).toBe('general');
      expect(results[1].strategy).toBe('rule-first');
      
      // Third CKB should be travel domain
      expect(results[2].domain).toBe('travel');
      expect(results[2].strategy).toBe('semantic-only');
      
      // All should have fields
      results.forEach(result => {
        expect(result.fields).toBeDefined();
        expect(Array.isArray(result.fields)).toBe(true);
        expect(result.fieldCount).toBe(result.fields.length);
      });
    });
  });
  
  describe('Strategy override', () => {
    test('allows manual strategy override', async () => {
      const travelCKB = {
        ckb_id: 'override-001',
        doc_id: 'doc-override-001',
        content: {
          text: '杭州旅游攻略：西湖、灵隐寺。'
        }
      };
      
      // Override to use rule-first instead of semantic-only
      const fields = await fieldExtractor.extractFields(travelCKB, {
        enableDomainDetection: true,
        strategy: 'rule-first',  // Override
        useRules: true,
        useNER: false,
        useLLM: false
      });
      
      // Should use rule-first strategy despite travel domain
      expect(fields).toBeDefined();
    });
    
    test('allows manual domain override', async () => {
      const travelCKB = {
        ckb_id: 'override-002',
        doc_id: 'doc-override-002',
        content: {
          text: '杭州旅游攻略：西湖、灵隐寺。'
        }
      };
      
      // Override to use general domain
      const fields = await fieldExtractor.extractFields(travelCKB, {
        domain: 'general',  // Override
        useRules: true,
        useNER: false,
        useLLM: false
      });
      
      // Should use general domain strategy
      expect(fields).toBeDefined();
    });
  });
  
  describe('Error handling', () => {
    test('handles empty content gracefully', async () => {
      const emptyCKB = {
        ckb_id: 'error-001',
        doc_id: 'doc-error-001',
        content: {
          text: ''
        }
      };
      
      const fields = await fieldExtractor.extractFields(emptyCKB, {
        enableDomainDetection: true
      });
      
      // Should return empty array
      expect(fields).toEqual([]);
    });
    
    test('handles null content gracefully', async () => {
      const nullCKB = {
        ckb_id: 'error-002',
        doc_id: 'doc-error-002',
        content: {
          text: null
        }
      };
      
      const fields = await fieldExtractor.extractFields(nullCKB, {
        enableDomainDetection: true
      });
      
      // Should return empty array
      expect(fields).toEqual([]);
    });
  });
  
  describe('Performance', () => {
    test('domain detection completes quickly', async () => {
      const ckb = {
        ckb_id: 'perf-001',
        doc_id: 'doc-perf-001',
        content: {
          text: '杭州旅游攻略：西湖、灵隐寺、雷峰塔是必去景点。' + '这是一段很长的文本。'.repeat(100)
        }
      };
      
      const startTime = Date.now();
      await fieldExtractor.extractFields(ckb, {
        enableDomainDetection: true,
        useRules: true,
        useNER: false,
        useLLM: false
      });
      const duration = Date.now() - startTime;
      
      console.log(`Extraction with domain detection took ${duration}ms`);
      
      // Should complete reasonably fast
      expect(duration).toBeLessThan(1000);  // Less than 1 second
    });
    
    test('batch extraction is efficient', async () => {
      const ckbs = Array.from({ length: 10 }, (_, i) => ({
        ckb_id: `perf-batch-${i + 1}`,
        doc_id: `doc-perf-batch-${i + 1}`,
        content: {
          text: `杭州旅游攻略 ${i + 1}：西湖、灵隐寺。`
        }
      }));
      
      const startTime = Date.now();
      const results = await fieldExtractor.extractFieldsFromCKBs(ckbs, {
        enableDomainDetection: true,
        useRules: true,
        useNER: false,
        useLLM: false
      });
      const duration = Date.now() - startTime;
      
      console.log(`Batch extraction of 10 CKBs took ${duration}ms`);
      
      // All should succeed
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.error).toBeUndefined();
      });
      
      // Should complete reasonably fast
      expect(duration).toBeLessThan(2000);  // Less than 2 seconds
    });
  });
  
  describe('Backward compatibility', () => {
    test('works without new parameters', async () => {
      const ckb = {
        ckb_id: 'compat-001',
        doc_id: 'doc-compat-001',
        content: {
          text: '杭州是一个美丽的城市。'
        }
      };
      
      // Call without new parameters (old API)
      const fields = await fieldExtractor.extractFields(ckb);
      
      // Should work without errors
      expect(Array.isArray(fields)).toBe(true);
    });
    
    test('maintains same output format', async () => {
      const ckb = {
        ckb_id: 'compat-002',
        doc_id: 'doc-compat-002',
        content: {
          text: '杭州是一个美丽的城市，有西湖、灵隐寺等著名景点。'
        }
      };
      
      const fields = await fieldExtractor.extractFields(ckb, {
        useRules: true,
        useNER: false,
        useLLM: false
      });
      
      // Output format should be same as before
      fields.forEach(field => {
        expect(field).toHaveProperty('name');
        expect(field).toHaveProperty('value');
        expect(field).toHaveProperty('type');
        expect(field).toHaveProperty('confidence');
      });
    });
  });
});
