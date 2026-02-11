/**
 * Error Handling Tests for Relation Description Generator
 * 
 * Tests error handling and edge cases for relation description generation.
 * Validates: Requirement 6.1 - Error Handling
 */

const { RelationDescriptionGenerator } = require('./relation_description_generator');

describe('Relation Description Generator - Error Handling', () => {
  let generator;

  beforeEach(() => {
    generator = new RelationDescriptionGenerator({ enableLLM: false });
  });

  describe('Input Validation', () => {
    it('should handle null relation gracefully', async () => {
      const result = await generator.generateDescription(null);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('error');
      expect(result.confidence).toBe(0.0);
      expect(result.metadata.error).toBeDefined();
    });
    
    it('should handle undefined relation gracefully', async () => {
      const result = await generator.generateDescription(undefined);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('error');
      expect(result.confidence).toBe(0.0);
      expect(result.metadata.error).toBeDefined();
    });
    
    it('should handle relation with missing source', async () => {
      const relation = {
        type: 'test_relation',
        target: { name: 'Target' }
      };
      const result = await generator.generateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('error');
      expect(result.metadata.error).toBeDefined();
    });
    
    it('should handle relation with missing target', async () => {
      const relation = {
        type: 'test_relation',
        source: { name: 'Source' }
      };
      const result = await generator.generateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('error');
      expect(result.metadata.error).toBeDefined();
    });
    
    it('should handle relation with missing type', async () => {
      const relation = {
        source: { name: 'Source' },
        target: { name: 'Target' }
      };
      const result = await generator.generateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('error');
      expect(result.metadata.error).toBeDefined();
    });
    
    it('should handle relation with null source', async () => {
      const relation = {
        type: 'test_relation',
        source: null,
        target: { name: 'Target' }
      };
      const result = await generator.generateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('error');
    });
    
    it('should handle relation with null target', async () => {
      const relation = {
        type: 'test_relation',
        source: { name: 'Source' },
        target: null
      };
      const result = await generator.generateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('error');
    });
    
    it('should handle relation with non-string type', async () => {
      const relation = {
        type: 123,
        source: { name: 'Source' },
        target: { name: 'Target' }
      };
      const result = await generator.generateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('error');
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle entities with missing names', async () => {
      const relation = {
        type: 'test_relation',
        source: {},
        target: {}
      };
      const result = await generator.generateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.description).toContain('Unknown');
    });
    
    it('should handle entities with null names', async () => {
      const relation = {
        type: 'test_relation',
        source: { name: null },
        target: { name: null }
      };
      const result = await generator.generateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
    });
    
    it('should handle entities with empty string names', async () => {
      const relation = {
        type: 'test_relation',
        source: { name: '' },
        target: { name: '' }
      };
      const result = await generator.generateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
    });
    
    it('should handle entities with very long names', async () => {
      const longName = 'A'.repeat(500);
      const relation = {
        type: 'test_relation',
        source: { name: longName },
        target: { name: longName }
      };
      const result = await generator.generateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
    });
    
    it('should handle entities with special characters', async () => {
      const relation = {
        type: 'test_relation',
        source: { name: '!@#$%^&*()' },
        target: { name: '<>?:"{}|' }
      };
      const result = await generator.generateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
    });
    
    it('should handle entities with unicode characters', async () => {
      const relation = {
        type: 'test_relation',
        source: { name: '测试实体' },
        target: { name: 'Café Münchën' }
      };
      const result = await generator.generateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
    });
    
    it('should handle unknown relation types', async () => {
      const relation = {
        type: 'completely_unknown_type_12345',
        source: { name: 'Source' },
        target: { name: 'Target' }
      };
      const result = await generator.generateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.method).toMatch(/template|fallback/);
    });
    
    it('should handle relation with null bytes in names', async () => {
      const relation = {
        type: 'test_relation',
        source: { name: 'Source\u0000Name' },
        target: { name: 'Target\u0000Name' }
      };
      const result = await generator.generateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
    });
  });
  
  describe('Template Generation Error Handling', () => {
    it('should handle template generation with invalid relation', async () => {
      const result = await generator.generateTemplateDescription(null);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('fallback');
    });
    
    it('should handle template generation with missing entities', async () => {
      const relation = {
        type: 'test_relation'
      };
      const result = await generator.generateTemplateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('fallback');
    });
    
    it('should handle template generation with partial entity data', async () => {
      const relation = {
        type: 'test_relation',
        source: { canonical_name: 'Source' },
        target: {} // Missing name
      };
      const result = await generator.generateTemplateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
    });
  });
  
  describe('LLM Generation Error Handling', () => {
    it('should handle LLM generation when client is not available', async () => {
      const relation = {
        type: 'test_relation',
        source: { name: 'Source' },
        target: { name: 'Target' }
      };
      const result = await generator.generateLLMDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('fallback');
    });
    
    it('should handle LLM generation with invalid relation', async () => {
      const result = await generator.generateLLMDescription(null);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('fallback');
    });
    
    it('should handle LLM generation with missing entities', async () => {
      const relation = {
        type: 'test_relation'
      };
      const result = await generator.generateLLMDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('fallback');
    });
    
    it('should handle LLM timeout', async () => {
      // Create generator with mock LLM client that times out
      const mockLLMClient = {
        callJSON: jest.fn(() => new Promise(resolve => setTimeout(resolve, 10000)))
      };
      
      const generatorWithLLM = new RelationDescriptionGenerator({
        llmClient: mockLLMClient,
        enableLLM: true
      });
      
      const relation = {
        type: 'test_relation',
        source: { name: 'Source' },
        target: { name: 'Target' }
      };
      
      const result = await generatorWithLLM.generateDescription(relation, {
        method: 'llm',
        timeout: 100 // 100ms timeout
      });
      
      expect(result).toBeDefined();
      expect(result.method).toBe('fallback');
    });
    
    it('should handle LLM API errors', async () => {
      // Create generator with mock LLM client that throws error
      const mockLLMClient = {
        callJSON: jest.fn(() => Promise.reject(new Error('API Error')))
      };
      
      const generatorWithLLM = new RelationDescriptionGenerator({
        llmClient: mockLLMClient,
        enableLLM: true
      });
      
      const relation = {
        type: 'test_relation',
        source: { name: 'Source' },
        target: { name: 'Target' }
      };
      
      const result = await generatorWithLLM.generateLLMDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('fallback');
    });
  });
  
  describe('Cache Error Handling', () => {
    it('should handle cache operations with invalid relations', async () => {
      const result = await generator.generateDescription(null, { useCache: true });
      
      expect(result).toBeDefined();
      expect(result.method).toBe('error');
    });
    
    it('should handle cache size limits', async () => {
      // Generate many descriptions to test cache limit
      const promises = [];
      for (let i = 0; i < 1100; i++) {
        const relation = {
          type: 'test_relation',
          source: { name: `Source${i}` },
          target: { name: `Target${i}` }
        };
        promises.push(generator.generateDescription(relation, { useCache: true }));
      }
      
      await Promise.all(promises);
      
      const stats = generator.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(1000);
    });
    
    it('should handle cache clear', () => {
      generator.clearCache();
      const stats = generator.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });
  
  describe('Graceful Degradation', () => {
    it('should return fallback when template fails', async () => {
      const relation = {
        type: 'test_relation',
        source: { name: 'Source' },
        target: { name: 'Target' }
      };
      
      const result = await generator.generateDescription(relation);
      
      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
      expect(['template', 'fallback']).toContain(result.method);
    });
    
    it('should always return confidence score', async () => {
      const relation = {
        type: 'test_relation',
        source: { name: 'Source' },
        target: { name: 'Target' }
      };
      
      const result = await generator.generateDescription(relation);
      
      expect(result.confidence).toBeDefined();
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
    
    it('should always return method', async () => {
      const relation = {
        type: 'test_relation',
        source: { name: 'Source' },
        target: { name: 'Target' }
      };
      
      const result = await generator.generateDescription(relation);
      
      expect(result.method).toBeDefined();
      expect(['template', 'llm', 'fallback', 'error']).toContain(result.method);
    });
    
    it('should always return metadata', async () => {
      const relation = {
        type: 'test_relation',
        source: { name: 'Source' },
        target: { name: 'Target' }
      };
      
      const result = await generator.generateDescription(relation);
      
      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata).toBe('object');
    });
  });
  
  describe('Helper Method Error Handling', () => {
    it('should handle _getCacheKey with invalid relation', () => {
      const key = generator._getCacheKey(null);
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
    });
    
    it('should handle _getCacheKey with missing properties', () => {
      const key = generator._getCacheKey({});
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
    });
    
    it('should handle _findRelationType with null type', () => {
      const type = generator._findRelationType(null);
      expect(type).toBeDefined();
      expect(type.name).toBeDefined();
    });
    
    it('should handle _findRelationType with undefined type', () => {
      const type = generator._findRelationType(undefined);
      expect(type).toBeDefined();
      expect(type).toHaveProperty('name');
    });
    
    it('should handle _substituteTemplate with null template', () => {
      const result = generator._substituteTemplate(null, { source: 'Test' });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
    
    it('should handle _substituteTemplate with null variables', () => {
      const result = generator._substituteTemplate('Test {source}', null);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
