/**
 * Evidence Locator Tests
 * 
 * Tests for the Evidence Locator module that finds entities and relations
 * in the original document text.
 */

const { EvidenceLocator } = require('./evidence_locator');

describe('EvidenceLocator', () => {
  let locator;

  beforeEach(() => {
    locator = new EvidenceLocator({
      contextWindow: 50,
      maxEvidence: 3
    });
  });

  describe('locateEntity', () => {
    it('should locate entity in CKB text', () => {
      const entity = {
        canonical_name: '阿里C区',
        id: 'entity_1'
      };

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: '阿里C区的地下水位在2025年1月下降了10米。阿里C区是重点监测区域。'
        },
        chunks: []
      }];

      const evidence = locator.locateEntity(entity, ckbs);

      expect(evidence.type).toBe('entity');
      expect(evidence.entityName).toBe('阿里C区');
      expect(evidence.locations.length).toBeGreaterThan(0);
      expect(evidence.locations[0].ckbId).toBe('ckb_1');
      expect(evidence.locations[0].matchedText).toBe('阿里C区');
      expect(evidence.confidence).toBeGreaterThan(0);
    });

    it('should locate entity in chunks', () => {
      const entity = {
        canonical_name: '水位',
        id: 'entity_2'
      };

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: '地下水位监测报告'
        },
        chunks: [
          {
            id: 'chunk_1',
            text: '第一段：地下水位在下降。',
            start_offset: 0,
            end_offset: 15
          },
          {
            id: 'chunk_2',
            text: '第二段：水位变化明显。',
            start_offset: 15,
            end_offset: 28
          }
        ]
      }];

      const evidence = locator.locateEntity(entity, ckbs);

      expect(evidence.locations.length).toBeGreaterThan(0);
      expect(evidence.locations.some(loc => loc.chunkId === 'chunk_1')).toBe(true);
      expect(evidence.locations.some(loc => loc.chunkId === 'chunk_2')).toBe(true);
    });

    it('should handle case-insensitive matching', () => {
      const entity = {
        canonical_name: 'Water Level',
        id: 'entity_3'
      };

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: 'The water level is decreasing. WATER LEVEL monitoring is important.'
        },
        chunks: []
      }];

      const evidence = locator.locateEntity(entity, ckbs);

      expect(evidence.locations.length).toBe(2);
      expect(evidence.locations[0].matchedText).toBe('water level');
      expect(evidence.locations[1].matchedText).toBe('WATER LEVEL');
    });

    it('should limit evidence to maxEvidence', () => {
      const entity = {
        canonical_name: '水位',
        id: 'entity_4'
      };

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: '水位下降。水位监测。水位变化。水位分析。水位报告。'
        },
        chunks: []
      }];

      const evidence = locator.locateEntity(entity, ckbs);

      expect(evidence.locations.length).toBe(3); // maxEvidence = 3
    });

    it('should return empty evidence for null entity', () => {
      const evidence = locator.locateEntity(null, []);

      expect(evidence.type).toBe('entity');
      expect(evidence.locations).toEqual([]);
      expect(evidence.confidence).toBe(0);
    });

    it('should return empty evidence when entity not found', () => {
      const entity = {
        canonical_name: 'NonExistent',
        id: 'entity_5'
      };

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: 'Some other text without the entity'
        },
        chunks: []
      }];

      const evidence = locator.locateEntity(entity, ckbs);

      expect(evidence.locations).toEqual([]);
      expect(evidence.confidence).toBe(0);
    });

    it('should calculate confidence based on matches', () => {
      const entity = {
        canonical_name: '测试',
        id: 'entity_6'
      };

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: '测试一次。测试两次。'
        },
        chunks: []
      }];

      const evidence = locator.locateEntity(entity, ckbs);

      expect(evidence.confidence).toBe(1.0); // 2 matches / 2 = 1.0
    });
  });

  describe('locateRelation', () => {
    it('should locate relation by finding co-occurrence', () => {
      const relation = {
        id: 'rel_1',
        type: 'affects'
      };

      const sourceEntity = {
        canonical_name: '降雨',
        id: 'entity_1'
      };

      const targetEntity = {
        canonical_name: '水位',
        id: 'entity_2'
      };

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: '降雨导致水位上升。降雨量增加，水位也随之升高。'
        },
        chunks: []
      }];

      const evidence = locator.locateRelation(relation, sourceEntity, targetEntity, ckbs);

      expect(evidence.type).toBe('relation');
      expect(evidence.sourceEntity).toBe('降雨');
      expect(evidence.targetEntity).toBe('水位');
      expect(evidence.locations.length).toBeGreaterThan(0);
      expect(evidence.confidence).toBeGreaterThan(0);
    });

    it('should locate relation in chunks', () => {
      const relation = {
        id: 'rel_2',
        type: 'causes'
      };

      const sourceEntity = {
        canonical_name: '温度',
        id: 'entity_3'
      };

      const targetEntity = {
        canonical_name: '蒸发',
        id: 'entity_4'
      };

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: '温度与蒸发的关系'
        },
        chunks: [
          {
            id: 'chunk_1',
            text: '温度升高会加速蒸发。',
            start_offset: 0,
            end_offset: 12
          }
        ]
      }];

      const evidence = locator.locateRelation(relation, sourceEntity, targetEntity, ckbs);

      expect(evidence.locations.length).toBeGreaterThan(0);
      expect(evidence.locations[0].chunkId).toBe('chunk_1');
    });

    it('should not match entities too far apart', () => {
      const relation = {
        id: 'rel_3',
        type: 'relates_to'
      };

      const sourceEntity = {
        canonical_name: '开始',
        id: 'entity_5'
      };

      const targetEntity = {
        canonical_name: '结束',
        id: 'entity_6'
      };

      // Create text with entities > 500 chars apart
      const longText = '开始' + 'x'.repeat(600) + '结束';

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: longText
        },
        chunks: []
      }];

      const evidence = locator.locateRelation(relation, sourceEntity, targetEntity, ckbs);

      expect(evidence.locations).toEqual([]);
    });

    it('should return empty evidence for null inputs', () => {
      const evidence = locator.locateRelation(null, null, null, []);

      expect(evidence.type).toBe('relation');
      expect(evidence.locations).toEqual([]);
      expect(evidence.confidence).toBe(0);
    });

    it('should include distance information', () => {
      const relation = {
        id: 'rel_4',
        type: 'affects'
      };

      const sourceEntity = {
        canonical_name: 'A',
        id: 'entity_7'
      };

      const targetEntity = {
        canonical_name: 'B',
        id: 'entity_8'
      };

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: 'A affects B directly.'
        },
        chunks: []
      }];

      const evidence = locator.locateRelation(relation, sourceEntity, targetEntity, ckbs);

      expect(evidence.locations.length).toBeGreaterThan(0);
      expect(evidence.locations[0].distance).toBeDefined();
      expect(evidence.locations[0].sourcePos).toBeDefined();
      expect(evidence.locations[0].targetPos).toBeDefined();
    });
  });

  describe('getEntityContext', () => {
    it('should extract context around entity', () => {
      const entity = {
        canonical_name: '水位',
        id: 'entity_1'
      };

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: '前文内容。地下水位在下降。后文内容。'
        },
        chunks: []
      }];

      const context = locator.getEntityContext(entity, ckbs);

      expect(context.entity).toBe('水位');
      expect(context.contexts.length).toBeGreaterThan(0);
      expect(context.contexts[0].text).toContain('水位');
      expect(context.contexts[0].highlight).toBeDefined();
      expect(context.fullText).toBe(ckbs[0].content.text);
    });

    it('should respect context window size', () => {
      const entity = {
        canonical_name: '测试',
        id: 'entity_2'
      };

      const longPrefix = 'x'.repeat(100);
      const longSuffix = 'y'.repeat(100);
      const text = longPrefix + '测试' + longSuffix;

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: text
        },
        chunks: []
      }];

      const context = locator.getEntityContext(entity, ckbs, { contextWindow: 20 });

      expect(context.contexts[0].text.length).toBeLessThan(50); // 20 before + 2 chars + 20 after
    });

    it('should return full text when entity not found', () => {
      const entity = {
        canonical_name: 'NotFound',
        id: 'entity_3'
      };

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: 'Some text without the entity'
        },
        chunks: []
      }];

      const context = locator.getEntityContext(entity, ckbs);

      expect(context.contexts).toEqual([]);
      expect(context.fullText).toBe(ckbs[0].content.text);
    });

    it('should handle multiple CKBs', () => {
      const entity = {
        canonical_name: '水位',
        id: 'entity_4'
      };

      const ckbs = [
        {
          ckb_id: 'ckb_1',
          content: {
            text: '第一个文档的水位数据。'
          },
          chunks: []
        },
        {
          ckb_id: 'ckb_2',
          content: {
            text: '第二个文档的水位分析。'
          },
          chunks: []
        }
      ];

      const context = locator.getEntityContext(entity, ckbs);

      expect(context.contexts.length).toBe(2);
      expect(context.contexts[0].ckbId).toBe('ckb_1');
      expect(context.contexts[1].ckbId).toBe('ckb_2');
    });

    it('should include chunk information when available', () => {
      const entity = {
        canonical_name: '水位',
        id: 'entity_5'
      };

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: '水位监测'
        },
        chunks: [
          {
            id: 'chunk_1',
            text: '水位监测数据',
            start_offset: 0,
            end_offset: 7
          }
        ]
      }];

      const context = locator.getEntityContext(entity, ckbs);

      expect(context.contexts[0].chunkId).toBe('chunk_1');
    });
  });

  describe('edge cases', () => {
    it('should handle empty CKB array', () => {
      const entity = {
        canonical_name: '测试',
        id: 'entity_1'
      };

      const evidence = locator.locateEntity(entity, []);

      expect(evidence.locations).toEqual([]);
      expect(evidence.confidence).toBe(0);
    });

    it('should handle CKB with empty text', () => {
      const entity = {
        canonical_name: '测试',
        id: 'entity_2'
      };

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: ''
        },
        chunks: []
      }];

      const evidence = locator.locateEntity(entity, ckbs);

      expect(evidence.locations).toEqual([]);
    });

    it('should handle special characters in entity name', () => {
      const entity = {
        canonical_name: '测试(2025)',
        id: 'entity_3'
      };

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: '这是测试(2025)的数据'
        },
        chunks: []
      }];

      const evidence = locator.locateEntity(entity, ckbs);

      expect(evidence.locations.length).toBeGreaterThan(0);
    });

    it('should handle overlapping matches', () => {
      const entity = {
        canonical_name: 'AA',
        id: 'entity_4'
      };

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: 'AAAA'
        },
        chunks: []
      }];

      const evidence = locator.locateEntity(entity, ckbs);

      expect(evidence.locations.length).toBeGreaterThan(0);
    });
  });

  describe('configuration', () => {
    it('should respect custom contextWindow', () => {
      const customLocator = new EvidenceLocator({
        contextWindow: 10
      });

      expect(customLocator.options.contextWindow).toBe(10);
    });

    it('should respect custom maxEvidence', () => {
      const customLocator = new EvidenceLocator({
        maxEvidence: 5
      });

      const entity = {
        canonical_name: 'X',
        id: 'entity_1'
      };

      const ckbs = [{
        ckb_id: 'ckb_1',
        content: {
          text: 'X X X X X X X X'
        },
        chunks: []
      }];

      const evidence = customLocator.locateEntity(entity, ckbs);

      expect(evidence.locations.length).toBe(5);
    });

    it('should use default options when not provided', () => {
      const defaultLocator = new EvidenceLocator();

      expect(defaultLocator.options.contextWindow).toBe(100);
      expect(defaultLocator.options.maxEvidence).toBe(3);
    });
  });
});
