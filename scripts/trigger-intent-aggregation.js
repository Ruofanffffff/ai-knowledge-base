/**
 * 触发意图聚合脚本
 * 
 * 1. 补全缺失 themeEmbedding 的知识体
 * 2. 清理最近的 completed 日志（让增量检查通过）
 * 3. 直接触发 discover('manual')，包含 Stage 4 意图聚合
 * 
 * 运行: node scripts/trigger-intent-aggregation.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const embeddingService = require('../services/embeddingService');

async function backfillEmbeddings() {
  console.log('=== Step 1: 补全缺失的 themeEmbedding ===\n');

  const bodies = await prisma.knowledgeBody.findMany({
    where: {
      OR: [
        { themeEmbedding: null },
        { themeEmbedding: '' },
      ]
    }
  });

  if (bodies.length === 0) {
    console.log('  所有知识体都已有 embedding，跳过\n');
    return;
  }

  console.log(`  发现 ${bodies.length} 个缺失 embedding 的知识体:\n`);

  for (const body of bodies) {
    const text = body.themeName + (body.themeDescription ? ' ' + body.themeDescription : '');
    console.log(`  生成 embedding: "${body.themeName}"...`);

    try {
      const embedding = await embeddingService.generateEmbedding(text);
      if (embedding) {
        await prisma.knowledgeBody.update({
          where: { id: body.id },
          data: { themeEmbedding: JSON.stringify(embedding) }
        });
        console.log(`    ✓ 成功 (维度: ${embedding.length})`);
      } else {
        console.log(`    ✗ embedding 返回 null，检查 QWEN_API_KEY 配置`);
      }
    } catch (err) {
      console.log(`    ✗ 失败: ${err.message}`);
    }
  }
  console.log('');
}

async function clearRecentLogs() {
  console.log('=== Step 2: 清理最近的 completed 日志 ===\n');

  const deleted = await prisma.themeDiscoveryLog.deleteMany({
    where: { status: { in: ['completed', 'skipped'] } }
  });
  console.log(`  清理了 ${deleted.count} 条日志\n`);
}

async function runDiscovery() {
  console.log('=== Step 3: 触发主题发现 (含 Stage 4 意图聚合) ===\n');

  const engine = require('../services/themeDiscoveryEngine');
  const result = await engine.discover('manual');

  console.log('  发现结果:');
  console.log(JSON.stringify(result, null, 2));
  console.log('');
  return result;
}

async function showFinalState() {
  console.log('=== 最终知识体状态 ===\n');

  const bodies = await prisma.knowledgeBody.findMany({
    orderBy: [{ bodyType: 'asc' }, { confidenceScore: 'desc' }]
  });

  for (const b of bodies) {
    const prefix = b.bodyType === 'intent' ? '📁' : '  📄';
    const parent = b.parentId ? ` (parent: ${b.parentId.substring(0, 8)}...)` : '';
    console.log(`${prefix} [${b.bodyType}] ${b.themeName} | 阶段: ${b.growthPhase} | 置信度: ${b.confidenceScore.toFixed(3)}${parent}`);
  }

  const intentCount = bodies.filter(b => b.bodyType === 'intent').length;
  const withParent = bodies.filter(b => b.parentId !== null).length;
  console.log(`\n  总计: ${bodies.length} 个知识体, ${intentCount} 个意图体, ${withParent} 个有父节点`);
}

async function main() {
  console.log('========================================');
  console.log('  意图聚合触发脚本');
  console.log('========================================\n');

  await backfillEmbeddings();
  await clearRecentLogs();
  await runDiscovery();
  await showFinalState();

  console.log('\n✅ 完成！刷新前端 /knowledge-growth 页面查看树形结构');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('❌ 脚本执行失败:', e);
  prisma.$disconnect();
  process.exit(1);
});
