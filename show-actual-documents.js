/**
 * 显示数据库中实际的文档
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 用户数据库路径
const USER_DB_PATH = path.join(__dirname, 'data', 'users.db');

console.log('========== 数据库中的实际文档 ==========\n');

const db = new sqlite3.Database(USER_DB_PATH, (err) => {
  if (err) {
    console.error('无法连接到数据库:', err);
    process.exit(1);
  }
});

db.all(
  'SELECT d.*, u.username FROM documents d LEFT JOIN users u ON d.user_id = u.id ORDER BY d.created_at DESC',
  [],
  (err, rows) => {
    if (err) {
      console.error('查询失败:', err);
      db.close();
      return;
    }

    if (!rows || rows.length === 0) {
      console.log('数据库中没有文档。');
      db.close();
      return;
    }

    console.log(`找到 ${rows.length} 个文档:\n`);

    rows.forEach((row, index) => {
      console.log(`${index + 1}. 文档ID: ${row.id}`);
      console.log(`   标题: ${row.title}`);
      console.log(`   所属用户: ${row.username || '未知'} (ID: ${row.user_id})`);
      console.log(`   类型: ${row.type}`);
      console.log(`   文件类型: ${row.file_type}`);
      console.log(`   创建时间: ${row.created_at}`);
      console.log(`   更新时间: ${row.updated_at}`);
      console.log(`   内容长度: ${row.content ? row.content.length : 0} 字符`);
      console.log('');
    });

    db.close();
  }
);
