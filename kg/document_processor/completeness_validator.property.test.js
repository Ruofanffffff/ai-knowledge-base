/**
 * Property-Based Tests for Completeness Validator
 * 
 * Tests Properties 2-4, 9-10 from the design document
 */

const fc = require('fast-check');
const completenessValidator = require('./completeness_validator');

describe('Completeness Validator - Property-Based Tests', () => {
  
  // Feature: document-full-processing, Property 2: CKB 生成完整性
  test('Property 2: CKB generation completeness', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),  // total units
        fc.integer({ min: 0, max: 100 }),  // ckb count
        fc.integer({ min: 0, max: 100 }),  // skipped count
        (totalUnits, ckbCount, skippedCount) => {
          // Ensure ckbCount + skippedCount <= totalUnits
          const actualCkbCount = Math.min(ckbCount, totalUnits);
          const actualSkippedCount = Math.min(skippedCount, totalUnits - actualCkbCount);
          
          const coverage = completenessValidator.calculateCoverage(
            totalUnits,
            actualCkbCount,
            actualSkippedCount
          );
          
          // Coverage should be between 0 and 1
          expect(coverage).toBeGreaterThanOrEqual(0);
          expect(coverage).toBeLessThanOrEqual(1);
          
          // If all units are processed, coverage should be 1
          if (actualCkbCount + actualSkippedCount === totalUnits) {
            expect(coverage).toBe(1.0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Feature: document-full-processing, Property 3: 覆盖率计算正确性
  test('Property 3: Coverage calculation correctness', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),  // total units
        fc.integer({ min: 0, max: 1000 }),  // ckb count
        fc.integer({ min: 0, max: 1000 }),  // skipped count
        (totalUnits, ckbCount, skippedCount) => {
          const coverage = completenessValidator.calculateCoverage(
            totalUnits,
            ckbCount,
            skippedCount
          );
          
          // Coverage should equal (ckbCount + skippedCount) / totalUnits
          const expectedCoverage = (ckbCount + skippedCount) / totalUnits;
          expect(coverage).toBeCloseTo(expectedCoverage, 10);
          
          // Coverage should be between 0 and 1 (or slightly above due to rounding)
          expect(coverage).toBeGreaterThanOrEqual(0);
          expect(coverage).toBeLessThanOrEqual(Math.max(1, expectedCoverage));
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Feature: document-full-processing, Property 4: 覆盖率阈值触发
  test('Property 4: Coverage threshold triggering', async () => {
    fc.assert(
      await fc.asyncProperty(
        fc.integer({ min: 10, max: 100 }),  // total units
        fc.float({ min: 0, max: 1 }),       // coverage rate
        async (totalUnits, targetCoverage) => {
          // Calculate ckb and skipped counts to achieve target coverage
          const processedUnits = Math.floor(totalUnits * targetCoverage);
          const ckbCount = Math.floor(processedUnits * 0.8);
          const skippedCount = processedUnits - ckbCount;
          
          // Create structure
          const structure = {
            total_units: totalUnits,
            units: Array(totalUnits).fill(null).map((_, i) => ({
              unit_id: `u${i}`,
              content: `Content ${i}`,
              should_filter: i >= processedUnits,
              is_empty: false
            }))
          };
          
          // Create CKBs
          const ckbs = Array(ckbCount).fill(null).map((_, i) => ({
            sourceMeta: JSON.stringify({ unit_id: `u${i}` }),
            quality: JSON.stringify({ source_confidence: 0.8 })
          }));
          
          const result = await completenessValidator.validate('test-doc', structure, ckbs);
          
          // When coverage < 0.95, should have warning
          if (result.coverage_rate < 0.95) {
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings.some(w => w.includes('覆盖率'))).toBe(true);
          }
          
          // When coverage < 0.90, should trigger alert (warning exists)
          if (result.coverage_rate < 0.90) {
            expect(result.warnings.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Feature: document-full-processing, Property 9: 验证报告完整性
  test('Property 9: Validation report completeness', async () => {
    fc.assert(
      await fc.asyncProperty(
        fc.integer({ min: 5, max: 50 }),    // total units
        fc.integer({ min: 0, max: 10 }),    // low quality count
        async (totalUnits, lowQualityCount) => {
          const ckbCount = Math.min(totalUnits - 2, totalUnits);
          const actualLowQualityCount = Math.min(lowQualityCount, ckbCount);
          
          // Create structure
          const structure = {
            total_units: totalUnits,
            units: Array(totalUnits).fill(null).map((_, i) => ({
              unit_id: `u${i}`,
              content: `Content ${i}`,
              should_filter: false,
              is_empty: false
            }))
          };
          
          // Create CKBs with some low quality
          const ckbs = Array(ckbCount).fill(null).map((_, i) => ({
            sourceMeta: JSON.stringify({ unit_id: `u${i}` }),
            quality: JSON.stringify({ 
              source_confidence: i < actualLowQualityCount ? 0.3 : 0.8 
            })
          }));
          
          const result = await completenessValidator.validate('test-doc', structure, ckbs);
          
          // Report should contain all required fields
          expect(result).toHaveProperty('doc_id');
          expect(result).toHaveProperty('total_structural_units');
          expect(result).toHaveProperty('ckb_count');
          expect(result).toHaveProperty('skipped_count');
          expect(result).toHaveProperty('coverage_rate');
          expect(result).toHaveProperty('missing_units');
          expect(result).toHaveProperty('low_quality_ckbs');
          expect(result).toHaveProperty('is_complete');
          expect(result).toHaveProperty('warnings');
          
          // Values should be correct
          expect(result.total_structural_units).toBe(totalUnits);
          expect(result.ckb_count).toBe(ckbCount);
          expect(result.missing_units).toBeInstanceOf(Array);
          expect(result.low_quality_ckbs).toBeInstanceOf(Array);
          expect(result.warnings).toBeInstanceOf(Array);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Feature: document-full-processing, Property 10: 低质量 CKB 识别
  test('Property 10: Low quality CKB identification', async () => {
    fc.assert(
      await fc.asyncProperty(
        fc.integer({ min: 1, max: 50 }),  // number of CKBs
        fc.array(
          fc.float({ min: 0, max: 1, noNaN: true }),
          { minLength: 1, maxLength: 50 }
        ),
        async (numCkbs, confidences) => {
          // Use the minimum of numCkbs and confidences length
          const actualCount = Math.min(numCkbs, confidences.length);
          const actualConfidences = confidences.slice(0, actualCount);
          
          // Create structure with unique unit IDs
          const structure = {
            total_units: actualCount,
            units: Array(actualCount).fill(null).map((_, i) => ({
              unit_id: `u${i}`,
              content: `Content ${i}`,
              should_filter: false,
              is_empty: false
            }))
          };
          
          // Create CKBs
          const ckbs = actualConfidences.map((confidence, i) => ({
            sourceMeta: JSON.stringify({ unit_id: `u${i}` }),
            quality: JSON.stringify({ source_confidence: confidence })
          }));
          
          const result = await completenessValidator.validate('test-doc', structure, ckbs);
          
          // Count expected low quality CKBs
          const expectedLowQuality = actualConfidences.filter(c => c < 0.5).length;
          
          // All CKBs with confidence < 0.5 should be marked as low quality
          expect(result.low_quality_ckbs).toHaveLength(expectedLowQuality);
          
          // Verify each low quality CKB has confidence < 0.5
          for (const ckb of result.low_quality_ckbs) {
            const quality = typeof ckb.quality === 'string' 
              ? JSON.parse(ckb.quality) 
              : ckb.quality;
            expect(quality.source_confidence).toBeLessThan(0.5);
          }
          
          // If there are low quality CKBs, should have warning
          if (expectedLowQuality > 0) {
            expect(result.warnings.some(w => w.includes('低质量'))).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Additional property: Missing units identification
  test('Property: Missing units are correctly identified', async () => {
    fc.assert(
      await fc.asyncProperty(
        fc.integer({ min: 10, max: 50 }),   // total units
        fc.integer({ min: 0, max: 10 }),    // missing count
        async (totalUnits, missingCount) => {
          const actualMissingCount = Math.min(missingCount, totalUnits);
          const ckbCount = totalUnits - actualMissingCount;
          
          // Create structure
          const structure = {
            total_units: totalUnits,
            units: Array(totalUnits).fill(null).map((_, i) => ({
              unit_id: `u${i}`,
              content: `Content ${i}`,
              should_filter: false,
              is_empty: false
            }))
          };
          
          // Create CKBs (excluding the last 'actualMissingCount' units)
          const ckbs = Array(ckbCount).fill(null).map((_, i) => ({
            sourceMeta: JSON.stringify({ unit_id: `u${i}` }),
            quality: JSON.stringify({ source_confidence: 0.8 })
          }));
          
          const result = await completenessValidator.validate('test-doc', structure, ckbs);
          
          // Should identify the missing units
          expect(result.missing_units).toHaveLength(actualMissingCount);
          
          // Missing units should be the ones without CKBs
          const missingIds = result.missing_units.map(u => u.unit_id);
          for (let i = ckbCount; i < totalUnits; i++) {
            expect(missingIds).toContain(`u${i}`);
          }
          
          // If there are missing units, should have warning
          if (actualMissingCount > 0) {
            expect(result.warnings.some(w => w.includes('未处理'))).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
