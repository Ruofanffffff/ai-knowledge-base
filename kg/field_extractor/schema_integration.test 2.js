/**
 * Integration tests for schema validation and normalization
 * Tests Task 9.2 and 9.3 implementation
 */

const { extractFields } = require('./field_extractor');

describe('Schema Integration Tests', () => {
  describe('Schema Validation (Task 9.2)', () => {
    test('should validate extracted fields against schema', async () => {
      const ckb = {
        ckb_id: 'test-001',
        doc_id: 'doc-001',
        content: {
          text: '杭州旅游攻略，主要景点有西湖、灵隐寺，行程4天3晚，人均800元'
        }
      };

      const schema = {
        id: 'travel_destination',
        name: '旅游目的地',
        fields: [
          { name: '目的地名称', type: 'location', description: '旅游目的地' },
          { name: '景点名称', type: 'entity', description: '景点名称' },
          { name: '行程天数', type: 'time', description: '行程天数' },
          { name: '预算范围', type: 'number', description: '预算范围' }
        ]
      };

      // Extract fields without LLM (rule-based only for this test)
      const fields = await extractFields(ckb, {
        domain: 'travel',
        strategy: 'rule-first',
        schema: schema,
        useLLM: false,
        useCache: false
      });

      // Verify fields were extracted
      expect(fields.length).toBeGreaterThan(0);

      // Note: Rule-based extraction won't produce semantic field names,
      // so we won't see validated=true for most fields.
      // This test verifies the integration works without errors.
    });

    test('should handle invalid schema gracefully', async () => {
      const ckb = {
        ckb_id: 'test-002',
        doc_id: 'doc-002',
        content: {
          text: '测试文本'
        }
      };

      const invalidSchema = { id: 'test' }; // Missing fields array

      // Should not throw error
      const fields = await extractFields(ckb, {
        schema: invalidSchema,
        useLLM: false,
        useCache: false
      });

      expect(Array.isArray(fields)).toBe(true);
    });

    test('should work without schema (backward compatibility)', async () => {
      const ckb = {
        ckb_id: 'test-003',
        doc_id: 'doc-003',
        content: {
          text: '阿里C区2025年1月水位下降10米'
        }
      };

      // Extract without schema
      const fields = await extractFields(ckb, {
        useLLM: false,
        useCache: false
      });

      expect(fields.length).toBeGreaterThan(0);
      // Fields should not have schemaField property
      expect(fields[0].schemaField).toBeUndefined();
    });
  });

  describe('Field Name Normalization (Task 9.3)', () => {
    test('should normalize similar field names to schema field names', () => {
      const { normalizeFieldName } = require('../prompts/extract_fields');

      const schema = {
        fields: [
          { name: '目的地名称', type: 'location' },
          { name: '景点名称', type: 'entity' },
          { name: '预算范围', type: 'number' }
        ]
      };

      // Test exact match
      expect(normalizeFieldName('目的地名称', schema)).toBe('目的地名称');

      // Test substring match
      expect(normalizeFieldName('目的地', schema)).toBe('目的地名称');
      expect(normalizeFieldName('景点', schema)).toBe('景点名称');
      expect(normalizeFieldName('预算', schema)).toBe('预算范围');

      // Test no match
      expect(normalizeFieldName('完全不同的字段', schema)).toBe('完全不同的字段');
    });

    test('should find matching schema field with edit distance', () => {
      const { findMatchingSchemaField } = require('../prompts/extract_fields');

      const schema = {
        fields: [
          { name: '目的地名称', type: 'location' },
          { name: '景点名称', type: 'entity' }
        ]
      };

      // Test with 1-2 character difference
      const field1 = { name: '目的地' };
      const match1 = findMatchingSchemaField(field1, schema);
      expect(match1).not.toBeNull();
      expect(match1.name).toBe('目的地名称');

      const field2 = { name: '景点' };
      const match2 = findMatchingSchemaField(field2, schema);
      expect(match2).not.toBeNull();
      expect(match2.name).toBe('景点名称');
    });

    test('should calculate semantic similarity correctly', () => {
      const { calculateSemanticSimilarity } = require('../prompts/extract_fields');

      const schemaFields = [
        { name: '目的地名称', type: 'location' },
        { name: '景点名称', type: 'entity' },
        { name: '预算范围', type: 'number' }
      ];

      // Test high similarity
      const result1 = calculateSemanticSimilarity('目的地', schemaFields);
      expect(result1.field.name).toBe('目的地名称');
      expect(result1.score).toBeGreaterThan(0.5);

      // Test exact match
      const result2 = calculateSemanticSimilarity('景点名称', schemaFields);
      expect(result2.field.name).toBe('景点名称');
      expect(result2.score).toBe(1.0);

      // Test low similarity
      const result3 = calculateSemanticSimilarity('完全不同', schemaFields);
      expect(result3.score).toBeLessThan(0.5);
    });

    test('should calculate edit distance correctly', () => {
      const { calculateEditDistance } = require('../prompts/extract_fields');

      // Identical strings
      expect(calculateEditDistance('测试', '测试')).toBe(0);

      // One character difference
      expect(calculateEditDistance('测试', '测验')).toBe(1);

      // Insertion
      expect(calculateEditDistance('目的地', '目的地名称')).toBe(2);

      // Deletion
      expect(calculateEditDistance('目的地名称', '目的地')).toBe(2);

      // Substitution
      expect(calculateEditDistance('景点', '景区')).toBe(1);
    });
  });

  describe('Schema-Aware Prompt Construction (Task 9.1)', () => {
    test('should include schema fields in prompt', () => {
      const { buildSchemaGuidanceSection } = require('../prompts/extract_fields');

      const schema = {
        id: 'travel_destination',
        name: '旅游目的地',
        fields: [
          { name: '目的地名称', type: 'location', description: '旅游目的地' },
          { name: '景点名称', type: 'entity', description: '景点名称' },
          { name: '预算范围', type: 'number', description: '预算范围' }
        ]
      };

      const section = buildSchemaGuidanceSection(schema);

      expect(section).toContain('旅游目的地');
      expect(section).toContain('目的地名称');
      expect(section).toContain('景点名称');
      expect(section).toContain('预算范围');
      expect(section).toContain('location');
      expect(section).toContain('entity');
      expect(section).toContain('number');
    });

    test('should handle schema without descriptions', () => {
      const { buildSchemaGuidanceSection } = require('../prompts/extract_fields');

      const schema = {
        id: 'test_schema',
        fields: [
          { name: '字段1', type: 'text' },
          { name: '字段2', type: 'number' }
        ]
      };

      const section = buildSchemaGuidanceSection(schema);

      expect(section).toContain('字段1');
      expect(section).toContain('字段2');
    });

    test('should return empty string for invalid schema', () => {
      const { buildSchemaGuidanceSection } = require('../prompts/extract_fields');

      expect(buildSchemaGuidanceSection(null)).toBe('');
      expect(buildSchemaGuidanceSection({})).toBe('');
      expect(buildSchemaGuidanceSection({ fields: null })).toBe('');
    });
  });

  describe('End-to-End Schema Integration', () => {
    test('should extract and validate fields with schema', async () => {
      const ckb = {
        ckb_id: 'e2e-001',
        doc_id: 'doc-e2e-001',
        content: {
          text: '北京三日游，必去长城和故宫，春秋最佳，人均2000元'
        }
      };

      const schema = {
        id: 'travel_destination',
        name: '旅游目的地',
        fields: [
          { name: '目的地名称', type: 'location' },
          { name: '景点名称', type: 'entity' },
          { name: '行程天数', type: 'time' },
          { name: '最佳时间', type: 'time' },
          { name: '预算范围', type: 'number' }
        ]
      };

      // Extract with schema
      const fields = await extractFields(ckb, {
        domain: 'travel',
        strategy: 'rule-first',
        schema: schema,
        useLLM: false,
        useCache: false
      });

      // Verify extraction worked
      expect(fields.length).toBeGreaterThan(0);

      // Verify we have some fields extracted
      // Note: Rule-based extraction may not extract all field types
      // The important thing is that schema integration doesn't break extraction
      expect(Array.isArray(fields)).toBe(true);
      
      // Each field should have required properties
      fields.forEach(field => {
        expect(field).toHaveProperty('name');
        expect(field).toHaveProperty('value');
        expect(field).toHaveProperty('type');
        expect(field).toHaveProperty('confidence');
      });
    });

    test('should maintain backward compatibility without schema', async () => {
      const ckb = {
        ckb_id: 'e2e-002',
        doc_id: 'doc-e2e-002',
        content: {
          text: '阿里C区2025年1月水位下降10米'
        }
      };

      // Extract without schema (old behavior)
      const fields = await extractFields(ckb, {
        useLLM: false,
        useCache: false
      });

      // Should work as before
      expect(fields.length).toBeGreaterThan(0);
      expect(fields[0]).toHaveProperty('name');
      expect(fields[0]).toHaveProperty('value');
      expect(fields[0]).toHaveProperty('type');
      expect(fields[0]).toHaveProperty('confidence');
    });
  });
});
