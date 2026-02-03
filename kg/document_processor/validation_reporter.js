/**
 * Validation Reporter
 * 
 * Generates detailed validation reports
 * Provides document structure tree view and quality assessment
 */

const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Generate validation report
 * @param {Object} validationResult - ValidationResult
 * @param {Object} structure - DocumentStructure
 * @returns {Promise<Object>} ValidationReport
 */
async function generateReport(validationResult, structure) {
  const reportId = uuidv4();
  
  // 1. Generate summary
  const summary = {
    total_structural_units: validationResult.total_structural_units,
    ckb_count: validationResult.ckb_count,
    skipped_count: validationResult.skipped_count,
    coverage_rate: validationResult.coverage_rate,
    is_complete: validationResult.is_complete,
    quality_score: calculateQualityScore(validationResult)
  };
  
  // 2. Mark processed nodes in structure tree
  const structureTree = markProcessedNodes(
    structure.hierarchy,
    validationResult.missing_units
  );
  
  // 3. Organize skipped content
  const skippedContent = structure.units
    .filter(u => u.should_filter)
    .map(u => ({
      unit_id: u.unit_id,
      content: u.content.substring(0, 100),
      filter_reason: u.filter_reason,
      matched_rule: u.matched_rule || 'unknown'
    }));
  
  // 4. Organize low quality CKBs
  const lowQualityCKBs = validationResult.low_quality_ckbs.map(ckb => {
    const content = typeof ckb.content === 'string' ? JSON.parse(ckb.content) : ckb.content;
    const quality = typeof ckb.quality === 'string' ? JSON.parse(ckb.quality) : ckb.quality;
    
    return {
      ckb_id: ckb.id,
      content: content.text ? content.text.substring(0, 100) : '',
      source_confidence: quality.source_confidence,
      issues: identifyQualityIssues(ckb)
    };
  });
  
  // 5. Organize missing units
  const missingUnits = validationResult.missing_units.map(u => ({
    unit_id: u.unit_id,
    type: u.type,
    content: u.content.substring(0, 100),
    level: u.level,
    parent_id: u.parent_id
  }));
  
  // 6. Generate recommendations
  const recommendations = generateRecommendations(validationResult);
  
  const report = {
    report_id: reportId,
    doc_id: validationResult.doc_id,
    created_at: new Date().toISOString(),
    summary,
    structure_tree: structureTree,
    skipped_content: skippedContent,
    low_quality_ckbs: lowQualityCKBs,
    missing_units: missingUnits,
    recommendations
  };
  
  // 7. Persist report
  await saveReport(report);
  
  return report;
}

/**
 * Calculate quality score
 * @param {Object} validationResult - ValidationResult
 * @returns {number} Quality score (0-100)
 */
