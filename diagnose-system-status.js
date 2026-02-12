#!/usr/bin/env node

/**
 * 系统状态诊断脚本
 * 检查数据库状态、配置、和可能的错误来源
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function diagnoseSystem() {
  console.log('='.repeat(80));
  console.log('系统状态诊断');
  console.log('='.repeat(80));
  console.log('');

  try {
    // 1. 检查环境变量配置
    console.log('📋 1. 环境变量配置:');
    console.log(`   AUTO_BUILD_KG: ${process.env.AUTO_BUILD_KG || 'false'} ${process.env.AUTO_BUILD_KG === 'true' ? '(自动构建已启用)' : '(自动构建已禁用)'}`);
    console.log(`   ENABLE_LLM_PREPROCESSING: ${process.env.ENABLE_LLM_PREPROCESSING || 'false'}`);
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL || '未设置'}`);
    console.log('');

    // 2. 检查数据库连接
    console.log('🔌 2. 数据库连接:');
    try {
      await prisma.$connect();
      console.log('   ✅ 数据库连接正常');
    } catch (error) {
      console.log('   ❌ 数据库连接失败:', error.message);
    }
    console.log('');

    // 3. 检查数据库文件
    console.log('📁 3. 数据库文件:');
    const dbPath = path.join(__dirname, 'data', 'knowledge_graph.db');
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      console.log(`   ✅ 数据库文件存在: ${dbPath}`);
      console.log(`   📊 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   📅 最后修改: ${stats.mtime.toLocaleString('zh-CN')}`);
    } else {
      console.log(`   ❌ 数据库文件不存在: ${dbPath}`);
    }
    console.log('');

    // 4. 检查数据统计
    console.log('📊 4. 数据统计:');
    const stats = {
      documents: await prisma.document.count(),
      ckbs: await prisma.cKB.count(),
      kgEntities: await prisma.kGEntity.count(),
      kgRelations: await prisma.kGRelation.count(),
      schemas: await prisma.schema.count(),
      relationTypes: await prisma.relationType.count(),
      users: await prisma.user.count(),
      notes: await prisma.note.count(),
    };

    console.log(`   文档: ${stats.documents}`);
    console.log(`   CKB: ${stats.ckbs}`);
    console.log(`   KG 实体: ${stats.kgEntities}`);
    console.log(`   KG 关系: ${stats.kgRelations}`);
    console.log(`   Schema 定义: ${stats.schemas}`);
    console.log(`   关系类型: ${stats.relationTypes}`);
    console.log(`   用户: ${stats.users}`);
    console.log(`   便签: ${stats.notes}`);
    console.log('');

    // 5. 检查最近的文档
    console.log('📄 5. 最近的文档（前 5 个）:');
    const recentDocs = await prisma.document.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        type: true,
        createdAt: true,
      },
    });

    if (recentDocs.length === 0) {
      console.log('   ℹ️  没有文档');
    } else {
      recentDocs.forEach((doc, index) => {
        console.log(`   ${index + 1}. ${doc.title} (${doc.type}) - ${doc.createdAt.toLocaleString('zh-CN')}`);
      });
    }
    console.log('');

    // 6. 检查孤立的 KG 数据
    console.log('🔍 6. 数据一致性检查:');
    
    // 检查孤立的 CKB（没有对应文档）
    const allCKBs = await prisma.cKB.findMany({
      select: { docId: true },
      distinct: ['docId'],
    });
    
    let orphanedCKBs = 0;
    for (const ckb of allCKBs) {
      const doc = await prisma.document.findUnique({
        where: { id: ckb.docId },
      });
      if (!doc) {
        orphanedCKBs++;
      }
    }
    
    if (orphanedCKBs > 0) {
      console.log(`   ⚠️  发现 ${orphanedCKBs} 个孤立的 CKB（没有对应文档）`);
      console.log(`   💡 建议：运行清理脚本删除孤立数据`);
    } else {
      console.log('   ✅ 没有孤立的 CKB 数据');
    }
    
    // 检查孤立的 KG 实体（没有对应文档）
    const allEntities = await prisma.kGEntity.findMany({
      select: { supportedBy: true },
      take: 100, // 限制检查数量
    });
    
    let orphanedEntities = 0;
    for (const entity of allEntities) {
      try {
        const supportedBy = JSON.parse(entity.supportedBy);
        if (supportedBy.ckb_ids && supportedBy.ckb_ids.length > 0) {
          const ckbId = supportedBy.ckb_ids[0];
          const ckb = await prisma.cKB.findUnique({
            where: { id: ckbId },
          });
          if (!ckb) {
            orphanedEntities++;
          }
        }
      } catch (error) {
        // 忽略解析错误
      }
    }
    
    if (orphanedEntities > 0) {
      console.log(`   ⚠️  发现 ${orphanedEntities} 个孤立的 KG 实体（没有对应 CKB）`);
      console.log(`   💡 建议：运行清理脚本删除孤立数据`);
    } else {
      console.log('   ✅ 没有孤立的 KG 实体数据');
    }
    console.log('');

    // 7. 检查系统配置
    console.log('⚙️  7. 系统配置建议:');
    
    if (process.env.AUTO_BUILD_KG !== 'true') {
      console.log('   ℹ️  自动构建已禁用');
      console.log('   💡 如需启用自动构建，设置 AUTO_BUILD_KG=true');
      console.log('   💡 手动构建 API: POST /api/kg/build');
    } else {
      console.log('   ✅ 自动构建已启用');
      console.log('   ⚠️  注意：上传文档后会自动生成知识图谱，可能消耗较多资源');
    }
    
    if (stats.documents === 0) {
      console.log('   ℹ️  数据库中没有文档');
      console.log('   💡 可以通过前端上传文档或使用 API 导入');
    }
    
    if (stats.schemas === 0) {
      console.log('   ⚠️  没有 Schema 定义');
      console.log('   💡 运行 scripts/import-schemas-from-json.js 导入 Schema');
    }
    console.log('');

    // 8. 检查可能的错误来源
    console.log('🔧 8. 可能的错误来源:');
    
    const issues = [];
    
    // 检查是否有文档但没有 CKB
    if (stats.documents > 0 && stats.ckbs === 0) {
      issues.push({
        type: 'warning',
        message: '有文档但没有 CKB 数据',
        suggestion: '可能需要手动触发知识图谱构建',
      });
    }
    
    // 检查是否有 CKB 但没有 KG 实体
    if (stats.ckbs > 0 && stats.kgEntities === 0) {
      issues.push({
        type: 'warning',
        message: '有 CKB 但没有 KG 实体',
        suggestion: '知识图谱构建可能未完成或失败',
      });
    }
    
    // 检查孤立数据
    if (orphanedCKBs > 0 || orphanedEntities > 0) {
      issues.push({
        type: 'error',
        message: '存在孤立的数据',
        suggestion: '运行清理脚本: node cleanup-orphaned-data.js',
      });
    }
    
    if (issues.length === 0) {
      console.log('   ✅ 没有发现明显的问题');
    } else {
      issues.forEach((issue, index) => {
        const icon = issue.type === 'error' ? '❌' : '⚠️';
        console.log(`   ${icon} ${index + 1}. ${issue.message}`);
        console.log(`      💡 ${issue.suggestion}`);
      });
    }
    console.log('');

    // 9. 总结
    console.log('='.repeat(80));
    console.log('✅ 诊断完成');
    console.log('='.repeat(80));
    console.log('');
    
    if (issues.length > 0) {
      console.log('⚠️  发现 ' + issues.length + ' 个问题，请查看上面的建议');
    } else {
      console.log('✨ 系统状态正常');
    }

  } catch (error) {
    console.error('');
    console.error('❌ 诊断失败:', error.message);
    console.error('');
    console.error('错误详情:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行诊断
diagnoseSystem();
