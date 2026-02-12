const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    // 查看关系
    const relations = await prisma.kGRelation.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('=== Recent Relations ===');
    console.log(`Total: ${relations.length}`);
    relations.forEach((r, i) => {
      const metadata = JSON.parse(r.metadata || '{}');
      console.log(`${i+1}. ${r.sourceId} -> ${r.targetId}`);
      console.log(`   Type: ${r.type}/${r.subtype}, Confidence: ${r.confidence}`);
      console.log(`   Schema: ${metadata.schema_name}, Field: ${metadata.target_field}`);
    });
    
    // 查看ProjectEntity
    const projects = await prisma.kGEntity.findMany({
      where: { type: 'ProjectEntity' },
      take: 5
    });
    
    console.log('\n=== Project Entities ===');
    projects.forEach((e, i) => {
      const attrs = JSON.parse(e.attributes || '{}');
      console.log(`${i+1}. ${e.canonicalName}`);
      console.log(`   Attributes: ${JSON.stringify(attrs)}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
