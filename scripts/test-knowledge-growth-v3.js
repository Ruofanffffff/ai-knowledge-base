/**
 * 一次性测试脚本：知识生长测试 v3
 * 将每隔一个碎片的时间戳往前移 48 小时，触发发现，再恢复
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== 知识生长测试 v3 ===\n');

  const fragments = await prisma.cognitiveFragment.findMany({ orderBy: { createdAt: 'asc' } });
  console.log(`共 ${fragments.length} 个碎片\n`);

  // 保存原始时间戳
  const origTimes = {};
  for (const f of fragments) origTimes[f.id] = f.createdAt;

  // 将每隔一个碎片往前移 48 小时（确保每个语义簇内都有时间跨度）
  const shiftMs = 48 * 60 * 60 * 1000;
  for (let i = 0; i < fragments.length; i += 2) {
    const f = fragments[i];
    const newTime = new Date(f.createdAt.getTime() - shiftMs);
    await prisma.cognitiveFragment.update({
      where: { id: f.id },
      data: { createdAt: newTime }
    });
    console.log(`移动 [${i}] ${f.content?.substring(0, 25)}... → ${newTime.toISOString().substring(0,16)}`);
  }

  // 触发主题发现
  console.log('\n触发主题发现...');
  const engine = require('../services/themeDiscoveryEngine');
  try {
    const result = await engine.discover('manual-test');
    console.log('结果:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('失败:', err.message);
  }

  // 恢复时间戳
  console.log('\n恢复时间戳...');
  for (const [id, t] of Object.entries(origTimes)) {
    await prisma.cognitiveFragment.update({ where: { id }, data: { createdAt: t } });
  }

  // 查看最终结果
  const bodies = await prisma.knowledgeBody.findMany();
  console.log(`\n=== 知识体 (${bodies.length}) ===`);
  for (const b of bodies) {
    const fIds = JSON.parse(b.relatedFragmentIds || '[]');
    console.log(`  「${b.themeName}」 阶段:${b.growthPhase} 置信度:${b.confidenceScore.toFixed(3)} 碎片:${fIds.length}`);
  }

  await prisma.$disconnect();
  console.log('\n完成');
}

main().catch(e => { console.error(e); process.exit(1); });
