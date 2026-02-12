/**
 * 快速检查知识图谱构建状态
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 连接数据库
const dbPath = path.join(__dirname, 'data', 'knowledge_graph.db');
const db = new sqlite3.Database(dbPath);

console.log('=== 知识图谱状态检查 ===\n');

// 1. 检查文档数量
db.all('SELECT COUNT(*) as count FROM documents', (err, rows) => {
  if (err) {
    console.error('查询文档失败:', err);
    return;
  }
  console.log(`📄 文档总数: ${rows[0].count}`);
});

// 2. 检查KG构建状态（检查documents表中的kg_status字段）
db.all(`
  SELECT 
    kg_status,
    COUNT(*) as count
  FROM documents
  WHERE kg_status IS NOT NULL
  GROUP BY kg_status
`, (err, rows) => {
  if (err) {
    console.error('查询KG状态失败:', err);
    return;
  }
  
  console.log('\n📊 知识图谱构建状态:');
  if (rows.length === 0) {
    console.log('  ⚠️  没有找到任何构建状态记录');
  } else {
    rows.forEach(row => {
      const emoji = {
        'queued': '🔵',
        'building': '🟡',
        'completed': '🟢',
        'failed': '🔴',
        'pending': '⏳'
      }[row.kg_status] || '❓';
      console.log(`  ${emoji} ${row.kg_status}: ${row.count} 个文档`);
    });
  }
});

// 3. 检查最近的文档
db.all(`
  SELECT 
    title,
    kg_status,
    created_at,
    updated_at
  FROM documents
  ORDER BY created_at DESC
  LIMIT 5
`, (err, rows) => {
  if (err) {
    console.error('查询最近文档失败:', err);
    return;
  }
  
  console.log('\n📝 最近5个文档:');
  if (rows.length === 0) {
    console.log('  没有文档');
  } else {
    rows.forEach((row, i) => {
      const emoji = {
        'queued': '🔵',
        'building': '🟡',
        'completed': '🟢',
        'failed': '🔴',
        'pending': '⏳'
      }[row.kg_status] || '❓';
      
      console.log(`\n  ${i + 1}. ${emoji} ${row.title}`);
      console.log(`     KG状态: ${row.kg_status || '未设置'}`);
      console.log(`     创建时间: ${row.created_at}`);
      console.log(`     更新时间: ${row.updated_at}`);
    });
  }
});

// 4. 检查实体和关系数量
db.all('SELECT COUNT(*) as count FROM kg_entities', (err, rows) => {
  if (err) {
    console.error('查询实体失败:', err);
    return;
  }
  console.log(`\n🔷 实体总数: ${rows[0].count}`);
});

db.all('SELECT COUNT(*) as count FROM kg_relations', (err, rows) => {
  if (err) {
    console.error('查询关系失败:', err);
    return;
  }
  console.log(`🔗 关系总数: ${rows[0].count}`);
  
  // 检查关系中是否有描述
  db.all(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN metadata LIKE '%description%' THEN 1 ELSE 0 END) as with_description
    FROM kg_relations
  `, (err, rows) => {
    if (err) {
      console.error('查询关系描述失败:', err);
    } else if (rows[0].total > 0) {
      const percentage = ((rows[0].with_description / rows[0].total) * 100).toFixed(1);
      console.log(`📝 包含描述的关系: ${rows[0].with_description}/${rows[0].total} (${percentage}%)`);
    }
    
    // 关闭数据库连接
    setTimeout(() => {
      db.close();
      console.log('\n=== 检查完成 ===');
    }, 100);
  });
});
