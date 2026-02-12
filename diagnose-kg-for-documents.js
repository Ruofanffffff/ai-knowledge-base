/**
 * 诊断知识图谱 - 检查特定文档的实体和关系
 * 用于验证上传的文档是否生成了知识图谱
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库路径
const DB_PATH = path.join(__dirname, 'data', 'users.db');

async function diagnoseKG() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ 无法连接数据库:', err.message);
        reject(err);
        return;
      }
      console.log('✅ 已连接到数据库\n');
    });

    console.log('=' .repeat(80));
    console.log('📊 知识图谱诊断报告');
    console.log('=' .repeat(80));

    // 1. 查询所有文档
    console.log('\n📄 第一步：查询所有文档');
    console.log('-'.repeat(80));
    
    db.all(`
      SELECT id, title, file_type, size, created_at, hash
      FROM documents
      ORDER BY created_at DESC
      LIMIT 10
    `, [], (err, documents) => {
      if (err) {
        console.error('❌ 查询文档失败:', err.message);
        db.close();
        reject(err);
        return;
      }

      if (documents.length === 0) {
        console.log('⚠️  没有找到任何文档');
        db.close();
        resolve();
        return;
      }

      console.log(`找到 ${documents.length} 个文档:\n`);
      documents.forEach((doc, index) => {
        console.log(`${index + 1}. ID: ${doc.id}`);
        console.log(`   标题: ${doc.title}`);
        console.log(`   类型: ${doc.file_type}`);
        console.log(`   大小: ${doc.size} bytes`);
        console.log(`   创建时间: ${doc.created_at}`);
        console.log(`   Hash: ${doc.hash ? doc.hash.substring(0, 16) + '...' : '无'}`);
        console.log('');
      });

      // 2. 查询实体总数
      console.log('\n🔍 第二步：查询实体统计');
      console.log('-'.repeat(80));
      
      db.get(`
        SELECT COUNT(*) as total FROM entities
      `, [], (err, result) => {
        if (err) {
          console.error('❌ 查询实体失败:', err.message);
          db.close();
          reject(err);
          return;
        }

        console.log(`实体总数: ${result.total}\n`);

        // 3. 按文档分组统计实体
        db.all(`
          SELECT 
            document_id,
            COUNT(*) as entity_count,
            GROUP_CONCAT(DISTINCT schema_type) as schema_types
          FROM entities
          GROUP BY document_id
          ORDER BY entity_count DESC
        `, [], (err, entityStats) => {
          if (err) {
            console.error('❌ 查询实体统计失败:', err.message);
            db.close();
            reject(err);
            return;
          }

          console.log('按文档分组的实体统计:\n');
          
          if (entityStats.length === 0) {
            console.log('⚠️  没有找到任何实体');
          } else {
            entityStats.forEach((stat, index) => {
              const doc = documents.find(d => d.id === stat.document_id);
              console.log(`${index + 1}. 文档 ID: ${stat.document_id}`);
              if (doc) {
                console.log(`   文档标题: ${doc.title}`);
              }
              console.log(`   实体数量: ${stat.entity_count}`);
              console.log(`   Schema 类型: ${stat.schema_types || '无'}`);
              console.log('');
            });
          }

          // 4. 查询最近上传文档的实体详情
          console.log('\n📋 第三步：查询最近上传文档的实体详情');
          console.log('-'.repeat(80));
          
          if (documents.length > 0) {
            const recentDocIds = documents.slice(0, 2).map(d => d.id);
            
            db.all(`
              SELECT 
                e.id,
                e.document_id,
                e.name,
                e.schema_type,
                e.confidence,
                e.created_at
              FROM entities e
              WHERE e.document_id IN (${recentDocIds.join(',')})
              ORDER BY e.created_at DESC
              LIMIT 20
            `, [], (err, entities) => {
              if (err) {
                console.error('❌ 查询实体详情失败:', err.message);
                db.close();
                reject(err);
                return;
              }

              if (entities.length === 0) {
                console.log('⚠️  最近上传的文档没有生成任何实体！');
                console.log('\n可能的原因:');
                console.log('1. 知识图谱构建失败');
                console.log('2. 文档内容无法提取实体');
                console.log('3. Schema 匹配失败');
              } else {
                console.log(`找到 ${entities.length} 个实体:\n`);
                entities.forEach((entity, index) => {
                  const doc = documents.find(d => d.id === entity.document_id);
                  console.log(`${index + 1}. 实体 ID: ${entity.id}`);
                  console.log(`   名称: ${entity.name}`);
                  console.log(`   Schema: ${entity.schema_type || '无'}`);
                  console.log(`   置信度: ${entity.confidence}`);
                  console.log(`   文档: ${doc ? doc.title : entity.document_id}`);
                  console.log(`   创建时间: ${entity.created_at}`);
                  console.log('');
                });
              }

              // 5. 查询关系统计
              console.log('\n🔗 第四步：查询关系统计');
              console.log('-'.repeat(80));
              
              db.get(`
                SELECT COUNT(*) as total FROM relations
              `, [], (err, result) => {
                if (err) {
                  console.error('❌ 查询关系失败:', err.message);
                  db.close();
                  reject(err);
                  return;
                }

                console.log(`关系总数: ${result.total}\n`);

                // 6. 按文档分组统计关系
                db.all(`
                  SELECT 
                    document_id,
                    COUNT(*) as relation_count,
                    GROUP_CONCAT(DISTINCT type) as relation_types
                  FROM relations
                  GROUP BY document_id
                  ORDER BY relation_count DESC
                `, [], (err, relationStats) => {
                  if (err) {
                    console.error('❌ 查询关系统计失败:', err.message);
                    db.close();
                    reject(err);
                    return;
                  }

                  console.log('按文档分组的关系统计:\n');
                  
                  if (relationStats.length === 0) {
                    console.log('⚠️  没有找到任何关系');
                  } else {
                    relationStats.forEach((stat, index) => {
                      const doc = documents.find(d => d.id === stat.document_id);
                      console.log(`${index + 1}. 文档 ID: ${stat.document_id}`);
                      if (doc) {
                        console.log(`   文档标题: ${doc.title}`);
                      }
                      console.log(`   关系数量: ${stat.relation_count}`);
                      console.log(`   关系类型: ${stat.relation_types || '无'}`);
                      console.log('');
                    });
                  }

                  // 7. 总结和建议
                  console.log('\n💡 第五步：诊断总结和建议');
                  console.log('='.repeat(80));
                  
                  const recentDocs = documents.slice(0, 2);
                  const recentDocIds = recentDocs.map(d => d.id);
                  const recentEntities = entityStats.filter(s => recentDocIds.includes(s.document_id));
                  const recentRelations = relationStats.filter(s => recentDocIds.includes(s.document_id));

                  console.log('\n最近上传的文档分析:');
                  recentDocs.forEach((doc, index) => {
                    console.log(`\n文档 ${index + 1}: ${doc.title}`);
                    const entityStat = recentEntities.find(s => s.document_id === doc.id);
                    const relationStat = recentRelations.find(s => s.document_id === doc.id);
                    
                    if (!entityStat) {
                      console.log('  ❌ 没有生成实体');
                      console.log('  建议: 检查知识图谱构建日志，查看是否有错误');
                    } else {
                      console.log(`  ✅ 生成了 ${entityStat.entity_count} 个实体`);
                    }
                    
                    if (!relationStat) {
                      console.log('  ❌ 没有生成关系');
                      console.log('  建议: 检查关系提取逻辑');
                    } else {
                      console.log(`  ✅ 生成了 ${relationStat.relation_count} 个关系`);
                    }
                  });

                  console.log('\n图谱混乱问题分析:');
                  if (result.total > 100) {
                    console.log(`  ⚠️  实体总数过多 (${result.total} 个)`);
                    console.log('  建议: 添加过滤条件，只显示特定文档的实体');
                  }
                  
                  const docsWithoutEntities = documents.filter(doc => 
                    !entityStats.find(s => s.document_id === doc.id)
                  );
                  
                  if (docsWithoutEntities.length > 0) {
                    console.log(`\n  ⚠️  有 ${docsWithoutEntities.length} 个文档没有生成实体:`);
                    docsWithoutEntities.forEach(doc => {
                      console.log(`     - ${doc.title} (ID: ${doc.id})`);
                    });
                  }

                  console.log('\n建议的解决方案:');
                  console.log('1. 在前端添加文档过滤功能，只显示选中文档的知识图谱');
                  console.log('2. 添加实体类型过滤，隐藏不相关的实体');
                  console.log('3. 检查知识图谱构建日志，确认最近文档是否成功处理');
                  console.log('4. 考虑清理旧的测试数据');

                  console.log('\n' + '='.repeat(80));
                  
                  db.close((err) => {
                    if (err) {
                      console.error('关闭数据库时出错:', err.message);
                    }
                    resolve();
                  });
                });
              });
            });
          } else {
            db.close();
            resolve();
          }
        });
      });
    });
  });
}

// 运行诊断
diagnoseKG().catch(console.error);
