/**
 * Schema Manager Unit Tests
 */

const schemaManager = require('./schema_manager');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Test data
const validSchema = {
  schema_name: 'test_schema',
  entity_type: 'TestEntity',
  core_fields: [
    { name: '区域', weight: 0.3, required: true },
    { name: '时间', weight: 0.2, required: true },
    { name: '指标', weight: 0.2, required: true },
    { name: '数值', weight: 0.2, required: false },
    { name: '单位', weight: 0.1, required: false }
  ],
  threshold: 0.75,
  relations: [
    { type: '发生于', target_field: '区域', direction: 'outgoing' },
    { type: '发生时间', target_field: '时间', direction: 'outgoing' }
  ],
  version: '1.0.0'
};

// Clean up database before and after tests
beforeEach(async () => {
  await prisma.schema.deleteMany({});
});

afterAll(async () => {
  await prisma.schema.deleteMany({});
  await prisma.$disconnect();
});

describe('Schema Manager - Validation', () => {
  test('should validate a valid schema', () => {
    expect(() => schemaManager.validateSchema(validSchema)).not.toThrow();
  });

  test('should reject schema without schema_name', () => {
    const invalid = { ...validSchema };
    delete invalid.schema_name;
    expect(() => schemaManager.validateSchema(invalid)).toThrow('schema_name is required');
  });

  test('should reject schema without entity_type', () => {
    const invalid = { ...validSchema };
    delete invalid.entity_type;
    expect(() => schemaManager.validateSchema(invalid)).toThrow('entity_type is required');
  });

  test('should reject schema without core_fields', () => {
    const invalid = { ...validSchema };
    delete invalid.core_fields;
    expect(() => schemaManager.validateSchema(invalid)).toThrow('core_fields is required');
  });

  test('should reject schema with empty core_fields', () => {
    const invalid = { ...validSchema, core_fields: [] };
    expect(() => schemaManager.validateSchema(invalid)).toThrow('core_fields is required and must be a non-empty array');
  });

  test('should reject schema with invalid threshold', () => {
    const invalid = { ...validSchema, threshold: 1.5 };
    expect(() => schemaManager.validateSchema(invalid)).toThrow('threshold is required and must be a number between 0 and 1');
  });

  test('should reject schema with negative threshold', () => {
    const invalid = { ...validSchema, threshold: -0.1 };
    expect(() => schemaManager.validateSchema(invalid)).toThrow('threshold is required and must be a number between 0 and 1');
  });

  test('should reject core_field without name', () => {
    const invalid = {
      ...validSchema,
      core_fields: [{ weight: 0.5, required: true }]
    };
    expect(() => schemaManager.validateSchema(invalid)).toThrow('Each core_field must have a name');
  });

  test('should reject core_field without weight', () => {
    const invalid = {
      ...validSchema,
      core_fields: [{ name: 'test', required: true }]
    };
    expect(() => schemaManager.validateSchema(invalid)).toThrow('Each core_field must have a weight');
  });

  test('should reject core_field with invalid weight', () => {
    const invalid = {
      ...validSchema,
      core_fields: [{ name: 'test', weight: 1.5, required: true }]
    };
    expect(() => schemaManager.validateSchema(invalid)).toThrow('Each core_field must have a weight');
  });

  test('should reject core_field without required flag', () => {
    const invalid = {
      ...validSchema,
      core_fields: [{ name: 'test', weight: 1.0 }]
    };
    expect(() => schemaManager.validateSchema(invalid)).toThrow('Each core_field must have a required flag');
  });

  test('should reject core_fields with weights not summing to 1.0', () => {
    const invalid = {
      ...validSchema,
      core_fields: [
        { name: '区域', weight: 0.5, required: true },
        { name: '时间', weight: 0.3, required: true }
      ]
    };
    expect(() => schemaManager.validateSchema(invalid)).toThrow('core_fields weights must sum to 1.0');
  });

  test('should reject relation without type', () => {
    const invalid = {
      ...validSchema,
      relations: [{ target_field: '区域', direction: 'outgoing' }]
    };
    expect(() => schemaManager.validateSchema(invalid)).toThrow('Each relation must have a type');
  });

  test('should reject relation without target_field', () => {
    const invalid = {
      ...validSchema,
      relations: [{ type: '发生于', direction: 'outgoing' }]
    };
    expect(() => schemaManager.validateSchema(invalid)).toThrow('Each relation must have a target_field');
  });

  test('should reject relation with invalid direction', () => {
    const invalid = {
      ...validSchema,
      relations: [{ type: '发生于', target_field: '区域', direction: 'invalid' }]
    };
    expect(() => schemaManager.validateSchema(invalid)).toThrow('Each relation must have a direction');
  });

  test('should accept schema without relations', () => {
    const valid = { ...validSchema };
    delete valid.relations;
    expect(() => schemaManager.validateSchema(valid)).not.toThrow();
  });
});

