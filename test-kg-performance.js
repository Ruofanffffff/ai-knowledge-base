/**
 * 知识图谱性能测试脚本
 * 测试优化后的并行处理性能
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const kgService = require('./kg/services/kg_service');

async function syncDocuments() {
  console.log('=== 步骤1: 同步文档到knowledge_graph.db ===\n');
  
  const DB_PATH = path.join(__dirname, 'data/users.db');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, async (err) => {
      if (err) {
        return reject(err);
      }
    });
    
    db.all('SELECT id, title, content, type, file_type, metadata FROM documents', [], async (err, rows) => {
      db.close();
      
      if (err) {
        return reject(err);
      }
      
      console.log(`找到 ${rows.length} 个文档\n`);
      
      for (const row of rows) {
        const metadata = row.metadata ? JSON.parse(row.metadata) : {};
        
        try {
          // 检查文档是否已存在
          const existing = await prisma.document.findUnique({
            where: { id: row.id.toString() }
          });
          
          if (!existing) {
            await prisma.document.create({
              data: {
                id: row.id.toString(),
                title: row.title,
                content: row.content,
                type: row.type,
                fileType: row.file_type,
                metadata: JSON.stringify(metadata)
              }
            });
            console.log(`✓ 同步文档: ${row.id} - ${row.title}`);
          } else {
            console.log(`- 文档已存在: ${row.id} - ${row.title}`);
          }
        } catch (error) {
          console.error(`✗ 同步文档失败 ${row.id}:`, error.message);
        }
      }
      
      resolve(rows);
    });
  });
}

async function testKGPerformance(documents) {
  console.log('\n=== 步骤2: 测试知识图谱性能 ===\n');
  
  const results = [];
  
  for (const doc of documents) {
    const metadata = doc.metadata ? JSON.parse(doc.metadata) : {};
    const filePath = metadata.filePath || '';
    
    if (!filePath) {
      console.log(`跳过文档 ${doc.id} (无文件路径)`);
      continue;
    }
    
    console.log(`\n处理文档 ${doc.id}: ${doc.title}`);
    console.log(`文件类型: ${doc.file_type}`);
    console.log(`文件路径: ${filePath}`);
    
    const startTime = Date.now();
    
    try {
      const result = await kgService.buildKnowledgeGraph(
        doc.id.toString(),
        filePath,
        doc.file_type,
        {
          llmClient: null,
          enableSemanticRelations: false,
          enableQualityFilter: true
        }
      );
      
      const duration = Date.now() - startTime;
      
      console.log(`\n✓ 完成 (${(duration / 1000).toFixed(2)}秒)`);
      console.log(`  - CKBs: ${result.ckbs_created}`);
      console.log(`  - 实体: ${result.entities_created}`);
      console.log(`  - 关系: ${result.relations_created.builtin + result.relations_created.cooccurrence}`);
      
      results.push({
        doc_id: doc.id,
        title: doc.title,
        ckbs: result.ckbs_created,
        entities: result.entities_created,
        relations: result.relations_created.builtin + result.relations_created.cooccurrence,
        time_ms: duration,
        time_sec: (duration / 1000).toFixed(2)
      });
      
    } catch (error) {
      console.error(`✗ 失败:`, error.message);
      results.push({
        doc_id: doc.id,
        title: doc.title,
        error: error.message
      });
    }
  }
  
  return results;
}

function printSummary(results) {
  console.log('\n\n=== 性能测试总结 ===\n');
  
  const successful = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);
  
  console.log(`成功: ${successful.length} / ${results.length}`);
  console.log(`失败: ${failed.length} / ${results.length}\n`);
  
  if (successful.length > 0) {
    console.log('成功处理的文档:');
    console.log('─'.repeat(80));
    
    for (const result of successful) {
      console.log(`文档 ${result.doc_id}: ${result.title}`);
      console.log(`  CKBs: ${result.ckbs} | 实体: ${result.entities} | 关系: ${result.relations}`);
      console.log(`  处理时间: ${result.time_sec}秒 (${result.time_ms}ms)`);
      
      if (result.ckbs > 0) {
        const msPerCkb = (result.time_ms / result.ckbs).toFixed(2);
        console.log(`  平均每个CKB: ${msPerCkb}ms`);
      }
      console.log('');
    }
    
    // 计算总体统计
    const totalTime = successful.reduce((sum, r) => sum + r.time_ms, 0);
    const totalCkbs = successful.reduce((sum, r) => sum + r.ckbs, 0);
    const totalEntities = successful.reduce((sum, r) => sum + r.entities, 0);
    const totalRelations = successful.reduce((sum, r) => sum + r.relations, 0);
    
    console.log('─'.repeat(80));
    console.log('总计:');
    console.log(`  总处理时间: ${(totalTime / 1000).toFixed(2)}秒`);
    console.log(`  总CKBs: ${totalCkbs}`);
    console.log(`  总实体: ${totalEntities}`);
    console.log(`  总关系: ${totalRelations}`);
    
    if (totalCkbs > 0) {
      console.log(`  平均每个CKB: ${(totalTime / totalCkbs).toFixed(2)}ms`);
    }
  }
  
  if (failed.length > 0) {
    console.log('\n失败的文档:');
    console.log('─'.repeat(80));
    for (const result of failed) {
      console.log(`文档 ${result.doc_id}: ${result.title}`);
      console.log(`  错误: ${result.error}\n`);
    }
  }
}

async function main() {
  try {
    console.log('知识图谱性能测试\n');
    console.log('测试优化: 并行CKB处理 + 批量关系保存 + 并行置信度更新\n');
    
    // 步骤1: 同步文档
    const documents = await syncDocuments();
    
    // 步骤2: 测试性能
    const results = await testKGPerformance(documents);
    
    // 步骤3: 打印总结
    printSummary(results);
    
    await prisma.$disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('测试失败:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
