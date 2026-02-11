/**
 * Tests for Anchor Merger
 */

const {
  mergeInstancesByAnchor,
  mergeGroupToEntity,
  mergeFields,
  calculateMergedConfidence,
  generateCanonicalName,
  extractAnchorFields,
  generateEntityId,
  getMergeStatistics
} = require('./anchor_merger');

describe('mergeInstancesByAnchor', () => {
  it('should merge instances with same anchor', () => {
    const instances = [
      {
        schema_id: 'schema_001',
        schema_name: 'Schema A',
        entity_type: 'EventEntity',
        fields: { 区域: '阿里C区', 时间: '2025-01' },
        ckb_ids: ['ckb_001'],
        confidence: 0.9
      },
      {
        schema_id: 'schema_002',
        schema_name: 'Schema B',
        entity_type: 'EventEntity',
        fields: { 区域: '阿里C区', 时间: '2025-01' },
        ckb_ids: ['ckb_002'],
        confidence: 0.8
      }
    ];

    const schemaMap = new Map([
      ['schema_001', {
        schema_id: 'schema_001',
        schema_name: 'Schema A',
        entity_type: 'EventEntity',
        anchor_fields: [
          { name: '区域', normalization_strategy: 'location' },
          { name: '时间', normalization_strategy: 'time_month' }
        ]
      }],
      ['schema_002', {
        schema_id: 'schema_002',
        schema_name: 'Schema B',
        entity_type: 'EventEntity',
        anchor_fields: [
          { name: '区域', normalization_strategy: 'location' },
          { name: '时间', normalization_strategy: 'time_month' }
        ]
      }]
    ]);

    const entities = mergeInstancesByAnchor(instances, schemaMap);

    expect(entities).toHaveLength(1);
    expect(entities[0].schemas).toHaveLength(2);
    expect(entities[0].schemas.map(s => s.schema_name)).toContain('Schema A');
    expect(entities[0].schemas.map(s => s.schema_name)).toContain('Schema B');
    expect(entities[0].supported_by).toEqual(['ckb_001', 'ckb_002']);
  });

  it('should not merge instances with different anchors', () => {
    const instances = [
      {
        schema_id: 'schema_001',
        schema_name: 'Schema A',
        entity_type: 'EventEntity',
        fields: { 区域: '阿里C区' },
        ckb_ids: ['ckb_001'],
        confidence: 0.9
      },
      {
        schema_id: 'schema_001',
        schema_name: 'Schema A',
        entity_type: 'EventEntity',
        fields: { 区域: '阿里D区' },
        ckb_ids: ['ckb_002'],
        confidence: 0.8
      }
    ];

    const schemaMap = new Map([
      ['schema_001', {
        schema_id: 'schema_001',
        entity_type: 'EventEntity',
        anchor_fields: [
          { name: '区域', normalization_strategy: 'location' }
        ]
      }]
    ]);

    const entities = mergeInstancesByAnchor(instances, schemaMap);

    expect(entities).toHaveLength(2);
  });

  it('should throw error if instances is not array', () => {
    expect(() => {
      mergeInstancesByAnchor(null, new Map());
    }).toThrow('[AnchorMerger] instances must be an array');
  });

  it('should throw error if schemaMap is not Map', () => {
    expect(() => {
      mergeInstancesByAnchor([], null);
    }).toThrow('[AnchorMerger] schemaMap must be a Map');
  });

  it('should skip instances with missing schema', () => {
    const instances = [
      {
        schema_id: 'nonexistent',
        schema_name: 'Missing',
        entity_type: 'EventEntity',
        fields: { 区域: '阿里C区' },
        ckb_ids: ['ckb_001'],
        confidence: 0.9
      }
    ];

    const schemaMap = new Map();

    const entities = mergeInstancesByAnchor(instances, schemaMap);

    expect(entities).toHaveLength(0);
  });
});

describe('mergeGroupToEntity', () => {
  it('should create entity from group', () => {
    const group = [
      {
        instance: {
          schema_id: 'schema_001',
          schema_name: 'Schema A',
          entity_type: 'EventEntity',
          fields: { 区域: '阿里C区', field1: 'value1' },
          ckb_ids: ['ckb_001'],
          confidence: 0.9
        },
        schema: {
          schema_id: 'schema_001',
          schema_name: 'Schema A',
          entity_type: 'EventEntity',
          anchor_fields: [{ name: '区域' }]
        },
        anchor: 'EventEntity|ali_c_zone'
      }
    ];

    const entity = mergeGroupToEntity('EventEntity|ali_c_zone', group);

    expect(entity.entity_id).toBeDefined();
    expect(entity.entity_type).toBe('EventEntity');
    expect(entity.anchor_fingerprint).toBe('EventEntity|ali_c_zone');
    expect(entity.schemas).toHaveLength(1);
    expect(entity.fields).toEqual({ 区域: '阿里C区', field1: 'value1' });
    expect(entity.supported_by).toEqual(['ckb_001']);
  });

  it('should throw error if group is empty', () => {
    expect(() => {
      mergeGroupToEntity('anchor', []);
    }).toThrow('[AnchorMerger] group cannot be empty');
  });
});

