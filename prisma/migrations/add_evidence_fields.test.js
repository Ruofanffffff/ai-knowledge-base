/**
 * Tests for add_evidence_fields migration
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Evidence Fields Migration', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('KGEntity evidence field', () => {
    test('should allow storing evidence data in KGEntity', async () => {
      const evidenceData = {
        type: 'entity',
        entityId: 'test_entity_1',
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

      const entity = await prisma.kGEntity.create({
        data: {
          type: 'test_type',
          canonicalName: '测试实体',
          schemas: JSON.stringify([{ schema_name: 'test_schema', confidence: 0.9 }]),
          supportedBy: JSON.stringify(['ckb_test_1']),
          confidence: 0.85,
          evidence: JSON.stringify(evidenceData)
        }
      });

      expect(entity.evidence).toBeTruthy();
      const parsedEvidence = JSON.parse(entity.evidence);
      expect(parsedEvidence.type).toBe('entity');
      expect(parsedEvidence.entityName).toBe('测试实体');
      expect(parsedEvidence.locations).toHaveLength(1);
      expect(parsedEvidence.confidence).toBe(0.85);

      // Cleanup
      await prisma.kGEntity.delete({ where: { id: entity.id } });
    });

    test('should allow null evidence in KGEntity', async () => {
      const entity = await prisma.kGEntity.create({
        data: {
          type: 'test_type',
          canonicalName: '无证据实体',
          schemas: JSON.stringify([{ schema_name: 'test_schema', confidence: 0.9 }]),
          supportedBy: JSON.stringify(['ckb_test_1']),
          confidence: 0.85,
          evidence: null
        }
      });

      expect(entity.evidence).toBeNull();

      // Cleanup
      await prisma.kGEntity.delete({ where: { id: entity.id } });
    });

    test('should retrieve entity with evidence', async () => {
      const evidenceData = {
        type: 'entity',
        entityId: 'test_entity_2',
        entityName: '检索测试实体',
        locations: [
          {
            ckbId: 'ckb_test_2',
            chunkId: 'chunk_2',
            start: 30,
            end: 45,
            matchedText: '检索测试实体'
          }
        ],
        confidence: 0.90
      };

      const created = await prisma.kGEntity.create({
        data: {
          type: 'test_type',
          canonicalName: '检索测试实体',
          schemas: JSON.stringify([{ schema_name: 'test_schema', confidence: 0.9 }]),
          supportedBy: JSON.stringify(['ckb_test_2']),
          confidence: 0.90,
          evidence: JSON.stringify(evidenceData)
        }
      });

      const retrieved = await prisma.kGEntity.findUnique({
        where: { id: created.id }
      });

      expect(retrieved.evidence).toBeTruthy();
      const parsedEvidence = JSON.parse(retrieved.evidence);
      expect(parsedEvidence.entityName).toBe('检索测试实体');
      expect(parsedEvidence.locations[0].ckbId).toBe('ckb_test_2');

      // Cleanup
      await prisma.kGEntity.delete({ where: { id: created.id } });
    });
  });

  describe('KGRelation evidence field', () => {
    let sourceEntity, targetEntity;

    beforeEach(async () => {
      // Create test entities
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
    });

    afterEach(async () => {
      // Cleanup entities
      if (sourceEntity) {
        await prisma.kGEntity.delete({ where: { id: sourceEntity.id } }).catch(() => {});
      }
      if (targetEntity) {
        await prisma.kGEntity.delete({ where: { id: targetEntity.id } }).catch(() => {});
      }
    });

    test('should allow storing evidence data in KGRelation', async () => {
      const evidenceData = {
        type: 'relation',
        relationId: 'test_rel_1',
        relationType: 'affects',
        sourceEntity: '源实体',
        targetEntity: '目标实体',
        locations: [
          {
            ckbId: 'ckb_test_1',
            chunkId: 'chunk_3',
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

      const relation = await prisma.kGRelation.create({
        data: {
          sourceId: sourceEntity.id,
          targetId: targetEntity.id,
          type: 'affects',
          confidence: 0.88,
          evidenceCkb: JSON.stringify(['ckb_test_1']),
          evidence: JSON.stringify(evidenceData)
        }
      });

      expect(relation.evidence).toBeTruthy();
      const parsedEvidence = JSON.parse(relation.evidence);
      expect(parsedEvidence.type).toBe('relation');
      expect(parsedEvidence.relationType).toBe('affects');
      expect(parsedEvidence.locations).toHaveLength(1);
      expect(parsedEvidence.confidence).toBe(0.88);

      // Cleanup
      await prisma.kGRelation.delete({ where: { id: relation.id } });
    });

    test('should allow null evidence in KGRelation', async () => {
      const relation = await prisma.kGRelation.create({
        data: {
          sourceId: sourceEntity.id,
          targetId: targetEntity.id,
          type: 'relates_to',
          confidence: 0.75,
          evidenceCkb: JSON.stringify(['ckb_test_1']),
          evidence: null
        }
      });

      expect(relation.evidence).toBeNull();

      // Cleanup
      await prisma.kGRelation.delete({ where: { id: relation.id } });
    });

    test('should retrieve relation with evidence', async () => {
      const evidenceData = {
        type: 'relation',
        relationId: 'test_rel_2',
        relationType: 'contains',
        sourceEntity: '源实体',
        targetEntity: '目标实体',
        locations: [
          {
            ckbId: 'ckb_test_1',
            chunkId: 'chunk_4',
            start: 100,
            end: 130,
            matchedText: '源实体包含目标实体',
            sourcePos: 100,
            targetPos: 110,
            distance: 10
          }
        ],
        confidence: 0.92
      };

      const created = await prisma.kGRelation.create({
        data: {
          sourceId: sourceEntity.id,
          targetId: targetEntity.id,
          type: 'contains',
          confidence: 0.92,
          evidenceCkb: JSON.stringify(['ckb_test_1']),
          evidence: JSON.stringify(evidenceData)
        }
      });

      const retrieved = await prisma.kGRelation.findUnique({
        where: { id: created.id }
      });

      expect(retrieved.evidence).toBeTruthy();
      const parsedEvidence = JSON.parse(retrieved.evidence);
      expect(parsedEvidence.relationType).toBe('contains');
      expect(parsedEvidence.locations[0].ckbId).toBe('ckb_test_1');

      // Cleanup
      await prisma.kGRelation.delete({ where: { id: created.id } });
    });
  });

  describe('Backward compatibility', () => {
    test('should work with existing entities without evidence', async () => {
      const entity = await prisma.kGEntity.create({
        data: {
          type: 'test_type',
          canonicalName: '旧实体',
          schemas: JSON.stringify([{ schema_name: 'test_schema', confidence: 0.9 }]),
          supportedBy: JSON.stringify(['ckb_test_1']),
          confidence: 0.85
          // No evidence field
        }
      });

      expect(entity.evidence).toBeNull();

      // Should be able to update with evidence later
      const updated = await prisma.kGEntity.update({
        where: { id: entity.id },
        data: {
          evidence: JSON.stringify({
            type: 'entity',
            entityId: entity.id,
            entityName: '旧实体',
            locations: [],
            confidence: 0.85
          })
        }
      });

      expect(updated.evidence).toBeTruthy();

      // Cleanup
      await prisma.kGEntity.delete({ where: { id: entity.id } });
    });
  });
});
