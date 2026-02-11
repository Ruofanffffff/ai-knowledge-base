/**
 * Unit tests for ResultParser
 */

const ResultParser = require('./result_parser');

describe('ResultParser', () => {
  let parser;

  beforeEach(() => {
    parser = new ResultParser();
  });

  describe('parseEntities', () => {
    it('should parse valid entity JSON', () => {
      const json = JSON.stringify({
        entities: [
          {
            type: 'lens',
            name: 'SEL35F18F',
            properties: { focalLength: '35mm' },
            confidence: 0.95
          }
        ]
      });

      const entities = parser.parseEntities(json);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('lens');
      expect(entities[0].name).toBe('SEL35F18F');
      expect(entities[0].confidence).toBe(0.95);
      expect(entities[0].source).toBe('llm');
    });

    it('should handle JSON in markdown code blocks', () => {
      const json = '```json\n{"entities": [{"type": "lens", "name": "Test", "confidence": 0.9}]}\n```';
      
      const entities = parser.parseEntities(json);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe('Test');
    });

    it('should handle missing entities array', () => {
      const json = JSON.stringify({});
      
      const entities = parser.parseEntities(json);
      
      expect(entities).toEqual([]);
    });

    it('should handle malformed JSON gracefully', () => {
      const json = 'not valid json {';
      
      const entities = parser.parseEntities(json);
      
      expect(entities).toEqual([]);
    });

    it('should filter out entities with missing required fields', () => {
      const json = JSON.stringify({
        entities: [
          { type: 'lens', name: 'Valid', confidence: 0.9 },
          { type: 'lens' }, // Missing name
          { name: 'NoType' }, // Missing type
          { type: 'technique', name: 'Valid2', confidence: 0.8 }
        ]
      });
      
      const entities = parser.parseEntities(json);
      
      expect(entities).toHaveLength(2);
      expect(entities[0].name).toBe('Valid');
      expect(entities[1].name).toBe('Valid2');
    });

    it('should normalize confidence scores', () => {
      const json = JSON.stringify({
        entities: [
          { type: 'lens', name: 'Test1', confidence: 1.5 }, // > 1
          { type: 'lens', name: 'Test2', confidence: -0.5 }, // < 0
          { type: 'lens', name: 'Test3' } // Missing confidence
        ]
      });
      
      const entities = parser.parseEntities(json);
      
      expect(entities[0].confidence).toBe(1.0);
      expect(entities[1].confidence).toBe(0.0);
      expect(entities[2].confidence).toBe(0.5); // Default
    });

    it('should handle object input (already parsed)', () => {
      const obj = {
        entities: [
          { type: 'lens', name: 'Test', confidence: 0.9 }
        ]
      };
      
      const entities = parser.parseEntities(obj);
      
      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe('Test');
    });

    it('should handle empty properties gracefully', () => {
      const json = JSON.stringify({
        entities: [
          { type: 'lens', name: 'Test', confidence: 0.9 }
        ]
      });
      
      const entities = parser.parseEntities(json);
      
      expect(entities[0].properties).toEqual({});
    });
  });

  describe('parseRelations', () => {
    it('should parse valid relation JSON', () => {
      const json = JSON.stringify({
        relations: [
          {
            type: 'suitable_for',
            source: 'SEL35F18F',
            target: '街拍',
            confidence: 0.90
          }
        ]
      });

      const relations = parser.parseRelations(json);
      
      expect(relations).toHaveLength(1);
      expect(relations[0].type).toBe('suitable_for');
      expect(relations[0].source).toBe('SEL35F18F');
      expect(relations[0].target).toBe('街拍');
      expect(relations[0].confidence).toBe(0.90);
      expect(relations[0].extractionSource).toBe('llm');
    });

    it('should handle missing relations array', () => {
      const json = JSON.stringify({});
      
      const relations = parser.parseRelations(json);
      
      expect(relations).toEqual([]);
    });

    it('should handle malformed JSON gracefully', () => {
      const json = 'invalid json';
      
      const relations = parser.parseRelations(json);
      
      expect(relations).toEqual([]);
    });

    it('should filter out relations with missing required fields', () => {
      const json = JSON.stringify({
        relations: [
          { type: 'suitable_for', source: 'A', target: 'B', confidence: 0.9 },
          { type: 'suitable_for', source: 'A' }, // Missing target
          { source: 'A', target: 'B' }, // Missing type
          { type: 'affects', source: 'C', target: 'D', confidence: 0.8 }
        ]
      });
      
      const relations = parser.parseRelations(json);
      
      expect(relations).toHaveLength(2);
      expect(relations[0].source).toBe('A');
      expect(relations[1].source).toBe('C');
    });

    it('should normalize confidence scores', () => {
      const json = JSON.stringify({
        relations: [
          { type: 'suitable_for', source: 'A', target: 'B', confidence: 2.0 },
          { type: 'suitable_for', source: 'C', target: 'D', confidence: -1.0 },
          { type: 'suitable_for', source: 'E', target: 'F' }
        ]
      });
      
      const relations = parser.parseRelations(json);
      
      expect(relations[0].confidence).toBe(1.0);
      expect(relations[1].confidence).toBe(0.0);
      expect(relations[2].confidence).toBe(0.5);
    });
  });

  describe('normalizeConfidence', () => {
    it('should clamp values above 1 to 1', () => {
      expect(parser.normalizeConfidence(1.5)).toBe(1.0);
      expect(parser.normalizeConfidence(100)).toBe(1.0);
    });

    it('should clamp values below 0 to 0', () => {
      expect(parser.normalizeConfidence(-0.5)).toBe(0.0);
      expect(parser.normalizeConfidence(-100)).toBe(0.0);
    });

    it('should keep valid values unchanged', () => {
      expect(parser.normalizeConfidence(0.5)).toBe(0.5);
      expect(parser.normalizeConfidence(0.0)).toBe(0.0);
      expect(parser.normalizeConfidence(1.0)).toBe(1.0);
    });

    it('should handle undefined as default 0.5', () => {
      expect(parser.normalizeConfidence(undefined)).toBe(0.5);
      expect(parser.normalizeConfidence(null)).toBe(0.5);
    });

    it('should convert string numbers', () => {
      expect(parser.normalizeConfidence('0.8')).toBe(0.8);
      expect(parser.normalizeConfidence('1.5')).toBe(1.0);
    });

    it('should handle NaN as default 0.5', () => {
      expect(parser.normalizeConfidence('not a number')).toBe(0.5);
      expect(parser.normalizeConfidence(NaN)).toBe(0.5);
    });
  });

  describe('validateResult', () => {
    it('should validate correct result structure', () => {
      const result = {
        entities: [],
        relations: []
      };
      
      expect(parser.validateResult(result)).toBe(true);
    });

    it('should reject null or undefined', () => {
      expect(parser.validateResult(null)).toBe(false);
      expect(parser.validateResult(undefined)).toBe(false);
    });

    it('should reject non-object', () => {
      expect(parser.validateResult('string')).toBe(false);
      expect(parser.validateResult(123)).toBe(false);
    });

    it('should reject non-array entities', () => {
      const result = {
        entities: 'not an array'
      };
      
      expect(parser.validateResult(result)).toBe(false);
    });

    it('should reject non-array relations', () => {
      const result = {
        relations: 'not an array'
      };
      
      expect(parser.validateResult(result)).toBe(false);
    });

    it('should accept result with only entities', () => {
      const result = {
        entities: []
      };
      
      expect(parser.validateResult(result)).toBe(true);
    });

    it('should accept result with only relations', () => {
      const result = {
        relations: []
      };
      
      expect(parser.validateResult(result)).toBe(true);
    });
  });

  describe('strict mode', () => {
    it('should throw errors in strict mode for invalid JSON', () => {
      parser.setStrictMode(true);
      
      expect(() => {
        parser.parseEntities('invalid json');
      }).toThrow();
    });

    it('should not throw errors in non-strict mode', () => {
      parser.setStrictMode(false);
      
      expect(() => {
        parser.parseEntities('invalid json');
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const entities = parser.parseEntities('');
      expect(entities).toEqual([]);
    });

    it('should handle whitespace-only string', () => {
      const entities = parser.parseEntities('   \n\t  ');
      expect(entities).toEqual([]);
    });

    it('should handle nested code blocks', () => {
      const json = '```\n```json\n{"entities": [{"type": "lens", "name": "Test", "confidence": 0.9}]}\n```\n```';
      const entities = parser.parseEntities(json);
      expect(entities).toHaveLength(1);
    });

    it('should handle very large confidence values', () => {
      expect(parser.normalizeConfidence(1e10)).toBe(1.0);
      expect(parser.normalizeConfidence(-1e10)).toBe(0.0);
    });

    it('should handle confidence as percentage string', () => {
      expect(parser.normalizeConfidence('95')).toBe(1.0); // Clamped
      expect(parser.normalizeConfidence('0.95')).toBe(0.95);
    });
  });
});
