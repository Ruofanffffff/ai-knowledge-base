/**
 * Tests for Schema Instance Manager
 */

const {
  SchemaInstance,
  createSchemaInstance,
  validateSchemaInstance,
  createSchemaInstances
} = require('./schema_instance');

describe('SchemaInstance', () => {
  describe('constructor', () => {
    it('should create a valid schema instance', () => {
      const schema = {
        schema_name: '地下水位变化事件',
        schema_id: 'schema_001',
        entity_type: 'EventEntity'
      };

      const fields = {
        区域: '阿里C区',
        时间: '2025-01',
        指标: '地下水位'
      };

      const ckbIds = ['ckb_001'];
      const confidence = 0.85;

      const instance = new SchemaInstance(schema, fields, ckbIds, confidence);

      expect(instance.schema_name).toBe('地下水位变化事件');
      expect(instance.schema_id).toBe('schema_001');
      expect(instance.entity_type).toBe('EventEntity');
      expect(instance.fields).toEqual(fields);
      expect(instance.ckb_ids).toEqual(['ckb_001']);
      expect(instance.confidence).toBe(0.85);
      expect(instance.created_at).toBeDefined();
    });

    it('should handle single ckbId as string', () => {
      const schema = {
        schema_name: 'Test',
        schema_id: 'test_001',
        entity_type: 'TestEntity'
      };

      const instance = new SchemaInstance(schema, {}, 'ckb_001', 0.8);

      expect(instance.ckb_ids).toEqual(['ckb_001']);
    });

    it('should handle empty fields', () => {
      const schema = {
        schema_name: 'Test',
        schema_id: 'test_001',
        entity_type: 'TestEntity'
      };

      const instance = new SchemaInstance(schema, null, [], 0.8);

      expect(instance.fields).toEqual({});
    });
  });

  describe('getField', () => {
    it('should return field value', () => {
      const schema = {
        schema_name: 'Test',
        schema_id: 'test_001',
        entity_type: 'TestEntity'
      };

      const instance = new SchemaInstance(schema, { name: 'value' }, [], 0.8);

      expect(instance.getField('name')).toBe('value');
    });

    it('should return undefined for non-existent field', () => {
      const schema = {
        schema_name: 'Test',
        schema_id: 'test_001',
        entity_type: 'TestEntity'
      };

      const instance = new SchemaInstance(schema, {}, [], 0.8);

      expect(instance.getField('nonexistent')).toBeUndefined();
    });
  });

  describe('setField', () => {
    it('should set field value', () => {
      const schema = {
        schema_name: 'Test',
        schema_id: 'test_001',
        entity_type: 'TestEntity'
      };

      const instance = new SchemaInstance(schema, {}, [], 0.8);
      instance.setField('name', 'value');

      expect(instance.getField('name')).toBe('value');
    });
  });

  describe('hasField', () => {
    it('should return true for existing field', () => {
      const schema = {
        schema_name: 'Test',
        schema_id: 'test_001',
        entity_type: 'TestEntity'
      };

      const instance = new SchemaInstance(schema, { name: 'value' }, [], 0.8);

      expect(instance.hasField('name')).toBe(true);
    });

    it('should return false for non-existent field', () => {
      const schema = {
        schema_name: 'Test',
        schema_id: 'test_001',
        entity_type: 'TestEntity'
      };

      const instance = new SchemaInstance(schema, {}, [], 0.8);

      expect(instance.hasField('name')).toBe(false);
    });

    it('should return false for null field', () => {
      const schema = {
        schema_name: 'Test',
        schema_id: 'test_001',
        entity_type: 'TestEntity'
      };

      const instance = new SchemaInstance(schema, { name: null }, [], 0.8);

      expect(instance.hasField('name')).toBe(false);
    });
  });

  describe('getFieldNames', () => {
    it('should return all field names', () => {
      const schema = {
        schema_name: 'Test',
        schema_id: 'test_001',
        entity_type: 'TestEntity'
      };

      const fields = { name1: 'value1', name2: 'value2' };
      const instance = new SchemaInstance(schema, fields, [], 0.8);

      expect(instance.getFieldNames()).toEqual(['name1', 'name2']);
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON object', () => {
      const schema = {
        schema_name: 'Test',
        schema_id: 'test_001',
        entity_type: 'TestEntity'
      };

      const fields = { name: 'value' };
      const instance = new SchemaInstance(schema, fields, ['ckb_001'], 0.8);

      const json = instance.toJSON();

      expect(json).toEqual({
        schema_name: 'Test',
        schema_id: 'test_001',
        entity_type: 'TestEntity',
        fields: { name: 'value' },
        ckb_ids: ['ckb_001'],
        confidence: 0.8,
        created_at: instance.created_at
      });
    });
  });
});

