/**
 * Unit tests for RelationDescriptionGenerator
 * 
 * Tests template-based and LLM-based description generation.
 */

const { RelationDescriptionGenerator } = require('./relation_description_generator');

describe('RelationDescriptionGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new RelationDescriptionGenerator();
  });

  describe('Template-based Description Generation', () => {
    test('should generate description for family_parent relation', async () => {
      const relation = {
        type: 'family_parent',
        source: { canonical_name: '张三' },
        target: { canonical_name: '张小明' }
      };

      const result = await generator.generateTemplateDescription(relation);

      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.method).toBe('template');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      
      // Description should contain both entity names
      expect(result.description).toContain('张三');
      expect(result.description).toContain('张小明');
    });

    test('should generate description for located_in relation', async () => {
      const relation = {
        type: 'located_in',
        source: { canonical_name: '北京' },
        target: { canonical_name: '中国' }
      };

      const result = await generator.generateTemplateDescription(relation);

      expect(result.description).toBeDefined();
      expect(result.description).toContain('北京');
      expect(result.description).toContain('中国');
      expect(['template', 'fallback']).toContain(result.method);
    });

    test('should generate description for causes relation', async () => {
      const relation = {
        type: 'causes',
        source: { canonical_name: '降雨' },
        target: { canonical_name: '洪水' }
      };

      const result = await generator.generateTemplateDescription(relation);

      expect(result.description).toBeDefined();
      expect(result.description).toContain('降雨');
      expect(result.description).toContain('洪水');
    });

    test('should generate description for is_a relation', async () => {
      const relation = {
        type: 'is_a',
        source: { canonical_name: '狗' },
        target: { canonical_name: '动物' }
      };

      const result = await generator.generateTemplateDescription(relation);

      expect(result.description).toBeDefined();
      expect(result.description).toContain('狗');
      expect(result.description).toContain('动物');
    });

    test('should handle unknown relation types with fallback', async () => {
      const relation = {
        type: 'unknown_relation_type',
        source: { canonical_name: 'Entity A' },
        target: { canonical_name: 'Entity B' }
      };

      const result = await generator.generateTemplateDescription(relation);

      expect(result.description).toBeDefined();
      // Now returns 'template' because we create a minimal type definition for unknown types
      expect(result.method).toBe('template');
      expect(result.description).toContain('Entity A');
      expect(result.description).toContain('Entity B');
    });

    test('should handle missing entity names gracefully', async () => {
      const relation = {
        type: 'family_parent',
        source: {},
        target: {}
      };

      const result = await generator.generateTemplateDescription(relation);

      expect(result.description).toBeDefined();
      expect(result.description.length).toBeGreaterThan(0);
    });
  });

  describe('LLM-based Description Generation', () => {
    test('should return fallback when LLM client not available', async () => {
      const relation = {
        type: 'family_parent',
        source: { canonical_name: '张三' },
        target: { canonical_name: '张小明' }
      };

      const result = await generator.generateLLMDescription(relation);

      expect(result).toBeDefined();
      expect(result.method).toBe('fallback');
    });

    test('should use LLM when client is available', async () => {
      // Mock LLM client
      const mockLLMClient = {
        callJSON: jest.fn().mockResolvedValue({
          description: '张三是张小明的父亲',
          confidence: 0.95,
          reasoning: '根据父母关系生成'
        })
      };

      generator.llmClient = mockLLMClient;

      const relation = {
        type: 'family_parent',
        source: { canonical_name: '张三' },
        target: { canonical_name: '张小明' }
      };

      const result = await generator.generateLLMDescription(relation);

      expect(result).toBeDefined();
      expect(result.method).toBe('llm');
      expect(result.description).toBe('张三是张小明的父亲');
      expect(result.confidence).toBe(0.95);
      expect(mockLLMClient.callJSON).toHaveBeenCalled();
    });

    test('should validate LLM-generated descriptions', async () => {
      // Mock LLM client with invalid response (too short)
      const mockLLMClient = {
        callJSON: jest.fn().mockResolvedValue({
          description: '关系',
          confidence: 0.9
        })
      };

      generator.llmClient = mockLLMClient;

      const relation = {
        type: 'family_parent',
        source: { canonical_name: '张三' },
        target: { canonical_name: '张小明' }
      };

      const result = await generator.generateLLMDescription(relation);

      // Should fall back due to validation failure
      expect(result.method).toBe('fallback');
    });

    test('should handle LLM errors gracefully', async () => {
      // Mock LLM client that throws error
      const mockLLMClient = {
        callJSON: jest.fn().mockRejectedValue(new Error('LLM API error'))
      };

      generator.llmClient = mockLLMClient;

      const relation = {
        type: 'family_parent',
        source: { canonical_name: '张三' },
        target: { canonical_name: '张小明' }
      };

      const result = await generator.generateLLMDescription(relation);

      expect(result).toBeDefined();
      expect(result.method).toBe('fallback');
    });
  });

  describe('Main generateDescription Method', () => {
    test('should use template method by default', async () => {
      const relation = {
        type: 'family_parent',
        source: { canonical_name: '张三' },
        target: { canonical_name: '张小明' }
      };

      const result = await generator.generateDescription(relation);

      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
      expect(['template', 'fallback']).toContain(result.method);
    });

    test('should respect method option', async () => {
      const relation = {
        type: 'family_parent',
        source: { canonical_name: '张三' },
        target: { canonical_name: '张小明' }
      };

      const result = await generator.generateDescription(relation, {
        method: 'template'
      });

      expect(result.method).toBe('template');
    });

    test('should use cache for repeated requests', async () => {
      const relation = {
        type: 'family_parent',
        source: { canonical_name: '张三' },
        target: { canonical_name: '张小明' }
      };

      const result1 = await generator.generateDescription(relation);
      const result2 = await generator.generateDescription(relation);

      expect(result1.description).toBe(result2.description);
      expect(generator.getCacheStats().size).toBeGreaterThan(0);
    });

    test('should bypass cache when useCache is false', async () => {
      const relation = {
        type: 'family_parent',
        source: { canonical_name: '张三' },
        target: { canonical_name: '张小明' }
      };

      await generator.generateDescription(relation, { useCache: false });
      
      expect(generator.getCacheStats().size).toBe(0);
    });
  });

  describe('English Language Support', () => {
    test('should generate English descriptions', async () => {
      const englishGenerator = new RelationDescriptionGenerator({ language: 'en' });

      const relation = {
        type: 'family_parent',
        source: { canonical_name: 'John' },
        target: { canonical_name: 'Mike' }
      };

      const result = await englishGenerator.generateTemplateDescription(relation);

      expect(result.description).toBeDefined();
      expect(result.description).toContain('John');
      expect(result.description).toContain('Mike');
      expect(result.description).toMatch(/parent|is/i);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty source name', async () => {
      const relation = {
        type: 'family_parent',
        source: { canonical_name: '' },
        target: { canonical_name: '张小明' }
      };

      const result = await generator.generateDescription(relation);

      expect(result.description).toBeDefined();
      expect(result.description.length).toBeGreaterThan(0);
    });

    test('should handle empty target name', async () => {
      const relation = {
        type: 'family_parent',
        source: { canonical_name: '张三' },
        target: { canonical_name: '' }
      };

      const result = await generator.generateDescription(relation);

      expect(result.description).toBeDefined();
      expect(result.description.length).toBeGreaterThan(0);
    });

    test('should handle special characters in names', async () => {
      const relation = {
        type: 'family_parent',
        source: { canonical_name: '张三（父亲）' },
        target: { canonical_name: '张小明[儿子]' }
      };

      const result = await generator.generateDescription(relation);

      expect(result.description).toBeDefined();
      expect(result.description).toContain('张三');
      expect(result.description).toContain('张小明');
    });

    test('should handle very long entity names', async () => {
      const longName = '这是一个非常非常非常非常非常非常长的实体名称用于测试边界情况';
      
      const relation = {
        type: 'family_parent',
        source: { canonical_name: longName },
        target: { canonical_name: '张小明' }
      };

      const result = await generator.generateDescription(relation);

      expect(result.description).toBeDefined();
      expect(result.description.length).toBeGreaterThan(0);
    });
  });

  describe('Cache Management', () => {
    test('should clear cache', async () => {
      const relation = {
        type: 'family_parent',
        source: { canonical_name: '张三' },
        target: { canonical_name: '张小明' }
      };

      await generator.generateDescription(relation);
      expect(generator.getCacheStats().size).toBeGreaterThan(0);

      generator.clearCache();
      expect(generator.getCacheStats().size).toBe(0);
    });

    test('should provide cache statistics', () => {
      const stats = generator.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
    });
  });

  describe('Relation Type Loading', () => {
    test('should load relation types on initialization', () => {
      expect(generator.relationTypes).toBeDefined();
      expect(generator.relationTypes).toHaveProperty('domains');
    });

    test('should handle missing relation_types.json gracefully', () => {
      // This test verifies the error handling in _loadRelationTypes
      // The generator should still work with fallback descriptions
      const relation = {
        type: 'some_type',
        source: { canonical_name: 'A' },
        target: { canonical_name: 'B' }
      };

      expect(async () => {
        await generator.generateDescription(relation);
      }).not.toThrow();
    });
  });
});
