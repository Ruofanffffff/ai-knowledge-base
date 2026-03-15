/**
 * DocumentProcessingService 上传路径测试
 * 验证 Word / PDF 上传成功，以及存储降级信息透传。
 */

jest.mock('./s3Client', () => ({
  uploadFileWithRetry: jest.fn(),
  generateFileUrl: jest.fn(),
  validateFileSize: jest.fn(() => true),
  validateMimeType: jest.fn(() => true)
}));

jest.mock('./attachmentDAL', () => ({
  createAttachment: jest.fn(),
  upsertAttachmentAnalysis: jest.fn(),
  getAttachmentById: jest.fn()
}));

const { uploadFileWithRetry } = require('./s3Client');
const { createAttachment, upsertAttachmentAnalysis } = require('./attachmentDAL');
const { DocumentProcessingService } = require('./documentProcessingService');

describe('DocumentProcessingService 上传验证', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentProcessingService({ tempDir: '/tmp' });
  });

  it('应成功处理 PDF 上传', async () => {
    uploadFileWithRetry.mockResolvedValue({
      key: 'documents/u1/1/test.pdf',
      url: 'https://example.com/documents/u1/1/test.pdf',
      size: 128,
      mimeType: 'application/pdf',
      uploadedAt: new Date().toISOString()
    });
    createAttachment.mockResolvedValue({
      id: 'att-pdf-1',
      noteId: 'note-1',
      type: 'DOCUMENT',
      storageKey: 'documents/u1/1/test.pdf',
      url: 'https://example.com/documents/u1/1/test.pdf',
      size: 128,
      mimeType: 'application/pdf',
      createdAt: new Date().toISOString()
    });
    upsertAttachmentAnalysis.mockImplementation(async ({ metadata }) => ({
      id: 'analysis-pdf-1',
      textContent: 'pdf content',
      description: 'Processed pdf document with fallback parser',
      tags: ['pdf', 'document'],
      metadata,
      createdAt: new Date().toISOString()
    }));
    jest.spyOn(service, '_extractPdfText').mockResolvedValue('pdf content');

    const result = await service.uploadAndProcessDocument({
      fileData: Buffer.from('%PDF-test'),
      originalFilename: 'test.pdf',
      userId: 'user-1',
      noteId: 'note-1',
      mimeType: 'application/pdf'
    });

    expect(result.attachment.type).toBe('DOCUMENT');
    expect(result.attachment.mimeType).toBe('application/pdf');
    expect(result.analysis.metadata.fileType).toBe('pdf');
    expect(result.analysis.textContent).toContain('pdf');
  });

  it('应成功处理 DOCX 上传', async () => {
    uploadFileWithRetry.mockResolvedValue({
      key: 'documents/u1/2/test.docx',
      url: 'https://example.com/documents/u1/2/test.docx',
      size: 256,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      uploadedAt: new Date().toISOString()
    });
    createAttachment.mockResolvedValue({
      id: 'att-docx-1',
      noteId: 'note-1',
      type: 'DOCUMENT',
      storageKey: 'documents/u1/2/test.docx',
      url: 'https://example.com/documents/u1/2/test.docx',
      size: 256,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      createdAt: new Date().toISOString()
    });
    upsertAttachmentAnalysis.mockImplementation(async ({ metadata }) => ({
      id: 'analysis-docx-1',
      textContent: 'docx content',
      description: 'Processed word document with fallback parser',
      tags: ['word', 'document'],
      metadata,
      createdAt: new Date().toISOString()
    }));
    jest.spyOn(service, '_extractWordText').mockResolvedValue('docx content');

    const result = await service.uploadAndProcessDocument({
      fileData: Buffer.from('docx-binary'),
      originalFilename: 'test.docx',
      userId: 'user-1',
      noteId: 'note-1',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    expect(result.attachment.type).toBe('DOCUMENT');
    expect(result.analysis.metadata.fileType).toBe('word');
    expect(result.analysis.textContent).toContain('docx');
  });

  it('应透传存储降级信息', async () => {
    uploadFileWithRetry.mockResolvedValue({
      key: 'local-cache/fallback-1/test.pdf',
      url: 'local://notes-fallback/fallback-1/test.pdf',
      size: 128,
      mimeType: 'application/pdf',
      uploadedAt: new Date().toISOString(),
      degraded: true,
      degradationMode: 'LOCAL_CACHE',
      fallbackId: 'fallback-1'
    });
    createAttachment.mockResolvedValue({
      id: 'att-pdf-2',
      noteId: 'note-1',
      type: 'DOCUMENT',
      storageKey: 'local-cache/fallback-1/test.pdf',
      url: 'local://notes-fallback/fallback-1/test.pdf',
      size: 128,
      mimeType: 'application/pdf',
      createdAt: new Date().toISOString()
    });
    upsertAttachmentAnalysis.mockImplementation(async ({ metadata }) => ({
      id: 'analysis-pdf-2',
      textContent: 'pdf content',
      description: 'Processed pdf document with fallback parser',
      tags: ['pdf', 'document'],
      metadata,
      createdAt: new Date().toISOString()
    }));
    jest.spyOn(service, '_extractPdfText').mockResolvedValue('pdf content');

    const result = await service.uploadAndProcessDocument({
      fileData: Buffer.from('%PDF-test'),
      originalFilename: 'fallback.pdf',
      userId: 'user-1',
      noteId: 'note-1',
      mimeType: 'application/pdf'
    });

    expect(result.attachment.degraded).toBe(true);
    expect(result.attachment.degradationMode).toBe('LOCAL_CACHE');
    expect(result.attachment.fallbackId).toBe('fallback-1');
    expect(result.analysis.metadata.storageDegraded).toBe(true);
  });
});
