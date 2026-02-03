/**
 * Unit tests for Field Extraction Prompt (Prompt 1)
 */

const {
  buildFieldExtractionPrompt,
  buildSimplifiedPrompt,
  validateExtractedFields,
  getPromptStats,
  FIELD_TYPE_DESCRIPTIONS
} = require('./extract_fields');

const { FieldType } = require('../field_extractor/rule_extractor');

describe('Field Extraction Prompt', () => {
  describe('buildFieldExtractionPrompt', () => {
    test('should build basic prompt without existing fields', () => {
      const text = '阿里C区2025年1月水位下降10米';
      const prompt = buildFieldExtractionPrompt(text, []);

      expect(prompt).toContain(text);
      expect(prompt).toContain('无（这是首次提取）');
      expect(prompt).toContain('location');
      expect(prompt).toContain('time');
      expect(prompt).toContain('number');
      expect(prompt).toContain('unit');
      expect(prompt).toContain('indicator');
      expect(prompt).toContain('entity');
      expect(prompt).toContain('不要推理');
      expect(prompt).toContain('ISO 8601');
    });

    test('should include existing fields in prompt', () => {
      const text = '阿里C区2025年1月水位下降10米';
      const existingFields = [
        { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 },
        { name: '时间', value: '2025-01', type: 'time', confidence: 0.95 }
      ];
      const prompt = buildFieldExtractionPrompt(text, existingFields);

      expect(prompt).toContain('已提取字段');
      expect(prompt).toContain('区域: 阿里C区');
      expect(prompt).toContain('时间: 2025-01');
      expect(prompt).toContain('请提取其他遗漏的字段');
    });

    test('should support target field types option', () => {
      const text = '阿里C区2025年1月';
      const prompt = buildFieldExtractionPrompt(text, [], {
        targetFieldTypes: ['location', 'time']
      });

      expect(prompt).toContain('location');
      expect(prompt).toContain('time');
      // Should not contain other types in the type section
      const typeSection = prompt.match(/## 字段类型说明[\s\S]*?##/)[0];
      expect(typeSection).not.toContain('number:');
      expect(typeSection).not.toContain('unit:');
    });

    test('should exclude examples when includeExamples is false', () => {
      const text = '阿里C区2025年1月';
      const prompt = buildFieldExtractionPrompt(text, [], {
        includeExamples: false
      });

      expect(prompt).not.toContain('## 提取示例');
      expect(prompt).not.toContain('示例 1');
    });

    test('should include examples by default', () => {
      const text = '阿里C区2025年1月';
      const prompt = buildFieldExtractionPrompt(text, []);

      expect(prompt).toContain('## 提取示例');
      expect(prompt).toContain('示例 1');
      expect(prompt).toContain('阿里C区2025年1月水位下降10米');
    });

    test('should include all constraint rules', () => {
      const text = '测试文本';
      const prompt = buildFieldExtractionPrompt(text, []);

      expect(prompt).toContain('不要推理');
      expect(prompt).toContain('不要合并');
      expect(prompt).toContain('不要生成实体');
      expect(prompt).toContain('时间标准化');
      expect(prompt).toContain('置信度评估');
      expect(prompt).toContain('避免重复');
    });
  });

  describe('buildSimplifiedPrompt', () => {
    test('should build simplified prompt without existing fields', () => {
      const text = '阿里C区2025年1月水位下降10米';
      const prompt = buildSimplifiedPrompt(text, []);

      expect(prompt).toContain(text);
      expect(prompt).toContain('从文本提取字段');
      expect(prompt).toContain('location|time|number|unit|indicator|entity');
      expect(prompt).toContain('ISO 8601');
      // Should be shorter than full prompt
      expect(prompt.length).toBeLessThan(1000);
    });

    test('should include existing fields in simplified format', () => {
      const text = '阿里C区2025年1月水位下降10米';
      const existingFields = [
        { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 }
      ];
      const prompt = buildSimplifiedPrompt(text, existingFields);

      expect(prompt).toContain('已提取：区域:阿里C区');
    });

    test('should be significantly shorter than full prompt', () => {
      const text = '阿里C区2025年1月水位下降10米';
      const fullPrompt = buildFieldExtractionPrompt(text, []);
      const simplifiedPrompt = buildSimplifiedPrompt(text, []);

      expect(simplifiedPrompt.length).toBeLessThan(fullPrompt.length / 3);
    });
  });

  describe('validateExtractedFields', () => {
    test('should validate correct fields', () => {
      const fields = [
        { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 },
        { name: '时间', value: '2025年1月', type: 'time', confidence: 0.95 } // Use original format
      ];
      const text = '阿里C区2025年1月水位下降10米';

      const result = validateExtractedFields(fields, text);

      expect(result.validFields).toHaveLength(2);
      expect(result.validFields[0]).toMatchObject({
        name: '区域',
        value: '阿里C区',
        type: 'location',
        confidence: 0.95,
        source: 'llm'
      });
      expect(result.errors).toHaveLength(0);
    });

    test('should reject fields with missing required properties', () => {
      const fields = [
        { name: '区域', type: 'location', confidence: 0.95 }, // missing value
        { value: '2025-01', type: 'time', confidence: 0.95 }, // missing name
        { name: '指标', value: '水位', confidence: 0.95 } // missing type
      ];
      const text = '阿里C区2025年1月水位下降10米';

      const result = validateExtractedFields(fields, text);

      expect(result.validFields).toHaveLength(0);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0]).toContain('Missing value');
      expect(result.errors[1]).toContain('Missing name');
      expect(result.errors[2]).toContain('Missing type');
    });

    test('should reject fields with invalid type', () => {
      const fields = [
        { name: '区域', value: '阿里C区', type: 'invalid_type', confidence: 0.95 }
      ];
      const text = '阿里C区2025年1月水位下降10米';

      const result = validateExtractedFields(fields, text);

      expect(result.validFields).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid type');
    });

    test('should reject fields with invalid confidence', () => {
      const fields = [
        { name: '区域', value: '阿里C区', type: 'location', confidence: 1.5 },
        { name: '时间', value: '2025-01', type: 'time', confidence: -0.1 }
      ];
      const text = '阿里C区2025年1月水位下降10米';

      const result = validateExtractedFields(fields, text);

      expect(result.validFields).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Invalid confidence');
      expect(result.errors[1]).toContain('Invalid confidence');
    });

    test('should set default confidence if missing', () => {
      const fields = [
        { name: '区域', value: '阿里C区', type: 'location' } // no confidence
      ];
      const text = '阿里C区2025年1月水位下降10米';

      const result = validateExtractedFields(fields, text);

      expect(result.validFields).toHaveLength(1);
      expect(result.validFields[0].confidence).toBe(0.8);
    });

    test('should warn if value not found in original text', () => {
      const fields = [
        { name: '区域', value: '北京市', type: 'location', confidence: 0.95 }
      ];
      const text = '阿里C区2025年1月水位下降10米';

      const result = validateExtractedFields(fields, text);

      expect(result.validFields).toHaveLength(1); // Still valid, just a warning
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Warning');
      expect(result.errors[0]).toContain('not found in original text');
    });

    test('should handle non-array input', () => {
      const fields = { name: '区域', value: '阿里C区', type: 'location' };
      const text = '阿里C区2025年1月水位下降10米';

      const result = validateExtractedFields(fields, text);

      expect(result.validFields).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('must be an array');
    });

    test('should add source field to valid fields', () => {
      const fields = [
        { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 }
      ];
      const text = '阿里C区2025年1月水位下降10米';

      const result = validateExtractedFields(fields, text);

      expect(result.validFields[0].source).toBe('llm');
    });
  });

  describe('getPromptStats', () => {
    test('should calculate prompt statistics', () => {
      const prompt = buildFieldExtractionPrompt('阿里C区2025年1月水位下降10米', []);
      const stats = getPromptStats(prompt);

      expect(stats).toHaveProperty('lines');
      expect(stats).toHaveProperty('chars');
      expect(stats).toHaveProperty('estimatedTokens');
      expect(stats.lines).toBeGreaterThan(0);
      expect(stats.chars).toBeGreaterThan(0);
      expect(stats.estimatedTokens).toBeGreaterThan(0);
    });

    test('should estimate tokens correctly', () => {
      const prompt = '这是一个测试'; // 6 characters
      const stats = getPromptStats(prompt);

      // ~4 chars per token for Chinese
      expect(stats.estimatedTokens).toBe(Math.ceil(6 / 4));
    });

    test('should show simplified prompt uses fewer tokens', () => {
      const text = '阿里C区2025年1月水位下降10米';
      const fullPrompt = buildFieldExtractionPrompt(text, []);
      const simplifiedPrompt = buildSimplifiedPrompt(text, []);

      const fullStats = getPromptStats(fullPrompt);
      const simplifiedStats = getPromptStats(simplifiedPrompt);

      expect(simplifiedStats.estimatedTokens).toBeLessThan(fullStats.estimatedTokens);
    });
  });

  describe('FIELD_TYPE_DESCRIPTIONS', () => {
    test('should have descriptions for all field types', () => {
      const fieldTypes = Object.values(FieldType);
      
      fieldTypes.forEach(type => {
        expect(FIELD_TYPE_DESCRIPTIONS).toHaveProperty(type);
        expect(FIELD_TYPE_DESCRIPTIONS[type]).toBeTruthy();
        expect(typeof FIELD_TYPE_DESCRIPTIONS[type]).toBe('string');
      });
    });

    test('should have Chinese descriptions', () => {
      Object.values(FIELD_TYPE_DESCRIPTIONS).forEach(description => {
        // Check if description contains Chinese characters
        expect(/[\u4e00-\u9fa5]/.test(description)).toBe(true);
      });
    });
  });

  describe('Integration with field types', () => {
    test('should support all FieldType values', () => {
      const fieldTypes = Object.values(FieldType);
      const prompt = buildFieldExtractionPrompt('测试', []);

      fieldTypes.forEach(type => {
        expect(prompt).toContain(type);
      });
    });
  });
});


