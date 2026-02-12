/**
 * Analyze schema names to understand their categories
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeSchemas() {
  try {
    const allSchemas = await prisma.schema.findMany({
      where: { active: true },
      select: {
        name: true,
        entityType: true,
        description: true,
        scene: true
      }
    });
    
    console.log(`Total schemas: ${allSchemas.length}\n`);
    
    // 分析schema名称的模式
    console.log('=== Sample Schema Names (first 50) ===');
    allSchemas.slice(0, 50).forEach((s, i) => {
      console.log(`${i+1}. ${s.name} (${s.entityType}) - ${s.description || 'no desc'}`);
    });
    
    // 按名称关键词分组
    const keywords = {
      '购物': ['购物', 'Shopping', 'Purchase', 'Buy', 'Order', 'Product'],
      '旅行': ['旅行', 'Travel', 'Trip', 'Hotel', 'Flight', 'Booking'],
      '工作': ['工作', 'Work', 'Job', 'Task', 'Project', 'Meeting'],
      '生活': ['生活', 'Life', 'Daily', 'Home', 'Family'],
      '政务': ['政务', 'Government', 'Policy', 'Admin', 'Public'],
      '医疗': ['医疗', 'Medical', 'Health', 'Hospital', 'Doctor'],
      '教育': ['教育', 'Education', 'School', 'Course', 'Student'],
      '金融': ['金融', 'Finance', 'Bank', 'Payment', 'Transaction'],
      '代码': ['Code', 'Software', 'Program', 'API', 'Function'],
      '文档': ['Document', 'File', 'Report', 'Contract']
    };
    
    console.log('\n=== Schemas by Keyword Category ===');
    const categorized = {};
    const uncategorized = [];
    
    allSchemas.forEach(s => {
      let found = false;
      for (const [category, kws] of Object.entries(keywords)) {
        if (kws.some(kw => s.name.includes(kw) || (s.description && s.description.includes(kw)))) {
          if (!categorized[category]) categorized[category] = [];
          categorized[category].push(s.name);
          found = true;
          break;
        }
      }
      if (!found) {
        uncategorized.push(s.name);
      }
    });
    
    Object.entries(categorized)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([category, schemas]) => {
        console.log(`${category}: ${schemas.length} schemas`);
        console.log(`  Examples: ${schemas.slice(0, 3).join(', ')}`);
      });
    
    console.log(`\nUncategorized: ${uncategorized.length} schemas`);
    console.log(`  Examples: ${uncategorized.slice(0, 10).join(', ')}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeSchemas();
