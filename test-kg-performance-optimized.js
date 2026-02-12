/**
 * 优化版知识图谱性能测试
 * 
 * 优化措施:
 * 1. 禁用 LLM 调用
 * 2. 禁用语义关系构建
 * 3. 禁用质量过滤和置信度更新
 * 4. 使用并行处理
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const kgService = require('./kg/services/kg_service');
const fs = require('fs');

async function testPerformance() {
  console.log('=== 知识图谱性能测试 (优化版) ===\n');
  
  try {
    // 1. 获取所有文档
    const documents = await prisma.document.findMany({
      take: 3  // 只测试前3个文档
    });
    
    console.log(`找到 ${documents.length} 个文档进行测试\n`);
    
    const results = [];
    
    for (const doc of documents) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`测试文档 ${doc.id}: ${doc.title}`);
      console.log(`文件类型: ${doc.fileType}`);
      
      // 从metadata中获取文件路径
      let filePath = null;
      try {
        const metadata = JSON.parse(doc.metadata || '{}');
        filePath = metadata.filePath || metadata.path;
      } catch (e) {
        console.log('无法解析metadata');
      }
      
      if (!filePath) {
        console.log('跳过: 没有文件路径');
        continue;
      }
      
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        console.log(`跳过: 文件不存在 ${filePath}`);
        continue;
      }
      
      console.log(`文件路径: ${filePath}`);
      console.log(`\n开始处理 (优化模式)...`);
      
      const startTime = Date.now();
      
      try {
        // 🆕 优化配置: 禁用所有可选的慢速操作
        const result = await kgService.buildKnowledgeGraph(
          doc.id,
          filePath,
          doc.fileType,
          {
            llmClient: null,  // ✅ 禁用 LLM
            enableSemanticRelations: false,  // ✅ 禁用语义关系
            enableQualityFilter: false  // ✅ 禁用质量过滤和置信度更新
          }
        );
        
        const duration = Date.now() - startTime;
        const durationSec = (duration / 1000).toFixed(2);
        
        console.log(`\n✓ 完成! 耗时: ${durationSec}秒 (${duration}ms)`);
        console.log(`\n结果统计:`);
        console.log(`  - CKBs: ${result.ckbs_created}`);
        console.log(`  - 实体: ${result.entities_created}`);
        console.log(`  - 内置关系: ${result.relations_created.builtin}`);
        console.log(`  - 共现关系: ${result.relations_created.cooccurrence}`);
        console.log(`  - 总关系: ${result.relations_created.builtin + result.relations_created.cooccurrence}`);
        
        if (result.ckbs_created > 0) {
          const msPerCkb = (duration / result.ckbs_created).toFixed(2);
          console.log(`  - 平均每个CKB: ${msPerCkb}ms`);
        }
        
        results.push({
          doc_id: doc.id,
          title: doc.title,
          ckbs: result.ckbs_created,
          entities: result.entities_created,
          relations: result.relations_created.builtin + result.relations_created.cooccurrence,
          time_ms: duration,
          time_sec: durationSec,
          success: true
        });
        
      } catch (error) {
        console.error(`\n✗ 失败:`, error.message);
        console.error('错误堆栈:', error.stack);
        results.push({
          doc_id: doc.id,
          title: doc.title,
          error: error.message,
          success: false
        });
      }
    }
    
    // 打印总结
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('测试总结 (优化版)');
    console.log('='.repeat(80));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`\n成功: ${successful.length} / ${results.length}`);
    console.log(`失败: ${failed.length} / ${results.length}`);
    
    if (successful.length > 0) {
      console.log('\n成功处理的文档:');
      console.log('-'.repeat(80));
      
      for (const result of successful) {
        console.log(`\n文档 ${result.doc_id}: ${result.title}`);
        console.log(`  CKBs: ${result.ckbs} | 实体: ${result.entities} | 关系: ${result.relations}`);
        console.log(`  处理时间: ${result.time_sec}秒`);
        
        if (result.ckbs > 0) {
          const msPerCkb = (result.time_ms / result.ckbs).toFixed(2);
          console.log(`  平均每个CKB: ${msPerCkb}ms`);
        }
      }
      
      // 计算总体统计
      const totalTime = successful.reduce((sum, r) => sum + r.time_ms, 0);
      const totalCkbs = successful.reduce((sum, r) => sum + r.ckbs, 0);
      const totalEntities = successful.reduce((sum, r) => sum + r.entities, 0);
      const totalRelations = successful.reduce((sum, r) => sum + r.relations, 0);
      
      console.log('\n' + '-'.repeat(80));
      console.log('总计:');
      console.log(`  总处理时间: ${(totalTime / 1000).toFixed(2)}秒`);
      console.log(`  总CKBs: ${totalCkbs}`);
      console.log(`  总实体: ${totalEntities}`);
      console.log(`  总关系: ${totalRelations}`);
      
      if (totalCkbs > 0) {
        console.log(`  平均每个CKB: ${(totalTime / totalCkbs).toFixed(2)}ms`);
      }
      
      // 性能评估
      console.log('\n性能评估 (优化版):');
      if (totalCkbs > 0) {
        const avgMsPerCkb = totalTime / totalCkbs;
        if (avgMsPerCkb < 50) {
          console.log(`  ✓ 优秀! 平均每个CKB ${avgMsPerCkb.toFixed(2)}ms`);
        } else if (avgMsPerCkb < 100) {
          console.log(`  ✓ 良好! 平均每个CKB ${avgMsPerCkb.toFixed(2)}ms`);
        } else if (avgMsPerCkb < 200) {
          console.log(`  ⚠ 可接受! 平均每个CKB ${avgMsPerCkb.toFixed(2)}ms`);
        } else {
          console.log(`  ⚠ 仍需优化! 平均每个CKB ${avgMsPerCkb.toFixed(2)}ms`);
        }
      }
      
      // 优化效果对比
      console.log('\n优化措施:');
      console.log('  ✅ 禁用 LLM 调用');
      console.log('  ✅ 禁用语义关系构建');
      console.log('  ✅ 禁用质量过滤');
      console.log('  ✅ 并行构建内置关系');
      console.log('  ✅ 完全并行更新置信度');
    }
    
    if (failed.length > 0) {
      console.log('\n失败的文档:');
      console.log('-'.repeat(80));
      for (const result of failed) {
        console.log(`\n文档 ${result.doc_id}: ${result.title}`);
        console.log(`  错误: ${result.error}`);
      }
    }
    
    await prisma.$disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('\n测试失败:', error);
    console.error('错误堆栈:', error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testPerformance();
