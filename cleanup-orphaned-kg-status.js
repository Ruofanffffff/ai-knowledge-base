/**
 * 清理孤立的KG状态记录
 * 删除那些关联文档已被删除的KG状态记录
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupOrphanedKGStatus() {
  console.log('=== 开始清理孤立的KG状态记录 ===\n');
  
  try {
    // 1. 查找所有KG状态记录
    const allStatuses = await prisma.kGBuildStatus.findMany({
      select: {
        id: true,
        docId: true,
        status: true
      }
    });
    
    console.log(`📊 找到 ${allStatuses.length} 个KG状态记录\n`);
    
    if (allStatuses.length === 0) {
      console.log('✅ 没有KG状态记录需要清理');
      return;
    }
    
    // 2. 检查每个状态记录对应的文档是否存在
    const orphanedIds = [];
    
    for (const status of allStatuses) {
      const document = await prisma.document.findUnique({
        where: { id: status.docId }
      });
      
      if (!document) {
        orphanedIds.push(status.id);
        console.log(`❌ 孤立记录: 文档ID ${status.docId} 不存在 (状态: ${status.status})`);
      }
    }
    
    if (orphanedIds.length === 0) {
      console.log('\n✅ 没有发现孤立的KG状态记录');
      return;
    }
    
    console.log(`\n⚠️  发现 ${orphanedIds.length} 个孤立记录\n`);
    
    // 3. 删除孤立的记录
    console.log('🗑️  开始删除孤立记录...\n');
    
    const deleteResult = await prisma.kGBuildStatus.deleteMany({
      where: {
        id: {
          in: orphanedIds
        }
      }
    });
    
    console.log(`✅ 成功删除 ${deleteResult.count} 个孤立的KG状态记录\n`);
    
    // 4. 验证清理结果
    const remainingStatuses = await prisma.kGBuildStatus.count();
    console.log(`📊 剩余KG状态记录: ${remainingStatuses}\n`);
    
    console.log('=== 清理完成 ===');
    
  } catch (error) {
    console.error('\n❌ 清理失败:', error.message);
    console.error('   详细错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行清理
cleanupOrphanedKGStatus();
