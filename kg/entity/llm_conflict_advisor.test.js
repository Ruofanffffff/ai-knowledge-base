/**
 * Unit Tests for LLM Conflict Advisor
 */

const {
  adviseMergeConflict,
  buildConflictAdvisoryPrompt,
  validateLLMResponse,
  adviseMergeConflictsBatch,
  getAdvisoryStatistics
} = require('./llm_conflict_advisor');

// Mock qwen_client
jest.mock('../utils/qwen_client', () => ({
  createQwenClient: jest.fn()
}));

const { createQwenClient } = require('../utils/qwen_client');

describe('LLMConflictAdvisor', () => {
  // Helper function to create test instances
  function createTestInstance(schemaName, fields, confidence = 0.8) {
    return {
      instance: {
        schema_name: schemaName,
        schema_id: `schema_${schemaName}`,
        entity_type: 'TestEntity',
        fields,
        ckb_ids: ['ckb_1'],
        confidence
      },
      schema: {
        schema_name: schemaName,
        entity_type: 'TestEntity'
      },
      anchor: 'TestEntity|test_anchor'
    };
  }

  // Helper function to create conflict result
  function createConflictResult(hasConflict = true, severity = 'high') {
    return {
      anchor: 'TestEntity|test_anchor',
      has_conflict: hasConflict,
      conflicts: hasConflict ? [
        {
          type: 'state_contradiction',
          message: '状态字段存在矛盾',
          severity: severity
        }
      ] : [],
      severity: hasConflict ? severity : 'none',
      recommendation: hasConflict ? 'review' : 'auto_merge'
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.QWEN_API_KEY;
  });

  describe('adviseMergeConflict', () => {
    it('should return auto-merge recommendation for no conflict', async () => {
      const conflictResult = createConflictResult(false);
      const group = [createTestInstance('Schema A', {})];

      const result = await adviseMergeConflict(conflictResult, group);

      expect(result.suggest_split).toBe(false);
      expect(result.confidence).toBe(1.0);
      expect(result.reason).toContain('无冲突');
      expect(result.llm_advisory).toBe(false);
    });

    it('should return rule-based recommendation when no API key', async () => {
      const conflictResult = createConflictResult(true, 'high');
      const group = [
        createTestInstance('Schema A', { 状态: '正常' }),
        createTestInstance('Schema B', { 状态: '异常' })
      ];

      const result = await adviseMergeConflict(conflictResult, group);

      expect(result.suggest_split).toBe(true); // high severity
      expect(result.confidence).toBe(0.5);
      expect(result.reason).toContain('LLM不可用');
      expect(result.llm_advisory).toBe(false);
    });

    it('should call LLM when API key is provided', async () => {
      const mockLLMClient = {
        callJSON: jest.fn().mockResolvedValue({
          suggest_split: true,
          confidence: 0.85,
          reason: '时间不一致，建议拆分',
          _meta: { tokens: 100 }
        })
      };

      createQwenClient.mockReturnValue(mockLLMClient);

      const conflictResult = createConflictResult(true, 'high');
      const group = [
        createTestInstance('Schema A', { 时间: '2025-01' }),
        createTestInstance('Schema B', { 时间: '2025-02' })
      ];

      const result = await adviseMergeConflict(conflictResult, group, {
        apiKey: 'test-api-key'
      });

      expect(createQwenClient).toHaveBeenCalledWith('test-api-key', {
        model: 'qwen-turbo'
      });
      expect(mockLLMClient.callJSON).toHaveBeenCalled();
      expect(result.suggest_split).toBe(true);
      expect(result.confidence).toBe(0.85);
      expect(result.reason).toContain('时间不一致');
      expect(result.llm_advisory).toBe(true);
      expect(result._meta).toBeDefined();
    });

    it('should use custom model and temperature', async () => {
      const mockLLMClient = {
        callJSON: jest.fn().mockResolvedValue({
          suggest_split: false,
          confidence: 0.9,
          reason: '可以合并'
        })
      };

      createQwenClient.mockReturnValue(mockLLMClient);

      const conflictResult = createConflictResult(true, 'medium');
      const group = [createTestInstance('Schema A', {})];

      await adviseMergeConflict(conflictResult, group, {
        apiKey: 'test-api-key',
        model: 'qwen-plus',
        temperature: 0.1,
        maxTokens: 500
      });

      expect(createQwenClient).toHaveBeenCalledWith('test-api-key', {
        model: 'qwen-plus'
      });

      expect(mockLLMClient.callJSON).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          temperature: 0.1,
          maxTokens: 500
        })
      );
    });

    it('should fallback to rule-based on LLM error', async () => {
      const mockLLMClient = {
        callJSON: jest.fn().mockRejectedValue(new Error('API timeout'))
      };

      createQwenClient.mockReturnValue(mockLLMClient);

      const conflictResult = createConflictResult(true, 'high');
      const group = [createTestInstance('Schema A', {})];

      const result = await adviseMergeConflict(conflictResult, group, {
        apiKey: 'test-api-key'
      });

      expect(result.suggest_split).toBe(true); // high severity
      expect(result.confidence).toBe(0.5);
      expect(result.reason).toContain('LLM调用失败');
      expect(result.llm_advisory).toBe(false);
      expect(result.error).toBe('API timeout');
    });

    it('should throw error if conflictResult is missing', async () => {
      const group = [createTestInstance('Schema A', {})];

      await expect(adviseMergeConflict(null, group)).rejects.toThrow();
    });

    it('should throw error if group is empty', async () => {
      const conflictResult = createConflictResult(true);

      await expect(adviseMergeConflict(conflictResult, [])).rejects.toThrow();
    });
  });

  describe('buildConflictAdvisoryPrompt', () => {
    it('should build prompt with instance information', () => {
      const conflictResult = createConflictResult(true);
      const group = [
        createTestInstance('Schema A', { 区域: '阿里C区', 时间: '2025-01' }, 0.9),
        createTestInstance('Schema B', { 区域: '阿里C区', 时间: '2025-02' }, 0.8)
      ];

      const prompt = buildConflictAdvisoryPrompt(conflictResult, group);

      expect(prompt).toContain('Schema A');
      expect(prompt).toContain('Schema B');
      expect(prompt).toContain('区域: 阿里C区');
      expect(prompt).toContain('时间: 2025-01');
      expect(prompt).toContain('置信度: 0.9');
      expect(prompt).toContain('置信度: 0.8');
    });

    it('should include conflict information', () => {
      const conflictResult = {
        anchor: 'TestEntity|test',
        has_conflict: true,
        conflicts: [
          {
            type: 'time_inconsistency',
            message: '时间不一致',
            severity: 'high',
            details: [
              { schema: 'Schema A', original: '2025-01-15', month: '2025-01' },
              { schema: 'Schema B', original: '2025-02-15', month: '2025-02' }
            ]
          }
        ],
        severity: 'high'
      };

      const group = [
        createTestInstance('Schema A', { 时间: '2025-01-15' }),
        createTestInstance('Schema B', { 时间: '2025-02-15' })
      ];

      const prompt = buildConflictAdvisoryPrompt(conflictResult, group);

      expect(prompt).toContain('time_inconsistency');
      expect(prompt).toContain('时间不一致');
      expect(prompt).toContain('high');
      expect(prompt).toContain('2025-01');
      expect(prompt).toContain('2025-02');
    });

    it('should include value conflict details', () => {
      const conflictResult = {
        anchor: 'TestEntity|test',
        has_conflict: true,
        conflicts: [
          {
            type: 'value_conflict',
            message: '数值差异过大',
            severity: 'medium',
            details: {
              values: [
                { schema: 'Schema A', value: '100', confidence: 0.9 },
                { schema: 'Schema B', value: '150', confidence: 0.8 }
              ]
            }
          }
        ],
        severity: 'medium'
      };

      const group = [
        createTestInstance('Schema A', { 数值: '100' }),
        createTestInstance('Schema B', { 数值: '150' })
      ];

      const prompt = buildConflictAdvisoryPrompt(conflictResult, group);

      expect(prompt).toContain('value_conflict');
      expect(prompt).toContain('Schema A: 100');
      expect(prompt).toContain('Schema B: 150');
    });

    it('should include state contradiction details', () => {
      const conflictResult = {
        anchor: 'TestEntity|test',
        has_conflict: true,
        conflicts: [
          {
            type: 'state_contradiction',
            message: '状态矛盾',
            severity: 'high',
            details: {
              states: [
                { schema: 'Schema A', value: '正常' },
                { schema: 'Schema B', value: '异常' }
              ]
            }
          }
        ],
        severity: 'high'
      };

      const group = [
        createTestInstance('Schema A', { 状态: '正常' }),
        createTestInstance('Schema B', { 状态: '异常' })
      ];

      const prompt = buildConflictAdvisoryPrompt(conflictResult, group);

      expect(prompt).toContain('state_contradiction');
      expect(prompt).toContain('Schema A: 正常');
      expect(prompt).toContain('Schema B: 异常');
    });

    it('should include constraints and instructions', () => {
      const conflictResult = createConflictResult(true);
      const group = [createTestInstance('Schema A', {})];

      const prompt = buildConflictAdvisoryPrompt(conflictResult, group);

      expect(prompt).toContain('重要约束');
      expect(prompt).toContain('不能新建或删除实体');
      expect(prompt).toContain('只能给出"建议是否拆分"');
      expect(prompt).toContain('suggest_split');
      expect(prompt).toContain('confidence');
      expect(prompt).toContain('reason');
    });
  });

  describe('validateLLMResponse', () => {
    it('should validate correct response', () => {
      const response = {
        suggest_split: true,
        confidence: 0.85,
        reason: '时间不一致，建议拆分'
      };

      expect(() => validateLLMResponse(response)).not.toThrow();
    });

    it('should throw error if suggest_split is missing', () => {
      const response = {
        confidence: 0.85,
        reason: '测试'
      };

      expect(() => validateLLMResponse(response)).toThrow('suggest_split');
    });

    it('should throw error if suggest_split is not boolean', () => {
      const response = {
        suggest_split: 'yes',
        confidence: 0.85,
        reason: '测试'
      };

      expect(() => validateLLMResponse(response)).toThrow('suggest_split');
    });

    it('should throw error if confidence is missing', () => {
      const response = {
        suggest_split: true,
        reason: '测试'
      };

      expect(() => validateLLMResponse(response)).toThrow('confidence');
    });

    it('should throw error if confidence is out of range', () => {
      const response1 = {
        suggest_split: true,
        confidence: -0.1,
        reason: '测试'
      };

      const response2 = {
        suggest_split: true,
        confidence: 1.5,
        reason: '测试'
      };

      expect(() => validateLLMResponse(response1)).toThrow('confidence');
      expect(() => validateLLMResponse(response2)).toThrow('confidence');
    });

    it('should throw error if reason is missing', () => {
      const response = {
        suggest_split: true,
        confidence: 0.85
      };

      expect(() => validateLLMResponse(response)).toThrow('reason');
    });

    it('should throw error if reason is empty', () => {
      const response = {
        suggest_split: true,
        confidence: 0.85,
        reason: '   '
      };

      expect(() => validateLLMResponse(response)).toThrow('reason');
    });
  });

  describe('adviseMergeConflictsBatch', () => {
    it('should process multiple conflicts', async () => {
      const mockLLMClient = {
        callJSON: jest.fn()
          .mockResolvedValueOnce({
            suggest_split: true,
            confidence: 0.9,
            reason: '冲突1'
          })
          .mockResolvedValueOnce({
            suggest_split: false,
            confidence: 0.8,
            reason: '冲突2'
          })
      };

      createQwenClient.mockReturnValue(mockLLMClient);

      const conflictResults = [
        { ...createConflictResult(true, 'high'), anchor: 'anchor_1' },
        { ...createConflictResult(true, 'medium'), anchor: 'anchor_2' }
      ];

      const anchorGroups = new Map([
        ['anchor_1', [createTestInstance('Schema A', {})]],
        ['anchor_2', [createTestInstance('Schema B', {})]]
      ]);

      const results = await adviseMergeConflictsBatch(conflictResults, anchorGroups, {
        apiKey: 'test-api-key'
      });

      expect(results).toHaveLength(2);
      expect(results[0].anchor).toBe('anchor_1');
      expect(results[0].advisory.suggest_split).toBe(true);
      expect(results[1].anchor).toBe('anchor_2');
      expect(results[1].advisory.suggest_split).toBe(false);
    });

    it('should skip conflicts without groups', async () => {
      const conflictResults = [
        { ...createConflictResult(true), anchor: 'anchor_1' },
        { ...createConflictResult(true), anchor: 'anchor_missing' }
      ];

      const anchorGroups = new Map([
        ['anchor_1', [createTestInstance('Schema A', {})]]
      ]);

      const results = await adviseMergeConflictsBatch(conflictResults, anchorGroups);

      expect(results).toHaveLength(1);
      expect(results[0].anchor).toBe('anchor_1');
    });

    it('should throw error if conflictResults is not an array', async () => {
      const anchorGroups = new Map();

      await expect(adviseMergeConflictsBatch({}, anchorGroups)).rejects.toThrow();
    });

    it('should throw error if anchorGroups is not a Map', async () => {
      await expect(adviseMergeConflictsBatch([], [])).rejects.toThrow();
    });
  });

  describe('getAdvisoryStatistics', () => {
    it('should calculate statistics correctly', () => {
      const advisories = [
        {
          anchor: 'anchor_1',
          advisory: {
            suggest_split: true,
            confidence: 0.9,
            llm_advisory: true
          }
        },
        {
          anchor: 'anchor_2',
          advisory: {
            suggest_split: false,
            confidence: 0.8,
            llm_advisory: true
          }
        },
        {
          anchor: 'anchor_3',
          advisory: {
            suggest_split: false,
            confidence: 0.5,
            llm_advisory: false,
            error: 'timeout'
          }
        }
      ];

      const stats = getAdvisoryStatistics(advisories);

      expect(stats.total_advisories).toBe(3);
      expect(stats.suggest_split).toBe(1);
      expect(stats.suggest_merge).toBe(2);
      expect(stats.avg_confidence).toBeCloseTo(0.733, 2);
      expect(stats.llm_used).toBe(2);
      expect(stats.llm_failed).toBe(1);
    });

    it('should handle empty advisories', () => {
      const stats = getAdvisoryStatistics([]);

      expect(stats.total_advisories).toBe(0);
      expect(stats.avg_confidence).toBe(0);
    });
  });
});
