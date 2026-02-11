/**
 * Unit tests for ConflictResolver
 */

const ConflictResolver = require('./conflict_resolver');
const { createEntity, createRelation } = require('./types');

describe('ConflictResolver', () => {
  let resolver;

  beforeEach(() => {
    resolver = new ConflictResolver({ logConflicts: false });
  });

  describe('Constructor', () => {
    test('should create resolver with default strategy', () => {
      const resolver = new ConflictResolver();
      expect(resolver.getStrategy()).toBe('prefer_algorithm');
    });

    test('should create resolver with custom strategy', () => {
      const resolver = new ConflictResolver({ strategy: 'prefer_llm' });
      expect(resolver.getStrategy()).toBe('prefer_llm');
    });

    test('should initialize empty conflicts array', () => {
      expect(resolver.getConflicts()).toEqual([]);
    });
  });

  describe('Entity Conflict Resolution', () => {
    test('should keep algorithm entities when they conflict with LLM entities', () => {
      const algorithmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '35mm' },
            source: 'algorithm'
          })
        ],
        relations: []
      };

      const llmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '50mm' },
            source: 'llm'
          })
        ],
        relations: []
      };

      const result = resolver.resolve(algorithmResult, llmResult);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].properties.value).toBe('35mm');
      expect(result.entities[0].source).toBe('algorithm');
      expect(result.conflictCount).toBe(1);
    });

    test('should add non-conflicting LLM entities', () => {
      const algorithmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '35mm' },
            source: 'algorithm'
          })
        ],
        relations: []
      };

      const llmResult = {
        entities: [
          createEntity({
            name: '人物肖像',
            type: 'semantic_concept',
            properties: { description: '以人物为主体的摄影类型' },
            source: 'llm'
          })
        ],
        relations: []
      };

      const result = resolver.resolve(algorithmResult, llmResult);

      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].name).toBe('焦距');
      expect(result.entities[1].name).toBe('人物肖像');
      expect(result.conflictCount).toBe(0);
    });

    test('should handle multiple entity conflicts', () => {
      const algorithmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '35mm' },
            source: 'algorithm'
          }),
          createEntity({
            name: '光圈',
            type: 'numerical_parameter',
            properties: { value: 'F1.8' },
            source: 'algorithm'
          })
        ],
        relations: []
      };

      const llmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '50mm' },
            source: 'llm'
          }),
          createEntity({
            name: '光圈',
            type: 'numerical_parameter',
            properties: { value: 'F2.8' },
            source: 'llm'
          })
        ],
        relations: []
      };

      const result = resolver.resolve(algorithmResult, llmResult);

      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].properties.value).toBe('35mm');
      expect(result.entities[1].properties.value).toBe('F1.8');
      expect(result.conflictCount).toBe(2);
    });

    test('should deduplicate entities with same name and value', () => {
      const algorithmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '35mm' },
            source: 'algorithm'
          })
        ],
        relations: []
      };

      const llmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '35mm' },
            source: 'llm'
          })
        ],
        relations: []
      };

      const result = resolver.resolve(algorithmResult, llmResult);

      // Should keep only algorithm version (deduplication)
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].source).toBe('algorithm');
      // This is logged as a conflict (duplicate entity)
      expect(result.conflictCount).toBe(1);
    });

    test('should handle entities without value properties', () => {
      const algorithmResult = {
        entities: [
          createEntity({
            name: '人物肖像',
            type: 'semantic_concept',
            properties: {},
            source: 'algorithm'
          })
        ],
        relations: []
      };

      const llmResult = {
        entities: [
          createEntity({
            name: '人物肖像',
            type: 'semantic_concept',
            properties: { description: 'Portrait photography' },
            source: 'llm'
          })
        ],
        relations: []
      };

      const result = resolver.resolve(algorithmResult, llmResult);

      expect(result.entities).toHaveLength(2);
      expect(result.conflictCount).toBe(0);
    });
  });

  describe('Relation Conflict Resolution', () => {
    test('should keep algorithm relations when they conflict with LLM relations', () => {
      const algorithmResult = {
        entities: [],
        relations: [
          createRelation({
            type: 'co_occurrence',
            source: 'SEL35F18F',
            target: '人文摄影',
            extractionSource: 'algorithm'
          })
        ]
      };

      const llmResult = {
        entities: [],
        relations: [
          createRelation({
            type: 'suitable_for',
            source: 'SEL35F18F',
            target: '人文摄影',
            extractionSource: 'llm'
          })
        ]
      };

      const result = resolver.resolve(algorithmResult, llmResult);

      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].type).toBe('co_occurrence');
      expect(result.relations[0].extractionSource).toBe('algorithm');
      expect(result.conflictCount).toBe(1);
    });

    test('should add non-conflicting LLM relations', () => {
      const algorithmResult = {
        entities: [],
        relations: [
          createRelation({
            type: 'co_occurrence',
            source: 'SEL35F18F',
            target: '人文摄影',
            extractionSource: 'algorithm'
          })
        ]
      };

      const llmResult = {
        entities: [],
        relations: [
          createRelation({
            type: 'suitable_for',
            source: 'SEL50F18F',
            target: '人物肖像',
            extractionSource: 'llm'
          })
        ]
      };

      const result = resolver.resolve(algorithmResult, llmResult);

      expect(result.relations).toHaveLength(2);
      expect(result.relations[0].source).toBe('SEL35F18F');
      expect(result.relations[1].source).toBe('SEL50F18F');
      expect(result.conflictCount).toBe(0);
    });

    test('should handle multiple relation conflicts', () => {
      const algorithmResult = {
        entities: [],
        relations: [
          createRelation({
            type: 'co_occurrence',
            source: 'A',
            target: 'B',
            extractionSource: 'algorithm'
          }),
          createRelation({
            type: 'co_occurrence',
            source: 'C',
            target: 'D',
            extractionSource: 'algorithm'
          })
        ]
      };

      const llmResult = {
        entities: [],
        relations: [
          createRelation({
            type: 'suitable_for',
            source: 'A',
            target: 'B',
            extractionSource: 'llm'
          }),
          createRelation({
            type: 'recommended_for',
            source: 'C',
            target: 'D',
            extractionSource: 'llm'
          })
        ]
      };

      const result = resolver.resolve(algorithmResult, llmResult);

      expect(result.relations).toHaveLength(2);
      expect(result.relations[0].type).toBe('co_occurrence');
      expect(result.relations[1].type).toBe('co_occurrence');
      expect(result.conflictCount).toBe(2);
    });

    test('should not detect conflict when relations have same type', () => {
      const algorithmResult = {
        entities: [],
        relations: [
          createRelation({
            type: 'co_occurrence',
            source: 'A',
            target: 'B',
            extractionSource: 'algorithm'
          })
        ]
      };

      const llmResult = {
        entities: [],
        relations: [
          createRelation({
            type: 'co_occurrence',
            source: 'A',
            target: 'B',
            extractionSource: 'llm'
          })
        ]
      };

      const result = resolver.resolve(algorithmResult, llmResult);

      expect(result.relations).toHaveLength(1);
      expect(result.conflictCount).toBe(0);
    });
  });

  describe('Combined Entity and Relation Conflicts', () => {
    test('should resolve both entity and relation conflicts', () => {
      const algorithmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '35mm' },
            source: 'algorithm'
          })
        ],
        relations: [
          createRelation({
            type: 'co_occurrence',
            source: 'A',
            target: 'B',
            extractionSource: 'algorithm'
          })
        ]
      };

      const llmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '50mm' },
            source: 'llm'
          }),
          createEntity({
            name: '人物肖像',
            type: 'semantic_concept',
            properties: {},
            source: 'llm'
          })
        ],
        relations: [
          createRelation({
            type: 'suitable_for',
            source: 'A',
            target: 'B',
            extractionSource: 'llm'
          }),
          createRelation({
            type: 'suitable_for',
            source: 'C',
            target: 'D',
            extractionSource: 'llm'
          })
        ]
      };

      const result = resolver.resolve(algorithmResult, llmResult);

      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].properties.value).toBe('35mm');
      expect(result.entities[1].name).toBe('人物肖像');
      
      expect(result.relations).toHaveLength(2);
      expect(result.relations[0].type).toBe('co_occurrence');
      expect(result.relations[1].source).toBe('C');
      
      expect(result.conflictCount).toBe(2);
    });
  });

  describe('Conflict Logging', () => {
    test('should log entity conflicts', () => {
      const algorithmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '35mm' },
            source: 'algorithm'
          })
        ],
        relations: []
      };

      const llmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '50mm' },
            source: 'llm'
          })
        ],
        relations: []
      };

      resolver.resolve(algorithmResult, llmResult);
      const conflicts = resolver.getConflicts();

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('entity_conflict');
      expect(conflicts[0].algorithmEntity).toBe('焦距');
      expect(conflicts[0].llmEntity).toBe('焦距');
      expect(conflicts[0].resolution).toBe('kept_algorithm');
      expect(conflicts[0].timestamp).toBeDefined();
    });

    test('should log relation conflicts', () => {
      const algorithmResult = {
        entities: [],
        relations: [
          createRelation({
            type: 'co_occurrence',
            source: 'A',
            target: 'B',
            extractionSource: 'algorithm'
          })
        ]
      };

      const llmResult = {
        entities: [],
        relations: [
          createRelation({
            type: 'suitable_for',
            source: 'A',
            target: 'B',
            extractionSource: 'llm'
          })
        ]
      };

      resolver.resolve(algorithmResult, llmResult);
      const conflicts = resolver.getConflicts();

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('relation_conflict');
      expect(conflicts[0].source).toBe('A');
      expect(conflicts[0].target).toBe('B');
      expect(conflicts[0].algorithmType).toBe('co_occurrence');
      expect(conflicts[0].llmType).toBe('suitable_for');
      expect(conflicts[0].resolution).toBe('kept_algorithm');
    });

    test('should clear conflicts', () => {
      const algorithmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '35mm' },
            source: 'algorithm'
          })
        ],
        relations: []
      };

      const llmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '50mm' },
            source: 'llm'
          })
        ],
        relations: []
      };

      resolver.resolve(algorithmResult, llmResult);
      expect(resolver.getConflicts()).toHaveLength(1);

      resolver.clearConflicts();
      expect(resolver.getConflicts()).toEqual([]);
    });
  });

  describe('Strategy Management', () => {
    test('should set and get strategy', () => {
      resolver.setStrategy('prefer_llm');
      expect(resolver.getStrategy()).toBe('prefer_llm');

      resolver.setStrategy('merge');
      expect(resolver.getStrategy()).toBe('merge');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty algorithm result', () => {
      const algorithmResult = {
        entities: [],
        relations: []
      };

      const llmResult = {
        entities: [
          createEntity({
            name: '人物肖像',
            type: 'semantic_concept',
            properties: {},
            source: 'llm'
          })
        ],
        relations: [
          createRelation({
            type: 'suitable_for',
            source: 'A',
            target: 'B',
            extractionSource: 'llm'
          })
        ]
      };

      const result = resolver.resolve(algorithmResult, llmResult);

      expect(result.entities).toHaveLength(1);
      expect(result.relations).toHaveLength(1);
      expect(result.conflictCount).toBe(0);
    });

    test('should handle empty LLM result', () => {
      const algorithmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '35mm' },
            source: 'algorithm'
          })
        ],
        relations: [
          createRelation({
            type: 'co_occurrence',
            source: 'A',
            target: 'B',
            extractionSource: 'algorithm'
          })
        ]
      };

      const llmResult = {
        entities: [],
        relations: []
      };

      const result = resolver.resolve(algorithmResult, llmResult);

      expect(result.entities).toHaveLength(1);
      expect(result.relations).toHaveLength(1);
      expect(result.conflictCount).toBe(0);
    });

    test('should handle both empty results', () => {
      const algorithmResult = {
        entities: [],
        relations: []
      };

      const llmResult = {
        entities: [],
        relations: []
      };

      const result = resolver.resolve(algorithmResult, llmResult);

      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
      expect(result.conflictCount).toBe(0);
    });

    test('should handle missing entities array', () => {
      const algorithmResult = {
        relations: []
      };

      const llmResult = {
        relations: []
      };

      const result = resolver.resolve(algorithmResult, llmResult);

      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
    });

    test('should handle missing relations array', () => {
      const algorithmResult = {
        entities: []
      };

      const llmResult = {
        entities: []
      };

      const result = resolver.resolve(algorithmResult, llmResult);

      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
    });
  });
});