describe('Schema Manager - CRUD Operations', () => {
  test('should create a new schema', async () => {
    const schemaId = await schemaManager.createSchema(validSchema);
    expect(schemaId).toBeDefined();
    expect(typeof schemaId).toBe('string');
  });

  test('should reject duplicate schema name', async () => {
    await schemaManager.createSchema(validSchema);
    await expect(schemaManager.createSchema(validSchema)).rejects.toThrow('already exists');
  });

  test('should get schema by ID', async () => {
    const schemaId = await schemaManager.createSchema(validSchema);
    const retrieved = await schemaManager.getSchema(schemaId);
    
    expect(retrieved).toBeDefined();
    expect(retrieved.schema_id).toBe(schemaId);
    expect(retrieved.schema_name).toBe(validSchema.schema_name);
    expect(retrieved.entity_type).toBe(validSchema.entity_type);
    expect(retrieved.threshold).toBe(validSchema.threshold);
    expect(retrieved.core_fields).toEqual(validSchema.core_fields);
    expect(retrieved.relations).toEqual(validSchema.relations);
  });

  test('should return null for non-existent schema ID', async () => {
    const retrieved = await schemaManager.getSchema('non-existent-id');
    expect(retrieved).toBeNull();
  });

  test('should get schema by name', async () => {
    await schemaManager.createSchema(validSchema);
    const retrieved = await schemaManager.getSchemaByName(validSchema.schema_name);
    
    expect(retrieved).toBeDefined();
    expect(retrieved.schema_name).toBe(validSchema.schema_name);
  });

  test('should return null for non-existent schema name', async () => {
    const retrieved = await schemaManager.getSchemaByName('non-existent-name');
    expect(retrieved).toBeNull();
  });

  test('should list all schemas', async () => {
    await schemaManager.createSchema(validSchema);
    await schemaManager.createSchema({
      ...validSchema,
      schema_name: 'test_schema_2',
      entity_type: 'TestEntity2'
    });
    
    const schemas = await schemaManager.listSchemas();
    expect(schemas).toHaveLength(2);
  });

  test('should filter schemas by entity type', async () => {
    await schemaManager.createSchema(validSchema);
    await schemaManager.createSchema({
      ...validSchema,
      schema_name: 'test_schema_2',
      entity_type: 'DifferentEntity'
    });
    
    const schemas = await schemaManager.listSchemas({ entityType: 'TestEntity' });
    expect(schemas).toHaveLength(1);
    expect(schemas[0].entity_type).toBe('TestEntity');
  });

  test('should get schemas by entity type', async () => {
    await schemaManager.createSchema(validSchema);
    await schemaManager.createSchema({
      ...validSchema,
      schema_name: 'test_schema_2',
      entity_type: 'TestEntity'
    });
    
    const schemas = await schemaManager.getSchemasByEntityType('TestEntity');
    expect(schemas).toHaveLength(2);
    schemas.forEach(schema => {
      expect(schema.entity_type).toBe('TestEntity');
    });
  });

  test('should update schema', async () => {
    const schemaId = await schemaManager.createSchema(validSchema);
    
    await schemaManager.updateSchema(schemaId, {
      threshold: 0.8,
      version: '1.1.0'
    });
    
    const updated = await schemaManager.getSchema(schemaId);
    expect(updated.threshold).toBe(0.8);
    expect(updated.version).toBe('1.1.0');
    expect(updated.schema_name).toBe(validSchema.schema_name); // Unchanged
  });

  test('should reject update with invalid data', async () => {
    const schemaId = await schemaManager.createSchema(validSchema);
    
    await expect(
      schemaManager.updateSchema(schemaId, { threshold: 1.5 })
    ).rejects.toThrow('threshold is required and must be a number between 0 and 1');
  });

  test('should reject update of non-existent schema', async () => {
    await expect(
      schemaManager.updateSchema('non-existent-id', { threshold: 0.8 })
    ).rejects.toThrow('not found');
  });

  test('should delete schema', async () => {
    const schemaId = await schemaManager.createSchema(validSchema);
    await schemaManager.deleteSchema(schemaId);
    
    const retrieved = await schemaManager.getSchema(schemaId);
    expect(retrieved).toBeNull();
  });

  test('should reject delete of non-existent schema', async () => {
    await expect(
      schemaManager.deleteSchema('non-existent-id')
    ).rejects.toThrow('not found');
  });

  test('should count schemas', async () => {
    await schemaManager.createSchema(validSchema);
    await schemaManager.createSchema({
      ...validSchema,
      schema_name: 'test_schema_2',
      entity_type: 'TestEntity2'
    });
    
    const count = await schemaManager.countSchemas();
    expect(count).toBe(2);
  });

  test('should check if schema exists', async () => {
    await schemaManager.createSchema(validSchema);
    
    const exists = await schemaManager.schemaExists(validSchema.schema_name);
    expect(exists).toBe(true);
    
    const notExists = await schemaManager.schemaExists('non-existent-name');
    expect(notExists).toBe(false);
  });
});

