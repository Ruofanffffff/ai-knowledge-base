const { PrismaClient } = require('@prisma/client');
const schemaManager = require('/Users/ruofanfeng/Documents/trae_projects/kg/schema/schema_manager');
const schemaMatcher = require('/Users/ruofanfeng/Documents/trae_projects/kg/schema/schema_matcher');
const ruleExtractor = require('/Users/ruofanfeng/Documents/trae_projects/kg/field_extractor/rule_extractor');

const prisma = new PrismaClient();

async function testSchemaMatching() {
  try {
    await prisma.$connect();
    console.log('Connected to database');

    // Get schemas
    const schemas = await schemaManager.listSchemas({ active: true });
    console.log('Schemas:', JSON.stringify(schemas, null, 2));

    // Test field extraction
    const text = 'React是一个用于构建用户界面的JavaScript库。它由Facebook开发，用于构建交互式的UI。';
    const fields = ruleExtractor.extractFields(text);
    console.log('Extracted fields:', JSON.stringify(fields, null, 2));

    // Test schema matching
    const schemaMatches = schemaMatcher.matchSchemas(fields, schemas);
    console.log('Schema matches:', JSON.stringify(schemaMatches, null, 2));

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

testSchemaMatching();
