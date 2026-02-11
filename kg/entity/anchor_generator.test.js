/**
 * Tests for Anchor Generator
 */

const {
  generateAnchorFingerprint,
  generateAnchorFingerprintCached,
  generateAnchorFingerprintsBatch,
  generateEntityId,
  inferAnchorFields,
  inferNormalizationStrategy,
  AnchorFingerprintCache,
  globalCache
} = require('./anchor_generator');

describe('generateAnchorFingerprint', () => {
  it('should generate consistent fingerprint for same input', () => {
    const instance = {
      entity_type: 'EventEntity',
      fields: {
        区域: '阿里C区',
        时间: '2025-01-15',
        指标: '地下水位'
      }
    };

    const schema = {
      schema_name: '地下水位变化事件',
      entity_type: 'EventEntity',
      anchor_fields: [
        { name: '区域', normalization_strategy: 'location' },
        { name: '指标', normalization_strategy: 'indicator' },
        { name: '时间', normalization_strategy: 'time_month' }
      ]
    };

    const anchor1 = generateAnchorFingerprint(instance, schema);
    const anchor2 = generateAnchorFingerprint(instance, schema);

    expect(anchor1).toBe(anchor2);
    expect(anchor1).toContain('EventEntity');
  });

  it('should generate different fingerprints for different inputs', () => {
    const schema = {
      entity_type: 'EventEntity',
      anchor_fields: [
        { name: '区域', normalization_strategy: 'location' }
      ]
    };

    const instance1 = {
      fields: { 区域: '阿里C区' }
    };

    const instance2 = {
      fields: { 区域: '阿里D区' }
    };

    const anchor1 = generateAnchorFingerprint(instance1, schema);
    const anchor2 = generateAnchorFingerprint(instance2, schema);

    expect(anchor1).not.toBe(anchor2);
  });

  it('should normalize time to month', () => {
    const instance = {
      fields: { 时间: '2025-01-15' }
    };

    const schema = {
      entity_type: 'EventEntity',
      anchor_fields: [
        { name: '时间', normalization_strategy: 'time_month' }
      ]
    };

    const anchor = generateAnchorFingerprint(instance, schema);

    expect(anchor).toContain('2025-01');
    expect(anchor).not.toContain('2025-01-15');
  });

  it('should normalize location', () => {
    const instance = {
      fields: { 区域: '阿里C区' }
    };

    const schema = {
      entity_type: 'LocationEntity',
      anchor_fields: [
        { name: '区域', normalization_strategy: 'location' }
      ]
    };

    const anchor = generateAnchorFingerprint(instance, schema);

    expect(anchor).toMatch(/LocationEntity\|.*zone/);
  });

  it('should throw error if instance is missing', () => {
    const schema = { entity_type: 'Test', anchor_fields: [] };

    expect(() => {
      generateAnchorFingerprint(null, schema);
    }).toThrow('[AnchorGenerator] instance is required');
  });

  it('should throw error if schema is missing', () => {
    const instance = { fields: {} };

    expect(() => {
      generateAnchorFingerprint(instance, null);
    }).toThrow('[AnchorGenerator] schema is required');
  });

  it('should throw error if no anchor fields defined', () => {
    const instance = { fields: { name: 'value' } };
    const schema = { entity_type: 'Test', schema_name: 'Test', anchor_fields: [] };

    expect(() => {
      generateAnchorFingerprint(instance, schema);
    }).toThrow('No anchor fields defined');
  });

  it('should throw error if all anchor values are empty', () => {
    const instance = { fields: { name: '' } };
    const schema = {
      entity_type: 'Test',
      schema_name: 'Test',
      anchor_fields: [{ name: 'name', normalization_strategy: 'default' }]
    };

    expect(() => {
      generateAnchorFingerprint(instance, schema);
    }).toThrow('All anchor field values are empty');
  });

  it('should use inferAnchorFields if anchor_fields not defined', () => {
    const instance = {
      fields: { 区域: '阿里C区', 时间: '2025-01' }
    };

    const schema = {
      entity_type: 'EventEntity',
      schema_name: 'Test',
      core_fields: [
        { name: '区域', required: true },
        { name: '时间', required: true }
      ]
    };

    const anchor = generateAnchorFingerprint(instance, schema);

    expect(anchor).toContain('EventEntity');
  });
});

describe('inferAnchorFields', () => {
  it('should infer from required core fields', () => {
    const schema = {
      core_fields: [
        { name: '区域', required: true, weight: 0.3 },
        { name: '时间', required: true, weight: 0.2 },
        { name: '指标', required: false, weight: 0.5 }
      ]
    };

    const anchorFields = inferAnchorFields(schema);

    expect(anchorFields).toHaveLength(2);
    expect(anchorFields[0].name).toBe('区域');
    expect(anchorFields[1].name).toBe('时间');
  });

  it('should infer from top weighted fields if no required fields', () => {
    const schema = {
      core_fields: [
        { name: 'field1', weight: 0.5 },
        { name: 'field2', weight: 0.3 },
        { name: 'field3', weight: 0.2 },
        { name: 'field4', weight: 0.1 }
      ]
    };

    const anchorFields = inferAnchorFields(schema);

    expect(anchorFields).toHaveLength(3);
    expect(anchorFields[0].name).toBe('field1');
    expect(anchorFields[1].name).toBe('field2');
    expect(anchorFields[2].name).toBe('field3');
  });

  it('should return empty array if no core fields', () => {
    const schema = {};

    const anchorFields = inferAnchorFields(schema);

    expect(anchorFields).toEqual([]);
  });
});

