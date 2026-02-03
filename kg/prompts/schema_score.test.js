/**
 * Unit tests for schema_score.js
 * 
 * Tests the Schema Scoring prompt generation and validation
 */

const {
  buildSchemaScoringPrompt,
  buildSimplifiedPrompt,
  validateSchemaScoringResult,
  getPromptStats,
  calculateRuleBasedCompleteness
} = require('./schema_score');

describe('Schema Scoring Prompt Module', () => {
  // Test data
  const sampleFields = [
    { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 },
    { name: '时间', value: '2025-01', type: 'time', confidence: 0.95 },
    { name: '指标', value: '水位', type: 'indicator', confidence: 0.95 },
    { name: '数值', value: '10', type: 'number', confidence: 0.95 },
    { name: '单位', value: '米', type: 'unit', confidence: 0.95 }
  ];

  const sampleSchemas = [
    {
      schema_name: '地下水位变化事件',
      entity_type: 'EventEntity',
      threshold: 0.75,
      core_fields: [
        { name: '区域', weight: 0.3, required: true },
        { name: '时间', weight: 0.2, required: true },
        { name: '指标', weight: 0.2, required: true },
        { name: '数值', weight: 0.2, required: false },
        { name: '单位', weight: 0.1, required: false }
      ]
    },
    {
      schema_name: '区域环境监测',
      entity_type: 'MonitoringEntity',
      threshold: 0.7,
      core_fields: [
        { name: '区域', weight: 0.4, required: true },
        { name: '指标', weight: 0.3, required: true },
        { name: '数值', weight: 0.3, required: false }
      ]
    }
  ];

  const sampleContext = {
    text: '阿里C区2025年1月水位下降10米',
    sourceConfidence: 0.9
  };

  describe('buildSchemaScoringPrompt', () => {
    test('should generate complete prompt with all sections', () => {
      const prompt = buildSchemaScoringPrompt(sampleFields, sampleSchemas, sampleContext);

      expect(prompt).toContain('你是一个知识图谱 Schema 匹配专家');
      expect(prompt).toContain('## 原始文本');
      expect(prompt).toContain('阿里C区2025年1月水位下降10米');
      expect(prompt).toContain('## 提取的字段');
      expect(prompt).toContain('区域');
      expect(prompt).toContain('## 候选 Schema');
      expect(prompt).toContain('地下水位变化事件');
      expect(prompt).toContain('## 任务要求');
      expect(prompt).toContain('## 输出格式');
      expect(prompt).toContain('schema_scores');
      expect(prompt).toContain('recommended_schemas');
    });

    test('should include examples by default', () => {
      const prompt = buildSchemaScoringPrompt(sampleFields, sampleSchemas, sampleContext);

      expect(prompt).toContain('## 评分示例');
      expect(prompt).toContain('示例 1');
      expect(prompt).toContain('示例 2');
      expect(prompt).toContain('示例 3');
    });

    test('should exclude examples when option is false', () => {
      const prompt = buildSchemaScoringPrompt(
        sampleFields,
        sampleSchemas,
        sampleContext,
        { includeExamples: false }
      );

      expect(prompt).not.toContain('## 评分示例');
      expect(prompt).not.toContain('示例 1');
    });

    test('should handle empty fields', () => {
      const prompt = buildSchemaScoringPrompt([], sampleSchemas, sampleContext);

      expect(prompt).toContain('无字段提取');
    });

    test('should handle empty schemas', () => {
      const prompt = buildSchemaScoringPrompt(sampleFields, [], sampleContext);

      expect(prompt).toContain('无候选 Schema');
    });

    test('should handle missing context', () => {
      const prompt = buildSchemaScoringPrompt(sampleFields, sampleSchemas);

      expect(prompt).not.toContain('## 原始文本');
    });

    test('should include source confidence when provided', () => {
      const prompt = buildSchemaScoringPrompt(sampleFields, sampleSchemas, sampleContext);

      expect(prompt).toContain('来源置信度');
      expect(prompt).toContain('0.9');
    });

    test('should format schema core fields correctly', () => {
      const prompt = buildSchemaScoringPrompt(sampleFields, sampleSchemas, sampleContext);

      expect(prompt).toContain('权重: 0.3');
      expect(prompt).toContain('必需: 是');
      expect(prompt).toContain('必需: 否');
    });

    test('should include constraints section', () => {
      const prompt = buildSchemaScoringPrompt(sampleFields, sampleSchemas, sampleContext);

      expect(prompt).toContain('## 重要约束');
      expect(prompt).toContain('基于已提取字段');
      expect(prompt).toContain('匹配分数计算');
      expect(prompt).toContain('阈值判断');
    });
  });

  describe('buildSimplifiedPrompt', () => {
    test('should generate simplified prompt', () => {
      const prompt = buildSimplifiedPrompt(sampleFields, sampleSchemas, sampleContext);

      expect(prompt).toContain('评估字段与Schema匹配度');
      expect(prompt).toContain('区域:阿里C区(location)');
      expect(prompt).toContain('地下水位变化事件');
      expect(prompt).toContain('阈值:0.75');
    });

    test('should be significantly shorter than full prompt', () => {
      const fullPrompt = buildSchemaScoringPrompt(sampleFields, sampleSchemas, sampleContext);
      const simplifiedPrompt = buildSimplifiedPrompt(sampleFields, sampleSchemas, sampleContext);

      expect(simplifiedPrompt.length).toBeLessThan(fullPrompt.length * 0.4);
    });

    test('should include all essential information', () => {
      const prompt = buildSimplifiedPrompt(sampleFields, sampleSchemas, sampleContext);

      // Check fields are included
      sampleFields.forEach(field => {
        expect(prompt).toContain(field.name);
      });

      // Check schemas are included
      sampleSchemas.forEach(schema => {
        expect(prompt).toContain(schema.schema_name);
        expect(prompt).toContain(schema.threshold.toString());
      });
    });

    test('should include output format', () => {
      const prompt = buildSimplifiedPrompt(sampleFields, sampleSchemas, sampleContext);

      expect(prompt).toContain('schema_scores');
      expect(prompt).toContain('recommended_schemas');
    });
  });

  describe('validateSchemaScoringResult', () => {
    const validResult = {
      schema_scores: [
        {
          schema_name: '地下水位变化事件',
          match_score: 0.95,
          matched_fields: ['区域', '时间', '指标', '数值', '单位'],
          missing_fields: [],
          reasoning: '所有核心字段都已匹配'
        },
        {
          schema_name: '区域环境监测',
          match_score: 0.85,
          matched_fields: ['区域', '指标', '数值'],
          missing_fields: [],
          reasoning: '核心字段已匹配'
        }
      ],
      recommended_schemas: ['地下水位变化事件']
    };

    test('should validate correct result', () => {
      const { validResult: result, errors } = validateSchemaScoringResult(validResult, sampleSchemas);

      expect(result).toBeDefined();
      expect(result.schema_scores).toHaveLength(2);
      expect(result.recommended_schemas).toHaveLength(1);
      expect(errors).toHaveLength(0);
    });

    test('should reject null result', () => {
      const { validResult: result, errors } = validateSchemaScoringResult(null, sampleSchemas);

      expect(result).toBeNull();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Result must be an object');
    });

    test('should reject missing schema_scores', () => {
      const invalidResult = {
        recommended_schemas: []
      };

      const { validResult: result, errors } = validateSchemaScoringResult(invalidResult, sampleSchemas);

      expect(result).toBeNull();
      expect(errors).toContain('schema_scores must be an array');
    });

    test('should reject missing recommended_schemas', () => {
      const invalidResult = {
        schema_scores: []
      };

      const { validResult: result, errors } = validateSchemaScoringResult(invalidResult, sampleSchemas);

      expect(result).toBeNull();
      expect(errors).toContain('recommended_schemas must be an array');
    });

    test('should reject invalid match_score', () => {
      const invalidResult = {
        schema_scores: [
          {
            schema_name: '地下水位变化事件',
            match_score: 1.5, // Invalid: > 1
            matched_fields: [],
            missing_fields: []
          }
        ],
        recommended_schemas: []
      };

      const { validResult: result, errors } = validateSchemaScoringResult(invalidResult, sampleSchemas);

      expect(errors.some(e => e.includes('Invalid match_score'))).toBe(true);
    });

    test('should reject unknown schema name', () => {
      const invalidResult = {
        schema_scores: [
          {
            schema_name: '未知Schema',
            match_score: 0.8,
            matched_fields: [],
            missing_fields: []
          }
        ],
        recommended_schemas: []
      };

      const { validResult: result, errors } = validateSchemaScoringResult(invalidResult, sampleSchemas);

      expect(errors.some(e => e.includes('Unknown schema'))).toBe(true);
    });

    test('should reject missing required fields in schema score', () => {
      const invalidResult = {
        schema_scores: [
          {
            // Missing schema_name
            match_score: 0.8,
            matched_fields: [],
            missing_fields: []
          }
        ],
        recommended_schemas: []
      };

      const { validResult: result, errors } = validateSchemaScoringResult(invalidResult, sampleSchemas);

      expect(errors.some(e => e.includes('Missing schema_name'))).toBe(true);
    });

    test('should warn when recommended schema has score below threshold', () => {
      const inconsistentResult = {
        schema_scores: [
          {
            schema_name: '地下水位变化事件',
            match_score: 0.5, // Below threshold of 0.75
            matched_fields: ['区域'],
            missing_fields: ['时间', '指标', '数值', '单位']
          }
        ],
        recommended_schemas: ['地下水位变化事件'] // Inconsistent recommendation
      };

      const { validResult: result, errors } = validateSchemaScoringResult(inconsistentResult, sampleSchemas);

      expect(errors.some(e => e.includes('Warning') && e.includes('threshold'))).toBe(true);
    });

    test('should handle optional reasoning field', () => {
      const resultWithoutReasoning = {
        schema_scores: [
          {
            schema_name: '地下水位变化事件',
            match_score: 0.95,
            matched_fields: ['区域'],
            missing_fields: []
            // No reasoning field
          }
        ],
        recommended_schemas: []
      };

      const { validResult: result, errors } = validateSchemaScoringResult(resultWithoutReasoning, sampleSchemas);

      expect(result).toBeDefined();
      expect(result.schema_scores[0].reasoning).toBe('');
    });

    test('should validate matched_fields is array', () => {
      const invalidResult = {
        schema_scores: [
          {
            schema_name: '地下水位变化事件',
            match_score: 0.8,
            matched_fields: '区域', // Should be array
            missing_fields: []
          }
        ],
        recommended_schemas: []
      };

      const { validResult: result, errors } = validateSchemaScoringResult(invalidResult, sampleSchemas);

      expect(errors.some(e => e.includes('matched_fields must be an array'))).toBe(true);
    });
  });

  describe('getPromptStats', () => {
    test('should calculate prompt statistics', () => {
      const prompt = buildSchemaScoringPrompt(sampleFields, sampleSchemas, sampleContext);
      const stats = getPromptStats(prompt);

      expect(stats).toHaveProperty('lines');
      expect(stats).toHaveProperty('chars');
      expect(stats).toHaveProperty('estimatedTokens');
      expect(stats.lines).toBeGreaterThan(0);
      expect(stats.chars).toBeGreaterThan(0);
      expect(stats.estimatedTokens).toBeGreaterThan(0);
    });

    test('should estimate tokens correctly', () => {
      const prompt = buildSchemaScoringPrompt(sampleFields, sampleSchemas, sampleContext);
      const stats = getPromptStats(prompt);

      // Token estimation: ~4 chars per token for Chinese text
      const expectedTokens = Math.ceil(stats.chars / 4);
      expect(stats.estimatedTokens).toBe(expectedTokens);
    });

    test('should show simplified prompt uses fewer tokens', () => {
      const fullPrompt = buildSchemaScoringPrompt(sampleFields, sampleSchemas, sampleContext);
      const simplifiedPrompt = buildSimplifiedPrompt(sampleFields, sampleSchemas, sampleContext);

      const fullStats = getPromptStats(fullPrompt);
      const simplifiedStats = getPromptStats(simplifiedPrompt);

      expect(simplifiedStats.estimatedTokens).toBeLessThan(fullStats.estimatedTokens * 0.4);
    });
  });

  describe('calculateRuleBasedCompleteness', () => {
    test('should calculate completeness for perfect match', () => {
      const result = calculateRuleBasedCompleteness(
        sampleFields,
        sampleSchemas[0],
        0.9
      );

      expect(result.schema_name).toBe('地下水位变化事件');
      expect(result.completeness).toBeCloseTo(0.9, 2); // All fields matched (weight sum = 1.0) * 0.9
      expect(result.matched_fields).toHaveLength(5);
      expect(result.missing_fields).toHaveLength(0);
      expect(result.meets_threshold).toBe(true);
    });

    test('should calculate completeness for partial match', () => {
      const partialFields = [
        { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 },
        { name: '指标', value: '水位', type: 'indicator', confidence: 0.95 }
      ];

      const result = calculateRuleBasedCompleteness(
        partialFields,
        sampleSchemas[0],
        0.9
      );

      // Matched: 区域(0.3) + 指标(0.2) = 0.5 * 0.9 = 0.45
      expect(result.completeness).toBeCloseTo(0.45, 2);
      expect(result.matched_fields).toHaveLength(2);
      expect(result.missing_fields).toHaveLength(3);
      expect(result.meets_threshold).toBe(false); // 0.45 < 0.75
    });

    test('should handle no matching fields', () => {
      const noMatchFields = [
        { name: '未知字段', value: '值', type: 'entity', confidence: 0.8 }
      ];

      const result = calculateRuleBasedCompleteness(
        noMatchFields,
        sampleSchemas[0],
        0.9
      );

      expect(result.completeness).toBe(0);
      expect(result.matched_fields).toHaveLength(0);
      expect(result.missing_fields).toHaveLength(5);
      expect(result.meets_threshold).toBe(false);
    });

    test('should apply source confidence correctly', () => {
      const highConfidence = calculateRuleBasedCompleteness(
        sampleFields,
        sampleSchemas[0],
        1.0
      );

      const lowConfidence = calculateRuleBasedCompleteness(
        sampleFields,
        sampleSchemas[0],
        0.5
      );

      expect(highConfidence.completeness).toBeCloseTo(1.0, 2);
      expect(lowConfidence.completeness).toBeCloseTo(0.5, 2);
    });

    test('should use default source confidence of 1.0', () => {
      const result = calculateRuleBasedCompleteness(
        sampleFields,
        sampleSchemas[0]
      );

      expect(result.completeness).toBeCloseTo(1.0, 2);
    });

    test('should identify matched and missing fields correctly', () => {
      const partialFields = [
        { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 },
        { name: '时间', value: '2025-01', type: 'time', confidence: 0.95 },
        { name: '指标', value: '水位', type: 'indicator', confidence: 0.95 }
      ];

      const result = calculateRuleBasedCompleteness(
        partialFields,
        sampleSchemas[0],
        0.9
      );

      expect(result.matched_fields).toEqual(['区域', '时间', '指标']);
      expect(result.missing_fields).toEqual(['数值', '单位']);
    });

    test('should work with different schema', () => {
      const result = calculateRuleBasedCompleteness(
        sampleFields,
        sampleSchemas[1], // 区域环境监测
        0.9
      );

      expect(result.schema_name).toBe('区域环境监测');
      expect(result.matched_fields).toEqual(['区域', '指标', '数值']);
      expect(result.completeness).toBeCloseTo(0.9, 2); // (0.4 + 0.3 + 0.3) * 0.9
      expect(result.meets_threshold).toBe(true); // 0.9 >= 0.7
    });
  });

  describe('Integration scenarios', () => {
    test('should handle single clear match scenario', () => {
      const prompt = buildSchemaScoringPrompt(sampleFields, sampleSchemas, sampleContext);
      
      expect(prompt).toContain('地下水位变化事件');
      expect(prompt).toContain('区域环境监测');
      
      // Verify rule-based calculation matches expected behavior
      const result1 = calculateRuleBasedCompleteness(sampleFields, sampleSchemas[0], 0.9);
      const result2 = calculateRuleBasedCompleteness(sampleFields, sampleSchemas[1], 0.9);
      
      expect(result1.meets_threshold).toBe(true);
      expect(result2.meets_threshold).toBe(true);
      // Both schemas match all their fields, so both have completeness = 0.9
      expect(result1.completeness).toBeCloseTo(0.9, 2);
      expect(result2.completeness).toBeCloseTo(0.9, 2);
      // Both schemas are valid matches in this scenario
    });

    test('should handle ambiguous match scenario', () => {
      const ambiguousFields = [
        { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 },
        { name: '指标', value: '水位', type: 'indicator', confidence: 0.95 },
        { name: '数值', value: '10', type: 'number', confidence: 0.95 }
      ];

      const result1 = calculateRuleBasedCompleteness(ambiguousFields, sampleSchemas[0], 0.9);
      const result2 = calculateRuleBasedCompleteness(ambiguousFields, sampleSchemas[1], 0.9);

      // Both schemas partially match, but neither clearly dominates
      expect(result1.completeness).toBeCloseTo(0.63, 2); // (0.3+0.2+0.2)*0.9
      expect(result2.completeness).toBeCloseTo(0.9, 2);  // (0.4+0.3+0.3)*0.9
      
      // This is where LLM scoring would be useful
      expect(result1.meets_threshold).toBe(false);
      expect(result2.meets_threshold).toBe(true);
    });

    test('should handle no match scenario', () => {
      const unrelatedFields = [
        { name: '人名', value: '张三', type: 'entity', confidence: 0.9 },
        { name: '组织', value: '阿里巴巴', type: 'entity', confidence: 0.95 }
      ];

      const result1 = calculateRuleBasedCompleteness(unrelatedFields, sampleSchemas[0], 0.9);
      const result2 = calculateRuleBasedCompleteness(unrelatedFields, sampleSchemas[1], 0.9);

      expect(result1.completeness).toBe(0);
      expect(result2.completeness).toBe(0);
      expect(result1.meets_threshold).toBe(false);
      expect(result2.meets_threshold).toBe(false);
    });
  });
});
