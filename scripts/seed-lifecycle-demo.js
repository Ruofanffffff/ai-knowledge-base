/**
 * 生命周期演示数据种子脚本
 * 将部分知识体标记为 stale 和 archived，用于验证前端 UI 效果
 * 
 * 用法: node scripts/seed-lifecycle-demo.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 获取所有知识体
  const bodies = await prisma.knowledgeBody.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, themeName: true, lifecycleStatus: true, lastActiveAt: true },
  });

  console.log(`找到 ${bodies.length} 个知识体\n`);

  if (bodies.length === 0) {
    console.log('没有知识体数据，无法演示');
    return;
  }

  // 打印当前状态
  console.log('当前状态:');
  bodies.forEach((b, i) => {
    console.log(`  ${i + 1}. [${b.lifecycleStatus}] ${b.themeName} (${b.id.slice(0, 8)}...)`);
  });
  console.log('');

  // 策略：把第一个标记为 stale，第二个标记为 archived（如果有的话）
  if (bodies.length >= 1) {
    const staleBody = bodies[0];
    const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    await prisma.knowledgeBody.update({
      where: { id: staleBody.id },
      data: {
        lifecycleStatus: 'stale',
        lastActiveAt: thirtyFiveDaysAgo,
      },
    });
    console.log(`✓ 已将 "${staleBody.themeName}" 标记为 stale (lastActiveAt: 35天前)`);
  }

  if (bodies.length >= 2) {
    const archivedBody = bodies[1];
    const seventyDaysAgo = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000);
    await prisma.knowledgeBody.update({
      where: { id: archivedBody.id },
      data: {
        lifecycleStatus: 'archived',
        lastActiveAt: seventyDaysAgo,
      },
    });
    console.log(`✓ 已将 "${archivedBody.themeName}" 标记为 archived (lastActiveAt: 70天前)`);
  }

  console.log('\n刷新页面即可看到效果:');
  console.log('  - stale 知识体: 灰色"陈旧"标签 + 淡化样式');
  console.log('  - archived 知识体: 默认隐藏，打开"显示已归档"开关后可见，带"恢复"按钮');
  console.log('\n要恢复所有知识体为 active，运行:');
  console.log('  node -e "const{PrismaClient}=require(\'@prisma/client\');new PrismaClient().knowledgeBody.updateMany({data:{lifecycleStatus:\'active\',lastActiveAt:new Date()}}).then(r=>console.log(r))"');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
