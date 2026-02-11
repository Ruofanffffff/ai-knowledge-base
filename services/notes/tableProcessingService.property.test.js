/**
 * Property-Based Tests for Table Processing Service
 * 
 * Feature: notes-feature, Property 7: 表格处理端到端
 * **Validates: Requirements 4.1, 4.2, 4.3**
 * 
 * Property: For any uploaded table file, the system should save to object storage,
 * use existing pipeline to parse, and store structured data to database.
 */

const fc = require('fast-check');

// Mock Prisma Client - must be defined before importing modules that use it
const mockPrisma = {
  note: {
    create: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn()
  },
  attachment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn()
  },
  attachmentAnalysis: {
    upsert: jest.fn()
  },
  $disconnect: jest.fn()
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  AttachmentType: {
    IMAGE: 'IMAGE',
    DOCUMENT: 'DOCUMENT',
    TABLE: 'TABLE'
  }
}));

// Mock dependencies
jest.mock('../../kg/ckb/ckb_parser', () => ({
  parseDocument: jest.fn()
}));

jest.mock('./s3Client', () => ({
  uploadFileWithRetry: jest.fn(),
  generateFileUrl: jest.fn(),
  validateFileSize: jest.fn(),
  validateMimeType: jest.fn()
}));

const { TableProcessingService } = require('./tableProcessingService');
const { parseDocument } = require('../../kg/ckb/ckb_parser');
const { uploadFileWithRetry, validateFileSize, validateMimeType } = require('./s3Client');