describe('createSchemaInstance', () => {
  it('should create instance from schema score', () => {
    const schemaScore = {
      schema: {
        schema_name: '地下水位变化事件',
        schema_id: 'schema_001',
        entity_type: 'EventEntity',
        core_fields: [
          { name: '区域' },
          { name: '时间' },
          { name: '指标' }
        ]
      },
      score: 0.85
    };

    const normalizedFields = {
      区域: '阿里C区',
      时间: '2025-01',
      指标: '地下水位',
      其他字段: '不应包含'
    };

    const ckb = { id: 'ckb_001' };

    const instance = createSchemaInstance(schemaScore, normalizedFields, ckb);

    expect(instance.schema_name).toBe('地下水位变化事件');
    expect(instance.confidence).toBe(0.85);
    expect(instance.fields).toEqual({
      区域: '阿里C区',
      时间: '2025-01',
      指标: '地下水位'
    });
    expect(instance.ckb_ids).toEqual(['ckb_001']);
  });

  it('should use all fields if no core_fields defined', () => {
    const schemaScore = {
      schema: {
        schema_name: 'Test',
        schema_id: 'test_001',
        entity_type: 'TestEntity'
      },
      score: 0.8
    };

    const normalizedFields = {
      field1: 'value1',
      field2: 'value2'
    };

    const ckb = { id: 'ckb_001' };

    const instance = createSchemaInstance(schemaScore, normalizedFields, ckb);

    expect(instance.fields).toEqual(normalizedFields);
  });

  it('should throw error if schemaScore is missing', () => {
    expect(() => {
      createSchemaInstance(null, {}, {});
    }).toThrow('[SchemaInstance] schemaScore and schema are required');
  });

  it('should handle missing ckb', () => {
    const schemaScore = {
      schema: {
        schema_name: 'Test',
        schema_id: 'test_001',
        entity_type: 'TestEntity'
      },
      score: 0.8
    };

    const instance = createSchemaInstance(schemaScore, {}, null);

    expect(instance.ckb_ids).toEqual([]);
  });
});

describe('validateSchemaInstance', () => {
  it('should validate correct instance', () => {
    const schema = {
      schema_name: 'Test',
      schema_id: 'test_001',
      entity_type: 'TestEntity'
    };

    const instance = new SchemaInstance(schema, { name: 'value' }, ['ckb_001'], 0.8);

    const result = validateSchemaInstance(instance);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should detect missing schema_name', () => {
    const instance = {
      schema_id: 'test_001',
      entity_type: 'TestEntity',
      fields: { name: 'value' },
      ckb_ids: [],
      confidence: 0.8
    };

    const result = validateSchemaInstance(instance);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('schema_name is required');
  });

  it('should detect invalid confidence', () => {
    const instance = {
      schema_name: 'Test',
      schema_id: 'test_001',
      entity_type: 'TestEntity',
      fields: { name: 'value' },
      ckb_ids: [],
      confidence: 1.5
    };

    const result = validateSchemaInstance(instance);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('confidence must be a number between 0 and 1');
  });

  it('should detect empty fields', () => {
    const instance = {
      schema_name: 'Test',
      schema_id: 'test_001',
      entity_type: 'TestEntity',
      fields: {},
      ckb_ids: [],
      confidence: 0.8
    };

    const result = validateSchemaInstance(instance);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('fields cannot be empty');
  });
});

describe('createSchemaInstances', () => {
  it('should create multiple instances', () => {
    const schemaScores = [
      {
        schema: {
          schema_name: 'Schema A',
          schema_id: 'schema_a',
          entity_type: 'EventEntity'
        },
        score: 0.9
      },
      {
        schema: {
          schema_name: 'Schema B',
          schema_id: 'schema_b',
          entity_type: 'EventEntity'
        },
        score: 0.8
      }
    ];

    const normalizedFields = { field: 'value' };
    const ckb = { id: 'ckb_001' };

    const instances = createSchemaInstances(schemaScores, normalizedFields, ckb);

    expect(instances).toHaveLength(2);
    expect(instances[0].schema_name).toBe('Schema A');
    expect(instances[1].schema_name).toBe('Schema B');
  });

  it('should skip invalid instances', () => {
    const schemaScores = [
      {
        schema: {
          schema_name: 'Valid',
          schema_id: 'valid',
          entity_type: 'EventEntity'
        },
        score: 0.9
      },
      {
        schema: {
          // Missing schema_id
          schema_name: 'Invalid',
          entity_type: 'EventEntity'
        },
        score: 0.8
      }
    ];

    const normalizedFields = { field: 'value' };
    const ckb = { id: 'ckb_001' };

    const instances = createSchemaInstances(schemaScores, normalizedFields, ckb);

    expect(instances).toHaveLength(1);
    expect(instances[0].schema_name).toBe('Valid');
  });

  it('should throw error if schemaScores is not array', () => {
    expect(() => {
      createSchemaInstances(null, {}, {});
    }).toThrow('[SchemaInstance] schemaScores must be an array');
  });
});
