/**
 * Unit Tests for Schema Loader
 * 
 * Tests the schema loading and importing functionality.
 */

const fs = require('fs').promises;
const path = require('path');
const schemaLoader = require('./schema_loader');
const schemaManager = require('./schema_manager');

// Mock schema manager
jest.mock('./schema_manager');

describe('Schema Loader', () => {
  
  describe('parseCoreFields', () => {
    test('should parse comma-separated field names', () => {
      const input = 'Entity, Indicator, Time, Value, Unit';
      const result = schemaLoader.parseCoreFields(input);
      
      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({
        name: 'Entity',
        weight: 0.2,
        required: true
      });
      expect(result[4]).toEqual({
        name: 'Unit',
        weight: 0.2,
        required: true
      });
    });
    
    test('should handle fields with extra whitespace', () => {
      const input = '  Region  ,  Time  ,  Value  ';
      const result = schemaLoader.parseCoreFields(input);
      
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Region');
      expect(result[1].name).toBe('Time');
      expect(result[2].name).toBe('Value');
    });
    
    test('should calculate equal weights for all fields', () => {
      const input = 'Field1, Field2, Field3';
      const result = schemaLoader.parseCoreFields(input);
      
      const totalWeight = result.reduce((sum, field) => sum + field.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 3); // Use precision 3 for floating point tolerance
    });
    
    test('should return empty array for empty string', () => {
      const result = schemaLoader.parseCoreFields('');
      expect(result).toEqual([]);
    });
    
    test('should return empty array for null input', () => {
      const result = schemaLoader.parseCoreFields(null);
      expect(result).toEqual([]);
    });
  });
  
  describe('inferEntityType', () => {
    test('should infer ResearchEntity for 科研/政府 scene', () => {
      const result = schemaLoader.inferEntityType('EITV', '科研/政府');
      expect(result).toBe('ResearchEntity');
    });
    
    test('should infer TravelEntity for 旅行 scene', () => {
      const result = schemaLoader.inferEntityType('Travel-Trip', '旅行');
      expect(result).toBe('TravelEntity');
    });
    
    test('should infer PhotographyEntity for 摄影 scene', () => {
      const result = schemaLoader.inferEntityType('Shooting-Info', '摄影');
      expect(result).toBe('PhotographyEntity');
    });
    
    test('should infer PostProcessingEntity for 后期 scene', () => {
      const result = schemaLoader.inferEntityType('Raw-Develop', '后期');
      expect(result).toBe('PostProcessingEntity');
    });
    
    test('should infer SportsEntity for 运动 scene', () => {
      const result = schemaLoader.inferEntityType('Running-Log', '运动');
      expect(result).toBe('SportsEntity');
    });
    
    test('should infer LifeEntity for 个人生活 scene', () => {
      const result = schemaLoader.inferEntityType('Health-Observation', '个人生活');
      expect(result).toBe('LifeEntity');
    });
    
    test('should infer EntertainmentEntity for 娱乐 scene', () => {
      const result = schemaLoader.inferEntityType('Movie-Review', '娱乐');
      expect(result).toBe('EntertainmentEntity');
    });
    
    test('should infer EventEntity for schema name containing 事件', () => {
      const result = schemaLoader.inferEntityType('地下水位变化事件', '其他');
      expect(result).toBe('EventEntity');
    });
    
    test('should infer RecordEntity for schema name containing 记录', () => {
      const result = schemaLoader.inferEntityType('维护记录', '其他');
      expect(result).toBe('RecordEntity');
    });
    
    test('should default to GeneralEntity for unknown patterns', () => {
      const result = schemaLoader.inferEntityType('Unknown Schema', '其他');
      expect(result).toBe('GeneralEntity');
    });
  });
  
  describe('parseSchemaLine', () => {
    test('should parse valid schema line', () => {
      const line = '1    EITV    科研/政府    Entity, Indicator, Time, Value, Unit    A区2022年地下水位下降0.8米    用于记录某个实体在某个时间点的指标数值';
      const result = schemaLoader.parseSchemaLine(line, 1);
      
      expect(result).not.toBeNull();
      expect(result.schema_name).toBe('EITV');
      expect(result.entity_type).toBe('ResearchEntity');
      expect(result.scene).toBe('科研/政府');
      expect(result.core_fields).toHaveLength(5);
      expect(result.threshold).toBe(0.75);
      expect(result.example_description).toBe('A区2022年地下水位下降0.8米');
      expect(result.description).toBe('用于记录某个实体在某个时间点的指标数值');
      expect(result.version).toBe('1.0.0');
    });
    
    test('should handle line without description', () => {
      const line = '2    Entity-Attribute    科研/学术    Entity, Attribute, Value    置信度模型：衡量数据准确性的模型';
      const result = schemaLoader.parseSchemaLine(line, 2);
      
      expect(result).not.toBeNull();
      expect(result.schema_name).toBe('Entity-Attribute');
      expect(result.description).toBe('');
    });
    
    test('should return null for invalid column count', () => {
      const line = '1    InvalidSchema';
      const result = schemaLoader.parseSchemaLine(line, 1);
      
      expect(result).toBeNull();
    });
    
    test('should return null for header row', () => {
      const line = '#    Schema 名称    场景    核心字段    示例描述    Description';
      const result = schemaLoader.parseSchemaLine(line, 1);
      
      expect(result).toBeNull();
    });
    
    test('should return null for missing required fields', () => {
      const line = '1                              ';
      const result = schemaLoader.parseSchemaLine(line, 1);
      
      expect(result).toBeNull();
    });
  });
  
  describe('loadSchemasFromFile', () => {
    const testFilePath = path.join(__dirname, 'test-schema-list.md');
    
    beforeEach(async () => {
      // Create test file with space-separated format (4+ spaces as separator)
      const content = `#    Schema 名称    场景    核心字段    示例描述    Description
1    EITV    科研/政府    Entity, Indicator, Time, Value, Unit    A区2022年地下水位下降0.8米    用于记录某个实体在某个时间点的指标数值
2    Entity-Attribute    科研/学术    Entity, Attribute, Value    置信度模型：衡量数据准确性的模型    描述实体的属性及其具体值
3    Travel-Trip    旅行    TripID, Location, StartDate, EndDate    青森旅行 → 2026-01-20~2026-01-25    记录旅行行程及时间`;
      
      await fs.writeFile(testFilePath, content, 'utf-8');
    });
    
    afterEach(async () => {
      // Clean up test file
      try {
        await fs.unlink(testFilePath);
      } catch (error) {
        // Ignore error if file doesn't exist
      }
    });
    
    test('should load schemas from file', async () => {
      const schemas = await schemaLoader.loadSchemasFromFile(testFilePath);
      
      expect(schemas).toHaveLength(3);
      expect(schemas[0].schema_name).toBe('EITV');
      expect(schemas[1].schema_name).toBe('Entity-Attribute');
      expect(schemas[2].schema_name).toBe('Travel-Trip');
    });
    
    test('should throw error for non-existent file', async () => {
      await expect(
        schemaLoader.loadSchemasFromFile('non-existent-file.md')
      ).rejects.toThrow();
    });
  });
  
  describe('importSchemas', () => {
    const testSchemas = [
      {
        schema_name: 'Test Schema 1',
        entity_type: 'TestEntity',
        scene: '测试',
        core_fields: [
          { name: 'Field1', weight: 0.5, required: true },
          { name: 'Field2', weight: 0.5, required: true }
        ],
        threshold: 0.75,
        relations: [],
        example_description: 'Test example',
        description: 'Test description',
        version: '1.0.0'
      },
      {
        schema_name: 'Test Schema 2',
        entity_type: 'TestEntity',
        scene: '测试',
        core_fields: [
          { name: 'FieldA', weight: 1.0, required: true }
        ],
        threshold: 0.75,
        relations: [],
        example_description: 'Test example 2',
        description: 'Test description 2',
        version: '1.0.0'
      }
    ];
    
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });
    
    test('should import new schemas', async () => {
      // Mock schema manager methods
      schemaManager.getSchemaByName.mockResolvedValue(null);
      schemaManager.createSchema.mockResolvedValue('schema-id-1');
      
      const stats = await schemaLoader.importSchemas(testSchemas);
      
      expect(stats.total).toBe(2);
      expect(stats.created).toBe(2);
      expect(stats.skipped).toBe(0);
      expect(stats.failed).toBe(0);
      expect(schemaManager.createSchema).toHaveBeenCalledTimes(2);
    });
    
    test('should skip existing schemas when skipExisting=true', async () => {
      // Mock schema manager methods
      schemaManager.getSchemaByName.mockResolvedValue({ schema_id: 'existing-id' });
      
      const stats = await schemaLoader.importSchemas(testSchemas, { skipExisting: true });
      
      expect(stats.total).toBe(2);
      expect(stats.created).toBe(0);
      expect(stats.skipped).toBe(2);
      expect(stats.failed).toBe(0);
      expect(schemaManager.createSchema).not.toHaveBeenCalled();
    });
    
    test('should update existing schemas when updateExisting=true', async () => {
      // Mock schema manager methods
      schemaManager.getSchemaByName.mockResolvedValue({ schema_id: 'existing-id' });
      schemaManager.updateSchema.mockResolvedValue();
      
      const stats = await schemaLoader.importSchemas(testSchemas, { updateExisting: true });
      
      expect(stats.total).toBe(2);
      expect(stats.created).toBe(0);
      expect(stats.updated).toBe(2);
      expect(stats.failed).toBe(0);
      expect(schemaManager.updateSchema).toHaveBeenCalledTimes(2);
    });
    
    test('should handle import errors gracefully', async () => {
      // Mock schema manager methods
      schemaManager.getSchemaByName.mockResolvedValue(null);
      schemaManager.createSchema
        .mockResolvedValueOnce('schema-id-1')
        .mockRejectedValue(new Error('Database error'));
      
      const stats = await schemaLoader.importSchemas(testSchemas, {
        maxRetries: 0, // No retries for this test
        showProgress: false
      });
      
      expect(stats.total).toBe(2);
      expect(stats.created).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.errors).toHaveLength(1);
      expect(stats.errors[0].schema_name).toBe('Test Schema 2');
    });
  });
  
  describe('getSchemasByScene', () => {
    test('should filter schemas by scene', async () => {
      const mockSchemas = [
        { schema_id: '1', schema_name: 'Schema 1', scene: '科研/政府' },
        { schema_id: '2', schema_name: 'Schema 2', scene: '旅行' },
        { schema_id: '3', schema_name: 'Schema 3', scene: '科研/学术' }
      ];
      
      schemaManager.listSchemas.mockResolvedValue(mockSchemas);
      
      const result = await schemaLoader.getSchemasByScene('科研');
      
      expect(result).toHaveLength(2);
      expect(result[0].schema_name).toBe('Schema 1');
      expect(result[1].schema_name).toBe('Schema 3');
    });
    
    test('should return empty array if no schemas match', async () => {
      const mockSchemas = [
        { schema_id: '1', schema_name: 'Schema 1', scene: '科研/政府' }
      ];
      
      schemaManager.listSchemas.mockResolvedValue(mockSchemas);
      
      const result = await schemaLoader.getSchemasByScene('娱乐');
      
      expect(result).toHaveLength(0);
    });
    
    test('should handle schemas without scene field', async () => {
      const mockSchemas = [
        { schema_id: '1', schema_name: 'Schema 1', scene: '科研/政府' },
        { schema_id: '2', schema_name: 'Schema 2' } // No scene field
      ];
      
      schemaManager.listSchemas.mockResolvedValue(mockSchemas);
      
      const result = await schemaLoader.getSchemasByScene('科研');
      
      expect(result).toHaveLength(1);
      expect(result[0].schema_name).toBe('Schema 1');
    });
  });
  
  describe('exportSchemasToJSON', () => {
    const testOutputPath = path.join(__dirname, 'test-export.json');
    
    afterEach(async () => {
      // Clean up test file
      try {
        await fs.unlink(testOutputPath);
      } catch (error) {
        // Ignore error if file doesn't exist
      }
    });
    
    test('should export schemas to JSON file', async () => {
      const mockSchemas = [
        { schema_id: '1', schema_name: 'Schema 1', scene: '科研/政府' },
        { schema_id: '2', schema_name: 'Schema 2', scene: '旅行' }
      ];
      
      schemaManager.listSchemas.mockResolvedValue(mockSchemas);
      
      const count = await schemaLoader.exportSchemasToJSON(testOutputPath);
      
      expect(count).toBe(2);
      
      // Verify file content
      const content = await fs.readFile(testOutputPath, 'utf-8');
      const exported = JSON.parse(content);
      expect(exported).toHaveLength(2);
      expect(exported[0].schema_name).toBe('Schema 1');
    });
  });
  
  describe('exportSchemasToCSV', () => {
    const testOutputPath = path.join(__dirname, 'test-export.csv');
    
    afterEach(async () => {
      // Clean up test file
      try {
        await fs.unlink(testOutputPath);
      } catch (error) {
        // Ignore error if file doesn't exist
      }
    });
    
    test('should export schemas to CSV file', async () => {
      const mockSchemas = [
        {
          schema_id: '1',
          schema_name: 'Schema 1',
          entity_type: 'TestEntity',
          scene: '科研/政府',
          core_fields: [
            { name: 'Field1', weight: 0.5, required: true },
            { name: 'Field2', weight: 0.5, required: true }
          ],
          threshold: 0.75,
          version: '1.0.0'
        }
      ];
      
      schemaManager.listSchemas.mockResolvedValue(mockSchemas);
      
      const count = await schemaLoader.exportSchemasToCSV(testOutputPath);
      
      expect(count).toBe(1);
      
      // Verify file content
      const content = await fs.readFile(testOutputPath, 'utf-8');
      expect(content).toContain('ID,Name,EntityType,Scene,CoreFields,Threshold,Version');
      expect(content).toContain('"Schema 1"');
      expect(content).toContain('TestEntity');
    });
  });
  
  // Task 6.6.1: Enhanced Schema Import Tests
  describe('Enhanced Import Features (Task 6.6.1)', () => {
    
    describe('validateImportResults', () => {
      test('should validate successful import with expected count', () => {
        const stats = {
          total: 250,
          created: 200,
          updated: 50,
          skipped: 0,
          failed: 0,
          errors: [],
          duration: 30000 // 30 seconds
        };
        
        const validation = schemaLoader.validateImportResults(stats, 250);
        
        expect(validation.isValid).toBe(true);
        expect(validation.expectedCount).toBe(250);
        expect(validation.actualCount).toBe(250);
        expect(validation.successCount).toBe(250);
        expect(validation.issues).toHaveLength(0);
      });
      
      test('should detect count mismatch', () => {
        const stats = {
          total: 240,
          created: 200,
          updated: 30,
          skipped: 10,
          failed: 0,
          errors: [],
          duration: 30000
        };
        
        const validation = schemaLoader.validateImportResults(stats, 250);
        
        expect(validation.isValid).toBe(false);
        expect(validation.actualCount).toBe(240);
        expect(validation.issues).toHaveLength(1);
        expect(validation.issues[0].type).toBe('COUNT_MISMATCH');
        expect(validation.issues[0].severity).toBe('ERROR');
      });
      
      test('should detect import failures', () => {
        const stats = {
          total: 250,
          created: 200,
          updated: 30,
          skipped: 15,
          failed: 5,
          errors: [
            { schema_name: 'Schema1', error: 'Error 1' },
            { schema_name: 'Schema2', error: 'Error 2' },
            { schema_name: 'Schema3', error: 'Error 3' },
            { schema_name: 'Schema4', error: 'Error 4' },
            { schema_name: 'Schema5', error: 'Error 5' }
          ],
          duration: 30000
        };
        
        const validation = schemaLoader.validateImportResults(stats, 250);
        
        expect(validation.isValid).toBe(false);
        expect(validation.issues.length).toBeGreaterThan(0);
        const failureIssue = validation.issues.find(i => i.type === 'IMPORT_FAILURES');
        expect(failureIssue).toBeDefined();
        expect(failureIssue.severity).toBe('ERROR');
      });
      
      test('should detect low success rate', () => {
        const stats = {
          total: 250,
          created: 100,
          updated: 50,
          skipped: 50,
          failed: 50,
          errors: [],
          duration: 30000
        };
        
        const validation = schemaLoader.validateImportResults(stats, 250);
        
        expect(validation.isValid).toBe(false);
        const lowRateIssue = validation.issues.find(i => i.type === 'LOW_SUCCESS_RATE');
        expect(lowRateIssue).toBeDefined();
        expect(lowRateIssue.severity).toBe('WARNING');
      });
      
      test('should detect slow import', () => {
        const stats = {
          total: 250,
          created: 200,
          updated: 30,
          skipped: 20,
          failed: 0,
          errors: [],
          duration: 6 * 60 * 1000 // 6 minutes
        };
        
        const validation = schemaLoader.validateImportResults(stats, 250);
        
        const slowIssue = validation.issues.find(i => i.type === 'SLOW_IMPORT');
        expect(slowIssue).toBeDefined();
        expect(slowIssue.severity).toBe('WARNING');
      });
    });
    
    describe('logImportErrors', () => {
      const testLogPath = path.join(__dirname, 'test-import-errors.log');
      
      afterEach(async () => {
        // Clean up test file
        try {
          await fs.unlink(testLogPath);
        } catch (error) {
          // Ignore error if file doesn't exist
        }
      });
      
      test('should log errors to file', async () => {
        const stats = {
          errors: [
            {
              schema_name: 'Test Schema 1',
              error: 'Database connection failed',
              retries: 2
            },
            {
              schema_name: 'Test Schema 2',
              error: 'Invalid field format',
              retries: 1
            }
          ],
          retries: 3
        };
        
        await schemaLoader.logImportErrors(stats, testLogPath);
        
        // Verify file was created
        const content = await fs.readFile(testLogPath, 'utf-8');
        expect(content).toContain('Schema Import Error Log');
        expect(content).toContain('Total Errors: 2');
        expect(content).toContain('Total Retries: 3');
        expect(content).toContain('Test Schema 1');
        expect(content).toContain('Database connection failed');
        expect(content).toContain('Test Schema 2');
        expect(content).toContain('Invalid field format');
      });
      
      test('should not create file if no errors', async () => {
        const stats = {
          errors: [],
          retries: 0
        };
        
        await schemaLoader.logImportErrors(stats, testLogPath);
        
        // Verify file was not created
        await expect(fs.access(testLogPath)).rejects.toThrow();
      });
      
      test('should include stack trace if available', async () => {
        const error = new Error('Test error');
        const stats = {
          errors: [
            {
              schema_name: 'Test Schema',
              error: error.message,
              stack: error.stack,
              retries: 0
            }
          ],
          retries: 0
        };
        
        await schemaLoader.logImportErrors(stats, testLogPath);
        
        const content = await fs.readFile(testLogPath, 'utf-8');
        expect(content).toContain('Stack Trace:');
      });
    });
    
    describe('importSchemas with retry mechanism', () => {
      const testSchemas = [
        {
          schema_name: 'Test Schema 1',
          entity_type: 'TestEntity',
          scene: '测试',
          core_fields: [{ name: 'Field1', weight: 1.0, required: true }],
          threshold: 0.75,
          relations: [],
          example_description: 'Test',
          description: 'Test',
          version: '1.0.0'
        }
      ];
      
      beforeEach(() => {
        jest.clearAllMocks();
      });
      
      test('should retry on failure and eventually succeed', async () => {
        // Mock: fail twice, then succeed
        schemaManager.getSchemaByName.mockResolvedValue(null);
        schemaManager.createSchema
          .mockRejectedValueOnce(new Error('Temporary error'))
          .mockRejectedValueOnce(new Error('Temporary error'))
          .mockResolvedValueOnce('schema-id-1');
        
        const stats = await schemaLoader.importSchemas(testSchemas, {
          maxRetries: 3,
          retryDelay: 10,
          showProgress: false
        });
        
        expect(stats.created).toBe(1);
        expect(stats.failed).toBe(0);
        expect(stats.retries).toBe(2);
        expect(schemaManager.createSchema).toHaveBeenCalledTimes(3);
      });
      
      test('should fail after max retries', async () => {
        // Mock: always fail
        schemaManager.getSchemaByName.mockResolvedValue(null);
        schemaManager.createSchema.mockRejectedValue(new Error('Persistent error'));
        
        const stats = await schemaLoader.importSchemas(testSchemas, {
          maxRetries: 2,
          retryDelay: 10,
          showProgress: false
        });
        
        expect(stats.created).toBe(0);
        expect(stats.failed).toBe(1);
        expect(stats.retries).toBe(2);
        expect(stats.errors).toHaveLength(1);
        expect(stats.errors[0].retries).toBe(2);
        expect(schemaManager.createSchema).toHaveBeenCalledTimes(3); // Initial + 2 retries
      });
      
      test('should track retry count in stats', async () => {
        const multipleSchemas = [
          { ...testSchemas[0], schema_name: 'Schema 1' },
          { ...testSchemas[0], schema_name: 'Schema 2' },
          { ...testSchemas[0], schema_name: 'Schema 3' }
        ];
        
        schemaManager.getSchemaByName.mockResolvedValue(null);
        schemaManager.createSchema
          .mockRejectedValueOnce(new Error('Error 1'))
          .mockResolvedValueOnce('id-1')
          .mockRejectedValueOnce(new Error('Error 2'))
          .mockRejectedValueOnce(new Error('Error 2'))
          .mockResolvedValueOnce('id-2')
          .mockResolvedValueOnce('id-3');
        
        const stats = await schemaLoader.importSchemas(multipleSchemas, {
          maxRetries: 2,
          retryDelay: 10,
          showProgress: false
        });
        
        expect(stats.created).toBe(3);
        expect(stats.failed).toBe(0);
        expect(stats.retries).toBe(3); // 1 + 2 retries
      });
    });
    
    describe('importSchemas with progress tracking', () => {
      test('should track import duration', async () => {
        const testSchemas = [
          {
            schema_name: 'Test Schema',
            entity_type: 'TestEntity',
            scene: '测试',
            core_fields: [{ name: 'Field1', weight: 1.0, required: true }],
            threshold: 0.75,
            relations: [],
            example_description: 'Test',
            description: 'Test',
            version: '1.0.0'
          }
        ];
        
        schemaManager.getSchemaByName.mockResolvedValue(null);
        schemaManager.createSchema.mockResolvedValue('schema-id-1');
        
        const stats = await schemaLoader.importSchemas(testSchemas, {
          showProgress: false
        });
        
        expect(stats.startTime).toBeDefined();
        expect(stats.endTime).toBeDefined();
        expect(stats.duration).toBeDefined();
        expect(stats.duration).toBeGreaterThanOrEqual(0);
        expect(stats.endTime).toBeGreaterThanOrEqual(stats.startTime);
      });
    });
  });
});
