/**
 * 检查文档和对应的 KG 状态
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDocumentKGStatus() {
  try {
    console.log('=== 检查文档和 KG 状态 ===\n');
    
    // 1. 获取所有文档
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        title: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });
    
    console.log(`📄 找到 ${documents.length} 个文档:\n`);
    
    if (documents.length === 0) {
      console.log('   没有文档');
      return;
    }
    
    // 2. 对每个文档检查 KG 状态
    for (const doc of documents) {
      console.log(`\n文档 ID: ${doc.id}`);
      console.log(`标题: ${doc.title}`);
      console.log(`创建时间: ${doc.createdAt}`);
      
      // 检查 KG 状态
      const kgStatus = await prisma.kGBuildStatus.findUnique({
        where: { docId: doc.id }
      });
      
      if (kgStatus) {
        console.log(`✅ KG 状态: ${kgStatus.status}`);
        console.log(`   实体数: ${kgStatus.entityCount || 0}`);
        console.log(`   关系数: ${kgStatus.relationCount || 0}`);
        if (kgStatus.errorMessage) {
          console.log(`   错误: ${kgStatus.errorMessage}`);
        }
      } else {
        console.log(`❌ 没有 KG 状态记录`);
      }
      
      // 检查 CKB
      const ckbCount = await prisma.cKB.count({
        where: { docId: doc.id }
      });
      console.log(`   CKB 数量: ${ckbCount}`);
      
      // 检查 KG 实体
      const entityCount = await prisma.kGEntity.count({
        where: { docId: doc.id }
      });
      console.log(`   KG 实体数量: ${entityCount}`);
      
      // 检查 KG 关系
      const relationCount = await prisma.kGRelation.count({
        where: { docId: doc.id }
      });
      console.log(`   KG 关系数量: ${relationCount}`);
    }
    
    console.log('\n=== 检查完成 ===');
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDocumentKGStatus();