describe('Table Processing Service - Property Tests', () => {
  let service;
  let testNoteId;
  let testUserId;

  beforeAll(async () => {
    // Setup test IDs
    testUserId = 'test-user-' + Date.now();
    testNoteId = 'test-note-' + Date.now();
    
    // Mock note creation
    mockPrisma.note.create.mockResolvedValue({
      id: testNoteId,
      userId: testUserId,
      content: 'Test note for table processing',
      tags: ['test'],
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  beforeEach(() => {
    service = new TableProcessingService();
    jest.clearAllMocks();
    
    // Setup default mocks
    validateFileSize.mockReturnValue(true);
    validateMimeType.mockReturnValue(true);
  });

  afterAll(async () => {
    // No cleanup needed with mocked Prisma
  });

  /**
   * Property 7: Table Processing End-to-End
   * 
   * For any uploaded table file, the system should:
   * 1. Save file to object storage
   * 2. Use existing pipeline to parse
   * 3. Store structured data to database
   */
  describe('Property 7: Table Processing End-to-End', () => {
    it('should complete full table processing pipeline for any valid table', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate table data
          fc.record({
            filename: fc.oneof(
              fc.constant('data.xlsx'),
              fc.constant('spreadsheet.xls'),
              fc.constant('data.csv')
            ),
            mimeType: fc.oneof(
              fc.constant('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
              fc.constant('application/vnd.ms-excel'),
              fc.constant('text/csv')
            ),
            rows: fc.array(
              fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 5 }),
              { minLength: 2, maxLength: 10 }
            )
          }),
          async (tableData) => {
            // Create file buffer (simplified CSV format)
            const csvContent = tableData.rows
              .map(row => row.join(','))
              .join('\n');
            const fileData = Buffer.from(csvContent);
            
            // Mock S3 upload
            const mockUploadResult = {
              key: `tables/test/${Date.now()}/${tableData.filename}`,
              url: `https://s3.example.com/test/${tableData.filename}`,
              size: fileData.length,
              mimeType: tableData.mimeType,
              uploadedAt: new Date().toISOString()
            };
            uploadFileWithRetry.mockResolvedValue(mockUploadResult);
            
            // Mock table parsing - create CKBs from rows
            const mockCKBs = tableData.rows.map((row, index) => ({
              id: `ckb-${index}`,
              text: row.join('\t'),
              content: row.join('\t'),
              type: 'table-row',
              metadata: {
                sheet: 'Sheet1',
                row: index,
                cells: row
              }
            }));
            
            parseDocument.mockResolvedValue(mockCKBs);
            
            // Mock attachment creation
            const mockAttachment = {
              id: 'attachment-' + Date.now(),
              noteId: testNoteId,
              type: 'TABLE',
              storageKey: mockUploadResult.key,
              url: mockUploadResult.url,
              size: mockUploadResult.size,
              mimeType: tableData.mimeType,
              createdAt: new Date()
            };
            mockPrisma.attachment.create.mockResolvedValue(mockAttachment);
            
            // Mock analysis creation
            const mockAnalysis = {
              id: 'analysis-' + Date.now(),
              attachmentId: mockAttachment.id,
              textContent: 'table content',
              description: 'Test table',
              tags: ['table'],
              metadata: {
                fileType: 'excel',
                tableData: { sheets: [{ name: 'Sheet1', rows: mockCKBs.map(ckb => ({ rowIndex: ckb.metadata.row, cells: ckb.metadata.cells })) }] },
                rowCount: tableData.rows.length
              },
              createdAt: new Date()
            };
            mockPrisma.attachmentAnalysis.upsert.mockResolvedValue(mockAnalysis);
            
            // Mock attachment retrieval for verification
            mockPrisma.attachment.findUnique.mockResolvedValue({
              ...mockAttachment,
              analysis: mockAnalysis
            });
            
            // Execute upload and process
            const result = await service.uploadAndProcessTable({
              fileData,
              originalFilename: tableData.filename,
              userId: testUserId,
              noteId: testNoteId,
              mimeType: tableData.mimeType
            });
            
            // Verify Step 1: File saved to object storage
            expect(uploadFileWithRetry).toHaveBeenCalledWith(
              expect.objectContaining({
                fileData,
                originalFilename: tableData.filename,
                userId: testUserId,
                mimeType: tableData.mimeType,
                prefix: 'tables'
              })
            );
            
            // Verify Step 2: Attachment record created
            expect(result.attachment).toBeDefined();
            expect(result.attachment.type).toBe('TABLE');
            expect(result.attachment.url).toBe(mockUploadResult.url);
            expect(result.attachment.storageKey).toBe(mockUploadResult.key);
            
            // Verify Step 3: Table processed with existing pipeline
            expect(parseDocument).toHaveBeenCalled();
            
            // Verify Step 4: Structured data stored to database
            expect(result.analysis).toBeDefined();
            expect(result.analysis.metadata).toBeDefined();
            expect(result.analysis.metadata.tableData).toBeDefined();
            expect(result.analysis.metadata.rowCount).toBe(tableData.rows.length);
          }
        ),
        { numRuns: 20 } // Reduced runs for integration test
      );
    });

    it('should maintain table structure integrity through the pipeline', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.constant('test.xlsx'),
            sheetName: fc.string({ minLength: 1, maxLength: 20 }),
            rows: fc.array(
              fc.array(fc.string(), { minLength: 3, maxLength: 3 }),
              { minLength: 3, maxLength: 5 }
            )
          }),
          async (tableData) => {
            const fileData = Buffer.from('mock-excel-data');
            const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            
            // Mock responses
            uploadFileWithRetry.mockResolvedValue({
              key: `tables/test/${tableData.filename}`,
              url: `https://s3.example.com/${tableData.filename}`,
              size: fileData.length,
              mimeType,
              uploadedAt: new Date().toISOString()
            });
            
            // Create CKBs with structured row data
            const mockCKBs = tableData.rows.map((row, index) => ({
              id: `ckb-${index}`,
              text: row.join('\t'),
              content: row.join('\t'),
              type: 'table-row',
              metadata: {
                sheet: tableData.sheetName,
                row: index,
                cells: row
              }
            }));
            
            parseDocument.mockResolvedValue(mockCKBs);
            
            mockPrisma.attachment.create.mockResolvedValue({
              id: 'attachment-' + Date.now(),
              noteId: testNoteId,
              type: 'TABLE',
              storageKey: `tables/test/${tableData.filename}`,
              url: `https://s3.example.com/${tableData.filename}`,
              size: fileData.length,
              mimeType,
              createdAt: new Date()
            });
            
            const tableDataStructure = {
              sheets: [{
                name: tableData.sheetName,
                rows: tableData.rows.map((row, index) => ({
                  rowIndex: index,
                  cells: row
                }))
              }]
            };
            
            mockPrisma.attachmentAnalysis.upsert.mockResolvedValue({
              id: 'analysis-' + Date.now(),
              attachmentId: 'attachment-' + Date.now(),
              textContent: 'table content',
              description: 'Test table',
              tags: ['table'],
              metadata: {
                fileType: 'excel',
                tableData: tableDataStructure,
                rowCount: tableData.rows.length
              },
              createdAt: new Date()
            });
            
            const result = await service.uploadAndProcessTable({
              fileData,
              originalFilename: tableData.filename,
              userId: testUserId,
              noteId: testNoteId,
              mimeType
            });
            
            // Verify table structure is preserved
            const storedTableData = result.analysis.metadata.tableData;
            expect(storedTableData).toBeDefined();
            expect(storedTableData.sheets).toBeDefined();
            expect(storedTableData.sheets.length).toBeGreaterThan(0);
            
            // Verify row count matches
            const totalRows = storedTableData.sheets.reduce(
              (sum, sheet) => sum + sheet.rows.length,
              0
            );
            expect(totalRows).toBe(tableData.rows.length);
            
            // Verify column consistency
            const firstSheet = storedTableData.sheets[0];
            if (firstSheet.rows.length > 0) {
              const firstRowLength = firstSheet.rows[0].cells.length;
              firstSheet.rows.forEach(row => {
                expect(row.cells.length).toBe(firstRowLength);
              });
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle processing errors gracefully while preserving upload', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.constant('error-table.xlsx'),
            content: fc.string({ minLength: 10 })
          }),
          async (tableData) => {
            const fileData = Buffer.from(tableData.content);
            const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            
            // Mock successful upload
            uploadFileWithRetry.mockResolvedValue({
              key: `tables/test/${tableData.filename}`,
              url: `https://s3.example.com/${tableData.filename}`,
              size: fileData.length,
              mimeType,
              uploadedAt: new Date().toISOString()
            });
            
            // Mock processing failure
            parseDocument.mockRejectedValue(
              new Error('Parsing failed')
            );
            
            mockPrisma.attachment.create.mockResolvedValue({
              id: 'attachment-' + Date.now(),
              noteId: testNoteId,
              type: 'TABLE',
              storageKey: `tables/test/${tableData.filename}`,
              url: `https://s3.example.com/${tableData.filename}`,
              size: fileData.length,
              mimeType,
              createdAt: new Date()
            });
            
            mockPrisma.attachmentAnalysis.upsert.mockResolvedValue({
              id: 'analysis-' + Date.now(),
              attachmentId: 'attachment-' + Date.now(),
              textContent: null,
              description: null,
              tags: [],
              metadata: {
                error: 'Parsing failed'
              },
              createdAt: new Date()
            });
            
            const result = await service.uploadAndProcessTable({
              fileData,
              originalFilename: tableData.filename,
              userId: testUserId,
              noteId: testNoteId,
              mimeType
            });
            
            // Verify attachment was still created despite processing error
            expect(result.attachment).toBeDefined();
            expect(result.attachment.type).toBe('TABLE');
            
            // Verify analysis contains error information
            expect(result.analysis).toBeDefined();
            expect(result.analysis.metadata.error).toBeDefined();
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Table Type Detection', () => {
    it('should correctly determine file type for any valid table file', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.record({
              filename: fc.constant('test.xlsx'),
              mimeType: fc.constant('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
              expectedType: fc.constant('excel')
            }),
            fc.record({
              filename: fc.constant('test.xls'),
              mimeType: fc.constant('application/vnd.ms-excel'),
              expectedType: fc.constant('excel')
            }),
            fc.record({
              filename: fc.constant('test.csv'),
              mimeType: fc.constant('text/csv'),
              expectedType: fc.constant('csv')
            })
          ),
          async (testCase) => {
            const detectedType = service._determineFileType(
              testCase.filename,
              testCase.mimeType
            );
            
            expect(detectedType).toBe(testCase.expectedType);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Table Data Extraction', () => {
    it('should extract structured table data from CKBs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.string(),
              text: fc.string({ minLength: 1 }),
              metadata: fc.record({
                sheet: fc.string({ minLength: 1, maxLength: 20 }),
                row: fc.nat(100),
                cells: fc.array(fc.string(), { minLength: 1, maxLength: 5 })
              })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (ckbs) => {
            const tableData = service._extractTableData(ckbs);
            
            // Verify table data structure
            expect(tableData).toBeDefined();
            expect(tableData.sheets).toBeDefined();
            expect(Array.isArray(tableData.sheets)).toBe(true);
            
            // Verify all sheets have valid structure
            tableData.sheets.forEach(sheet => {
              expect(sheet.name).toBeDefined();
              expect(Array.isArray(sheet.rows)).toBe(true);
              
              // Verify all rows have cells
              sheet.rows.forEach(row => {
                expect(row.cells).toBeDefined();
                expect(Array.isArray(row.cells)).toBe(true);
              });
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate correct table statistics', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sheets: fc.array(
              fc.record({
                name: fc.string({ minLength: 1 }),
                rows: fc.array(
                  fc.record({
                    rowIndex: fc.nat(),
                    cells: fc.array(fc.string(), { minLength: 1, maxLength: 10 })
                  }),
                  { minLength: 1, maxLength: 20 }
                )
              }),
              { minLength: 1, maxLength: 3 }
            )
          }),
          async (tableData) => {
            const stats = service._calculateTableStats(tableData);
            
            // Verify sheet count
            expect(stats.sheetCount).toBe(tableData.sheets.length);
            
            // Verify total rows
            const expectedTotalRows = tableData.sheets.reduce(
              (sum, sheet) => sum + sheet.rows.length,
              0
            );
            expect(stats.totalRows).toBe(expectedTotalRows);
            
            // Verify max columns
            let expectedMaxColumns = 0;
            tableData.sheets.forEach(sheet => {
              sheet.rows.forEach(row => {
                if (row.cells.length > expectedMaxColumns) {
                  expectedMaxColumns = row.cells.length;
                }
              });
            });
            expect(stats.maxColumns).toBe(expectedMaxColumns);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Text Content Extraction from Tables', () => {
    it('should extract and combine text from all table CKBs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.string(),
              text: fc.string({ minLength: 1, maxLength: 50 }),
              content: fc.string({ minLength: 1, maxLength: 50 }),
              metadata: fc.constant({})
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (ckbs) => {
            const textContent = service._extractTextContent(ckbs);
            
            // Verify all non-empty texts are included
            const nonEmptyTexts = ckbs
              .map(ckb => ckb.text || ckb.content)
              .filter(text => text && text.trim().length > 0);
            
            if (nonEmptyTexts.length > 0) {
              expect(textContent).toBeTruthy();
              nonEmptyTexts.forEach(text => {
                expect(textContent).toContain(text);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
