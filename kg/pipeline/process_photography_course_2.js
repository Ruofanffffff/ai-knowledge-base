/**
 * 处理摄影课2.md文档的完整知识图谱生成流程
 */

const fs = require('fs');
const path = require('path');
const { UniversalDocumentPipeline } = require('./universal_document_pipeline');

async function main() {
  console.log('='.repeat(80));
  console.log('开始处理摄影课2.md文档');
  console.log('='.repeat(80));

  // 读取文档内容
  const docPath = path.join(__dirname, '../../摄影课 2.md');
  const content = fs.readFileSync(docPath, 'utf-8');

  console.log('\n📄 文档内容长度:', content.length, '字符');
  console.log('📄 文档前100字符:', content.substring(0, 100).replace(/\n/g, ' '));

  // 创建pipeline实例
  const pipeline = new UniversalDocumentPipeline();

  // 处理文档
  console.log('\n🚀 开始处理文档...\n');
  
  const startTime = Date.now();
  
  try {
    const result = await pipeline.processDocument({
      content,
      metadata: {
        title: '摄影课 - 人物肖像拍摄技巧',
        source: '摄影课2.md',
        type: 'tutorial',
        domain: 'photography'
      }
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(80));
    console.log('✅ 处理完成！耗时:', duration, '秒');
    console.log('='.repeat(80));

    // 输出结果统计
    console.log('\n📊 处理结果统计:');
    console.log('─'.repeat(80));
    console.log(`实体数量: ${result.entities?.length || 0}`);
    console.log(`关系数量: ${result.relations?.length || 0}`);
    console.log(`匹配的Schema: ${result.matchedSchemas?.length || 0}`);
    
    // 输出实体详情
    if (result.entities && result.entities.length > 0) {
      console.log('\n📦 生成的实体:');
      console.log('─'.repeat(80));
      result.entities.forEach((entity, idx) => {
        console.log(`\n[${idx + 1}] ${entity.name || entity.label || '未命名实体'}`);
        console.log(`    类型: ${entity.type || entity.schema || '未知'}`);
        console.log(`    置信度: ${entity.confidence || 'N/A'}`);
        
        // 显示锚点字段
        if (entity.anchorFields) {
          console.log(`    锚点字段: ${JSON.stringify(entity.anchorFields)}`);
        }
        
        // 显示部分属性
        const fields = Object.keys(entity).filter(k => 
          !['name', 'type', 'schema', 'confidence', 'anchorFields', 'id'].includes(k)
        );
        if (fields.length > 0) {
          console.log(`    属性数量: ${fields.length}`);
          console.log(`    属性示例: ${fields.slice(0, 3).join(', ')}`);
        }
      });
    }

    // 输出关系详情
    if (result.relations && result.relations.length > 0) {
      console.log('\n🔗 生成的关系:');
      console.log('─'.repeat(80));
      result.relations.slice(0, 10).forEach((rel, idx) => {
        console.log(`\n[${idx + 1}] ${rel.source} --[${rel.type}]--> ${rel.target}`);
        if (rel.confidence) {
          console.log(`    置信度: ${rel.confidence}`);
        }
      });
      if (result.relations.length > 10) {
        console.log(`\n... 还有 ${result.relations.length - 10} 个关系`);
      }
    }

    // 输出匹配的Schema
    if (result.matchedSchemas && result.matchedSchemas.length > 0) {
      console.log('\n🎯 匹配的Schema:');
      console.log('─'.repeat(80));
      result.matchedSchemas.forEach((schema, idx) => {
        console.log(`[${idx + 1}] ${schema.name} (置信度: ${schema.confidence || 'N/A'})`);
      });
    }

    // 保存完整结果到文件
    const outputPath = path.join(__dirname, 'photography_course_2_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log('\n💾 完整结果已保存到:', outputPath);

    // 输出性能指标
    if (result.metrics) {
      console.log('\n⚡ 性能指标:');
      console.log('─'.repeat(80));
      console.log(JSON.stringify(result.metrics, null, 2));
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎉 知识图谱生成完成！');
    console.log('='.repeat(80));

    return result;

  } catch (error) {
    console.error('\n❌ 处理失败:', error.message);
    console.error('错误堆栈:', error.stack);
    throw error;
  }
}

// 运行主函数
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ 脚本执行成功');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { main };
