/**
 * Integration tests for KG Module initialization
 * 
 * Tests the complete startup flow including schema validation
 */

const kg = require('../index');

describe('KG Module Initialization', () => {
  test('should initialize successfully with schema validation', async () => {
    const result = await kg.initialize();
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.schemaValidation).toBeDefined();
    expect(result.schemaValidation.success).toBe(true);
    expect(result.schemaValidation.schemaCount).toBeGreaterThanOrEqual(412);
    expect(result.message).toContain('schemas');
  });

  test('should validate and load 414 schemas', async () => {
    const result = await kg.initialize();
    
    expect(result.schemaValidation.schemaCount).toBe(414);
    expect(result.message).toContain('414 schemas');
  });

  test('should include schema validation result in response', async () => {
    const result = await kg.initialize();
    
    expect(result.schemaValidation).toHaveProperty('success');
    expect(result.schemaValidation).toHaveProperty('schemaCount');
    expect(result.schemaValidation).toHaveProperty('errors');
    expect(result.schemaValidation).toHaveProperty('message');
  });

  test('should log success message for 414 schemas', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    
    await kg.initialize();
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('414 schemas validated')
    );
    
    consoleSpy.mockRestore();
  });
});
