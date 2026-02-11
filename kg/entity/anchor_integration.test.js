/**
 * Integration Tests for Anchor-Driven Entity Synthesis
 * 
 * 测试完整的锚点驱动实体合成流程：
 * Schema实例 → 锚点指纹 → 实体合并
 */

const { createSchemaInstance, createSchemaInstances } = require('../schema/schema_instance');
const { generateAnchorFingerprintsBatch } = require('./anchor_generator');
const { mergeInstancesByAnchor, getMergeStatistics } = require('./anchor_merger');

describe('Anchor-Driven Entity Synthesis Integration', () => {
  describe('Complete Flow: Schema Instances → Anchors → Entities', () => {
    it('should process multiple schemas and merge by anchor', () => {
      // Step 1: 模拟Schema匹配结果
      const schemaScores = [
        {
          schema: {
            schema_id: 'schema_water_event',
            schema_name: '地下水位变化事件',
            entity_type: 'EventEntity',
            core_fields: [
              { name: '区域', required: true },
              { name: '时间', required: true },
              { name: '指标', required: true }
            ],
            anchor_fields: [
              { name: '区域', normalization_strategy: 'location' },
              { name: '指标', normalization_strategy: 'indicator' },
              { name: '时间', normalization_strategy: 'time_month' }
            ]
          },
          score: 0.9
        },
        {
          schema: {
            schema_id: 'schema_hydro_event',
            schema_name: '异常水文事件',
            entity_type: 'EventEntity',
            core_fields: [
              { name: '区域', required: true },
              { name: '时间', required: true },
              { name: '指标', required: true }
            ],
            anchor_fields: [
              { name: '区域', normalization_strategy: 'location' },
              { name: '指标', normalization_strategy: 'indicator' },
              { name: '时间', normalization_strategy: 'time_month' }
            ]
          },
          score: 0.75
        }
      ];

      const normalizedFields = {
        区域: '阿里C区',
        时间: '2025-01-15',
        指标: '地下水位',
        数值: '-10',
        单位: '米'
      };

      const ckb = { id: 'ckb_001' };

      // Step 2: 创建Schema实例
      const instances = createSchemaInstances(schemaScores, normalizedFields, ckb);

      expect(instances).toHaveLength(2);
      expect(instances[0].schema_name).toBe('地下水位变化事件');
      expect(instances[1].schema_name).toBe('异常水文事件');

      // Step 3: 生成锚点指纹
      const schemaMap = new Map([
        ['schema_water_event', schemaScores[0].schema],
        ['schema_hydro_event', schemaScores[1].schema]
      ]);

      const instancesWithAnchors = generateAnchorFingerprintsBatch(instances, schemaMap);

      expect(instancesWithAnchors).toHaveLength(2);
      expect(instancesWithAnchors[0].anchor).toBeDefined();
      expect(instancesWithAnchors[1].anchor).toBeDefined();
      // 两个schema应该生成相同的锚点（因为字段值相同）
      expect(instancesWithAnchors[0].anchor).toBe(instancesWithAnchors[1].anchor);

      // Step 4: 按锚点合并为实体
      const entities = mergeInstancesByAnchor(instances, schemaMap);

      expect(entities).toHaveLength(1); // 两个schema合并为一个实体
      expect(entities[0].schemas).toHaveLength(2);
      expect(entities[0].entity_type).toBe('EventEntity');
      expect(entities[0].anchor_fingerprint).toContain('EventEntity');
      expect(entities[0].confidence).toBeGreaterThan(0.8); // 多schema支撑，置信度提升
      expect(entities[0].supported_by).toEqual(['ckb_001']);
    });

    it('should create separate entities for different anchors', () => {
      const schemaScores = [
        {
          schema: {
            schema_id: 'schema_001',
            schema_name: 'Event Schema',
            entity_type: 'EventEntity',
            anchor_fields: [
              { name: '区域', normalization_strategy: 'location' }
            ]
          },
          score: 0.9
        }
      ];

      // 创建两个不同区域的实例
      const normalizedFields1 = { 区域: '阿里C区' };
      const normalizedFields2 = { 区域: '阿里D区' };

      const ckb = { id: 'ckb_001' };

      const instance1 = createSchemaInstance(schemaScores[0], normalizedFields1, ckb);
      const instance2 = createSchemaInstance(schemaScores[0], normalizedFields2, ckb);

      const schemaMap = new Map([
        ['schema_001', schemaScores[0].schema]
      ]);

      const entities = mergeInstancesByAnchor([instance1, instance2], schemaMap);

      expect(entities).toHaveLength(2); // 不同锚点，生成两个实体
      expect(entities[0].anchor_fingerprint).not.toBe(entities[1].anchor_fingerprint);
    });
  });

  describe('Multi-Schema Overlap Scenarios', () => {
    it('should handle 3+ schemas overlapping at same anchor', () => {
      const schemas = [
        {
          schema_id: 'schema_a',
          schema_name: 'Schema A',
          entity_type: 'EventEntity',
          anchor_fields: [{ name: 'key', normalization_strategy: 'lowercase' }]
        },
        {
          schema_id: 'schema_b',
          schema_name: 'Schema B',
          entity_type: 'EventEntity',
          anchor_fields: [{ name: 'key', normalization_strategy: 'lowercase' }]
        },
        {
          schema_id: 'schema_c',
          schema_name: 'Schema C',
          entity_type: 'EventEntity',
          anchor_fields: [{ name: 'key', normalization_strategy: 'lowercase' }]
        }
      ];

      const instances = schemas.map((schema, i) => ({
        schema_id: schema.schema_id,
        schema_name: schema.schema_name,
        entity_type: schema.entity_type,
        fields: { key: 'same_value' },
        ckb_ids: [`ckb_00${i + 1}`],
        confidence: 0.8 + i * 0.05
      }));

      const schemaMap = new Map(schemas.map(s => [s.schema_id, s]));

      const entities = mergeInstancesByAnchor(instances, schemaMap);

      expect(entities).toHaveLength(1);
      expect(entities[0].schemas).toHaveLength(3);
      expect(entities[0].supported_by).toHaveLength(3);
      expect(entities[0].confidence).toBeGreaterThan(0.9); // 3个schema支撑，高置信度
    });
  });

  describe('Field Merging with Conflicts', () => {
    it('should prioritize high confidence schema fields', () => {
      const schema = {
        schema_id: 'schema_001',
        schema_name: 'Test Schema',
        entity_type: 'TestEntity',
        anchor_fields: [{ name: 'id', normalization_strategy: 'lowercase' }]
      };

      const instances = [
        {
          schema_id: 'schema_001',
          schema_name: 'Test Schema',
          entity_type: 'TestEntity',
          fields: { id: 'test', value: 'low_confidence_value' },
          ckb_ids: ['ckb_001'],
          confidence: 0.6
        },
        {
          schema_id: 'schema_001',
          schema_name: 'Test Schema',
          entity_type: 'TestEntity',
          fields: { id: 'test', value: 'high_confidence_value' },
          ckb_ids: ['ckb_002'],
          confidence: 0.9
        }
      ];

      const schemaMap = new Map([['schema_001', schema]]);

      const entities = mergeInstancesByAnchor(instances, schemaMap);

      expect(entities).toHaveLength(1);
      expect(entities[0].fields.value).toBe('high_confidence_value');
    });
  });

  describe('Statistics and Metrics', () => {
    it('should calculate merge statistics correctly', () => {
      const schema = {
        schema_id: 'schema_001',
        entity_type: 'TestEntity',
        anchor_fields: [{ name: 'key', normalization_strategy: 'lowercase' }]
      };

      const instances = [
        // Entity 1: single schema
        {
          schema_id: 'schema_001',
          entity_type: 'TestEntity',
          fields: { key: 'entity1' },
          ckb_ids: ['ckb_001'],
          confidence: 0.8
        },
        // Entity 2: two schemas (same anchor)
        {
          schema_id: 'schema_001',
          entity_type: 'TestEntity',
          fields: { key: 'entity2' },
          ckb_ids: ['ckb_002'],
          confidence: 0.8
        },
        {
          schema_id: 'schema_001',
          entity_type: 'TestEntity',
          fields: { key: 'entity2' },
          ckb_ids: ['ckb_003'],
          confidence: 0.85
        }
      ];

      const schemaMap = new Map([['schema_001', schema]]);

      const entities = mergeInstancesByAnchor(instances, schemaMap);
      const stats = getMergeStatistics(entities);

      expect(stats.total_entities).toBe(2);
      expect(stats.single_schema_entities).toBe(1);
      expect(stats.multi_schema_entities).toBe(1);
      expect(stats.max_schemas_per_entity).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty instances array', () => {
      const schemaMap = new Map();
      const entities = mergeInstancesByAnchor([], schemaMap);

      expect(entities).toEqual([]);
    });

    it('should handle instances with missing fields', () => {
      const schema = {
        schema_id: 'schema_001',
        entity_type: 'TestEntity',
        anchor_fields: [{ name: 'key', normalization_strategy: 'lowercase' }]
      };

      const instances = [
        {
          schema_id: 'schema_001',
          entity_type: 'TestEntity',
          fields: { key: 'test' }, // 只有锚点字段
          ckb_ids: ['ckb_001'],
          confidence: 0.8
        }
      ];

      const schemaMap = new Map([['schema_001', schema]]);

      const entities = mergeInstancesByAnchor(instances, schemaMap);

      expect(entities).toHaveLength(1);
      expect(entities[0].fields).toEqual({ key: 'test' });
    });
  });

  describe('Real-World Scenario: Water Level Event', () => {
    it('should correctly process water level event from multiple schemas', () => {
      // 模拟真实场景：两个不同的schema都识别出同一个地下水位变化事件
      const waterEventSchema = {
        schema_id: 'water_level_change',
        schema_name: '地下水位变化事件',
        entity_type: 'EventEntity',
        anchor_fields: [
          { name: '区域', normalization_strategy: 'location' },
          { name: '指标', normalization_strategy: 'indicator' },
          { name: '时间', normalization_strategy: 'time_month' }
        ]
      };

      const hydroAnomalySchema = {
        schema_id: 'hydro_anomaly',
        schema_name: '水文异常事件',
        entity_type: 'EventEntity',
        anchor_fields: [
          { name: '区域', normalization_strategy: 'location' },
          { name: '指标', normalization_strategy: 'indicator' },
          { name: '时间', normalization_strategy: 'time_month' }
        ]
      };

      const instances = [
        {
          schema_id: 'water_level_change',
          schema_name: '地下水位变化事件',
          entity_type: 'EventEntity',
          fields: {
            区域: '阿里C区',
            时间: '2025-01-15',
            指标: '地下水位',
            变化: '下降',
            数值: '-10',
            单位: '米'
          },
          ckb_ids: ['ckb_023'],
          confidence: 0.86
        },
        {
          schema_id: 'hydro_anomaly',
          schema_name: '水文异常事件',
          entity_type: 'EventEntity',
          fields: {
            区域: '阿里C区',
            时间: '2025-01',
            指标: '地下水位',
            异常类型: '水位下降',
            严重程度: '中等'
          },
          ckb_ids: ['ckb_023'],
          confidence: 0.72
        }
      ];

      const schemaMap = new Map([
        ['water_level_change', waterEventSchema],
        ['hydro_anomaly', hydroAnomalySchema]
      ]);

      const entities = mergeInstancesByAnchor(instances, schemaMap);

      // 验证：两个schema合并为一个实体
      expect(entities).toHaveLength(1);

      const entity = entities[0];

      // 验证实体属性
      expect(entity.entity_type).toBe('EventEntity');
      expect(entity.schemas).toHaveLength(2);
      expect(entity.schemas.map(s => s.schema_name)).toContain('地下水位变化事件');
      expect(entity.schemas.map(s => s.schema_name)).toContain('水文异常事件');

      // 验证锚点指纹
      expect(entity.anchor_fingerprint).toContain('EventEntity');
      expect(entity.anchor_fingerprint).toContain('c_zone'); // 标准化后的区域
      expect(entity.anchor_fingerprint).toContain('groundwater'); // 标准化后的指标
      expect(entity.anchor_fingerprint).toContain('2025-01'); // 标准化后的时间

      // 验证字段合并（高置信度优先）
      expect(entity.fields['区域']).toBe('阿里C区');
      expect(entity.fields['指标']).toBe('地下水位');
      expect(entity.fields['数值']).toBe('-10'); // 来自高置信度schema
      expect(entity.fields['异常类型']).toBe('水位下降'); // 来自低置信度schema

      // 验证置信度提升（多schema支撑）
      // 平均置信度 (0.86 + 0.72) / 2 = 0.79, 加上2个schema的bonus 0.05 = 0.84
      expect(entity.confidence).toBeCloseTo(0.84, 2);

      // 验证CKB支撑
      expect(entity.supported_by).toEqual(['ckb_023']);
    });
  });
});
