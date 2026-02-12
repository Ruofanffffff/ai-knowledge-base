/**
 * 诊断轮询404问题
 * 检查数据库状态和可能的问题
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnosePollingIssue() {
  console.log('=== 开始诊断轮询404问题 ===\n');
  
  try {
    // 1. 检查文档数量
    const documentCount = await prisma.document.count();
    console.log(`📊 数据库状态:`);
    console.log(`   文档总数: ${documentCount}`);
    
    if (documentCount === 0) {
      console.log('\n⚠️  问题诊断:');
      console.log('   数据库中没有文档！');
      console.log('   如果前端显示文档列表，说明浏览器缓存了旧数据。\n');
      console.log('💡 解决方案:');
      console.log('   1. 访问: http://localhost:5173/emergency-cache-clear.html');
      console.log('   2. 点击"清理缓存并刷新"');
      console.log('   3. 或者按 F12 -> Application -> Clear storage\n');
      return;
    }
    
    // 2. 列出所有文档
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        title: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`\n📄 文档列表:`);
    documents.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.title}`);
      console.log(`      ID: ${doc.id}`);
      console.log(`      创建时间: ${doc.createdAt.toLocaleString('zh-CN')}`);
    });
    
    // 3. 检查KG状态
    console.log(`\n🔍 检查KG构建状态:`);
    const kgStatuses = await prisma.kGBuildStatus.findMany({
      include: {
        document: {
          select: {
            title: true
          }
        }
      }
    });
    
    if (kgStatuses.length === 0) {
      console.log('   没有KG构建状态记录');
    } else {
      kgStatuses.forEach((status) => {
        console.log(`   文档: ${status.document?.title || '未知'}`);
        console.log(`   状态: ${status.status}`);
        console.log(`   实体数: ${status.entityCount || 0}`);
        console.log(`   关系数: ${status.relationCount || 0}`);
        if (status.errorMessage) {
          console.log(`   错误: ${status.errorMessage}`);
        }
        console.log('');
      });
    }
    
    // 4. 检查孤立的KG状态（文档已删除但状态还在）
    const orphanedStatuses = await prisma.kGBuildStatus.findMany({
      where: {
        document: null
      }
    });
    
    if (orphanedStatuses.length > 0) {
      console.log(`\n⚠️  发现 ${orphanedStatuses.length} 个孤立的KG状态记录:`);
      console.log('   这些记录关联的文档已被删除，但状态记录还在。');
      orphanedStatuses.forEach((status) => {
        console.log(`   - 文档ID: ${status.docId}`);
        console.log(`     状态: ${status.status}`);
      });
      console.log('\n💡 建议: 清理这些孤立记录');
      console.log('   运行: node cleanup-orphaned-kg-status.js\n');
    }
    
    // 5. 总结
    console.log('\n=== 诊断总结 ===');
    if (documentCount > 0 && orphanedStatuses.length === 0) {
      console.log('✅ 数据库状态正常');
      console.log('   如果仍有404错误，请清理浏览器缓存。');
    } else if (documentCount === 0) {
      console.log('⚠️  数据库为空，需要清理浏览器缓存');
    } else if (orphanedStatuses.length > 0) {
      console.log('⚠️  发现孤立的KG状态记录，建议清理');
    }
    
  } catch (error) {
    console.error('\n❌ 诊断失败:', error.message);
    console.error('   详细错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行诊断
diagnosePollingIssue();
