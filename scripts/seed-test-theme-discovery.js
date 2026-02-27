/**
 * 前端完整效果测试脚本：主题发现引擎三阶段流水线
 * 
 * 功能：
 * 1. 插入模拟认知碎片（多主题、有重叠关键词）
 * 2. 清理上次发现日志（确保增量检查通过）
 * 3. 触发主题发现 discover('manual')
 * 4. 打印结果，刷新前端 /knowledge-growth 即可看到效果
 * 
 * 运行: node scripts/seed-test-theme-discovery.js
 * 
 * 清理: node scripts/seed-test-theme-discovery.js --clean
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 测试用户 ID — 查找或自动创建 admin 用户
async function getTestUserId() {
  let user = await prisma.user.findFirst({ where: { username: 'admin' } });
  if (!user) {
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash('123456', 10);
    user = await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        email: 'admin@test.com',
      },
    });
    console.log('✅ 自动创建测试用户 admin/123456');
  }
  return user.id;
}

// 模拟碎片数据 — 覆盖多个主题，关键词有交叉
const MOCK_FRAGMENTS = [
  // 主题1: 杭州旅行（预期高频关键词: 杭州、西湖、龙井）
  { type: 'note', content: '周末去了杭州西湖，断桥残雪的景色真的很美，还在湖边喝了龙井茶' },
  { type: 'search', content: '杭州西湖附近有什么好吃的餐厅推荐？想找靠近断桥的' },
  { type: 'note', content: '杭州龙井村的茶园很适合拍照，买了两罐明前龙井带回来' },
  { type: 'search', content: '杭州三日游攻略，西湖、灵隐寺、龙井村怎么安排路线' },

  // 主题2: Python 编程（预期高频关键词: Python、FastAPI、异步）
  { type: 'note', content: '今天学了 Python 的 async/await 语法，用 FastAPI 写了一个异步接口' },
  { type: 'search', content: 'Python FastAPI 异步数据库连接池最佳实践' },
  { type: 'note', content: 'Python 的 asyncio 事件循环机制比 Node.js 的更灵活，FastAPI 性能也不错' },

  // 主题3: 咖啡（预期高频关键词: 咖啡、手冲、拿铁）
  { type: 'note', content: '入手了一套手冲咖啡器具，V60 滤杯 + 细口壶，第一次手冲拿铁味道还行' },
  { type: 'search', content: '手冲咖啡和意式咖啡的区别，拿铁用什么豆子比较好' },
  { type: 'note', content: '试了耶加雪菲的咖啡豆做手冲，果酸味很明显，比拿铁更能体现豆子风味' },

  // 跨主题碎片（杭州 + 咖啡）
  { type: 'note', content: '在杭州南山路发现一家很棒的手冲咖啡馆，老板是龙井茶和咖啡双料爱好者' },
];

async function seedFragments(userId) {
  console.log('📝 插入测试碎片...\n');

  const created = [];
  for (let i = 0; i < MOCK_FRAGMENTS.length; i++) {
    const f = MOCK_FRAGMENTS[i];
    // 错开创建时间，模拟真实场景
    const createdAt = new Date(Date.now() - (MOCK_FRAGMENTS.length - i) * 3600 * 1000);
    
    const fragment = await prisma.cognitiveFragment.create({
      data: {
        userId,
        fragmentType: f.type,
        content: f.content,
        sourceId: `test-seed-${Date.now()}-${i}`,
        sourceMeta: JSON.stringify({ source: 'test-seed-script' }),
        createdAt,
      },
    });
    created.push(fragment);
    console.log(`  ✓ [${f.type}] ${f.content.substring(0, 40)}...`);
  }

  console.log(`\n共插入 ${created.length} 条碎片`);
  return created;
}

async function clearPreviousLogs() {
  // 删除之前的 completed 日志，确保增量检查能通过
  const deleted = await prisma.themeDiscoveryLog.deleteMany({
    where: { status: { in: ['completed', 'skipped'] } },
  });
  if (deleted.count > 0) {
    console.log(`🧹 清理了 ${deleted.count} 条旧发现日志`);
  }
}

async function runDiscovery() {
  console.log('\n🚀 触发主题发现...\n');
  
  const engine = require('../services/themeDiscoveryEngine');
  const result = await engine.discover('manual');
  
  console.log('发现结果:');
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function showResults() {
  console.log('\n📊 当前知识体:');
  const bodies = await prisma.knowledgeBody.findMany({
    orderBy: { confidenceScore: 'desc' },
  });

  if (bodies.length === 0) {
    console.log('  (无知识体)');
    return;
  }

  for (const b of bodies) {
    const fIds = JSON.parse(b.relatedFragmentIds || '[]');
    console.log(`  「${b.themeName}」`);
    console.log(`    描述: ${b.themeDescription}`);
    console.log(`    阶段: ${b.growthPhase} | 置信度: ${b.confidenceScore.toFixed(3)} | 碎片: ${fIds.length}`);
  }

  console.log(`\n共 ${bodies.length} 个知识体`);
}

async function cleanAll() {
  console.log('🧹 清理所有测试数据...\n');

  // 删除测试碎片
  const deletedFragments = await prisma.cognitiveFragment.deleteMany({
    where: { sourceMeta: { contains: 'test-seed-script' } },
  });
  console.log(`  删除碎片: ${deletedFragments.count}`);

  // 删除所有知识体（及其关联的节点和演化日志会级联删除）
  const deletedBodies = await prisma.knowledgeBody.deleteMany();
  console.log(`  删除知识体: ${deletedBodies.count}`);

  // 删除发现日志
  const deletedLogs = await prisma.themeDiscoveryLog.deleteMany();
  console.log(`  删除发现日志: ${deletedLogs.count}`);

  // 删除演化日志（级联可能已删，兜底）
  const deletedEvo = await prisma.themeEvolutionLog.deleteMany();
  console.log(`  删除演化日志: ${deletedEvo.count}`);

  console.log('\n✅ 清理完成');
}

async function main() {
  const isClean = process.argv.includes('--clean');

  if (isClean) {
    await cleanAll();
    await prisma.$disconnect();
    return;
  }

  console.log('=== 主题发现引擎 - 前端完整效果测试 ===\n');

  const userId = await getTestUserId();
  console.log(`测试用户: ${userId}\n`);

  // Step 1: 插入碎片
  await seedFragments(userId);

  // Step 2: 清理旧日志
  await clearPreviousLogs();

  // Step 3: 触发发现
  const result = await runDiscovery();

  // Step 4: 展示结果
  await showResults();

  // 提示
  console.log('\n' + '='.repeat(50));
  if (result.status === 'completed' && result.themesFound > 0) {
    console.log('✅ 测试成功！打开前端 /knowledge-growth 页面查看效果');
    console.log('   你应该能看到新发现的知识体卡片');
  } else if (result.status === 'completed' && result.themesFound === 0) {
    console.log('⚠️  发现完成但未产生新主题（可能关键词频率不够）');
    console.log('   检查 LLM 是否正常连接');
  } else if (result.status === 'failed') {
    console.log('❌ 发现失败:', result.reason);
    console.log('   检查 LLM 配置和网络连接');
  } else {
    console.log('ℹ️  状态:', result.status, result.reason || '');
  }
  console.log('\n清理测试数据: node scripts/seed-test-theme-discovery.js --clean');
  console.log('='.repeat(50));

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('❌ 脚本执行失败:', e);
  prisma.$disconnect();
  process.exit(1);
});