describe('Schema Manager - Edge Cases', () => {
  test('should handle schema with minimal fields', async () => {
    const minimal = {
      schema_name: 'minimal_schema',
      entity_type: 'MinimalEntity',
      core_fields: [
        { name: 'field1', weight: 1.0, required: true }
      ],
      threshold: 0.5
    };
    
    const schemaId = await schemaManager.createSchema(minimal);
    const retrieved = await schemaManager.getSchema(schemaId);
    
    expect(retrieved.schema_name).toBe(minimal.schema_name);
    expect(retrieved.relations).toEqual([]);
    expect(retrieved.version).toBe('1.0.0'); // Default version
  });

  test('should handle schema with many core fields', async () => {
    const manyFields = {
      schema_name: 'many_fields_schema',
      entity_type: 'ComplexEntity',
      core_fields: [
        { name: 'field1', weight: 0.2, required: true },
        { name: 'field2', weight: 0.2, required: true },
        { name: 'field3', weight: 0.2, required: false },
        { name: 'field4', weight: 0.2, required: false },
        { name: 'field5', weight: 0.2, required: false }
      ],
      threshold: 0.6
    };
    
    const schemaId = await schemaManager.createSchema(manyFields);
    const retrieved = await schemaManager.getSchema(schemaId);
    
    expect(retrieved.core_fields).toHaveLength(5);
  });

  test('should handle pagination in listSchemas', async () => {
    // Create 5 schemas
    for (let i = 0; i < 5; i++) {
      await schemaManager.createSchema({
        ...validSchema,
        schema_name: `test_schema_${i}`,
        entity_type: 'TestEntity'
      });
    }
    
    const page1 = await schemaManager.listSchemas({ skip: 0, take: 2 });
    expect(page1).toHaveLength(2);
    
    const page2 = await schemaManager.listSchemas({ skip: 2, take: 2 });
    expect(page2).toHaveLength(2);
    
    const page3 = await schemaManager.listSchemas({ skip: 4, take: 2 });
    expect(page3).toHaveLength(1);
  });

  test('should handle update with partial core_fields', async () => {
    const schemaId = await schemaManager.createSchema(validSchema);
    
    const newCoreFields = [
      { name: '区域', weight: 0.5, required: true },
      { name: '时间', weight: 0.5, required: true }
    ];
    
    await schemaManager.updateSchema(schemaId, {
      core_fields: newCoreFields
    });
    
    const updated = await schemaManager.getSchema(schemaId);
    expect(updated.core_fields).toEqual(newCoreFields);
  });

  test('should preserve JSON structure through save/load cycle', async () => {
    const schemaId = await schemaManager.createSchema(validSchema);
    const retrieved = await schemaManager.getSchema(schemaId);
    
    // Deep equality check
    expect(retrieved.core_fields).toEqual(validSchema.core_fields);
    expect(retrieved.relations).toEqual(validSchema.relations);
  });
});
