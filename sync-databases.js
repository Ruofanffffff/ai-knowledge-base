/**
 * 同步两个数据库
 * 
 * 问题：users.db 中有文档，但 knowledge_graph.db (Prisma) 中没有对应的记录
 * 解决：提供两个选项
 *   1. 清空 users.db 中的文档（推荐）
 *   2. 为 users.db 中的文档创建 KG 状态记录
 */

const sqlite3 = require('sqlite3').verbose();
const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();
const usersDb = new sqlite3.Database('./data/users.db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function getUsersDbDocuments() {
  return new Promise((resolve, reject) => {
    usersDb.all('SELECT id, title, user_id, created_at FROM documents', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function clearUsersDbDocuments() {
  return new Promise((resolve, reject) => {
    usersDb.run('DELETE FROM documents', function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

async function createKGStatusForDocument(docId) {
  try {
    // 检查是否已存在
    const existing = await prisma.kGStatus.findUnique({
      where: { docId: docId.toString() }
    });
    
    if (existing) {
      console.log(`  文档 ${docId} 的 KG 状态已存在`);
      return;
    }
    
    // 创建新的 KG 状态记录
    await prisma.kGStatus.create({
      data: {
        docId: docId.toString(),
        status: 'pending',
        entityCount: 0,
        relationCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    console.log(`  ✓ 为文档 ${docId} 创建了 KG 状态记录`);
  } catch (error) {
    console.error(`  ✗ 为文档 ${docId} 创建 KG 状态失败:`, error.message);
  }
}

async function main() {
  try {
    console.log('================================================================================');
    console.log('数据库同步工具');
    console.log('================================================================================\n');
    
    // 获取 users.db 中的文档
    const usersDbDocs = await getUsersDbDocuments();
    console.log(`📄 users.db 中的文档数量: ${usersDbDocs.length}\n`);
    
    if (usersDbDocs.length === 0) {
      console.log('✓ users.db 中没有文档，无需同步');
      rl.close();
      await prisma.$disconnect();
      usersDb.close();
      return;
    }
    
    // 显示文档列表
    console.log('文档列表:');
    usersDbDocs.forEach(doc => {
      console.log(`  - ID: ${doc.id}, 标题: ${doc.title}, 用户: ${doc.user_id}, 创建时间: ${doc.created_at}`);
    });
    
    console.log('\n================================================================================');
    console.log('请选择操作:');
    console.log('================================================================================\n');
    console.log('1. 清空 users.db 中的文档（推荐）');
    console.log('   - 删除所有旧文档');
    console.log('   - 前端将不再显示这些文档');
    console.log('   - 避免 404 轮询问题');
    console.log('');
    console.log('2. 为现有文档创建 KG 状态记录');
    console.log('   - 保留现有文档');
    console.log('   - 在 Prisma 数据库中创建对应的 KG 状态记录');
    console.log('   - 状态设置为 "pending"');
    console.log('');
    console.log('3. 退出');
    console.log('');
    
    const choice = await question('请输入选项 (1/2/3): ');
    
    if (choice === '1') {
      console.log('\n⚠️  警告: 这将删除 users.db 中的所有文档！');
      const confirm = await question('确认删除？(yes/no): ');
      
      if (confirm.toLowerCase() === 'yes') {
        console.log('\n开始清空文档...');
        const deletedCount = await clearUsersDbDocuments();
        console.log(`✓ 已删除 ${deletedCount} 个文档`);
        console.log('\n✓ 完成！现在前端将不再显示旧文档。');
      } else {
        console.log('\n已取消操作');
      }
    } else if (choice === '2') {
      console.log('\n开始为文档创建 KG 状态记录...');
      
      for (const doc of usersDbDocs) {
        await createKGStatusForDocument(doc.id);
      }
      
      console.log('\n✓ 完成！现在点击文档时不会出现 404 错误。');
      console.log('💡 提示: 你可以手动触发 KG 构建来为这些文档生成知识图谱。');
    } else {
      console.log('\n已退出');
    }
    
  } catch (error) {
    console.error('\n✗ 错误:', error);
  } finally {
    rl.close();
    await prisma.$disconnect();
    usersDb.close();
  }
}

main();
