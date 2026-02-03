/**
 * LLM Mapper Tests
 * 
 * Tests for LLM-based field name mapping functionality.
 */

const llmMapper = require('./llm_mapper');

describe('LLM Mapper', () => {
  describe('mapFieldNameWithLLM', () => {
    test('should map field name using LLM', async () => {
      const rawFieldName = '地区';
      const schemaFieldNames = ['区域', '时间', '指标', '数值', '单位'];
      const field = {
        name: '地区',
        value: '阿里C区',
        type: 'location',
        confidence: 0.95
      };
      const schema = {
        schema_name: '地下水位变化事件',
        scene: '科研/政府',
        core_fields: schemaFieldNames.map(name => ({
          name,
          weight: 0.2,
          required: true
        }))
      };
      
      const mapping = await llmMapper.mapFieldNameWithLLM(
        rawFieldName,
        schemaFieldNames,
        field,
        schema
      );
      
      // Mock LLM should return a mapping
      expect(mapping).toBeDefined();
      
      if (mapping) {
        expect(mapping).toHaveProperty('mapped_name');
        expect(mapping).toHaveProperty('confidence');
        expect(mapping).toHaveProperty('method', 'llm');
        expect(mapping.confidence).toBeGreaterThanOrEqual(0);
        expect(mapping.confidence).toBeLessThanOrEqual(1);
      }
    });
    
    test('should apply intelligent truncating for large field lists', async () => {
      const rawFieldName = '地区';
      const schemaFieldNames = [
        '区域', '时间', '指标', '数值', '单位',
        '描述', '类型', '状态', '来源', '备注'
      ];
      const field = {
        name: '地区',
        value: '阿里C区',
        type: 'location',
        confidence: 0.95
      };
      const schema = {
        schema_name: '地下水位变化事件',
        scene: '科研/政府',
        core_fields: schemaFieldNames.map(name => ({
          name,
          weight: 1.0 / schemaFieldNames.length,
          required: true
        }))
      };
      
      const mapping = await llmMapper.mapFieldNameWithLLM(
        rawFieldName,
        schemaFieldNames,
        field,
        schema
      );
      
      if (mapping && mapping.truncating_info) {
        expect(mapping.truncating_info.total_fields).toBe(schemaFieldNames.length);
        expect(mapping.truncating_info.selected_fields).toBeLessThan(schemaFieldNames.length);
        expect(mapping.truncating_info.token_saved).toBeGreaterThan(0);
      }
    });
    
    test('should return null for low confidence mappings', async () => {
      const rawFieldName = '完全不相关的字段';
      const schemaFieldNames = ['区域', '时间', '指标'];
      const field = {
        name: '完全不相关的字段',
        value: '测试值',
        type: 'unknown',
        confidence: 0.5
      };
      
      const mapping = await llmMapper.mapFieldNameWithLLM(
        rawFieldName,
        schemaFieldNames,
        field,
        null,
        { minConfidence: 0.8 }
      );
      
      // Should return null for low confidence
      expect(mapping).toBeNull();
    });
  });
  
  describe('buildMappingPrompt', () => {
    test('should build valid LLM prompt', () => {
      const rawFieldName = '地区';
      const selectedFields = ['区域', '时间', '指标'];
      const field = {
        name: '地区',
        value: '阿里C区',
        type: 'location',
        confidence: 0.95
      };
      const schema = {
        schema_name: '地下水位变化事件',
        scene: '科研/政府'
      };
      
      const prompt = llmMapper.buildMappingPrompt(
        rawFieldName,
        selectedFields,
        field,
        schema
      );
      
      expect(prompt).toContain('原始字段名: 地区');
      expect(prompt).toContain('字段值: 阿里C区');
      expect(prompt).toContain('字段类型: location');
      expect(prompt).toContain('1. 区域');
      expect(prompt).toContain('2. 时间');
      expect(prompt).toContain('3. 指标');
      expect(prompt).toContain('Schema 场景: 科研/政府');
      expect(prompt).toContain('Schema 名称: 地下水位变化事件');
    });
    
    test('should build prompt without schema info', () => {
      const rawFieldName = '地区';
      const selectedFields = ['区域', '时间'];
      const field = {
        name: '地区',
        value: '阿里C区',
        type: 'location',
        confidence: 0.95
      };
      
      const prompt = llmMapper.buildMappingPrompt(
        rawFieldName,
        selectedFields,
        field,
        null
      );
      
      expect(prompt).toContain('原始字段名: 地区');
      expect(prompt).not.toContain('Schema 场景');
      expect(prompt).not.toContain('Schema 名称');
    });
  });
  
  describe('validateLLMResponse', () => {
    test('should validate correct response', () => {
      const response = {
        mapped_name: '区域',
        confidence: 0.85,
        reason: '字段名称相似'
      };
      const selectedFields = ['区域', '时间', '指标'];
      const allFields = ['区域', '时间', '指标', '数值', '单位'];
      
      const validation = llmMapper.validateLLMResponse(
        response,
        selectedFields,
        allFields
      );
      
      expect(validation.valid).toBe(true);
    });
    
    test('should validate null mapping', () => {
      const response = {
        mapped_name: null,
        confidence: 0,
        reason: '无法映射'
      };
      const selectedFields = ['区域', '时间'];
      const allFields = ['区域', '时间', '指标'];
      
      const validation = llmMapper.validateLLMResponse(
        response,
        selectedFields,
        allFields
      );
      
      expect(validation.valid).toBe(true);
    });
    
    test('should reject response with invalid confidence', () => {
      const response = {
        mapped_name: '区域',
        confidence: 1.5, // Invalid: > 1
        reason: '测试'
      };
      const selectedFields = ['区域', '时间'];
      const allFields = ['区域', '时间'];
      
      const validation = llmMapper.validateLLMResponse(
        response,
        selectedFields,
        allFields
      );
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('Confidence');
    });
    
    test('should reject response with field not in schema', () => {
      const response = {
        mapped_name: '不存在的字段',
        confidence: 0.85,
        reason: '测试'
      };
      const selectedFields = ['区域', '时间'];
      const allFields = ['区域', '时间', '指标'];
      
      const validation = llmMapper.validateLLMResponse(
        response,
        selectedFields,
        allFields
      );
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('not in schema fields');
    });
    
    test('should accept response with field in full list but not in selected', () => {
      const response = {
        mapped_name: '指标',
        confidence: 0.85,
        reason: '测试'
      };
      const selectedFields = ['区域', '时间']; // '指标' not in selected
      const allFields = ['区域', '时间', '指标']; // But in full list
      
      const validation = llmMapper.validateLLMResponse(
        response,
        selectedFields,
        allFields
      );
      
      expect(validation.valid).toBe(true);
    });
  });
  
  describe('batchMapFieldNames', () => {
    test('should batch map multiple fields', async () => {
      const requests = [
        {
          rawFieldName: '地区',
          schemaFieldNames: ['区域', '时间', '指标'],
          field: { name: '地区', value: '阿里C区', type: 'location', confidence: 0.95 },
          schema: {
            schema_name: 'Test Schema 1',
            scene: '科研/政府',
            core_fields: [
              { name: '区域', weight: 0.5, required: true },
              { name: '时间', weight: 0.3, required: true },
              { name: '指标', weight: 0.2, required: true }
            ]
          }
        },
        {
          rawFieldName: '日期',
          schemaFieldNames: ['区域', '时间', '指标'],
          field: { name: '日期', value: '2025-01', type: 'time', confidence: 0.95 },
          schema: {
            schema_name: 'Test Schema 2',
            scene: '科研/政府',
            core_fields: [
              { name: '区域', weight: 0.5, required: true },
              { name: '时间', weight: 0.3, required: true },
              { name: '指标', weight: 0.2, required: true }
            ]
          }
        }
      ];
      
      const results = await llmMapper.batchMapFieldNames(requests);
      
      expect(results).toHaveLength(2);
      expect(Array.isArray(results)).toBe(true);
    });
    
    test('should handle empty batch', async () => {
      const results = await llmMapper.batchMapFieldNames([]);
      
      expect(results).toHaveLength(0);
      expect(Array.isArray(results)).toBe(true);
    });
  });
  
  describe('getLLMStats', () => {
    test('should calculate statistics for mapping results', () => {
      const mappingResults = [
        {
          mapped_name: '区域',
          confidence: 0.85,
          method: 'llm',
          truncating_info: { token_saved: 10 }
        },
        {
          mapped_name: '时间',
          confidence: 0.90,
          method: 'llm',
          truncating_info: { token_saved: 8 }
        },
        null, // Failed mapping
        {
          mapped_name: '指标',
          confidence: 0.75,
          method: 'llm',
          truncating_info: { token_saved: 12 }
        }
      ];
      
      const stats = llmMapper.getLLMStats(mappingResults);
      
      expect(stats.total).toBe(4);
      expect(stats.successful).toBe(3);
      expect(stats.failed).toBe(1);
      expect(stats.avg_confidence).toBeCloseTo(0.833, 2);
      expect(stats.total_tokens_saved).toBe(30);
      expect(stats.avg_tokens_saved).toBe(7.5);
    });
    
    test('should handle empty results', () => {
      const stats = llmMapper.getLLMStats([]);
      
      expect(stats.total).toBe(0);
      expect(stats.successful).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.avg_confidence).toBe(0);
      expect(stats.total_tokens_saved).toBe(0);
      expect(stats.avg_tokens_saved).toBe(0);
    });
  });
  
  describe('setLLMClient', () => {
    test('should set custom LLM client', () => {
      const customClient = {
        call: async (prompt) => ({
          mapped_name: '区域',
          confidence: 0.95,
          reason: 'Custom client mapping'
        })
      };
      
      expect(() => {
        llmMapper.setLLMClient(customClient);
      }).not.toThrow();
    });
    
    test('should reject invalid client', () => {
      const invalidClient = {
        // Missing call() method
      };
      
      expect(() => {
        llmMapper.setLLMClient(invalidClient);
      }).toThrow('LLM client must have a call() method');
    });
  });
});
