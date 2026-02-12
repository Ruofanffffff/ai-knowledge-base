#!/usr/bin/env node

/**
 * KG数据一致性检查工具
 * 
 * 检查文档和知识图谱数据的一致性
 * 生成详细的一致性报告
 * 
 * 使用方法:
 *   node scripts/check_kg_consistency.js
 *   node scripts/check_kg_consistency.js --fix  # 自动修复问题
 *   node scripts/check_kg_consistency.js --report output.json  # 生成报告文件
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// 解析命令行参数
const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');
const reportIndex = args.indexOf('--report');
const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

/**
 * 主函数
 */
async function main() {
  console.log('=== KG数据一致性检查工具 ===\n');
  console.log(`开始时间: ${new Date().toISOString()}`);
  console.log(`自动修复: ${shouldFix ? '是' : '否'}\n`);

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalDocuments: 0,
      totalKGData: 0,
      totalStatuses: 0,
      orphanedKG: 0,
      missingKG: 0,
      statusMismatch: 0,
      fixed: 0
    },
    issues: [],
    details: []
  };

  try {
    // 1. 检查孤立的KG数据
    console.log('1. 检查孤立的KG数据...');
    const orphanedKG = await checkOrphanedKG();
    report.issues.push(...orphanedKG);
    report.summary.orphanedKG = orphanedKG.length;

    // 2. 检查缺失的KG数据
    console.log('2. 检查缺失的KG数据...');
    const missingKG = await checkMissingKG();
    report.issues.push(...missingKG);
    report.summary.missingKG = missingKG.length;

    // 3. 检查状态不一致
    console.log('3. 检查状态不一致...');
    const statusMismatch = await checkStatusMismatch();
    report.issues.push(...statusMismatch);
    report.summary.statusMismatch = statusMismatch.length;

    // 4. 统计总数
    report.summary.totalDocuments = await prisma.note.count();
    report.summary.totalKGData = await prisma.cKB.count();
    report.summary.totalStatuses = await prisma.kGBuildStatus.count().catch(() => 0);

    // 5. 自动修复（如果启用）
    if (shouldFix && report.issues.length > 0) {
      console.log('\n4. 自动修复问题...');
      const fixed = await fixIssues(report.issues);
      report.summary.fixed = fixed;
    }

    // 6. 生成报告
    console.log('\n=== 检查结果 ===\n');
    printSummary(report.summary);

    if (report.issues.length > 0) {
      console.log('\n=== 发现的问题 ===\n');
      printIssues(report.issues);
    } else {
      console.log('\n✓ 未发现数据一致性问题');
    }

    // 7. 保存报告文件
    if (reportFile) {
      const reportPath = path.resolve(reportFile);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n报告已保存到: ${reportPath}`);
    }

  } catch (error) {
    console.error('\n错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 检查孤立的KG数据（文档不存在但KG数据存在）
 */
async function checkOrphanedKG() {
  const issues = [];

  try {
    // 查询所有KG数据
    const kgData = await prisma.cKB.findMany({
      select: { doc_id: true },
      distinct: ['doc_id']
    });

    for (const kg of kgData) {
      // 检查对应的文档是否存在
      const document = await prisma.note.findUnique({
        where: { id: kg.doc_id }
      });

      if (!document) {
        issues.push({
          type: 'orphaned_kg',
          severity: 'high',
          docId: kg.doc_id,
          message: `KG数据存在但文档不存在`,
          recommendation: '删除孤立的KG数据'
        });
      }
    }
  } catch (error) {
    console.error('检查孤立KG数据失败:', error.message);
  }

  return issues;
}

/**
 * 检查缺失的KG数据（文档存在且状态为completed但KG数据不存在）
 */
async function checkMissingKG() {
  const issues = [];

  try {
    // 查询所有状态为completed的文档
    const completedStatuses = await prisma.kGBuildStatus.findMany({
      where: { status: 'completed' }
    }).catch(() => []);

    for (const status of completedStatuses) {
      // 检查对应的KG数据是否存在
      const kgData = await prisma.cKB.findFirst({
        where: { doc_id: status.doc_id }
      });

      if (!kgData) {
        // 检查文档是否存在
        const document = await prisma.note.findUnique({
          where: { id: status.doc_id }
        });

        if (document) {
          issues.push({
            type: 'missing_kg',
            severity: 'medium',
            docId: status.doc_id,
            message: `文档存在且状态为completed但KG数据不存在`,
            recommendation: '重新构建KG或更新状态'
          });
        }
      }
    }
  } catch (error) {
    console.error('检查缺失KG数据失败:', error.message);
  }

  return issues;
}

/**
 * 检查状态不一致（KG数据存在但状态不是completed）
 */
async function checkStatusMismatch() {
  const issues = [];

  try {
    // 查询所有KG数据
    const kgData = await prisma.cKB.findMany({
      select: { doc_id: true },
      distinct: ['doc_id']
    });

    for (const kg of kgData) {
      // 检查对应的状态
      const status = await prisma.kGBuildStatus.findFirst({
        where: { doc_id: kg.doc_id }
      }).catch(() => null);

      if (!status) {
        issues.push({
          type: 'status_missing',
          severity: 'low',
          docId: kg.doc_id,
          message: `KG数据存在但状态记录不存在`,
          recommendation: '创建状态记录'
        });
      } else if (status.status !== 'completed') {
        issues.push({
          type: 'status_mismatch',
          severity: 'low',
          docId: kg.doc_id,
          message: `KG数据存在但状态为 ${status.status}`,
          recommendation: '更新状态为completed'
        });
      }
    }
  } catch (error) {
    console.error('检查状态不一致失败:', error.message);
  }

  return issues;
}

/**
 * 自动修复问题
 */
async function fixIssues(issues) {
  let fixed = 0;

  for (const issue of issues) {
    try {
      switch (issue.type) {
        case 'orphaned_kg':
          // 删除孤立的KG数据
          await prisma.cKB.deleteMany({
            where: { doc_id: issue.docId }
          });
          await prisma.cKBRelation.deleteMany({
            where: { doc_id: issue.docId }
          }).catch(() => {});
          await prisma.kGBuildStatus.deleteMany({
            where: { doc_id: issue.docId }
          }).catch(() => {});
          console.log(`✓ 已删除孤立的KG数据: ${issue.docId}`);
          fixed++;
          break;

        case 'status_missing':
          // 创建状态记录
          await prisma.kGBuildStatus.create({
            data: {
              doc_id: issue.docId,
              status: 'completed',
              created_at: new Date(),
              updated_at: new Date()
            }
          }).catch(() => {});
          console.log(`✓ 已创建状态记录: ${issue.docId}`);
          fixed++;
          break;

        case 'status_mismatch':
          // 更新状态为completed
          await prisma.kGBuildStatus.updateMany({
            where: { doc_id: issue.docId },
            data: {
              status: 'completed',
              updated_at: new Date()
            }
          }).catch(() => {});
          console.log(`✓ 已更新状态: ${issue.docId}`);
          fixed++;
          break;

        case 'missing_kg':
          // 缺失的KG需要手动重建，这里只记录
          console.log(`! 需要手动重建KG: ${issue.docId}`);
          break;
      }
    } catch (error) {
      console.error(`修复失败 (${issue.docId}):`, error.message);
    }
  }

  return fixed;
}

/**
 * 打印摘要
 */
function printSummary(summary) {
  console.log(`总文档数: ${summary.totalDocuments}`);
  console.log(`总KG数据: ${summary.totalKGData}`);
  console.log(`总状态记录: ${summary.totalStatuses}`);
  console.log('');
  console.log(`孤立的KG数据: ${summary.orphanedKG}`);
  console.log(`缺失的KG数据: ${summary.missingKG}`);
  console.log(`状态不一致: ${summary.statusMismatch}`);
  
  if (shouldFix) {
    console.log(`已修复: ${summary.fixed}`);
  }
}

/**
 * 打印问题列表
 */
function printIssues(issues) {
  const grouped = {};
  
  issues.forEach(issue => {
    if (!grouped[issue.type]) {
      grouped[issue.type] = [];
    }
    grouped[issue.type].push(issue);
  });

  Object.entries(grouped).forEach(([type, items]) => {
    console.log(`\n${type} (${items.length}):`);
    items.slice(0, 10).forEach(issue => {
      console.log(`  - ${issue.docId}: ${issue.message}`);
      console.log(`    建议: ${issue.recommendation}`);
    });
    
    if (items.length > 10) {
      console.log(`  ... 还有 ${items.length - 10} 个问题`);
    }
  });
}

// 运行主函数
main().catch(console.error);