function calculateQualityScore(validationResult) {
  let score = 100;
  
  // Coverage rate deduction
  if (validationResult.coverage_rate < 0.95) {
    score -= (0.95 - validationResult.coverage_rate) * 100;
  }
  
  // Low quality CKB deduction
  if (validationResult.ckb_count > 0) {
    const lowQualityRate = validationResult.low_quality_ckbs.length / validationResult.ckb_count;
    score -= lowQualityRate * 20;
  }
  
  // Missing content deduction
  if (validationResult.total_structural_units > 0) {
    const missingRate = validationResult.missing_units.length / validationResult.total_structural_units;
    score -= missingRate * 30;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Mark processed nodes in hierarchy tree
 * @param {Object} hierarchy - HierarchyTree
 * @param {Array} missingUnits - Array of missing units
 * @returns {Object} Marked hierarchy tree
 */
function markProcessedNodes(hierarchy, missingUnits) {
  const missingUnitIds = new Set(missingUnits.map(u => u.unit_id));
  
  function markNode(node) {
    const marked = { ...node };
    marked.processed = !missingUnitIds.has(node.unit_id);
    
    if (node.children && node.children.length > 0) {
      marked.children = node.children.map(child => markNode(child));
    }
    
    return marked;
  }
  
  return {
    root: markNode(hierarchy.root)
  };
}

/**
 * Identify quality issues in a CKB
 * @param {Object} ckb - CKB object
 * @returns {Array} Array of issue descriptions
 */
function identifyQualityIssues(ckb) {
  const issues = [];
  const quality = typeof ckb.quality === 'string' ? JSON.parse(ckb.quality) : ckb.quality;
  const content = typeof ckb.content === 'string' ? JSON.parse(ckb.content) : ckb.content;
  
  if (quality.source_confidence < 0.5) {
    issues.push('源置信度过低');
  }
  
  if (content.text && content.text.length < 20) {
    issues.push('内容过短');
  }
  
  if (quality.completeness_score && quality.completeness_score < 0.5) {
    issues.push('完整性评分低');
  }
  
  return issues;
}

/**
 * Generate optimization recommendations
 * @param {Object} validationResult - ValidationResult
 * @returns {Array} Array of recommendations
 */
function generateRecommendations(validationResult) {
  const recommendations = [];
  
  if (validationResult.coverage_rate < 0.90) {
    recommendations.push('覆盖率过低，建议检查文档解析逻辑或调整过滤规则');
  }
  
  if (validationResult.ckb_count > 0 && 
      validationResult.low_quality_ckbs.length > validationResult.ckb_count * 0.1) {
    recommendations.push('低质量 CKB 比例过高，建议检查文档质量或 OCR/ASR 配置');
  }
  
  if (validationResult.missing_units.length > 0) {
    recommendations.push(`发现 ${validationResult.missing_units.length} 个未处理的结构单元，建议重新处理文档`);
  }
  
  if (validationResult.coverage_rate >= 0.95 && validationResult.missing_units.length === 0) {
    recommendations.push('文档处理完整，质量良好');
  }
  
  return recommendations;
}

/**
 * Save report to database
 * @param {Object} report - ValidationReport
 * @returns {Promise<string>} Report ID
 */
async function saveReport(report) {
  await prisma.validationReport.create({
    data: {
      reportId: report.report_id,
      docId: report.doc_id,
      summary: JSON.stringify(report.summary),
      structureTree: JSON.stringify(report.structure_tree),
      skippedContent: JSON.stringify(report.skipped_content),
      lowQualityCkbs: JSON.stringify(report.low_quality_ckbs),
      missingUnits: JSON.stringify(report.missing_units),
      recommendations: JSON.stringify(report.recommendations)
    }
  });
  
  return report.report_id;
}

/**
 * Get report by report ID
 * @param {string} reportId - Report ID
 * @returns {Promise<Object>} ValidationReport
 */
async function getReport(reportId) {
  const dbReport = await prisma.validationReport.findUnique({
    where: { reportId: reportId }
  });
  
  if (!dbReport) {
    throw new Error(`Report ${reportId} not found`);
  }
  
  return {
    report_id: dbReport.reportId,
    doc_id: dbReport.docId,
    created_at: dbReport.createdAt.toISOString(),
    summary: JSON.parse(dbReport.summary),
    structure_tree: JSON.parse(dbReport.structureTree),
    skipped_content: JSON.parse(dbReport.skippedContent),
    low_quality_ckbs: JSON.parse(dbReport.lowQualityCkbs),
    missing_units: JSON.parse(dbReport.missingUnits),
    recommendations: JSON.parse(dbReport.recommendations)
  };
}

/**
 * Get report by document ID
 * @param {string} docId - Document ID
 * @returns {Promise<Object>} ValidationReport (most recent)
 */
async function getReportByDocId(docId) {
  const dbReport = await prisma.validationReport.findFirst({
    where: { docId: docId },
    orderBy: { createdAt: 'desc' }
  });
  
  if (!dbReport) {
    throw new Error(`No report found for document ${docId}`);
  }
  
  return {
    report_id: dbReport.reportId,
    doc_id: dbReport.docId,
    created_at: dbReport.createdAt.toISOString(),
    summary: JSON.parse(dbReport.summary),
    structure_tree: JSON.parse(dbReport.structureTree),
    skipped_content: JSON.parse(dbReport.skippedContent),
    low_quality_ckbs: JSON.parse(dbReport.lowQualityCkbs),
    missing_units: JSON.parse(dbReport.missingUnits),
    recommendations: JSON.parse(dbReport.recommendations)
  };
}

/**
 * Export report to JSON
 * @param {string} reportId - Report ID
 * @returns {Promise<string>} JSON string
 */
async function exportReportJSON(reportId) {
  const report = await getReport(reportId);
  return JSON.stringify(report, null, 2);
}

/**
 * Export report to CSV
 * @param {string} reportId - Report ID
 * @returns {Promise<string>} CSV string
 */
async function exportReportCSV(reportId) {
  const report = await getReport(reportId);
  
  // CSV format: summary + missing units
  let csv = 'Metric,Value\n';
  csv += `Document ID,${report.doc_id}\n`;
  csv += `Total Units,${report.summary.total_structural_units}\n`;
  csv += `CKB Count,${report.summary.ckb_count}\n`;
  csv += `Skipped Count,${report.summary.skipped_count}\n`;
  csv += `Coverage Rate,${(report.summary.coverage_rate * 100).toFixed(2)}%\n`;
  csv += `Quality Score,${report.summary.quality_score.toFixed(2)}\n`;
  csv += `Is Complete,${report.summary.is_complete}\n\n`;
  
  csv += 'Missing Units\n';
  csv += 'Unit ID,Type,Content Preview\n';
  for (const unit of report.missing_units) {
    csv += `${unit.unit_id},${unit.type},"${unit.content.replace(/"/g, '""')}"\n`;
  }
  
  return csv;
}

module.exports = {
  generateReport,
  calculateQualityScore,
  saveReport,
  getReport,
  getReportByDocId,
  exportReportJSON,
  exportReportCSV
};
