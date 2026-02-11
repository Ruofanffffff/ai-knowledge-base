console.log('测试脚本开始...');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  console.log('连接数据库...');
  const count = await prisma.schema.count();
  console.log(`Schema数量: ${count}`);
  
  const schemas = await prisma.schema.findMany({ take: 5 });
  console.log(`前5个Schema:`);
  schemas.forEach(s => console.log(`  - ${s.name}`));
  
  await prisma.$disconnect();
  console.log('测试完成');
}

test().catch(e => {
  console.error('错误:', e);
  process.exit(1);
});
