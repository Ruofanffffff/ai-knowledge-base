/**
 * Unit Tests for Intelligent Field Truncating Strategy
 * 
 * Tests all scoring functions and field selection logic.
 * 
 * Validates: Requirements 19.1-19.15
 */

const {
  calculateFieldImportance,
  calculateSemanticRelevance,
  calculateContextRelevance,
  selectRelevantFields,
  adaptTruncatingStrategy,
  getFieldMappingFrequency,
  updateFieldMappingFrequency,
  clearFrequencyCache
} = require('./intelligent_truncating');

describe('Intelligent Field Truncating', () => {
  
  beforeEach(() => {
    // Clear frequency cache before each test
    clearFrequencyCache();
  });
  
  describe('calculateFieldImportance', () => {
    
    test('should calculate importance for high-weight required field', () => {
      const field = {
        name: '时间',
        weight: 0.3,
        required: true
      };
      const schema = { core_fields: [field] };
      
      const score = calculateFieldImportance(field, schema);
      
      // weight(0.3)*40 + required(20) + frequency(0.5)*20 + universal(20) = 12 + 20 + 10 + 20 = 62
      expect(score).toBeGreaterThanOrEqual(50);
      expect(score).toBeLessThanOrEqual(70);
    });
    
    test('should calculate importance for low-weight optional field', () => {
      const field = {
        name: '备注',
        weight: 0.05,
        required: false
      };
      const schema = { core_fields: [field] };
      
      const score = calculateFieldImportance(field, schema);
      
      // weight(0.05)*40 + required(0) + frequency(0.5)*20 + universal(0) = 2 + 0 + 10 + 0 = 12
      expect(score).toBeGreaterThanOrEqual(10);
      expect(score).toBeLessThanOrEqual(15);
    });
    
    test('should give bonus to universal fields', () => {
      const universalField = {
        name: '时间',
        weight: 0.2,
        required: false
      };
      const nonUniversalField = {
        name: '备注',
        weight: 0.2,
        required: false
      };
      const schema = { core_fields: [universalField, nonUniversalField] };
      
      const universalScore = calculateFieldImportance(universalField, schema);
      const nonUniversalScore = calculateFieldImportance(nonUniversalField, schema);
      
      // Universal field should score 20 points higher
      expect(universalScore - nonUniversalScore).toBeCloseTo(20, 1);
    });
    
    test('should handle field with no weight', () => {
      const field = {
        name: '描述',
        required: false
      };
      const schema = { core_fields: [field] };
      
      const score = calculateFieldImportance(field, schema);
      
      // Should not throw error and return valid score
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
    
  });
  
  describe('calculateSemanticRelevance', () => {
    
    test('should score high for similar field names', () => {
      const score = calculateSemanticRelevance('日期', '时间');
      
      // Both are temporal fields, should have category bonus (30 points)
      expect(score).toBeGreaterThanOrEqual(30);
      expect(score).toBeLessThanOrEqual(100);
    });
    
    test('should score low for dissimilar field names', () => {
      const score = calculateSemanticRelevance('日期', '数值');
      
      // Different semantic categories, should have low similarity
      expect(score).toBeLessThanOrEqual(20);
    });
    
    test('should score perfect for identical field names', () => {
      const score = calculateSemanticRelevance('时间', '时间');
      
      // Identical names should score very high
      expect(score).toBeGreaterThanOrEqual(95);
    });
    
    test('should handle English field names', () => {
      const score = calculateSemanticRelevance('location', 'place');
      
      // Should work with English names
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
    
    test('should give bonus for same semantic category', () => {
      const temporalScore = calculateSemanticRelevance('日期', '时间');
      const spatialScore = calculateSemanticRelevance('地区', '区域');
      
      // Both pairs are in same category, should have category bonus (30 points minimum)
      expect(temporalScore).toBeGreaterThanOrEqual(30);
      expect(spatialScore).toBeGreaterThanOrEqual(30);
    });
    
  });
  
  describe('calculateContextRelevance', () => {
    
    test('should score high when type matches category', () => {
      const rawField = {
        name: '日期',
        type: 'time'
      };
      const schemaField = {
        name: '时间'
      };
      
      const score = calculateContextRelevance(rawField, schemaField);
      
      // Type 'time' matches temporal category
      expect(score).toBe(50);
    });
    
    test('should score zero when type does not match', () => {
      const rawField = {
        name: '日期',
        type: 'time'
      };
      const schemaField = {
        name: '数值'
      };
      
      const score = calculateContextRelevance(rawField, schemaField);
      
      // Type 'time' does not match quantitative category
      expect(score).toBe(0);
    });
    
    test('should score zero when no type information', () => {
      const rawField = {
        name: '未知字段'
      };
      const schemaField = {
        name: '时间'
      };
      
      const score = calculateContextRelevance(rawField, schemaField);
      
      // No type information
      expect(score).toBe(0);
    });
    
    test('should handle location type', () => {
      const rawField = {
        name: '地区',
        type: 'location'
      };
      const schemaField = {
        name: '区域'
      };
      
      const score = calculateContextRelevance(rawField, schemaField);
      
      // Type 'location' matches spatial category
      expect(score).toBe(50);
    });
    
    test('should handle number type', () => {
      const rawField = {
        name: '值',
        type: 'number'
      };
      const schemaField = {
        name: '数值'
      };
      
      const score = calculateContextRelevance(rawField, schemaField);
      
      // Type 'number' matches quantitative category
      expect(score).toBe(50);
    });
    
  });
  
  describe('selectRelevantFields', () => {
    
    const schema = {
      schema_name: '地下水位变化事件',
      scene: '科研/政府',
      core_fields: [
        {name: '区域', weight: 0.3, required: true},
        {name: '时间', weight: 0.2, required: true},
        {name: '指标', weight: 0.2, required: true},
        {name: '数值', weight: 0.2, required: false},
        {name: '单位', weight: 0.1, required: false},
        {name: '变化趋势', weight: 0.1, required: false},
        {name: '监测点', weight: 0.1, required: false},
        {name: '备注', weight: 0.05, required: false}
      ]
    };
    
    test('should select top N fields at minimum', () => {
      const rawField = {
        name: '地区',
        value: '阿里C区',
        type: 'location'
      };
      const schemaFieldNames = schema.core_fields.map(f => f.name);
      
      const result = selectRelevantFields(
        rawField.name,
        rawField,
        schemaFieldNames,
        schema,
        { maxFields: 5, minScore: 30, includeTopN: 3 }
      );
      
      // Should include at least top 3 fields
      expect(result.selectedFields.length).toBeGreaterThanOrEqual(3);
      expect(result.selectedFields.length).toBeLessThanOrEqual(5);
    });
    
    test('should not exceed maxFields', () => {
      const rawField = {
        name: '地区',
        value: '阿里C区',
        type: 'location'
      };
      const schemaFieldNames = schema.core_fields.map(f => f.name);
      
      const result = selectRelevantFields(
        rawField.name,
        rawField,
        schemaFieldNames,
        schema,
        { maxFields: 4, minScore: 0, includeTopN: 2 }
      );
      
      // Should not exceed maxFields
      expect(result.selectedFields.length).toBeLessThanOrEqual(4);
    });
    
    test('should include fields with score >= minScore', () => {
      const rawField = {
        name: '地区',
        value: '阿里C区',
        type: 'location'
      };
      const schemaFieldNames = schema.core_fields.map(f => f.name);
      
      const result = selectRelevantFields(
        rawField.name,
        rawField,
        schemaFieldNames,
        schema,
        { maxFields: 10, minScore: 50, includeTopN: 1 }
      );
      
      // All selected fields (except top 1) should have score >= 50
      const selectedScores = result.scoredFields
        .filter(f => result.selectedFields.includes(f.name))
        .map(f => f.score);
      
      // At least the top field should be included
      expect(selectedScores.length).toBeGreaterThanOrEqual(1);
      
      // Check that high-scoring fields are included
      const highScoreFields = result.scoredFields.filter(f => f.score >= 50);
      if (highScoreFields.length > 0) {
        expect(result.selectedFields).toContain(highScoreFields[0].name);
      }
    });
    
    test('should return scored fields sorted by score', () => {
      const rawField = {
        name: '地区',
        value: '阿里C区',
        type: 'location'
      };
      const schemaFieldNames = schema.core_fields.map(f => f.name);
      
      const result = selectRelevantFields(
        rawField.name,
        rawField,
        schemaFieldNames,
        schema
      );
      
      // Scored fields should be sorted descending
      for (let i = 0; i < result.scoredFields.length - 1; i++) {
        expect(result.scoredFields[i].score).toBeGreaterThanOrEqual(
          result.scoredFields[i + 1].score
        );
      }
    });
    
    test('should include breakdown scores', () => {
      const rawField = {
        name: '地区',
        value: '阿里C区',
        type: 'location'
      };
      const schemaFieldNames = schema.core_fields.map(f => f.name);
      
      const result = selectRelevantFields(
        rawField.name,
        rawField,
        schemaFieldNames,
        schema
      );
      
      // Each scored field should have breakdown
      result.scoredFields.forEach(field => {
        expect(field.breakdown).toBeDefined();
        expect(field.breakdown.importance).toBeDefined();
        expect(field.breakdown.semantic).toBeDefined();
        expect(field.breakdown.context).toBeDefined();
      });
    });
    
  });
  
  describe('adaptTruncatingStrategy', () => {
    
    test('should return strategy for 科研/政府 scene', () => {
      const schema = { scene: '科研/政府' };
      
      const strategy = adaptTruncatingStrategy(schema);
      
      expect(strategy.maxFields).toBeGreaterThanOrEqual(6);
      expect(strategy.minScore).toBeLessThanOrEqual(30);
      expect(strategy.includeTopN).toBeGreaterThanOrEqual(4);
      expect(strategy.priorityCategories).toContain('temporal');
    });
    
    test('should return strategy for 个人生活 scene', () => {
      const schema = { scene: '个人生活' };
      
      const strategy = adaptTruncatingStrategy(schema);
      
      expect(strategy.maxFields).toBeLessThanOrEqual(4);
      expect(strategy.minScore).toBeGreaterThanOrEqual(30);
      expect(strategy.includeTopN).toBeLessThanOrEqual(3);
    });
    
    test('should return strategy for 摄影 scene', () => {
      const schema = { scene: '摄影' };
      
      const strategy = adaptTruncatingStrategy(schema);
      
      expect(strategy.maxFields).toBeGreaterThanOrEqual(7);
      expect(strategy.minScore).toBeLessThanOrEqual(25);
      expect(strategy.includeTopN).toBeGreaterThanOrEqual(5);
    });
    
    test('should return default strategy for unknown scene', () => {
      const schema = { scene: '未知场景' };
      
      const strategy = adaptTruncatingStrategy(schema);
      
      expect(strategy.maxFields).toBe(5);
      expect(strategy.minScore).toBe(30);
      expect(strategy.includeTopN).toBe(3);
    });
    
    test('should handle partial scene match', () => {
      const schema = { scene: '科研/政府/环境' };
      
      const strategy = adaptTruncatingStrategy(schema);
      
      // Should match '科研/政府' strategy
      expect(strategy.maxFields).toBeGreaterThanOrEqual(6);
    });
    
    test('should handle missing scene', () => {
      const schema = {};
      
      const strategy = adaptTruncatingStrategy(schema);
      
      // Should return default strategy
      expect(strategy.maxFields).toBe(5);
      expect(strategy.minScore).toBe(30);
    });
    
  });
  
  describe('Field Frequency Tracking', () => {
    
    test('should return default frequency for unknown field', () => {
      const frequency = getFieldMappingFrequency('未知字段');
      
      expect(frequency).toBe(0.5);
    });
    
    test('should update field frequency', () => {
      const fieldName = '时间';
      
      updateFieldMappingFrequency(fieldName, 0.1);
      const frequency1 = getFieldMappingFrequency(fieldName);
      
      updateFieldMappingFrequency(fieldName, 0.1);
      const frequency2 = getFieldMappingFrequency(fieldName);
      
      expect(frequency2).toBeGreaterThan(frequency1);
    });
    
    test('should not exceed maximum frequency', () => {
      const fieldName = '区域';
      
      // Update many times
      for (let i = 0; i < 20; i++) {
        updateFieldMappingFrequency(fieldName, 0.1);
      }
      
      const frequency = getFieldMappingFrequency(fieldName);
      
      // Should cap at 1.0
      expect(frequency).toBeLessThanOrEqual(1.0);
    });
    
    test('should clear frequency cache', () => {
      updateFieldMappingFrequency('时间', 0.3);
      updateFieldMappingFrequency('区域', 0.3);
      
      clearFrequencyCache();
      
      const frequency1 = getFieldMappingFrequency('时间');
      const frequency2 = getFieldMappingFrequency('区域');
      
      // Should return default frequency after clear
      expect(frequency1).toBe(0.5);
      expect(frequency2).toBe(0.5);
    });
    
  });
  
});
