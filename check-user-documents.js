/**
 * 检查用户数据库中的文档
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 用户数据库路径
const USER_DB_PATH = path.join(__dirname, 'user_data.db');

console.log('\n========== 检查用户数据库 ==========\n');
console.log(`数据库路径: ${USER_DB_PATH}`);

const db = new sqlite3.Database(USER_DB_PATH, (err) => {
  if (err) {
    console.error('无法连接到用户数据库:', err.message);
    process.exit(1);
  }
  console.log('✅ 成功连接到用户数据库\n');
});

// 查询所有文档
db.all('SELECT * FROM documents ORDER BY created_at DESC', [], (err, rows) => {
  if (err) {
    console.error('查询失败:', err.message);
    db.close();
    return;
  }
  
  console.log(`找到 ${rows.length} 个文档\n`);
  
  if (rows.length === 0) {
    console.log('❌ 用户数据库中没有文档');
  } else {
    console.log('文档列表：\n');
    rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.title}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   用户ID: ${row.user_id}`);
      console.log(`   类型: ${row.type} (${row.file_type})`);
      console.log(`   创建时间: ${row.created_at}`);
      console.log('');
    });
    
    // 检查前端显示的文档
    console.log('\n========== 匹配检查 ==========\n');
    const frontendDocs = [
      '天花板维修流通表说明书',
      '基层联动微网格社会治理机制实践探索',
      '20210624年度消费计算云三层框架协议项目采购方案',
      'test.file'
    ];
    
    for (const docTitle of frontendDocs) {
      const found = rows.find(r => 
        r.title && (r.title.includes(docTitle) || docTitle.includes(r.title))
      );
      
      if (found) {
        console.log(`✅ "${docTitle}" - 在用户数据库中找到`);
        console.log(`   完整标题: ${found.title}`);
        console.log(`   ID: ${found.id}`);
      } else {
        console.log(`❌ "${docTitle}" - 在用户数据库中未找到`);
      }
    }
  }
  
  console.log('\n========================================\n');
  
  db.close((err) => {
    if (err) {
      console.error('关闭数据库时出错:', err.message);
    }
  });
});
