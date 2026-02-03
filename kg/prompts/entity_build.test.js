/**
 * Unit tests for entity_build.js
 * 
 * Tests the entity name standardization and disambiguation prompts
 */

const {
  buildEntityNamePrompt,
  buildSimplifiedPrompt,
  buildEntityDisambiguationPrompt,
  validateEntityNamingResult,
  validateDisambiguationResult,
  getPromptStats,
  shouldUseLLMStandardization,
  isWellFormedName
} = require('./entity_build');

describe('Entity Build Prompt Module', () => {
  describe('buildEntityNamePrompt', () => {
    it('should build a complete prompt with all sections', () => {
      const rawName = '阿里C区_水位_2025-01';
      const entityType = 'EventEntity';
      const context = {
        text: '阿里C区2025年1月水位下降10米',
        fields: [
          { name: '区域', value: '阿里C区', type: 'location' },
          { name: '时间', value: '2025-01', type: 'time' },
          { name: '指标', value: '水位', type: 'indicator' }
        ],
        schema: { schema_name: '地下水位变化事件' }
      };

      const prompt = buildEntityNamePrompt(rawName, entityType, context);

      expect(prompt).toContain('阿里C区_水位_2025-01');
      expect(prompt).toContain('EventEntity');
      expect(prompt).toContain('阿里C区2025年1月水位下降10米');
      expect(prompt).toContain('区域: 阿里C区');
      expect(prompt).toContain('地下水位变化事件');
      expect(prompt).toContain('canonical_name');
      expect(prompt).toContain('aliases');
      expect(prompt).toContain('reasoning');
    });

    it('should include examples by default', () => {
      const prompt = buildEntityNamePrompt('测试', 'EventEntity');
      expect(prompt).toContain('标准化示例');
      expect(prompt).toContain('示例 1');
    });

    it('should exclude examples when includeExamples is false', () => {
      const prompt = buildEntityNamePrompt('测试', 'EventEntity', {}, { includeExamples: false });
      expect(prompt).not.toContain('标准化示例');
    });

    it('should respect maxAliases option', () => {
      const prompt = buildEntityNamePrompt('测试', 'EventEntity', {}, { maxAliases: 5 });
      expect(prompt).toContain('2-5 个常见别名');
    });

    it('should handle different entity types', () => {
      const types = ['EventEntity', 'LocationEntity', 'PersonEntity', 'OrganizationEntity', 'IndicatorEntity'];
      
      types.forEach(type => {
        const prompt = buildEntityNamePrompt('测试', type);
        expect(prompt).toContain(type);
        expect(prompt).toContain('实体类型说明');
      });
    });

    it('should handle unknown entity types gracefully', () => {
      const prompt = buildEntityNamePrompt('测试', 'UnknownEntity');
      expect(prompt).toContain('UnknownEntity');
      expect(prompt).toContain('通用实体');
    });

    it('should work without context', () => {
      const prompt = buildEntityNamePrompt('测试', 'EventEntity');
      expect(prompt).toBeDefined();
      expect(prompt).toContain('测试');
    });
  });

  describe('buildSimplifiedPrompt', () => {
    it('should build a simplified prompt', () => {
      const prompt = buildSimplifiedPrompt('阿里C区_水位_2025-01', 'EventEntity');
      
      expect(prompt).toContain('阿里C区_水位_2025-01');
      expect(prompt).toContain('EventEntity');
      expect(prompt).toContain('canonical_name');
      expect(prompt).toContain('aliases');
    });

    it('should be significantly shorter than full prompt', () => {
      const fullPrompt = buildEntityNamePrompt('测试', 'EventEntity');
      const simplifiedPrompt = buildSimplifiedPrompt('测试', 'EventEntity');
      
      expect(simplifiedPrompt.length).toBeLessThan(fullPrompt.length * 0.3);
    });

    it('should include text context when provided', () => {
      const context = { text: '阿里C区2025年1月水位下降10米' };
      const prompt = buildSimplifiedPrompt('测试', 'EventEntity', context);
      
      expect(prompt).toContain('阿里C区2025年1月水位下降10米');
    });

    it('should work without context', () => {
      const prompt = buildSimplifiedPrompt('测试', 'EventEntity');
      expect(prompt).toBeDefined();
      expect(prompt).not.toContain('文本：');
    });
  });

  describe('buildEntityDisambiguationPrompt', () => {
    it('should build a complete disambiguation prompt', () => {
      const entity1 = {
        canonical_name: '阿里巴巴',
        aliases: ['阿里', 'Alibaba'],
        attributes: { type: '公司', industry: '互联网' }
      };
      const entity2 = {
        canonical_name: '阿里巴巴集团',
        aliases: ['阿里集团', '阿里'],
        attributes: { type: '公司', industry: '科技' }
      };

      const prompt = buildEntityDisambiguationPrompt(entity1, entity2);

      expect(prompt).toContain('阿里巴巴');
      expect(prompt).toContain('阿里巴巴集团');
      expect(prompt).toContain('实体1');
      expect(prompt).toContain('实体2');
      expect(prompt).toContain('is_same');
      expect(prompt).toContain('confidence');
      expect(prompt).toContain('recommended_canonical_name');
    });

    it('should include examples by default', () => {
      const entity1 = { canonical_name: '测试1', aliases: [], attributes: {} };
      const entity2 = { canonical_name: '测试2', aliases: [], attributes: {} };
      
      const prompt = buildEntityDisambiguationPrompt(entity1, entity2);
      expect(prompt).toContain('消歧示例');
    });

    it('should exclude examples when includeExamples is false', () => {
      const entity1 = { canonical_name: '测试1', aliases: [], attributes: {} };
      const entity2 = { canonical_name: '测试2', aliases: [], attributes: {} };
      
      const prompt = buildEntityDisambiguationPrompt(entity1, entity2, { includeExamples: false });
      expect(prompt).not.toContain('消歧示例');
    });

    it('should handle entities without aliases', () => {
      const entity1 = { canonical_name: '测试1', attributes: {} };
      const entity2 = { canonical_name: '测试2', attributes: {} };
      
      const prompt = buildEntityDisambiguationPrompt(entity1, entity2);
      expect(prompt).toContain('无');
    });

    it('should handle entities without attributes', () => {
      const entity1 = { canonical_name: '测试1', aliases: ['别名1'] };
      const entity2 = { canonical_name: '测试2', aliases: ['别名2'] };
      
      const prompt = buildEntityDisambiguationPrompt(entity1, entity2);
      expect(prompt).toContain('无');
    });
  });

  describe('validateEntityNamingResult', () => {
    it('should validate a correct result', () => {
      const result = {
        canonical_name: '阿里C区水位下降_2025-01',
        aliases: ['阿里C区水位变化', 'C区水位下降'],
        reasoning: '规范化为标准格式'
      };

      const { validResult, errors } = validateEntityNamingResult(result, '原始名称');

      expect(validResult).toBeDefined();
      expect(validResult.canonical_name).toBe('阿里C区水位下降_2025-01');
      expect(validResult.aliases).toHaveLength(2);
      expect(errors).toHaveLength(0);
    });

    it('should reject result without canonical_name', () => {
      const result = {
        aliases: ['别名1'],
        reasoning: '理由'
      };

      const { validResult, errors } = validateEntityNamingResult(result);

      expect(validResult).toBeNull();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('canonical_name');
    });

    it('should reject result with empty canonical_name', () => {
      const result = {
        canonical_name: '   ',
        aliases: ['别名1'],
        reasoning: '理由'
      };

      const { validResult, errors } = validateEntityNamingResult(result);

      expect(validResult).toBeNull();
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject result with too long canonical_name', () => {
      const result = {
        canonical_name: 'a'.repeat(101),
        aliases: ['别名1'],
        reasoning: '理由'
      };

      const { validResult, errors } = validateEntityNamingResult(result);

      expect(validResult).toBeNull();
      expect(errors.some(e => e.includes('too long'))).toBe(true);
    });

    it('should reject result without aliases array', () => {
      const result = {
        canonical_name: '测试',
        aliases: '别名1',
        reasoning: '理由'
      };

      const { validResult, errors } = validateEntityNamingResult(result);

      expect(validResult).toBeNull();
      expect(errors.some(e => e.includes('aliases must be an array'))).toBe(true);
    });

    it('should filter out invalid aliases but keep valid ones', () => {
      const result = {
        canonical_name: '测试',
        aliases: ['别名1', '', '别名2'],
        reasoning: '理由'
      };

      const { validResult, errors } = validateEntityNamingResult(result);

      // Should succeed and filter out empty aliases
      expect(validResult).toBeDefined();
      expect(validResult.aliases).toHaveLength(2);
      expect(validResult.aliases).toEqual(['别名1', '别名2']);
      expect(errors).toHaveLength(0);
    });

    it('should reject result with all invalid aliases', () => {
      const result = {
        canonical_name: '测试',
        aliases: ['', '  ', null],
        reasoning: '理由'
      };

      const { validResult, errors } = validateEntityNamingResult(result);

      expect(validResult).toBeNull();
      expect(errors.some(e => e.includes('All aliases are invalid'))).toBe(true);
    });

    it('should reject result with duplicate aliases', () => {
      const result = {
        canonical_name: '测试',
        aliases: ['别名1', '别名1', '别名2'],
        reasoning: '理由'
      };

      const { validResult, errors } = validateEntityNamingResult(result);

      expect(validResult).toBeNull();
      expect(errors.some(e => e.includes('duplicates'))).toBe(true);
    });

    it('should reject result with canonical_name in aliases', () => {
      const result = {
        canonical_name: '测试',
        aliases: ['测试', '别名1'],
        reasoning: '理由'
      };

      const { validResult, errors } = validateEntityNamingResult(result);

      expect(validResult).toBeNull();
      expect(errors.some(e => e.includes('should not be in aliases'))).toBe(true);
    });

    it('should trim whitespace from names', () => {
      const result = {
        canonical_name: '  测试  ',
        aliases: ['  别名1  ', '别名2'],
        reasoning: '理由'
      };

      const { validResult, errors } = validateEntityNamingResult(result);

      expect(validResult).toBeDefined();
      expect(validResult.canonical_name).toBe('测试');
      expect(validResult.aliases[0]).toBe('别名1');
      expect(errors).toHaveLength(0);
    });

    it('should filter out empty aliases', () => {
      const result = {
        canonical_name: '测试',
        aliases: ['别名1', '', '  ', '别名2'],
        reasoning: '理由'
      };

      const { validResult, errors } = validateEntityNamingResult(result);

      expect(validResult).toBeDefined();
      expect(validResult.aliases).toHaveLength(2);
      expect(validResult.aliases).toEqual(['别名1', '别名2']);
    });

    it('should accept result without reasoning', () => {
      const result = {
        canonical_name: '测试',
        aliases: ['别名1']
      };

      const { validResult, errors } = validateEntityNamingResult(result);

      expect(validResult).toBeDefined();
      expect(validResult.reasoning).toBe('');
      expect(errors).toHaveLength(0);
    });
  });

  describe('validateDisambiguationResult', () => {
    it('should validate a correct result for same entities', () => {
      const result = {
        is_same: true,
        confidence: 0.95,
        reasoning: '两个实体是同一个',
        recommended_canonical_name: '阿里巴巴'
      };

      const { validResult, errors } = validateDisambiguationResult(result);

      expect(validResult).toBeDefined();
      expect(validResult.is_same).toBe(true);
      expect(validResult.confidence).toBe(0.95);
      expect(validResult.recommended_canonical_name).toBe('阿里巴巴');
      expect(errors).toHaveLength(0);
    });

    it('should validate a correct result for different entities', () => {
      const result = {
        is_same: false,
        confidence: 0.98,
        reasoning: '两个实体不同',
        recommended_canonical_name: null
      };

      const { validResult, errors } = validateDisambiguationResult(result);

      expect(validResult).toBeDefined();
      expect(validResult.is_same).toBe(false);
      expect(validResult.recommended_canonical_name).toBeNull();
      expect(errors).toHaveLength(0);
    });

    it('should reject result without is_same', () => {
      const result = {
        confidence: 0.95,
        reasoning: '理由',
        recommended_canonical_name: '测试'
      };

      const { validResult, errors } = validateDisambiguationResult(result);

      expect(validResult).toBeNull();
      expect(errors.some(e => e.includes('is_same'))).toBe(true);
    });

    it('should reject result with invalid confidence', () => {
      const result = {
        is_same: true,
        confidence: 1.5,
        reasoning: '理由',
        recommended_canonical_name: '测试'
      };

      const { validResult, errors } = validateDisambiguationResult(result);

      expect(validResult).toBeNull();
      expect(errors.some(e => e.includes('confidence'))).toBe(true);
    });

    it('should reject result without reasoning', () => {
      const result = {
        is_same: true,
        confidence: 0.95,
        recommended_canonical_name: '测试'
      };

      const { validResult, errors } = validateDisambiguationResult(result);

      expect(validResult).toBeNull();
      expect(errors.some(e => e.includes('reasoning'))).toBe(true);
    });

    it('should require recommended_canonical_name when is_same is true', () => {
      const result = {
        is_same: true,
        confidence: 0.95,
        reasoning: '理由',
        recommended_canonical_name: null
      };

      const { validResult, errors } = validateDisambiguationResult(result);

      expect(validResult).toBeNull();
      expect(errors.some(e => e.includes('recommended_canonical_name'))).toBe(true);
    });

    it('should reject recommended_canonical_name when is_same is false', () => {
      const result = {
        is_same: false,
        confidence: 0.95,
        reasoning: '理由',
        recommended_canonical_name: '测试'
      };

      const { validResult, errors } = validateDisambiguationResult(result);

      expect(validResult).toBeNull();
      expect(errors.some(e => e.includes('should be null'))).toBe(true);
    });
  });

  describe('getPromptStats', () => {
    it('should calculate prompt statistics', () => {
      const prompt = '这是一个测试提示词\n包含多行\n用于测试';
      const stats = getPromptStats(prompt);

      expect(stats.lines).toBe(3);
      expect(stats.chars).toBe(prompt.length);
      expect(stats.estimatedTokens).toBeGreaterThan(0);
      expect(stats.estimatedTokens).toBe(Math.ceil(prompt.length / 4));
    });

    it('should handle empty prompt', () => {
      const stats = getPromptStats('');

      expect(stats.lines).toBe(1);
      expect(stats.chars).toBe(0);
      expect(stats.estimatedTokens).toBe(0);
    });
  });

  describe('shouldUseLLMStandardization', () => {
    it('should always return true for poorly formed names', () => {
      const poorNames = [
        '测试  名称',  // Multiple spaces
        '测试!',       // Special characters
        '测试的',      // Ends with redundant word
        'a',           // Too short
        ''             // Empty
      ];

      poorNames.forEach(name => {
        expect(shouldUseLLMStandardization(name, 0)).toBe(true);
      });
    });

    it('should respect sampling rate for well-formed names', () => {
      const wellFormedName = '阿里C区';
      
      // With 0% sampling rate, should always return false for well-formed names
      const results0 = Array.from({ length: 10 }, () => 
        shouldUseLLMStandardization(wellFormedName, 0)
      );
      expect(results0.every(r => r === false)).toBe(true);

      // With 100% sampling rate, should always return true
      const results100 = Array.from({ length: 10 }, () => 
        shouldUseLLMStandardization(wellFormedName, 1)
      );
      expect(results100.every(r => r === true)).toBe(true);
    });

    it('should use default sampling rate of 0.5', () => {
      const wellFormedName = '阿里C区';
      
      // Run multiple times to test randomness
      const results = Array.from({ length: 100 }, () => 
        shouldUseLLMStandardization(wellFormedName)
      );
      
      const trueCount = results.filter(r => r === true).length;
      
      // With 50% sampling, expect roughly 50% true (allow 30-70% range for randomness)
      expect(trueCount).toBeGreaterThan(30);
      expect(trueCount).toBeLessThan(70);
    });
  });

  describe('isWellFormedName', () => {
    it('should return true for well-formed names', () => {
      const wellFormedNames = [
        '阿里C区',
        '北京市',
        '张三',
        '阿里巴巴',
        '水位下降',
        'GDP'
      ];

      wellFormedNames.forEach(name => {
        expect(isWellFormedName(name)).toBe(true);
      });
    });

    it('should return false for poorly formed names', () => {
      const poorlyFormedNames = [
        '',              // Empty
        '   ',           // Whitespace only
        'a',             // Too short
        '测试  名称',    // Multiple spaces
        '测试!',         // Special characters
        '测试@#$',       // Multiple special characters
        '测试的',        // Ends with redundant word
        '测试了',        // Ends with redundant word
        '测试事件',      // Ends with redundant word
        null,            // Null
        undefined        // Undefined
      ];

      poorlyFormedNames.forEach(name => {
        expect(isWellFormedName(name)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(isWellFormedName('测试')).toBe(true);  // Minimum valid length
      expect(isWellFormedName('测')).toBe(false);   // Too short
      expect(isWellFormedName('测 试')).toBe(true); // Single space is OK
      expect(isWellFormedName('测  试')).toBe(false); // Multiple spaces
    });
  });

  describe('Token optimization', () => {
    it('should have simplified prompt significantly shorter than full prompt', () => {
      const rawName = '阿里C区_水位_2025-01';
      const entityType = 'EventEntity';
      const context = {
        text: '阿里C区2025年1月水位下降10米',
        fields: [
          { name: '区域', value: '阿里C区', type: 'location' }
        ]
      };

      const fullPrompt = buildEntityNamePrompt(rawName, entityType, context);
      const simplifiedPrompt = buildSimplifiedPrompt(rawName, entityType, context);

      const fullStats = getPromptStats(fullPrompt);
      const simplifiedStats = getPromptStats(simplifiedPrompt);

      // Simplified should use less than 40% of full prompt tokens
      expect(simplifiedStats.estimatedTokens).toBeLessThan(fullStats.estimatedTokens * 0.4);
    });

    it('should estimate reasonable token counts', () => {
      const fullPrompt = buildEntityNamePrompt('测试', 'EventEntity');
      const stats = getPromptStats(fullPrompt);

      // Full prompt with examples should be around 800-1200 tokens
      expect(stats.estimatedTokens).toBeGreaterThan(500);
      expect(stats.estimatedTokens).toBeLessThan(1500);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete entity naming workflow', () => {
      // 1. Generate prompt
      const rawName = '阿里C区_水位_2025-01';
      const prompt = buildEntityNamePrompt(rawName, 'EventEntity', {
        text: '阿里C区2025年1月水位下降10米'
      });

      expect(prompt).toBeDefined();

      // 2. Simulate LLM response
      const llmResponse = {
        canonical_name: '阿里C区水位下降_2025-01',
        aliases: ['阿里C区水位变化', 'C区水位下降', '阿里C区2025年1月水位事件'],
        reasoning: '规范化为标准格式'
      };

      // 3. Validate response
      const { validResult, errors } = validateEntityNamingResult(llmResponse, rawName);

      expect(validResult).toBeDefined();
      expect(errors).toHaveLength(0);
      expect(validResult.canonical_name).toBe('阿里C区水位下降_2025-01');
      expect(validResult.aliases).toHaveLength(3);
    });

    it('should handle complete disambiguation workflow', () => {
      // 1. Generate prompt
      const entity1 = {
        canonical_name: '阿里巴巴',
        aliases: ['阿里', 'Alibaba'],
        attributes: { type: '公司' }
      };
      const entity2 = {
        canonical_name: '阿里巴巴集团',
        aliases: ['阿里集团'],
        attributes: { type: '公司' }
      };

      const prompt = buildEntityDisambiguationPrompt(entity1, entity2);
      expect(prompt).toBeDefined();

      // 2. Simulate LLM response
      const llmResponse = {
        is_same: true,
        confidence: 0.95,
        reasoning: '两个实体都指向阿里巴巴公司',
        recommended_canonical_name: '阿里巴巴'
      };

      // 3. Validate response
      const { validResult, errors } = validateDisambiguationResult(llmResponse);

      expect(validResult).toBeDefined();
      expect(errors).toHaveLength(0);
      expect(validResult.is_same).toBe(true);
      expect(validResult.confidence).toBe(0.95);
    });
  });
});
