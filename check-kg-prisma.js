/**
 * 使用 Prisma 检查知识图谱状态
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkKGStatus() {
  console.log('=== 知识图谱状态检查 (Prisma) ===\n');

  try {
    // 检查实体数量
    const entityCount = await prisma.kGEntity.count();
    console.log(`✓ 实体总数: ${entityCount}`);

    // 检查关系数量
    const relationCount = await prisma.kGRelation.count();
    console.log(`✓ 关系总数: ${relationCount}`);

    // 检查最近的实体
    const recentEntities = await prisma.kGEntity.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        canonicalName: true,
        type: true,
        confidence: true,
        createdAt: true
      }
    });

    console.log('\n最近创建的 5 个实体:');
    recentEntities.forEach((entity, i) => {
      console.log(`  ${i + 1}. ${entity.canonicalName} (${entity.type}) - 置信度: ${entity.confidence}`);
    });

    // 检查关系（包括描述）
    const recentRelations = await prisma.kGRelation.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        type: true,
        subtype: true,
        metadata: true,
        sourceId: true,
        targetId: true
      }
    });

    console.log('\n最近创建的 5 个关系:');
    for (const relation of recentRelations) {
      // 获取源和目标实体名称
      const sourceEntity = await prisma.kGEntity.findUnique({
        where: { id: relation.sourceId },
        select: { canonicalName: true }
      });
      const targetEntity = await prisma.kGEntity.findUnique({
        where: { id: relation.targetId },
        select: { canonicalName: true }
      });

      const metadata = relation.metadata ? JSON.parse(relation.metadata) : {};
      const description = metadata.description || '(无描述)';
      
      console.log(`  ${recentRelations.indexOf(relation) + 1}. ${sourceEntity?.canonicalName || '?'} --[${relation.subtype || relation.type}]--> ${targetEntity?.canonicalName || '?'}`);
      console.log(`     描述: ${description}`);
    }

    // 检查是否有描述的关系
    const relationsWithDesc = await prisma.kGRelation.findMany({
      where: {
        metadata: {
          contains: 'description'
        }
      },
      take: 3
    });

    console.log(`\n✓ 有描述的关系数量: ${relationsWithDesc.length > 0 ? '至少 ' + relationsWithDesc.length : '0'}`);
    if (relationsWithDesc.length > 0) {
      console.log('\n示例（带描述的关系）:');
      for (const rel of relationsWithDesc) {
        const metadata = JSON.parse(rel.metadata || '{}');
        console.log(`  - ${metadata.description || '(解析失败)'}`);
      }
    }

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('\n=== 检查完成 ===');
  }
}

checkKGStatus();
