/**
 * Entity Builder Batch Disambiguation Tests
 * 
 * Tests for batch entity disambiguation and conflict resolution.
 * Validates: Requirements 4.14 (Batch entity disambiguation)
 */

const {
  resolveEntityConflicts,
  findSimilarEntityGroups,
  batchDisambiguateWithLLM,
  buildBatchDisambiguationPrompt,
  applyMergeActions,
  setLLMClient
} = require('./entity_builder');

describe('Entity Builder - Batch Disambiguation', () => {
  // Mock LLM client
  const mockLLMClient = {
    callJSON: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    setLLMClient(mockLLMClient);
  });
  
  describe('findSimilarEntityGroups', () => {
    test('should find groups of similar entities', () => {
      const entities = [
        {
          entity_id: 'entity_1',
          entity_type: 'EventEntity',
          canonical_name: '阿里C区_水位_2025-01',
          attributes: { 区域: '阿里C区', 指标: '水位' }
        },
        {
          entity_id: 'entity_2',
          entity_type: 'EventEntity',
          canonical_name: '阿里C区水位2025-01',
          attributes: { 区域: '阿里C区', 指标: '水位' }
        },
        {
          entity_id: 'entity_3',
          entity_type: 'EventEntity',
          canonical_name: '北京市_温度_2025-01',
          attributes: { 区域: '北京市', 指标: '温度' }
        },
        {
          entity_id: 'entity_4',
          entity_type: 'LocationEntity',
          canonical_name: '阿里C区',
          attributes: { 区域: '阿里C区' }
        }
      ];
      
      const groups = findSimilarEntityGroups(entities, 0.7);
      
      // Should find 1 group (entity_1 and entity_2 are similar)
      expect(groups.length).toBe(1);
      expect(groups[0].length).toBe(2);
      expect(groups[0][0].entity.entity_id).toBe('entity_1');
      expect(groups[0][1].entity.entity_id).toBe('entity_2');
    });
    
    test('should not group entities of different types', () => {
      const entities = [
        {
          entity_id: 'entity_1',
          entity_type: 'EventEntity',
          canonical_name: '阿里C区',
          attributes: {}
        },
        {
          entity_id: 'entity_2',
          entity_type: 'LocationEntity',
          canonical_name: '阿里C区',
          attributes: {}
        }
      ];
      
      const groups = findSimilarEntityGroups(entities, 0.7);
      
      // Should not group different entity types
      expect(groups.length).toBe(0);
    });
    
    test('should handle empty entity list', () => {
      const groups = findSimilarEntityGroups([], 0.7);
      expect(groups.length).toBe(0);
    });
    
    test('should respect similarity threshold', () => {
      const entities = [
        {
          entity_id: 'entity_1',
          entity_type: 'EventEntity',
          canonical_name: 'ABC',
          attributes: {}
        },
        {
          entity_id: 'entity_2',
          entity_type: 'EventEntity',
          canonical_name: 'XYZ',
          attributes: {}
        }
      ];
      
      const groups = findSimilarEntityGroups(entities, 0.9);
      
      // Should not group dissimilar entities
      expect(groups.length).toBe(0);
    });
  });
  
  describe('buildBatchDisambiguationPrompt', () => {
    test('should build prompt for multiple entity groups', () => {
      const conflictGroups = [
        [
          {
            index: 0,
            entity: {
              entity_id: 'entity_1',
              entity_type: 'EventEntity',
              canonical_name: '阿里C区_水位_2025-01',
              attributes: { 区域: '阿里C区', 指标: '水位' },
              supported_by: ['ckb_1', 'ckb_2'],
              confidence: 0.85
            }
          },
          {
            index: 1,
            entity: {
              entity_id: 'entity_2',
              entity_type: 'EventEntity',
              canonical_name: '阿里C区水位2025-01',
              attributes: { 区域: '阿里C区', 指标: '水位' },
              supported_by: ['ckb_3'],
              confidence: 0.75
            },
            similarity: 0.92
          }
        ]
      ];
      
      const prompt = buildBatchDisambiguationPrompt(conflictGroups);
      
      expect(prompt).toContain('实体消歧专家');
      expect(prompt).toContain('组 0');
      expect(prompt).toContain('阿里C区_水位_2025-01');
      expect(prompt).toContain('阿里C区水位2025-01');
      expect(prompt).toContain('merges');
    });
  });
  
  describe('applyMergeActions', () => {
    test('should merge entities according to LLM decisions', () => {
      const entities = [
        {
          entity_id: 'entity_1',
          entity_type: 'EventEntity',
          canonical_name: '阿里C区_水位_2025-01',
          attributes: { 区域: '阿里C区', 指标: '水位' },
          supported_by: ['ckb_1'],
          aliases: [],
          confidence: 0.85
        },
        {
          entity_id: 'entity_2',
          entity_type: 'EventEntity',
          canonical_name: '阿里C区水位2025-01',
          attributes: { 区域: '阿里C区', 指标: '水位', 数值: '10' },
          supported_by: ['ckb_2'],
          aliases: [],
          confidence: 0.75
        },
        {
          entity_id: 'entity_3',
          entity_type: 'EventEntity',
          canonical_name: '北京市_温度_2025-01',
          attributes: { 区域: '北京市', 指标: '温度' },
          supported_by: ['ckb_3'],
          aliases: [],
          confidence: 0.80
        }
      ];
      
      const merges = [
        {
          group_id: 0,
          should_merge: true,
          entity_indices: [0, 1],
          canonical_index: 0,
          confidence: 0.9,
          reason: '两个实体名称相似且属性一致'
        }
      ];
      
      const result = applyMergeActions(entities, merges);
      
      // Should have 2 entities after merge (entity_1 merged with entity_2, entity_3 unchanged)
      expect(result.resolvedEntities.length).toBe(2);
      
      // First entity should have merged data
      const mergedEntity = result.resolvedEntities[0];
      expect(mergedEntity.entity_id).toBe('entity_1');
      expect(mergedEntity.supported_by).toContain('ckb_1');
      expect(mergedEntity.supported_by).toContain('ckb_2');
      expect(mergedEntity.aliases).toContain('阿里C区水位2025-01');
      expect(mergedEntity.attributes.数值).toBe('10');
      
      // Merge actions should be recorded
      expect(result.mergeActions.length).toBe(1);
      expect(result.mergeActions[0].mergedIds).toContain('entity_1');
      expect(result.mergeActions[0].mergedIds).toContain('entity_2');
    });
    
    test('should handle empty merge list', () => {
      const entities = [
        { entity_id: 'entity_1', canonical_name: 'Test' }
      ];
      
      const result = applyMergeActions(entities, []);
      
      expect(result.resolvedEntities).toEqual(entities);
      expect(result.mergeActions.length).toBe(0);
    });
    
    test('should skip invalid merge actions', () => {
      const entities = [
        { entity_id: 'entity_1', canonical_name: 'Test1' },
        { entity_id: 'entity_2', canonical_name: 'Test2' }
      ];
      
      const merges = [
        {
          group_id: 0,
          should_merge: false, // Should not merge
          entity_indices: [0, 1],
          canonical_index: 0
        },
        {
          group_id: 1,
          should_merge: true,
          entity_indices: [0], // Only 1 entity, invalid
          canonical_index: 0
        }
      ];
      
      const result = applyMergeActions(entities, merges);
      
      // No merges should be applied
      expect(result.resolvedEntities.length).toBe(2);
      expect(result.mergeActions.length).toBe(0);
    });
  });
  
  describe('resolveEntityConflicts', () => {
    test('should resolve conflicts with LLM disambiguation', async () => {
      const entities = [
        {
          entity_id: 'entity_1',
          entity_type: 'EventEntity',
          canonical_name: '阿里C区_水位_2025-01',
          attributes: { 区域: '阿里C区' },
          supported_by: ['ckb_1'],
          aliases: [],
          confidence: 0.85
        },
        {
          entity_id: 'entity_2',
          entity_type: 'EventEntity',
          canonical_name: '阿里C区水位2025-01',
          attributes: { 区域: '阿里C区' },
          supported_by: ['ckb_2'],
          aliases: [],
          confidence: 0.75
        }
      ];
      
      // Mock LLM response
      mockLLMClient.callJSON.mockResolvedValue({
        merges: [
          {
            group_id: 0,
            should_merge: true,
            entity_indices: [0, 1],
            canonical_index: 0,
            confidence: 0.9,
            reason: '两个实体指向同一对象'
          }
        ],
        _meta: { tokens: 250 }
      });
      
      const result = await resolveEntityConflicts(entities, {
        similarityThreshold: 0.7,
        useLLM: true,
        llmClient: mockLLMClient
      });
      
      // Should have merged entities
      expect(result.resolvedEntities.length).toBe(1);
      expect(result.mergeActions.length).toBe(1);
      expect(result.stats.totalGroups).toBe(1);
      expect(result.stats.mergedGroups).toBe(1);
      expect(result.stats.llmCalls).toBe(1);
      expect(result.stats.tokensSaved).toBeGreaterThan(0);
      
      // LLM should have been called once
      expect(mockLLMClient.callJSON).toHaveBeenCalledTimes(1);
    });
    
    test('should handle no conflicts', async () => {
      const entities = [
        {
          entity_id: 'entity_1',
          entity_type: 'EventEntity',
          canonical_name: 'ABC',
          attributes: {},
          supported_by: ['ckb_1'],
          aliases: [],
          confidence: 0.85
        },
        {
          entity_id: 'entity_2',
          entity_type: 'EventEntity',
          canonical_name: 'XYZ',
          attributes: {},
          supported_by: ['ckb_2'],
          aliases: [],
          confidence: 0.75
        }
      ];
      
      const result = await resolveEntityConflicts(entities, {
        similarityThreshold: 0.7,
        useLLM: true
      });
      
      // No conflicts, no merges
      expect(result.resolvedEntities.length).toBe(2);
      expect(result.mergeActions.length).toBe(0);
      expect(result.stats.totalGroups).toBe(0);
      expect(result.stats.mergedGroups).toBe(0);
      expect(result.stats.llmCalls).toBe(0);
    });
    
    test('should handle LLM errors gracefully', async () => {
      const entities = [
        {
          entity_id: 'entity_1',
          entity_type: 'EventEntity',
          canonical_name: '阿里C区_水位_2025-01',
          attributes: {},
          supported_by: ['ckb_1'],
          aliases: [],
          confidence: 0.85
        },
        {
          entity_id: 'entity_2',
          entity_type: 'EventEntity',
          canonical_name: '阿里C区水位2025-01',
          attributes: {},
          supported_by: ['ckb_2'],
          aliases: [],
          confidence: 0.75
        }
      ];
      
      // Mock LLM error
      mockLLMClient.callJSON.mockRejectedValue(new Error('LLM API error'));
      
      const result = await resolveEntityConflicts(entities, {
        similarityThreshold: 0.7,
        useLLM: true,
        llmClient: mockLLMClient
      });
      
      // Should return original entities on error
      expect(result.resolvedEntities.length).toBe(2);
      expect(result.mergeActions.length).toBe(0);
      expect(result.stats.error).toBeDefined();
    });
    
    test('should skip LLM when disabled', async () => {
      const entities = [
        {
          entity_id: 'entity_1',
          entity_type: 'EventEntity',
          canonical_name: '阿里C区_水位_2025-01',
          attributes: {},
          supported_by: ['ckb_1'],
          aliases: [],
          confidence: 0.85
        },
        {
          entity_id: 'entity_2',
          entity_type: 'EventEntity',
          canonical_name: '阿里C区水位2025-01',
          attributes: {},
          supported_by: ['ckb_2'],
          aliases: [],
          confidence: 0.75
        }
      ];
      
      const result = await resolveEntityConflicts(entities, {
        similarityThreshold: 0.7,
        useLLM: false
      });
      
      // Should not call LLM
      expect(mockLLMClient.callJSON).not.toHaveBeenCalled();
      expect(result.resolvedEntities.length).toBe(2);
      expect(result.mergeActions.length).toBe(0);
    });
  });
  
  describe('Token Savings Calculation', () => {
    test('should calculate token savings correctly', async () => {
      // Create 5 conflict groups
      const entities = [];
      for (let i = 0; i < 10; i += 2) {
        entities.push({
          entity_id: `entity_${i}`,
          entity_type: 'EventEntity',
          canonical_name: `Test_${Math.floor(i/2)}`,
          attributes: {},
          supported_by: [`ckb_${i}`],
          aliases: [],
          confidence: 0.85
        });
        entities.push({
          entity_id: `entity_${i+1}`,
          entity_type: 'EventEntity',
          canonical_name: `Test${Math.floor(i/2)}`,
          attributes: {},
          supported_by: [`ckb_${i+1}`],
          aliases: [],
          confidence: 0.75
        });
      }
      
      // Mock LLM response
      mockLLMClient.callJSON.mockResolvedValue({
        merges: [],
        _meta: { tokens: 500 }
      });
      
      const result = await resolveEntityConflicts(entities, {
        similarityThreshold: 0.7,
        useLLM: true,
        llmClient: mockLLMClient
      });
      
      // Should have 5 conflict groups
      expect(result.stats.totalGroups).toBe(5);
      
      // Should make only 1 LLM call (batch)
      expect(result.stats.llmCalls).toBe(1);
      
      // Should save tokens (5 individual calls - 1 batch call = 4 calls saved)
      expect(result.stats.tokensSaved).toBe(4 * 200); // 800 tokens saved
      expect(result.stats.savingsRate).toBe('80.0%');
      
      // LLM should have been called once
      expect(mockLLMClient.callJSON).toHaveBeenCalledTimes(1);
    });
  });
});
