const { PrismaClient } = require('@prisma/client');
const fieldExtractor = require('./kg/field_extractor/field_extractor');
const schemaMatcher = require('./kg/schema/schema_matcher');
const schemaManager = require('./kg/schema/schema_manager');

const prisma = new PrismaClient();

async function test() {
  // Get the longest CKB
  const ckb = await prisma.cKB.findUnique({
    where: { id: 'ac4e363b-b6db-466d-92ce-199ed8917291' }
  });
  
  if (!ckb) {
    console.log('CKB not found');
    return;
  }
  
  // Deserialize
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
  
  console.log(`CKB Content (${deserializedCKB.content.text.length} chars):`);
  console.log(deserializedCKB.content.text);
  console.log('\n--- Field Extraction ---');
  
  // Extract fields
  const fields = await fieldExtractor.extractFields(deserializedCKB, { 
    useCache: false, 
    useLLM: false 
  });
  
  console.log(`\nExtracted ${fields.length} fields:`);
  fields.forEach((f, i) => {
    console.log(`${i+1}. ${f.name}: "${f.value.substring(0, 50)}${f.value.length > 50 ? '...' : ''}" (${f.type}, conf: ${f.confidence?.toFixed(2)})`);
  });
  
  // Get schemas
  console.log('\n--- Schema Matching ---');
  const schemas = await schemaManager.listSchemas({ active: true, forceReload: true });
  console.log(`Loaded ${schemas.length} schemas`);
  
  // Find the generic text schema
  const genericSchema = schemas.find(s => s.name === 'Generic-Text-Content');
  if (genericSchema) {
    console.log(`\nFound Generic-Text-Content schema:`);
    console.log(`  Threshold: ${genericSchema.threshold}`);
    console.log(`  Core fields: ${JSON.stringify(genericSchema.core_fields.map(f => f.name))}`);
  }
  
  // Match schemas
  const schemaMatches = await schemaMatcher.matchSchemas(fields, schemas);
  
  console.log(`\nTop 10 schema matches:`);
  schemaMatches.slice(0, 10).forEach((match, i) => {
    console.log(`${i+1}. ${match.schema_name} (${match.schema.entity_type})`);
    console.log(`   Completeness: ${(match.completeness * 100).toFixed(1)}% (threshold: ${(match.schema.threshold * 100).toFixed(0)}%)`);
    console.log(`   Meets threshold: ${match.completeness >= match.schema.threshold ? 'YES' : 'NO'}`);
    console.log(`   Matched fields: ${match.matched_fields.length}/${match.schema.core_fields.length}`);
  });
  
  await prisma.$disconnect();
}

test().catch(console.error);
