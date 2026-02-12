/**
 * Unit tests for SchemaValidator
 * 
 * Tests the schema validation functionality including:
 * - Schema count validation
 * - Schema structure validation
 * - Field mappings validation
 */

const SchemaValidator = require('../schema_validator');

describe('SchemaValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  describe('loadSchemas', () => {
    test('should load schemas from JSON file', () => {
      const schemas = validator.loadSchemas();
      
      expect(schemas).toBeDefined();
      expect(typeof schemas).toBe('object');
      expect(Object.keys(schemas).length).toBeGreaterThan(0);
    });

    test('should load at least 412 schemas', () => {
      const schemas = validator.loadSchemas();
      const count = Object.keys(schemas).length;
      
      expect(count).toBeGreaterThanOrEqual(412);
    });
  });

  describe('validateSchemaCount', () => {
    test('should pass when schema count is >= 412', () => {
      const result = validator.validateSchemaCount();
      
      expect(result).toBe(true);
      expect(validator.getErrors().length).toBe(0);
    });
  });

  describe('validateSchemaStructure', () => {
    test('should validate schema with full format fields', () => {
      const schema = {
        Field1: {
          common_variations: ['Field1', 'field1'],
          weight: 0.5,
          required: true,
          description: 'Test field'
        },
        Field2: {
          common_variations: ['Field2'],
          weight: 0.3,
          required: false,
          description: 'Another field'
        },
        Field3: {
          common_variations: ['Field3'],
          weight: 0.2,
          required: false,
          description: 'Third field'
        },
        Field4: {
          common_variations: ['Field4'],
          weight: 0.1,
          required: false,
          description: 'Fourth field'
        },
        Field5: {
          common_variations: ['Field5'],
          weight: 0.1,
          required: false,
          description: 'Fifth field'
        }
      };

      const result = validator.validateSchemaStructure('TestSchema', schema);
      
      expect(result).toBe(true);
    });

    test('should validate schema with simplified format fields (arrays)', () => {
      const schema = {
        Field1: {
          common_variations: ['Field1', 'field1'],
          weight: 0.5,
          required: true,
          description: 'Test field'
        },
        Field2: ['Variation1', 'Variation2'],
        Field3: {
          common_variations: ['Field3'],
          weight: 0.3,
          required: false,
          description: 'Another field'
        },
        Field4: ['Var1', 'Var2', 'Var3'],
        Field5: {
          common_variations: ['Field5'],
          weight: 0.1,
          required: false,
          description: 'Fifth field'
        }
      };

      const result = validator.validateSchemaStructure('TestSchema', schema);
      
      expect(result).toBe(true);
    });

    test('should fail when schema has fewer than 5 fields', () => {
      const schema = {
        Field1: {
          common_variations: ['Field1'],
          weight: 0.5,
          required: true,
          description: 'Test field'
        },
        Field2: {
          common_variations: ['Field2'],
          weight: 0.5,
          required: false,
          description: 'Another field'
        }
      };

      const result = validator.validateSchemaStructure('TestSchema', schema);
      
      expect(result).toBe(false);
      expect(validator.getErrors().length).toBeGreaterThan(0);
    });

    test('should fail when field is missing required properties', () => {
      const schema = {
        Field1: {
          common_variations: ['Field1'],
          weight: 0.5
          // missing 'required' and 'description'
        },
        Field2: {
          common_variations: ['Field2'],
          weight: 0.3,
          required: false,
          description: 'Field 2'
        },
        Field3: {
          common_variations: ['Field3'],
          weight: 0.2,
          required: false,
          description: 'Field 3'
        },
        Field4: {
          common_variations: ['Field4'],
          weight: 0.1,
          required: false,
          description: 'Field 4'
        },
        Field5: {
          common_variations: ['Field5'],
          weight: 0.1,
          required: false,
          description: 'Field 5'
        }
      };

      validator.clearErrors();
      const result = validator.validateSchemaStructure('TestSchema', schema);
      
      expect(result).toBe(false);
      expect(validator.getErrors().length).toBeGreaterThan(0);
    });
  });

  describe('validateFieldMappings', () => {
    test('should validate field mappings with common_variations', () => {
      const schema = {
        Field1: {
          common_variations: ['Field1', 'field1', 'FIELD1'],
          weight: 0.5,
          required: true,
          description: 'Test field'
        },
        Field2: {
          common_variations: ['Field2', 'field2'],
          weight: 0.5,
          required: false,
          description: 'Another field'
        }
      };

      const result = validator.validateFieldMappings('TestSchema', schema);
      
      expect(result).toBe(true);
    });

    test('should validate simplified format (array) field mappings', () => {
      const schema = {
        Field1: ['Variation1', 'Variation2', 'Variation3'],
        Field2: ['Var1', 'Var2']
      };

      const result = validator.validateFieldMappings('TestSchema', schema);
      
      expect(result).toBe(true);
    });

    test('should fail when common_variations is empty', () => {
      const schema = {
        Field1: {
          common_variations: [],
          weight: 0.5,
          required: true,
          description: 'Test field'
        }
      };

      validator.clearErrors();
      const result = validator.validateFieldMappings('TestSchema', schema);
      
      expect(result).toBe(false);
      expect(validator.getErrors().length).toBeGreaterThan(0);
    });

    test('should fail when simplified format array is empty', () => {
      const schema = {
        Field1: []
      };

      validator.clearErrors();
      const result = validator.validateFieldMappings('TestSchema', schema);
      
      expect(result).toBe(false);
      expect(validator.getErrors().length).toBeGreaterThan(0);
    });
  });

  describe('validateAllSchemas', () => {
    test('should validate all schemas successfully', () => {
      const result = validator.validateAllSchemas();
      
      expect(result.success).toBe(true);
      expect(result.schemaCount).toBeGreaterThanOrEqual(412);
      expect(result.errors.length).toBe(0);
      expect(result.message).toContain('validated successfully');
    });

    test('should return schema count in result', () => {
      const result = validator.validateAllSchemas();
      
      expect(result.schemaCount).toBeDefined();
      expect(typeof result.schemaCount).toBe('number');
      expect(result.schemaCount).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    test('should collect and return errors', () => {
      const invalidSchema = {
        Field1: {
          // missing all required properties
        }
      };

      validator.clearErrors();
      validator.validateSchemaStructure('TestSchema', invalidSchema);
      
      const errors = validator.getErrors();
      expect(errors.length).toBeGreaterThan(0);
    });

    test('should clear errors', () => {
      const invalidSchema = {
        Field1: {
          // missing all required properties
        }
      };

      validator.validateSchemaStructure('TestSchema', invalidSchema);
      expect(validator.getErrors().length).toBeGreaterThan(0);
      
      validator.clearErrors();
      expect(validator.getErrors().length).toBe(0);
    });
  });
});
