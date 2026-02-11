/**
 * LLM Boundary Validation Tests
 * 
 * 验证LLM的使用边界，确保：
 * 1. LLM不参与锚点指纹生成
 * 2. LLM不参与实体存在裁决
 * 3. LLM只提供建议而非决策
 * 4. 所有LLM输出包含reasoning和confidence
 */

const { generateAnchorFingerprint } = require('./anchor_generator');
const { mergeInstancesByAnchor } = require('./anchor_merger');
const { detectAnchorConflict } = require('./anchor_conflict_detector');
const { adviseMergeConflict } = require('./llm_conflict_advisor');

// Mock qwen_client to track LLM calls
jest.mock('../utils/qwen_client', () => ({
  createQwenClient: jest.fn()
}));

const { createQwenClient } = require('../utils/qwen_client');

describe('LLM Boundary Validation', () => {
  // Helper function to create test instances
  function createTestInstance(schemaName, fields, confidence = 0.8) {
    return {
      schema_name: schemaName,
      schema_id: `schema_${schemaName}`,
      entity_type: 'TestEntity',
      fields,
      ckb_ids: ['ckb_1'],
      confidence
    };
  }

  // Helper function to create test schema
  function createTestSchema(anchorFields = []) {
    return {
      schema_name: 'TestSchema',
      schema_id: 'schema_test',
      entity_type: 'TestEntity',
      anchor_fields: anchorFields.length > 0 ? anchorFields : [
        { name: '区域', normalization_strategy: 'location' },
        { name: '时间', normalization_strategy: 'time_month' }
      ]
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('11.1 验证LLM不参与锚点指纹生成', () => {
    it('should generate anchor fingerprint without LLM', () => {
      const instance = createTestInstance('Schema A', {
        区域: '阿里C区',
        时间: '2025-01-15'
      });

      const schema = createTestSchema();

      // 生成锚点指纹
      const fingerprint = generateAnchorFingerprint(instance, schema);

      // 验证：
      // 1. 锚点指纹成功生成
      expect(fingerprint).toBeDefined();
      expect(typeof fingerprint).toBe('string');
      expect(fingerprint).toContain('TestEntity');

      // 2. 没有调用LLM
      expect(createQwenClient).not.toHaveBeenCalled();
    });

    it('should generate consistent fingerprints without LLM', () => {
      const instance = createTestInstance('Schema A', {
        区域: '阿里C区',
        时间: '2025-01-15'
      });

      const schema = createTestSchema();

      // 多次生成锚点指纹
      const fingerprint1 = generateAnchorFingerprint(instance, schema);
      const fingerprint2 = generateAnchorFingerprint(instance, schema);
      const fingerprint3 = generateAnchorFingerprint(instance, schema);

      // 验证：
      // 1. 锚点指纹完全一致（确定性）
      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint2).toBe(fingerprint3);

      // 2. 没有调用LLM
      expect(createQwenClient).not.toHaveBeenCalled();
    });

    it('should normalize fields without LLM', () => {
      const instance1 = createTestInstance('Schema A', {
        区域: '阿里C区',
        时间: '2025-01-15'
      });

      const instance2 = createTestInstance('Schema B', {
        区域: '阿里C区',
        时间: '2025-01-20' // 不同日期，但同一月份
      });

      const schema = createTestSchema();

      // 生成锚点指纹
      const fingerprint1 = generateAnchorFingerprint(instance1, schema);
      const fingerprint2 = generateAnchorFingerprint(instance2, schema);

      // 验证：
      // 1. 相同月份的锚点指纹一致（规则标准化）
      expect(fingerprint1).toBe(fingerprint2);

      // 2. 没有调用LLM
      expect(createQwenClient).not.toHaveBeenCalled();
    });
  });

  describe('11.2 验证LLM不参与实体存在裁决', () => {
    it('should merge instances by anchor without LLM', () => {
      const instances = [
        createTestInstance('Schema A', { 区域: '阿里C区', 时间: '2025-01' }),
        createTestInstance('Schema B', { 区域: '阿里C区', 时间: '2025-01' }),
        createTestInstance('Schema C', { 区域: '阿里D区', 时间: '2025-01' })
      ];

      const schemaMap = new Map([
        ['schema_Schema A', createTestSchema()],
        ['schema_Schema B', createTestSchema()],
        ['schema_Schema C', createTestSchema()]
      ]);

      // 合并实例
      const entities = mergeInstancesByAnchor(instances, schemaMap);

      // 验证：
      // 1. 实体正确合并（相同锚点合并，不同锚点分开）
      expect(entities).toHaveLength(2);

      // 2. 没有调用LLM
      expect(createQwenClient).not.toHaveBeenCalled();
    });

    it('should decide entity existence based on anchor only', () => {
      const instances = [
        createTestInstance('Schema A', { 区域: '阿里C区', 时间: '2025-01' }),
        createTestInstance('Schema B', { 区域: '阿里C区', 时间: '2025-01' })
      ];

      const schemaMap = new Map([
        ['schema_Schema A', createTestSchema()],
        ['schema_Schema B', createTestSchema()]
      ]);

      // 合并实例
      const entities = mergeInstancesByAnchor(instances, schemaMap);

      // 验证：
      // 1. 相同锚点合并为1个实体（规则决策）
      expect(entities).toHaveLength(1);
      expect(entities[0].schemas).toHaveLength(2);

      // 2. 没有调用LLM
      expect(createQwenClient).not.toHaveBeenCalled();
    });

    it('should not create or delete entities based on LLM', () => {
      const instances = [
        createTestInstance('Schema A', { 区域: '阿里C区' }),
        createTestInstance('Schema B', { 区域: '阿里D区' }),
        createTestInstance('Schema C', { 区域: '阿里E区' })
      ];

      const schemaMap = new Map([
        ['schema_Schema A', createTestSchema()],
        ['schema_Schema B', createTestSchema()],
        ['schema_Schema C', createTestSchema()]
      ]);

      // 合并实例
      const entities = mergeInstancesByAnchor(instances, schemaMap);

      // 验证：
      // 1. 实体数量由锚点决定，不由LLM决定
      expect(entities).toHaveLength(3); // 3个不同锚点 = 3个实体

      // 2. 没有调用LLM
      expect(createQwenClient).not.toHaveBeenCalled();
    });
  });

  describe('11.3 验证LLM只提供建议而非决策', () => {
    it('should detect conflicts without LLM', () => {
      const group = [
        {
          instance: createTestInstance('Schema A', { 状态: '正常' }),
          schema: createTestSchema(),
          anchor: 'TestEntity|test'
        },
        {
          instance: createTestInstance('Schema B', { 状态: '异常' }),
          schema: createTestSchema(),
          anchor: 'TestEntity|test'
        }
      ];

      // 检测冲突
      const conflictResult = detectAnchorConflict('TestEntity|test', group);

      // 验证：
      // 1. 冲突检测成功（规则检测）
      expect(conflictResult.has_conflict).toBe(true);
      expect(conflictResult.conflicts.length).toBeGreaterThan(0);

      // 2. 没有调用LLM
      expect(createQwenClient).not.toHaveBeenCalled();
    });

    it('should provide recommendation without LLM when no API key', async () => {
      const conflictResult = {
        anchor: 'TestEntity|test',
        has_conflict: true,
        conflicts: [
          { type: 'state_contradiction', severity: 'high' }
        ],
        severity: 'high'
      };

      const group = [
        {
          instance: createTestInstance('Schema A', { 状态: '正常' }),
          schema: createTestSchema(),
          anchor: 'TestEntity|test'
        }
      ];

      // 获取建议（无API key）
      const advisory = await adviseMergeConflict(conflictResult, group);

      // 验证：
      // 1. 建议成功生成（规则建议）
      expect(advisory).toBeDefined();
      expect(advisory.suggest_split).toBeDefined();
      expect(advisory.confidence).toBeDefined();
      expect(advisory.reason).toBeDefined();

      // 2. 标记为非LLM建议
      expect(advisory.llm_advisory).toBe(false);

      // 3. 没有调用LLM
      expect(createQwenClient).not.toHaveBeenCalled();
    });

    it('should mark LLM output as advisory only', async () => {
      const mockLLMClient = {
        callJSON: jest.fn().mockResolvedValue({
          suggest_split: true,
          confidence: 0.85,
          reason: 'LLM建议拆分'
        })
      };

      createQwenClient.mockReturnValue(mockLLMClient);

      const conflictResult = {
        anchor: 'TestEntity|test',
        has_conflict: true,
        conflicts: [{ type: 'value_conflict', severity: 'medium' }],
        severity: 'medium'
      };

      const group = [
        {
          instance: createTestInstance('Schema A', {}),
          schema: createTestSchema(),
          anchor: 'TestEntity|test'
        }
      ];

      // 获取LLM建议
      const advisory = await adviseMergeConflict(conflictResult, group, {
        apiKey: 'test-key'
      });

      // 验证：
      // 1. LLM输出标记为建议
      expect(advisory.llm_advisory).toBe(true);

      // 2. 输出是建议性的（suggest_split），不是决策性的（do_split）
      expect(advisory).toHaveProperty('suggest_split');
      expect(advisory).not.toHaveProperty('do_split');
      expect(advisory).not.toHaveProperty('merge');
      expect(advisory).not.toHaveProperty('split');
    });

    it('should not automatically apply LLM suggestions', async () => {
      const mockLLMClient = {
        callJSON: jest.fn().mockResolvedValue({
          suggest_split: true,
          confidence: 0.9,
          reason: 'LLM强烈建议拆分'
        })
      };

      createQwenClient.mockReturnValue(mockLLMClient);

      const instances = [
        createTestInstance('Schema A', { 区域: '阿里C区' }),
        createTestInstance('Schema B', { 区域: '阿里C区' })
      ];

      const schemaMap = new Map([
        ['schema_Schema A', createTestSchema()],
        ['schema_Schema B', createTestSchema()]
      ]);

      // 合并实例（不使用LLM建议）
      const entities = mergeInstancesByAnchor(instances, schemaMap);

      // 验证：
      // 1. 实体仍然合并（LLM建议不自动应用）
      expect(entities).toHaveLength(1);
      expect(entities[0].schemas).toHaveLength(2);

      // 2. LLM建议需要人工审核后才能应用
      // （这个测试证明了LLM建议不会自动改变合并结果）
    });
  });

  describe('11.4 验证所有LLM输出包含reasoning和confidence', () => {
    it('should require reason in LLM response', async () => {
      const mockLLMClient = {
        callJSON: jest.fn().mockResolvedValue({
          suggest_split: true,
          confidence: 0.85
          // 缺少 reason
        })
      };

      createQwenClient.mockReturnValue(mockLLMClient);

      const conflictResult = {
        anchor: 'TestEntity|test',
        has_conflict: true,
        conflicts: [{ type: 'value_conflict', severity: 'medium' }],
        severity: 'medium'
      };

      const group = [
        {
          instance: createTestInstance('Schema A', {}),
          schema: createTestSchema(),
          anchor: 'TestEntity|test'
        }
      ];

      // 获取LLM建议（应该失败）
      const advisory = await adviseMergeConflict(conflictResult, group, {
        apiKey: 'test-key'
      });

      // 验证：
      // 1. LLM调用失败，降级到规则建议
      expect(advisory.llm_advisory).toBe(false);
      expect(advisory.error).toBeDefined();
    });

    it('should require confidence in LLM response', async () => {
      const mockLLMClient = {
        callJSON: jest.fn().mockResolvedValue({
          suggest_split: true,
          reason: '建议拆分'
          // 缺少 confidence
        })
      };

      createQwenClient.mockReturnValue(mockLLMClient);

      const conflictResult = {
        anchor: 'TestEntity|test',
        has_conflict: true,
        conflicts: [{ type: 'value_conflict', severity: 'medium' }],
        severity: 'medium'
      };

      const group = [
        {
          instance: createTestInstance('Schema A', {}),
          schema: createTestSchema(),
          anchor: 'TestEntity|test'
        }
      ];

      // 获取LLM建议（应该失败）
      const advisory = await adviseMergeConflict(conflictResult, group, {
        apiKey: 'test-key'
      });

      // 验证：
      // 1. LLM调用失败，降级到规则建议
      expect(advisory.llm_advisory).toBe(false);
      expect(advisory.error).toBeDefined();
    });

    it('should validate confidence range', async () => {
      const mockLLMClient = {
        callJSON: jest.fn().mockResolvedValue({
          suggest_split: true,
          confidence: 1.5, // 超出范围
          reason: '建议拆分'
        })
      };

      createQwenClient.mockReturnValue(mockLLMClient);

      const conflictResult = {
        anchor: 'TestEntity|test',
        has_conflict: true,
        conflicts: [{ type: 'value_conflict', severity: 'medium' }],
        severity: 'medium'
      };

      const group = [
        {
          instance: createTestInstance('Schema A', {}),
          schema: createTestSchema(),
          anchor: 'TestEntity|test'
        }
      ];

      // 获取LLM建议（应该失败）
      const advisory = await adviseMergeConflict(conflictResult, group, {
        apiKey: 'test-key'
      });

      // 验证：
      // 1. LLM调用失败，降级到规则建议
      expect(advisory.llm_advisory).toBe(false);
      expect(advisory.error).toBeDefined();
    });

    it('should include reason and confidence in valid LLM response', async () => {
      const mockLLMClient = {
        callJSON: jest.fn().mockResolvedValue({
          suggest_split: true,
          confidence: 0.85,
          reason: '时间字段不一致，建议拆分为不同实体'
        })
      };

      createQwenClient.mockReturnValue(mockLLMClient);

      const conflictResult = {
        anchor: 'TestEntity|test',
        has_conflict: true,
        conflicts: [{ type: 'time_inconsistency', severity: 'high' }],
        severity: 'high'
      };

      const group = [
        {
          instance: createTestInstance('Schema A', { 时间: '2025-01' }),
          schema: createTestSchema(),
          anchor: 'TestEntity|test'
        }
      ];

      // 获取LLM建议
      const advisory = await adviseMergeConflict(conflictResult, group, {
        apiKey: 'test-key'
      });

      // 验证：
      // 1. LLM建议成功
      expect(advisory.llm_advisory).toBe(true);

      // 2. 包含reasoning
      expect(advisory.reason).toBeDefined();
      expect(typeof advisory.reason).toBe('string');
      expect(advisory.reason.length).toBeGreaterThan(0);

      // 3. 包含confidence
      expect(advisory.confidence).toBeDefined();
      expect(typeof advisory.confidence).toBe('number');
      expect(advisory.confidence).toBeGreaterThanOrEqual(0);
      expect(advisory.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('综合边界验证', () => {
    it('should maintain clear LLM boundaries in full workflow', async () => {
      // 模拟完整工作流
      const instances = [
        createTestInstance('Schema A', { 区域: '阿里C区', 时间: '2025-01', 状态: '正常' }),
        createTestInstance('Schema B', { 区域: '阿里C区', 时间: '2025-01', 状态: '异常' })
      ];

      const schemaMap = new Map([
        ['schema_Schema A', createTestSchema()],
        ['schema_Schema B', createTestSchema()]
      ]);

      // Step 1: 生成锚点指纹（无LLM）
      const fingerprints = instances.map(inst => {
        const schema = schemaMap.get(inst.schema_id);
        return generateAnchorFingerprint(inst, schema);
      });

      expect(fingerprints[0]).toBe(fingerprints[1]); // 相同锚点
      expect(createQwenClient).not.toHaveBeenCalled();

      // Step 2: 合并实体（无LLM）
      const entities = mergeInstancesByAnchor(instances, schemaMap);

      expect(entities).toHaveLength(1); // 合并为1个实体
      expect(createQwenClient).not.toHaveBeenCalled();

      // Step 3: 检测冲突（无LLM）
      const group = [
        {
          instance: instances[0],
          schema: schemaMap.get(instances[0].schema_id),
          anchor: fingerprints[0]
        },
        {
          instance: instances[1],
          schema: schemaMap.get(instances[1].schema_id),
          anchor: fingerprints[1]
        }
      ];

      const conflictResult = detectAnchorConflict(fingerprints[0], group);

      expect(conflictResult.has_conflict).toBe(true);
      expect(createQwenClient).not.toHaveBeenCalled();

      // Step 4: LLM建议（仅此步骤可能使用LLM）
      const mockLLMClient = {
        callJSON: jest.fn().mockResolvedValue({
          suggest_split: true,
          confidence: 0.9,
          reason: '状态矛盾，建议拆分'
        })
      };

      createQwenClient.mockReturnValue(mockLLMClient);

      const advisory = await adviseMergeConflict(conflictResult, group, {
        apiKey: 'test-key'
      });

      // 验证：
      // 1. 只有建议步骤调用了LLM
      expect(createQwenClient).toHaveBeenCalledTimes(1);

      // 2. LLM输出是建议性的
      expect(advisory.llm_advisory).toBe(true);
      expect(advisory.suggest_split).toBe(true);
      expect(advisory.confidence).toBe(0.9);
      expect(advisory.reason).toBeDefined();

      // 3. 实体合并结果不受LLM影响
      expect(entities).toHaveLength(1); // 仍然是1个实体
    });
  });
});