describe('Schema Validation and Normalization', () => {
  const {
    validateFieldsAgainstSchema,
    findMatchingSchemaField,
    normalizeFieldName,
    calculateEditDistance,
    calculateSemanticSimilarity,
    calculateSimilarityScore
  } = require('./extract_fields');

  describe('validateFieldsAgainstSchema', () => {
    test('should validate fields against valid schema', () => {
      const fields = [
        { name: '目的地名称', value: '杭州', type: 'location', confidence: 0.95 },
        { name: '景点名称', value: '西湖', type: 'entity', confidence: 0.95 },
        { name: '预算范围', value: '800元', type: 'number', confidence: 0.9 }
      ];

      const schema = {
        id: 'travel_destination',
        name: '旅游目的地',
        fields: [
          { name: '目的地名称', type: 'location', description: '旅游目的地' },
          { name: '景点名称', type: 'entity', description: '景点名称' },
          { name: '预算范围', type: 'number', description: '预算范围' }
        ]
      };

      const result = validateFieldsAgainstSchema(fields, schema);

      expect(result.validatedFields).toHaveLength(3);
      expect(result.matchedCount).toBe(3);
      expect(result.unmatchedCount).toBe(0);
      expect(result.coverage).toBe(1.0);
      expect(result.validatedFields[0].validated).toBe(true);
      expect(result.validatedFields[0].schemaField).toBe('目的地名称');
    });

    test('should handle fields not in schema', () => {
      const fields = [
        { name: '目的地名称', value: '杭州', type: 'location', confidence: 0.95 },
        { name: '未知字段', value: '测试', type: 'text', confidence: 0.8 }
      ];

      const schema = {
        id: 'travel_destination',
        fields: [
          { name: '目的地名称', type: 'location' }
        ]
      };

      const result = validateFieldsAgainstSchema(fields, schema);

      expect(result.validatedFields).toHaveLength(2);
      expect(result.matchedCount).toBe(1);
      expect(result.unmatchedCount).toBe(1);
      expect(result.coverage).toBe(0.5);
      expect(result.validatedFields[0].validated).toBe(true);
      expect(result.validatedFields[1].validated).toBe(false);
      expect(result.warnings).toContain('Field "未知字段" not found in schema "travel_destination"');
    });

    test('should handle invalid schema format', () => {
      const fields = [
        { name: '目的地名称', value: '杭州', type: 'location', confidence: 0.95 }
      ];

      const invalidSchema = { id: 'test' }; // Missing fields array

      const result = validateFieldsAgainstSchema(fields, invalidSchema);

      expect(result.validatedFields).toHaveLength(1);
      expect(result.matchedCount).toBe(0);
      expect(result.unmatchedCount).toBe(1);
      expect(result.warnings).toContain('Invalid schema format');
    });

    test('should warn on type mismatch', () => {
      const fields = [
        { name: '目的地名称', value: '杭州', type: 'text', confidence: 0.95 } // Wrong type
      ];

      const schema = {
        id: 'travel_destination',
        fields: [
          { name: '目的地名称', type: 'location' }
        ]
      };

      const result = validateFieldsAgainstSchema(fields, schema);

      expect(result.validatedFields).toHaveLength(1);
      expect(result.matchedCount).toBe(1);
      expect(result.warnings.some(w => w.includes('type mismatch'))).toBe(true);
    });

    test('should handle empty fields array', () => {
      const fields = [];
      const schema = {
        id: 'test',
        fields: [{ name: '字段1', type: 'text' }]
      };

      const result = validateFieldsAgainstSchema(fields, schema);

      expect(result.validatedFields).toHaveLength(0);
      expect(result.matchedCount).toBe(0);
      expect(result.coverage).toBe(0);
    });

    test('should handle validation errors gracefully', () => {
      const fields = [
        { name: '测试', value: '值', type: 'text', confidence: 0.9 }
      ];

      // Null schema should trigger error handling
      const result = validateFieldsAgainstSchema(fields, null);

      expect(result.validatedFields).toHaveLength(1);
      expect(result.warnings).toContain('Invalid schema format');
    });
  });

  describe('findMatchingSchemaField', () => {
    const schema = {
      fields: [
        { name: '目的地名称', type: 'location' },
        { name: '景点名称', type: 'entity' },
        { name: '预算范围', type: 'number' },
        { name: '行程天数', type: 'time' }
      ]
    };

    test('should find exact match', () => {
      const field = { name: '目的地名称' };
      const match = findMatchingSchemaField(field, schema);

      expect(match).not.toBeNull();
      expect(match.name).toBe('目的地名称');
    });

    test('should find case-insensitive match', () => {
      const field = { name: '目的地名称' }; // Same case in Chinese
      const match = findMatchingSchemaField(field, schema);

      expect(match).not.toBeNull();
      expect(match.name).toBe('目的地名称');
    });

    test('should find match with edit distance <= 3', () => {
      const field = { name: '目的地' }; // Missing "名称"
      const match = findMatchingSchemaField(field, schema);

      expect(match).not.toBeNull();
      expect(match.name).toBe('目的地名称');
    });

    test('should find match with substring', () => {
      const field = { name: '预算' }; // Substring of "预算范围"
      const match = findMatchingSchemaField(field, schema);

      expect(match).not.toBeNull();
      expect(match.name).toBe('预算范围');
    });

    test('should find match with semantic similarity', () => {
      const field = { name: '景点' }; // Similar to "景点名称"
      const match = findMatchingSchemaField(field, schema);

      expect(match).not.toBeNull();
      expect(match.name).toBe('景点名称');
    });

    test('should return null for no match', () => {
      const field = { name: '完全不相关的字段' };
      const match = findMatchingSchemaField(field, schema);

      expect(match).toBeNull();
    });

    test('should handle invalid schema', () => {
      const field = { name: '测试' };
      const invalidSchema = { fields: null };
      const match = findMatchingSchemaField(field, invalidSchema);

      expect(match).toBeNull();
    });
  });

  describe('normalizeFieldName', () => {
    const schema = {
      fields: [
        { name: '目的地名称', type: 'location' },
        { name: '景点名称', type: 'entity' }
      ]
    };

    test('should normalize field name to schema field name', () => {
      const normalized = normalizeFieldName('目的地', schema);
      expect(normalized).toBe('目的地名称');
    });

    test('should return original name if no match', () => {
      const normalized = normalizeFieldName('未知字段', schema);
      expect(normalized).toBe('未知字段');
    });

    test('should handle null schema', () => {
      const normalized = normalizeFieldName('测试', null);
      expect(normalized).toBe('测试');
    });

    test('should handle schema without fields', () => {
      const normalized = normalizeFieldName('测试', {});
      expect(normalized).toBe('测试');
    });
  });

  describe('calculateEditDistance', () => {
    test('should calculate distance for identical strings', () => {
      const distance = calculateEditDistance('测试', '测试');
      expect(distance).toBe(0);
    });

    test('should calculate distance for one character difference', () => {
      const distance = calculateEditDistance('测试', '测验');
      expect(distance).toBe(1);
    });

    test('should calculate distance for insertion', () => {
      const distance = calculateEditDistance('目的地', '目的地名称');
      expect(distance).toBe(2);
    });

    test('should calculate distance for deletion', () => {
      const distance = calculateEditDistance('目的地名称', '目的地');
      expect(distance).toBe(2);
    });

    test('should calculate distance for substitution', () => {
      const distance = calculateEditDistance('景点', '景区');
      expect(distance).toBe(1);
    });

    test('should handle empty strings', () => {
      const distance = calculateEditDistance('', '测试');
      expect(distance).toBe(2);
    });
  });

  describe('calculateSemanticSimilarity', () => {
    const schemaFields = [
      { name: '目的地名称', type: 'location' },
      { name: '景点名称', type: 'entity' },
      { name: '预算范围', type: 'number' }
    ];

    test('should find best match with high similarity', () => {
      const result = calculateSemanticSimilarity('目的地', schemaFields);

      expect(result.field).not.toBeNull();
      expect(result.field.name).toBe('目的地名称');
      expect(result.score).toBeGreaterThan(0.5);
    });

    test('should return low score for dissimilar names', () => {
      const result = calculateSemanticSimilarity('完全不同', schemaFields);

      expect(result.score).toBeLessThan(0.5);
    });

    test('should handle exact match', () => {
      const result = calculateSemanticSimilarity('景点名称', schemaFields);

      expect(result.field.name).toBe('景点名称');
      expect(result.score).toBe(1.0);
    });
  });

  describe('calculateSimilarityScore', () => {
    test('should return 1.0 for identical names', () => {
      const score = calculateSimilarityScore('目的地名称', '目的地名称');
      expect(score).toBe(1.0);
    });

    test('should return high score for substring match', () => {
      const score = calculateSimilarityScore('目的地', '目的地名称');
      expect(score).toBeGreaterThan(0.5);
    });

    test('should return lower score for different names', () => {
      const score = calculateSimilarityScore('景点', '预算');
      expect(score).toBeLessThan(0.5);
    });

    test('should be case-insensitive', () => {
      const score1 = calculateSimilarityScore('Test', 'test');
      expect(score1).toBe(1.0);
    });

    test('should handle empty strings', () => {
      const score = calculateSimilarityScore('', '测试');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});
