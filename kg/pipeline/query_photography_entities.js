/**
 * 查询数据库中的摄影相关实体
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n' + '='.repeat(100));
  console.log('🔍 查询数据库中的摄影实体');
  console.log('='.repeat(100));

  try {
    // 查询最近创建的摄影相关实体
    const entities = await prisma.kGEntity.findMany({
      where: {
        OR: [
          { type: { contains: 'Photography' } },
          { type: { contains: 'Lens' } },
          { type: { contains: 'Exposure' } }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log(`\n找到 ${entities.length} 个摄影相关实体:\n`);

    entities.forEach((entity, idx) => {
      console.log(`[${idx + 1}] ${entity.canonicalName}`);
      console.log(`    ID: ${entity.id}`);
      console.log(`    类型: ${entity.type}`);
      console.log(`    锚点指纹: ${entity.anchorFingerprint || 'N/A'}`);
      console.log(`    置信度: ${entity.confidence}`);
      console.log(`    创建时间: ${entity.createdAt}`);
      console.log(`    更新时间: ${entity.updatedAt}`);
      
      // 解析属性
      if (entity.attributes) {
        try {
          const attributes = typeof entity.attributes === 'string' 
            ? JSON.parse(entity.attributes) 
            : entity.attributes;
          console.log(`    属性:`);
          Object.entries(attributes).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              console.log(`      ${key}: [${value.join(', ')}]`);
            } else {
              console.log(`      ${key}: ${value}`);
            }
          });
        } catch (e) {
          console.log(`    属性: 解析失败`);
        }
      }
      
      // 解析锚点字段
      if (entity.anchorFields) {
        try {
          const anchorFields = typeof entity.anchorFields === 'string'
            ? JSON.parse(entity.anchorFields)
            : entity.anchorFields;
          console.log(`    锚点字段:`);
          Object.entries(anchorFields).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              console.log(`      ${key}: [${value.join(', ')}]`);
            } else {
              console.log(`      ${key}: ${value}`);
            }
          });
        } catch (e) {
          console.log(`    锚点字段: 解析失败`);
        }
      }
      
      // 解析schemas
      if (entity.schemas) {
        try {
          const schemas = typeof entity.schemas === 'string'
            ? JSON.parse(entity.schemas)
            : entity.schemas;
          console.log(`    关联Schema:`);
          schemas.forEach(schema => {
            console.log(`      - ${schema.schema_name} (置信度: ${schema.confidence || 'N/A'})`);
          });
        } catch (e) {
          console.log(`    关联Schema: 解析失败`);
        }
      }
      
      console.log('');
    });

    // 查询相关的关系
    console.log('\n🔗 查询相关关系:\n');
    
    const entityIds = entities.map(e => e.id);
    const relations = await prisma.kGRelation.findMany({
      where: {
        OR: [
          { sourceId: { in: entityIds } },
          { targetId: { in: entityIds } }
        ]
      },
      take: 20
    });

    console.log(`找到 ${relations.length} 个关系:\n`);
    
    relations.forEach((rel, idx) => {
      console.log(`[${idx + 1}] ${rel.sourceId} --[${rel.type}]--> ${rel.targetId}`);
      console.log(`    权重: ${rel.weight || 'N/A'}`);
      console.log(`    置信度: ${rel.confidence || 'N/A'}`);
      console.log('');
    });

    // 统计信息
    console.log('\n📊 统计信息:');
    console.log('─'.repeat(100));
    
    const totalEntities = await prisma.kGEntity.count();
    const totalRelations = await prisma.kGRelation.count();
    const photographyEntities = await prisma.kGEntity.count({
      where: {
        OR: [
          { type: { contains: 'Photography' } },
          { type: { contains: 'Lens' } },
          { type: { contains: 'Exposure' } }
        ]
      }
    });

    console.log(`数据库中总实体数: ${totalEntities}`);
    console.log(`数据库中总关系数: ${totalRelations}`);
    console.log(`摄影相关实体数: ${photographyEntities}`);

  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n' + '='.repeat(100));
  console.log('✅ 查询完成');
  console.log('='.repeat(100) + '\n');
}

main();