describe('mergeFields', () => {
  it('should merge fields from multiple instances', () => {
    const group = [
      {
        instance: {
          fields: { field1: 'value1', field2: 'value2' },
          confidence: 0.9,
          schema_name: 'Schema A'
        },
        anchor: 'test'
      },
      {
        instance: {
          fields: { field2: 'value2_different', field3: 'value3' },
          confidence: 0.8,
          schema_name: 'Schema B'
        },
        anchor: 'test'
      }
    ];

    const merged = mergeFields(group);

    expect(merged.field1).toBe('value1');
    expect(merged.field2).toBe('value2'); // 高置信度优先
    expect(merged.field3).toBe('value3');
  });

  it('should prioritize high confidence values', () => {
    const group = [
      {
        instance: {
          fields: { name: 'low_confidence' },
          confidence: 0.6,
          schema_name: 'Schema A'
        },
        anchor: 'test'
      },
      {
        instance: {
          fields: { name: 'high_confidence' },
          confidence: 0.9,
          schema_name: 'Schema B'
        },
        anchor: 'test'
      }
    ];

    const merged = mergeFields(group);

    expect(merged.name).toBe('high_confidence');
  });
});

describe('calculateMergedConfidence', () => {
  it('should calculate average confidence for single schema', () => {
    const group = [
      {
        instance: { confidence: 0.8 }
      }
    ];

    const confidence = calculateMergedConfidence(group);

    expect(confidence).toBe(0.8);
  });

  it('should add bonus for multiple schemas', () => {
    const group = [
      { instance: { confidence: 0.8 } },
      { instance: { confidence: 0.8 } }
    ];

    const confidence = calculateMergedConfidence(group);

    expect(confidence).toBeCloseTo(0.85, 2); // 0.8 + 0.05
  });

  it('should cap confidence at 0.99', () => {
    const group = [
      { instance: { confidence: 0.95 } },
      { instance: { confidence: 0.95 } },
      { instance: { confidence: 0.95 } },
      { instance: { confidence: 0.95 } }
    ];

    const confidence = calculateMergedConfidence(group);

    expect(confidence).toBe(0.99);
  });
});

describe('generateCanonicalName', () => {
  it('should use name field if available', () => {
    const fields = { name: 'Test Name', other: 'value' };
    const schema = { schema_name: 'Schema' };

    const name = generateCanonicalName(fields, schema);

    expect(name).toBe('Test Name');
  });

  it('should use 名称 field if available', () => {
    const fields = { 名称: '测试名称', other: 'value' };
    const schema = { schema_name: 'Schema' };

    const name = generateCanonicalName(fields, schema);

    expect(name).toBe('测试名称');
  });

  it('should generate name from anchor fields', () => {
    const fields = { 区域: '阿里C区', 时间: '2025-01' };
    const schema = {
      schema_name: 'Event',
      anchor_fields: [
        { name: '区域' },
        { name: '时间' }
      ]
    };

    const name = generateCanonicalName(fields, schema);

    expect(name).toBe('Event_阿里C区_2025-01');
  });

  it('should fallback to schema name', () => {
    const fields = {};
    const schema = { schema_name: 'Schema Name' };

    const name = generateCanonicalName(fields, schema);

    expect(name).toBe('Schema Name');
  });
});

describe('extractAnchorFields', () => {
  it('should extract anchor fields from merged fields', () => {
    const anchor = 'EventEntity|ali_c_zone|2025-01';
    const schema = {
      anchor_fields: [
        { name: '区域' },
        { name: '时间' }
      ]
    };
    const fields = {
      区域: '阿里C区',
      时间: '2025-01',
      其他: '不应包含'
    };

    const anchorFields = extractAnchorFields(anchor, schema, fields);

    expect(anchorFields).toEqual({
      区域: '阿里C区',
      时间: '2025-01'
    });
    expect(anchorFields['其他']).toBeUndefined();
  });

  it('should handle string anchor field configs', () => {
    const anchor = 'test';
    const schema = {
      anchor_fields: ['field1', 'field2']
    };
    const fields = {
      field1: 'value1',
      field2: 'value2',
      field3: 'value3'
    };

    const anchorFields = extractAnchorFields(anchor, schema, fields);

    expect(anchorFields).toEqual({
      field1: 'value1',
      field2: 'value2'
    });
  });
});

describe('generateEntityId', () => {
  it('should generate deterministic entity ID', () => {
    const anchor = 'EventEntity|ali_c_zone|groundwater_level|2025-01';

    const id1 = generateEntityId(anchor);
    const id2 = generateEntityId(anchor);

    expect(id1).toBe(id2);
    expect(id1).toMatch(/^entity_[a-f0-9]{16}$/);
  });

  it('should generate different IDs for different anchors', () => {
    const anchor1 = 'EventEntity|ali_c_zone|2025-01';
    const anchor2 = 'EventEntity|ali_d_zone|2025-01';

    const id1 = generateEntityId(anchor1);
    const id2 = generateEntityId(anchor2);

    expect(id1).not.toBe(id2);
  });
});

describe('getMergeStatistics', () => {
  it('should calculate merge statistics', () => {
    const entities = [
      {
        schemas: [{ schema_name: 'A' }],
        confidence: 0.8
      },
      {
        schemas: [{ schema_name: 'A' }, { schema_name: 'B' }],
        confidence: 0.85
      },
      {
        schemas: [{ schema_name: 'A' }, { schema_name: 'B' }, { schema_name: 'C' }],
        confidence: 0.9
      }
    ];

    const stats = getMergeStatistics(entities);

    expect(stats.total_entities).toBe(3);
    expect(stats.single_schema_entities).toBe(1);
    expect(stats.multi_schema_entities).toBe(2);
    expect(stats.max_schemas_per_entity).toBe(3);
    expect(stats.avg_schemas_per_entity).toBe(2); // (1+2+3)/3
    expect(stats.avg_confidence).toBeCloseTo(0.85, 2);
  });

  it('should handle empty entities array', () => {
    const stats = getMergeStatistics([]);

    expect(stats.total_entities).toBe(0);
    expect(stats.avg_schemas_per_entity).toBe(0);
    expect(stats.avg_confidence).toBe(0);
  });
});
