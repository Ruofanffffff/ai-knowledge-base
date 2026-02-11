/**
 * Error Handling Tests for Hierarchical Relation Extractor
 * 
 * Tests error handling and edge cases for hierarchical relation extraction.
 * Validates: Requirement 6.1 - Error Handling
 */

const { HierarchicalRelationExtractor } = require('./hierarchical_relation_extractor');

describe('Hierarchical Relation Extractor - Error Handling', () => {
  let extractor;

  beforeEach(() => {
    extractor = new HierarchicalRelationExtractor({ enableLLM: false });
  });

  describe('Input Validation', () => {
    it('should handle null text gracefully', async () => {
      const entities = [{ id: 'e1', canonical_name: 'Test' }];
      const result = await extractor.extractHierarchicalRelations(null, entities);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
    
    it('should handle undefined text gracefully', async () => {
      const entities = [{ id: 'e1', canonical_name: 'Test' }];
      const result = await extractor.extractHierarchicalRelations(undefined, entities);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
    
    it('should handle empty string text', async () => {
      const entities = [{ id: 'e1', canonical_name: 'Test' }];
      const result = await extractor.extractHierarchicalRelations('', entities);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
    
    it('should handle null entities gracefully', async () => {
      const text = 'Test text';
      const result = await extractor.extractHierarchicalRelations(text, null);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
    
    it('should handle undefined entities gracefully', async () => {
      const text = 'Test text';
      const result = await extractor.extractHierarchicalRelations(text, undefined);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
    
    it('should handle empty entities array', async () => {
      const text = 'Test text';
      const result = await extractor.extractHierarchicalRelations(text, []);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
    
    it('should handle non-string text', async () => {
      const entities = [{ id: 'e1', canonical_name: 'Test' }];
      const result = await extractor.extractHierarchicalRelations(123, entities);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
    
    it('should handle non-array entities', async () => {
      const text = 'Test text';
      const result = await extractor.extractHierarchicalRelations(text, 'not an array');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle very long text', async () => {
      const longText = 'A'.repeat(100000);
      const entities = [{ id: 'e1', canonical_name: 'Test' }];
      const result = await extractor.extractHierarchicalRelations(longText, entities);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('should handle text with special characters', async () => {
      const text = '!@#$%^&*()_+{}|:"<>?';
      const entities = [{ id: 'e1', canonical_name: 'Test' }];
      const result = await extractor.extractHierarchicalRelations(text, entities);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('should handle text with unicode characters', async () => {
      const text = '测试文本 Café Münchën 😀';
      const entities = [{ id: 'e1', canonical_name: '测试' }];
      const result = await extractor.extractHierarchicalRelations(text, entities);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('should handle entities with missing properties', async () => {
      const text = 'Test text';
      const entities = [
        {},
        { id: 'e1' },
        { canonical_name: 'Test' },
        { id: 'e2', canonical_name: null }
      ];
      const result = await extractor.extractHierarchicalRelations(text, entities);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('should handle entities with invalid types', async () => {
      const text = 'Test text';
      const entities = [
        null,
        undefined,
        'string',
        123,
        { id: 'e1', canonical_name: 'Valid' }
      ];
      const result = await extractor.extractHierarchicalRelations(text, entities);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('should handle very large entity arrays', async () => {
      const text = 'Test text';
      const entities = Array.from({ length: 1000 }, (_, i) => ({
        id: `e${i}`,
        canonical_name: `Entity ${i}`
      }));
      const result = await extractor.extractHierarchicalRelations(text, entities);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
  
  describe('Pattern Extraction Error Handling', () => {
    it('should handle pattern extraction with invalid text', async () => {
      const entities = [{ id: 'e1', canonical_name: 'Test' }];
      const result = await extractor._extractWithPatterns(null, entities);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
    
    it('should handle pattern extraction with invalid entities', async () => {
      const text = 'Test text';
      const result = await extractor._extractWithPatterns(text, null);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
    
    it('should handle extractIsARelations with invalid input', () => {
      const result = extractor.extractIsARelations(null, []);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
    
    it('should handle extractPartOfRelations with invalid input', () => {
      const result = extractor.extractPartOfRelations(null, []);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
    
    it('should handle extractHasPropertyRelations with invalid input', () => {
      const result = extractor.extractHasPropertyRelations(null, []);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });
  
  describe('LLM Extraction Error Handling', () => {
    it('should handle LLM extraction when client is not available', async () => {
      const text = 'Test text';
      const entities = [{ id: 'e1', canonical_name: 'Test' }];
      const result = await extractor.extractHierarchicalRelations(text, entities, {
        method: 'llm'
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('should handle LLM timeout', async () => {
      // Create extractor with mock LLM client that times out
      const mockLLMClient = {
        callJSON: jest.fn(() => new Promise(resolve => setTimeout(resolve, 20000)))
      };
      
      const extractorWithLLM = new HierarchicalRelationExtractor({
        llmClient: mockLLMClient,
        enableLLM: true
      });
      
      const text = 'Test text';
      const entities = [{ id: 'e1', canonical_name: 'Test' }];
      
      const result = await extractorWithLLM.extractHierarchicalRelations(text, entities, {
        method: 'llm',
        timeout: 100 // 100ms timeout
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('should handle LLM API errors', async () => {
      // Create extractor with mock LLM client that throws error
      const mockLLMClient = {
        callJSON: jest.fn(() => Promise.reject(new Error('API Error')))
      };
      
      const extractorWithLLM = new HierarchicalRelationExtractor({
        llmClient: mockLLMClient,
        enableLLM: true
      });
      
      const text = 'Test text';
      const entities = [{ id: 'e1', canonical_name: 'Test' }];
      
      const result = await extractorWithLLM.extractHierarchicalRelations(text, entities, {
        method: 'hybrid'
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
  
  describe('Graceful Degradation', () => {
    it('should continue extraction when one method fails', async () => {
      const text = 'Canon EOS R5是一种全画幅无反相机';
      const entities = [
        { id: 'e1', canonical_name: 'Canon EOS R5' },
        { id: 'e2', canonical_name: '全画幅无反相机' }
      ];
      
      const result = await extractor.extractHierarchicalRelations(text, entities, {
        method: 'hybrid'
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('should always return an array', async () => {
      const text = 'Test text';
      const entities = [{ id: 'e1', canonical_name: 'Test' }];
      
      const result = await extractor.extractHierarchicalRelations(text, entities);
      
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('should handle maxRelations limit', async () => {
      const text = 'A是B的一种。C是D的一种。E是F的一种。';
      const entities = [
        { id: 'e1', canonical_name: 'A' },
        { id: 'e2', canonical_name: 'B' },
        { id: 'e3', canonical_name: 'C' },
        { id: 'e4', canonical_name: 'D' },
        { id: 'e5', canonical_name: 'E' },
        { id: 'e6', canonical_name: 'F' }
      ];
      
      const result = await extractor.extractHierarchicalRelations(text, entities, {
        maxRelations: 2
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(2);
    });
    
    it('should handle confidenceThreshold filtering', async () => {
      const text = 'Canon EOS R5是一种全画幅无反相机';
      const entities = [
        { id: 'e1', canonical_name: 'Canon EOS R5' },
        { id: 'e2', canonical_name: '全画幅无反相机' }
      ];
      
      const result = await extractor.extractHierarchicalRelations(text, entities, {
        confidenceThreshold: 0.9
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // All results should have confidence >= 0.9
      result.forEach(rel => {
        expect(rel.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });
  });
  
  describe('Method-Specific Error Handling', () => {
    it('should handle pattern method with errors', async () => {
      const text = 'Test text';
      const entities = [{ id: 'e1', canonical_name: 'Test' }];
      
      const result = await extractor.extractHierarchicalRelations(text, entities, {
        method: 'pattern'
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('should handle llm method when LLM unavailable', async () => {
      const text = 'Test text';
      const entities = [{ id: 'e1', canonical_name: 'Test' }];
      
      const result = await extractor.extractHierarchicalRelations(text, entities, {
        method: 'llm'
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('should handle hybrid method with partial failures', async () => {
      const text = 'Test text';
      const entities = [{ id: 'e1', canonical_name: 'Test' }];
      
      const result = await extractor.extractHierarchicalRelations(text, entities, {
        method: 'hybrid'
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('should handle invalid method gracefully', async () => {
      const text = 'Test text';
      const entities = [{ id: 'e1', canonical_name: 'Test' }];
      
      const result = await extractor.extractHierarchicalRelations(text, entities, {
        method: 'invalid_method'
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
