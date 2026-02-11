/**
 * Property-Based Tests for Anchor Merger
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 * 
 * 使用fast-check进行属性测试，验证锚点合并器的核心属性：
 * - 幂等性：多次合并结果一致
 * - 结合律：合并顺序不影响结果
 */

const fc = require('fast-check');
const {
  mergeInstancesByAnchor,
  mergeGroupToEntity,
  mergeFields,
  calculateMergedConfidence,
  generateCanonicalName,
  extractAnchorFields,
  generateEntityId
} = require('./anchor_merger');

/**
 * 辅助函数：创建测试用的Schema实例
 */
function createTestInstance(schemaId, schemaName, fields, confidence = 0.8) {
  return {
    schema_id: schemaId,
    schema_name: schemaName,
    entity_type: 'EventEntity',
    fields: fields,
    ckb_ids: [`ckb_${schemaId}`],
    confidence: confidence,
    created_at: new Date().toISOString()
  };
}

/**
 * 辅助函数：创建测试用的Schema定义
 */
function createTestSchema(schemaId, schemaName, anchorFields) {
  return {
    schema_id: schemaId,
    schema_name: schemaName,
    entity_type: 'EventEntity',
    anchor_fields: anchorFields || [
      { name: '区域', normalization_strategy: 'location' },
      { name: '时间', normalization_strategy: 'time_month' }
    ]
  };
}

