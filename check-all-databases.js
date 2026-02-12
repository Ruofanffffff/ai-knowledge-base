#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbFiles = [
  'data/users.db',
  'database/users.db',
  'user_data.db',
  'database.db',
  'knowledge-base.db'
];

console.log('=== 检查所有数据库文件中的文档 ===\n');

dbFiles.forEach(dbPath => {
  const fullPath = path.join(__dirname, dbPath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ ${dbPath} - 文件不存在\n`);
    return;
  }
  
  console.log(`📁 检查: ${dbPath}`);
  console.log('─'.repeat(80));
  
  const db = new sqlite3.Database(fullPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.log(`   ❌ 无法打开: ${err.message}\n`);
      return;
    }
  });
  
  // 检查是否有 documents 表
  db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'", [], (err, tables) => {
    if (err || !tables || tables.length === 0) {
      console.log('   ℹ️  没有 documents 表\n');
      db.close();
      return;
    }
    
    // 查询文档
    db.all('SELECT id, title, file_type, created_at FROM documents ORDER BY id', [], (err, docs) => {
      if (err) {
        console.log(`   ❌ 查询失败: ${err.message}\n`);
      } else if (!docs || docs.length === 0) {
        console.log('   ✅ 没有文档\n');
      } else {
        console.log(`   📄 找到 ${docs.length} 个文档:`);
        docs.forEach((doc, index) => {
          console.log(`      ${index + 1}. ID: ${doc.id} - ${doc.title} (${doc.file_type})`);
        });
        console.log('');
      }
      db.close();
    });
  });
});

setTimeout(() => {
  console.log('=== 检查完成 ===');
}, 2000);
