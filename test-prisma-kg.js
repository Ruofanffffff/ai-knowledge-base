const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testKGEntities() {
  try {
    console.log('Testing Prisma client with kg_entities table...');
    
    // 1. 检查现有数据
    const existingEntities = await prisma.kGEntity.findMany();
    console.log('Existing entities count:', existingEntities.length);
    console.log('Existing entities:', existingEntities);
    
    // 2. 删除所有现有数据
    console.log('\nDeleting all existing entities...');
    await prisma.kGEntity.deleteMany();
    console.log('Deleted all entities');
    
    // 3. 创建新的测试数据
    console.log('\nCreating new test entities...');
    const newEntities = await prisma.kGEntity.createMany({
      data: [
        {
          id: 'test-1',
          type: 'ResearchEntity',
          canonicalName: '人工智能',
          schemas: '{}',
          supportedBy: '[]',
          confidence: 0.9
        },
        {
          id: 'test-2',
          type: 'ResearchEntity',
          canonicalName: '机器学习',
          schemas: '{}',
          supportedBy: '[]',
          confidence: 0.85
        }
      ]
    });
    console.log('Created', newEntities.count, 'entities');
    
    // 4. 再次查询数据
    console.log('\nQuerying entities after creation...');
    const entitiesAfterCreation = await prisma.kGEntity.findMany();
    console.log('Entities after creation count:', entitiesAfterCreation.length);
    console.log('Entities after creation:', entitiesAfterCreation);
    
    console.log('\nTest completed successfully!');
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testKGEntities();