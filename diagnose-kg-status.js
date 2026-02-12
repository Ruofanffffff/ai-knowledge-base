/**
 * 诊断脚本 - 检查知识图谱状态追踪功能
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data/users.db');

console.log('=== 知识图谱状态追踪诊断 ===\n');

// 1. 检查数据库文件是否存在
console.log('1. 检查数据库文件...');
if (fs.existsSync(DB_PATH)) {
  console.log('✓ 数据库文件存在:', DB_PATH);
} else {
  console.log('✗ 数据库文件不存在:', DB_PATH);
  process.exit(1);
}

// 2. 连接数据库并检查表
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('✗ 无法连接数据库:', err.message);
    process.exit(1);
  }
  console.log('✓ 数据库连接成功\n');

  // 3. 检查 kg_build_status 表是否存在
  console.log('2. 检查 kg_build_status 表...');
  db.get(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='kg_build_status'",
    (err, row) => {
      if (err) {
        console.error('✗ 查询表失败:', err.message);
        db.close();
        process.exit(1);
      }

      if (!row) {
        console.log('✗ kg_build_status 表不存在');
        console.log('\n解决方法:');
        console.log('  运行数据库迁移: node database/migrate.js');
        db.close();
        process.exit(1);
      }

      console.log('✓ kg_build_status 表存在\n');

      // 4. 检查表结构
      console.log('3. 检查表结构...');
      db.all("PRAGMA table_info(kg_build_status)", (err, columns) => {
        if (err) {
          console.error('✗ 查询表结构失败:', err.message);
          db.close();
          process.exit(1);
        }

        console.log('✓ 表结构:');
        columns.forEach(col => {
          console.log(`  - ${col.name} (${col.type})`);
        });
        console.log('');

        // 5. 检查索引
        console.log('4. 检查索引...');
        db.all(
          "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='kg_build_status'",
          (err, indexes) => {
            if (err) {
              console.error('✗ 查询索引失败:', err.message);
              db.close();
              process.exit(1);
            }

            if (indexes.length > 0) {
              console.log('✓ 索引:');
              indexes.forEach(idx => {
                console.log(`  - ${idx.name}`);
              });
            } else {
              console.log('⚠ 没有找到索引');
            }
            console.log('');

            // 6. 检查数据
            console.log('5. 检查数据...');
            db.get('SELECT COUNT(*) as count FROM kg_build_status', (err, row) => {
              if (err) {
                console.error('✗ 查询数据失败:', err.message);
                db.close();
                process.exit(1);
              }

              console.log(`✓ 状态记录数量: ${row.count}`);

              if (row.count > 0) {
                // 显示状态分布
                db.all(
                  'SELECT status, COUNT(*) as count FROM kg_build_status GROUP BY status',
                  (err, rows) => {
                    if (err) {
                      console.error('✗ 查询状态分布失败:', err.message);
                    } else {
                      console.log('  状态分布:');
                      rows.forEach(r => {
                        console.log(`    - ${r.status}: ${r.count}`);
                      });
                    }
                    console.log('');

                    // 7. 测试 StatusManager
                    console.log('6. 测试 StatusManager...');
                    testStatusManager(db);
                  }
                );
              } else {
                console.log('  (没有状态记录)\n');
                // 7. 测试 StatusManager
                console.log('6. 测试 StatusManager...');
                testStatusManager(db);
              }
            });
          }
        );
      });
    }
  );
});

async function testStatusManager(db) {
  try {
    const { getInstance } = require('./kg/services/status_manager');
    const statusManager = getInstance();

    console.log('✓ StatusManager 加载成功');

    // 测试创建状态
    console.log('\n7. 测试 API 功能...');
    console.log('  测试创建状态...');
    
    const testDocId = 'test-' + Date.now();
    const status = await statusManager.createStatus(testDocId, 'pending');
    console.log(`  ✓ 创建状态成功: ${testDocId} - ${status.status}`);

    // 测试查询状态
    console.log('  测试查询状态...');
    const fetchedStatus = await statusManager.getStatus(testDocId);
    console.log(`  ✓ 查询状态成功: ${fetchedStatus.status}`);

    // 测试更新状态
    console.log('  测试更新状态...');
    await statusManager.updateStatus(testDocId, 'completed', {
      entityCount: 10,
      relationCount: 5
    });
    console.log('  ✓ 更新状态成功');

    // 测试删除状态
    console.log('  测试删除状态...');
    await statusManager.deleteStatus(testDocId);
    console.log('  ✓ 删除状态成功');

    console.log('\n=== 诊断完成 ===');
    console.log('✓ 所有检查通过！知识图谱状态追踪功能正常。');

    db.close();
    process.exit(0);
  } catch (error) {
    console.error('✗ StatusManager 测试失败:', error.message);
    console.error('  错误详情:', error);
    db.close();
    process.exit(1);
  }
}
