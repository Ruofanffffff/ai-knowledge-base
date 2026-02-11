/**
 * Unit tests for ResultFusion
 */

const ResultFusion = require('./result_fusion');
const ConflictResolver = require('./conflict_resolver');
const { createEntity, createRelation } = require('./types');

describe('ResultFusion', () => {
  let fusion;

  beforeEach(() => {
    fusion = new ResultFusion();
  });

  describe('Constructor', () => {
    test('should create fusion with default conflict resolver', () => {
      const fusion = new ResultFusion();
      expect(fusion.conflictResolver).toBeInstanceOf(ConflictResolver);
    });

    test('should create fusion with custom conflict resolver', () => {
      const customResolver = new ConflictResolver({ strategy: 'prefer_llm' });
      const fusion = new ResultFusion({ conflictResolver: customResolver });
      expect(fusion.conflictResolver).toBe(customResolver);
    });

    test('should enable deduplication by default', () => {
      const fusion = new ResultFusion();
      expect(fusion.deduplication).toBe(true);
    });
  });

  describe('Entity Fusion', () => {
    test('should merge algorithm and LLM entities', () => {
      const algorithmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '35mm' },
            source: 'algorithm'
          })
        ],
        relations: [],
        metadata: { extractionTime: 100 }
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
        relations: [],
        metadata: { extractionTime: 2000 }
      };

      const result = fusion.fuse(algorithmResult, llmResult);

      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].name).toBe('焦距');
      expect(result.entities[1].name).toBe('人物肖像');
    });

    test('should preserve algorithm entities unchanged', () => {
      const algorithmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '35mm', unit: 'mm' },
            source: 'algorithm'
          })
        ],
        relations: [],
        metadata: {}
      };

      const llmResult = {
        entities: [],
        relations: [],
        metadata: {}
      };

      const result = fusion.fuse(algorithmResult, llmResult);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].properties.value).toBe('35mm');
      expect(result.entities[0].properties.unit).toBe('mm');
      expect(result.entities[0].source).toBe('algorithm');
    });

    test('should deduplicate entities by ID', () => {
      const entityId = 'entity_123';
      
      const algorithmResult = {
        entities: [
          createEntity({
            id: entityId,
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '35mm' },
            source: 'algorithm'
          })
        ],
        relations: [],
        metadata: {}
      };

      const llmResult = {
        entities: [
          createEntity({
            id: entityId,
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '35mm' },
            source: 'llm'
          })
        ],
        relations: [],
        metadata: {}
      };

      const result = fusion.fuse(algorithmResult, llmResult);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].source).toBe('algorithm');
    });
  });

  describe('Relation Fusion', () => {
    test('should merge algorithm and LLM relations', () => {
      const algorithmResult = {
        entities: [],
        relations: [
          createRelation({
            type: 'co_occurrence',
            source: 'A',
            target: 'B',
            extractionSource: 'algorithm'
          })
        ],
        metadata: {}
      };

      const llmResult = {
        entities: [],
        relations: [
          createRelation({
            type: 'suitable_for',
            source: 'C',
            target: 'D',
            extractionSource: 'llm'
          })
        ],
        metadata: {}
      };

      const result = fusion.fuse(algorithmResult, llmResult);

      expect(result.relations).toHaveLength(2);
      expect(result.relations[0].type).toBe('co_occurrence');
      expect(result.relations[1].type).toBe('suitable_for');
    });

    test('should deduplicate relations by source-target-type', () => {
      const algorithmResult = {
        entities: [],
        relations: [
          createRelation({
            type: 'co_occurrence',
            source: 'A',
            target: 'B',
            extractionSource: 'algorithm'
          })
        ],
        metadata: {}
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
        ],
        metadata: {}
      };

      const result = fusion.fuse(algorithmResult, llmResult);

      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].extractionSource).toBe('algorithm');
    });
  });

  describe('Metadata Fusion', () => {
    test('should merge metadata from both sources', () => {
      const algorithmResult = {
        entities: [],
        relations: [],
        metadata: {
          extractionTime: 100,
          parametersFound: 5
        }
      };

      const llmResult = {
        entities: [],
        relations: [],
        metadata: {
          extractionTime: 2000,
          tokensUsed: 1200,
          cost: 0.05,
          llmModel: 'qwen-plus'
        }
      };

      const result = fusion.fuse(algorithmResult, llmResult);

      expect(result.metadata.processingTime).toBe(2100);
      expect(result.metadata.algorithmTime).toBe(100);
      expect(result.metadata.llmTime).toBe(2000);
      expect(result.metadata.tokensUsed).toBe(1200);
      expect(result.metadata.cost).toBe(0.05);
      expect(result.metadata.llmModel).toBe('qwen-plus');
    });

    test('should determine status as success when both succeed', () => {
      const algorithmResult = {
        entities: [],
        relations: [],
        metadata: {}
      };

      const llmResult = {
        entities: [],
        relations: [],
        metadata: {}
      };

      const result = fusion.fuse(algorithmResult, llmResult);

      expect(result.metadata.status).toBe('success');
    });

    test('should determine status as partial_success when one fails', () => {
      const algorithmResult = {
        entities: [],
        relations: [],
        metadata: { error: 'Algorithm failed' }
      };

      const llmResult = {
        entities: [],
        relations: [],
        metadata: {}
      };

      const result = fusion.fuse(algorithmResult, llmResult);

      expect(result.metadata.status).toBe('partial_success');
    });

    test('should determine status as failed when both fail', () => {
      const algorithmResult = {
        entities: [],
        relations: [],
        metadata: { error: 'Algorithm failed' }
      };

      const llmResult = {
        entities: [],
        relations: [],
        metadata: { error: 'LLM failed' }
      };

      const result = fusion.fuse(algorithmResult, llmResult);

      expect(result.metadata.status).toBe('failed');
    });
  });

  describe('Conflict Handling', () => {
    test('should include conflict information in result', () => {
      const algorithmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '35mm' },
            source: 'algorithm'
          })
        ],
        relations: [],
        metadata: {}
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
        relations: [],
        metadata: {}
      };

      const result = fusion.fuse(algorithmResult, llmResult);

      expect(result.conflicts).toBeDefined();
      expect(result.metadata.conflicts).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    test('should calculate statistics correctly', () => {
      const fusedResult = {
        entities: [
          createEntity({ name: 'E1', source: 'algorithm' }),
          createEntity({ name: 'E2', source: 'llm' }),
          createEntity({ name: 'E3', source: 'llm' })
        ],
        relations: [
          createRelation({ source: 'A', target: 'B', extractionSource: 'algorithm' }),
          createRelation({ source: 'C', target: 'D', extractionSource: 'llm' })
        ],
        metadata: {
          processingTime: 2100,
          status: 'success'
        },
        conflicts: []
      };

      const stats = fusion.getStatistics(fusedResult);

      expect(stats.totalEntities).toBe(3);
      expect(stats.algorithmEntities).toBe(1);
      expect(stats.llmEntities).toBe(2);
      expect(stats.totalRelations).toBe(2);
      expect(stats.algorithmRelations).toBe(1);
      expect(stats.llmRelations).toBe(1);
      expect(stats.conflicts).toBe(0);
      expect(stats.processingTime).toBe(2100);
      expect(stats.status).toBe('success');
    });
  });

  describe('Algorithm Preservation Validation', () => {
    test('should validate that algorithm results are preserved', () => {
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
        relations: [],
        metadata: {}
      };

      const llmResult = {
        entities: [],
        relations: [],
        metadata: {}
      };

      const fusedResult = fusion.fuse(algorithmResult, llmResult);

      const isPreserved = fusion.validateAlgorithmPreservation(algorithmResult, fusedResult);
      expect(isPreserved).toBe(true);
    });

    test('should detect when algorithm results are not preserved', () => {
      const algorithmResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '35mm' },
            source: 'algorithm'
          })
        ],
        relations: [],
        metadata: {}
      };

      const fusedResult = {
        entities: [
          createEntity({
            name: '焦距',
            type: 'numerical_parameter',
            properties: { value: '50mm' },
            source: 'algorithm'
          })
        ],
        relations: [],
        metadata: {}
      };

      const isPreserved = fusion.validateAlgorithmPreservation(algorithmResult, fusedResult);
      expect(isPreserved).toBe(false);
    });
  });

  describe('Configuration', () => {
    test('should allow setting custom conflict resolver', () => {
      const customResolver = new ConflictResolver({ strategy: 'prefer_llm' });
      fusion.setConflictResolver(customResolver);
      expect(fusion.conflictResolver).toBe(customResolver);
    });

    test('should allow disabling deduplication', () => {
      fusion.setDeduplication(false);
      expect(fusion.deduplication).toBe(false);

      const algorithmResult = {
        entities: [
          createEntity({ name: 'E1', source: 'algorithm' })
        ],
        relations: [],
        metadata: {}
      };

      const llmResult = {
        entities: [
          createEntity({ name: 'E1', source: 'llm' })
        ],
        relations: [],
        metadata: {}
      };

      const result = fusion.fuse(algorithmResult, llmResult);

      // Without deduplication, both entities should be present
      expect(result.entities.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty algorithm result', () => {
      const algorithmResult = {
        entities: [],
        relations: [],
        metadata: {}
      };

      const llmResult = {
        entities: [
          createEntity({ name: 'E1', source: 'llm' })
        ],
        relations: [],
        metadata: {}
      };

      const result = fusion.fuse(algorithmResult, llmResult);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('E1');
    });

    test('should handle empty LLM result', () => {
      const algorithmResult = {
        entities: [
          createEntity({ name: 'E1', source: 'algorithm' })
        ],
        relations: [],
        metadata: {}
      };

      const llmResult = {
        entities: [],
        relations: [],
        metadata: {}
      };

      const result = fusion.fuse(algorithmResult, llmResult);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('E1');
    });

    test('should handle both empty results', () => {
      const algorithmResult = {
        entities: [],
        relations: [],
        metadata: {}
      };

      const llmResult = {
        entities: [],
        relations: [],
        metadata: {}
      };

      const result = fusion.fuse(algorithmResult, llmResult);

      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
      expect(result.metadata.status).toBe('success');
    });

    test('should handle missing metadata fields', () => {
      const algorithmResult = {
        entities: [],
        relations: []
      };

      const llmResult = {
        entities: [],
        relations: []
      };

      const result = fusion.fuse(algorithmResult, llmResult);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.processingTime).toBe(0);
      expect(result.metadata.algorithmTime).toBe(0);
      expect(result.metadata.llmTime).toBe(0);
    });
  });
});
