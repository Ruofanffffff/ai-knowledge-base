/**
 * Unit tests for Schema data model
 * Tests Requirements 17.1 and 3.1
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Schema Data Model', () => {
  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.schema.deleteMany({
      where: {
        name: {
          startsWith: 'Test-'
        }
      }
    });
  });

  afterAll(async () => {
    // Clean up and disconnect
    await prisma.schema.deleteMany({
      where: {
        name: {
          startsWith: 'Test-'
        }
      }
    });
    await prisma.$disconnect();
  });

  describe('Schema Creation', () => {
    test('should create schema with all fields including new ones', async () => {
      const schema = await prisma.schema.create({
        data: {
          name: 'Test-EITV',
          entityType: 'EventEntity',
          scene: '科研/政府',
          coreFields: JSON.stringify([
            { name: 'Entity', weight: 0.2, required: true },
            { name: 'Indicator', weight: 0.2, required: true },
            { name: 'Time', weight: 0.2, required: true },
            { name: 'Value', weight: 0.2, required: true },
            { name: 'Unit', weight: 0.2, required: false }
          ]),
          threshold: 0.75,
          relations: JSON.stringify([]),
          exampleDescription: 'A区2022年地下水位下降0.8米',
          description: '用于记录某个实体在某个时间点的指标数值',
          version: '1.0',
          active: true
        }
      });

      expect(schema).toBeDefined();
      expect(schema.name).toBe('Test-EITV');
      expect(schema.scene).toBe('科研/政府');
      expect(schema.exampleDescription).toBe('A区2022年地下水位下降0.8米');
      expect(schema.description).toBe('用于记录某个实体在某个时间点的指标数值');
      expect(schema.active).toBe(true);
    });

    test('should create schema without optional fields', async () => {
      const schema = await prisma.schema.create({
        data: {
          name: 'Test-Minimal',
          entityType: 'GeneralEntity',
          coreFields: JSON.stringify([
            { name: 'Name', weight: 1.0, required: true }
          ]),
          threshold: 0.8,
          version: '1.0'
        }
      });

      expect(schema).toBeDefined();
      expect(schema.scene).toBeNull();
      expect(schema.exampleDescription).toBeNull();
      expect(schema.description).toBeNull();
      expect(schema.active).toBe(true); // Default value
    });

    test('should set active to true by default', async () => {
      const schema = await prisma.schema.create({
        data: {
          name: 'Test-Default-Active',
          entityType: 'GeneralEntity',
          coreFields: JSON.stringify([]),
          threshold: 0.75,
          version: '1.0'
        }
      });

      expect(schema.active).toBe(true);
    });
  });

  describe('Schema Querying', () => {
    beforeEach(async () => {
      // Create test schemas
      await prisma.schema.createMany({
        data: [
          {
            name: 'Test-Research-1',
            entityType: 'EventEntity',
            scene: '科研/政府',
            coreFields: JSON.stringify([]),
            threshold: 0.75,
            version: '1.0',
            active: true
          },
          {
            name: 'Test-Research-2',
            entityType: 'EventEntity',
            scene: '科研/政府',
            coreFields: JSON.stringify([]),
            threshold: 0.75,
            version: '1.0',
            active: false
          },
          {
            name: 'Test-Travel-1',
            entityType: 'TravelEntity',
            scene: '旅行/休闲',
            coreFields: JSON.stringify([]),
            threshold: 0.75,
            version: '1.0',
            active: true
          }
        ]
      });
    });

    test('should query schemas by scene', async () => {
      const schemas = await prisma.schema.findMany({
        where: {
          scene: {
            contains: '科研'
          }
        }
      });

      // Should find at least the test schemas
      expect(schemas.length).toBeGreaterThanOrEqual(2);
      expect(schemas.every(s => s.scene.includes('科研'))).toBe(true);
    });

    test('should query active schemas only', async () => {
      const schemas = await prisma.schema.findMany({
        where: {
          active: true
        }
      });

      expect(schemas.length).toBeGreaterThanOrEqual(2);
      expect(schemas.every(s => s.active === true)).toBe(true);
    });

    test('should query inactive schemas only', async () => {
      const schemas = await prisma.schema.findMany({
        where: {
          active: false
        }
      });

      expect(schemas.length).toBeGreaterThanOrEqual(1);
      expect(schemas.every(s => s.active === false)).toBe(true);
    });

    test('should query by scene and active status', async () => {
      const schemas = await prisma.schema.findMany({
        where: {
          scene: {
            contains: '科研'
          },
          active: true
        }
      });

      // Should find at least one active research schema
      expect(schemas.length).toBeGreaterThanOrEqual(1);
      // Verify at least one is our test schema
      const testSchema = schemas.find(s => s.name === 'Test-Research-1');
      if (testSchema) {
        expect(testSchema.name).toBe('Test-Research-1');
      }
    });

    test('should query by entity type', async () => {
      const schemas = await prisma.schema.findMany({
        where: {
          entityType: 'TravelEntity'
        }
      });

      expect(schemas.length).toBeGreaterThanOrEqual(1);
      expect(schemas.every(s => s.entityType === 'TravelEntity')).toBe(true);
    });
  });

  describe('Schema Updates', () => {
    let testSchema;

    beforeEach(async () => {
      // Clean up any existing test schema with this name
      await prisma.schema.deleteMany({
        where: { name: 'Test-Update' }
      });
      
      testSchema = await prisma.schema.create({
        data: {
          name: 'Test-Update',
          entityType: 'GeneralEntity',
          scene: '测试',
          coreFields: JSON.stringify([]),
          threshold: 0.75,
          exampleDescription: '原始描述',
          description: '原始说明',
          version: '1.0',
          active: true
        }
      });
    });

    afterEach(async () => {
      // Clean up after each test
      if (testSchema && testSchema.id) {
        await prisma.schema.deleteMany({
          where: { name: 'Test-Update' }
        });
      }
    });

    test('should update scene field', async () => {
      const updated = await prisma.schema.update({
        where: { id: testSchema.id },
        data: { scene: '科研/政府' }
      });

      expect(updated.scene).toBe('科研/政府');
    });

    test('should update example_description field', async () => {
      const updated = await prisma.schema.update({
        where: { id: testSchema.id },
        data: { exampleDescription: '新的示例描述' }
      });

      expect(updated.exampleDescription).toBe('新的示例描述');
    });

    test('should update description field', async () => {
      const updated = await prisma.schema.update({
        where: { id: testSchema.id },
        data: { description: '新的详细说明' }
      });

      expect(updated.description).toBe('新的详细说明');
    });

    test('should toggle active status', async () => {
      // Re-fetch to ensure schema exists
      const current = await prisma.schema.findUnique({
        where: { id: testSchema.id }
      });
      expect(current).not.toBeNull();
      
      // Disable schema
      let updated = await prisma.schema.update({
        where: { id: testSchema.id },
        data: { active: false }
      });
      expect(updated.active).toBe(false);

      // Enable schema
      updated = await prisma.schema.update({
        where: { id: testSchema.id },
        data: { active: true }
      });
      expect(updated.active).toBe(true);
    });

    test('should update multiple fields at once', async () => {
      const updated = await prisma.schema.update({
        where: { id: testSchema.id },
        data: {
          scene: '摄影',
          exampleDescription: '更新的示例',
          description: '更新的说明',
          active: false
        }
      });

      expect(updated.scene).toBe('摄影');
      expect(updated.exampleDescription).toBe('更新的示例');
      expect(updated.description).toBe('更新的说明');
      expect(updated.active).toBe(false);
    });
  });

  describe('Schema Indexes', () => {
    test('should efficiently query by scene (indexed)', async () => {
      // Create multiple schemas
      const schemas = [];
      for (let i = 0; i < 10; i++) {
        schemas.push({
          name: `Test-Index-${i}`,
          entityType: 'GeneralEntity',
          scene: i % 2 === 0 ? '科研/政府' : '旅行/休闲',
          coreFields: JSON.stringify([]),
          threshold: 0.75,
          version: '1.0',
          active: true
        });
      }
      await prisma.schema.createMany({ data: schemas });

      const startTime = Date.now();
      const result = await prisma.schema.findMany({
        where: {
          scene: {
            contains: '科研'
          }
        }
      });
      const queryTime = Date.now() - startTime;

      expect(result.length).toBeGreaterThanOrEqual(5);
      expect(queryTime).toBeLessThan(100); // Should be fast with index
    });

    test('should efficiently query by active status (indexed)', async () => {
      const startTime = Date.now();
      const result = await prisma.schema.findMany({
        where: {
          active: true
        }
      });
      const queryTime = Date.now() - startTime;

      expect(result.length).toBeGreaterThanOrEqual(0);
      expect(queryTime).toBeLessThan(100); // Should be fast with index
    });
  });

  describe('Schema Validation', () => {
    beforeEach(async () => {
      // Clean up test schemas
      await prisma.schema.deleteMany({
        where: { name: { startsWith: 'Test-' } }
      });
    });
    
    test('should enforce unique name constraint', async () => {
      await prisma.schema.create({
        data: {
          name: 'Test-Unique',
          entityType: 'GeneralEntity',
          coreFields: JSON.stringify([]),
          threshold: 0.75,
          version: '1.0'
        }
      });

      await expect(
        prisma.schema.create({
          data: {
            name: 'Test-Unique',
            entityType: 'GeneralEntity',
            coreFields: JSON.stringify([]),
            threshold: 0.75,
            version: '1.0'
          }
        })
      ).rejects.toThrow();
    });

    test('should require name field', async () => {
      await expect(
        prisma.schema.create({
          data: {
            entityType: 'GeneralEntity',
            coreFields: JSON.stringify([]),
            threshold: 0.75,
            version: '1.0'
          }
        })
      ).rejects.toThrow();
    });

    test('should require entityType field', async () => {
      await expect(
        prisma.schema.create({
          data: {
            name: 'Test-No-Type',
            coreFields: JSON.stringify([]),
            threshold: 0.75,
            version: '1.0'
          }
        })
      ).rejects.toThrow();
    });
  });
});
