/**
 * Check schema categories and structure
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchemas() {
  try {
    // 查看schema的字段结构
    const sample = await prisma.schema.findFirst();
    console.log('Schema fields:', Object.keys(sample || {}));
    console.log('\nSample schema:');
    console.log(JSON.stringify(sample, null, 2));
    
    // 统计schema的分类情况
    const allSchemas = await prisma.schema.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        entityType: true,
        scene: true,
        description: true
      }
    });
    
    console.log('\n=== Schema Statistics ===');
    console.log('Total active schemas:', allSchemas.length);
    
    // 按scene分组
    const byScene = {};
    allSchemas.forEach(s => {
      const scene = s.scene || 'uncategorized';
      if (!byScene[scene]) byScene[scene] = [];
      byScene[scene].push(s);
    });
    
    console.log('\n=== Schemas by Scene (Category) ===');
    Object.entries(byScene)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 30)
      .forEach(([scene, schemas]) => {
        console.log(`${scene}: ${schemas.length} schemas`);
      });
    
    // 按entity_type分组
    const byType = {};
    allSchemas.forEach(s => {
      const type = s.entityType || 'uncategorized';
      if (!byType[type]) byType[type] = [];
      byType[type].push(s);
    });
    
    console.log('\n=== Schemas by Entity Type ===');
    Object.entries(byType)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 30)
      .forEach(([type, schemas]) => {
        console.log(`${type}: ${schemas.length} schemas`);
      });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchemas();
