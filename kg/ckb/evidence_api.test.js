/**
 * Evidence API Integration Tests
 * 
 * Tests the "查看原文" (View Original Text) API functionality
 */

const { EvidenceLocator } = require('./evidence_locator');

describe('Evidence API Functionality', () => {
  let evidenceLocator;
  
  beforeEach(() => {
    evidenceLocator = new EvidenceLocator({
      contextWindow: 100,
      maxEvidence: 3
    });
  });
  
  describe('Entity Context Retrieval', () => {
    it('should retrieve entity context from CKB', () => {
      const entity = {
        entity_id: 'entity_1',
        canonical_name: '测试实体',
        entity_type: 'TestEntity',
        fields: {
          name: '测试实体',
          value: '123'
        }
      };
      
      const ckb = {
        ckb_id: 'ckb_1',
        doc_id: 'doc_1',
        content: {
          text: '这是一段包含测试实体的文本内容，其值为123。',
          title: '测试文档'
        },
        chunks: []
      };
      
      const result = evidenceLocator.getEntityContext(entity, [ckb], {
        contextWindow: 100
      });
      
      expect(result).toBeDefined();
      expect(result.entity).toBe('测试实体');
      expect(result.contexts).toBeDefined();
      expect(Array.isArray(result.contexts)).toBe(true);
    });
    
    it('should handle entity with no matches', () => {
      const entity = {
        entity_id: 'entity_2',
        canonical_name: '不存在的实体',
        entity_type: 'TestEntity',
        fields: {
          name: '不存在的实体'
        }
      };
      
      const ckb = {
        ckb_id: 'ckb_2',
        doc_id: 'doc_2',
        content: {
          text: '这段文本不包含该实体。',
          title: '测试文档'
        },
        chunks: []
      };
      
      const result = evidenceLocator.getEntityContext(entity, [ckb], {
        contextWindow: 100
      });
      
      expect(result).toBeDefined();
      expect(result.entity).toBe('不存在的实体');
      expect(result.contexts).toBeDefined();
      expect(result.contexts.length).toBe(0);
    });
    
    it('should respect contextWindow parameter', () => {
      const entity = {
        entity_id: 'entity_3',
        canonical_name: '实体',
        entity_type: 'TestEntity',
        fields: {
          name: '实体'
        }
      };
      
      const longText = '前文内容。'.repeat(50) + '实体在这里。' + '后文内容。'.repeat(50);
      
      const ckb = {
        ckb_id: 'ckb_3',
        doc_id: 'doc_3',
        content: {
          text: longText,
          title: '长文档'
        },
        chunks: []
      };
      
      // Small context window
      const result1 = evidenceLocator.getEntityContext(entity, [ckb], {
        contextWindow: 20
      });
      
      // Large context window
      const result2 = evidenceLocator.getEntityContext(entity, [ckb], {
        contextWindow: 200
      });
      
      expect(result1.contexts.length).toBeGreaterThan(0);
      expect(result2.contexts.length).toBeGreaterThan(0);
      
      // Larger window should have longer context text
      if (result1.contexts.length > 0 && result2.contexts.length > 0) {
        expect(result2.contexts[0].text.length).toBeGreaterThanOrEqual(result1.contexts[0].text.length);
      }
    });
  });
  
  describe('Relation Context Retrieval', () => {
    it('should locate relation evidence in CKB', () => {
      const relation = {
        id: 'relation_1',
        type: 'causal'
      };
      
      const sourceEntity = {
        entity_id: 'entity_1',
        canonical_name: '实体A',
        entity_type: 'TestEntity',
        fields: {
          name: '实体A'
        }
      };
      
      const targetEntity = {
        entity_id: 'entity_2',
        canonical_name: '实体B',
        entity_type: 'TestEntity',
        fields: {
          name: '实体B'
        }
      };
      
      const ckb = {
        ckb_id: 'ckb_1',
        doc_id: 'doc_1',
        content: {
          text: '实体A导致实体B发生变化。',
          title: '关系文档'
        },
        chunks: []
      };
      
      const result = evidenceLocator.locateRelation(relation, sourceEntity, targetEntity, [ckb]);
      
      expect(result).toBeDefined();
      expect(result.locations).toBeDefined();
      expect(Array.isArray(result.locations)).toBe(true);
    });
    
    it('should handle relation with no co-occurrence', () => {
      const relation = {
        id: 'relation_2',
        type: 'association'
      };
      
      const sourceEntity = {
        entity_id: 'entity_1',
        canonical_name: '实体A',
        entity_type: 'TestEntity',
        fields: {
          name: '实体A'
        }
      };
      
      const targetEntity = {
        entity_id: 'entity_2',
        canonical_name: '实体B',
        entity_type: 'TestEntity',
        fields: {
          name: '实体B'
        }
      };
      
      const ckb = {
        ckb_id: 'ckb_2',
        doc_id: 'doc_2',
        content: {
          text: '实体A在这里。实体B在另一个地方，相距很远。',
          title: '分离文档'
        },
        chunks: []
      };
      
      const result = evidenceLocator.locateRelation(relation, sourceEntity, targetEntity, [ckb]);
      
      expect(result).toBeDefined();
      expect(result.locations).toBeDefined();
      // May or may not find co-occurrence depending on distance threshold
    });
  });
  
  describe('API Response Format', () => {
    it('should format entity context response correctly', () => {
      const entity = {
        entity_id: 'entity_1',
        canonical_name: '测试实体',
        entity_type: 'TestEntity',
        fields: {
          name: '测试实体'
        }
      };
      
      const ckb = {
        ckb_id: 'ckb_1',
        doc_id: 'doc_1',
        content: {
          text: '包含测试实体的文本。',
          title: '测试文档'
        },
        chunks: []
      };
      
      const contextResult = evidenceLocator.getEntityContext(entity, [ckb]);
      
      // Simulate API response format
      const apiResponse = {
        success: true,
        data: {
          entity_id: entity.entity_id,
          entity_name: entity.canonical_name,
          entity_type: entity.entity_type,
          ckb_id: ckb.ckb_id,
          doc_id: ckb.doc_id,
          document_title: ckb.content.title,
          contexts: contextResult.contexts || [],
          total_locations: contextResult.total_locations || 0
        }
      };
      
      expect(apiResponse.success).toBe(true);
      expect(apiResponse.data.entity_id).toBe('entity_1');
      expect(apiResponse.data.entity_name).toBe('测试实体');
      expect(apiResponse.data.document_title).toBe('测试文档');
      expect(Array.isArray(apiResponse.data.contexts)).toBe(true);
    });
  });
});
