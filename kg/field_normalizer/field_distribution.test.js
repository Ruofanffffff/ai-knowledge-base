/**
 * Field Distribution Statistics - Unit Tests
 * 
 * Tests field distribution tracking and statistics functionality.
 * Validates: Requirement 18.19
 */

const {
  recordUnmappedField,
  recordUnmappedFieldsBatch,
  getHighFrequencyUnmappedFields,
  getFieldDistributionStats,
  getFieldsBySchema,
  getFieldsByType,
  clearOldRecords,
  exportFieldDistribution,
  getSuggestionsForDictionaryExpansion
} = require('./field_distribution');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Field Distribution Statistics - Task 7.13.3', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.fieldDistribution.deleteMany({
      where: {
        fieldName: { startsWith: 'test_' }
      }
    });
  });
  
  afterAll(async () => {
    // Clean up and disconnect
    await prisma.fieldDistribution.deleteMany({
      where: {
        fieldName: { startsWith: 'test_' }
      }
    });
    await prisma.$disconnect();
  });
  
  describe('recordUnmappedField', () => {
    test('should record a new unmapped field', async () => {
      const field = {
        name: 'test_时刻',
        value: '10:30',
        type: 'time'
      };
      
      const result = await recordUnmappedField(field, 'TestSchema');
      
      expect(result).toBeDefined();
      expect(result.fieldName).toBe('test_时刻');
      expect(result.count).toBe(1);
      expect(result.fieldType).toBe('time');
      expect(result.exampleValue).toBe('10:30');
      
      // Verify schemas is stored as JSON string
      const schemas = JSON.parse(result.schemas);
      expect(schemas).toEqual(['TestSchema']);
    });
    
    test('should increment count for existing field', async () => {
      const field = {
        name: 'test_发生时间',
        value: '2025-01-26',
        type: 'time'
      };
      
      // Record first time
      await recordUnmappedField(field, 'Schema1');
      
      // Record second time
      const result = await recordUnmappedField(field, 'Schema1');
      
      expect(result.count).toBe(2);
    });
    
    test('should add new schema to existing field', async () => {
      const field = {
        name: 'test_地方',
        value: '北京',
        type: 'location'
      };
      
      // Record with Schema1
      await recordUnmappedField(field, 'Schema1');
      
      // Record with Schema2
      const result = await recordUnmappedField(field, 'Schema2');
      
      const schemas = JSON.parse(result.schemas);
      expect(schemas).toContain('Schema1');
      expect(schemas).toContain('Schema2');
      expect(result.count).toBe(2);
    });
    
    test('should not duplicate schema names', async () => {
      const field = {
        name: 'test_区',
        value: 'ABC',
        type: 'location'
      };
      
      // Record twice with same schema
      await recordUnmappedField(field, 'Schema1');
      const result = await recordUnmappedField(field, 'Schema1');
      
      const schemas = JSON.parse(result.schemas);
      expect(schemas).toEqual(['Schema1']);
      expect(result.count).toBe(2);
    });
    
    test('should throw error for invalid inputs', async () => {
      await expect(recordUnmappedField(null, 'Schema')).rejects.toThrow();
      await expect(recordUnmappedField({}, 'Schema')).rejects.toThrow();
      await expect(recordUnmappedField({ name: 'test' }, null)).rejects.toThrow();
    });
  });
  
  describe('recordUnmappedFieldsBatch', () => {
    test('should record multiple fields in batch', async () => {
      const fields = [
        { name: 'test_batch1', value: 'v1', type: 'text' },
        { name: 'test_batch2', value: 'v2', type: 'number' },
        { name: 'test_batch3', value: 'v3', type: 'time' }
      ];
      
      const count = await recordUnmappedFieldsBatch(fields, 'BatchSchema');
      
      expect(count).toBe(3);
      
      // Verify all fields were recorded
      const field1 = await prisma.fieldDistribution.findUnique({
        where: { fieldName: 'test_batch1' }
      });
      expect(field1).toBeDefined();
      expect(field1.count).toBe(1);
    });
    
    test('should handle empty array', async () => {
      const count = await recordUnmappedFieldsBatch([], 'Schema');
      expect(count).toBe(0);
    });
    
    test('should throw error for non-array input', async () => {
      await expect(recordUnmappedFieldsBatch(null, 'Schema')).rejects.toThrow();
      await expect(recordUnmappedFieldsBatch('not array', 'Schema')).rejects.toThrow();
    });
  });
  
  describe('getHighFrequencyUnmappedFields', () => {
    beforeEach(async () => {
      // Create test data with different frequencies
      await prisma.fieldDistribution.createMany({
        data: [
          { fieldName: 'test_high1', count: 50, lastSeen: new Date(), schemas: '["S1"]', fieldType: 'time' },
          { fieldName: 'test_high2', count: 30, lastSeen: new Date(), schemas: '["S2"]', fieldType: 'location' },
          { fieldName: 'test_low1', count: 2, lastSeen: new Date(), schemas: '["S3"]', fieldType: 'text' },
          { fieldName: 'test_low2', count: 1, lastSeen: new Date(), schemas: '["S4"]', fieldType: 'number' }
        ]
      });
    });
    
    test('should return high-frequency fields', async () => {
      const fields = await getHighFrequencyUnmappedFields({ minCount: 10, limit: 10 });
      
      expect(fields.length).toBeGreaterThanOrEqual(2);
      
      const fieldNames = fields.map(f => f.fieldName);
      expect(fieldNames).toContain('test_high1');
      expect(fieldNames).toContain('test_high2');
      expect(fieldNames).not.toContain('test_low1');
    });
    
    test('should order by count descending', async () => {
      const fields = await getHighFrequencyUnmappedFields({ minCount: 1, limit: 10 });
      
      for (let i = 0; i < fields.length - 1; i++) {
        expect(fields[i].count).toBeGreaterThanOrEqual(fields[i + 1].count);
      }
    });
    
    test('should respect limit parameter', async () => {
      const fields = await getHighFrequencyUnmappedFields({ minCount: 1, limit: 2 });
      
      expect(fields.length).toBeLessThanOrEqual(2);
    });
    
    test('should support ordering by lastSeen', async () => {
      const fields = await getHighFrequencyUnmappedFields({ 
        minCount: 1, 
        limit: 10, 
        orderBy: 'lastSeen' 
      });
      
      expect(fields).toBeDefined();
      expect(Array.isArray(fields)).toBe(true);
    });
  });
  
  describe('getFieldDistributionStats', () => {
    beforeEach(async () => {
      // Create test data
      await prisma.fieldDistribution.createMany({
        data: [
          { fieldName: 'test_stats1', count: 20, lastSeen: new Date(), schemas: '["S1"]' },
          { fieldName: 'test_stats2', count: 15, lastSeen: new Date(), schemas: '["S2"]' },
          { fieldName: 'test_stats3', count: 5, lastSeen: new Date(), schemas: '["S3"]' }
        ]
      });
    });
    
    test('should return overall statistics', async () => {
      const stats = await getFieldDistributionStats();
      
      expect(stats).toHaveProperty('totalUniqueFields');
      expect(stats).toHaveProperty('totalOccurrences');
      expect(stats).toHaveProperty('avgOccurrencesPerField');
      expect(stats).toHaveProperty('highFrequencyFields');
      expect(stats).toHaveProperty('recentFields');
      
      expect(stats.totalUniqueFields).toBeGreaterThanOrEqual(3);
      expect(stats.totalOccurrences).toBeGreaterThanOrEqual(40);
    });
    
    test('should calculate average correctly', async () => {
      const stats = await getFieldDistributionStats();
      
      expect(stats.avgOccurrencesPerField).toBeGreaterThan(0);
      expect(typeof stats.avgOccurrencesPerField).toBe('number');
    });
  });
  
  describe('getFieldsBySchema', () => {
    beforeEach(async () => {
      await prisma.fieldDistribution.createMany({
        data: [
          { fieldName: 'test_schema1', count: 10, lastSeen: new Date(), schemas: '["SchemaA", "SchemaB"]' },
          { fieldName: 'test_schema2', count: 5, lastSeen: new Date(), schemas: '["SchemaA"]' },
          { fieldName: 'test_schema3', count: 3, lastSeen: new Date(), schemas: '["SchemaC"]' }
        ]
      });
    });
    
    test('should return fields for specific schema', async () => {
      const fields = await getFieldsBySchema('SchemaA');
      
      expect(fields.length).toBeGreaterThanOrEqual(2);
      
      const fieldNames = fields.map(f => f.fieldName);
      expect(fieldNames).toContain('test_schema1');
      expect(fieldNames).toContain('test_schema2');
      expect(fieldNames).not.toContain('test_schema3');
    });
    
    test('should return empty array for non-existent schema', async () => {
      const fields = await getFieldsBySchema('NonExistentSchema');
      
      expect(fields).toEqual([]);
    });
    
    test('should throw error for missing schema name', async () => {
      await expect(getFieldsBySchema(null)).rejects.toThrow();
    });
  });
  
  describe('getFieldsByType', () => {
    beforeEach(async () => {
      await prisma.fieldDistribution.createMany({
        data: [
          { fieldName: 'test_type1', count: 10, lastSeen: new Date(), schemas: '["S1"]', fieldType: 'time' },
          { fieldName: 'test_type2', count: 5, lastSeen: new Date(), schemas: '["S2"]', fieldType: 'time' },
          { fieldName: 'test_type3', count: 3, lastSeen: new Date(), schemas: '["S3"]', fieldType: 'location' }
        ]
      });
    });
    
    test('should return fields of specific type', async () => {
      const fields = await getFieldsByType('time');
      
      expect(fields.length).toBeGreaterThanOrEqual(2);
      
      fields.forEach(field => {
        expect(field.fieldType).toBe('time');
      });
    });
    
    test('should return empty array for non-existent type', async () => {
      const fields = await getFieldsByType('nonexistent');
      
      expect(fields).toEqual([]);
    });
    
    test('should throw error for missing type', async () => {
      await expect(getFieldsByType(null)).rejects.toThrow();
    });
  });
  
  describe('clearOldRecords', () => {
    test('should delete old low-frequency records', async () => {
      // Create old record
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      
      await prisma.fieldDistribution.create({
        data: {
          fieldName: 'test_old',
          count: 2,
          lastSeen: oldDate,
          schemas: '["S1"]'
        }
      });
      
      const deleted = await clearOldRecords(90);
      
      expect(deleted).toBeGreaterThanOrEqual(1);
      
      // Verify record was deleted
      const record = await prisma.fieldDistribution.findUnique({
        where: { fieldName: 'test_old' }
      });
      expect(record).toBeNull();
    });
    
    test('should not delete high-frequency old records', async () => {
      // Create old but high-frequency record
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      
      await prisma.fieldDistribution.create({
        data: {
          fieldName: 'test_old_high',
          count: 50,
          lastSeen: oldDate,
          schemas: '["S1"]'
        }
      });
      
      await clearOldRecords(90);
      
      // Verify record still exists
      const record = await prisma.fieldDistribution.findUnique({
        where: { fieldName: 'test_old_high' }
      });
      expect(record).not.toBeNull();
    });
  });
  
  describe('exportFieldDistribution', () => {
    test('should export all field distribution data', async () => {
      // Create test data
      await prisma.fieldDistribution.createMany({
        data: [
          { fieldName: 'test_export1', count: 10, lastSeen: new Date(), schemas: '["S1"]' },
          { fieldName: 'test_export2', count: 5, lastSeen: new Date(), schemas: '["S2"]' }
        ]
      });
      
      const data = await exportFieldDistribution();
      
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(2);
      
      const fieldNames = data.map(f => f.fieldName);
      expect(fieldNames).toContain('test_export1');
      expect(fieldNames).toContain('test_export2');
    });
  });
  
  describe('getSuggestionsForDictionaryExpansion', () => {
    beforeEach(async () => {
      await prisma.fieldDistribution.createMany({
        data: [
          { fieldName: 'test_suggest1', count: 50, lastSeen: new Date(), schemas: '["S1", "S2"]', fieldType: 'time', exampleValue: '10:30' },
          { fieldName: 'test_suggest2', count: 30, lastSeen: new Date(), schemas: '["S3"]', fieldType: 'location', exampleValue: '北京' },
          { fieldName: 'test_suggest3', count: 20, lastSeen: new Date(), schemas: '["S4"]', fieldType: 'number', exampleValue: '100' }
        ]
      });
    });
    
    test('should return suggestions for dictionary expansion', async () => {
      const suggestions = await getSuggestionsForDictionaryExpansion({ minCount: 10, limit: 10 });
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Check suggestion structure
      if (suggestions.length > 0) {
        expect(suggestions[0]).toHaveProperty('fieldName');
        expect(suggestions[0]).toHaveProperty('count');
        expect(suggestions[0]).toHaveProperty('fieldType');
        expect(suggestions[0]).toHaveProperty('schemas');
        expect(suggestions[0]).toHaveProperty('priority');
        expect(suggestions[0]).toHaveProperty('suggestedStandardField');
      }
    });
    
    test('should sort suggestions by priority', async () => {
      const suggestions = await getSuggestionsForDictionaryExpansion({ minCount: 10, limit: 10 });
      
      for (let i = 0; i < suggestions.length - 1; i++) {
        expect(suggestions[i].priority).toBeGreaterThanOrEqual(suggestions[i + 1].priority);
      }
    });
    
    test('should suggest standard fields based on type', async () => {
      const suggestions = await getSuggestionsForDictionaryExpansion({ minCount: 10, limit: 10 });
      
      const timeSuggestion = suggestions.find(s => s.fieldType === 'time');
      if (timeSuggestion) {
        expect(timeSuggestion.suggestedStandardField).toBe('时间');
      }
      
      const locationSuggestion = suggestions.find(s => s.fieldType === 'location');
      if (locationSuggestion) {
        expect(locationSuggestion.suggestedStandardField).toBe('区域');
      }
    });
    
    test('should respect limit parameter', async () => {
      const suggestions = await getSuggestionsForDictionaryExpansion({ minCount: 1, limit: 2 });
      
      expect(suggestions.length).toBeLessThanOrEqual(2);
    });
  });
});
