/**
 * 快速测试：为单个文档生成知识图谱
 * Quick test: Generate KG for a single document
 */

const { initDatabase } = require('./database/initUserDB');
const { onDocumentCreated } = require('./kg/hooks/document_hooks');

async function quickTest() {
  console.log('快速测试：为文档ID=1生成知识图谱...\n');
  
  const userDb = initDatabase();
  
  // 只获取第一个文档进行测试
  userDb.get('SELECT * FROM documents WHERE id = 1', [], async (err, row) => {
    if (err) {
      console.error('获取文档失败:', err);
      process.exit(1);
    }
    
    if (!row) {
      console.log('文档ID=1不存在');
      process.exit(0);
    }
    
    const document = {
      id: row.id.toString(),
      title: row.title,
      content: row.content,
      type: row.type,
      fileType: row.file_type,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    
    console.log(`文档信息:`);
    console.log(`  ID: ${document.id}`);
    console.log(`  标题: ${document.title}`);
    console.log(`  类型: ${document.fileType}`);
    console.log(`  内容长度: ${document.content.length} 字符\n`);
    
    console.log('开始生成知识图谱...\n');
    
    try {
      const result = await onDocumentCreated(document, { 
        async: false,
        skipIfExists: false
      });
      
      console.log('\n✓ 知识图谱生成完成！');
      console.log('\n结果摘要:');
      console.log(`  模式: ${result.mode}`);
      console.log(`  CKB数量: ${result.result?.ckbs_created || 0}`);
      console.log(`  实体数量: ${result.result?.entities_created || 0}`);
      console.log(`  关系数量: ${JSON.stringify(result.result?.relations_created || {})}`);
      console.log(`  处理时间: ${result.result?.processing_time || 0}ms`);
      
      // 验证数据库
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const entityCount = await prisma.kGEntity.count();
      const relationCount = await prisma.kGRelation.count();
      const ckbCount = await prisma.cKB.count();
      
      console.log('\n数据库验证:');
      console.log(`  CKB记录: ${ckbCount}`);
      console.log(`  实体记录: ${entityCount}`);
      console.log(`  关系记录: ${relationCount}`);
      
      await prisma.$disconnect();
      
      if (entityCount > 0 || relationCount > 0) {
        console.log('\n✓ 成功！现在可以刷新前端页面查看知识图谱。');
      } else {
        console.log('\n⚠ 警告：虽然处理完成，但没有生成实体或关系。');
        console.log('   这可能是因为文档内容太简单，或者Schema匹配失败。');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('\n✗ 知识图谱生成失败:', error.message);
      console.error('\n错误堆栈:', error.stack);
      process.exit(1);
    }
  });
}

// 运行
quickTest();
