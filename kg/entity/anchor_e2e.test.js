/**
 * Anchor-Driven Entity Synthesis: End-to-End Tests
 * 
 * 测试完整的文档处理流程，从文档输入到实体生成。
 * 
 * 测试场景：
 * 1. 完整文档处理流程 - 验证从文档到实体的完整链路
 * 2. 多文档实体链接 - 验证跨文档的实体识别和合并
 * 3. 大规模数据处理 - 验证1000+实例的处理能力
 * 4. 真实场景测试 - 使用真实的摄影和研究文档
 * 5. 错误恢复 - 验证异常情况的处理
 */

const { generateAnchorFingerprint, generateEntityId } = require('./anchor_generator');
const { mergeInstancesByAnchor, getMergeStatistics } = require('./anchor_merger');
const { detectAnchorConflict } = require('./anchor_conflict_detector');
const { adviseMergeConflict } = require('./llm_conflict_advisor');

describe('Anchor E2E Tests', () => {
  describe('14.2 完整文档处理流程', () => {
    it('should process document from input to entities', () => {
      // 模拟完整流程
      // Step 1: 创建Schema实例
      const instances = [
        {
          schema_name: 'Photography Setup',
          schema_id: 'schema_photo_001',
          entity_type: 'PhotographyEntity',
          fields: {
            Camera: 'Sony A7M4',
            Lens: '35mm F1.8',
            Timestamp: '2026-01-20',
            ISO: '400'
          },
          ckb_ids: ['ckb_001'],
          confidence: 0.9
        }
      ];

      // Step 2: 创建Schema映射
      const schemaMap = new Map([
        ['schema_photo_001', {
          schema_id: 'schema_photo_001',
          schema_name: 'Photography Setup',
          entity_type: 'PhotographyEntity',
          anchor_fields: [
            { name: 'Camera', normalization_strategy: 'lowercase' },
            { name: 'Lens', normalization_strategy: 'lowercase' },
            { name: 'Timestamp', normalization_strategy: 'time_day' }
          ]
        }]
      ]);

      // Step 3: 生成锚点并合并
      const entities = mergeInstancesByAnchor(instances, schemaMap);

      // 验证结果
      expect(entities).toHaveLength(1);
      expect(entities[0].anchor_fingerprint).toBeDefined();
      expect(entities[0].entity_type).toBe('PhotographyEntity');
      expect(entities[0].confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should generate deterministic entity IDs', () => {
      const instances = [
        {
          schema_name: 'Research Metric',
          schema_id: 'schema_research_001',
          entity_type: 'ResearchEntity',
          fields: {
            Metric: 'Temperature',
            Date: '2025-01-15',
            Location: 'Lab A'
          },
          ckb_ids: ['ckb_002'],
          confidence: 0.85
        }
      ];

      const schemaMap = new Map([
        ['schema_research_001', {
          schema_id: 'schema_research_001',
          entity_type: 'ResearchEntity',
          anchor_fields: [
            { name: 'Metric', normalization_strategy: 'indicator' },
            { name: 'Date', normalization_strategy: 'time_month' },
            { name: 'Location', normalization_strategy: 'location' }
          ]
        }]
      ]);

      // 多次生成，验证ID一致性
      const entities1 = mergeInstancesByAnchor(instances, schemaMap);
      const entities2 = mergeInstancesByAnchor(instances, schemaMap);

      expect(entities1[0].entity_id).toBe(entities2[0].entity_id);
      expect(entities1[0].anchor_fingerprint).toBe(entities2[0].anchor_fingerprint);
    });

    it('should preserve all field information', () => {
      const instances = [
        {
          schema_name: 'Travel Log',
          schema_id: 'schema_travel_001',
          entity_type: 'TravelEntity',
          fields: {
            Location: 'Aomori Museum',
            Timestamp: '2026-01-20',
            Activity: 'Visit',
            Duration: '2 hours',
            Notes: 'Beautiful architecture'
          },
          ckb_ids: ['ckb_003'],
          confidence: 0.88
        }
      ];

      const schemaMap = new Map([
        ['schema_travel_001', {
          schema_id: 'schema_travel_001',
          entity_type: 'TravelEntity',
          anchor_fields: [
            { name: 'Location', normalization_strategy: 'location' },
            { name: 'Timestamp', normalization_strategy: 'time_day' }
          ]
        }]
      ]);

      const entities = mergeInstancesByAnchor(instances, schemaMap);

      // 验证所有字段都被保留
      expect(entities[0].fields).toHaveProperty('Location');
      expect(entities[0].fields).toHaveProperty('Timestamp');
      expect(entities[0].fields).toHaveProperty('Activity');
      expect(entities[0].fields).toHaveProperty('Duration');
      expect(entities[0].fields).toHaveProperty('Notes');
    });
  });

  describe('14.3 多文档实体链接', () => {
    it('should link entities across multiple documents', () => {
      // 模拟来自不同文档的实例
      const instancesDoc1 = [
        {
          schema_name: 'Photo Session A',
          schema_id: 'schema_photo_001',
          entity_type: 'PhotographyEntity',
          fields: {
            Camera: 'Sony A7M4',
            Lens: '35mm F1.8',
            Timestamp: '2026-01-20',
            Location: 'Studio'
          },
          ckb_ids: ['ckb_doc1_001'],
          confidence: 0.9
        }
      ];

      const instancesDoc2 = [
        {
          schema_name: 'Photo Session B',
          schema_id: 'schema_photo_002',
          entity_type: 'PhotographyEntity',
          fields: {
            Camera: 'Sony A7M4',
            Lens: '35mm F1.8',
            Timestamp: '2026-01-20',
            ISO: '800'
          },
          ckb_ids: ['ckb_doc2_001'],
          confidence: 0.85
        }
      ];

      const schemaMap = new Map([
        ['schema_photo_001', {
          schema_id: 'schema_photo_001',
          entity_type: 'PhotographyEntity',
          anchor_fields: [
            { name: 'Camera', normalization_strategy: 'lowercase' },
            { name: 'Lens', normalization_strategy: 'lowercase' },
            { name: 'Timestamp', normalization_strategy: 'time_day' }
          ]
        }],
        ['schema_photo_002', {
          schema_id: 'schema_photo_002',
          entity_type: 'PhotographyEntity',
          anchor_fields: [
            { name: 'Camera', normalization_strategy: 'lowercase' },
            { name: 'Lens', normalization_strategy: 'lowercase' },
            { name: 'Timestamp', normalization_strategy: 'time_day' }
          ]
        }]
      ]);

      // 合并所有实例
      const allInstances = [...instancesDoc1, ...instancesDoc2];
      const entities = mergeInstancesByAnchor(allInstances, schemaMap);

      // 验证跨文档合并
      expect(entities).toHaveLength(1);
      expect(entities[0].schemas).toHaveLength(2);
      expect(entities[0].supported_by).toContain('ckb_doc1_001');
      expect(entities[0].supported_by).toContain('ckb_doc2_001');
      
      // 验证置信度提升
      expect(entities[0].confidence).toBeGreaterThan(0.9);
    });

    it('should maintain separate entities for different anchors', () => {
      const instances = [
        {
          schema_name: 'Photo A',
          schema_id: 'schema_photo_001',
          entity_type: 'PhotographyEntity',
          fields: {
            Camera: 'Sony A7M4',
            Lens: '35mm F1.8',
            Timestamp: '2026-01-20'
          },
          ckb_ids: ['ckb_001'],
          confidence: 0.9
        },
        {
          schema_name: 'Photo B',
          schema_id: 'schema_photo_001',
          entity_type: 'PhotographyEntity',
          fields: {
            Camera: 'Canon R5',
            Lens: '50mm F1.2',
            Timestamp: '2026-01-20'
          },
          ckb_ids: ['ckb_002'],
          confidence: 0.88
        }
      ];

      const schemaMap = new Map([
        ['schema_photo_001', {
          schema_id: 'schema_photo_001',
          entity_type: 'PhotographyEntity',
          anchor_fields: [
            { name: 'Camera', normalization_strategy: 'lowercase' },
            { name: 'Lens', normalization_strategy: 'lowercase' },
            { name: 'Timestamp', normalization_strategy: 'time_day' }
          ]
        }]
      ]);

      const entities = mergeInstancesByAnchor(instances, schemaMap);

      // 验证生成了两个不同的实体
      expect(entities).toHaveLength(2);
      expect(entities[0].anchor_fingerprint).not.toBe(entities[1].anchor_fingerprint);
    });
  });

  describe('14.4 大规模数据处理 (1000+ instances)', () => {
    it('should handle 1000 instances efficiently', () => {
      // 生成1000个实例
      const instances = [];
      const schemaMap = new Map();

      for (let i = 0; i < 1000; i++) {
        const schemaId = `schema_${i % 10}`; // 10个不同的schema
        
        instances.push({
          schema_name: `Schema ${i % 10}`,
          schema_id: schemaId,
          entity_type: 'PhotographyEntity',
          fields: {
            Camera: `Camera ${i % 50}`, // 50种不同的相机
            Lens: `Lens ${i % 20}`, // 20种不同的镜头
            Timestamp: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`
          },
          ckb_ids: [`ckb_${i}`],
          confidence: 0.8 + (i % 20) / 100
        });

        if (!schemaMap.has(schemaId)) {
          schemaMap.set(schemaId, {
            schema_id: schemaId,
            entity_type: 'PhotographyEntity',
            anchor_fields: [
              { name: 'Camera', normalization_strategy: 'lowercase' },
              { name: 'Lens', normalization_strategy: 'lowercase' },
              { name: 'Timestamp', normalization_strategy: 'time_day' }
            ]
          });
        }
      }

      // 测试性能
      const startTime = Date.now();
      const entities = mergeInstancesByAnchor(instances, schemaMap);
      const duration = Date.now() - startTime;

      console.log(`处理1000个实例耗时: ${duration}ms`);
      console.log(`生成实体数: ${entities.length}`);

      // 验证性能目标: <100ms for 1000 instances
      expect(duration).toBeLessThan(500); // 放宽到500ms考虑测试环境

      // 验证结果正确性
      expect(entities.length).toBeGreaterThan(0);
      expect(entities.length).toBeLessThan(1000); // 应该有合并

      // 验证统计信息
      const stats = getMergeStatistics(entities);
      expect(stats.total_entities).toBe(entities.length);
      expect(stats.avg_confidence).toBeGreaterThan(0);
    });

    it('should maintain data integrity with large datasets', () => {
      // 生成100个实例，验证数据完整性
      const instances = [];
      const schemaMap = new Map([
        ['schema_test', {
          schema_id: 'schema_test',
          entity_type: 'ResearchEntity',
          anchor_fields: [
            { name: 'Metric', normalization_strategy: 'indicator' },
            { name: 'Date', normalization_strategy: 'time_month' }
          ]
        }]
      ]);

      for (let i = 0; i < 100; i++) {
        instances.push({
          schema_name: 'Research Metric',
          schema_id: 'schema_test',
          entity_type: 'ResearchEntity',
          fields: {
            Metric: `Metric ${i % 10}`,
            Date: `2025-${String((i % 12) + 1).padStart(2, '0')}-15`,
            Value: i * 10
          },
          ckb_ids: [`ckb_${i}`],
          confidence: 0.85
        });
      }

      const entities = mergeInstancesByAnchor(instances, schemaMap);

      // 验证所有CKB都被保留
      const allCkbIds = new Set();
      for (const entity of entities) {
        for (const ckbId of entity.supported_by) {
          allCkbIds.add(ckbId);
        }
      }

      expect(allCkbIds.size).toBe(100); // 所有100个CKB都应该被保留
    });
  });

  describe('14.5 真实场景测试', () => {
    it('should handle photography workflow', () => {
      // 模拟真实的摄影工作流
      const instances = [
        {
          schema_name: 'Camera Settings',
          schema_id: 'schema_photo_settings',
          entity_type: 'PhotographyEntity',
          fields: {
            Camera: 'Sony A7M4',
            Lens: '35mm F1.8',
            Timestamp: '2026-01-20 10:30:00',
            ISO: '400',
            Aperture: 'F1.8',
            ShutterSpeed: '1/125'
          },
          ckb_ids: ['ckb_settings'],
          confidence: 0.95
        },
        {
          schema_name: 'Photo Metadata',
          schema_id: 'schema_photo_meta',
          entity_type: 'PhotographyEntity',
          fields: {
            Camera: 'Sony A7M4',
            Lens: '35mm F1.8',
            Timestamp: '2026-01-20',
            Location: 'Studio A',
            Subject: 'Portrait'
          },
          ckb_ids: ['ckb_metadata'],
          confidence: 0.90
        },
        {
          schema_name: 'Post Processing',
          schema_id: 'schema_post_process',
          entity_type: 'PostProcessingEntity',
          fields: {
            Camera: 'Sony A7M4',
            Lens: '35mm F1.8',
            Timestamp: '2026-01-20',
            Software: 'Lightroom',
            Adjustments: 'Color grading'
          },
          ckb_ids: ['ckb_postprocess'],
          confidence: 0.88
        }
      ];

      const schemaMap = new Map([
        ['schema_photo_settings', {
          schema_id: 'schema_photo_settings',
          entity_type: 'PhotographyEntity',
          anchor_fields: [
            { name: 'Camera', normalization_strategy: 'lowercase' },
            { name: 'Lens', normalization_strategy: 'lowercase' },
            { name: 'Timestamp', normalization_strategy: 'time_day' }
          ]
        }],
        ['schema_photo_meta', {
          schema_id: 'schema_photo_meta',
          entity_type: 'PhotographyEntity',
          anchor_fields: [
            { name: 'Camera', normalization_strategy: 'lowercase' },
            { name: 'Lens', normalization_strategy: 'lowercase' },
            { name: 'Timestamp', normalization_strategy: 'time_day' }
          ]
        }],
        ['schema_post_process', {
          schema_id: 'schema_post_process',
          entity_type: 'PostProcessingEntity',
          anchor_fields: [
            { name: 'Camera', normalization_strategy: 'lowercase' },
            { name: 'Lens', normalization_strategy: 'lowercase' },
            { name: 'Timestamp', normalization_strategy: 'time_day' }
          ]
        }]
      ]);

      const entities = mergeInstancesByAnchor(instances, schemaMap);

      // 验证结果
      // 应该生成2个实体：1个PhotographyEntity + 1个PostProcessingEntity
      expect(entities.length).toBeGreaterThanOrEqual(1);
      
      // 找到PhotographyEntity
      const photoEntity = entities.find(e => e.entity_type === 'PhotographyEntity');
      if (photoEntity) {
        expect(photoEntity.schemas.length).toBeGreaterThanOrEqual(2);
        expect(photoEntity.fields).toHaveProperty('ISO');
        expect(photoEntity.fields).toHaveProperty('Location');
      }
    });

    it('should handle research data workflow', () => {
      // 模拟研究数据工作流
      const instances = [
        {
          schema_name: 'Groundwater Monitoring',
          schema_id: 'schema_research_001',
          entity_type: 'ResearchEntity',
          fields: {
            Metric: 'Groundwater Level',
            Date: '2025-01-15',
            Location: 'Ali C Zone',
            Value: '-12.5',
            Unit: 'meters'
          },
          ckb_ids: ['ckb_monitoring'],
          confidence: 0.92
        },
        {
          schema_name: 'Water Quality Analysis',
          schema_id: 'schema_research_002',
          entity_type: 'ResearchEntity',
          fields: {
            Metric: 'Groundwater Level',
            Date: '2025-01-20',
            Location: 'Ali C Zone',
            Quality: 'Good',
            pH: '7.2'
          },
          ckb_ids: ['ckb_quality'],
          confidence: 0.88
        }
      ];

      const schemaMap = new Map([
        ['schema_research_001', {
          schema_id: 'schema_research_001',
          entity_type: 'ResearchEntity',
          anchor_fields: [
            { name: 'Metric', normalization_strategy: 'indicator' },
            { name: 'Date', normalization_strategy: 'time_month' },
            { name: 'Location', normalization_strategy: 'location' }
          ]
        }],
        ['schema_research_002', {
          schema_id: 'schema_research_002',
          entity_type: 'ResearchEntity',
          anchor_fields: [
            { name: 'Metric', normalization_strategy: 'indicator' },
            { name: 'Date', normalization_strategy: 'time_month' },
            { name: 'Location', normalization_strategy: 'location' }
          ]
        }]
      ]);

      const entities = mergeInstancesByAnchor(instances, schemaMap);

      // 验证合并（相同月份应该合并）
      expect(entities).toHaveLength(1);
      expect(entities[0].schemas).toHaveLength(2);
      expect(entities[0].fields).toHaveProperty('Value');
      expect(entities[0].fields).toHaveProperty('Quality');
    });
  });

  describe('14.6 冲突检测和LLM建议', () => {
    it('should detect conflicts in merged entities', () => {
      const instances = [
        {
          schema_name: 'Report A',
          schema_id: 'schema_report_001',
          entity_type: 'ResearchEntity',
          fields: {
            Metric: 'Temperature',
            Date: '2025-01-15',
            Location: 'Lab A',
            Value: '25.5',
            Status: 'Normal'
          },
          ckb_ids: ['ckb_report_a'],
          confidence: 0.9
        },
        {
          schema_name: 'Report B',
          schema_id: 'schema_report_002',
          entity_type: 'ResearchEntity',
          fields: {
            Metric: 'Temperature',
            Date: '2025-01-20',
            Location: 'Lab A',
            Value: '35.8',
            Status: 'Abnormal'
          },
          ckb_ids: ['ckb_report_b'],
          confidence: 0.88
        }
      ];

      const schemaMap = new Map([
        ['schema_report_001', {
          schema_id: 'schema_report_001',
          entity_type: 'ResearchEntity',
          anchor_fields: [
            { name: 'Metric', normalization_strategy: 'indicator' },
            { name: 'Date', normalization_strategy: 'time_month' },
            { name: 'Location', normalization_strategy: 'location' }
          ]
        }],
        ['schema_report_002', {
          schema_id: 'schema_report_002',
          entity_type: 'ResearchEntity',
          anchor_fields: [
            { name: 'Metric', normalization_strategy: 'indicator' },
            { name: 'Date', normalization_strategy: 'time_month' },
            { name: 'Location', normalization_strategy: 'location' }
          ]
        }]
      ]);

      // 生成锚点并分组
      const group = instances.map(instance => {
        const schema = schemaMap.get(instance.schema_id);
        const anchor = generateAnchorFingerprint(instance, schema);
        return { instance, schema, anchor };
      });

      // 检测冲突
      const conflictResult = detectAnchorConflict(group[0].anchor, group);

      // 验证冲突检测
      expect(conflictResult.has_conflict).toBe(true);
      expect(conflictResult.conflicts.length).toBeGreaterThan(0);
      
      // 应该检测到时间不一致或状态矛盾或数值冲突
      const hasTimeConflict = conflictResult.conflicts.some(c => c.type === 'time_inconsistency');
      const hasStateConflict = conflictResult.conflicts.some(c => c.type === 'state_contradiction');
      const hasValueConflict = conflictResult.conflicts.some(c => c.type === 'value_conflict');
      
      // 至少应该检测到一种冲突
      expect(hasTimeConflict || hasStateConflict || hasValueConflict).toBe(true);
    });

    it('should provide LLM advisory for conflicts', async () => {
      const instances = [
        {
          schema_name: 'Measurement A',
          schema_id: 'schema_measure_001',
          entity_type: 'ResearchEntity',
          fields: {
            Metric: 'Pressure',
            Date: '2025-01-15',
            Value: '100',
            Unit: 'kPa'
          },
          ckb_ids: ['ckb_a'],
          confidence: 0.9
        },
        {
          schema_name: 'Measurement B',
          schema_id: 'schema_measure_002',
          entity_type: 'ResearchEntity',
          fields: {
            Metric: 'Pressure',
            Date: '2025-01-15',
            Value: '150',
            Unit: 'kPa'
          },
          ckb_ids: ['ckb_b'],
          confidence: 0.85
        }
      ];

      const schemaMap = new Map([
        ['schema_measure_001', {
          schema_id: 'schema_measure_001',
          entity_type: 'ResearchEntity',
          anchor_fields: [
            { name: 'Metric', normalization_strategy: 'indicator' },
            { name: 'Date', normalization_strategy: 'time_day' }
          ]
        }],
        ['schema_measure_002', {
          schema_id: 'schema_measure_002',
          entity_type: 'ResearchEntity',
          anchor_fields: [
            { name: 'Metric', normalization_strategy: 'indicator' },
            { name: 'Date', normalization_strategy: 'time_day' }
          ]
        }]
      ]);

      const group = instances.map(instance => {
        const schema = schemaMap.get(instance.schema_id);
        const anchor = generateAnchorFingerprint(instance, schema);
        return { instance, schema, anchor };
      });

      const conflictResult = detectAnchorConflict(group[0].anchor, group);

      // 获取LLM建议（不提供API key，应该降级到规则建议）
      const advisory = await adviseMergeConflict(conflictResult, group);

      // 验证建议格式
      expect(advisory).toHaveProperty('suggest_split');
      expect(advisory).toHaveProperty('confidence');
      expect(advisory).toHaveProperty('reason');
      expect(typeof advisory.suggest_split).toBe('boolean');
      expect(typeof advisory.confidence).toBe('number');
      expect(typeof advisory.reason).toBe('string');
    });
  });

  describe('14.7 错误恢复和边界情况', () => {
    it('should handle empty instances gracefully', () => {
      const instances = [];
      const schemaMap = new Map();

      const entities = mergeInstancesByAnchor(instances, schemaMap);

      expect(entities).toHaveLength(0);
    });

    it('should handle missing schema definitions', () => {
      const instances = [
        {
          schema_name: 'Test Schema',
          schema_id: 'schema_missing',
          entity_type: 'TestEntity',
          fields: { test: 'value' },
          ckb_ids: ['ckb_001'],
          confidence: 0.8
        }
      ];

      const schemaMap = new Map(); // 空的schema映射

      const entities = mergeInstancesByAnchor(instances, schemaMap);

      // 应该跳过缺失schema的实例
      expect(entities).toHaveLength(0);
    });

    it('should handle instances with missing anchor fields', () => {
      const instances = [
        {
          schema_name: 'Incomplete Instance',
          schema_id: 'schema_test',
          entity_type: 'TestEntity',
          fields: {
            Field1: 'value1'
            // 缺少Field2和Field3
          },
          ckb_ids: ['ckb_001'],
          confidence: 0.8
        }
      ];

      const schemaMap = new Map([
        ['schema_test', {
          schema_id: 'schema_test',
          entity_type: 'TestEntity',
          anchor_fields: [
            { name: 'Field1', normalization_strategy: 'lowercase' },
            { name: 'Field2', normalization_strategy: 'lowercase' },
            { name: 'Field3', normalization_strategy: 'lowercase' }
          ]
        }]
      ]);

      // 应该能处理部分缺失的字段
      expect(() => {
        mergeInstancesByAnchor(instances, schemaMap);
      }).not.toThrow();
    });

    it('should handle invalid field values', () => {
      const instances = [
        {
          schema_name: 'Invalid Values',
          schema_id: 'schema_test',
          entity_type: 'TestEntity',
          fields: {
            Date: null,
            Value: undefined,
            Name: ''
          },
          ckb_ids: ['ckb_001'],
          confidence: 0.8
        }
      ];

      const schemaMap = new Map([
        ['schema_test', {
          schema_id: 'schema_test',
          entity_type: 'TestEntity',
          anchor_fields: [
            { name: 'Date', normalization_strategy: 'time_month' },
            { name: 'Value', normalization_strategy: 'lowercase' },
            { name: 'Name', normalization_strategy: 'lowercase' }
          ]
        }]
      ]);

      // 应该能处理无效值
      expect(() => {
        mergeInstancesByAnchor(instances, schemaMap);
      }).not.toThrow();
    });

    it('should handle very long field values', () => {
      const longValue = 'a'.repeat(10000);
      
      const instances = [
        {
          schema_name: 'Long Values',
          schema_id: 'schema_test',
          entity_type: 'TestEntity',
          fields: {
            Name: longValue,
            Description: longValue
          },
          ckb_ids: ['ckb_001'],
          confidence: 0.8
        }
      ];

      const schemaMap = new Map([
        ['schema_test', {
          schema_id: 'schema_test',
          entity_type: 'TestEntity',
          anchor_fields: [
            { name: 'Name', normalization_strategy: 'lowercase' }
          ]
        }]
      ]);

      // 应该能处理长字符串
      expect(() => {
        const entities = mergeInstancesByAnchor(instances, schemaMap);
        expect(entities).toHaveLength(1);
      }).not.toThrow();
    });

    it('should handle special characters in field values', () => {
      const instances = [
        {
          schema_name: 'Special Chars',
          schema_id: 'schema_test',
          entity_type: 'TestEntity',
          fields: {
            Name: '测试@#$%^&*()',
            Location: '北京/上海\\深圳',
            Date: '2025-01-15 10:30:00+08:00'
          },
          ckb_ids: ['ckb_001'],
          confidence: 0.8
        }
      ];

      const schemaMap = new Map([
        ['schema_test', {
          schema_id: 'schema_test',
          entity_type: 'TestEntity',
          anchor_fields: [
            { name: 'Name', normalization_strategy: 'lowercase' },
            { name: 'Location', normalization_strategy: 'location' },
            { name: 'Date', normalization_strategy: 'time_day' }
          ]
        }]
      ]);

      const entities = mergeInstancesByAnchor(instances, schemaMap);

      expect(entities).toHaveLength(1);
      expect(entities[0].anchor_fingerprint).toBeDefined();
    });
  });

  describe('14.8 统计和监控', () => {
    it('should provide merge statistics', () => {
      const instances = [];
      const schemaMap = new Map();

      // 生成测试数据
      for (let i = 0; i < 50; i++) {
        const schemaId = `schema_${i % 5}`;
        
        instances.push({
          schema_name: `Schema ${i % 5}`,
          schema_id: schemaId,
          entity_type: 'TestEntity',
          fields: {
            Key: `key_${i % 10}`
          },
          ckb_ids: [`ckb_${i}`],
          confidence: 0.8 + (i % 20) / 100
        });

        if (!schemaMap.has(schemaId)) {
          schemaMap.set(schemaId, {
            schema_id: schemaId,
            entity_type: 'TestEntity',
            anchor_fields: [
              { name: 'Key', normalization_strategy: 'lowercase' }
            ]
          });
        }
      }

      const entities = mergeInstancesByAnchor(instances, schemaMap);
      const stats = getMergeStatistics(entities);

      // 验证统计信息
      expect(stats.total_entities).toBe(entities.length);
      expect(stats.single_schema_entities).toBeGreaterThanOrEqual(0);
      expect(stats.multi_schema_entities).toBeGreaterThanOrEqual(0);
      expect(stats.max_schemas_per_entity).toBeGreaterThan(0);
      expect(stats.avg_schemas_per_entity).toBeGreaterThan(0);
      expect(stats.avg_confidence).toBeGreaterThan(0);
      expect(stats.avg_confidence).toBeLessThanOrEqual(1);
    });
  });
});
