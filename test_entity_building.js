const { PrismaClient } = require('@prisma/client');
const schemaManager = require('/Users/ruofanfeng/Documents/trae_projects/kg/schema/schema_manager');
const schemaMatcher = require('/Users/ruofanfeng/Documents/trae_projects/kg/schema/schema_matcher');
const ruleExtractor = require('/Users/ruofanfeng/Documents/trae_projects/kg/field_extractor/rule_extractor');
const fieldNormalizer = require('/Users/ruofanfeng/Documents/trae_projects/kg/field_normalizer/field_normalizer');
const entityBuilder = require('/Users/ruofanfeng/Documents/trae_projects/kg/entity/entity_builder');

const prisma = new PrismaClient();

async function testEntityBuilding() {
  try {
    await prisma.$connect();
    console.log('Connected to database');

    // Get schemas
    const schemas = await schemaManager.listSchemas({ active: true });

    // Test field extraction
    const text = 'React是一个用于构建用户界面的JavaScript库。它由Facebook开发，用于构建交互式的UI。';
    const fields = ruleExtractor.extractFields(text);
    console.log('Extracted fields:', JSON.stringify(fields, null, 2));

    // Test schema matching
    const schemaMatches = schemaMatcher.matchSchemas(fields, schemas);
    console.log('Schema matches:', JSON.stringify(schemaMatches, null, 2));

    // Test field normalization
    if (schemaMatches.length > 0) {
      const match = schemaMatches[0];
      console.log('Match schema:', JSON.stringify(match.schema, null, 2));
      
      try {
        const normalizedFields = await fieldNormalizer.normalizeFields(fields, match.schema, { useLLM: false });
        console.log('Normalized fields:', JSON.stringify(normalizedFields, null, 2));
        
        // Test entity building
        const entity = await entityBuilder.buildEntity(match, normalizedFields, { ckb_id: 'test', doc_id: 'test', content: { text } }, { useLLM: false });
        console.log('Entity:', JSON.stringify(entity, null, 2));
      } catch (error) {
        console.error('Error during normalization/entity building:', error);
      }
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

testEntityBuilding();
