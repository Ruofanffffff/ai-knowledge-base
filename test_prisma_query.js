const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPrismaQuery() {
  try {
    await prisma.$connect();
    console.log('Connected to database');

    // Try raw query
    const rawEntities = await prisma.$queryRaw`SELECT * FROM kg_entities`;
    console.log('Raw query - Entities count:', rawEntities.length);
    rawEntities.forEach(e => console.log('-', e.id, e.canonical_name, e.confidence));

    // Try Prisma query
    const entities = await prisma.kGEntity.findMany();
    console.log('Prisma query - Entities count:', entities.length);
    entities.forEach(e => console.log('-', e.id, e.canonicalName, e.confidence));

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

testPrismaQuery();
