/**
 * Property-Based Tests for Validation Reporter
 * 
 * Tests Properties 11, 34-36 from the design document
 */

const fc = require('fast-check');
const validationReporter = require('./validation_reporter');

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    validationReport: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn()
    }
  };
  
  return {
    PrismaClient: jest.fn(() => mockPrisma)
  };
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Validation Reporter - Property-Based Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // Feature: document-full-processing, Property 11: 验证报告持久化
  test('Property 11: Validation report persistence', async () => {
    fc.assert(
      await fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),    // total units
        fc.float({ min: 0, max: 1, noNaN: true }),  // coverage rate
        async (totalUnits, coverageRate) => {
          // Clear mocks for each iteration
          jest.clearAllMocks();
          prisma.validationReport.create.mockResolvedValue({});
          
          const processedUnits = Math.floor(totalUnits * coverageRate);
          const ckbCount = Math.floor(processedUnits * 0.8);
          const skippedCount = processedUnits - ckbCount;
          
          const validationResult = {
            doc_id: `doc_${totalUnits}_${coverageRate}`,
            total_structural_units: totalUnits,
            ckb_count: ckbCount,
            skipped_count: skippedCount,
            coverage_rate: coverageRate,
            is_complete: coverageRate >= 0.95,
            missing_units: [],
            low_quality_ckbs: []
          };
          
          const structure = {
            units: [],
            hierarchy: { root: { unit_id: 'root', children: [] } }
          };
          
          const report = await validationReporter.generateReport(validationResult, structure);
          
          // Report should be persisted to database
          expect(prisma.validationReport.create).toHaveBeenCalled();
          
          // Report should have a unique ID
          expect(report.report_id).toBeDefined();
          expect(typeof report.report_id).toBe('string');
          expect(report.report_id.length).toBeGreaterThan(0);
          
          // Report should contain all required data
          const createCalls = prisma.validationReport.create.mock.calls;
          expect(createCalls.length).toBeGreaterThan(0);
          const lastCall = createCalls[createCalls.length - 1][0];
          expect(lastCall.data).toHaveProperty('reportId');
          expect(lastCall.data).toHaveProperty('docId');
          expect(lastCall.data).toHaveProperty('summary');
          expect(lastCall.data).toHaveProperty('structureTree');
          expect(lastCall.data).toHaveProperty('skippedContent');
          expect(lastCall.data).toHaveProperty('lowQualityCkbs');
          expect(lastCall.data).toHaveProperty('missingUnits');
          expect(lastCall.data).toHaveProperty('recommendations');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Feature: document-full-processing, Property 34: 处理质量评分计算
  test('Property 34: Processing quality score calculation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 1000 }),  // total units
        fc.float({ min: 0, max: 1, noNaN: true }),   // coverage rate
        fc.float({ min: 0, max: Math.fround(0.5), noNaN: true }),  // low quality rate
        fc.float({ min: 0, max: Math.fround(0.3), noNaN: true }),  // missing rate
        (totalUnits, coverageRate, lowQualityRate, missingRate) => {
          const ckbCount = Math.floor(totalUnits * coverageRate);
          const lowQualityCount = Math.floor(ckbCount * lowQualityRate);
          const missingCount = Math.floor(totalUnits * missingRate);
          
          const validationResult = {
            coverage_rate: coverageRate,
            ckb_count: ckbCount,
            low_quality_ckbs: Array(lowQualityCount).fill({}),
            total_structural_units: totalUnits,
            missing_units: Array(missingCount).fill({})
          };
          
          const score = validationReporter.calculateQualityScore(validationResult);
          
          // Score should be between 0 and 100
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
          
          // Score should be a number
          expect(typeof score).toBe('number');
          expect(isNaN(score)).toBe(false);
          
          // Perfect processing should give 100
          if (coverageRate >= 0.95 && lowQualityCount === 0 && missingCount === 0) {
            expect(score).toBe(100);
          }
          
          // Lower coverage should result in lower score
          if (coverageRate < 0.95) {
            expect(score).toBeLessThan(100);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Feature: document-full-processing, Property 35: 低质量处理标记
  test('Property 35: Low quality processing marking', async () => {
    fc.assert(
      await fc.asyncProperty(
        fc.integer({ min: 10, max: 100 }),   // total units
        fc.float({ min: 0, max: 1, noNaN: true }),   // coverage rate
        fc.integer({ min: 0, max: 50 }),     // low quality count
        async (totalUnits, coverageRate, lowQualityCount) => {
          // Clear mocks for each iteration
          jest.clearAllMocks();
          prisma.validationReport.create.mockResolvedValue({});
          
          const ckbCount = Math.floor(totalUnits * coverageRate);
          const actualLowQualityCount = Math.min(lowQualityCount, ckbCount);
          
          const validationResult = {
            doc_id: 'test-doc',
            total_structural_units: totalUnits,
            ckb_count: ckbCount,
            skipped_count: 0,
            coverage_rate: coverageRate,
            is_complete: coverageRate >= 0.95,
            missing_units: [],
            low_quality_ckbs: Array(actualLowQualityCount).fill({
              id: 'ckb1',
              content: JSON.stringify({ text: 'Low quality' }),
              quality: JSON.stringify({ source_confidence: 0.3 })
            })
          };
          
          const structure = {
            units: [],
            hierarchy: { root: { unit_id: 'root', children: [] } }
          };
          
          const report = await validationReporter.generateReport(validationResult, structure);
          const score = report.summary.quality_score;
          
          // If quality score < 80, should have recommendations for review
          if (score < 80) {
            expect(report.recommendations.length).toBeGreaterThan(0);
            // Should suggest checking document quality or processing
            const hasQualityRecommendation = report.recommendations.some(r => 
              r.includes('覆盖率') || r.includes('低质量') || r.includes('未处理') || r.includes('检查')
            );
            expect(hasQualityRecommendation).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Feature: document-full-processing, Property 36: 质量问题根因识别
  test('Property 36: Quality issue root cause identification', async () => {
    fc.assert(
      await fc.asyncProperty(
        fc.integer({ min: 10, max: 50 }),    // total units
        fc.float({ min: Math.fround(0.5), max: Math.fround(0.95), noNaN: true }),  // coverage rate (to trigger issues)
        fc.integer({ min: 1, max: 10 }),     // low quality count
        fc.integer({ min: 1, max: 10 }),     // missing count
        async (totalUnits, coverageRate, lowQualityCount, missingCount) => {
          // Clear mocks for each iteration
          jest.clearAllMocks();
          prisma.validationReport.create.mockResolvedValue({});
          
          const ckbCount = Math.floor(totalUnits * coverageRate);
          const actualMissingCount = Math.min(missingCount, totalUnits - ckbCount);
          const actualLowQualityCount = Math.min(lowQualityCount, ckbCount);
          
          const validationResult = {
            doc_id: 'test-doc',
            total_structural_units: totalUnits,
            ckb_count: ckbCount,
            skipped_count: 0,
            coverage_rate: coverageRate,
            is_complete: false,
            missing_units: Array(actualMissingCount).fill({
              unit_id: 'u1',
              content: 'Missing content',
              type: 'paragraph'
            }),
            low_quality_ckbs: Array(actualLowQualityCount).fill({
              id: 'ckb1',
              content: JSON.stringify({ text: 'Low quality' }),
              quality: JSON.stringify({ source_confidence: 0.3 })
            })
          };
          
          const structure = {
            units: [],
            hierarchy: { root: { unit_id: 'root', children: [] } }
          };
          
          const report = await validationReporter.generateReport(validationResult, structure);
          
          // Should identify root causes in recommendations
          expect(report.recommendations.length).toBeGreaterThan(0);
          
          // If coverage is low, should mention parsing or filtering
          if (coverageRate < 0.90) {
            const hasCoverageIssue = report.recommendations.some(r => 
              r.includes('覆盖率') && (r.includes('解析') || r.includes('过滤'))
            );
            expect(hasCoverageIssue).toBe(true);
          }
          
          // If there are low quality CKBs, should mention document quality or OCR/ASR
          if (actualLowQualityCount > ckbCount * 0.1) {
            const hasQualityIssue = report.recommendations.some(r => 
              r.includes('低质量') && (r.includes('文档质量') || r.includes('OCR') || r.includes('ASR'))
            );
            expect(hasQualityIssue).toBe(true);
          }
          
          // If there are missing units, should mention reprocessing
          if (actualMissingCount > 0) {
            const hasMissingIssue = report.recommendations.some(r => 
              r.includes('未处理') && r.includes('重新处理')
            );
            expect(hasMissingIssue).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Additional property: Report retrieval consistency
  test('Property: Report can be retrieved after persistence', async () => {
    fc.assert(
      await fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),  // doc ID
        fc.integer({ min: 10, max: 100 }),           // total units
        async (docId, totalUnits) => {
          // Mock create
          let savedReport = null;
          prisma.validationReport.create.mockImplementation(async ({ data }) => {
            savedReport = {
              reportId: data.reportId,
              docId: data.docId,
              createdAt: new Date(),
              summary: data.summary,
              structureTree: data.structureTree,
              skippedContent: data.skippedContent,
              lowQualityCkbs: data.lowQualityCkbs,
              missingUnits: data.missingUnits,
              recommendations: data.recommendations
            };
            return savedReport;
          });
          
          // Mock findUnique to return saved report
          prisma.validationReport.findUnique.mockImplementation(async ({ where }) => {
            if (savedReport && where.reportId === savedReport.reportId) {
              return savedReport;
            }
            return null;
          });
          
          const validationResult = {
            doc_id: docId,
            total_structural_units: totalUnits,
            ckb_count: totalUnits,
            skipped_count: 0,
            coverage_rate: 1.0,
            is_complete: true,
            missing_units: [],
            low_quality_ckbs: []
          };
          
          const structure = {
            units: [],
            hierarchy: { root: { unit_id: 'root', children: [] } }
          };
          
          // Generate and save report
          const generatedReport = await validationReporter.generateReport(validationResult, structure);
          
          // Retrieve report
          const retrievedReport = await validationReporter.getReport(generatedReport.report_id);
          
          // Should be able to retrieve the same report
          expect(retrievedReport.report_id).toBe(generatedReport.report_id);
          expect(retrievedReport.doc_id).toBe(docId);
          expect(retrievedReport.summary.total_structural_units).toBe(totalUnits);
        }
      ),
      { numRuns: 50 }  // Reduced runs due to complexity
    );
  });
});
