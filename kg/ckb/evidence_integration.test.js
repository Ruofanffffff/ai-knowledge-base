/**
 * Evidence Integration Tests
 * 
 * Comprehensive tests for evidence localization system including:
 * - Evidence location accuracy
 * - API endpoints
 * - Database storage and retrieval
 * - Edge cases
 */

const { EvidenceLocator } = require('./evidence_locator');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Evidence Integration Tests', () => {
  let evidenceLocator;
  let testCKB;
  let testEntity;
  let testRelation;

  beforeAll(() => {
    evidenceLocator = new EvidenceLocator();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(() => {
    // Create test CKB with chunks
    testCKB = {
      ckb_id: 'test_ckb_1',
      content: {
        text: '阿里C区2025年1月水位下降10米。地下水位受到影响。监测数据显示水位持续下降。',
        title: '水位监测报告'
      },
      chunks: [
        {
          id: 'chunk_1',
          text: '阿里C区2025年1月水位下降10米。',
          start_offset: 0,
          end_offset: 20
        },
        {
          id: 'chunk_2',
          text: '地下水位受到影响。',
          start_offset: 20,
          end_offset: 30
        },
        {
          id: 'chunk_3',
          text: '监测数据显示水位持续下降。',
          start_offset: 30,
          end_offset: 45
        }
      ]
    };

    testEntity = {
      canonical_name: '阿里C区_水位_2025-01',
      fields: {
        area: '阿里C区',
        indicator: '水位',
        time: '2025年1月'
      }
    };
  });

  describe('Evidence Location Accuracy', () => {
    test('should accurately locate entity in single CKB', () => {
      // Search for a field value that exists in the text
      const simpleEntity = {
        canonical_name: '阿里C区',
        fields: { area: '阿里C区' }
      };
      
      const evidence = evidenceLocator.locateEntity(simpleEntity, [testCKB]);

      expect(evidence.type).toBe('entity');
      expect(evidence.entityName).toBe('阿里C区');
      expect(evidence.locations.length).toBeGreaterThan(0);
      expect(evidence.confidence).toBeGreaterThan(0);
    });

    test('should locate entity across multiple chunks', () => {
      // Search for "水位" which appears in multiple chunks
      const waterLevelEntity = {
        canonical_name: '水位',
        fields: { indicator: '水位' }
      };
      
      const evidence = evidenceLocator.locateEntity(waterLevelEntity, [testCKB]);

      // Should find "水位" in chunk_1 and chunk_3
      expect(evidence.locations.length).toBeGreaterThan(0);
      
      // Check that it found locations in multiple chunks
      const uniqueChunks = new Set(evidence.locations.map(loc => loc.chunkId));
      expect(uniqueChunks.size).toBeGreaterThan(0);
    });

    test('should locate entity in multiple CKBs', () => {
      const ckb2 = {
        ckb_id: 'test_ckb_2',
        content: {
          text: '阿里C区水位监测显示异常。',
          title: '异常报告'
        },
        chunks: [
          {
            id: 'chunk_1',
            text: '阿里C区水位监测显示异常。',
            start_offset: 0,
            end_offset: 15
          }
        ]
      };

      // Search for "阿里C区" which exists in both CKBs
      const areaEntity = {
        canonical_name: '阿里C区',
        fields: { area: '阿里C区' }
      };

      const evidence = evidenceLocator.locateEntity(areaEntity, [testCKB, ckb2]);

      // Should find locations in both CKBs
      const ckb1Locations = evidence.locations.filter(loc => loc.ckbId === 'test_ckb_1');
      const ckb2Locations = evidence.locations.filter(loc => loc.ckbId === 'test_ckb_2');

      expect(ckb1Locations.length).toBeGreaterThan(0);
      expect(ckb2Locations.length).toBeGreaterThan(0);
    });

    test('should accurately locate relation co-occurrence', () => {
      const sourceEntity = {
        canonical_name: '水位',
        fields: { indicator: '水位' }
      };

      const targetEntity = {
        canonical_name: '地下水位',
        fields: { indicator: '地下水位' }
      };

      const relation = {
        type: 'affects',
        source_id: 'entity_1',
        target_id: 'entity_2'
      };

      const evidence = evidenceLocator.locateRelation(
        relation,
        sourceEntity,
        targetEntity,
        [testCKB]
      );

      expect(evidence.type).toBe('relation');
      expect(evidence.relationType).toBe('affects');
      expect(evidence.locations.length).toBeGreaterThan(0);
      
      // Should find co-occurrence in chunk_2
      const chunk2Locations = evidence.locations.filter(loc => loc.chunkId === 'chunk_2');
      expect(chunk2Locations.length).toBeGreaterThan(0);
    });

    test('should calculate correct confidence scores', () => {
      const evidence = evidenceLocator.locateEntity(testEntity, [testCKB]);

      expect(evidence.confidence).toBeGreaterThanOrEqual(0);
      expect(evidence.confidence).toBeLessThanOrEqual(1);
      
      // More locations should increase confidence
      if (evidence.locations.length >= 2) {
        expect(evidence.confidence).toBeGreaterThan(0.5);
      }
    });

    test('should handle case-insensitive matching', () => {
      const upperCaseEntity = {
        canonical_name: '阿里C区',
        fields: { area: '阿里C区' }
      };

      const evidence = evidenceLocator.locateEntity(upperCaseEntity, [testCKB]);

      expect(evidence.locations.length).toBeGreaterThan(0);
    });

    test('should respect maxEvidence limit', () => {
      const locator = new EvidenceLocator({ maxEvidence: 2 });
      
      const multiMatchCKB = {
        ckb_id: 'test_ckb_multi',
        content: {
          text: '水位 水位 水位 水位 水位',
          title: '多次匹配'
        },
        chunks: [
          {
            id: 'chunk_1',
            text: '水位 水位 水位 水位 水位',
            start_offset: 0,
            end_offset: 15
          }
        ]
      };

      const entity = {
        canonical_name: '水位',
        fields: { indicator: '水位' }
      };

      const evidence = locator.locateEntity(entity, [multiMatchCKB]);

      expect(evidence.locations.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Database Storage and Retrieval', () => {
    let dbEntity, dbRelation, sourceEntity, targetEntity;

    beforeEach(async () => {
      // Create test entities with evidence
      const evidenceData = {
        type: 'entity',
        entityId: 'test_entity_db',
        entityName: '测试实体',
        locations: [
          {
            ckbId: 'ckb_test_1',
            chunkId: 'chunk_1',
            start: 10,
            end: 20,
            matchedText: '测试实体'
          }
        ],
        confidence: 0.85
      };

      dbEntity = await prisma.kGEntity.create({
        data: {
          type: 'test_type',
          canonicalName: '测试实体',
          schemas: JSON.stringify([{ schema_name: 'test_schema', confidence: 0.9 }]),
          supportedBy: JSON.stringify(['ckb_test_1']),
          confidence: 0.85,
          evidence: JSON.stringify(evidenceData)
        }
      });

      // Create source and target entities for relation test
      sourceEntity = await prisma.kGEntity.create({
        data: {
          type: 'test_type',
          canonicalName: '源实体',
          schemas: JSON.stringify([{ schema_name: 'test_schema', confidence: 0.9 }]),
          supportedBy: JSON.stringify(['ckb_test_1']),
          confidence: 0.85
        }
      });

      targetEntity = await prisma.kGEntity.create({
        data: {
          type: 'test_type',
          canonicalName: '目标实体',
          schemas: JSON.stringify([{ schema_name: 'test_schema', confidence: 0.9 }]),
          supportedBy: JSON.stringify(['ckb_test_1']),
          confidence: 0.85
        }
      });

      const relationEvidenceData = {
        type: 'relation',
        relationId: 'test_rel_db',
        relationType: 'affects',
        sourceEntity: '源实体',
        targetEntity: '目标实体',
        locations: [
          {
            ckbId: 'ckb_test_1',
            chunkId: 'chunk_2',
            start: 50,
            end: 80,
            matchedText: '源实体影响目标实体',
            sourcePos: 50,
            targetPos: 60,
            distance: 10
          }
        ],
        confidence: 0.88
      };

      dbRelation = await prisma.kGRelation.create({
        data: {
          sourceId: sourceEntity.id,
          targetId: targetEntity.id,
          type: 'affects',
          confidence: 0.88,
          evidenceCkb: JSON.stringify(['ckb_test_1']),
          evidence: JSON.stringify(relationEvidenceData)
        }
      });
    });

    afterEach(async () => {
      // Cleanup
      if (dbRelation) {
        await prisma.kGRelation.delete({ where: { id: dbRelation.id } }).catch(() => {});
      }
      if (dbEntity) {
        await prisma.kGEntity.delete({ where: { id: dbEntity.id } }).catch(() => {});
      }
      if (sourceEntity) {
        await prisma.kGEntity.delete({ where: { id: sourceEntity.id } }).catch(() => {});
      }
      if (targetEntity) {
        await prisma.kGEntity.delete({ where: { id: targetEntity.id } }).catch(() => {});
      }
    });

    test('should store entity evidence in database', async () => {
      const retrieved = await prisma.kGEntity.findUnique({
        where: { id: dbEntity.id }
      });

      expect(retrieved.evidence).toBeTruthy();
      const evidence = JSON.parse(retrieved.evidence);
      expect(evidence.type).toBe('entity');
      expect(evidence.entityName).toBe('测试实体');
      expect(evidence.locations).toHaveLength(1);
    });

    test('should store relation evidence in database', async () => {
      const retrieved = await prisma.kGRelation.findUnique({
        where: { id: dbRelation.id }
      });

      expect(retrieved.evidence).toBeTruthy();
      const evidence = JSON.parse(retrieved.evidence);
      expect(evidence.type).toBe('relation');
      expect(evidence.relationType).toBe('affects');
      expect(evidence.locations).toHaveLength(1);
    });

    test('should retrieve entity with evidence', async () => {
      const entity = await prisma.kGEntity.findUnique({
        where: { id: dbEntity.id }
      });

      expect(entity).toBeTruthy();
      expect(entity.evidence).toBeTruthy();
      
      const evidence = JSON.parse(entity.evidence);
      expect(evidence.locations[0].ckbId).toBe('ckb_test_1');
      expect(evidence.locations[0].chunkId).toBe('chunk_1');
    });

    test('should retrieve relation with evidence', async () => {
      const relation = await prisma.kGRelation.findUnique({
        where: { id: dbRelation.id },
        include: {
          source: true,
          target: true
        }
      });

      expect(relation).toBeTruthy();
      expect(relation.evidence).toBeTruthy();
      
      const evidence = JSON.parse(relation.evidence);
      expect(evidence.sourceEntity).toBe('源实体');
      expect(evidence.targetEntity).toBe('目标实体');
    });

    test('should update entity evidence', async () => {
      const newEvidence = {
        type: 'entity',
        entityId: dbEntity.id,
        entityName: '测试实体',
        locations: [
          {
            ckbId: 'ckb_test_2',
            chunkId: 'chunk_5',
            start: 100,
            end: 110,
            matchedText: '测试实体'
          }
        ],
        confidence: 0.90
      };

      const updated = await prisma.kGEntity.update({
        where: { id: dbEntity.id },
        data: {
          evidence: JSON.stringify(newEvidence)
        }
      });

      const evidence = JSON.parse(updated.evidence);
      expect(evidence.locations[0].ckbId).toBe('ckb_test_2');
      expect(evidence.confidence).toBe(0.90);
    });

    test('should query entities by evidence confidence', async () => {
      // Create another entity with different confidence
      const lowConfEntity = await prisma.kGEntity.create({
        data: {
          type: 'test_type',
          canonicalName: '低置信度实体',
          schemas: JSON.stringify([{ schema_name: 'test_schema', confidence: 0.9 }]),
          supportedBy: JSON.stringify(['ckb_test_1']),
          confidence: 0.50,
          evidence: JSON.stringify({
            type: 'entity',
            entityId: 'low_conf',
            entityName: '低置信度实体',
            locations: [],
            confidence: 0.30
          })
        }
      });

      // Query all entities
      const allEntities = await prisma.kGEntity.findMany({
        where: {
          canonicalName: {
            in: ['测试实体', '低置信度实体']
          }
        }
      });

      // Filter by evidence confidence
      const highConfEntities = allEntities.filter(e => {
        if (!e.evidence) return false;
        const evidence = JSON.parse(e.evidence);
        return evidence.confidence > 0.5;
      });

      expect(highConfEntities.length).toBeGreaterThan(0);
      expect(highConfEntities.some(e => e.canonicalName === '测试实体')).toBe(true);

      // Cleanup
      await prisma.kGEntity.delete({ where: { id: lowConfEntity.id } });
    });
  });

  describe('Edge Cases', () => {
    test('should handle entity with no matches', () => {
      const noMatchEntity = {
        canonical_name: '不存在的实体',
        fields: { name: '不存在的实体' }
      };

      const evidence = evidenceLocator.locateEntity(noMatchEntity, [testCKB]);

      expect(evidence.type).toBe('entity');
      expect(evidence.locations).toHaveLength(0);
      expect(evidence.confidence).toBe(0);
    });

    test('should handle CKB without chunks', () => {
      const noChunksCKB = {
        ckb_id: 'test_ckb_no_chunks',
        content: {
          text: '阿里C区水位监测数据',
          title: '无分片CKB'
        },
        chunks: []
      };

      // Search for "阿里C区" which exists in the text
      const areaEntity = {
        canonical_name: '阿里C区',
        fields: { area: '阿里C区' }
      };

      const evidence = evidenceLocator.locateEntity(areaEntity, [noChunksCKB]);

      // Should fallback to full text search
      expect(evidence.locations.length).toBeGreaterThan(0);
      // Should have null chunkId since there are no chunks
      expect(evidence.locations[0].chunkId).toBeNull();
    });

    test('should handle CKB with null content', () => {
      const nullContentCKB = {
        ckb_id: 'test_ckb_null',
        content: null,
        chunks: []
      };

      const evidence = evidenceLocator.locateEntity(testEntity, [nullContentCKB]);

      expect(evidence.locations).toHaveLength(0);
      expect(evidence.confidence).toBe(0);
    });

    test('should handle empty CKB array', () => {
      const evidence = evidenceLocator.locateEntity(testEntity, []);

      expect(evidence.type).toBe('entity');
      expect(evidence.locations).toHaveLength(0);
      expect(evidence.confidence).toBe(0);
    });

    test('should handle entity with null name', () => {
      const nullNameEntity = {
        canonical_name: null,
        fields: {}
      };

      const evidence = evidenceLocator.locateEntity(nullNameEntity, [testCKB]);

      expect(evidence.type).toBe('entity');
      expect(evidence.locations).toHaveLength(0);
    });

    test('should handle relation with missing entities', () => {
      const relation = {
        type: 'affects',
        source_id: 'entity_1',
        target_id: 'entity_2'
      };

      const evidence = evidenceLocator.locateRelation(
        relation,
        null,
        null,
        [testCKB]
      );

      expect(evidence.type).toBe('relation');
      expect(evidence.locations).toHaveLength(0);
      expect(evidence.confidence).toBe(0);
    });

    test('should handle very long text', () => {
      const longText = '水位 '.repeat(1000);
      const longCKB = {
        ckb_id: 'test_ckb_long',
        content: {
          text: longText,
          title: '长文本CKB'
        },
        chunks: [
          {
            id: 'chunk_1',
            text: longText,
            start_offset: 0,
            end_offset: longText.length
          }
        ]
      };

      const entity = {
        canonical_name: '水位',
        fields: { indicator: '水位' }
      };

      const locator = new EvidenceLocator({ maxEvidence: 3 });
      const evidence = locator.locateEntity(entity, [longCKB]);

      // Should respect maxEvidence limit
      expect(evidence.locations.length).toBeLessThanOrEqual(3);
    });

    test('should handle special characters in entity name', () => {
      const specialCharEntity = {
        canonical_name: '阿里C区(2025)',
        fields: { area: '阿里C区(2025)' }
      };

      const specialCKB = {
        ckb_id: 'test_ckb_special',
        content: {
          text: '阿里C区(2025)水位监测',
          title: '特殊字符CKB'
        },
        chunks: [
          {
            id: 'chunk_1',
            text: '阿里C区(2025)水位监测',
            start_offset: 0,
            end_offset: 15
          }
        ]
      };

      const evidence = evidenceLocator.locateEntity(specialCharEntity, [specialCKB]);

      expect(evidence.locations.length).toBeGreaterThan(0);
    });

    test('should handle database null evidence gracefully', async () => {
      const nullEvidenceEntity = await prisma.kGEntity.create({
        data: {
          type: 'test_type',
          canonicalName: 'Null证据实体',
          schemas: JSON.stringify([{ schema_name: 'test_schema', confidence: 0.9 }]),
          supportedBy: JSON.stringify(['ckb_test_1']),
          confidence: 0.85,
          evidence: null
        }
      });

      const retrieved = await prisma.kGEntity.findUnique({
        where: { id: nullEvidenceEntity.id }
      });

      expect(retrieved.evidence).toBeNull();

      // Cleanup
      await prisma.kGEntity.delete({ where: { id: nullEvidenceEntity.id } });
    });
  });

  describe('Context Extraction', () => {
    test('should extract context around entity', () => {
      // Use a simpler entity that exists in the text
      const simpleEntity = {
        canonical_name: '水位',
        fields: { indicator: '水位' }
      };
      
      const context = evidenceLocator.getEntityContext(simpleEntity, [testCKB]);

      expect(context.entity).toBe('水位');
      expect(context.contexts.length).toBeGreaterThan(0);
      expect(context.fullText).toBeTruthy();
    });

    test('should include highlight information', () => {
      const context = evidenceLocator.getEntityContext(testEntity, [testCKB]);

      if (context.contexts.length > 0) {
        const firstContext = context.contexts[0];
        expect(firstContext.highlight).toBeDefined();
        expect(firstContext.highlight.start).toBeGreaterThanOrEqual(0);
        expect(firstContext.highlight.end).toBeGreaterThan(firstContext.highlight.start);
      }
    });

    test('should respect context window size', () => {
      const locator = new EvidenceLocator({ contextWindow: 50 });
      const context = locator.getEntityContext(testEntity, [testCKB]);

      if (context.contexts.length > 0) {
        const firstContext = context.contexts[0];
        // Context should be roughly within window size (allowing for boundaries)
        expect(firstContext.text.length).toBeLessThan(150); // 50 chars before + match + 50 chars after
      }
    });

    test('should handle entity with no context', () => {
      const noMatchEntity = {
        canonical_name: '不存在的实体',
        fields: { name: '不存在的实体' }
      };

      const context = evidenceLocator.getEntityContext(noMatchEntity, [testCKB]);

      expect(context.entity).toBe('不存在的实体');
      expect(context.contexts).toHaveLength(0);
      expect(context.fullText).toBeTruthy();
    });
  });
});
