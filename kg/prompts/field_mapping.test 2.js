/**
 * Tests for Prompt 5: Field Name Mapping
 */

const {
  buildFieldMappingPrompt,
  buildSimplifiedMappingPrompt,
  buildBatchMappingPrompt,
  validateMappingResult,
  getPromptStats
} = require('./field_mapping');

describe('Field Mapping Prompt', () => {
  const mockSchema = {
    schema_name: '地下水位变化事件',
    scene: '科研/政府',
    entity_type: 'EventEntity',
    core_fields: [
      { name: '区域', weight: 0.3, required: true },
      { name: '时间', weight: 0.2, required: true },
      { name: '指标', weight: 0.2, required: true },
      { name: '数值', weight: 0.2, required: false },
      { name: '单位', weight: 0.1, required: false }
    ]
  };

  const schemaFields = ['区域', '时间', '指标', '数值', '单位'];

  describe('buildFieldMappingPrompt', () => {
    test('should build complete prompt with all sections', () => {
      const rawField = {
        name: '地区',
        value: '阿里C区',
        type: 'location'
      };

      const prompt = buildFieldMappingPrompt('地区', rawField, schemaFields, mockSchema);

      expect(prompt).toContain('地区');
      expect(prompt).toContain('阿里C区');
      expect(prompt).toContain('location');
      expect(prompt).toContain('地下水位变化事件');
      expect(prompt).toContain('科研/政府');
      expect(prompt).toContain('区域');
      expect(prompt).toContain('时间');
      expect(prompt).toContain('候选标准字段');
      expect(prompt).toContain('映射示例');
      expect(prompt).toContain('重要约束');
      expect(prompt).toContain('输出格式');
    });

    test('should include context when provided', () => {
      const rawField = {
        name: '地区',
        value: '阿里C区',
        type: 'location'
      };

      const prompt = buildFieldMappingPrompt('地区', rawField, schemaFields, mockSchema, {
        context: '这是一段关于水位监测的报告'
      });

      expect(prompt).toContain('上下文信息');
      expect(prompt).toContain('水位监测');
    });

    test('should support intelligent truncating with selected fields', () => {
      const rawField = {
        name: '地区',
        value: '阿里C区',
        type: 'location'
      };

      const selectedFields = ['区域', '时间', '指标']; // Only 3 fields

      const prompt = buildFieldMappingPrompt('地区', rawField, schemaFields, mockSchema, {
        selectedFields
      });

      expect(prompt).toContain('区域');
      expect(prompt).toContain('时间');
      expect(prompt).toContain('指标');
      expect(prompt).toContain('按相关性排序');
    });

    test('should exclude examples when includeExamples is false', () => {
      const rawField = {
        name: '地区',
        value: '阿里C区',
        type: 'location'
      };

      const prompt = buildFieldMappingPrompt('地区', rawField, schemaFields, mockSchema, {
        includeExamples: false
      });

      expect(prompt).not.toContain('映射示例');
      expect(prompt).not.toContain('示例 1');
    });

    test('should show field weights and required status', () => {
      const rawField = {
        name: '地区',
        value: '阿里C区',
        type: 'location'
      };

      const prompt = buildFieldMappingPrompt('地区', rawField, schemaFields, mockSchema);

      expect(prompt).toContain('必需');
      expect(prompt).toContain('可选');
      expect(prompt).toContain('权重');
    });
  });

  describe('buildSimplifiedMappingPrompt', () => {
    test('should build simplified prompt with minimal content', () => {
      const rawField = {
        name: '地区',
        value: '阿里C区',
        type: 'location'
      };

      const prompt = buildSimplifiedMappingPrompt('地区', rawField, schemaFields, mockSchema);

      expect(prompt).toContain('地区');
      expect(prompt).toContain('阿里C区');
      expect(prompt).toContain('location');
      expect(prompt).toContain('区域');
      expect(prompt).toContain('时间');
      expect(prompt.length).toBeLessThan(500); // Should be much shorter
    });

    test('should handle missing field value and type', () => {
      const rawField = {
        name: '地区'
      };

      const prompt = buildSimplifiedMappingPrompt('地区', rawField, schemaFields, mockSchema);

      expect(prompt).toContain('地区');
      expect(prompt).toBeDefined();
    });
  });

  describe('buildBatchMappingPrompt', () => {
    test('should build batch prompt for multiple fields', () => {
      const rawFields = [
        { name: '地区', value: '阿里C区', type: 'location' },
        { name: '日期', value: '2025-01', type: 'time' },
        { name: '数量', value: '10', type: 'number' }
      ];

      const prompt = buildBatchMappingPrompt(rawFields, schemaFields, mockSchema);

      expect(prompt).toContain('批量映射');
      expect(prompt).toContain('地区');
      expect(prompt).toContain('日期');
      expect(prompt).toContain('数量');
      expect(prompt).toContain('阿里C区');
      expect(prompt).toContain('2025-01');
      expect(prompt).toContain('mappings');
    });

    test('should handle fields without value or type', () => {
      const rawFields = [
        { name: '地区' },
        { name: '日期', value: '2025-01' },
        { name: '数量', type: 'number' }
      ];

      const prompt = buildBatchMappingPrompt(rawFields, schemaFields, mockSchema);

      expect(prompt).toContain('地区');
      expect(prompt).toContain('日期');
      expect(prompt).toContain('数量');
    });
  });

  describe('validateMappingResult', () => {
    test('should validate correct mapping result', () => {
      const result = {
        mapped_name: '区域',
        confidence: 0.9,
        reason: '地区和区域是同义词'
      };

      const { validMapping, errors } = validateMappingResult(result, schemaFields);

      expect(errors).toHaveLength(0);
      expect(validMapping).toBeDefined();
      expect(validMapping.mapped_name).toBe('区域');
      expect(validMapping.confidence).toBe(0.81); // 0.9 * 0.9 (discount)
      expect(validMapping.method).toBe('llm');
    });

    test('should accept null mapped_name', () => {
      const result = {
        mapped_name: null,
        confidence: 0.0,
        reason: '无法映射'
      };

      const { validMapping, errors } = validateMappingResult(result, schemaFields);

      expect(errors).toHaveLength(0);
      expect(validMapping).toBeNull();
    });

    test('should reject mapped_name not in candidate list', () => {
      const result = {
        mapped_name: '不存在的字段',
        confidence: 0.9,
        reason: '测试'
      };

      const { validMapping, errors } = validateMappingResult(result, schemaFields);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('not in candidate list');
      expect(validMapping).toBeNull();
    });

    test('should reject invalid confidence values', () => {
      const result1 = {
        mapped_name: '区域',
        confidence: 1.5,
        reason: '测试'
      };

      const { errors: errors1 } = validateMappingResult(result1, schemaFields);
      expect(errors1.length).toBeGreaterThan(0);
      expect(errors1[0]).toContain('Invalid confidence');

      const result2 = {
        mapped_name: '区域',
        confidence: -0.1,
        reason: '测试'
      };

      const { errors: errors2 } = validateMappingResult(result2, schemaFields);
      expect(errors2.length).toBeGreaterThan(0);
    });

    test('should reject low confidence mappings', () => {
      const result = {
        mapped_name: '区域',
        confidence: 0.6, // Below 0.7 threshold
        reason: '不太确定'
      };

      const { validMapping, errors } = validateMappingResult(result, schemaFields);

      expect(errors).toHaveLength(0); // No structural errors
      expect(validMapping).toBeNull(); // But mapping is rejected due to low confidence
    });

    test('should handle invalid result structure', () => {
      const result = null;

      const { validMapping, errors } = validateMappingResult(result, schemaFields);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('must be an object');
      expect(validMapping).toBeNull();
    });

    test('should validate reason field type', () => {
      const result = {
        mapped_name: '区域',
        confidence: 0.9,
        reason: 123 // Should be string
      };

      const { errors } = validateMappingResult(result, schemaFields);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('reason must be a string');
    });
  });

  describe('getPromptStats', () => {
    test('should calculate prompt statistics', () => {
      const rawField = {
        name: '地区',
        value: '阿里C区',
        type: 'location'
      };

      const prompt = buildFieldMappingPrompt('地区', rawField, schemaFields, mockSchema);
      const stats = getPromptStats(prompt);

      expect(stats.lines).toBeGreaterThan(0);
      expect(stats.chars).toBeGreaterThan(0);
      expect(stats.estimatedTokens).toBeGreaterThan(0);
      expect(stats.estimatedTokens).toBe(Math.ceil(stats.chars / 4));
    });

    test('should estimate fewer tokens for simplified prompt', () => {
      const rawField = {
        name: '地区',
        value: '阿里C区',
        type: 'location'
      };

      const fullPrompt = buildFieldMappingPrompt('地区', rawField, schemaFields, mockSchema);
      const simplifiedPrompt = buildSimplifiedMappingPrompt('地区', rawField, schemaFields, mockSchema);

      const fullStats = getPromptStats(fullPrompt);
      const simplifiedStats = getPromptStats(simplifiedPrompt);

      expect(simplifiedStats.estimatedTokens).toBeLessThan(fullStats.estimatedTokens);
    });
  });

  describe('Integration scenarios', () => {
    test('should handle synonym mapping scenario', () => {
      const rawField = {
        name: '地区',
        value: '北京市',
        type: 'location'
      };

      const prompt = buildFieldMappingPrompt('地区', rawField, schemaFields, mockSchema);

      expect(prompt).toContain('地区');
      expect(prompt).toContain('区域');
      expect(prompt).toContain('同义词');
    });

    test('should handle colloquial expression scenario', () => {
      const rawField = {
        name: '啥时候',
        value: '2025-01',
        type: 'time'
      };

      const prompt = buildFieldMappingPrompt('啥时候', rawField, schemaFields, mockSchema);

      expect(prompt).toContain('啥时候');
      expect(prompt).toContain('时间');
      expect(prompt).toContain('口语化');
    });

    test('should handle English field name scenario', () => {
      const rawField = {
        name: 'location',
        value: 'Beijing',
        type: 'location'
      };

      const prompt = buildFieldMappingPrompt('location', rawField, schemaFields, mockSchema);

      expect(prompt).toContain('location');
      expect(prompt).toContain('区域');
      expect(prompt).toContain('中英文');
    });

    test('should handle unmappable field scenario', () => {
      const rawField = {
        name: '备注',
        value: '这是一条备注',
        type: 'text'
      };

      const prompt = buildFieldMappingPrompt('备注', rawField, schemaFields, mockSchema);

      expect(prompt).toContain('备注');
      expect(prompt).toContain('无法确定映射');
      expect(prompt).toContain('null');
    });
  });
});
