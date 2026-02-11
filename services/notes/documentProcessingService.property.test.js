/**
 * Property-Based Tests for Document Processing Service
 * 
 * Feature: notes-feature, Property 6: 文档处理端到端
 * **Validates: Requirements 3.1, 3.2, 3.3**
 * 
 * Property: For any uploaded document, the system should save to object storage,
 * use existing pipeline to parse, and store structured content to database.
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
jest.mock('../../kg/document_processor', () => ({
  processDocumentWithFullProcessing: jest.fn()
}));

jest.mock('./s3Client', () => ({
  uploadFileWithRetry: jest.fn(),
  generateFileUrl: jest.fn(),
  validateFileSize: jest.fn(),
  validateMimeType: jest.fn()
}));

const { DocumentProcessingService } = require('./documentProcessingService');
const { processDocumentWithFullProcessing } = require('../../kg/document_processor');
const { uploadFileWithRetry, validateFileSize, validateMimeType } = require('./s3Client');

describe('Document Processing Service - Property Tests', () => {
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
      content: 'Test note for document processing',
      tags: ['test'],
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  beforeEach(() => {
    service = new DocumentProcessingService();
    jest.clearAllMocks();
    
    // Setup default mocks
    validateFileSize.mockReturnValue(true);
    validateMimeType.mockReturnValue(true);
  });

  afterAll(async () => {
    // No cleanup needed with mocked Prisma
  });

  /**
   * Property 6: Document Processing End-to-End
   * 
   * For any uploaded document, the system should:
   * 1. Save file to object storage
   * 2. Use existing pipeline to parse
   * 3. Store structured content to database
   */
  describe('Property 6: Document Processing End-to-End', () => {
    it('should complete full document processing pipeline for any valid document', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate document data
          fc.record({
            filename: fc.oneof(
              fc.constant('document.docx'),
              fc.constant('report.pdf'),
              fc.constant('notes.md')
            ),
            mimeType: fc.oneof(
              fc.constant('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
              fc.constant('application/pdf'),
              fc.constant('text/markdown')
            ),
            content: fc.string({ minLength: 10, maxLength: 1000 })
          }),
          async (docData) => {
            // Create file buffer
            const fileData = Buffer.from(docData.content);
            
            // Mock S3 upload
            const mockUploadResult = {
              key: `documents/test/${Date.now()}/${docData.filename}`,
              url: `https://s3.example.com/test/${docData.filename}`,
              size: fileData.length,
              mimeType: docData.mimeType,
              uploadedAt: new Date().toISOString()
            };
            uploadFileWithRetry.mockResolvedValue(mockUploadResult);
            
            // Mock document processing
            const mockCKBs = [
              {
                id: 'ckb-1',
                text: docData.content.substring(0, 100),
                type: 'paragraph',
                metadata: { tags: ['test'] }
              },
              {
                id: 'ckb-2',
                text: docData.content.substring(100),
                type: 'paragraph',
                metadata: {}
              }
            ];
            
            processDocumentWithFullProcessing.mockResolvedValue({
              doc_id: 'test-doc',
              ckbs: mockCKBs,
              validation_result: {
                coverage_rate: 0.95,
                is_complete: true,
                missing_units: []
              },
              report: {
                summary: {
                  quality_score: 85,
                  recommendations: []
                }
              }
            });
            
            // Mock attachment creation
            const mockAttachment = {
              id: 'attachment-' + Date.now(),
              noteId: testNoteId,
              type: 'DOCUMENT',
              storageKey: mockUploadResult.key,
              url: mockUploadResult.url,
              size: mockUploadResult.size,
              mimeType: docData.mimeType,
              createdAt: new Date()
            };
            mockPrisma.attachment.create.mockResolvedValue(mockAttachment);
            
            // Mock analysis creation
            const mockAnalysis = {
              id: 'analysis-' + Date.now(),
              attachmentId: mockAttachment.id,
              textContent: docData.content,
              description: 'Test description',
              tags: ['test'],
              metadata: {
                fileType: 'word',
                structuredData: {},
                ckbCount: 2
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
            const result = await service.uploadAndProcessDocument({
              fileData,
              originalFilename: docData.filename,
              userId: testUserId,
              noteId: testNoteId,
              mimeType: docData.mimeType
            });
            
            // Verify Step 1: File saved to object storage
            expect(uploadFileWithRetry).toHaveBeenCalledWith(
              expect.objectContaining({
                fileData,
                originalFilename: docData.filename,
                userId: testUserId,
                mimeType: docData.mimeType,
                prefix: 'documents'
              })
            );
            
            // Verify Step 2: Attachment record created
            expect(result.attachment).toBeDefined();
            expect(result.attachment.type).toBe('DOCUMENT');
            expect(result.attachment.url).toBe(mockUploadResult.url);
            expect(result.attachment.storageKey).toBe(mockUploadResult.key);
            
            // Verify Step 3: Document processed with existing pipeline
            expect(processDocumentWithFullProcessing).toHaveBeenCalled();
            
            // Verify Step 4: Structured content stored to database
            expect(result.analysis).toBeDefined();
            expect(result.analysis.textContent).toBeTruthy();
            expect(result.analysis.metadata).toBeDefined();
            expect(result.analysis.metadata.structuredData).toBeDefined();
            expect(result.analysis.metadata.ckbCount).toBe(2);
          }
        ),
        { numRuns: 20 } // Reduced runs for integration test
      );
    });

    it('should maintain data integrity through the entire pipeline', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.constantFrom('test.docx', 'test.pdf', 'test.md'),
            content: fc.string({ minLength: 50, maxLength: 500 })
          }),
          async (docData) => {
            const fileData = Buffer.from(docData.content);
            const mimeType = docData.filename.endsWith('.pdf') 
              ? 'application/pdf' 
              : docData.filename.endsWith('.md')
              ? 'text/markdown'
              : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            
            // Mock responses
            uploadFileWithRetry.mockResolvedValue({
              key: `documents/test/${docData.filename}`,
              url: `https://s3.example.com/${docData.filename}`,
              size: fileData.length,
              mimeType,
              uploadedAt: new Date().toISOString()
            });
            
            processDocumentWithFullProcessing.mockResolvedValue({
              doc_id: 'test-doc',
              ckbs: [{
                id: 'ckb-1',
                text: docData.content,
                type: 'paragraph',
                metadata: {}
              }],
              validation_result: {
                coverage_rate: 1.0,
                is_complete: true
              },
              report: {
                summary: {
                  quality_score: 90
                }
              }
            });
            
            mockPrisma.attachment.create.mockResolvedValue({
              id: 'attachment-' + Date.now(),
              noteId: testNoteId,
              type: 'DOCUMENT',
              storageKey: `documents/test/${docData.filename}`,
              url: `https://s3.example.com/${docData.filename}`,
              size: fileData.length,
              mimeType,
              createdAt: new Date()
            });
            
            mockPrisma.attachmentAnalysis.upsert.mockResolvedValue({
              id: 'analysis-' + Date.now(),
              attachmentId: 'attachment-' + Date.now(),
              textContent: docData.content,
              description: 'Test',
              tags: [],
              metadata: {
                fileType: 'word',
                ckbCount: 1,
                processedAt: new Date().toISOString()
              },
              createdAt: new Date()
            });
            
            const result = await service.uploadAndProcessDocument({
              fileData,
              originalFilename: docData.filename,
              userId: testUserId,
              noteId: testNoteId,
              mimeType
            });
            
            // Verify data integrity: content should be preserved
            expect(result.analysis.textContent).toContain(docData.content);
            
            // Verify metadata contains processing information
            expect(result.analysis.metadata.fileType).toBeDefined();
            expect(result.analysis.metadata.ckbCount).toBeGreaterThan(0);
            expect(result.analysis.metadata.processedAt).toBeDefined();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle processing errors gracefully while preserving upload', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.constant('error-doc.docx'),
            content: fc.string({ minLength: 10 })
          }),
          async (docData) => {
            const fileData = Buffer.from(docData.content);
            const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            
            // Mock successful upload
            uploadFileWithRetry.mockResolvedValue({
              key: `documents/test/${docData.filename}`,
              url: `https://s3.example.com/${docData.filename}`,
              size: fileData.length,
              mimeType,
              uploadedAt: new Date().toISOString()
            });
            
            // Mock processing failure
            processDocumentWithFullProcessing.mockRejectedValue(
              new Error('Processing failed')
            );
            
            mockPrisma.attachment.create.mockResolvedValue({
              id: 'attachment-' + Date.now(),
              noteId: testNoteId,
              type: 'DOCUMENT',
              storageKey: `documents/test/${docData.filename}`,
              url: `https://s3.example.com/${docData.filename}`,
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
                error: 'Processing failed'
              },
              createdAt: new Date()
            });
            
            const result = await service.uploadAndProcessDocument({
              fileData,
              originalFilename: docData.filename,
              userId: testUserId,
              noteId: testNoteId,
              mimeType
            });
            
            // Verify attachment was still created despite processing error
            expect(result.attachment).toBeDefined();
            expect(result.attachment.type).toBe('DOCUMENT');
            
            // Verify analysis contains error information
            expect(result.analysis).toBeDefined();
            expect(result.analysis.metadata.error).toBeDefined();
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Document Type Detection', () => {
    it('should correctly determine file type for any valid document', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.record({
              filename: fc.constant('test.docx'),
              mimeType: fc.constant('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
              expectedType: fc.constant('word')
            }),
            fc.record({
              filename: fc.constant('test.pdf'),
              mimeType: fc.constant('application/pdf'),
              expectedType: fc.constant('pdf')
            }),
            fc.record({
              filename: fc.constant('test.md'),
              mimeType: fc.constant('text/markdown'),
              expectedType: fc.constant('markdown')
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

  describe('Text Content Extraction', () => {
    it('should extract and combine text from all CKBs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.string(),
              text: fc.string({ minLength: 1, maxLength: 100 }),
              type: fc.constantFrom('paragraph', 'heading', 'list'),
              metadata: fc.constant({})
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (ckbs) => {
            const textContent = service._extractTextContent(ckbs);
            
            // Verify all non-empty texts are included
            const nonEmptyTexts = ckbs
              .map(ckb => ckb.text)
              .filter(text => text.trim().length > 0);
            
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
