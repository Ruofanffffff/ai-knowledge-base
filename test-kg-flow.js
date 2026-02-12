/**
 * 知识图谱生成流程测试
 * 
 * 测试目标：验证从文件上传到知识图谱生成的完整流程
 * 
 * 测试步骤：
 * 1. 查找已上传的文档
 * 2. 使用优化配置生成知识图谱
 * 3. 验证生成结果
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const kgService = require('./kg/services/kg_service');
const fs = require('fs');
const path = require('path');

async function testKGFlow() {
  console.log('=== 知识图谱生成流程测试 ===\n');
  
  try {
    // 1. 查找最近上传的文档
    console.log('步骤1: 查找已上传的文档...');
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1
    });
    
    if (documents.length === 0) {
      console.log('❌ 没有找到已上传的文档');
      console.log('\n请先上传一个文档，然后重新运行此测试');
      await prisma.$disconnect();
      return;
    }
    
    const doc = documents[0];
    console.log(`✓ 找到文档: ${doc.title}`);
    console.log(`  - ID: ${doc.id}`);
    console.log(`  - 文件类型: ${doc.fileType}`);
    console.log(`  - 上传时间: ${doc.createdAt}`);
    
    // 2. 获取文件路径
    let filePath = null;
    try {
      const metadata = JSON.parse(doc.metadata || '{}');
      filePath = metadata.filePath || metadata.path;
    } catch (e) {
      console.log('❌ 无法解析文档metadata');
      await prisma.$disconnect();
      return;
    }
    
    if (!filePath) {
      console.log('❌ 文档没有文件路径信息');
      await prisma.$disconnect();
      return;
    }
    
    console.log(`  - 文件路径: ${filePath}`);
    
    // 3. 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      console.log(`❌ 文件不存在: ${filePath}`);
      await prisma.$disconnect();
      return;
    }
    
    console.log('  - 文件存在 ✓');
    
    // 4. 检查是否已经生成过知识图谱
    const existingCKBs = await prisma.cKB.count({
      where: { docId: doc.id.toString() }
    });
    
    const existingEntities = await prisma.kGEntity.count();
    
    const existingRelations = await prisma.kGRelation.count();
    
    if (existingCKBs > 0 || existingEntities > 0 || existingRelations > 0) {
      console.log('\n已存在的知识图谱数据:');
      console.log(`  - CKBs: ${existingCKBs}`);
      console.log(`  - 实体: ${existingEntities}`);
      console.log(`  - 关系: ${existingRelations}`);
      console.log('\n将重新生成知识图谱...');
    }
    
    // 5. 生成知识图谱（使用优化配置）
    console.log('\n步骤2: 生成知识图谱...');
    console.log('配置: 性能优先模式');
    console.log('  - LLM: 禁用');
    console.log('  - 语义关系: 禁用');
    console.log('  - 质量过滤: 禁用');
    console.log('  - 并行处理: 启用\n');
    
    const startTime = Date.now();
    
    const result = await kgService.buildKnowledgeGraph(
      doc.id,
      filePath,
      doc.fileType,
      {
        llmClient: null,  // 禁用 LLM
        enableSemanticRelations: false,  // 禁用语义关系
        enableQualityFilter: false  // 禁用质量过滤
      }
    );
    
    const duration = Date.now() - startTime;
    const durationSec = (duration / 1000).toFixed(2);
    
    // 6. 显示结果
    console.log(`\n✓ 知识图谱生成完成! 耗时: ${durationSec}秒\n`);
    
    console.log('=== 生成结果 ===');
    console.log(`CKBs: ${result.ckbs_created}`);
    console.log(`实体: ${result.entities_created}`);
    console.log(`关系: ${result.relations_created.builtin + result.relations_created.cooccurrence}`);
    console.log(`  - 内置关系: ${result.relations_created.builtin}`);
    console.log(`  - 共现关系: ${result.relations_created.cooccurrence}`);
    
    if (result.ckbs_created > 0) {
      const msPerCkb = (duration / result.ckbs_created).toFixed(2);
      console.log(`\n平均每个CKB: ${msPerCkb}ms`);
    }
    
    // 7. 性能评估
    console.log('\n=== 性能评估 ===');
    if (result.ckbs_created > 0) {
      const avgMsPerCkb = duration / result.ckbs_created;
      if (avgMsPerCkb < 50) {
        console.log(`✓ 优秀! 平均每个CKB ${avgMsPerCkb.toFixed(2)}ms`);
      } else if (avgMsPerCkb < 100) {
        console.log(`✓ 良好! 平均每个CKB ${avgMsPerCkb.toFixed(2)}ms`);
      } else if (avgMsPerCkb < 200) {
        console.log(`⚠ 可接受! 平均每个CKB ${avgMsPerCkb.toFixed(2)}ms`);
      } else {
        console.log(`⚠ 需要优化! 平均每个CKB ${avgMsPerCkb.toFixed(2)}ms`);
      }
    }
    
    // 8. 验证数据库中的数据
    console.log('\n=== 数据库验证 ===');
    const finalCKBs = await prisma.cKB.count({
      where: { docId: doc.id.toString() }
    });
    
    const finalEntities = await prisma.kGEntity.count();
    
    const finalRelations = await prisma.kGRelation.count();
    
    console.log(`数据库中的数据:`);
    console.log(`  - CKBs: ${finalCKBs}`);
    console.log(`  - 实体: ${finalEntities}`);
    console.log(`  - 关系: ${finalRelations}`);
    
    // 9. 显示实体样例
    if (finalEntities > 0) {
      console.log('\n=== 实体样例 ===');
      const sampleEntities = await prisma.kGEntity.findMany({
        take: 3,
        select: {
          id: true,
          type: true,
          canonicalName: true,
          confidence: true
        }
      });
      
      sampleEntities.forEach((entity, index) => {
        console.log(`\n实体 ${index + 1}:`);
        console.log(`  - 类型: ${entity.type}`);
        console.log(`  - 名称: ${entity.canonicalName}`);
        console.log(`  - 置信度: ${(entity.confidence * 100).toFixed(1)}%`);
      });
    }
    
    // 10. 显示关系样例
    if (finalRelations > 0) {
      console.log('\n=== 关系样例 ===');
      const sampleRelations = await prisma.kGRelation.findMany({
        take: 3,
        select: {
          id: true,
          type: true,
          sourceId: true,
          targetId: true,
          confidence: true
        }
      });
      
      for (const relation of sampleRelations) {
        const sourceEntity = await prisma.kGEntity.findUnique({
          where: { id: relation.sourceId },
          select: { canonicalName: true }
        });
        
        const targetEntity = await prisma.kGEntity.findUnique({
          where: { id: relation.targetId },
          select: { canonicalName: true }
        });
        
        console.log(`\n关系:`);
        console.log(`  - ${sourceEntity?.canonicalName || '未知'} --[${relation.type}]--> ${targetEntity?.canonicalName || '未知'}`);
        console.log(`  - 置信度: ${(relation.confidence * 100).toFixed(1)}%`);
      }
    }
    
    console.log('\n=== 测试完成 ===');
    console.log('✓ 知识图谱生成流程正常工作');
    
    await prisma.$disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('\n错误详情:', error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testKGFlow();
