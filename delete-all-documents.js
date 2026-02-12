#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'users.db');

console.log('=== 删除所有文档 ===\n');
console.log('数据库路径:', DB_PATH);
console.log('');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 无法打开数据库:', err.message);
    process.exit(1);
  }
});

// 先查看有多少文档
db.all('SELECT id, title FROM documents', [], (err, docs) => {
  if (err) {
    console.error('❌ 查询失败:', err.message);
    db.close();
    return;
  }

  console.log(`📄 当前有 ${docs.length} 个文档:`);
  docs.forEach((doc, index) => {
    console.log(`   ${index + 1}. ID: ${doc.id} - ${doc.title}`);
  });
  console.log('');

  if (docs.length === 0) {
    console.log('✅ 数据库已经是空的');
    db.close();
    return;
  }

  // 删除所有文档
  console.log('🗑️  正在删除所有文档...');
  db.run('DELETE FROM documents', [], function(err) {
    if (err) {
      console.error('❌ 删除失败:', err.message);
      db.close();
      return;
    }

    console.log(`✅ 成功删除 ${this.changes} 个文档`);
    console.log('');

    // 验证删除
    db.all('SELECT COUNT(*) as count FROM documents', [], (err, result) => {
      if (err) {
        console.error('❌ 验证失败:', err.message);
      } else {
        console.log('📊 验证结果: 剩余文档数 =', result[0].count);
      }
      
      console.log('');
      console.log('=== 完成 ===');
      db.close();
    });
  });
});
