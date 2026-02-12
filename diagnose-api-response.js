#!/usr/bin/env node

/**
 * 诊断脚本：检查 /api/documents 端点实际返回的数据
 * 这将帮助我们确定问题是在后端还是前端
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库路径
const DB_PATH = path.join(__dirname, 'data', 'users.db');

console.log('=== 诊断 /api/documents API 响应 ===\n');
console.log('数据库路径:', DB_PATH);
console.log('');

// 打开数据库
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 无法打开数据库:', err.message);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功\n');
});

// 1. 检查所有用户
db.all('SELECT id, username FROM users', [], (err, users) => {
  if (err) {
    console.error('❌ 查询用户失败:', err.message);
    db.close();
    return;
  }

  console.log(`📊 找到 ${users.length} 个用户:\n`);
  users.forEach(user => {
    console.log(`  - ID: ${user.id}, 用户名: ${user.username}`);
  });
  console.log('');

  // 2. 对每个用户，检查其文档
  let processedUsers = 0;
  
  users.forEach(user => {
    db.all(
      'SELECT id, title, file_type, created_at, updated_at FROM documents WHERE user_id = ? ORDER BY created_at DESC',
      [user.id],
      (err, docs) => {
        if (err) {
          console.error(`❌ 查询用户 ${user.username} 的文档失败:`, err.message);
        } else {
          console.log(`\n📁 用户 "${user.username}" (ID: ${user.id}) 的文档 (${docs.length} 个):`);
          console.log('─'.repeat(80));
          
          if (docs.length === 0) {
            console.log('  (无文档)');
          } else {
            docs.forEach((doc, index) => {
              console.log(`  ${index + 1}. ID: ${doc.id}`);
              console.log(`     标题: ${doc.title}`);
              console.log(`     类型: ${doc.file_type}`);
              console.log(`     创建时间: ${doc.created_at}`);
              console.log(`     更新时间: ${doc.updated_at}`);
              console.log('');
            });
          }
        }
        
        processedUsers++;
        if (processedUsers === users.length) {
          console.log('\n' + '='.repeat(80));
          console.log('✅ 诊断完成');
          console.log('='.repeat(80));
          console.log('\n💡 提示:');
          console.log('  1. 如果数据库中的文档与前端显示的不一致，问题可能在前端缓存');
          console.log('  2. 如果有多个用户，确认前端使用的是正确的用户ID');
          console.log('  3. 检查浏览器 Network 标签中 /api/documents 请求的响应内容');
          console.log('');
          
          db.close();
        }
      }
    );
  });
});
