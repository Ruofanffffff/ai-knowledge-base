#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('=== 清理不需要的数据库文件 ===\n');

// 需要保留的数据库
const KEEP_DATABASES = [
  'data/users.db',              // 用户数据和文档
  'data/knowledge_graph.db'     // 知识图谱、schema 和映射
];

// 找到的所有数据库文件
const allDatabases = [
  'database/users.db',
  'user_data.db',
  'prisma/knowledge-base.db',
  'kg.db',
  'data/users.db',
  'data/knowledge_graph.db',
  'knowledge-base.db',
  'database.db'
];

console.log('📋 需要保留的数据库:');
KEEP_DATABASES.forEach(db => {
  console.log(`   ✅ ${db}`);
});
console.log('');

console.log('🗑️  准备删除的数据库:');
const toDelete = allDatabases.filter(db => !KEEP_DATABASES.includes(db));

if (toDelete.length === 0) {
  console.log('   (无需删除的文件)');
  console.log('');
  console.log('=== 完成 ===');
  process.exit(0);
}

toDelete.forEach(db => {
  const fullPath = path.join(__dirname, db);
  if (fs.existsSync(fullPath)) {
    console.log(`   ❌ ${db}`);
  } else {
    console.log(`   ⚠️  ${db} (文件不存在，跳过)`);
  }
});
console.log('');

// 执行删除
console.log('🔨 开始删除...\n');
let deletedCount = 0;
let skippedCount = 0;

toDelete.forEach(db => {
  const fullPath = path.join(__dirname, db);
  
  if (!fs.existsSync(fullPath)) {
    skippedCount++;
    return;
  }
  
  try {
    fs.unlinkSync(fullPath);
    console.log(`   ✅ 已删除: ${db}`);
    deletedCount++;
  } catch (error) {
    console.log(`   ❌ 删除失败: ${db} - ${error.message}`);
  }
});

console.log('');
console.log('=== 完成 ===');
console.log(`✅ 成功删除: ${deletedCount} 个文件`);
console.log(`⚠️  跳过: ${skippedCount} 个文件`);
console.log('');
console.log('📊 保留的数据库:');
KEEP_DATABASES.forEach(db => {
  const fullPath = path.join(__dirname, db);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`   ${db} (${sizeMB} MB)`);
  }
});
