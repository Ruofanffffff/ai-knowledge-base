/**
 * 诊断 0 实体问题
 * 
 * 目标：找出为什么生成了 141 个 CKB 但是 0 个实体
 * 
 * 诊断步骤：
 * 1. 检查字段提取结果
 * 2. 检查 Schema 匹配结果
 * 3. 检查字段标准化结果
 * 4. 检查实体构建条件
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fieldExtractor = require('./kg/field_extractor/field_extractor');
const schemaManager = require('./kg/schema/schema_manager');
const DocumentClassifier = require('./kg/pipeline/document_classifier');
const MappingBasedNormalizer = require('./kg/field_normalizer/mapping_based_normalizer');
const fs = require('fs');

async function diagnose() {
  console.log('=== 诊断 0 实体问题 ===\n');
  
  try {
    // 1. 获取最近的文档
    const doc = await prisma.document.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    
    if (!doc) {
      console.log('❌ 没有找到文档');
      await prisma.$disconnect();
      return;
    }
    
    console.log(`文档: ${doc.title}`);
    console.log(`ID: ${doc.id}\n`);
    
    // 2. 获取文件路径
    let filePath = null;
    try {
      const metadata = JSON.parse(doc.metadata || '{}');
      filePath = metadata.filePath || metadata.path;
    } catch (e) {
      console.log('❌ 无法解析metadata');
      await prisma.$disconnect();
      return;
    }
    
    if (!filePath || !fs.existsSync(filePath)) {
      console.log('❌ 文件不存在');
      await prisma.$disconnect();
      return;
    }
    
    // 3. 获取一个 CKB 样本
    const ckb = await prisma.cKB.findFirst({
      where: { docId: doc.id.toString() }
    });
    
    if (!ckb) {
      console.log('❌ 没有找到 CKB');
      await prisma.$disconnect();
      return;
    }
    
    console.log('=== 步骤 1: 字段提取 ===');
    
    // 解析 CKB 内容
    const ckbContent = JSON.parse(ckb.content);
    const ckbObj = {
      ckb_id: ckb.id,
      doc_id: doc.id.toString(),
      content: {
        text: ckbContent.text || '',
        title: ckbContent.title || ''
      },
      quality: {
        source_confidence: 0.9
      },
      metadata: {}
    };
    
    console.log(`CKB ID: ${ckb.id}`);
    console.log(`文本长度: ${ckbObj.content.text.length} 字符`);
    console.log(`文本预览: ${ckbObj.content.text.substring(0, 100)}...\n`);
    
    // 提取字段（禁用 LLM）
    const extractedFields = await fieldExtractor.extractFields(ckbObj, {
      useLLM: false,
      useRules: true,
      useNER: true,
      llmClient: null
    });
    
    console.log(`✓ 提取了 ${extractedFields.length} 个字段`);
    if (extractedFields.length > 0) {
      console.log('\n字段样例:');
      extractedFields.slice(0, 5).forEach((field, i) => {
        console.log(`  ${i + 1}. ${field.name}: ${field.value} (类型: ${field.type}, 置信度: ${(field.confidence || 0).toFixed(2)})`);
      });
    } else {
      console.log('⚠️ 没有提取到任何字段！这是问题的根源。');
      await prisma.$disconnect();
      return;
    }
    
    console.log('\n=== 步骤 2: 文档分类 ===');
    
    const documentClassifier = new DocumentClassifier();
    const classificationResult = documentClassifier.classify(extractedFields, {
      topN: 3,
      minConfidence: 0.1
    });
    
    console.log(`主要领域: ${classificationResult.primaryDomain} (置信度: ${(classificationResult.confidence * 100).toFixed(1)}%)`);
    if (classificationResult.allDomains.length > 1) {
      console.log('其他可能的领域:');
      classificationResult.allDomains.slice(1).forEach(d => {
        console.log(`  - ${d.domain}: ${(d.confidence * 100).toFixed(1)}%`);
      });
    }
    
    console.log('\n=== 步骤 3: Schema 匹配 ===');
    
    // 获取所有 Schema
    const allSchemas = await schemaManager.listSchemas({ take: 1000 });
    console.log(`数据库中共有 ${allSchemas.length} 个 Schema`);
    
    // 预筛选 Schema
    const relevantScenes = new Set();
    const relevantEntityTypes = new Set();
    
    classificationResult.allDomains.forEach(domainInfo => {
      const scenes = documentClassifier.getDomainScenes(domainInfo.domain);
      const entityTypes = documentClassifier.getDomainEntityTypes(domainInfo.domain);
      
      scenes.forEach(s => relevantScenes.add(s));
      entityTypes.forEach(et => relevantEntityTypes.add(et));
    });
    
    const schemas = allSchemas.filter(schema => {
      const schemaScene = schema.scene || '';
      const schemaEntityType = schema.entity_type || '';
      
      const sceneMatch = Array.from(relevantScenes).some(scene => 
        schemaScene.includes(scene) || scene.includes(schemaScene)
      );
      
      const entityTypeMatch = relevantEntityTypes.has(schemaEntityType);
      const isGeneralDomain = classificationResult.primaryDomain === 'general';
      
      return isGeneralDomain || sceneMatch || entityTypeMatch;
    });
    
    console.log(`预筛选后有 ${schemas.length} 个相关 Schema\n`);
    
    // 测试字段映射
    console.log('=== 步骤 4: 字段标准化测试 ===');
    
    const mappingBasedNormalizer = new MappingBasedNormalizer();
    await mappingBasedNormalizer.loadMappings();
    
    console.log(`已加载 ${Object.keys(mappingBasedNormalizer.mappings).length} 个 Schema 的映射表\n`);
    
    // 测试前 5 个 Schema
    const testSchemas = schemas.slice(0, 5);
    const mappingResults = [];
    
    for (const schema of testSchemas) {
      const schemaName = schema.schema_name || schema.name;
      const schemaMapping = mappingBasedNormalizer.mappings[schemaName];
      
      if (!schemaMapping) {
        console.log(`Schema "${schemaName}": ❌ 没有映射表`);
        mappingResults.push({
          schemaName,
          hasMapping: false,
          mappedFields: 0,
          totalFields: 0
        });
        continue;
      }
      
      // 尝试映射字段
      let mappedCount = 0;
      for (const field of extractedFields) {
        const mappedField = mappingBasedNormalizer._algorithmMap(field, schemaMapping);
        if (mappedField) {
          mappedCount++;
        }
      }
      
      const coreFields = schema.core_fields || [];
      const completeness = coreFields.length > 0 ? mappedCount / coreFields.length : 0;
      
      console.log(`Schema "${schemaName}":`);
      console.log(`  - 有映射表: ✓`);
      console.log(`  - 映射成功: ${mappedCount}/${extractedFields.length} 个字段`);
      console.log(`  - 核心字段: ${coreFields.length} 个`);
      console.log(`  - 完整度: ${(completeness * 100).toFixed(1)}%`);
      console.log(`  - 阈值: ${(schema.threshold * 100).toFixed(0)}%`);
      console.log(`  - 是否达标: ${completeness >= schema.threshold ? '✓' : '❌'}\n`);
      
      mappingResults.push({
        schemaName,
        hasMapping: true,
        mappedFields: mappedCount,
        totalFields: extractedFields.length,
        coreFields: coreFields.length,
        completeness,
        threshold: schema.threshold,
        meetsThreshold: completeness >= schema.threshold
      });
    }
    
    console.log('=== 步骤 5: 诊断结果 ===\n');
    
    const hasMapping = mappingResults.filter(r => r.hasMapping).length;
    const meetsThreshold = mappingResults.filter(r => r.meetsThreshold).length;
    
    console.log(`测试了 ${testSchemas.length} 个 Schema:`);
    console.log(`  - 有映射表: ${hasMapping}/${testSchemas.length}`);
    console.log(`  - 达到阈值: ${meetsThreshold}/${testSchemas.length}\n`);
    
    if (extractedFields.length === 0) {
      console.log('🔍 问题诊断: 字段提取失败');
      console.log('原因: 没有提取到任何字段');
      console.log('建议:');
      console.log('  1. 检查文档内容是否为空');
      console.log('  2. 检查 Rule 和 NER 提取器是否正常工作');
      console.log('  3. 考虑启用 LLM 提取');
    } else if (hasMapping === 0) {
      console.log('🔍 问题诊断: 缺少映射表');
      console.log('原因: 相关 Schema 没有字段映射表');
      console.log('建议:');
      console.log('  1. 为相关 Schema 添加映射表');
      console.log('  2. 或者启用 LLM 进行字段映射');
    } else if (meetsThreshold === 0) {
      console.log('🔍 问题诊断: 字段映射成功率低');
      console.log('原因: 映射的字段数量不足以达到 Schema 阈值');
      console.log('建议:');
      console.log('  1. 降低 Schema 阈值（当前大多数为 60%）');
      console.log('  2. 扩充映射表，增加更多同义词');
      console.log('  3. 启用 LLM 提高映射成功率');
    } else {
      console.log('🔍 问题诊断: 可能是实体构建阶段的问题');
      console.log('原因: Schema 匹配成功，但实体构建失败');
      console.log('建议:');
      console.log('  1. 检查锚点字段配置');
      console.log('  2. 检查实体构建的前置条件');
      console.log('  3. 查看实体构建日志');
    }
    
    console.log('\n=== 推荐解决方案 ===\n');
    console.log('方案 1: 启用 LLM（推荐）');
    console.log('  - 提高字段映射成功率');
    console.log('  - 提高 Schema 匹配准确性');
    console.log('  - 配置: { llmClient: yourLLMClient, enableSemanticRelations: false }');
    console.log('  - 预期效果: 生成实体，性能仍然较快\n');
    
    console.log('方案 2: 扩充映射表');
    console.log('  - 为常用 Schema 添加更多同义词');
    console.log('  - 降低 Schema 阈值到 40%');
    console.log('  - 配置: 保持当前配置');
    console.log('  - 预期效果: 提高映射成功率，但可能仍然不足\n');
    
    console.log('方案 3: 混合方案（最佳平衡）');
    console.log('  - 启用 LLM 用于字段映射');
    console.log('  - 禁用语义关系（节省时间）');
    console.log('  - 启用质量过滤');
    console.log('  - 配置: { llmClient: yourLLMClient, enableSemanticRelations: false, enableQualityFilter: true }');
    console.log('  - 预期效果: 准确性高，性能可接受');
    
    await prisma.$disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ 诊断失败:', error.message);
    console.error('\n错误详情:', error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

diagnose();
