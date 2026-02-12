/**
 * 为现有文档触发知识图谱生成
 * Trigger KG generation for existing documents
 */

const { initDatabase } = require('./database/initUserDB');
const { onDocumentCreated } = require('./kg/hooks/document_hooks');
const path = require('path');

async function triggerKGForExistingDocs() {
  console.log('开始为现有文档生成知识图谱...');
  
  const userDb = initDatabase();
  
  // 获取所有文档
  userDb.all('SELECT * FROM documents ORDER BY created_at ASC', [], async (err, rows) => {
    if (err) {
      console.error('获取文档失败:', err);
      process.exit(1);
    }
    
    if (!rows || rows.length === 0) {
      console.log('没有找到文档');
      process.exit(0);
    }
    
    console.log(`找到 ${rows.length} 个文档`);
    
    // 逐个处理文档
    for (const row of rows) {
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
      
      console.log(`\n处理文档 ${document.id}: ${document.title}`);
      
      try {
        // 同步触发知识图谱构建
        const result = await onDocumentCreated(document, { 
          async: false,  // 同步执行，等待完成
          skipIfExists: false  // 不跳过已存在的
        });
        
        console.log(`✓ 文档 ${document.id} 知识图谱生成完成:`, result);
      } catch (error) {
        console.error(`✗ 文档 ${document.id} 知识图谱生成失败:`, error.message);
      }
    }
    
    console.log('\n所有文档处理完成！');
    process.exit(0);
  });
}

// 运行
triggerKGForExistingDocs().catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
});
