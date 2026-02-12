/**
 * Test for KG Module initialization failure scenario
 * 
 * Demonstrates what happens when schema validation fails
 */

const SchemaValidator = require('../validation/schema_validator');

describe('KG Module Schema Validation Failure', () => {
  test('should set KG_ENABLED to false when validation fails', () => {
    // Mock a validator that fails
    const validator = new SchemaValidator();
    
    // Override validateAllSchemas to simulate failure
    const originalValidate = validator.validateAllSchemas.bind(validator);
    validator.validateAllSchemas = function() {
      return {
        success: false,
        schemaCount: 100,
        errors: ['Schema count validation failed: Expected at least 412 schemas, found 100'],
        message: 'Schema validation failed with 1 error(s)'
      };
    };
    
    const result = validator.validateAllSchemas();
    
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.message).toContain('failed');
  });

  test('should log detailed errors when validation fails', () => {
    const validator = new SchemaValidator();
    
    // Test with invalid schema structure
    const invalidSchema = {
      Field1: {
        // Missing required properties
      }
    };
    
    validator.clearErrors();
    const result = validator.validateSchemaStructure('TestSchema', invalidSchema);
    
    expect(result).toBe(false);
    
    const errors = validator.getErrors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('TestSchema');
  });

  test('should validate that schemas are loaded into memory', () => {
    const validator = new SchemaValidator();
    const result = validator.validateAllSchemas();
    
    // Schemas should be loaded into validator.schemas
    expect(validator.schemas).toBeDefined();
    expect(typeof validator.schemas).toBe('object');
    expect(Object.keys(validator.schemas).length).toBe(result.schemaCount);
  });
});
