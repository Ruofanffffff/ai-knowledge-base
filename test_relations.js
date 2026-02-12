/**
 * Test relation building
 */

const { PrismaClient } = require('@prisma/client');
const cooccurrenceRelationBuilder = require('./kg/relation/cooccurrence_relation_builder');

const prisma = new PrismaClient();

async function test() {
  try {
    // Get some CKBs with entities
    const ckbs = await prisma.cKB.findMany({
      where: { docId: '2' },
      take: 10
    });
    
    console.log(`Found ${ckbs.length} CKBs`);
    
    // Deserialize and check entities
    const deserializedCKBs = ckbs.map(ckb => ({
      ...ckb,
      ckb_id: ckb.id,
      doc_id: ckb.docId,
      source_type: ckb.sourceType,
      source_meta: JSON.parse(ckb.sourceMeta),
      structure: JSON.parse(ckb.structure),
      content: JSON.parse(ckb.content),
      quality: JSON.parse(ckb.quality),
      timestamps: JSON.parse(ckb.timestamps),
      entities: [] // Will be populated
    }));
    
    // Get entities for these CKBs
    const entities = await prisma.kGEntity.findMany({
      take: 20
    });
    
    console.log(`Found ${entities.length} entities`);
    
    // Assign entities to CKBs based on supported_by
    for (const entity of entities) {
      const supportedBy = JSON.parse(entity.supportedBy);
      for (const ckbId of supportedBy) {
        const ckb = deserializedCKBs.find(c => c.ckb_id === ckbId);
        if (ckb) {
          if (!ckb.entities) {
            ckb.entities = [];
          }
          ckb.entities.push({
            id: entity.id,
            entity_id: entity.id,
            canonical_name: entity.canonicalName,
            type: entity.type
          });
        }
      }
    }
    
    // Count CKBs with multiple entities
    const ckbsWithMultipleEntities = deserializedCKBs.filter(c => c.entities && c.entities.length >= 2);
    console.log(`CKBs with 2+ entities: ${ckbsWithMultipleEntities.length}`);
    
    if (ckbsWithMultipleEntities.length > 0) {
      console.log('\nExample CKB with multiple entities:');
      const example = ckbsWithMultipleEntities[0];
      console.log(`  CKB ID: ${example.ckb_id}`);
      console.log(`  Content: ${example.content.text.substring(0, 100)}`);
      console.log(`  Entities: ${example.entities.map(e => e.canonical_name).join(', ')}`);
    }
    
    // Try to build cooccurrence relations
    console.log('\n--- Building Cooccurrence Relations ---');
    const relations = await cooccurrenceRelationBuilder.buildCooccurrenceRelations(
      deserializedCKBs,
      {
        weightThreshold: 0.5,
        minCooccurrences: 1
      }
    );
    
    console.log(`\nBuilt ${relations.length} cooccurrence relations`);
    
    if (relations.length > 0) {
      console.log('\nFirst 5 relations:');
      relations.slice(0, 5).forEach((rel, i) => {
        console.log(`${i+1}. ${rel.source_id} -> ${rel.target_id}`);
        console.log(`   Type: ${rel.type}, Weight: ${rel.weight}, Confidence: ${rel.confidence}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
