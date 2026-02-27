/**
 * 种子脚本：为现有知识体插入主题演化测试数据
 * 用于前端验证主题演化时间线和演化指示器效果
 * 
 * 运行: node scripts/seed-theme-evolution.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 获取所有知识体
  const bodies = await prisma.knowledgeBody.findMany();
  
  if (bodies.length === 0) {
    console.log('没有找到知识体，请先运行主题发现');
    return;
  }

  console.log(`找到 ${bodies.length} 个知识体，开始插入演化测试数据...\n`);

  // 为第一个知识体（五一小众旅拍路线）插入 3 条演化记录
  const body1 = bodies[0];
  console.log(`知识体: ${body1.themeName} (${body1.id})`);

  const evolutions1 = [
    {
      bodyId: body1.id,
      previousThemeName: '五一出行攻略',
      previousThemeDescription: '五一假期出行相关的各类攻略信息',
      newThemeName: '五一小众旅拍路线',
      newThemeDescription: '避开人潮的小众旅拍线路推荐',
      driftScore: 0.42,
      createdAt: new Date('2026-02-20T10:30:00Z'),
    },
    {
      bodyId: body1.id,
      previousThemeName: '五一小众旅拍路线',
      previousThemeDescription: '避开人潮的小众旅拍线路推荐',
      newThemeName: '五一小众旅拍路线',
      newThemeDescription: '9条避开人潮、适合自驾的乡村与滨海旅拍线路',
      driftScore: 0.35,
      createdAt: new Date('2026-02-23T14:15:00Z'),
    },
    {
      bodyId: body1.id,
      previousThemeName: '五一小众旅拍路线',
      previousThemeDescription: '9条避开人潮、适合自驾的乡村与滨海旅拍线路',
      newThemeName: '杭州周边自驾游',
      newThemeDescription: '杭州周边适合自驾的小众景点和旅拍路线',
      driftScore: 0.51,
      createdAt: new Date('2026-02-25T09:00:00Z'),
    },
  ];

  for (const evo of evolutions1) {
    await prisma.themeEvolutionLog.create({ data: evo });
    console.log(`  ✓ ${evo.previousThemeName} → ${evo.newThemeName} (drift: ${evo.driftScore})`);
  }

  // 为第二个知识体（径山寺祈福之旅）插入 1 条演化记录
  if (bodies.length > 1) {
    const body2 = bodies[1];
    console.log(`\n知识体: ${body2.themeName} (${body2.id})`);

    await prisma.themeEvolutionLog.create({
      data: {
        bodyId: body2.id,
        previousThemeName: '杭州寺庙游',
        previousThemeDescription: '杭州周边寺庙参观和祈福活动',
        newThemeName: '径山寺祈福之旅',
        newThemeDescription: '千年禅寺祈事业，唐韵古刹度苦厄',
        driftScore: 0.38,
        createdAt: new Date('2026-02-22T16:45:00Z'),
      },
    });
    console.log(`  ✓ 杭州寺庙游 → 径山寺祈福之旅 (drift: 0.38)`);
  }

  // 验证插入结果
  const totalLogs = await prisma.themeEvolutionLog.count();
  console.log(`\n完成！共插入演化日志，数据库中共 ${totalLogs} 条记录。`);
  console.log('刷新前端 /knowledge-growth 页面即可看到：');
  console.log('  - 知识体卡片上的 🔄 演化指示器');
  console.log('  - 点击知识体进入详情页查看主题演化时间线');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
