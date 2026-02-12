const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearDocuments() {
  try {
    console.log('开始清空文档数据库...\n');

    // 按照依赖关系顺序删除
    console.log('1. 清空文档标签关联...');
    const deletedDocTags = await prisma.documentTag.deleteMany({});
    console.log(`   ✓ 删除了 ${deletedDocTags.count} 条记录\n`);

    console.log('2. 清空文档实体关联...');
    const deletedDocEntities = await prisma.documentEntity.deleteMany({});
    console.log(`   ✓ 删除了 ${deletedDocEntities.count} 条记录\n`);

    console.log('3. 清空搜索历史...');
    const deletedSearchHistory = await prisma.searchHistory.deleteMany({});
    console.log(`   ✓ 删除了 ${deletedSearchHistory.count} 条记录\n`);

    console.log('4. 清空CKB（知识块）...');
    const deletedCKB = await prisma.cKB.deleteMany({});
    console.log(`   ✓ 删除了 ${deletedCKB.count} 条记录\n`);

    console.log('5. 清空文档结构分析...');
    const deletedDocStructures = await prisma.documentStructure.deleteMany({});
    console.log(`   ✓ 删除了 ${deletedDocStructures.count} 条记录\n`);

    console.log('6. 清空验证报告...');
    const deletedValidationReports = await prisma.validationReport.deleteMany({});
    console.log(`   ✓ 删除了 ${deletedValidationReports.count} 条记录\n`);

    console.log('7. 清空处理监控...');
    const deletedProcessingMonitors = await prisma.processingMonitor.deleteMany({});
    console.log(`   ✓ 删除了 ${deletedProcessingMonitors.count} 条记录\n`);

    console.log('8. 清空分段处理...');
    const deletedSegmentProcessing = await prisma.segmentProcessing.deleteMany({});
    console.log(`   ✓ 删除了 ${deletedSegmentProcessing.count} 条记录\n`);

    console.log('9. 清空文档表...');
    const deletedDocuments = await prisma.document.deleteMany({});
    console.log(`   ✓ 删除了 ${deletedDocuments.count} 条记录\n`);

    console.log('✅ 文档数据库清空完成！');
    console.log('\n📊 总计删除：');
    console.log(`   - 文档: ${deletedDocuments.count}`);
    console.log(`   - 文档标签关联: ${deletedDocTags.count}`);
    console.log(`   - 文档实体关联: ${deletedDocEntities.count}`);
    console.log(`   - 搜索历史: ${deletedSearchHistory.count}`);
    console.log(`   - CKB: ${deletedCKB.count}`);
    console.log(`   - 文档结构: ${deletedDocStructures.count}`);
    console.log(`   - 验证报告: ${deletedValidationReports.count}`);
    console.log(`   - 处理监控: ${deletedProcessingMonitors.count}`);
    console.log(`   - 分段处理: ${deletedSegmentProcessing.count}`);

  } catch (error) {
    console.error('❌ 清空数据库时出错:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearDocuments();
