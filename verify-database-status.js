#!/usr/bin/env node

/**
 * 验证数据库状态
 * 确认文档数据已清空，Schema 和映射数据已保留
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyDatabaseStatus() {
  try {
    console.log('='.repeat(80));
    console.log('数据库状态验证');
    console.log('='.repeat(80));
    console.log('');

    // 检查文档相关数据（应该为 0）
    console.log('📄 文档相关数据（应该为空）:');
    const documentStats = {
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
      entities: await prisma.entity.count(),
      entityRelations: await prisma.entityRelation.count(),
    };

    let allClear = true;
    for (const [key, value] of Object.entries(documentStats)) {
      const status = value === 0 ? '✅' : '❌';
      console.log(`   ${status} ${key}: ${value}`);
      if (value !== 0) allClear = false;
    }
    console.log('');

    // 检查保留的数据（应该存在）
    console.log('🗂️  保留的数据（Schema 和映射）:');
    const preservedStats = {
      schemas: await prisma.schema.count(),
      relationTypes: await prisma.relationType.count(),
      filterRules: await prisma.filterRule.count(),
      users: await prisma.user.count(),
      tags: await prisma.tag.count(),
      settings: await prisma.setting.count(),
      backups: await prisma.backup.count(),
      notes: await prisma.note.count(),
    };

    for (const [key, value] of Object.entries(preservedStats)) {
      console.log(`   📋 ${key}: ${value}`);
    }
    console.log('');

    // 显示一些 Schema 示例
    if (preservedStats.schemas > 0) {
      console.log('📚 Schema 示例（前 5 个）:');
      const schemas = await prisma.schema.findMany({
        take: 5,
        select: {
          name: true,
          entityType: true,
          scene: true,
          active: true,
        },
      });
      schemas.forEach((schema, index) => {
        console.log(`   ${index + 1}. ${schema.name} (${schema.entityType}) - ${schema.scene} - ${schema.active ? '启用' : '禁用'}`);
      });
      console.log('');
    }

    // 显示一些关系类型示例
    if (preservedStats.relationTypes > 0) {
      console.log('🔗 关系类型示例（前 5 个）:');
      const relationTypes = await prisma.relationType.findMany({
        take: 5,
        select: {
          name: true,
          displayName: true,
          domain: true,
          category: true,
          active: true,
        },
      });
      relationTypes.forEach((relationType, index) => {
        console.log(`   ${index + 1}. ${relationType.name} (${relationType.displayName}) - ${relationType.domain}/${relationType.category} - ${relationType.active ? '启用' : '禁用'}`);
      });
      console.log('');
    }

    // 最终结果
    console.log('='.repeat(80));
    if (allClear) {
      console.log('✅ 验证通过！所有文档数据已清空，Schema 和映射数据已保留。');
    } else {
      console.log('⚠️  警告：仍有文档相关数据未清空！');
    }
    console.log('='.repeat(80));

  } catch (error) {
    console.error('');
    console.error('❌ 验证失败:', error.message);
    console.error('');
    console.error('错误详情:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行验证
verifyDatabaseStatus();
