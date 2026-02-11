/**
 * Property-Based Tests for Anchor Generator
 * 
 * **Validates: Requirements 2.4, 2.5**
 * 
 * 使用fast-check进行属性测试，验证锚点生成器的核心属性：
 * - 确定性：相同输入必须产生相同输出
 * - 单射性：不同输入必须产生不同输出
 */

const fc = require('fast-check');
const {
  generateAnchorFingerprint,
  generateEntityId,
  inferAnchorFields,
  inferNormalizationStrategy
} = require('./anchor_generator');

describe('AnchorGenerator Property Tests', () => {
  /**
   * Property 2.7.1: 确定性（相同输入→相同输出）
   * 
   * **Validates: Requirements 2.4**
   * 
   * 验证：对于任意Schema实例和Schema定义，多次调用generateAnchorFingerprint
   * 必须返回完全相同的锚点指纹。
   */
  describe('Property: Determinism', () => {
    it('should generate identical fingerprints for identical inputs', () => {
      fc.assert(
        fc.property(
          // 生成任意字段对象
          fc.record({
            区域: fc.string({ minLength: 1, maxLength: 20 }),
            时间: fc.string({ minLength: 1, maxLength: 20 }),
            指标: fc.string({ minLength: 1, maxLength: 20 })
          }),
          // 生成任意entity_type
          fc.constantFrom('EventEntity', 'LocationEntity', 'TravelEntity', 'PhotographyEntity'),
          (fields, entityType) => {
            const instance = { fields };
            const schema = {
              entity_type: entityType,
              schema_name: 'Test Schema',
              anchor_fields: [
                { name: '区域', normalization_strategy: 'location' },
                { name: '时间', normalization_strategy: 'time_month' },
                { name: '指标', normalization_strategy: 'indicator' }
              ]
            };

            // 生成两次锚点指纹
            const anchor1 = generateAnchorFingerprint(instance, schema);
            const anchor2 = generateAnchorFingerprint(instance, schema);

            // 必须完全相同
            return anchor1 === anchor2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate identical entity IDs for identical anchors', () => {
      fc.assert(
        fc.property(
          // 生成任意锚点指纹格式的字符串
          fc.tuple(
            fc.constantFrom('EventEntity', 'LocationEntity', 'TravelEntity'),
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ minLength: 1, maxLength: 20 })
          ).map(([type, val1, val2]) => `${type}|${val1}|${val2}`),
          (anchorFingerprint) => {
            const id1 = generateEntityId(anchorFingerprint);
            const id2 = generateEntityId(anchorFingerprint);

            return id1 === id2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should infer identical anchor fields for identical schemas', () => {
      fc.assert(
        fc.property(
          // 生成任意core_fields配置
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 10 }),
              required: fc.boolean(),
              weight: fc.float({ min: 0, max: 1 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (coreFields) => {
            const schema = { core_fields: coreFields };

            const anchorFields1 = inferAnchorFields(schema);
            const anchorFields2 = inferAnchorFields(schema);

            // 必须返回相同的字段列表
            return JSON.stringify(anchorFields1) === JSON.stringify(anchorFields2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should infer identical normalization strategies for identical field names', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          (fieldName) => {
            const strategy1 = inferNormalizationStrategy(fieldName);
            const strategy2 = inferNormalizationStrategy(fieldName);

            return strategy1 === strategy2;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2.7.2: 单射性（不同输入→不同输出）
   * 
   * **Validates: Requirements 2.5**
   * 
   * 验证：对于不同的Schema实例（至少有一个锚点字段值不同），
   * generateAnchorFingerprint必须返回不同的锚点指纹。
   */
  describe('Property: Injectivity', () => {
    it('should generate different fingerprints for different field values', () => {
      fc.assert(
        fc.property(
          // 生成两个不同的字段对象
          fc.tuple(
            fc.record({
              区域: fc.string({ minLength: 1, maxLength: 20 }),
              时间: fc.string({ minLength: 1, maxLength: 20 }),
              指标: fc.string({ minLength: 1, maxLength: 20 })
            }),
            fc.record({
              区域: fc.string({ minLength: 1, maxLength: 20 }),
              时间: fc.string({ minLength: 1, maxLength: 20 }),
              指标: fc.string({ minLength: 1, maxLength: 20 })
            })
          ).filter(([fields1, fields2]) => {
            // 确保至少有一个字段不同
            return JSON.stringify(fields1) !== JSON.stringify(fields2);
          }),
          ([fields1, fields2]) => {
            const instance1 = { fields: fields1 };
            const instance2 = { fields: fields2 };

            const schema = {
              entity_type: 'EventEntity',
              schema_name: 'Test Schema',
              anchor_fields: [
                { name: '区域', normalization_strategy: 'location' },
                { name: '时间', normalization_strategy: 'time_month' },
                { name: '指标', normalization_strategy: 'indicator' }
              ]
            };

            const anchor1 = generateAnchorFingerprint(instance1, schema);
            const anchor2 = generateAnchorFingerprint(instance2, schema);

            // 不同输入必须产生不同输出
            return anchor1 !== anchor2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different entity IDs for different anchors', () => {
      fc.assert(
        fc.property(
          // 生成两个不同的锚点指纹
          fc.tuple(
            fc.tuple(
              fc.constantFrom('EventEntity', 'LocationEntity'),
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.string({ minLength: 1, maxLength: 20 })
            ).map(([type, val1, val2]) => `${type}|${val1}|${val2}`),
            fc.tuple(
              fc.constantFrom('EventEntity', 'LocationEntity'),
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.string({ minLength: 1, maxLength: 20 })
            ).map(([type, val1, val2]) => `${type}|${val1}|${val2}`)
          ).filter(([anchor1, anchor2]) => anchor1 !== anchor2),
          ([anchor1, anchor2]) => {
            const id1 = generateEntityId(anchor1);
            const id2 = generateEntityId(anchor2);

            // 不同锚点必须产生不同实体ID
            return id1 !== id2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different fingerprints for different entity types', () => {
      fc.assert(
        fc.property(
          // 生成相同字段但不同entity_type
          fc.record({
            区域: fc.string({ minLength: 1, maxLength: 20 }),
            时间: fc.string({ minLength: 1, maxLength: 20 })
          }),
          fc.tuple(
            fc.constantFrom('EventEntity', 'LocationEntity', 'TravelEntity'),
            fc.constantFrom('EventEntity', 'LocationEntity', 'TravelEntity')
          ).filter(([type1, type2]) => type1 !== type2),
          (fields, [entityType1, entityType2]) => {
            const instance = { fields };

            const schema1 = {
              entity_type: entityType1,
              schema_name: 'Test Schema 1',
              anchor_fields: [
                { name: '区域', normalization_strategy: 'location' },
                { name: '时间', normalization_strategy: 'time_month' }
              ]
            };

            const schema2 = {
              entity_type: entityType2,
              schema_name: 'Test Schema 2',
              anchor_fields: [
                { name: '区域', normalization_strategy: 'location' },
                { name: '时间', normalization_strategy: 'time_month' }
              ]
            };

            const anchor1 = generateAnchorFingerprint(instance, schema1);
            const anchor2 = generateAnchorFingerprint(instance, schema2);

            // 不同entity_type必须产生不同锚点
            return anchor1 !== anchor2;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional Property: 格式一致性
   * 
   * 验证：所有生成的锚点指纹必须符合预期格式
   */
  describe('Property: Format Consistency', () => {
    it('should always generate fingerprints in correct format', () => {
      fc.assert(
        fc.property(
          fc.record({
            区域: fc.string({ minLength: 1, maxLength: 20 }),
            时间: fc.string({ minLength: 1, maxLength: 20 }),
            指标: fc.string({ minLength: 1, maxLength: 20 })
          }),
          fc.constantFrom('EventEntity', 'LocationEntity', 'TravelEntity', 'PhotographyEntity'),
          (fields, entityType) => {
            const instance = { fields };
            const schema = {
              entity_type: entityType,
              schema_name: 'Test Schema',
              anchor_fields: [
                { name: '区域', normalization_strategy: 'location' },
                { name: '时间', normalization_strategy: 'time_month' },
                { name: '指标', normalization_strategy: 'indicator' }
              ]
            };

            const anchor = generateAnchorFingerprint(instance, schema);

            // 验证格式：entity_type|value1|value2|...
            const parts = anchor.split('|');
            return parts.length >= 2 && parts[0] === entityType;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always generate entity IDs in correct format', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.constantFrom('EventEntity', 'LocationEntity'),
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ minLength: 1, maxLength: 20 })
          ).map(([type, val1, val2]) => `${type}|${val1}|${val2}`),
          (anchorFingerprint) => {
            const entityId = generateEntityId(anchorFingerprint);

            // 验证格式：entity_[16位十六进制]
            return /^entity_[a-f0-9]{16}$/.test(entityId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional Property: 非空性
   * 
   * 验证：对于有效输入，锚点指纹和实体ID永远不为空
   */
  describe('Property: Non-emptiness', () => {
    it('should never generate empty fingerprints for valid inputs', () => {
      fc.assert(
        fc.property(
          fc.record({
            区域: fc.string({ minLength: 1, maxLength: 20 }),
            时间: fc.string({ minLength: 1, maxLength: 20 })
          }),
          (fields) => {
            const instance = { fields };
            const schema = {
              entity_type: 'EventEntity',
              schema_name: 'Test Schema',
              anchor_fields: [
                { name: '区域', normalization_strategy: 'location' },
                { name: '时间', normalization_strategy: 'time_month' }
              ]
            };

            const anchor = generateAnchorFingerprint(instance, schema);

            return anchor.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never generate empty entity IDs for valid anchors', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (anchorFingerprint) => {
            const entityId = generateEntityId(anchorFingerprint);

            return entityId.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional Property: 标准化幂等性
   * 
   * 验证：标准化策略推断是幂等的
   */
  describe('Property: Normalization Strategy Idempotence', () => {
    it('should infer same strategy regardless of case', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          (fieldName) => {
            const strategy1 = inferNormalizationStrategy(fieldName);
            const strategy2 = inferNormalizationStrategy(fieldName.toLowerCase());
            const strategy3 = inferNormalizationStrategy(fieldName.toUpperCase());

            // 大小写不应影响策略推断（因为内部会toLowerCase）
            return strategy1 === strategy2 && strategy2 === strategy3;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
