/**
 * Unit tests for LLMPostProcessor
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 15.1, 15.2, 15.3, 15.4, 15.5
 */

const LLMPostProcessor = require('../llm_post_processor');

describe('LLMPostProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new LLMPostProcessor();
  });

  describe('cleanup', () => {
    it('should return empty result when no llmClient provided', async () => {
      const result = await processor.cleanup({
        entities: [{ entity_id: 'e1', canonical_name: '测试' }],
        relations: []
      });

      expect(result.stats.entitiesCreated).toBe(0);
      expect(result.stats.entitiesUpdated).toBe(0);
      expect(result.entities.created).toEqual([]);
    });

    it('should return empty result when no entities or relations', async () => {
      const mockLLM = { call: jest.fn() };
      const result = await processor.cleanup({
        entities: [],
        relations: [],
        llmClient: mockLLM
      });

      expect(result.stats.entitiesCreated).toBe(0);
      expect(mockLLM.call).not.toHaveBeenCalled();
    });

    it('should return empty result when LLM call fails (Req 14.6)', async () => {
      const mockLLM = {
        call: jest.fn().mockRejectedValue(new Error('LLM timeout'))
      };

      const result = await processor.cleanup({
        entities: [{ entity_id: 'e1', canonical_name: '测试' }],
        relations: [],
        llmClient: mockLLM
      });

      expect(result.stats.entitiesCreated).toBe(0);
      expect(result.entities.created).toEqual([]);
    });

    it('should call LLM and parse valid response', async () => {
      const llmResponse = JSON.stringify({
        entities: [
          { name: '人工智能', description: 'AI技术领域', source_ids: ['e1'], existing_id: null }
        ],
        relations: []
      });

      const mockLLM = {
        call: jest.fn().mockResolvedValue({ content: llmResponse })
      };

      const result = await processor.cleanup({
        entities: [{ entity_id: 'e1', canonical_name: '人工智能技术' }],
        relations: [],
        llmClient: mockLLM
      });

      expect(mockLLM.call).toHaveBeenCalledTimes(1);
      expect(result.stats.entitiesCreated).toBe(1);
      expect(result.entities.created[0].cleanedName).toBe('人工智能');
    });

    it('should handle LLM response as plain string', async () => {
      const llmResponse = JSON.stringify({
        entities: [
          { name: '测试', description: '测试描述', source_ids: [], existing_id: null }
        ],
        relations: []
      });

      const mockLLM = {
        call: jest.fn().mockResolvedValue(llmResponse)
      };

      const result = await processor.cleanup({
        entities: [{ entity_id: 'e1', canonical_name: '测试实体' }],
        relations: [],
        llmClient: mockLLM
      });

      expect(result.stats.entitiesCreated).toBe(1);
    });
  });

  describe('_buildCleanupPrompt', () => {
    it('should include cleanup rules and output format', () => {
      const prompt = processor._buildCleanupPrompt(
        [{ entity_id: 'e1', canonical_name: '测试实体' }],
        [],
        null,
        { entities: [], relations: [] }
      );

      expect(prompt).toContain('清洗规则');
      expect(prompt).toContain('语义相同或相近的实体合并为一个词');
      expect(prompt).toContain('不超过6个字');
      expect(prompt).toContain('不超过20个字');
      expect(prompt).toContain('不超过4个字');
      expect(prompt).toContain('测试实体');
    });

    it('should include existing cleaned entities when present (Req 15.1)', () => {
      const prompt = processor._buildCleanupPrompt(
        [{ entity_id: 'e1', canonical_name: '新实体' }],
        [],
        null,
        {
          entities: [{ id: 'ce1', cleanedName: '已有实体', description: '已有描述' }],
          relations: []
        }
      );

      expect(prompt).toContain('已有图谱字段表');
      expect(prompt).toContain('已有实体');
      expect(prompt).toContain('已有描述');
    });

    it('should include document index text', () => {
      const prompt = processor._buildCleanupPrompt(
        [{ entity_id: 'e1', canonical_name: '实体' }],
        [],
        '这是文档索引内容',
        { entities: [], relations: [] }
      );

      expect(prompt).toContain('文档索引');
      expect(prompt).toContain('这是文档索引内容');
    });

    it('should truncate very long document index text', () => {
      const longText = 'A'.repeat(5000);
      const prompt = processor._buildCleanupPrompt(
        [{ entity_id: 'e1', canonical_name: '实体' }],
        [],
        longText,
        { entities: [], relations: [] }
      );

      expect(prompt).toContain('已截断');
      expect(prompt.length).toBeLessThan(longText.length + 2000);
    });

    it('should include raw relations in prompt', () => {
      const prompt = processor._buildCleanupPrompt(
        [],
        [{ relation_id: 'r1', relation_type: '属于', source_entity_id: 'e1', target_entity_id: 'e2' }],
        null,
        { entities: [], relations: [] }
      );

      expect(prompt).toContain('原始关系');
      expect(prompt).toContain('属于');
    });

    it('should include existing cleaned relations (Req 15.1)', () => {
      const prompt = processor._buildCleanupPrompt(
        [],
        [],
        null,
        {
          entities: [],
          relations: [{
            id: 'cr1',
            cleanedName: '包含',
            description: '包含关系',
            source: { cleanedName: '源实体' },
            target: { cleanedName: '目标实体' },
            sourceEntityId: 'ce1',
            targetEntityId: 'ce2'
          }]
        }
      );

      expect(prompt).toContain('已有关系');
      expect(prompt).toContain('包含');
      expect(prompt).toContain('源实体');
      expect(prompt).toContain('目标实体');
    });
  });

  describe('_parseAndValidateResult', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        entities: [{ name: '测试', description: '描述', source_ids: ['e1'], existing_id: null }],
        relations: [{ name: '属于', description: '关系', source: 'A', target: 'B', source_ids: ['r1'], existing_id: null }]
      });

      const result = processor._parseAndValidateResult(response);

      expect(result).not.toBeNull();
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('测试');
      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].name).toBe('属于');
    });

    it('should truncate entity names exceeding 6 chars (Req 14.4)', () => {
      const response = JSON.stringify({
        entities: [{ name: '这是一个超长的实体名称', description: '描述', source_ids: [], existing_id: null }],
        relations: []
      });

      const result = processor._parseAndValidateResult(response);

      expect(result.entities[0].name).toBe('这是一个超长');
      expect(result.entities[0].name.length).toBe(6);
    });

    it('should truncate entity descriptions exceeding 20 chars (Req 14.5)', () => {
      const response = JSON.stringify({
        entities: [{ name: '测试', description: '这是一个非常非常非常非常非常长的描述文本超过二十个字', source_ids: [], existing_id: null }],
        relations: []
      });

      const result = processor._parseAndValidateResult(response);

      expect(result.entities[0].description.length).toBeLessThanOrEqual(20);
    });

    it('should truncate relation names exceeding 4 chars', () => {
      const response = JSON.stringify({
        entities: [],
        relations: [{ name: '超长关系名称', description: '描述', source: 'A', target: 'B', source_ids: [], existing_id: null }]
      });

      const result = processor._parseAndValidateResult(response);

      expect(result.relations[0].name).toBe('超长关系');
      expect(result.relations[0].name.length).toBe(4);
    });

    it('should extract JSON from markdown code blocks', () => {
      const response = '```json\n{"entities": [{"name": "测试", "description": "描述", "source_ids": [], "existing_id": null}], "relations": []}\n```';

      const result = processor._parseAndValidateResult(response);

      expect(result).not.toBeNull();
      expect(result.entities[0].name).toBe('测试');
    });

    it('should extract JSON from response with extra text', () => {
      const response = '以下是清洗结果：\n{"entities": [{"name": "测试", "description": "描述", "source_ids": [], "existing_id": null}], "relations": []}\n请查看。';

      const result = processor._parseAndValidateResult(response);

      expect(result).not.toBeNull();
      expect(result.entities[0].name).toBe('测试');
    });

    it('should return null for invalid JSON', () => {
      const result = processor._parseAndValidateResult('not valid json at all');
      expect(result).toBeNull();
    });

    it('should return null for empty response', () => {
      expect(processor._parseAndValidateResult('')).toBeNull();
      expect(processor._parseAndValidateResult(null)).toBeNull();
      expect(processor._parseAndValidateResult(undefined)).toBeNull();
    });

    it('should handle missing entities/relations arrays gracefully', () => {
      const response = JSON.stringify({ something: 'else' });
      const result = processor._parseAndValidateResult(response);

      expect(result).not.toBeNull();
      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
    });

    it('should handle missing source_ids gracefully', () => {
      const response = JSON.stringify({
        entities: [{ name: '测试', description: '描述' }],
        relations: []
      });

      const result = processor._parseAndValidateResult(response);

      expect(result.entities[0].source_ids).toEqual([]);
      expect(result.entities[0].existing_id).toBeNull();
    });
  });

  describe('_performIncrementalMerge', () => {
    it('should create new entities when existing_id is null (Req 15.3)', () => {
      const cleanedResult = {
        entities: [
          { name: '新实体', description: '新描述', source_ids: ['e1'], existing_id: null }
        ],
        relations: []
      };

      const result = processor._performIncrementalMerge(cleanedResult, [], []);

      expect(result.entities.created).toHaveLength(1);
      expect(result.entities.created[0].cleanedName).toBe('新实体');
      expect(result.entities.updated).toHaveLength(0);
      expect(result.stats.entitiesCreated).toBe(1);
      expect(result.stats.entitiesUpdated).toBe(0);
    });

    it('should update existing entities when existing_id matches (Req 15.2)', () => {
      const cleanedResult = {
        entities: [
          { name: '更新实体', description: '更新描述', source_ids: ['e1', 'e2'], existing_id: 'ce1' }
        ],
        relations: []
      };

      const existingEntities = [{ id: 'ce1', cleanedName: '旧实体', description: '旧描述' }];

      const result = processor._performIncrementalMerge(cleanedResult, existingEntities, []);

      expect(result.entities.updated).toHaveLength(1);
      expect(result.entities.updated[0].id).toBe('ce1');
      expect(result.entities.updated[0].description).toBe('更新描述');
      expect(result.entities.created).toHaveLength(0);
      expect(result.stats.entitiesUpdated).toBe(1);
    });

    it('should create new entity when existing_id does not match any existing', () => {
      const cleanedResult = {
        entities: [
          { name: '新实体', description: '描述', source_ids: ['e1'], existing_id: 'nonexistent' }
        ],
        relations: []
      };

      const result = processor._performIncrementalMerge(cleanedResult, [], []);

      expect(result.entities.created).toHaveLength(1);
      expect(result.entities.updated).toHaveLength(0);
      expect(result.stats.entitiesCreated).toBe(1);
    });

    it('should create new relations when existing_id is null (Req 15.5)', () => {
      const cleanedResult = {
        entities: [],
        relations: [
          { name: '属于', description: '关系描述', source: 'A', target: 'B', source_ids: ['r1'], existing_id: null }
        ]
      };

      const result = processor._performIncrementalMerge(cleanedResult, [], []);

      expect(result.relations.created).toHaveLength(1);
      expect(result.relations.created[0].cleanedName).toBe('属于');
      expect(result.relations.created[0].sourceEntityId).toBe('A');
      expect(result.relations.created[0].targetEntityId).toBe('B');
      expect(result.stats.relationsCreated).toBe(1);
    });

    it('should update existing relations when existing_id matches (Req 15.4)', () => {
      const cleanedResult = {
        entities: [],
        relations: [
          { name: '包含', description: '更新描述', source: 'A', target: 'B', source_ids: ['r1', 'r2'], existing_id: 'cr1' }
        ]
      };

      const existingRelations = [{ id: 'cr1', cleanedName: '包含', description: '旧描述' }];

      const result = processor._performIncrementalMerge(cleanedResult, [], existingRelations);

      expect(result.relations.updated).toHaveLength(1);
      expect(result.relations.updated[0].id).toBe('cr1');
      expect(result.relations.updated[0].description).toBe('更新描述');
      expect(result.stats.relationsUpdated).toBe(1);
    });

    it('should handle mixed create and update operations', () => {
      const cleanedResult = {
        entities: [
          { name: '新实体', description: '新', source_ids: ['e1'], existing_id: null },
          { name: '更新', description: '更新描述', source_ids: ['e2'], existing_id: 'ce1' }
        ],
        relations: [
          { name: '新关系', description: '新', source: 'A', target: 'B', source_ids: ['r1'], existing_id: null },
          { name: '更新', description: '更新', source: 'C', target: 'D', source_ids: ['r2'], existing_id: 'cr1' }
        ]
      };

      const existingEntities = [{ id: 'ce1', cleanedName: '旧', description: '旧' }];
      const existingRelations = [{ id: 'cr1', cleanedName: '旧', description: '旧' }];

      const result = processor._performIncrementalMerge(cleanedResult, existingEntities, existingRelations);

      expect(result.stats.entitiesCreated).toBe(1);
      expect(result.stats.entitiesUpdated).toBe(1);
      expect(result.stats.relationsCreated).toBe(1);
      expect(result.stats.relationsUpdated).toBe(1);
    });
  });
});
