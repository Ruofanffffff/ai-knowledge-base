/**
 * 检查特定文档是否在数据库中
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 用户数据库路径
const USER_DB_PATH = path.join(__dirname, 'data', 'users.db');

// 前端显示的文档标题
const frontendDocuments = [
  '天花板维修流量通道说明',
  '基层机构编制和岗位设置的规范性说明一体化方案（初稿）',
  '20210624年度市级行政单位机构编制动态调整流程方案',
  'test.file'
];

console.log('========== 检查特定文档 ==========\n');
console.log('前端显示的文档:');
frontendDocuments.forEach((title, index) => {
  console.log(`${index + 1}. ${title}`);
});
console.log('\n正在数据库中查找...\n');

const db = new sqlite3.Database(USER_DB_PATH, (err) => {
  if (err) {
    console.error('无法连接到数据库:', err);
    process.exit(1);
  }
});

// 查询所有用户
db.all('SELECT id, username, email FROM users', [], (err, users) => {
  if (err) {
    console.error('查询用户失败:', err);
    db.close();
    return;
  }

  console.log(`========== 数据库中的用户 (${users.length}个) ==========`);
  users.forEach(user => {
    console.log(`用户ID: ${user.id}, 用户名: ${user.username}, 邮箱: ${user.email}`);
  });
  console.log('');

  // 对每个前端文档，在数据库中查找
  let foundCount = 0;
  let processedCount = 0;

  frontendDocuments.forEach((title, index) => {
    db.all(
      'SELECT d.*, u.username FROM documents d LEFT JOIN users u ON d.user_id = u.id WHERE d.title LIKE ?',
      [`%${title}%`],
      (err, rows) => {
        processedCount++;

        if (err) {
          console.error(`查询文档 "${title}" 失败:`, err);
        } else if (rows && rows.length > 0) {
          foundCount++;
          console.log(`✅ 找到文档 ${index + 1}: "${title}"`);
          rows.forEach(row => {
            console.log(`   - 文档ID: ${row.id}`);
            console.log(`   - 所属用户: ${row.username || '未知'} (ID: ${row.user_id})`);
            console.log(`   - 文件类型: ${row.file_type}`);
            console.log(`   - 创建时间: ${row.created_at}`);
            console.log('');
          });
        } else {
          console.log(`❌ 未找到文档 ${index + 1}: "${title}"`);
        }

        // 所有查询完成后，显示总结
        if (processedCount === frontendDocuments.length) {
          console.log('\n========== 总结 ==========');
          console.log(`前端显示: ${frontendDocuments.length} 个文档`);
          console.log(`数据库中找到: ${foundCount} 个文档`);
          console.log(`缺失: ${frontendDocuments.length - foundCount} 个文档`);

          if (foundCount === 0) {
            console.log('\n⚠️  所有前端显示的文档都不在数据库中！');
            console.log('   这确认了是浏览器缓存问题。');
            console.log('\n建议操作:');
            console.log('1. 打开浏览器开发者工具（F12）');
            console.log('2. 进入 Application/应用程序 标签');
            console.log('3. 左侧选择 Storage/存储');
            console.log('4. 点击 "Clear site data" / "清除网站数据"');
            console.log('5. 刷新页面');
          } else if (foundCount < frontendDocuments.length) {
            console.log('\n⚠️  部分文档在数据库中，部分不在。');
            console.log('   可能是多用户环境或部分缓存问题。');
          } else {
            console.log('\n✅ 所有文档都在数据库中。');
            console.log('   前端显示正确。');
          }

          // 查询数据库中所有文档的总数
          db.get('SELECT COUNT(*) as count FROM documents', [], (err, row) => {
            if (!err && row) {
              console.log(`\n数据库中文档总数: ${row.count}`);
            }
            db.close();
          });
        }
      }
    );
  });
});
