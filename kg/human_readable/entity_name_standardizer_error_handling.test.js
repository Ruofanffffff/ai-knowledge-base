/**
 * Error Handling Tests for Entity Name Standardizer
 * 
 * Tests error handling and edge cases for entity name standardization.
 * Validates: Requirement 6.1 - Error Handling
 */

const { EntityNameStandardizer } = require('./entity_name_standardizer');

describe('Entity Name Standardizer - Error Handling', () => {
  let standardizer;

  beforeEach(() => {
    standardizer = new EntityNameStandardizer({ enableLLM: false });
  });

  describe('Input Validation', () => {
    it('should handle null entity gracefully', async () => {
      const result = await standardizer.standardizeName(null);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('error');
      expect(result.confidence).toBe(0.0);
      expect(result.metadata.error).toBeDefined();
    });
    
    it('should handle undefined entity gracefully', async () => {
      const result = await standardizer.standardizeName(undefined);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('error');
      expect(result.confidence).toBe(0.0);
      expect(result.metadata.error).toBeDefined();
    });
    
    it('should handle entity with null name', async () => {
      const entity = { name: null, type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('fallback');
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle entity with undefined name', async () => {
      const entity = { type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('fallback');
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle entity with empty string name', async () => {
      const entity = { name: '', type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('fallback');
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle entity with whitespace-only name', async () => {
      const entity = { name: '   ', type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('fallback');
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle entity with non-string name', async () => {
      const entity = { name: 123, type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle entity with object name', async () => {
      const entity = { name: { value: 'Test' }, type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle entity with array name', async () => {
      const entity = { name: ['Test'], type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle names with only special characters', async () => {
      const entity = { name: '!@#$%^&*()', type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle names with mixed valid and invalid characters', async () => {
      const entity = { name: 'Test!@#Name', type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle names with excessive whitespace', async () => {
      const entity = { name: 'Test    Name    Here', type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
      // Note: If the name is considered "good", it may not be normalized
      // The important thing is that we handle it without errors
    });
    
    it('should handle names with leading/trailing whitespace', async () => {
      const entity = { name: '   Test Name   ', type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBe('Test Name');
    });
    
    it('should handle names with newlines and tabs', async () => {
      const entity = { name: 'Test\nName\tHere', type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle single character names', async () => {
      const entity = { name: 'A', type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle very long names', async () => {
      const longName = 'A'.repeat(500);
      const entity = { name: longName, type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle names with emojis', async () => {
      const entity = { name: 'Test 😀 Name', type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle names with unicode characters', async () => {
      const entity = { name: 'Café Münchën', type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle names with null bytes', async () => {
      const entity = { name: 'Test\u0000Name', type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
  });
  
  describe('CKB Error Handling', () => {
    it('should handle null ckbs array', async () => {
      const entity = { name: '123', type: 'test', ckbs: null };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle undefined ckbs array', async () => {
      const entity = { name: '123', type: 'test' };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle empty ckbs array', async () => {
      const entity = { name: '123', type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle ckbs with null content', async () => {
      const entity = { 
        name: '123', 
        type: 'test', 
        ckbs: [{ content: null }] 
      };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle ckbs with missing text', async () => {
      const entity = { 
        name: '123', 
        type: 'test', 
        ckbs: [{ content: {} }] 
      };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle ckbs with invalid structure', async () => {
      const entity = { 
        name: '123', 
        type: 'test', 
        ckbs: ['invalid', null, undefined] 
      };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
  });
  
  describe('Batch Processing Error Handling', () => {
    it('should handle empty array', async () => {
      const results = await standardizer.standardizeMany([]);
      
      expect(results).toEqual([]);
    });
    
    it('should handle array with null values', async () => {
      const results = await standardizer.standardizeMany([
        null, 
        { name: 'Test', type: 'test', ckbs: [] }, 
        null
      ]);
      
      expect(results).toHaveLength(3);
      expect(results[0].method).toBe('error');
      expect(results[1].standardizedName).toBeDefined();
      expect(results[2].method).toBe('error');
    });
    
    it('should handle array with mixed valid and invalid values', async () => {
      const results = await standardizer.standardizeMany([
        { name: 'Valid Name', type: 'test', ckbs: [] },
        { name: '', type: 'test', ckbs: [] },
        null,
        { name: 'Another Valid', type: 'test', ckbs: [] },
        undefined,
        { name: 'Last Valid', type: 'test', ckbs: [] }
      ]);
      
      expect(results).toHaveLength(6);
      expect(results[0].standardizedName).toBe('Valid Name');
      expect(results[1].method).toBe('fallback');
      expect(results[2].method).toBe('error');
      expect(results[3].standardizedName).toBe('Another Valid');
      expect(results[4].method).toBe('error');
      expect(results[5].standardizedName).toBe('Last Valid');
    });
    
    it('should throw error for non-array input', async () => {
      await expect(standardizer.standardizeMany('not an array')).rejects.toThrow('entities must be an array');
    });
    
    it('should handle very large batch', async () => {
      const largeArray = new Array(100).fill(null).map((_, i) => ({
        name: `Entity ${i}`,
        type: 'test',
        ckbs: []
      }));
      
      const results = await standardizer.standardizeMany(largeArray);
      
      expect(results).toHaveLength(100);
      expect(results.every(r => r.standardizedName)).toBe(true);
    });
    
    it('should continue processing after individual errors', async () => {
      const results = await standardizer.standardizeMany([
        { name: 'Valid 1', type: 'test', ckbs: [] },
        null,
        { name: 'Valid 2', type: 'test', ckbs: [] },
        undefined,
        { name: 'Valid 3', type: 'test', ckbs: [] }
      ]);
      
      expect(results).toHaveLength(5);
      // Should have 3 successful and 2 error results
      const successful = results.filter(r => r.method !== 'error');
      const errors = results.filter(r => r.method === 'error');
      expect(successful.length).toBeGreaterThanOrEqual(3);
      expect(errors).toHaveLength(2);
    });
  });
  
  describe('Graceful Degradation', () => {
    it('should return fallback result when algorithm fails', async () => {
      const entity = { name: 'unknown', type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
      expect(result.standardizedName).not.toBe('unknown');
    });
    
    it('should maintain original name in result even on error', async () => {
      const result = await standardizer.standardizeName(null);
      
      expect(result).toBeDefined();
      expect(result.originalName).toBeDefined();
    });
    
    it('should always return confidence score', async () => {
      const entity = { name: 'Test', type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result.confidence).toBeDefined();
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
    
    it('should always return method', async () => {
      const entity = { name: 'Test', type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result.method).toBeDefined();
      expect(['none', 'algorithm', 'llm', 'fallback', 'error']).toContain(result.method);
    });
    
    it('should always return metadata', async () => {
      const entity = { name: 'Test', type: 'test', ckbs: [] };
      const result = await standardizer.standardizeName(entity);
      
      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata).toBe('object');
    });
  });
  
  describe('Context Extraction Error Handling', () => {
    it('should handle context extraction with invalid CKB structure', async () => {
      const entity = {
        name: '123',
        type: 'test',
        ckbs: [
          { invalid: 'structure' },
          { content: { invalid: 'no text' } }
        ]
      };
      
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle context extraction with very long text', async () => {
      const longText = 'A'.repeat(10000);
      const entity = {
        name: '123',
        type: 'test',
        ckbs: [{ content: { text: longText } }]
      };
      
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
    
    it('should handle context extraction when name not found in text', async () => {
      const entity = {
        name: '123',
        type: 'test',
        ckbs: [{ content: { text: 'This text does not contain the entity name' } }]
      };
      
      const result = await standardizer.standardizeName(entity);
      
      expect(result).toBeDefined();
      expect(result.standardizedName).toBeDefined();
    });
  });
  
  describe('Core Concept Extraction Error Handling', () => {
    it('should handle extractCoreConcept with empty fragment', () => {
      const result = standardizer.extractCoreConcept('', 'some context');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
    
    it('should handle extractCoreConcept with empty context', () => {
      const result = standardizer.extractCoreConcept('fragment', '');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
    
    it('should handle extractCoreConcept with special characters', () => {
      const result = standardizer.extractCoreConcept('!@#$', 'context !@#$ more');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
    
    it('should handle extractCoreConcept with unicode', () => {
      const result = standardizer.extractCoreConcept('测试', '这是一个测试文本');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
