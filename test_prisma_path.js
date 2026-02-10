const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

async function testPrismaDatabasePath() {
  try {
    console.log('Current directory:', process.cwd());
    console.log('Expected database path:', path.join(process.cwd(), 'knowledge-base.db'));

    await prisma.$connect();
    console.log('Connected to database');

    // Get database path from Prisma
    const result = await prisma.$queryRaw`PRAGMA database_list`;
    console.log('Database list:', result);

    // Try to query kg_entities table
    const entities = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name='kg_entities'`;
    console.log('kg_entities table exists:', entities.length > 0);

    // List all tables
    const tables = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table'`;
    console.log('All tables:', tables.map(t => t.name));

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

testPrismaDatabasePath();
