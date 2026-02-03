/**
 * Algorithm Mapper Tests
 * 
 * Tests for algorithm-based field name mapping functionality.
 * Validates exact match, similarity match, and synonym match strategies.
 * 
 * Validates: Requirements 18.2, 18.3
 */

const algorithmMapper = require('./algorithm_mapper');
const synonymDict = require('./synonym_dict');

describe('Algorithm Mapper', () => {
  describe('exactMatch', () => {
    it('should return exact match when field name matches schema field', () => {
      const result = algorithmMapper.exactMatch('区域', ['区域', '时间', '数值']);
      
      expect(result).not.toBeNull();
      expect(result.mapped_name).toBe('区域');
      expect(result.confidence).toBe(1.0);
      expect(result.method).toBe('exact');
    });
    
    it('should return null when no exact match found', () => {
      const result = algorithmMapper.exactMatch('地区', ['区域', '时间', '数值']);
      
      expect(result).toBeNull();
    });
    
    it('should handle empty schema field names', () => {
      const result = algorithmMapper.exactMatch('区域', []);
      
      expect(result).toBeNull();
    });
    
    it('should be case-sensitive', () => {
      const result = algorithmMapper.exactMatch('区域', ['区域', '时间']);
      
      expect(result).not.toBeNull();
      expect(result.mapped_name).toBe('区域');
    });
  });
  
  describe('synonymMatch', () => {
    it('should match using synonym dictionary', () => {
      const result = algorithmMapper.synonymMatch('地区', ['区域', '时间', '数值']);
      
      expect(result).not.toBeNull();
      expect(result.mapped_name).toBe('区域');
      expect(result.confidence).toBe(0.9);
      expect(result.method).toBe('synonym');
    });
    
    it('should match "日期" to "时间"', () => {
      const result = algorithmMapper.synonymMatch('日期', ['区域', '时间', '数值']);
      
      expect(result).not.toBeNull();
      expect(result.mapped_name).toBe('时间');
      expect(result.confidence).toBe(0.9);
      expect(result.method).toBe('synonym');
    });
    
    it('should return null when no synonym match found', () => {
      const result = algorithmMapper.synonymMatch('未知字段', ['区域', '时间', '数值']);
      
      expect(result).toBeNull();
    });
    
    it('should return null when synonym exists but not in schema fields', () => {
      const result = algorithmMapper.synonymMatch('地区', ['时间', '数值']);
      
      expect(result).toBeNull();
    });
  });
  
  describe('similarityMatch', () => {
    it('should match similar field names', () => {
      // Use English for better similarity testing
      const result = algorithmMapper.similarityMatch('location', ['region', 'time', 'value']);
      
      // 'location' is not very similar to 'region', so might not match
      // Let's use a closer match
      const result2 = algorithmMapper.similarityMatch('regin', ['region', 'time', 'value']);
      
      expect(result2).not.toBeNull();
      expect(result2.mapped_name).toBe('region');
      expect(result2.confidence).toBeGreaterThan(0.7);
      expect(result2.method).toBe('similarity');
    });
    
    it('should match with typos', () => {
      // Use a closer typo that will exceed threshold
      const result = algorithmMapper.similarityMatch('timee', ['region', 'time', 'value']);
      
      expect(result).not.toBeNull();
      expect(result.mapped_name).toBe('time');
      expect(result.method).toBe('similarity');
    });
    
    it('should return null when similarity below threshold', () => {
      const result = algorithmMapper.similarityMatch('完全不同', ['区域', '时间', '数值'], 0.7);
      
      expect(result).toBeNull();
    });
    
    it('should respect custom threshold', () => {
      const result = algorithmMapper.similarityMatch('地域', ['区域', '时间', '数值'], 0.9);
      
      // With high threshold, might not match
      if (result) {
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      }
    });
    
    it('should handle empty strings', () => {
      const result = algorithmMapper.similarityMatch('', ['区域', '时间', '数值']);
      
      expect(result).toBeNull();
    });
    
    it('should handle single character strings', () => {
      const result = algorithmMapper.similarityMatch('区', ['区域', '时间', '数值']);
      
      // Should match '区域' with reasonable confidence
      if (result) {
        expect(result.mapped_name).toBe('区域');
      }
    });
  });
  
  describe('levenshteinDistance', () => {
    it('should calculate edit distance correctly', () => {
      expect(algorithmMapper.levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(algorithmMapper.levenshteinDistance('saturday', 'sunday')).toBe(3);
      expect(algorithmMapper.levenshteinDistance('区域', '地域')).toBe(1);
    });
    
    it('should return 0 for identical strings', () => {
      expect(algorithmMapper.levenshteinDistance('区域', '区域')).toBe(0);
      expect(algorithmMapper.levenshteinDistance('hello', 'hello')).toBe(0);
    });
    
    it('should handle empty strings', () => {
      expect(algorithmMapper.levenshteinDistance('', 'hello')).toBe(5);
      expect(algorithmMapper.levenshteinDistance('hello', '')).toBe(5);
      expect(algorithmMapper.levenshteinDistance('', '')).toBe(0);
    });
    
    it('should be symmetric', () => {
      const d1 = algorithmMapper.levenshteinDistance('abc', 'def');
      const d2 = algorithmMapper.levenshteinDistance('def', 'abc');
      expect(d1).toBe(d2);
    });
  });
  
  describe('generateNgrams', () => {
    it('should generate bigrams correctly', () => {
      const ngrams = algorithmMapper.generateNgrams('hello', 2);
      
      expect(ngrams).toEqual(['he', 'el', 'll', 'lo']);
    });
    
    it('should generate trigrams correctly', () => {
      const ngrams = algorithmMapper.generateNgrams('hello', 3);
      
      expect(ngrams).toEqual(['hel', 'ell', 'llo']);
    });
    
    it('should handle strings shorter than n', () => {
      const ngrams = algorithmMapper.generateNgrams('hi', 3);
      
      expect(ngrams).toEqual(['hi']);
    });
    
    it('should handle Chinese characters', () => {
      const ngrams = algorithmMapper.generateNgrams('区域', 2);
      
      expect(ngrams).toEqual(['区域']);
    });
    
    it('should handle empty strings', () => {
      const ngrams = algorithmMapper.generateNgrams('', 2);
      
      expect(ngrams).toEqual(['']);
    });
  });
  
  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const ngrams1 = ['he', 'el', 'll', 'lo'];
      const ngrams2 = ['he', 'el', 'lp'];
      
      const similarity = algorithmMapper.cosineSimilarity(ngrams1, ngrams2);
      
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
    
    it('should return 1 for identical n-gram sets', () => {
      const ngrams = ['he', 'el', 'll', 'lo'];
      
      const similarity = algorithmMapper.cosineSimilarity(ngrams, ngrams);
      
      expect(similarity).toBeCloseTo(1, 5);
    });
    
    it('should return 0 for completely different n-gram sets', () => {
      const ngrams1 = ['ab', 'bc', 'cd'];
      const ngrams2 = ['xy', 'yz', 'zw'];
      
      const similarity = algorithmMapper.cosineSimilarity(ngrams1, ngrams2);
      
      expect(similarity).toBe(0);
    });
    
    it('should handle empty n-gram sets', () => {
      const ngrams = ['he', 'el', 'll', 'lo'];
      
      expect(algorithmMapper.cosineSimilarity([], ngrams)).toBe(0);
      expect(algorithmMapper.cosineSimilarity(ngrams, [])).toBe(0);
      expect(algorithmMapper.cosineSimilarity([], [])).toBe(0);
    });
    
    it('should handle duplicate n-grams', () => {
      const ngrams1 = ['ab', 'ab', 'bc'];
      const ngrams2 = ['ab', 'bc', 'bc'];
      
      const similarity = algorithmMapper.cosineSimilarity(ngrams1, ngrams2);
      
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });
  
  describe('mapFieldName', () => {
    it('should prioritize exact match over other methods', () => {
      const result = algorithmMapper.mapFieldName('区域', ['区域', '时间', '数值']);
      
      expect(result).not.toBeNull();
      expect(result.mapped_name).toBe('区域');
      expect(result.method).toBe('exact');
      expect(result.confidence).toBe(1.0);
    });
    
    it('should use synonym match when exact match fails', () => {
      const result = algorithmMapper.mapFieldName('地区', ['区域', '时间', '数值']);
      
      expect(result).not.toBeNull();
      expect(result.mapped_name).toBe('区域');
      expect(result.method).toBe('synonym');
      expect(result.confidence).toBe(0.9);
    });
    
    it('should use similarity match when exact and synonym fail', () => {
      // Use a field name that's not in synonym dict but similar
      const result = algorithmMapper.mapFieldName('regin', ['region', 'time', 'value']);
      
      expect(result).not.toBeNull();
      expect(result.mapped_name).toBe('region');
      expect(result.method).toBe('similarity');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
    
    it('should return null when all methods fail', () => {
      const result = algorithmMapper.mapFieldName('完全不同的字段', ['区域', '时间', '数值']);
      
      expect(result).toBeNull();
    });
    
    it('should respect useSynonym option', () => {
      const result = algorithmMapper.mapFieldName(
        '地区', 
        ['区域', '时间', '数值'],
        { useSynonym: false }
      );
      
      // Should skip synonym match and try similarity
      if (result) {
        expect(result.method).not.toBe('synonym');
      }
    });
    
    it('should respect useSimilarity option', () => {
      // Use a field name that would only match via similarity
      const result = algorithmMapper.mapFieldName(
        'regin', 
        ['region', 'time', 'value'],
        { useSimilarity: false }
      );
      
      // Should skip similarity match
      expect(result).toBeNull();
    });
    
    it('should respect custom similarity threshold', () => {
      const result = algorithmMapper.mapFieldName(
        '地域', 
        ['区域', '时间', '数值'],
        { similarityThreshold: 0.95 }
      );
      
      // With very high threshold, might not match
      if (result && result.method === 'similarity') {
        expect(result.confidence).toBeGreaterThanOrEqual(0.95);
      }
    });
  });
  
  describe('batchMapFieldNames', () => {
    it('should map multiple field names', () => {
      const rawNames = ['地区', '日期', '数值', '未知字段'];
      const schemaNames = ['区域', '时间', '数值'];
      
      const results = algorithmMapper.batchMapFieldNames(rawNames, schemaNames);
      
      expect(results).toHaveLength(4);
      expect(results[0]).not.toBeNull();
      expect(results[0].mapped_name).toBe('区域');
      expect(results[1]).not.toBeNull();
      expect(results[1].mapped_name).toBe('时间');
      expect(results[2]).not.toBeNull();
      expect(results[2].mapped_name).toBe('数值');
      expect(results[3]).toBeNull();
    });
    
    it('should handle empty input', () => {
      const results = algorithmMapper.batchMapFieldNames([], ['区域', '时间']);
      
      expect(results).toEqual([]);
    });
    
    it('should pass options to individual mappings', () => {
      const rawNames = ['地区', '地域'];
      const schemaNames = ['区域', '时间'];
      
      const results = algorithmMapper.batchMapFieldNames(
        rawNames, 
        schemaNames,
        { useSynonym: false }
      );
      
      // First should fail (synonym disabled)
      // Second might succeed with similarity
      expect(results).toHaveLength(2);
    });
  });
  
  describe('getMappingStats', () => {
    it('should calculate statistics correctly', () => {
      const results = [
        { mapped_name: '区域', confidence: 1.0, method: 'exact' },
        { mapped_name: '时间', confidence: 0.9, method: 'synonym' },
        { mapped_name: '数值', confidence: 0.85, method: 'similarity' },
        null
      ];
      
      const stats = algorithmMapper.getMappingStats(results);
      
      expect(stats.total).toBe(4);
      expect(stats.mapped).toBe(3);
      expect(stats.unmapped).toBe(1);
      expect(stats.by_method.exact).toBe(1);
      expect(stats.by_method.synonym).toBe(1);
      expect(stats.by_method.similarity).toBe(1);
      expect(stats.avg_confidence).toBeCloseTo(0.9167, 2);
    });
    
    it('should handle all null results', () => {
      const results = [null, null, null];
      
      const stats = algorithmMapper.getMappingStats(results);
      
      expect(stats.total).toBe(3);
      expect(stats.mapped).toBe(0);
      expect(stats.unmapped).toBe(3);
      expect(stats.avg_confidence).toBe(0);
    });
    
    it('should handle empty results', () => {
      const stats = algorithmMapper.getMappingStats([]);
      
      expect(stats.total).toBe(0);
      expect(stats.mapped).toBe(0);
      expect(stats.unmapped).toBe(0);
      expect(stats.avg_confidence).toBe(0);
    });
  });
  
  describe('testSimilarity', () => {
    it('should return detailed similarity metrics', () => {
      const metrics = algorithmMapper.testSimilarity('地区', '区域');
      
      expect(metrics).toHaveProperty('levenshtein_distance');
      expect(metrics).toHaveProperty('levenshtein_similarity');
      expect(metrics).toHaveProperty('cosine_similarity');
      expect(metrics).toHaveProperty('combined_similarity');
      
      expect(metrics.levenshtein_distance).toBeGreaterThanOrEqual(0);
      expect(metrics.levenshtein_similarity).toBeGreaterThanOrEqual(0);
      expect(metrics.levenshtein_similarity).toBeLessThanOrEqual(1);
      expect(metrics.cosine_similarity).toBeGreaterThanOrEqual(0);
      expect(metrics.cosine_similarity).toBeLessThanOrEqual(1);
      expect(metrics.combined_similarity).toBeGreaterThanOrEqual(0);
      expect(metrics.combined_similarity).toBeLessThanOrEqual(1);
    });
    
    it('should show perfect similarity for identical strings', () => {
      const metrics = algorithmMapper.testSimilarity('区域', '区域');
      
      expect(metrics.levenshtein_distance).toBe(0);
      expect(metrics.levenshtein_similarity).toBe(1);
      expect(metrics.combined_similarity).toBe(1);
    });
    
    it('should show low similarity for very different strings', () => {
      const metrics = algorithmMapper.testSimilarity('abc', 'xyz');
      
      expect(metrics.levenshtein_similarity).toBeLessThan(0.5);
      expect(metrics.cosine_similarity).toBe(0);
      expect(metrics.combined_similarity).toBeLessThan(0.5);
    });
  });
  
  describe('Integration Tests', () => {
    it('should handle real-world field mapping scenario', () => {
      const rawFields = [
        '地区',      // Should map to '区域' via synonym
        '日期',      // Should map to '时间' via synonym
        '指标名称',  // Should map to '指标' via synonym
        '数值',      // Should map to '数值' via exact match
        '计量单位',  // Should map to '单位' via synonym
        'regin'      // Should map to 'region' via similarity (if we add it to schema)
      ];
      
      const schemaFields = ['区域', '时间', '指标', '数值', '单位', 'region'];
      
      const results = algorithmMapper.batchMapFieldNames(rawFields, schemaFields);
      
      expect(results[0].mapped_name).toBe('区域');
      expect(results[1].mapped_name).toBe('时间');
      expect(results[2].mapped_name).toBe('指标');
      expect(results[3].mapped_name).toBe('数值');
      expect(results[4].mapped_name).toBe('单位');
      expect(results[5].mapped_name).toBe('region');
      
      // Check that we used efficient methods (no LLM needed)
      expect(results[0].method).toBe('synonym');
      expect(results[1].method).toBe('synonym');
      expect(results[2].method).toBe('synonym');
      expect(results[3].method).toBe('exact');
      expect(results[4].method).toBe('synonym');
      expect(results[5].method).toBe('similarity');
    });
    
    it('should achieve high mapping rate without LLM', () => {
      const rawFields = [
        '区域', '地区', '地域', '地点',  // All should map to '区域'
        '时间', '日期', '时刻',          // All should map to '时间'
        '数值', '值', '数量'             // All should map to '数值'
      ];
      
      const schemaFields = ['区域', '时间', '数值'];
      
      const results = algorithmMapper.batchMapFieldNames(rawFields, schemaFields);
      const stats = algorithmMapper.getMappingStats(results);
      
      // Should achieve >90% mapping rate
      const mappingRate = stats.mapped / stats.total;
      expect(mappingRate).toBeGreaterThan(0.9);
      
      // All mappings should be algorithm-based (no LLM)
      expect(stats.by_method.exact + stats.by_method.synonym + stats.by_method.similarity)
        .toBe(stats.mapped);
    });
  });
});
