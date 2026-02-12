/**
 * Built-in Relation Builder Tests
 */

const builtinRelationBuilder = require('./builtin_relation_builder');
const entityStore = require('../entity/entity_store');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Built-in Relation Builder', () => {
  let testEntity;
  let testSchema;
  let testFields;
  
  beforeAll(async () => {
    // Create test entity
    testEntity = {
      entity_id: 'test-entity-' + Date.now(),
      entity_type: 'EventEntity',
      canonical_name: '测试事件_2025-01',
      aliases: [],
      schemas: [{
        schema_name: 'Test Schema',
        confidence: 0.9
      }],
      supported_by: ['ckb-001'],
      attributes: {
        区域: '测试区域',
        时间: '2025-01',
        指标: '水位',
        数值: '10',
        单位: '米'
      },
      confidence: 0.9,
      llm_enriched: false
    };
    
    await entityStore.saveEntity(testEntity);
    
    // Define test schema with relations
    testSchema = {
      schema_name: 'Test Schema',
      entity_type: 'EventEntity',
      relations: [
        {
          type: '发生于',
          target_field: '区域',
          direction: 'outgoing'
        },
        {
          type: '发生时间',
          target_field: '时间',
          direction: 'outgoing'
        }
      ]
    };
    
    // Define test fields
    testFields = [
      { name: '区域', value: '测试区域', type: 'location', confidence: 0.9 },
      { name: '时间', value: '2025-01', type: 'time', confidence: 0.9 },
      { name: '指标', value: '水位', type: 'indicator', confidence: 0.9 },
      { name: '数值', value: '10', type: 'number', confidence: 0.9 },
      { name: '单位', value: '米', type: 'unit', confidence: 0.9 }
    ];
  });
  
  afterAll(async () => {
    // Clean up test data
    try {
      await prisma.kGEntity.deleteMany({
        where: { id: { startsWith: 'test-entity-' } }
      });
      
      await prisma.kGEntity.deleteMany({
        where: { id: { startsWith: 'entity_' } }
      });
    } catch (error) {
      console.log('Cleanup error:', error.message);
    }
    
    await prisma.$disconnect();
  });
  
  describe('buildRelations', () => {
    test('should build relations from schema templates', async () => {
      const relations = await builtinRelationBuilder.buildRelations(
        testEntity,
        testSchema,
        testFields,
        ['ckb-001']
      );
      
      expect(relations).toBeDefined();
      expect(Array.isArray(relations)).toBe(true);
      expect(relations.length).toBeGreaterThan(0);
      
      // Check first relation
      const relation = relations[0];
      expect(relation).toHaveProperty('source_id');
      expect(relation).toHaveProperty('target_id');
      expect(relation).toHaveProperty('type', 'builtin');
      expect(relation).toHaveProperty('confidence', 1.0);
    });
    
    test('should return empty array if schema has no relations', async () => {
      const schemaWithoutRelations = {
        schema_name: 'Simple Schema',
        relations: []
      };
      
      const relations = await builtinRelationBuilder.buildRelations(
        testEntity,
        schemaWithoutRelations,
        testFields
      );
      
      expect(relations).toEqual([]);
    });
    
    test('should handle missing target fields gracefully', async () => {
      const schemaWithMissingField = {
        schema_name: 'Test Schema',
        relations: [
          {
            type: '关联',
            target_field: '不存在的字段',
            direction: 'outgoing'
          }
        ]
      };
      
      const relations = await builtinRelationBuilder.buildRelations(
        testEntity,
        schemaWithMissingField,
        testFields
      );
      
      // Should not throw error, just return empty array
      expect(relations).toEqual([]);
    });
  });
  
  describe('buildRelationFromTemplate', () => {
    test('should build a single relation from template', async () => {
      const relTemplate = {
        type: '发生于',
        target_field: '区域',
        direction: 'outgoing'
      };
      
      const relation = await builtinRelationBuilder.buildRelationFromTemplate(
        testEntity,
        relTemplate,
        testFields,
        ['ckb-001']
      );
      
      expect(relation).toBeDefined();
      expect(relation.source_id).toBe(testEntity.entity_id);
      expect(relation.type).toBe('builtin');
      expect(relation.subtype).toBe('发生于');
      expect(relation.confidence).toBe(1.0);
    });
    
    test('should handle incoming direction', async () => {
      const relTemplate = {
        type: '包含',
        target_field: '区域',
        direction: 'incoming'
      };
      
      const relation = await builtinRelationBuilder.buildRelationFromTemplate(
        testEntity,
        relTemplate,
        testFields,
        ['ckb-001']
      );
      
      expect(relation).toBeDefined();
      // For incoming relations, entity is the target
      expect(relation.target_id).toBe(testEntity.entity_id);
    });
    
    test('should return null if target field not found', async () => {
      const relTemplate = {
        type: '关联',
        target_field: '不存在的字段',
        direction: 'outgoing'
      };
      
      const relation = await builtinRelationBuilder.buildRelationFromTemplate(
        testEntity,
        relTemplate,
        testFields,
        ['ckb-001']
      );
      
      expect(relation).toBeNull();
    });
  });
  
  describe('createSimpleEntity', () => {
    test('should create a simple entity from field', async () => {
      const entity = await builtinRelationBuilder.createSimpleEntity(
        '区域',
        '新测试区域',
        'location'
      );
      
      expect(entity).toBeDefined();
      expect(entity.entity_id).toBeDefined();
      expect(entity.canonical_name).toBe('新测试区域');
      expect(entity.entity_type).toBe('LocationEntity');
      expect(entity.confidence).toBe(0.8);
    });
    
    test('should map field types to entity types correctly', async () => {
      const testCases = [
        { fieldType: 'location', expectedType: 'LocationEntity' },
        { fieldType: 'time', expectedType: 'TimeEntity' },
        { fieldType: 'entity', expectedType: 'GeneralEntity' },
        { fieldType: 'indicator', expectedType: 'IndicatorEntity' },
        { fieldType: 'unknown', expectedType: 'AttributeEntity' }
      ];
      
      for (const testCase of testCases) {
        const entity = await builtinRelationBuilder.createSimpleEntity(
          '测试字段',
          `测试值_${testCase.fieldType}`,
          testCase.fieldType
        );
        
        expect(entity.entity_type).toBe(testCase.expectedType);
      }
    });
  });
  
  describe('buildRelationsBatch', () => {
    test('should build relations for multiple entities', async () => {
      const entity2 = {
        entity_id: 'test-entity-2-' + Date.now(),
        entity_type: 'EventEntity',
        canonical_name: '测试事件2_2025-02',
        aliases: [],
        schemas: [{ schema_name: 'Test Schema', confidence: 0.9 }],
        supported_by: ['ckb-002'],
        attributes: { 区域: '测试区域2', 时间: '2025-02' },
        confidence: 0.9,
        llm_enriched: false
      };
      
      await entityStore.saveEntity(entity2);
      
      const entitiesData = [
        {
          entity: testEntity,
          schema: testSchema,
          fields: testFields,
          ckbIds: ['ckb-001']
        },
        {
          entity: entity2,
          schema: testSchema,
          fields: [
            { name: '区域', value: '测试区域2', type: 'location', confidence: 0.9 },
            { name: '时间', value: '2025-02', type: 'time', confidence: 0.9 }
          ],
          ckbIds: ['ckb-002']
        }
      ];
      
      const allRelations = await builtinRelationBuilder.buildRelationsBatch(entitiesData);
      
      expect(allRelations).toBeDefined();
      expect(Array.isArray(allRelations)).toBe(true);
      expect(allRelations.length).toBeGreaterThan(0);
    });
  });
  
  describe('validateRelation', () => {
    test('should validate valid relation', () => {
      const validRelation = {
        source_id: 'entity-1',
        target_id: 'entity-2',
        type: 'builtin',
        confidence: 0.9
      };
      
      const result = builtinRelationBuilder.validateRelation(validRelation);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
    
    test('should reject relation without source_id', () => {
      const invalidRelation = {
        target_id: 'entity-2',
        type: 'builtin',
        confidence: 0.9
      };
      
      const result = builtinRelationBuilder.validateRelation(invalidRelation);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing source_id or target_id');
    });
    
    test('should reject relation without target_id', () => {
      const invalidRelation = {
        source_id: 'entity-1',
        type: 'builtin',
        confidence: 0.9
      };
      
      const result = builtinRelationBuilder.validateRelation(invalidRelation);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing source_id or target_id');
    });
    
    test('should reject self-referencing relation', () => {
      const selfRelation = {
        source_id: 'entity-1',
        target_id: 'entity-1',
        type: 'builtin',
        confidence: 0.9
      };
      
      const result = builtinRelationBuilder.validateRelation(selfRelation);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Source and target cannot be the same');
    });
    
    test('should reject relation with invalid confidence', () => {
      const invalidConfidence1 = {
        source_id: 'entity-1',
        target_id: 'entity-2',
        type: 'builtin',
        confidence: -0.1
      };
      
      const invalidConfidence2 = {
        source_id: 'entity-1',
        target_id: 'entity-2',
        type: 'builtin',
        confidence: 1.5
      };
      
      const result1 = builtinRelationBuilder.validateRelation(invalidConfidence1);
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Confidence must be between 0 and 1');
      
      const result2 = builtinRelationBuilder.validateRelation(invalidConfidence2);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('Confidence must be between 0 and 1');
    });
  });
  
  describe('findTargetField - Field Alias Support', () => {
    test('should find field by exact name match', () => {
      const fields = [
        { name: '地点', value: '北京市', type: 'location' },
        { name: '时间', value: '2025-01', type: 'time' }
      ];
      
      const result = builtinRelationBuilder.findTargetField(fields, '地点', []);
      
      expect(result).toBeDefined();
      expect(result.name).toBe('地点');
      expect(result.value).toBe('北京市');
    });
    
    test('should find field by alias when exact match not found', () => {
      const fields = [
        { name: '位置', value: '上海市', type: 'location' },
        { name: '时间', value: '2025-01', type: 'time' }
      ];
      
      const result = builtinRelationBuilder.findTargetField(fields, '地点', ['位置', 'location']);
      
      expect(result).toBeDefined();
      expect(result.name).toBe('位置');
      expect(result.value).toBe('上海市');
    });
    
    test('should prioritize exact match over alias', () => {
      const fields = [
        { name: '地点', value: '北京市', type: 'location' },
        { name: '位置', value: '上海市', type: 'location' }
      ];
      
      const result = builtinRelationBuilder.findTargetField(fields, '地点', ['位置']);
      
      expect(result).toBeDefined();
      expect(result.name).toBe('地点');
      expect(result.value).toBe('北京市');
    });
    
    test('should return null when field not found', () => {
      const fields = [
        { name: '时间', value: '2025-01', type: 'time' }
      ];
      
      const result = builtinRelationBuilder.findTargetField(fields, '地点', ['位置']);
      
      expect(result).toBeNull();
    });
    
    test('should extract from content field as fallback', () => {
      const fields = [
        { name: 'content', value: '项目地点：深圳市南山区', type: 'text' }
      ];
      
      const result = builtinRelationBuilder.findTargetField(fields, '地点', []);
      
      expect(result).toBeDefined();
      expect(result.value).toBe('深圳市南山区');
      expect(result.source).toBe('content_extraction');
    });
  });
  
  describe('extractFromContent - Content Extraction', () => {
    test('should extract location from content', () => {
      const content = '项目地点：海南省海口市\n执行单位：某某公司';
      
      const result = builtinRelationBuilder.extractFromContent(content, '地点', []);
      
      expect(result).toBe('海南省海口市');
    });
    
    test('should extract organization from content', () => {
      const content = '执行单位：上海商汤智能科技有限公司\n时间：2025-01';
      
      const result = builtinRelationBuilder.extractFromContent(content, '执行单位', []);
      
      expect(result).toBe('上海商汤智能科技有限公司');
    });
    
    test('should extract using alias patterns', () => {
      const content = '位置：广州市天河区\n时间：2025-01';
      
      const result = builtinRelationBuilder.extractFromContent(content, '地点', ['位置']);
      
      expect(result).toBe('广州市天河区');
    });
    
    test('should return null when pattern not found', () => {
      const content = '这是一段没有特定格式的文本';
      
      const result = builtinRelationBuilder.extractFromContent(content, '地点', []);
      
      expect(result).toBeNull();
    });
    
    test('should handle multiple colons correctly', () => {
      const content = '地点：北京市：朝阳区';
      
      const result = builtinRelationBuilder.extractFromContent(content, '地点', []);
      
      expect(result).toBe('北京市：朝阳区');
    });
  });
  
  describe('buildRelationFromTemplate - With Field Aliases', () => {
    test('should build relation using field alias', async () => {
      const relTemplate = {
        type: 'located_in',
        target_field: '地点',
        field_aliases: ['位置', 'location'],
        direction: 'outgoing'
      };
      
      const fieldsWithAlias = [
        { name: '位置', value: '杭州市', type: 'location', confidence: 0.9 },
        { name: '时间', value: '2025-01', type: 'time', confidence: 0.9 }
      ];
      
      const relation = await builtinRelationBuilder.buildRelationFromTemplate(
        testEntity,
        relTemplate,
        fieldsWithAlias,
        ['ckb-001']
      );
      
      expect(relation).toBeDefined();
      expect(relation.source_id).toBe(testEntity.entity_id);
      expect(relation.type).toBe('builtin');
    });
    
    test('should build relation by extracting from content', async () => {
      const relTemplate = {
        type: 'located_in',
        target_field: '地点',
        field_aliases: ['位置'],
        direction: 'outgoing'
      };
      
      const fieldsWithContent = [
        { name: 'content', value: '项目地点：成都市武侯区', type: 'text' },
        { name: '时间', value: '2025-01', type: 'time', confidence: 0.9 }
      ];
      
      const relation = await builtinRelationBuilder.buildRelationFromTemplate(
        testEntity,
        relTemplate,
        fieldsWithContent,
        ['ckb-001']
      );
      
      expect(relation).toBeDefined();
      expect(relation.source_id).toBe(testEntity.entity_id);
    });
  });
});