describe('inferNormalizationStrategy', () => {
  it('should infer time_month for time fields', () => {
    expect(inferNormalizationStrategy('时间')).toBe('time_month');
    expect(inferNormalizationStrategy('Time')).toBe('time_month');
    expect(inferNormalizationStrategy('timestamp')).toBe('time_month');
  });

  it('should infer location for location fields', () => {
    expect(inferNormalizationStrategy('区域')).toBe('location');
    expect(inferNormalizationStrategy('Location')).toBe('location');
    expect(inferNormalizationStrategy('place')).toBe('location');
  });

  it('should infer indicator for indicator fields', () => {
    expect(inferNormalizationStrategy('指标')).toBe('indicator');
    expect(inferNormalizationStrategy('Indicator')).toBe('indicator');
    expect(inferNormalizationStrategy('metric')).toBe('indicator');
  });

  it('should default to lowercase', () => {
    expect(inferNormalizationStrategy('name')).toBe('lowercase');
    expect(inferNormalizationStrategy('value')).toBe('lowercase');
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
    const anchor1 = 'EventEntity|ali_c_zone|groundwater_level|2025-01';
    const anchor2 = 'EventEntity|ali_d_zone|groundwater_level|2025-01';

    const id1 = generateEntityId(anchor1);
    const id2 = generateEntityId(anchor2);

    expect(id1).not.toBe(id2);
  });

  it('should throw error if anchor is missing', () => {
    expect(() => {
      generateEntityId(null);
    }).toThrow('[AnchorGenerator] anchorFingerprint is required');
  });
});

describe('AnchorFingerprintCache', () => {
  let cache;

  beforeEach(() => {
    cache = new AnchorFingerprintCache();
  });

  it('should cache and retrieve anchor fingerprints', () => {
    const schemaId = 'schema_001';
    const fields = { name: 'value' };
    const anchor = 'EventEntity|value';

    cache.set(schemaId, fields, anchor);
    const retrieved = cache.get(schemaId, fields);

    expect(retrieved).toBe(anchor);
  });

  it('should return null for non-existent cache', () => {
    const retrieved = cache.get('nonexistent', {});

    expect(retrieved).toBeNull();
  });

  it('should clear cache', () => {
    cache.set('schema_001', { name: 'value' }, 'anchor');
    expect(cache.size()).toBe(1);

    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('should generate consistent cache keys', () => {
    const key1 = cache.getCacheKey('schema_001', { a: 1, b: 2 });
    const key2 = cache.getCacheKey('schema_001', { a: 1, b: 2 });

    expect(key1).toBe(key2);
  });
});

describe('generateAnchorFingerprintCached', () => {
  beforeEach(() => {
    globalCache.clear();
  });

  it('should use cache on second call', () => {
    const instance = {
      fields: { 区域: '阿里C区' }
    };

    const schema = {
      schema_id: 'schema_001',
      entity_type: 'EventEntity',
      anchor_fields: [
        { name: '区域', normalization_strategy: 'location' }
      ]
    };

    const anchor1 = generateAnchorFingerprintCached(instance, schema);
    const anchor2 = generateAnchorFingerprintCached(instance, schema);

    expect(anchor1).toBe(anchor2);
    expect(globalCache.size()).toBe(1);
  });

  it('should bypass cache when useCache is false', () => {
    const instance = {
      fields: { 区域: '阿里C区' }
    };

    const schema = {
      schema_id: 'schema_001',
      entity_type: 'EventEntity',
      anchor_fields: [
        { name: '区域', normalization_strategy: 'location' }
      ]
    };

    const anchor = generateAnchorFingerprintCached(instance, schema, false);

    expect(anchor).toBeDefined();
    expect(globalCache.size()).toBe(0);
  });
});

describe('generateAnchorFingerprintsBatch', () => {
  it('should generate anchors for multiple instances', () => {
    const instances = [
      {
        schema_id: 'schema_001',
        schema_name: 'Schema A',
        fields: { 区域: '阿里C区' }
      },
      {
        schema_id: 'schema_002',
        schema_name: 'Schema B',
        fields: { 区域: '阿里D区' }
      }
    ];

    const schemaMap = new Map([
      ['schema_001', {
        schema_id: 'schema_001',
        entity_type: 'EventEntity',
        anchor_fields: [{ name: '区域', normalization_strategy: 'location' }]
      }],
      ['schema_002', {
        schema_id: 'schema_002',
        entity_type: 'EventEntity',
        anchor_fields: [{ name: '区域', normalization_strategy: 'location' }]
      }]
    ]);

    const results = generateAnchorFingerprintsBatch(instances, schemaMap);

    expect(results).toHaveLength(2);
    expect(results[0].anchor).toBeDefined();
    expect(results[1].anchor).toBeDefined();
    expect(results[0].anchor).not.toBe(results[1].anchor);
  });

  it('should skip instances with missing schema', () => {
    const instances = [
      {
        schema_id: 'schema_001',
        fields: { 区域: '阿里C区' }
      },
      {
        schema_id: 'nonexistent',
        fields: { 区域: '阿里D区' }
      }
    ];

    const schemaMap = new Map([
      ['schema_001', {
        schema_id: 'schema_001',
        entity_type: 'EventEntity',
        anchor_fields: [{ name: '区域', normalization_strategy: 'location' }]
      }]
    ]);

    const results = generateAnchorFingerprintsBatch(instances, schemaMap);

    expect(results).toHaveLength(1);
  });

  it('should throw error if instances is not array', () => {
    expect(() => {
      generateAnchorFingerprintsBatch(null, new Map());
    }).toThrow('[AnchorGenerator] instances must be an array');
  });

  it('should throw error if schemaMap is not Map', () => {
    expect(() => {
      generateAnchorFingerprintsBatch([], null);
    }).toThrow('[AnchorGenerator] schemaMap must be a Map');
  });
});