describe('AnchorMerger Property Tests', () => {
  /**
   * Property 3.10.1: 幂等性（多次合并结果一致）
   * 
   * **Validates: Requirements 4.1, 4.2**
   * 
   * 验证：对于相同的输入，多次调用合并函数必须返回相同的结果。
   */
  describe('Property: Idempotence', () => {
    it('should produce identical results when merging same instances multiple times', () => {
      fc.assert(
        fc.property(
          // 生成任意数量的实例
          fc.array(
            fc.record({
              区域: fc.string({ minLength: 1, maxLength: 20 }),
              时间: fc.string({ minLength: 1, maxLength: 20 }),
              指标: fc.string({ minLength: 1, maxLength: 20 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (fieldsArray) => {
            // 创建实例列表
            const instances = fieldsArray.map((fields, i) =>
              createTestInstance(`schema_${i}`, `Schema ${i}`, fields, 0.8)
            );

            // 创建schema映射
            const schemaMap = new Map(
              instances.map(inst => [
                inst.schema_id,
                createTestSchema(inst.schema_id, inst.schema_name)
              ])
            );

            // 第一次合并
            const entities1 = mergeInstancesByAnchor(instances, schemaMap);

            // 第二次合并（相同输入）
            const entities2 = mergeInstancesByAnchor(instances, schemaMap);

            // 结果必须相同（忽略时间戳）
            const normalized1 = entities1.map(e => {
              const { created_at, updated_at, ...rest } = e;
              return rest;
            });
            const normalized2 = entities2.map(e => {
              const { created_at, updated_at, ...rest } = e;
              return rest;
            });

            return JSON.stringify(normalized1) === JSON.stringify(normalized2);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should produce identical entity when merging same group multiple times', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.record({
              区域: fc.string({ minLength: 1, maxLength: 20 }),
              时间: fc.string({ minLength: 1, maxLength: 20 })
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (anchor, fieldsArray) => {
            // 创建实例组
            const group = fieldsArray.map((fields, i) => ({
              instance: createTestInstance(`schema_${i}`, `Schema ${i}`, fields),
              schema: createTestSchema(`schema_${i}`, `Schema ${i}`),
              anchor: anchor
            }));

            // 第一次合并
            const entity1 = mergeGroupToEntity(anchor, group);

            // 第二次合并
            const entity2 = mergeGroupToEntity(anchor, group);

            // 结果必须相同（忽略时间戳）
            const { created_at: _, updated_at: __, ...rest1 } = entity1;
            const { created_at: ___, updated_at: ____, ...rest2 } = entity2;

            return JSON.stringify(rest1) === JSON.stringify(rest2);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should produce identical merged fields when merging same group multiple times', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              区域: fc.string({ minLength: 1, maxLength: 20 }),
              时间: fc.string({ minLength: 1, maxLength: 20 })
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (fieldsArray) => {
            const group = fieldsArray.map((fields, i) => ({
              instance: createTestInstance(`schema_${i}`, `Schema ${i}`, fields),
              schema: createTestSchema(`schema_${i}`, `Schema ${i}`),
              anchor: 'test_anchor'
            }));

            const merged1 = mergeFields(group);
            const merged2 = mergeFields(group);

            return JSON.stringify(merged1) === JSON.stringify(merged2);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should calculate identical confidence for same group multiple times', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.float({ min: Math.fround(0.1), max: Math.fround(0.99), noNaN: true }),
            { minLength: 1, maxLength: 5 }
          ),
          (confidences) => {
            const group = confidences.map((conf, i) => ({
              instance: createTestInstance(`schema_${i}`, `Schema ${i}`, {}, conf),
              schema: createTestSchema(`schema_${i}`, `Schema ${i}`),
              anchor: 'test_anchor'
            }));

            const conf1 = calculateMergedConfidence(group);
            const conf2 = calculateMergedConfidence(group);

            return conf1 === conf2;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 3.10.2: 结合律（合并顺序不影响结果）
   * 
   * **Validates: Requirements 4.3, 4.4**
   * 
   * 验证：改变实例的输入顺序不应影响最终的合并结果（除了字段冲突时的选择）。
   */
  describe('Property: Associativity', () => {
    it('should produce same entities regardless of instance order (same anchor)', () => {
      fc.assert(
        fc.property(
          // 生成相同锚点字段的实例
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.array(
            fc.record({
              数值: fc.string({ minLength: 1, maxLength: 10 })
            }),
            { minLength: 2, maxLength: 4 }
          ),
          (区域, 时间, extraFieldsArray) => {
            // 创建具有相同锚点字段但不同额外字段的实例
            const instances = extraFieldsArray.map((extraFields, i) =>
              createTestInstance(
                `schema_${i}`,
                `Schema ${i}`,
                { 区域, 时间, ...extraFields },
                0.8
              )
            );

            const schemaMap = new Map(
              instances.map(inst => [
                inst.schema_id,
                createTestSchema(inst.schema_id, inst.schema_name)
              ])
            );

            // 原始顺序合并
            const entities1 = mergeInstancesByAnchor(instances, schemaMap);

            // 反转顺序合并
            const reversedInstances = [...instances].reverse();
            const entities2 = mergeInstancesByAnchor(reversedInstances, schemaMap);

            // 应该产生相同数量的实体
            if (entities1.length !== entities2.length) {
              return false;
            }

            // 实体应该有相同的锚点指纹
            const anchors1 = entities1.map(e => e.anchor_fingerprint).sort();
            const anchors2 = entities2.map(e => e.anchor_fingerprint).sort();

            return JSON.stringify(anchors1) === JSON.stringify(anchors2);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should produce same entity count regardless of instance order', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              区域: fc.string({ minLength: 1, maxLength: 20 }),
              时间: fc.string({ minLength: 1, maxLength: 20 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (fieldsArray) => {
            const instances = fieldsArray.map((fields, i) =>
              createTestInstance(`schema_${i}`, `Schema ${i}`, fields)
            );

            const schemaMap = new Map(
              instances.map(inst => [
                inst.schema_id,
                createTestSchema(inst.schema_id, inst.schema_name)
              ])
            );

            // 原始顺序
            const entities1 = mergeInstancesByAnchor(instances, schemaMap);

            // 随机打乱顺序
            const shuffled = [...instances].sort(() => Math.random() - 0.5);
            const entities2 = mergeInstancesByAnchor(shuffled, schemaMap);

            // 实体数量应该相同
            return entities1.length === entities2.length;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should produce same confidence calculation regardless of group order', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.float({ min: Math.fround(0.1), max: Math.fround(0.99), noNaN: true }),
            { minLength: 2, maxLength: 5 }
          ),
          (confidences) => {
            const group = confidences.map((conf, i) => ({
              instance: createTestInstance(`schema_${i}`, `Schema ${i}`, {}, conf),
              schema: createTestSchema(`schema_${i}`, `Schema ${i}`),
              anchor: 'test_anchor'
            }));

            const conf1 = calculateMergedConfidence(group);

            // 反转顺序
            const reversedGroup = [...group].reverse();
            const conf2 = calculateMergedConfidence(reversedGroup);

            // 置信度计算应该与顺序无关
            return Math.abs(conf1 - conf2) < 0.0001;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Additional Property: 一致性约束
   * 
   * 验证：合并后的实体必须满足一致性约束
   */
  describe('Property: Consistency Constraints', () => {
    it('should always produce entities with valid structure', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              区域: fc.string({ minLength: 1, maxLength: 20 }),
              时间: fc.string({ minLength: 1, maxLength: 20 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (fieldsArray) => {
            const instances = fieldsArray.map((fields, i) =>
              createTestInstance(`schema_${i}`, `Schema ${i}`, fields)
            );

            const schemaMap = new Map(
              instances.map(inst => [
                inst.schema_id,
                createTestSchema(inst.schema_id, inst.schema_name)
              ])
            );

            const entities = mergeInstancesByAnchor(instances, schemaMap);

            // 验证每个实体的结构
            return entities.every(entity =>
              entity.entity_id &&
              entity.entity_type &&
              entity.canonical_name &&
              entity.anchor_fingerprint &&
              Array.isArray(entity.schemas) &&
              Array.isArray(entity.supported_by) &&
              typeof entity.confidence === 'number' &&
              entity.confidence >= 0 &&
              entity.confidence <= 1
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should always produce confidence in valid range [0, 1]', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.float({ min: Math.fround(0.1), max: Math.fround(0.99), noNaN: true }),
            { minLength: 1, maxLength: 10 }
          ),
          (confidences) => {
            const group = confidences.map((conf, i) => ({
              instance: createTestInstance(`schema_${i}`, `Schema ${i}`, {}, conf),
              schema: createTestSchema(`schema_${i}`, `Schema ${i}`),
              anchor: 'test_anchor'
            }));

            const mergedConf = calculateMergedConfidence(group);

            return mergedConf >= 0 && mergedConf <= 1 && !isNaN(mergedConf);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always produce non-empty canonical names', () => {
      fc.assert(
        fc.property(
          fc.record({
            区域: fc.string({ minLength: 1, maxLength: 20 }),
            时间: fc.string({ minLength: 1, maxLength: 20 })
          }),
          (fields) => {
            const schema = createTestSchema('schema_001', 'Test Schema');
            const name = generateCanonicalName(fields, schema);

            return name && name.length > 0;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should always produce deterministic entity IDs from anchors', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (anchor) => {
            const id1 = generateEntityId(anchor);
            const id2 = generateEntityId(anchor);

            return id1 === id2 && /^entity_[a-f0-9]{16}$/.test(id1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional Property: 合并保持性
   * 
   * 验证：合并不会丢失信息
   */
  describe('Property: Information Preservation', () => {
    it('should preserve all schemas in merged entity', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              区域: fc.string({ minLength: 1, maxLength: 20 }),
              时间: fc.string({ minLength: 1, maxLength: 20 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (fieldsArray) => {
            const instances = fieldsArray.map((fields, i) =>
              createTestInstance(`schema_${i}`, `Schema ${i}`, fields)
            );

            const schemaMap = new Map(
              instances.map(inst => [
                inst.schema_id,
                createTestSchema(inst.schema_id, inst.schema_name)
              ])
            );

            const entities = mergeInstancesByAnchor(instances, schemaMap);

            // 所有schema应该被保留在某个实体中
            const allSchemaIds = new Set(instances.map(i => i.schema_id));
            const mergedSchemaIds = new Set(
              entities.flatMap(e => e.schemas.map(s => s.schema_id))
            );

            return allSchemaIds.size === mergedSchemaIds.size;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should preserve all CKB IDs in merged entity', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              区域: fc.string({ minLength: 1, maxLength: 20 }),
              时间: fc.string({ minLength: 1, maxLength: 20 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (fieldsArray) => {
            const instances = fieldsArray.map((fields, i) =>
              createTestInstance(`schema_${i}`, `Schema ${i}`, fields)
            );

            const schemaMap = new Map(
              instances.map(inst => [
                inst.schema_id,
                createTestSchema(inst.schema_id, inst.schema_name)
              ])
            );

            const entities = mergeInstancesByAnchor(instances, schemaMap);

            // 所有CKB ID应该被保留
            const allCkbIds = new Set(instances.flatMap(i => i.ckb_ids));
            const mergedCkbIds = new Set(
              entities.flatMap(e => e.supported_by)
            );

            return allCkbIds.size === mergedCkbIds.size;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Additional Property: 置信度单调性
   * 
   * 验证：更多schema支撑应该导致更高或相等的置信度
   */
  describe('Property: Confidence Monotonicity', () => {
    it('should increase or maintain confidence with more schemas', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.5), max: Math.fround(0.8), noNaN: true }),
          fc.integer({ min: 1, max: 5 }),
          (baseConfidence, schemaCount) => {
            // 创建单个schema的组
            const singleGroup = [{
              instance: createTestInstance('schema_1', 'Schema 1', {}, baseConfidence),
              schema: createTestSchema('schema_1', 'Schema 1'),
              anchor: 'test'
            }];

            // 创建多个schema的组
            const multiGroup = Array.from({ length: schemaCount }, (_, i) => ({
              instance: createTestInstance(`schema_${i}`, `Schema ${i}`, {}, baseConfidence),
              schema: createTestSchema(`schema_${i}`, `Schema ${i}`),
              anchor: 'test'
            }));

            const singleConf = calculateMergedConfidence(singleGroup);
            const multiConf = calculateMergedConfidence(multiGroup);

            // 多schema的置信度应该 >= 单schema的置信度
            return multiConf >= singleConf && !isNaN(multiConf) && !isNaN(singleConf);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
