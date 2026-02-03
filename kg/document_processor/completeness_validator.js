/**
 * Completeness Validator
 * 
 * Validates CKB generation completeness
 * Calculates coverage rate and identifies missing units
 */

/**
 * Validate document processing completeness
 * @param {string} docId - Document ID
 * @param {Object} structure - DocumentStructure
 * @param {Array} ckbs - Array of CKBs
 * @returns {Promise<Object>} ValidationResult
 */
async function validate(docId, structure, ckbs) {
  // 1. Calculate coverage
  const totalUnits = structure.total_units;
  const ckbCount = ckbs.length;
  const skippedCount = structure.units.filter(u => u.should_filter).length;
  const coverageRate = calculateCoverage(totalUnits, ckbCount, skippedCount);
  
  // 2. Identify missing units
  const missingUnits = identifyMissingUnits(structure, ckbs);
  
  // 3. Identify low quality CKBs
  const lowQualityCKBs = ckbs.filter(ckb => {
    const quality = typeof ckb.quality === 'string' ? JSON.parse(ckb.quality) : ckb.quality;
    return quality.source_confidence < 0.5;
  });
  
  // 4. Generate warnings
  const warnings = [];
  if (coverageRate < 0.95) {
    warnings.push(`覆盖率 ${(coverageRate * 100).toFixed(1)}% 低于 95%，可能存在遗漏内容`);
  }
  if (lowQualityCKBs.length > 0) {
    warnings.push(`发现 ${lowQualityCKBs.length} 个低质量 CKB（置信度 < 0.5）`);
  }
  if (missingUnits.length > 0) {
    warnings.push(`发现 ${missingUnits.length} 个未处理的结构单元`);
  }
  
  return {
    doc_id: docId,
    total_structural_units: totalUnits,
    ckb_count: ckbCount,
    skipped_count: skippedCount,
    coverage_rate: coverageRate,
    missing_units: missingUnits,
    low_quality_ckbs: lowQualityCKBs,
    is_complete: coverageRate >= 0.95 && missingUnits.length === 0,
    warnings
  };
}

/**
 * Calculate coverage rate
 * @param {number} totalUnits - Total structural units
 * @param {number} ckbCount - Number of CKBs
 * @param {number} skippedCount - Number of skipped units
 * @returns {number} Coverage rate (0-1)
 */
function calculateCoverage(totalUnits, ckbCount, skippedCount) {
  if (totalUnits === 0) return 1.0;
  return (ckbCount + skippedCount) / totalUnits;
}

/**
 * Identify missing structural units
 * @param {Object} structure - DocumentStructure
 * @param {Array} ckbs - Array of CKBs
 * @returns {Array} Array of missing StructuralUnit
 */
function identifyMissingUnits(structure, ckbs) {
  // Build set of unit IDs that have CKBs
  const ckbUnitIds = new Set();
  
  for (const ckb of ckbs) {
    const sourceMeta = typeof ckb.sourceMeta === 'string' 
      ? JSON.parse(ckb.sourceMeta) 
      : ckb.sourceMeta;
    
    if (sourceMeta && sourceMeta.unit_id) {
      ckbUnitIds.add(sourceMeta.unit_id);
    }
  }
  
  // Find units that are not filtered and don't have CKBs
  return structure.units.filter(unit => 
    !unit.should_filter && 
    !unit.is_empty && 
    !ckbUnitIds.has(unit.unit_id)
  );
}

module.exports = {
  validate,
  calculateCoverage,
  identifyMissingUnits
};
