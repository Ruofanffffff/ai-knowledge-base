/**
 * Unit Tests for Enhanced Field Extractor
 * Tests for domain detection and strategy selection integration
 */

const fieldExtractor = require('./field_extractor');

describe('Enhanced Field Extractor', () => {
  describe('Domain Detection Integration', () => {
    test('should auto-detect travel domain and use semantic-only strategy', async () => {
      const ckb = {
        ckb_id: 'test-001',
        doc_id: 'doc-001',
        content: {
          text: '苏杭四日游，人均800多点，冬天去最合适。主要景点有西湖、乌镇西栅、南浔古镇。风景优美，古镇风情浓郁。建议坐高铁前往。'
        }
      };
      
      const fields = await fieldExtractor.extractFields(ckb, {
        enableDomainDetection: true
      });
      
      expect(Array.isArray(fields)).toBe(true);
      // Travel domain should trigger semantic-only strategy (LLM extraction)
      // Note: This test requires QWEN_API_KEY to be set
    });
    
    test('should respect domain override', async () => {
      const ckb = {
        ckb_id: 'test-002',
        doc_id: 'doc-002',
        content: {
          text: '今天天气很好，我去公园散步。'
        }
      };
      
      const fields = await fieldExtractor.extractFields(ckb, {
        domain: 'travel',
        enableDomainDetection: false
      });
      
      expect(Array.isArray(fields)).toBe(true);
      // Should use travel domain even though content is not travel-related
    });
    
    test('should disable domain detection when enableDomainDetection is false', async () => {
      const ckb = {
        ckb_id: 'test-003',
        doc_id: 'doc-003',
        content: {
          text: '苏杭旅游攻略，景点推荐。'
        }
      };
      
      const fields = await fieldExtractor.extractFields(ckb, {
        enableDomainDetection: false
      });
      
      expect(Array.isArray(fields)).toBe(true);
      // Should use general domain and rule-first strategy
    });
  });
  
  describe('Strategy Selection Integration', () => {
    test('should respect strategy override', async () => {
      const ckb = {
        ckb_id: 'test-004',
        doc_id: 'doc-004',
        content: {
          text: '阿里C区2025年1月水位下降10米'
        }
      };
      
      const fields = await fieldExtractor.extractFields(ckb, {
        strategy: 'rule-first'
      });
      
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
    });
    
    test('should throw error for invalid strategy', async () => {
      const ckb = {
        ckb_id: 'test-005',
        doc_id: 'doc-005',
        content: {
          text: '测试文本'
        }
      };
      
      await expect(
        fieldExtractor.extractFields(ckb, {
          strategy: 'invalid-strategy'
        })
      ).rejects.toThrow('Unknown strategy');
    });
  });
  
  describe('Backward Compatibility', () => {
    test('should work without new parameters (backward compatible)', async () => {
      const ckb = {
        ckb_id: 'test-006',
        doc_id: 'doc-006',
        content: {
          text: '阿里C区2025年1月水位下降10米'
        }
      };
      
      // Call without any new parameters
      const fields = await fieldExtractor.extractFields(ckb);
      
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
    });
    
    test('should work with only old parameters', async () => {
      const ckb = {
        ckb_id: 'test-007',
        doc_id: 'doc-007',
        content: {
          text: '阿里C区2025年1月水位下降10米'
        }
      };
      
      const fields = await fieldExtractor.extractFields(ckb, {
        useLLM: false,
        useRules: true,
        useNER: true
      });
      
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
    });
  });
  
  describe('Strategy Execution', () => {
    test('executeRuleFirst should use rule+NER extraction', async () => {
      const ckb = {
        ckb_id: 'test-008',
        doc_id: 'doc-008',
        content: {
          text: '阿里C区2025年1月水位下降10米'
        }
      };
      
      const fields = await fieldExtractor.executeRuleFirst(
        ckb,
        ckb.content.text,
        {
          useRules: true,
          useNER: true,
          useLLM: false,
          minFieldCount: 3
        }
      );
      
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
    });
    
    test('executeSemanticOnly should use LLM extraction', async () => {
      const ckb = {
        ckb_id: 'test-009',
        doc_id: 'doc-009',
        content: {
          text: '苏杭旅游攻略'
        }
      };
      
      const fields = await fieldExtractor.executeSemanticOnly(
        ckb,
        ckb.content.text,
        'travel',
        null,
        {
          useRules: false,
          useNER: false,
          useLLM: true
        }
      );
      
      expect(Array.isArray(fields)).toBe(true);
      // Note: This test requires QWEN_API_KEY to be set
    });
    
    test('executeHybrid should merge rule+NER and LLM results', async () => {
      const ckb = {
        ckb_id: 'test-010',
        doc_id: 'doc-010',
        content: {
          text: '阿里C区2025年1月水位下降10米'
        }
      };
      
      const fields = await fieldExtractor.executeHybrid(
        ckb,
        ckb.content.text,
        'general',
        null,
        {
          useRules: true,
          useNER: true,
          useLLM: true
        }
      );
      
      expect(Array.isArray(fields)).toBe(true);
      // Note: This test requires QWEN_API_KEY to be set
    });
  });
  
  describe('Parameter Validation', () => {
    test('should handle empty content', async () => {
      const ckb = {
        ckb_id: 'test-011',
        doc_id: 'doc-011',
        content: {
          text: ''
        }
      };
      
      const fields = await fieldExtractor.extractFields(ckb);
      
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBe(0);
    });
    
    test('should handle missing content', async () => {
      const ckb = {
        ckb_id: 'test-012',
        doc_id: 'doc-012',
        content: {}
      };
      
      const fields = await fieldExtractor.extractFields(ckb);
      
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBe(0);
    });
  });
});
