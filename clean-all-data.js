/**
 * 清除所有文档和知识图谱数据，保留用户、Schema、设置等配置数据。
 * 用于重新测试前的环境清理。
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanAll() {
  console.log('=== 开始清理文档和知识图谱数据 ===\n');

  // 按外键依赖顺序删除（子表先删）
  const tables = [
    // KG 后处理清洗
    { name: 'CleanedRelation', fn: () => prisma.cleanedRelation.deleteMany() },
    { name: 'CleanedEntity', fn: () => prisma.cleanedEntity.deleteMany() },
    // KG 关系和实体
    { name: 'KGRelation', fn: () => prisma.kGRelation.deleteMany() },
    { name: 'KGEntity', fn: () => prisma.kGEntity.deleteMany() },
    { name: 'KGTokenUsage', fn: () => prisma.kGTokenUsage.deleteMany() },
    // 文档索引和矫正
    { name: 'DocumentIndex', fn: () => prisma.documentIndex.deleteMany() },
    { name: 'CorrectionRecord', fn: () => prisma.correctionRecord.deleteMany() },
    { name: 'CorrectionStats', fn: () => prisma.correctionStats.deleteMany() },
    { name: 'GraphDescription', fn: () => prisma.graphDescription.deleteMany() },
    // 文档处理
    { name: 'DocumentStructure', fn: () => prisma.documentStructure.deleteMany() },
    { name: 'ValidationReport', fn: () => prisma.validationReport.deleteMany() },
    { name: 'ProcessingMonitor', fn: () => prisma.processingMonitor.deleteMany() },
    { name: 'SegmentProcessing', fn: () => prisma.segmentProcessing.deleteMany() },
    { name: 'Alert', fn: () => prisma.alert.deleteMany() },
    // CKB
    { name: 'CKB', fn: () => prisma.cKB.deleteMany() },
    // 文档关联
    { name: 'DocumentEntity', fn: () => prisma.documentEntity.deleteMany() },
    { name: 'DocumentTag', fn: () => prisma.documentTag.deleteMany() },
    { name: 'SearchHistory', fn: () => prisma.searchHistory.deleteMany() },
    // 实体（非KG的通用实体）
    { name: 'EntityRelation', fn: () => prisma.entityRelation.deleteMany() },
    { name: 'Entity', fn: () => prisma.entity.deleteMany() },
    // 文档本身
    { name: 'Document', fn: () => prisma.document.deleteMany() },
    // 字段分布统计
    { name: 'FieldDistribution', fn: () => prisma.fieldDistribution.deleteMany() },
  ];

  for (const { name, fn } of tables) {
    try {
      const result = await fn();
      console.log(`  ✅ ${name}: 删除 ${result.count} 条记录`);
    } catch (err) {
      console.log(`  ⚠️  ${name}: ${err.message}`);
    }
  }

  console.log('\n=== 清理完成 ===');
  console.log('保留的数据: User, Schema, Setting, Backup, RelationType, FilterRule, Note, Attachment');
  
  await prisma.$disconnect();
}

cleanAll().catch(err => {
  console.error('清理失败:', err);
  prisma.$disconnect();
  process.exit(1);
});
