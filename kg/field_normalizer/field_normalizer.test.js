/**
 * Field Normalizer - Unit Tests
 * 
 * Tests the 4-layer field mapping strategy:
 * 1. Exact Match
 * 2. Algorithm-based Match (similarity + synonym)
 * 3. LLM-based Match (mocked for testing)
 * 4. Fallback
 */

const {
  normalizeFields,
  batchNormalizeFields,
  cleanFieldValue,
  standardizeTime,
  standardizeNumber,
  getCachedMapping,
  cacheMapping,
  clearCache,
  getCacheStats,
  getNormalizationStats,
  algorithmMapper
} = require('./field_normalizer');

// Import algorithm functions from algorithm_mapper
const {
  exactMatch,
  synonymMatch,
  similarityMatch,
  levenshteinDistance,
  generateNgrams,
  cosineSimilarity
} = require('./algorithm_mapper');

// For backward compatibility, create algorithmMatch wrapper
const algorithmMatch = (rawFieldName, schemaFieldNames) => {
  return algorithmMapper.mapFieldName(rawFieldName, schemaFieldNames);
};

describe('Field Normalizer', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearCache();
  });
  
  describe('Layer 1: Exact Match', () => {
    test('should match exact field names', () => {
      const schemaFieldNames = ['区域', '时间', '指标', '数值', '单位'];
      
      const result = exactMatch('区域', schemaFieldNames);
      
      expect(result).toEqual({
        mapped_name: '区域',
        confidence: 1.0,
        method: 'exact'
      });
    });
    
    test('should return null for non-matching field names', () => {
      const schemaFieldNames = ['区域', '时间', '指标'];
      
      const result = exactMatch('地区', schemaFieldNames);
      
      expect(result).toBeNull();
    });
  });
  
  describe('Layer 2: Algorithm-based Match', () => {
    describe('Synonym Match', () => {
      test('should match synonyms from dictionary', () => {
        const schemaFieldNames = ['区域', '时间', '指标'];
        
        const result = algorithmMatch('地区', schemaFieldNames);
        
        expect(result).toEqual({
          mapped_name: '区域',
          confidence: 0.9,
          method: 'synonym'
        });
      });
      
      test('should match time synonyms', () => {
        const schemaFieldNames = ['时间', '区域'];
        
        const result = algorithmMatch('日期', schemaFieldNames);
        
        expect(result).toEqual({
          mapped_name: '时间',
          confidence: 0.9,
          method: 'synonym'
        });
      });
    });
    
    describe('Similarity Match', () => {
      test('should match similar field names', () => {
        const schemaFieldNames = ['location', 'time', 'indicator'];
        
        // "locaton" is similar to "location" (missing 'i')
        const result = similarityMatch('locaton', schemaFieldNames);
        
        expect(result).not.toBeNull();
        expect(result.mapped_name).toBe('location');
        expect(result.method).toBe('similarity');
        expect(result.confidence).toBeGreaterThan(0.7);
      });
      
      test('should not match dissimilar field names', () => {
        const schemaFieldNames = ['区域', '时间', '指标'];
        
        const result = similarityMatch('完全不同的字段', schemaFieldNames);
        
        expect(result).toBeNull();
      });
    });
  });
  
  describe('Levenshtein Distance', () => {
    test('should calculate edit distance correctly', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('区域', '地域')).toBe(1);
      expect(levenshteinDistance('abc', 'abc')).toBe(0);
      expect(levenshteinDistance('', 'abc')).toBe(3);
    });
  });
  
  describe('N-grams', () => {
    test('should generate character bigrams', () => {
      const ngrams = generateNgrams('区域', 2);
      expect(ngrams).toEqual(['区域']);
    });
    
    test('should generate bigrams for longer strings', () => {
      const ngrams = generateNgrams('abcd', 2);
      expect(ngrams).toEqual(['ab', 'bc', 'cd']);
    });
    
    test('should handle empty strings', () => {
      const ngrams = generateNgrams('', 2);
      expect(ngrams).toEqual(['']);
    });
  });
  
  describe('Cosine Similarity', () => {
    test('should calculate similarity for identical n-grams', () => {
      const ngrams1 = ['ab', 'bc', 'cd'];
      const ngrams2 = ['ab', 'bc', 'cd'];
      
      const similarity = cosineSimilarity(ngrams1, ngrams2);
      
      expect(similarity).toBeCloseTo(1.0, 5);
    });
    
    test('should calculate similarity for different n-grams', () => {
      const ngrams1 = ['ab', 'bc'];
      const ngrams2 = ['cd', 'de'];
      
      const similarity = cosineSimilarity(ngrams1, ngrams2);
      
      expect(similarity).toBe(0);
    });
    
    test('should handle empty n-grams', () => {
      const similarity = cosineSimilarity([], ['ab', 'bc']);
      expect(similarity).toBe(0);
    });
  });
  
  describe('Field Value Cleaning', () => {
    test('should remove extra whitespace', () => {
      const field = {
        name: '区域',
        value: '  阿里C区  ',
        type: 'location',
        confidence: 0.95
      };
      
      const cleaned = cleanFieldValue(field);
      
      expect(cleaned.value).toBe('阿里C区');
    });
    
    test('should remove special characters', () => {
      const field = {
        name: '区域',
        value: '阿里C区@#$',
        type: 'location',
        confidence: 0.95
      };
      
      const cleaned = cleanFieldValue(field);
      
      expect(cleaned.value).toBe('阿里C区');
    });
    
    test('should standardize time values', () => {
      const field = {
        name: '时间',
        value: '2025年1月',
        type: 'time',
        confidence: 0.95
      };
      
      const cleaned = cleanFieldValue(field);
      
      expect(cleaned.value).toBe('2025-01');
    });
    
    test('should standardize number values', () => {
      const field = {
        name: '数值',
        value: '1,234.56',
        type: 'number',
        confidence: 0.95
      };
      
      const cleaned = cleanFieldValue(field);
      
      expect(cleaned.value).toBe('1234.56');
    });
  });
  
  describe('Time Standardization', () => {
    test('should convert Chinese date format', () => {
      expect(standardizeTime('2025年1月')).toBe('2025-01');
      expect(standardizeTime('2025年12月')).toBe('2025-12');
    });
    
    test('should convert slash format', () => {
      expect(standardizeTime('2025/01/26')).toBe('2025-01-26');
      expect(standardizeTime('2025/1/6')).toBe('2025-01-06');
    });
    
    test('should convert dot format', () => {
      expect(standardizeTime('2025.01.26')).toBe('2025-01-26');
    });
    
    test('should keep ISO format unchanged', () => {
      expect(standardizeTime('2025-01-26')).toBe('2025-01-26');
    });
  });
  
  describe('Number Standardization', () => {
    test('should remove thousand separators', () => {
      expect(standardizeNumber('1,234,567')).toBe('1234567');
    });
    
    test('should remove spaces', () => {
      expect(standardizeNumber('1 234.56')).toBe('1234.56');
    });
    
    test('should handle negative numbers', () => {
      expect(standardizeNumber('-123.45')).toBe('-123.45');
    });
    
    test('should keep valid numbers unchanged', () => {
      expect(standardizeNumber('123.45')).toBe('123.45');
    });
  });
  
  describe('Caching', () => {
    test('should cache mapping results', () => {
      const mapping = {
        mapped_name: '区域',
        confidence: 0.9,
        method: 'synonym'
      };
      
      cacheMapping('地区', 'TestSchema', mapping);
      
      const cached = getCachedMapping('地区', 'TestSchema');
      
      expect(cached).toEqual(mapping);
    });
    
    test('should return null for non-cached mappings', () => {
      const cached = getCachedMapping('未缓存字段', 'TestSchema');
      
      expect(cached).toBeNull();
    });
    
    test('should clear cache', () => {
      cacheMapping('地区', 'TestSchema', { mapped_name: '区域' });
      
      clearCache();
      
      const stats = getCacheStats();
      expect(stats.size).toBe(0);
    });
    
    test('should provide cache statistics', () => {
      cacheMapping('地区', 'Schema1', { mapped_name: '区域' });
      cacheMapping('日期', 'Schema2', { mapped_name: '时间' });
      
      const stats = getCacheStats();
      
      expect(stats.size).toBe(2);
      expect(stats.hits).toBeGreaterThanOrEqual(0);
      expect(stats.misses).toBeGreaterThanOrEqual(0);
      expect(stats.sets).toBe(2);
    });
  });
  
  describe('normalizeFields', () => {
    const schema = {
      schema_name: '地下水位变化事件',
      core_fields: [
        { name: '区域', weight: 0.3, required: true },
        { name: '时间', weight: 0.2, required: true },
        { name: '指标', weight: 0.2, required: true },
        { name: '数值', weight: 0.2, required: false },
        { name: '单位', weight: 0.1, required: false }
      ],
      threshold: 0.75
    };
    
    test('should normalize fields with exact matches', async () => {
      const rawFields = [
        { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 },
        { name: '时间', value: '2025-01', type: 'time', confidence: 0.95 }
      ];
      
      const normalized = await normalizeFields(rawFields, schema);
      
      expect(normalized).toHaveLength(2);
      expect(normalized[0].name).toBe('区域');
      expect(normalized[0].mapping_method).toBe('exact');
      expect(normalized[0].mapping_confidence).toBe(1.0);
    });
    
    test('should normalize fields with synonym matches', async () => {
      const rawFields = [
        { name: '地区', value: '阿里C区', type: 'location', confidence: 0.95 },
        { name: '日期', value: '2025-01', type: 'time', confidence: 0.95 }
      ];
      
      const normalized = await normalizeFields(rawFields, schema);
      
      expect(normalized).toHaveLength(2);
      expect(normalized[0].name).toBe('区域');
      expect(normalized[0].original_name).toBe('地区');
      expect(normalized[0].mapping_method).toBe('synonym');
      expect(normalized[0].mapping_confidence).toBe(0.9);
      
      expect(normalized[1].name).toBe('时间');
      expect(normalized[1].original_name).toBe('日期');
      expect(normalized[1].mapping_method).toBe('synonym');
    });
    
    test('should clean field values', async () => {
      const rawFields = [
        { name: '区域', value: '  阿里C区  ', type: 'location', confidence: 0.95 },
        { name: '时间', value: '2025年1月', type: 'time', confidence: 0.95 }
      ];
      
      const normalized = await normalizeFields(rawFields, schema);
      
      expect(normalized[0].value).toBe('阿里C区');
      expect(normalized[1].value).toBe('2025-01');
    });
    
    test('should handle unmapped fields', async () => {
      const rawFields = [
        { name: '未知字段', value: '某个值', type: 'unknown', confidence: 0.5 }
      ];
      
      const normalized = await normalizeFields(rawFields, schema);
      
      expect(normalized).toHaveLength(1);
      expect(normalized[0].name).toBe('未知字段');
      expect(normalized[0].mapping_method).toBe('none');
      expect(normalized[0].mapping_confidence).toBe(0.3);
    });
    
    test('should use cache for repeated mappings', async () => {
      const rawFields = [
        { name: '地区', value: '阿里C区', type: 'location', confidence: 0.95 }
      ];
      
      // First call - should compute and cache
      const normalized1 = await normalizeFields(rawFields, schema);
      
      // Second call - should use cache
      const normalized2 = await normalizeFields(rawFields, schema);
      
      expect(normalized1).toEqual(normalized2);
      
      const stats = getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });
    
    test('should skip value cleaning when disabled', async () => {
      const rawFields = [
        { name: '区域', value: '  阿里C区  ', type: 'location', confidence: 0.95 }
      ];
      
      const normalized = await normalizeFields(rawFields, schema, { cleanValues: false });
      
      expect(normalized[0].value).toBe('  阿里C区  ');
    });
    
    test('should handle empty field array', async () => {
      const normalized = await normalizeFields([], schema);
      
      expect(normalized).toEqual([]);
    });
    
    test('should throw error for invalid inputs', async () => {
      await expect(normalizeFields(null, schema)).rejects.toThrow();
      await expect(normalizeFields([], null)).rejects.toThrow();
      await expect(normalizeFields([], {})).rejects.toThrow();
    });
  });
  
  describe('batchNormalizeFields', () => {
    const schema1 = {
      schema_name: 'Schema1',
      core_fields: [
        { name: '区域', weight: 0.5, required: true },
        { name: '时间', weight: 0.5, required: true }
      ]
    };
    
    const schema2 = {
      schema_name: 'Schema2',
      core_fields: [
        { name: '指标', weight: 0.5, required: true },
        { name: '数值', weight: 0.5, required: true }
      ]
    };
    
    test('should normalize multiple field sets', async () => {
      const rawFieldsList = [
        [
          { name: '地区', value: '阿里C区', type: 'location', confidence: 0.95 }
        ],
        [
          { name: '指标', value: '水位', type: 'indicator', confidence: 0.95 }
        ]
      ];
      
      const schemas = [schema1, schema2];
      
      const results = await batchNormalizeFields(rawFieldsList, schemas);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveLength(1);
      expect(results[0][0].name).toBe('区域');
      expect(results[1]).toHaveLength(1);
      expect(results[1][0].name).toBe('指标');
    });
    
    test('should handle errors gracefully', async () => {
      const rawFieldsList = [
        [{ name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 }],
        null // This will cause an error
      ];
      
      const schemas = [schema1, schema2];
      
      const results = await batchNormalizeFields(rawFieldsList, schemas);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveLength(1);
      expect(results[1]).toEqual([]);
    });
    
    test('should throw error for mismatched array lengths', async () => {
      const rawFieldsList = [[]];
      const schemas = [schema1, schema2];
      
      await expect(batchNormalizeFields(rawFieldsList, schemas)).rejects.toThrow();
    });
  });
  
  describe('getNormalizationStats', () => {
    test('should calculate statistics correctly', () => {
      const normalizedFields = [
        { name: '区域', mapping_method: 'exact', mapping_confidence: 1.0 },
        { name: '时间', mapping_method: 'synonym', mapping_confidence: 0.9 },
        { name: '指标', mapping_method: 'similarity', mapping_confidence: 0.8 },
        { name: '未知', mapping_method: 'none', mapping_confidence: 0.3 }
      ];
      
      const stats = getNormalizationStats(normalizedFields);
      
      expect(stats.total).toBe(4);
      expect(stats.by_method.exact).toBe(1);
      expect(stats.by_method.synonym).toBe(1);
      expect(stats.by_method.similarity).toBe(1);
      expect(stats.by_method.none).toBe(1);
      expect(stats.unmapped_count).toBe(1);
      expect(stats.avg_mapping_confidence).toBeCloseTo(0.75, 2);
    });
    
    test('should handle empty array', () => {
      const stats = getNormalizationStats([]);
      
      expect(stats.total).toBe(0);
      expect(stats.avg_mapping_confidence).toBe(0);
      expect(stats.unmapped_count).toBe(0);
    });
  });
  
  describe('Layer 2.5: Fuzzy Semantic Match', () => {
    const { fuzzySemanticMatch } = require('./field_normalizer');
    
    const testSchema = {
      schema_name: 'Test Schema',
      core_fields: [
        { name: '时间', weight: 0.2, required: true },
        { name: '区域', weight: 0.3, required: true },
        { name: '数值', weight: 0.2, required: false },
        { name: '指标', weight: 0.2, required: false },
        { name: '单位', weight: 0.1, required: false }
      ]
    };
    
    describe('Type-based semantic inference', () => {
      test('should infer time field from time type', () => {
        const field = {
          name: '未知字段',
          value: '2025-01-26',
          type: 'time',
          confidence: 0.9
        };
        
        const result = fuzzySemanticMatch(field, testSchema);
        
        expect(result).not.toBeNull();
        expect(result.mapped_name).toBe('时间');
        expect(result.confidence).toBe(0.75);
        expect(result.method).toBe('semantic_inference');
      });
      
      test('should infer location field from location type', () => {
        const field = {
          name: '未知字段',
          value: '阿里C区',
          type: 'location',
          confidence: 0.9
        };
        
        const result = fuzzySemanticMatch(field, testSchema);
        
        expect(result).not.toBeNull();
        expect(result.mapped_name).toBe('区域');
        expect(result.confidence).toBe(0.75);
        expect(result.method).toBe('semantic_inference');
      });
      
      test('should infer number field from number type', () => {
        const field = {
          name: '未知字段',
          value: '10',
          type: 'number',
          confidence: 0.9
        };
        
        const result = fuzzySemanticMatch(field, testSchema);
        
        expect(result).not.toBeNull();
        expect(result.mapped_name).toBe('数值');
        expect(result.confidence).toBe(0.75);
        expect(result.method).toBe('semantic_inference');
      });
      
      test('should infer indicator field from indicator type', () => {
        const field = {
          name: '未知字段',
          value: '水位',
          type: 'indicator',
          confidence: 0.9
        };
        
        const result = fuzzySemanticMatch(field, testSchema);
        
        expect(result).not.toBeNull();
        expect(result.mapped_name).toBe('指标');
        expect(result.confidence).toBe(0.75);
        expect(result.method).toBe('semantic_inference');
      });
    });
    
    describe('Context-based fuzzy matching', () => {
      test('should infer from context keywords', () => {
        const field = {
          name: '未知字段',
          value: 'ABC',
          type: null,
          context: '区域：阿里C区',  // More explicit context with field name
          confidence: 0.9
        };
        
        const result = fuzzySemanticMatch(field, testSchema);
        
        expect(result).not.toBeNull();
        expect(result.mapped_name).toBe('区域');
        expect(result.confidence).toBe(0.7);
        expect(result.method).toBe('context_fuzzy');
      });
      
      test('should handle context with punctuation', () => {
        const field = {
          name: '未知字段',
          value: '2025-01',
          type: null,
          context: '时间：2025年1月',
          confidence: 0.9
        };
        
        const result = fuzzySemanticMatch(field, testSchema);
        
        expect(result).not.toBeNull();
        expect(result.mapped_name).toBe('时间');
        expect(result.confidence).toBe(0.7);
        expect(result.method).toBe('context_fuzzy');
      });
    });
    
    describe('Value-based inference', () => {
      test('should infer time field from date format', () => {
        const field = {
          name: '未知字段',
          value: '2025-01-26',
          type: null,
          confidence: 0.9
        };
        
        const result = fuzzySemanticMatch(field, testSchema);
        
        expect(result).not.toBeNull();
        expect(result.mapped_name).toBe('时间');
        expect(result.confidence).toBe(0.8);
        expect(result.method).toBe('value_inference');
      });
      
      test('should infer time field from Chinese date format', () => {
        const field = {
          name: '未知字段',
          value: '2025年1月26日',
          type: null,
          confidence: 0.9
        };
        
        const result = fuzzySemanticMatch(field, testSchema);
        
        expect(result).not.toBeNull();
        expect(result.mapped_name).toBe('时间');
        expect(result.confidence).toBe(0.8);
        expect(result.method).toBe('value_inference');
      });
      
      test('should infer location field from location indicators', () => {
        const field = {
          name: '未知字段',
          value: '北京市海淀区',
          type: null,
          confidence: 0.9
        };
        
        const result = fuzzySemanticMatch(field, testSchema);
        
        expect(result).not.toBeNull();
        expect(result.mapped_name).toBe('区域');
        expect(result.confidence).toBe(0.8);
        expect(result.method).toBe('value_inference');
      });
      
      test('should infer number field from number with unit', () => {
        const field = {
          name: '未知字段',
          value: '10米',
          type: null,
          confidence: 0.9
        };
        
        const result = fuzzySemanticMatch(field, testSchema);
        
        expect(result).not.toBeNull();
        expect(result.mapped_name).toBe('数值');
        expect(result.confidence).toBe(0.8);
        expect(result.method).toBe('value_inference');
      });
    });
    
    describe('Edge cases', () => {
      test('should return null for field without type, context, or recognizable value', () => {
        const field = {
          name: '完全未知',
          value: 'xyz',
          type: null,
          confidence: 0.9
        };
        
        const result = fuzzySemanticMatch(field, testSchema);
        
        expect(result).toBeNull();
      });
      
      test('should return null for invalid inputs', () => {
        expect(fuzzySemanticMatch(null, testSchema)).toBeNull();
        expect(fuzzySemanticMatch({}, null)).toBeNull();
        expect(fuzzySemanticMatch({}, { core_fields: null })).toBeNull();
      });
      
      test('should prioritize type-based inference over context', () => {
        const field = {
          name: '未知字段',
          value: '2025-01-26',
          type: 'time',
          context: '区域信息',
          confidence: 0.9
        };
        
        const result = fuzzySemanticMatch(field, testSchema);
        
        expect(result).not.toBeNull();
        expect(result.mapped_name).toBe('时间');
        expect(result.method).toBe('semantic_inference');
      });
    });
  });
});

  // Task 7.13.2: Mapping Suggestion Tests
  describe('suggestMapping - Task 7.13.2', () => {
    const { suggestMapping } = require('./field_normalizer');
    
    const testSchema = {
      schema_name: '测试Schema',
      core_fields: [
        { name: '区域', weight: 0.3, required: true },
        { name: '时间', weight: 0.2, required: true },
        { name: '地点', weight: 0.15, required: false },
        { name: '位置', weight: 0.1, required: false },
        { name: '数值', weight: 0.2, required: false },
        { name: '单位', weight: 0.05, required: false }
      ]
    };
    
    test('should return top 3 suggestions for unmapped field', () => {
      const field = {
        name: '地方',
        value: '北京市海淀区',
        type: 'location',
        confidence: 0.9
      };
      
      const suggestions = suggestMapping(field, testSchema);
      
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toHaveProperty('fieldName');
      expect(suggestions[0]).toHaveProperty('similarity');
      expect(suggestions[0]).toHaveProperty('reason');
      expect(suggestions[0]).toHaveProperty('breakdown');
      
      // Should suggest location-related fields
      const suggestedNames = suggestions.map(s => s.fieldName);
      expect(suggestedNames).toContain('地点');
    });
    
    test('should rank suggestions by similarity score', () => {
      const field = {
        name: '日期',
        value: '2025-01-26',
        type: 'time',
        confidence: 0.95
      };
      
      const suggestions = suggestMapping(field, testSchema);
      
      expect(suggestions).toHaveLength(3);
      
      // Scores should be in descending order
      for (let i = 0; i < suggestions.length - 1; i++) {
        expect(suggestions[i].similarity).toBeGreaterThanOrEqual(suggestions[i + 1].similarity);
      }
      
      // '时间' should be the top suggestion due to type match
      expect(suggestions[0].fieldName).toBe('时间');
      expect(suggestions[0].similarity).toBeGreaterThan(0.5);
    });
    
    test('should provide detailed breakdown of similarity scores', () => {
      const field = {
        name: '地区',
        value: '阿里C区',
        type: 'location',
        context: '区域：阿里C区',
        confidence: 0.9
      };
      
      const suggestions = suggestMapping(field, testSchema);
      
      expect(suggestions[0].breakdown).toHaveProperty('string_similarity');
      expect(suggestions[0].breakdown).toHaveProperty('semantic_similarity');
      expect(suggestions[0].breakdown).toHaveProperty('type_compatibility');
      expect(suggestions[0].breakdown).toHaveProperty('context_relevance');
      
      // All breakdown scores should be between 0 and 1
      const breakdown = suggestions[0].breakdown;
      expect(breakdown.string_similarity).toBeGreaterThanOrEqual(0);
      expect(breakdown.string_similarity).toBeLessThanOrEqual(1);
      expect(breakdown.semantic_similarity).toBeGreaterThanOrEqual(0);
      expect(breakdown.semantic_similarity).toBeLessThanOrEqual(1);
    });
    
    test('should identify high string similarity as primary reason', () => {
      const field = {
        name: '区域信息',
        value: 'ABC',
        type: null,
        confidence: 0.9
      };
      
      const suggestions = suggestMapping(field, testSchema);
      
      // '区域' should be in top suggestions due to high string similarity
      expect(suggestions[0].fieldName).toBe('区域');
      // The reason should be either high_string_similarity or low_confidence
      // depending on the exact similarity score
      expect(['high_string_similarity', 'low_confidence']).toContain(suggestions[0].reason);
    });
    
    test('should identify semantic category match as reason', () => {
      const field = {
        name: '发生时间',
        value: '2025-01',
        type: 'time',
        confidence: 0.9
      };
      
      const suggestions = suggestMapping(field, testSchema);
      
      // Should suggest '时间' with semantic match reason
      const timeSuggestion = suggestions.find(s => s.fieldName === '时间');
      expect(timeSuggestion).toBeDefined();
      expect(timeSuggestion.reason).toMatch(/semantic_category_match|type_match/);
    });
    
    test('should handle field with context information', () => {
      const field = {
        name: '未知字段',
        value: '10',
        type: 'number',
        context: '数值：10米',
        confidence: 0.9
      };
      
      const suggestions = suggestMapping(field, testSchema);
      
      // Should suggest '数值' due to context
      const numSuggestion = suggestions.find(s => s.fieldName === '数值');
      expect(numSuggestion).toBeDefined();
      expect(numSuggestion.similarity).toBeGreaterThan(0.5);
    });
    
    test('should return empty array for invalid inputs', () => {
      expect(suggestMapping(null, testSchema)).toEqual([]);
      expect(suggestMapping({}, null)).toEqual([]);
      expect(suggestMapping({}, { core_fields: null })).toEqual([]);
    });
    
    test('should support custom topN parameter', () => {
      const field = {
        name: '地方',
        value: '北京',
        type: 'location',
        confidence: 0.9
      };
      
      const suggestions = suggestMapping(field, testSchema, { topN: 5 });
      
      expect(suggestions.length).toBeLessThanOrEqual(5);
      expect(suggestions.length).toBeGreaterThan(0);
    });
    
    test('should calculate similarity for all schema fields', () => {
      const field = {
        name: '测试字段',
        value: 'test',
        type: null,
        confidence: 0.9
      };
      
      const suggestions = suggestMapping(field, testSchema, { topN: 10 });
      
      // Should return suggestions for all 6 schema fields
      expect(suggestions.length).toBe(6);
      
      // All suggestions should have valid similarity scores
      suggestions.forEach(suggestion => {
        expect(suggestion.similarity).toBeGreaterThanOrEqual(0);
        expect(suggestion.similarity).toBeLessThanOrEqual(1);
      });
    });
    
    test('should prioritize fields with multiple matching dimensions', () => {
      const field = {
        name: '地点名称',
        value: '北京市',
        type: 'location',
        context: '地点：北京市',
        confidence: 0.95
      };
      
      const suggestions = suggestMapping(field, testSchema);
      
      // '地点' should be top suggestion (string similarity + type + context)
      expect(suggestions[0].fieldName).toBe('地点');
      expect(suggestions[0].similarity).toBeGreaterThan(0.7);
    });
  });
