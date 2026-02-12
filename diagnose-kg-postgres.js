/**
 * 诊断知识图谱 - 检查PostgreSQL数据库中的实体和关系
 * 用于验证上传的文档是否生成了知识图谱
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnoseKG() {
  try {
    console.log('=' .repeat(80));
    console.log('📊 知识图谱诊断报告 (PostgreSQL)');
    console.log('=' .repeat(80));

    // 1. 查询所有文档
    console.log('\n📄 第一步：查询所有文档');
    console.log('-'.repeat(80));
    
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (documents.length === 0) {
      console.log('⚠️  没有找到任何文档');
      return;
    }

    console.log(`找到 ${documents.length} 个文档:\n`);
    documents.forEach((doc, index) => {
      console.log(`${index + 1}. ID: ${doc.id}`);
      console.log(`   标题: ${doc.title}`);
      console.log(`   类型: ${doc.fileType || 'N/A'}`);
      console.log(`   创建时间: ${doc.createdAt}`);
      console.log('');
    });

    // 2. 查询KG实体总数
    console.log('\n🔍 第二步：查询KG实体统计');
    console.log('-'.repeat(80));
    
    const totalEntities = await prisma.kGEntity.count();
    console.log(`KG实体总数: ${totalEntities}\n`);

    // 3. 按文档分组统计实体
    const entityStats = await prisma.kGEntity.groupBy({
      by: ['documentId'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    console.log('按文档分组的实体统计:\n');
    
    if (entityStats.length === 0) {
      console.log('⚠️  没有找到任何KG实体');
    } else {
      for (const stat of entityStats) {
        const doc = documents.find(d => d.id === stat.documentId);
        console.log(`文档 ID: ${stat.documentId}`);
        if (doc) {
          console.log(`   文档标题: ${doc.title}`);
        }
        console.log(`   实体数量: ${stat._count.id}`);
        console.log('');
      }
    }

    // 4. 查询最近上传文档的实体详情
    console.log('\n📋 第三步：查询最近上传文档的实体详情');
    console.log('-'.repeat(80));
    
    if (documents.length > 0) {
      const recentDocIds = documents.slice(0, 2).map(d => d.id);
      
      const entities = await prisma.kGEntity.findMany({
        where: {
          documentId: {
            in: recentDocIds
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      if (entities.length === 0) {
        console.log('⚠️  最近上传的文档没有生成任何KG实体！');
        console.log('\n可能的原因:');
        console.log('1. 知识图谱构建失败');
        console.log('2. 文档内容无法提取实体');
        console.log('3. Schema 匹配失败');
        console.log('4. 文档还在处理中');
      } else {
        console.log(`找到 ${entities.length} 个实体:\n`);
        entities.forEach((entity, index) => {
          const doc = documents.find(d => d.id === entity.documentId);
          console.log(`${index + 1}. 实体 ID: ${entity.id}`);
          console.log(`   名称: ${entity.name || entity.canonicalName}`);
          console.log(`   Schema: ${entity.schemaType || '无'}`);
          console.log(`   置信度: ${entity.confidence || 'N/A'}`);
          console.log(`   文档: ${doc ? doc.title : entity.documentId}`);
          console.log(`   创建时间: ${entity.createdAt}`);
          console.log('');
        });
      }
    }

    // 5. 查询关系统计
    console.log('\n🔗 第四步：查询关系统计');
    console.log('-'.repeat(80));
    
    const totalRelations = await prisma.kGRelation.count();
    console.log(`关系总数: ${totalRelations}\n`);

    // 6. 按文档分组统计关系
    const relationStats = await prisma.kGRelation.groupBy({
      by: ['documentId'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    console.log('按文档分组的关系统计:\n');
    
    if (relationStats.length === 0) {
      console.log('⚠️  没有找到任何关系');
    } else {
      for (const stat of relationStats) {
        const doc = documents.find(d => d.id === stat.documentId);
        console.log(`文档 ID: ${stat.documentId}`);
        if (doc) {
          console.log(`   文档标题: ${doc.title}`);
        }
        console.log(`   关系数量: ${stat._count.id}`);
        console.log('');
      }
    }

    // 7. 总结和建议
    console.log('\n💡 第五步：诊断总结和建议');
    console.log('='.repeat(80));
    
    const recentDocs = documents.slice(0, 2);
    const recentDocIds = recentDocs.map(d => d.id);
    const recentEntities = entityStats.filter(s => recentDocIds.includes(s.documentId));
    const recentRelations = relationStats.filter(s => recentDocIds.includes(s.documentId));

    console.log('\n最近上传的文档分析:');
    recentDocs.forEach((doc, index) => {
      console.log(`\n文档 ${index + 1}: ${doc.title}`);
      const entityStat = recentEntities.find(s => s.documentId === doc.id);
      const relationStat = recentRelations.find(s => s.documentId === doc.id);
      
      if (!entityStat) {
        console.log('  ❌ 没有生成实体');
        console.log('  建议: 检查知识图谱构建日志，查看是否有错误');
      } else {
        console.log(`  ✅ 生成了 ${entityStat._count.id} 个实体`);
      }
      
      if (!relationStat) {
        console.log('  ❌ 没有生成关系');
        console.log('  建议: 检查关系提取逻辑');
      } else {
        console.log(`  ✅ 生成了 ${relationStat._count.id} 个关系`);
      }
    });

    console.log('\n图谱混乱问题分析:');
    if (totalEntities > 100) {
      console.log(`  ⚠️  实体总数过多 (${totalEntities} 个)`);
      console.log('  建议: 添加过滤条件，只显示特定文档的实体');
    }
    
    const docsWithoutEntities = documents.filter(doc => 
      !entityStats.find(s => s.documentId === doc.id)
    );
    
    if (docsWithoutEntities.length > 0) {
      console.log(`\n  ⚠️  有 ${docsWithoutEntities.length} 个文档没有生成实体:`);
      docsWithoutEntities.forEach(doc => {
        console.log(`     - ${doc.title} (ID: ${doc.id})`);
      });
    }

    console.log('\n建议的解决方案:');
    console.log('1. 在前端添加文档过滤功能，只显示选中文档的知识图谱');
    console.log('2. 添加实体类型过滤，隐藏不相关的实体');
    console.log('3. 检查知识图谱构建日志，确认最近文档是否成功处理');
    console.log('4. 考虑清理旧的测试数据');
    console.log('5. 修改前端Graph API调用，添加 documentId 参数过滤');

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ 诊断过程中出错:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行诊断
diagnoseKG().catch(console.error);
