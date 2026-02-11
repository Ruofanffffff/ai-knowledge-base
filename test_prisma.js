const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

async function testPrismaConnection() {
  try {
    console.log('Current directory:', process.cwd());
    console.log('Knowledge-base.db path:', path.join(process.cwd(), 'knowledge-base.db'));
    console.log('File exists:', fs.existsSync(path.join(process.cwd(), 'knowledge-base.db')));

    await prisma.$connect();
    console.log('Connected to database');

    const entities = await prisma.kGEntity.findMany();
    console.log('Entities count:', entities.length);
    entities.forEach(e => console.log('-', e.id, e.canonicalName, e.confidence));

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

testPrismaConnection();
