const { PrismaClient } = require('@prisma/client');
const fieldExtractor = require('./kg/field_extractor/field_extractor');

const prisma = new PrismaClient();

async function test() {
  // Get a few CKBs from document 2
  const ckbs = await prisma.cKB.findMany({
    where: { docId: '2' },
    take: 5
  });
  
  console.log(`Found ${ckbs.length} CKBs\n`);
  
  for (const ckb of ckbs) {
    // Deserialize JSON fields
    const deserializedCKB = {
      ...ckb,
      ckb_id: ckb.id,
      doc_id: ckb.docId,
      source_type: ckb.sourceType,
      source_meta: JSON.parse(ckb.sourceMeta),
      structure: JSON.parse(ckb.structure),
      content: JSON.parse(ckb.content),
      quality: JSON.parse(ckb.quality),
      timestamps: JSON.parse(ckb.timestamps)
    };
    
    console.log(`CKB ${ckb.id}:`);
    console.log(`  Content: "${deserializedCKB.content.text}"`);
    
    // Extract fields
    const fields = await fieldExtractor.extractFields(deserializedCKB, { useCache: false, useLLM: false });
    console.log(`  Extracted ${fields.length} fields:`);
    if (fields.length > 0) {
      fields.slice(0, 5).forEach(f => {
        console.log(`    - ${f.name}: ${f.value} (${f.type}, confidence: ${f.confidence?.toFixed(2)})`);
      });
      if (fields.length > 5) {
        console.log(`    ... and ${fields.length - 5} more`);
      }
    }
    console.log('');
  }
  
  await prisma.$disconnect();
}

test().catch(console.error);
