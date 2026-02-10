const { PrismaClient } = require('@prisma/client');
const schemaManager = require('/Users/ruofanfeng/Documents/trae_projects/kg/schema/schema_manager');

const prisma = new PrismaClient();

async function testSchemaManager() {
  try {
    await prisma.$connect();
    console.log('Connected to database');

    const schemas = await schemaManager.listSchemas({ active: true });
    console.log('Schemas:', JSON.stringify(schemas, null, 2));

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

testSchemaManager();
