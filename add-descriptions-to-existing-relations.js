/**
 * 为现有关系添加人类可读描述
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { RelationDescriptionGenerator } = require('./kg/human_readable/relation_description_generator');

const dbPath = path.join(__dirname, 'data', 'knowledge_graph.db');
const db = new sqlite3.Database(dbPath);

const generator = new RelationDescriptionGenerator({
  enableLLM: false,
  language: 'zh'
});

async function addDescriptions() {
  console.log('=== 开始为现有关系添加描述 ===\n');
  
  // 获取所有关系
  const relations = await new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        r.id,
        r.source_id,
        r.target_id,
        r.type,
        r.subtype,
        r.metadata,
        se.canonical_name as source_name,
        te.canonical_name as target_name
      FROM kg_relations r
      LEFT JOIN kg_entities se ON r.source_id = se.id
      LEFT JOIN kg_entities te ON r.target_id = te.id
    `, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  console.log(`找到 ${relations.length} 个关系\n`);
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const relation of relations) {
    try {
      // 解析现有metadata
      let metadata = {};
      if (relation.metadata) {
        try {
          metadata = JSON.parse(relation.metadata);
        } catch (e) {
          console.warn(`关系 ${relation.id} 的metadata解析失败`);
        }
      }
      
      // 如果已经有描述，跳过
      if (metadata.description) {
        skipped++;
        continue;
      }
      
      // 生成描述
      const result = await generator.generateDescription({
        type: relation.subtype || relation.type,
        source: { canonical_name: relation.source_name },
        target: { canonical_name: relation.target_name }
      }, {
        method: 'template'
      });
      
      // 更新metadata
      metadata.description = result.description;
      metadata.description_method = result.method;
      metadata.description_confidence = result.confidence;
      
      // 保存到数据库
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE kg_relations SET metadata = ? WHERE id = ?',
          [JSON.stringify(metadata), relation.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      updated++;
      
      if (updated % 10 === 0) {
        console.log(`已处理 ${updated} 个关系...`);
      }
    } catch (error) {
      console.error(`处理关系 ${relation.id} 时出错:`, error.message);
      errors++;
    }
  }
  
  console.log('\n=== 处理完成 ===');
  console.log(`✅ 成功添加描述: ${updated} 个`);
  console.log(`⏭️  跳过（已有描述）: ${skipped} 个`);
  console.log(`❌ 错误: ${errors} 个`);
  
  db.close();
}

addDescriptions().catch(console.error);
