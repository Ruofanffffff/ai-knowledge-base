#!/usr/bin/env node

/**
 * 清空数据库中的所有文档数据
 * 保留 schema 和映射数据库（kg.db 和 knowledge-base.db）
 * 
 * 清空的表包括：
 * - Document 及其关联数据
 * - CKB (Contextual Knowledge Block)
 * - KG 实体和关系
 * - 文档索引和矫正记录
 * - 文档结构分析和验证报告
 * - 处理监控和分段处理记录
 * 
 * 保留的表包括：
 * - Schema (知识图谱 schema 定义)
 * - RelationType (关系类型定义)
 * - FilterRule (过滤规则)
 * - User (用户数据)
 * - Tag (标签定义)
 * - Setting (系统设置)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearDocuments() {
  try {
    console.log('='.repeat(80));
    console.log('开始清空文档数据库...');
    console.log('='.repeat(80));
    console.log('');

    // 统计清空前的数据
    console.log('📊 清空前统计:');
    const beforeStats = {
      documents: await prisma.document.count(),
      ckbs: await prisma.cKB.count(),
      kgEntities: await prisma.kGEntity.count(),
      kgRelations: await prisma.kGRelation.count(),
      documentIndexes: await prisma.documentIndex.count(),
      correctionRecords: await prisma.correctionRecord.count(),
      documentStructures: await prisma.documentStructure.count(),
      validationReports: await prisma.validationReport.count(),
      processingMonitors: await prisma.processingMonitor.count(),
      segmentProcessing: await prisma.segmentProcessing.count(),
      alerts: await prisma.alert.count(),
      graphDescriptions: await prisma.graphDescription.count(),
      fieldDistributions: await prisma.fieldDistribution.count(),
      kgTokenUsage: await prisma.kGTokenUsage.count(),
      searchHistory: await prisma.searchHistory.count(),
      documentTags: await prisma.documentTag.count(),
      documentEntities: await prisma.documentEntity.count(),
    };
    
    console.log(`   文档: ${beforeStats.documents}`);
    console.log(`   CKB: ${beforeStats.ckbs}`);
    console.log(`   KG 实体: ${beforeStats.kgEntities}`);
    console.log(`   KG 关系: ${beforeStats.kgRelations}`);
    console.log(`   文档索引: ${beforeStats.documentIndexes}`);
    console.log(`   矫正记录: ${beforeStats.correctionRecords}`);
    console.log(`   文档结构: ${beforeStats.documentStructures}`);
    console.log(`   验证报告: ${beforeStats.validationReports}`);
    console.log(`   处理监控: ${beforeStats.processingMonitors}`);
    console.log(`   分段处理: ${beforeStats.segmentProcessing}`);
    console.log(`   告警: ${beforeStats.alerts}`);
    console.log(`   图谱描述: ${beforeStats.graphDescriptions}`);
    console.log(`   字段分布: ${beforeStats.fieldDistributions}`);
    console.log(`   Token 使用: ${beforeStats.kgTokenUsage}`);
    console.log(`   搜索历史: ${beforeStats.searchHistory}`);
    console.log(`   文档标签关联: ${beforeStats.documentTags}`);
    console.log(`   文档实体关联: ${beforeStats.documentEntities}`);
    console.log('');

    // 开始清空数据
    console.log('🗑️  开始清空数据...');
    console.log('');

    // 1. 清空 KG 关系（必须先删除，因为有外键约束）
    console.log('1. 删除 KG 关系...');
    const deletedKGRelations = await prisma.kGRelation.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedKGRelations.count} 条 KG 关系`);

    // 2. 清空 KG 实体
    console.log('2. 删除 KG 实体...');
    const deletedKGEntities = await prisma.kGEntity.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedKGEntities.count} 个 KG 实体`);

    // 3. 清空文档实体关联（必须在删除 Entity 之前）
    console.log('3. 删除文档实体关联...');
    const deletedDocEntities = await prisma.documentEntity.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedDocEntities.count} 条文档实体关联`);

    // 4. 清空实体关系（必须在删除 Entity 之前）
    console.log('4. 删除实体关系...');
    const deletedEntityRelations = await prisma.entityRelation.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedEntityRelations.count} 条实体关系`);

    // 5. 清空实体
    console.log('5. 删除实体...');
    const deletedEntities = await prisma.entity.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedEntities.count} 个实体`);

    // 6. 清空文档标签关联
    console.log('6. 删除文档标签关联...');
    const deletedDocTags = await prisma.documentTag.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedDocTags.count} 条文档标签关联`);

    // 7. 清空 CKB
    console.log('7. 删除 CKB...');
    const deletedCKBs = await prisma.cKB.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedCKBs.count} 个 CKB`);

    // 8. 清空搜索历史
    console.log('8. 删除搜索历史...');
    const deletedSearchHistory = await prisma.searchHistory.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedSearchHistory.count} 条搜索历史`);

    // 9. 清空文档索引
    console.log('9. 删除文档索引...');
    const deletedDocIndexes = await prisma.documentIndex.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedDocIndexes.count} 条文档索引`);

    // 10. 清空矫正记录
    console.log('10. 删除矫正记录...');
    const deletedCorrectionRecords = await prisma.correctionRecord.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedCorrectionRecords.count} 条矫正记录`);

    // 11. 清空矫正统计
    console.log('11. 删除矫正统计...');
    const deletedCorrectionStats = await prisma.correctionStats.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedCorrectionStats.count} 条矫正统计`);

    // 12. 清空图谱描述
    console.log('12. 删除图谱描述...');
    const deletedGraphDescriptions = await prisma.graphDescription.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedGraphDescriptions.count} 条图谱描述`);

    // 13. 清空文档结构分析
    console.log('13. 删除文档结构分析...');
    const deletedDocStructures = await prisma.documentStructure.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedDocStructures.count} 条文档结构`);

    // 14. 清空验证报告
    console.log('14. 删除验证报告...');
    const deletedValidationReports = await prisma.validationReport.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedValidationReports.count} 条验证报告`);

    // 15. 清空处理监控
    console.log('15. 删除处理监控...');
    const deletedProcessingMonitors = await prisma.processingMonitor.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedProcessingMonitors.count} 条处理监控`);

    // 16. 清空分段处理
    console.log('16. 删除分段处理记录...');
    const deletedSegmentProcessing = await prisma.segmentProcessing.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedSegmentProcessing.count} 条分段处理记录`);

    // 17. 清空告警
    console.log('17. 删除告警...');
    const deletedAlerts = await prisma.alert.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedAlerts.count} 条告警`);

    // 18. 清空字段分布统计
    console.log('18. 删除字段分布统计...');
    const deletedFieldDistributions = await prisma.fieldDistribution.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedFieldDistributions.count} 条字段分布统计`);

    // 19. 清空 KG Token 使用记录
    console.log('19. 删除 KG Token 使用记录...');
    const deletedKGTokenUsage = await prisma.kGTokenUsage.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedKGTokenUsage.count} 条 Token 使用记录`);

    // 20. 最后删除文档（因为其他表有外键引用）
    console.log('20. 删除文档...');
    const deletedDocuments = await prisma.document.deleteMany({});
    console.log(`   ✅ 已删除 ${deletedDocuments.count} 个文档`);

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ 文档数据清空完成！');
    console.log('='.repeat(80));
    console.log('');

    // 验证清空结果
    console.log('📊 清空后统计:');
    const afterStats = {
      documents: await prisma.document.count(),
      ckbs: await prisma.cKB.count(),
      kgEntities: await prisma.kGEntity.count(),
      kgRelations: await prisma.kGRelation.count(),
      documentIndexes: await prisma.documentIndex.count(),
      correctionRecords: await prisma.correctionRecord.count(),
    };
    
    console.log(`   文档: ${afterStats.documents}`);
    console.log(`   CKB: ${afterStats.ckbs}`);
    console.log(`   KG 实体: ${afterStats.kgEntities}`);
    console.log(`   KG 关系: ${afterStats.kgRelations}`);
    console.log(`   文档索引: ${afterStats.documentIndexes}`);
    console.log(`   矫正记录: ${afterStats.correctionRecords}`);
    console.log('');

    // 验证保留的数据
    console.log('📋 保留的数据:');
    const preservedStats = {
      schemas: await prisma.schema.count(),
      relationTypes: await prisma.relationType.count(),
      filterRules: await prisma.filterRule.count(),
      users: await prisma.user.count(),
      tags: await prisma.tag.count(),
      settings: await prisma.setting.count(),
    };
    
    console.log(`   Schema 定义: ${preservedStats.schemas}`);
    console.log(`   关系类型: ${preservedStats.relationTypes}`);
    console.log(`   过滤规则: ${preservedStats.filterRules}`);
    console.log(`   用户: ${preservedStats.users}`);
    console.log(`   标签: ${preservedStats.tags}`);
    console.log(`   设置: ${preservedStats.settings}`);
    console.log('');

    console.log('✨ 所有文档数据已清空，Schema 和映射数据已保留！');

  } catch (error) {
    console.error('');
    console.error('❌ 清空失败:', error.message);
    console.error('');
    console.error('错误详情:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行清空
clearDocuments();
