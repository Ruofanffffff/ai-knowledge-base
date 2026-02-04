/**
 * Tests for Mapping-Based Field Normalizer
 */

const MappingBasedNormalizer = require('./mapping_based_normalizer');

describe('MappingBasedNormalizer', () => {
  let normalizer;

  beforeEach(() => {
    normalizer = new MappingBasedNormalizer();
  });

  describe('loadMappings', () => {
    it('should load schema field mappings', async () => {
      const mappings = await normalizer.loadMappings();
      
      expect(mappings).toBeDefined();
      expect(mappings['旅游目的地推荐']).toBeDefined();
      expect(mappings['旅游目的地推荐']['目的地名称']).toBeDefined();
    });

    it('should cache mappings after first load', async () => {
      const mappings1 = await normalizer.loadMappings();
      const mappings2 = await normalizer.loadMappings();
      
      expect(mappings1).toBe(mappings2);
    });
  });

  describe('_algorithmMap', () => {
    beforeEach(async () => {
      await normalizer.loadMappings();
    });

    it('should map field with exact match', () => {
      const field = { name: '目的地名称', value: '杭州' };
      const schemaMapping = normalizer.mappings['旅游目的地推荐'];
      
      const result = normalizer._algorithmMap(field, schemaMapping);
      
      expect(result).toBeDefined();
      expect(result.standardName).toBe('目的地名称');
      expect(result.confidence).toBe(1.0);
      expect(result.mappingMethod).toBe('exact');
    });

    it('should map field with variation match', () => {
      const field = { name: '目的地', value: '杭州' };
      const schemaMapping = normalizer.mappings['旅游目的地推荐'];
      
      const result = normalizer._algorithmMap(field, schemaMapping);
      
      expect(result).toBeDefined();
      expect(result.standardName).toBe('目的地名称');
      expect(result.confidence).toBe(0.95);
      expect(result.mappingMethod).toBe('variation');
    });

    it('should map field with fuzzy match', () => {
      const field = { name: '人均费用', value: '800元' };
      const schemaMapping = normalizer.mappings['旅游目的地推荐'];
      
      const result = normalizer._algorithmMap(field, schemaMapping);
      
      expect(result).toBeDefined();
      expect(result.standardName).toBe('预算范围');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should return null for unmappable field', () => {
      const field = { name: '未知字段', value: '某个值' };
      const schemaMapping = normalizer.mappings['旅游目的地推荐'];
      
      const result = normalizer._algorithmMap(field, schemaMapping);
      
      expect(result).toBeNull();
    });
  });

  describe('normalizeFields', () => {
    const travelSchema = {
      name: '旅游目的地推荐',
      coreFields: JSON.stringify([
        { name: '目的地名称', weight: 0.3, required: true },
        { name: '推荐理由', weight: 0.25, required: false },
        { name: '最佳时间', weight: 0.2, required: false },
        { name: '预算范围', weight: 0.15, required: false },
        { name: '交通方式', weight: 0.1, required: false }
      ])
    };

    it('should normalize fields using algorithm mapping', async () => {
      const extractedFields = [
        { name: '目的地', value: '杭州' },
        { name: '人均费用', value: '800元' },
        { name: '最佳季节', value: '冬天' }
      ];

      const result = await normalizer.normalizeFields(extractedFields, travelSchema, {
        useLLM: false
      });

      expect(result.normalizedFields.length).toBeGreaterThan(0);
      expect(result.stats.algorithmMapped).toBeGreaterThan(0);
      expect(result.stats.llmMapped).toBe(0);
    });

    it('should calculate completeness correctly', async () => {
      const extractedFields = [
        { name: '目的地', value: '杭州' },
        { name: '人均费用', value: '800元' },
        { name: '最佳季节', value: '冬天' }
      ];

      const result = await normalizer.normalizeFields(extractedFields, travelSchema, {
        useLLM: false
      });

      expect(result.completeness).toBeGreaterThan(0);
      expect(result.completeness).toBeLessThanOrEqual(1);
      expect(result.weightedCompleteness).toBeGreaterThan(0);
    });

    it('should use LLM for unmapped fields when enabled', async () => {
      const extractedFields = [
        { name: '目的地', value: '杭州' },
        { name: '未知字段', value: '某个值' }
      ];

      const mockLLMNormalizer = jest.fn().mockResolvedValue({
        normalizedFields: [
          { originalName: '未知字段', standardName: '推荐理由', value: '某个值', confidence: 0.7 }
        ]
      });

      const result = await normalizer.normalizeFields(extractedFields, travelSchema, {
        useLLM: true,
        llmNormalizer: mockLLMNormalizer
      });

      expect(mockLLMNormalizer).toHaveBeenCalled();
      expect(result.stats.llmMapped).toBeGreaterThan(0);
    });

    it('should handle schema without mapping', async () => {
      const unknownSchema = {
        name: '未知Schema',
        coreFields: JSON.stringify([])
      };

      const extractedFields = [
        { name: '字段1', value: '值1' }
      ];

      const result = await normalizer.normalizeFields(extractedFields, unknownSchema, {
        useLLM: false
      });

      expect(result.normalizedFields.length).toBe(0);
      expect(result.unmappedFields.length).toBe(1);
    });
  });

  describe('analyzeCoverage', () => {
    it('should analyze field mapping coverage', async () => {
      const extractedFields = [
        { name: '目的地', value: '杭州' },
        { name: '人均费用', value: '800元' },
        { name: '未知字段', value: '某个值' }
      ];

      const result = await normalizer.analyzeCoverage(extractedFields, '旅游目的地推荐');

      expect(result.coverage).toBeGreaterThan(0);
      expect(result.coverage).toBeLessThan(1);
      expect(result.mappableFields).toBe(2);
      expect(result.unmappableFields).toBe(1);
      expect(result.unmappableFieldNames).toContain('未知字段');
    });

    it('should return zero coverage for unknown schema', async () => {
      const extractedFields = [
        { name: '字段1', value: '值1' }
      ];

      const result = await normalizer.analyzeCoverage(extractedFields, '未知Schema');

      expect(result.coverage).toBe(0);
      expect(result.unmappableFields).toBe(1);
    });
  });

  describe('addFieldMapping', () => {
    it('should add new field mapping', async () => {
      await normalizer.addFieldMapping(
        '旅游目的地推荐',
        '目的地名称',
        ['新说法1', '新说法2']
      );

      const mappings = await normalizer.loadMappings();
      const variations = mappings['旅游目的地推荐']['目的地名称'].common_variations;

      expect(variations).toContain('新说法1');
      expect(variations).toContain('新说法2');
    });

    it('should not add duplicate variations', async () => {
      await normalizer.addFieldMapping(
        '旅游目的地推荐',
        '目的地名称',
        ['目的地', '新说法']
      );

      const mappings = await normalizer.loadMappings();
      const variations = mappings['旅游目的地推荐']['目的地名称'].common_variations;

      const count = variations.filter(v => v === '目的地').length;
      expect(count).toBe(1);
    });
  });

  describe('stats tracking', () => {
    it('should track mapping statistics', async () => {
      const travelSchema = {
        name: '旅游目的地推荐',
        coreFields: JSON.stringify([
          { name: '目的地名称', weight: 0.3, required: true }
        ])
      };

      const extractedFields = [
        { name: '目的地', value: '杭州' },
        { name: '未知字段', value: '值' }
      ];

      await normalizer.normalizeFields(extractedFields, travelSchema, {
        useLLM: false
      });

      const stats = normalizer.getStats();

      expect(stats.totalFields).toBe(2);
      expect(stats.algorithmMapped).toBe(1);
      expect(stats.unmapped).toBe(1);
    });

    it('should reset statistics', () => {
      normalizer.stats.totalFields = 10;
      normalizer.resetStats();

      const stats = normalizer.getStats();
      expect(stats.totalFields).toBe(0);
    });
  });
});
