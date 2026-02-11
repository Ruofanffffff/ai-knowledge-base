/**
 * Unit Tests for Validation Reporter
 * 
 * Tests report generation, quality scoring, persistence, and export
 */

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

describe('Validation Reporter - Unit Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('calculateQualityScore', () => {
    test('should return 100 for perfect processing', () => {
      const validationResult = {
        coverage_rate: 1.0,
        ckb_count: 100,
        low_quality_ckbs: [],
        total_structural_units: 100,
        missing_units: []
      };
      
      const score = validationReporter.calculateQualityScore(validationResult);
      expect(score).toBe(100);
    });
    
    test('should deduct points for low coverage', () => {
      const validationResult = {
        coverage_rate: 0.85,  // 10% below threshold
        ckb_count: 85,
        low_quality_ckbs: [],
        total_structural_units: 100,
        missing_units: []
      };
      
      const score = validationReporter.calculateQualityScore(validationResult);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThan(80);  // Should deduct ~10 points
    });
    
    test('should deduct points for low quality CKBs', () => {
      const validationResult = {
        coverage_rate: 1.0,
        ckb_count: 100,
        low_quality_ckbs: Array(20).fill({}),  // 20% low quality
        total_structural_units: 100,
        missing_units: []
      };
      
      const score = validationReporter.calculateQualityScore(validationResult);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThanOrEqual(96);  // Should deduct ~4 points (20% * 20)
    });
    
    test('should deduct points for missing units', () => {
      const validationResult = {
        coverage_rate: 0.90,
        ckb_count: 90,
        low_quality_ckbs: [],
        total_structural_units: 100,
        missing_units: Array(10).fill({})  // 10% missing
      };
      
      const score = validationReporter.calculateQualityScore(validationResult);
      expect(score).toBeLessThan(100);
      // Should deduct 5 points for coverage + 3 points for missing = ~92
      expect(score).toBeGreaterThan(85);
      expect(score).toBeLessThan(95);
    });
    
    test('should not return negative scores', () => {
      const validationResult = {
        coverage_rate: 0.50,
        ckb_count: 50,
        low_quality_ckbs: Array(25).fill({}),
        total_structural_units: 100,
        missing_units: Array(50).fill({})
      };
      
      const score = validationReporter.calculateQualityScore(validationResult);
      expect(score).toBeGreaterThanOrEqual(0);
    });
    
    test('should not return scores above 100', () => {
      const validationResult = {
        coverage_rate: 1.0,
        ckb_count: 100,
        low_quality_ckbs: [],
        total_structural_units: 100,
        missing_units: []
      };
      
      const score = validationReporter.calculateQualityScore(validationResult);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
  
  describe('generateReport', () => {
    test('should generate complete report', async () => {
      prisma.validationReport.create.mockResolvedValue({});
      
      const validationResult = {
        doc_id: 'doc1',
        total_structural_units: 10,
        ckb_count: 8,
        skipped_count: 2,
        coverage_rate: 1.0,
        is_complete: true,
        missing_units: [],
        low_quality_ckbs: []
      };
      
      const structure = {
        units: [
          { unit_id: 'u1', content: 'Content 1', should_filter: false },
          { unit_id: 'u2', content: 'Short', should_filter: true, filter_reason: '内容过短', matched_rule: 'filter_short' }
        ],
        hierarchy: {
          root: {
            unit_id: 'root',
            children: []
          }
        }
      };
      
      const report = await validationReporter.generateReport(validationResult, structure);
      
      expect(report).toHaveProperty('report_id');
      expect(report).toHaveProperty('doc_id', 'doc1');
      expect(report).toHaveProperty('created_at');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('structure_tree');
      expect(report).toHaveProperty('skipped_content');
      expect(report).toHaveProperty('low_quality_ckbs');
      expect(report).toHaveProperty('missing_units');
      expect(report).toHaveProperty('recommendations');
      
      expect(report.summary.total_structural_units).toBe(10);
      expect(report.summary.ckb_count).toBe(8);
      expect(report.summary.coverage_rate).toBe(1.0);
      expect(report.summary.quality_score).toBe(100);
    });
    
    test('should organize skipped content', async () => {
      prisma.validationReport.create.mockResolvedValue({});
      
      const validationResult = {
        doc_id: 'doc2',
        total_structural_units: 5,
        ckb_count: 3,
        skipped_count: 2,
        coverage_rate: 1.0,
        is_complete: true,
        missing_units: [],
        low_quality_ckbs: []
      };
      
      const structure = {
        units: [
          { unit_id: 'u1', content: 'Normal content', should_filter: false },
          { unit_id: 'u2', content: '...', should_filter: true, filter_reason: '仅包含标点符号', matched_rule: 'filter_punctuation' },
          { unit_id: 'u3', content: 'Short', should_filter: true, filter_reason: '内容过短', matched_rule: 'filter_short' }
        ],
        hierarchy: { root: { unit_id: 'root', children: [] } }
      };
      
      const report = await validationReporter.generateReport(validationResult, structure);
      
      expect(report.skipped_content).toHaveLength(2);
      expect(report.skipped_content[0]).toHaveProperty('unit_id');
      expect(report.skipped_content[0]).toHaveProperty('content');
      expect(report.skipped_content[0]).toHaveProperty('filter_reason');
      expect(report.skipped_content[0]).toHaveProperty('matched_rule');
    });
    
    test('should organize low quality CKBs', async () => {
      prisma.validationReport.create.mockResolvedValue({});
      
      const validationResult = {
        doc_id: 'doc3',
        total_structural_units: 5,
        ckb_count: 5,
        skipped_count: 0,
        coverage_rate: 1.0,
        is_complete: true,
        missing_units: [],
        low_quality_ckbs: [
          {
            id: 'ckb1',
            content: JSON.stringify({ text: 'Low quality content' }),
            quality: JSON.stringify({ source_confidence: 0.3 })
          }
        ]
      };
      
      const structure = {
        units: [],
        hierarchy: { root: { unit_id: 'root', children: [] } }
      };
      
      const report = await validationReporter.generateReport(validationResult, structure);
      
      expect(report.low_quality_ckbs).toHaveLength(1);
      expect(report.low_quality_ckbs[0]).toHaveProperty('ckb_id', 'ckb1');
      expect(report.low_quality_ckbs[0]).toHaveProperty('source_confidence', 0.3);
      expect(report.low_quality_ckbs[0]).toHaveProperty('issues');
      expect(report.low_quality_ckbs[0].issues).toContain('源置信度过低');
    });
    
    test('should generate recommendations', async () => {
      prisma.validationReport.create.mockResolvedValue({});
      
      const validationResult = {
        doc_id: 'doc4',
        total_structural_units: 100,
        ckb_count: 80,
        skipped_count: 0,
        coverage_rate: 0.80,
        is_complete: false,
        missing_units: Array(20).fill({ unit_id: 'u1', content: 'Missing' }),
        low_quality_ckbs: []
      };
      
      const structure = {
        units: [],
        hierarchy: { root: { unit_id: 'root', children: [] } }
      };
      
      const report = await validationReporter.generateReport(validationResult, structure);
      
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some(r => r.includes('覆盖率'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('未处理'))).toBe(true);
    });
    
    test('should save report to database', async () => {
      prisma.validationReport.create.mockResolvedValue({});
      
      const validationResult = {
        doc_id: 'doc5',
        total_structural_units: 10,
        ckb_count: 10,
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
      
      await validationReporter.generateReport(validationResult, structure);
      
      expect(prisma.validationReport.create).toHaveBeenCalledTimes(1);
      expect(prisma.validationReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reportId: expect.any(String),
            docId: 'doc5',
            summary: expect.any(String),
            structureTree: expect.any(String),
            skippedContent: expect.any(String),
            lowQualityCkbs: expect.any(String),
            missingUnits: expect.any(String),
            recommendations: expect.any(String)
          })
        })
      );
    });
  });
  
  describe('getReport', () => {
    test('should retrieve report by ID', async () => {
      const mockReport = {
        reportId: 'report1',
        docId: 'doc1',
        createdAt: new Date(),
        summary: JSON.stringify({ quality_score: 95 }),
        structureTree: JSON.stringify({ root: {} }),
        skippedContent: JSON.stringify([]),
        lowQualityCkbs: JSON.stringify([]),
        missingUnits: JSON.stringify([]),
        recommendations: JSON.stringify(['Good quality'])
      };
      
      prisma.validationReport.findUnique.mockResolvedValue(mockReport);
      
      const report = await validationReporter.getReport('report1');
      
      expect(report.report_id).toBe('report1');
      expect(report.doc_id).toBe('doc1');
      expect(report.summary.quality_score).toBe(95);
    });
    
    test('should throw error if report not found', async () => {
      prisma.validationReport.findUnique.mockResolvedValue(null);
      
      await expect(validationReporter.getReport('nonexistent'))
        .rejects.toThrow('Report nonexistent not found');
    });
  });
  
  describe('getReportByDocId', () => {
    test('should retrieve most recent report for document', async () => {
      const mockReport = {
        reportId: 'report2',
        docId: 'doc2',
        createdAt: new Date(),
        summary: JSON.stringify({ quality_score: 90 }),
        structureTree: JSON.stringify({ root: {} }),
        skippedContent: JSON.stringify([]),
        lowQualityCkbs: JSON.stringify([]),
        missingUnits: JSON.stringify([]),
        recommendations: JSON.stringify([])
      };
      
      prisma.validationReport.findFirst.mockResolvedValue(mockReport);
      
      const report = await validationReporter.getReportByDocId('doc2');
      
      expect(report.doc_id).toBe('doc2');
      expect(prisma.validationReport.findFirst).toHaveBeenCalledWith({
        where: { docId: 'doc2' },
        orderBy: { createdAt: 'desc' }
      });
    });
    
    test('should throw error if no report found for document', async () => {
      prisma.validationReport.findFirst.mockResolvedValue(null);
      
      await expect(validationReporter.getReportByDocId('nonexistent'))
        .rejects.toThrow('No report found for document nonexistent');
    });
  });
  
  describe('exportReportJSON', () => {
    test('should export report as JSON', async () => {
      const mockReport = {
        reportId: 'report3',
        docId: 'doc3',
        createdAt: new Date(),
        summary: JSON.stringify({ quality_score: 85 }),
        structureTree: JSON.stringify({ root: {} }),
        skippedContent: JSON.stringify([]),
        lowQualityCkbs: JSON.stringify([]),
        missingUnits: JSON.stringify([]),
        recommendations: JSON.stringify([])
      };
      
      prisma.validationReport.findUnique.mockResolvedValue(mockReport);
      
      const json = await validationReporter.exportReportJSON('report3');
      
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.report_id).toBe('report3');
      expect(parsed.doc_id).toBe('doc3');
    });
  });
  
  describe('exportReportCSV', () => {
    test('should export report as CSV', async () => {
      const mockReport = {
        reportId: 'report4',
        docId: 'doc4',
        createdAt: new Date(),
        summary: JSON.stringify({
          total_structural_units: 100,
          ckb_count: 95,
          skipped_count: 5,
          coverage_rate: 1.0,
          quality_score: 98,
          is_complete: true
        }),
        structureTree: JSON.stringify({ root: {} }),
        skippedContent: JSON.stringify([]),
        lowQualityCkbs: JSON.stringify([]),
        missingUnits: JSON.stringify([
          { unit_id: 'u1', type: 'paragraph', content: 'Missing content' }
        ]),
        recommendations: JSON.stringify([])
      };
      
      prisma.validationReport.findUnique.mockResolvedValue(mockReport);
      
      const csv = await validationReporter.exportReportCSV('report4');
      
      expect(typeof csv).toBe('string');
      expect(csv).toContain('Metric,Value');
      expect(csv).toContain('Document ID,doc4');
      expect(csv).toContain('Total Units,100');
      expect(csv).toContain('Coverage Rate,100.00%');
      expect(csv).toContain('Missing Units');
    });
  });
});
