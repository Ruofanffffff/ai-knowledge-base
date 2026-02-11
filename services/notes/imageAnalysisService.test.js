/**
 * Unit Tests for Image Analysis Service
 * 
 * Tests image upload, LLM analysis, and result storage functionality.
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

const { ImageAnalysisService, createImageAnalysisService } = require('./imageAnalysisService');
const { createMultimodalLLMClient } = require('./llmClient');
const { uploadFileWithRetry, validateFileSize, validateMimeType } = require('./s3Client');
const { createAttachment, upsertAttachmentAnalysis, getAttachmentById } = require('./attachmentDAL');

// Mock dependencies
jest.mock('./llmClient');
jest.mock('./s3Client');
jest.mock('./attachmentDAL');

describe('ImageAnalysisService', () => {
  let service;
  let mockLLMClient;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock LLM client
    mockLLMClient = {
      analyzeImage: jest.fn(),
      getStats: jest.fn(() => ({ totalCalls: 0, successfulCalls: 0 })),
      resetStats: jest.fn()
    };

    createMultimodalLLMClient.mockReturnValue(mockLLMClient);

    // Create service instance
    service = new ImageAnalysisService();
  });

  describe('uploadAndAnalyzeImage', () => {
    const validOptions = {
      fileData: Buffer.from('fake image data'),
      originalFilename: 'test.jpg',
      userId: 'user-123',
      noteId: 'note-456',
      mimeType: 'image/jpeg'
    };

    beforeEach(() => {
      // Mock S3 upload
      uploadFileWithRetry.mockResolvedValue({
        key: 'images/abc123/1234567890/uuid.jpg',
        url: 'https://s3.example.com/bucket/images/abc123/1234567890/uuid.jpg',
        size: 1024,
        mimeType: 'image/jpeg'
      });

      // Mock attachment creation
      createAttachment.mockResolvedValue({
        id: 'attachment-789',
        noteId: 'note-456',
        type: 'IMAGE',
        storageKey: 'images/abc123/1234567890/uuid.jpg',
        url: 'https://s3.example.com/bucket/images/abc123/1234567890/uuid.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        createdAt: new Date()
      });

      // Mock LLM analysis
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: 'Extracted text from image',
          description: 'A beautiful landscape photo',
          type: 'landscape',
          tags: ['nature', 'landscape', 'outdoor'],
          elements: ['mountains', 'sky', 'trees']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 500
      });

      // Mock analysis storage
      upsertAttachmentAnalysis.mockResolvedValue({
        id: 'analysis-999',
        attachmentId: 'attachment-789',
        textContent: 'Extracted text from image',
        description: 'A beautiful landscape photo',
        tags: ['nature', 'landscape', 'outdoor'],
        metadata: {},
        createdAt: new Date()
      });

      // Mock validation functions
      validateFileSize.mockReturnValue(true);
      validateMimeType.mockReturnValue(true);
    });

    it('should upload and analyze image successfully', async () => {
      const result = await service.uploadAndAnalyzeImage(validOptions);

      // Verify S3 upload was called
      expect(uploadFileWithRetry).toHaveBeenCalledWith({
        fileData: validOptions.fileData,
        originalFilename: validOptions.originalFilename,
        userId: validOptions.userId,
        mimeType: validOptions.mimeType,
        metadata: {
          noteId: validOptions.noteId,
          type: 'IMAGE'
        },
        prefix: 'images'
      });

      // Verify attachment was created
      expect(createAttachment).toHaveBeenCalledWith({
        noteId: validOptions.noteId,
        type: 'IMAGE',
        storageKey: 'images/abc123/1234567890/uuid.jpg',
        url: 'https://s3.example.com/bucket/images/abc123/1234567890/uuid.jpg',
        size: 1024,
        mimeType: 'image/jpeg'
      });

      // Verify LLM analysis was called
      expect(mockLLMClient.analyzeImage).toHaveBeenCalled();

      // Verify analysis was stored
      expect(upsertAttachmentAnalysis).toHaveBeenCalled();

      // Verify result structure
      expect(result).toHaveProperty('attachment');
      expect(result).toHaveProperty('analysis');
      expect(result.attachment.id).toBe('attachment-789');
      expect(result.analysis.textContent).toBe('Extracted text from image');
    });

    it('should validate required parameters', async () => {
      await expect(service.uploadAndAnalyzeImage({}))
        .rejects.toThrow('fileData, originalFilename, userId, noteId, and mimeType are required');
    });

    it('should validate file size', async () => {
      validateFileSize.mockImplementation(() => {
        throw new Error('File size exceeds maximum');
      });

      await expect(service.uploadAndAnalyzeImage(validOptions))
        .rejects.toThrow('File size exceeds maximum');
    });

    it('should validate MIME type', async () => {
      validateMimeType.mockImplementation(() => {
        throw new Error('MIME type not allowed');
      });

      await expect(service.uploadAndAnalyzeImage(validOptions))
        .rejects.toThrow('MIME type not allowed');
    });

    it('should handle LLM analysis failure gracefully', async () => {
      mockLLMClient.analyzeImage.mockRejectedValue(new Error('LLM service unavailable'));

      const result = await service.uploadAndAnalyzeImage(validOptions);

      // Should still return attachment even if analysis fails
      expect(result).toHaveProperty('attachment');
      expect(result).toHaveProperty('analysis');
      
      // Analysis should have error metadata
      expect(upsertAttachmentAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            error: 'LLM service unavailable'
          })
        })
      );
    });

    it('should support different analysis types', async () => {
      await service.uploadAndAnalyzeImage({
        ...validOptions,
        analysisType: 'text'
      });

      expect(mockLLMClient.analyzeImage).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrl: expect.any(String)
        })
      );
    });

    it('should handle upload failure', async () => {
      uploadFileWithRetry.mockRejectedValue(new Error('Upload failed'));

      await expect(service.uploadAndAnalyzeImage(validOptions))
        .rejects.toThrow('Failed to upload and analyze image');
    });
  });

  describe('analyzeImage', () => {
    beforeEach(() => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: 'Sample text',
          description: 'Sample description',
          type: 'document',
          tags: ['document', 'text'],
          elements: ['text', 'layout']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 300
      });
    });

    it('should analyze image with full analysis', async () => {
      const result = await service.analyzeImage({
        imageUrl: 'https://example.com/image.jpg',
        analysisType: 'full'
      });

      expect(mockLLMClient.analyzeImage).toHaveBeenCalled();
      expect(result).toHaveProperty('textContent', 'Sample text');
      expect(result).toHaveProperty('description', 'Sample description');
      expect(result).toHaveProperty('tags');
      expect(result.tags).toContain('document');
    });

    it('should analyze image with text-only analysis', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: 'Plain text extracted from image',
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 200
      });

      const result = await service.analyzeImage({
        imageUrl: 'https://example.com/image.jpg',
        analysisType: 'text'
      });

      expect(result.textContent).toBe('Plain text extracted from image');
      expect(result.description).toBeNull();
    });

    it('should analyze image with content-only analysis', async () => {
      const result = await service.analyzeImage({
        imageUrl: 'https://example.com/image.jpg',
        analysisType: 'content'
      });

      expect(mockLLMClient.analyzeImage).toHaveBeenCalled();
      expect(result).toHaveProperty('description');
    });

    it('should require imageUrl parameter', async () => {
      await expect(service.analyzeImage({}))
        .rejects.toThrow('imageUrl is required');
    });

    it('should handle JSON parsing errors gracefully', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: 'Invalid JSON response',
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 100
      });

      const result = await service.analyzeImage({
        imageUrl: 'https://example.com/image.jpg',
        analysisType: 'full'
      });

      // Should fallback to using content as description
      expect(result.description).toBe('Invalid JSON response');
      expect(result).toHaveProperty('parseError');
    });

    it('should extract JSON from markdown code blocks', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: '```json\n{"textContent": "Test", "description": "Test desc", "tags": []}\n```',
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 150
      });

      const result = await service.analyzeImage({
        imageUrl: 'https://example.com/image.jpg',
        analysisType: 'full'
      });

      expect(result.textContent).toBe('Test');
      expect(result.description).toBe('Test desc');
    });
  });

  describe('reanalyzeAttachment', () => {
    beforeEach(() => {
      getAttachmentById.mockResolvedValue({
        id: 'attachment-123',
        noteId: 'note-456',
        type: 'IMAGE',
        storageKey: 'images/test.jpg',
        url: 'https://example.com/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg'
      });

      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: 'Re-analyzed text',
          description: 'Re-analyzed description',
          tags: ['updated'],
          type: 'general',
          elements: []
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 250
      });

      upsertAttachmentAnalysis.mockResolvedValue({
        id: 'analysis-456',
        attachmentId: 'attachment-123',
        textContent: 'Re-analyzed text',
        description: 'Re-analyzed description',
        tags: ['updated'],
        metadata: {},
        createdAt: new Date()
      });
    });

    it('should re-analyze existing attachment', async () => {
      const result = await service.reanalyzeAttachment('attachment-123');

      expect(getAttachmentById).toHaveBeenCalledWith('attachment-123');
      expect(mockLLMClient.analyzeImage).toHaveBeenCalled();
      expect(upsertAttachmentAnalysis).toHaveBeenCalled();
      expect(result.textContent).toBe('Re-analyzed text');
    });

    it('should require attachmentId parameter', async () => {
      await expect(service.reanalyzeAttachment())
        .rejects.toThrow('attachmentId is required');
    });

    it('should handle attachment not found', async () => {
      getAttachmentById.mockResolvedValue(null);

      await expect(service.reanalyzeAttachment('nonexistent'))
        .rejects.toThrow('Attachment not found');
    });

    it('should only allow IMAGE attachments', async () => {
      getAttachmentById.mockResolvedValue({
        id: 'attachment-123',
        type: 'DOCUMENT',
        url: 'https://example.com/doc.pdf'
      });

      await expect(service.reanalyzeAttachment('attachment-123'))
        .rejects.toThrow('Only IMAGE attachments can be analyzed');
    });
  });

  describe('_detectImageType', () => {
    it('should detect document type', () => {
      const type = service._detectImageType('scan-document.jpg', 'image/jpeg');
      expect(type).toBe('document');
    });

    it('should detect screenshot type', () => {
      const type = service._detectImageType('screenshot-2024.png', 'image/png');
      expect(type).toBe('screenshot');
    });

    it('should detect handwritten type', () => {
      const type = service._detectImageType('handwritten-note.jpg', 'image/jpeg');
      expect(type).toBe('handwritten');
    });

    it('should default to general type', () => {
      const type = service._detectImageType('photo.jpg', 'image/jpeg');
      expect(type).toBe('general');
    });
  });

  describe('_parseAnalysisResponse', () => {
    it('should parse valid JSON response', () => {
      const content = JSON.stringify({
        textContent: 'Test text',
        description: 'Test description',
        tags: ['tag1', 'tag2'],
        type: 'document',
        elements: ['element1']
      });

      const result = service._parseAnalysisResponse(content, 'full');

      expect(result.textContent).toBe('Test text');
      expect(result.description).toBe('Test description');
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.type).toBe('document');
      expect(result.elements).toEqual(['element1']);
    });

    it('should parse JSON from markdown code blocks', () => {
      const content = '```json\n{"textContent": "Test", "description": "Desc", "tags": []}\n```';

      const result = service._parseAnalysisResponse(content, 'full');

      expect(result.textContent).toBe('Test');
      expect(result.description).toBe('Desc');
    });

    it('should handle text-only analysis', () => {
      const content = 'Plain text content';

      const result = service._parseAnalysisResponse(content, 'text');

      expect(result.textContent).toBe('Plain text content');
      expect(result.description).toBeNull();
      expect(result.tags).toEqual([]);
    });

    it('should handle invalid JSON gracefully', () => {
      const content = 'Not valid JSON at all';

      const result = service._parseAnalysisResponse(content, 'full');

      expect(result.description).toBe('Not valid JSON at all');
      expect(result).toHaveProperty('parseError');
    });

    it('should normalize missing fields', () => {
      const content = JSON.stringify({
        description: 'Only description'
      });

      const result = service._parseAnalysisResponse(content, 'full');

      expect(result.textContent).toBeNull();
      expect(result.description).toBe('Only description');
      expect(result.tags).toEqual([]);
      expect(result.elements).toEqual([]);
    });
  });

  describe('getStats and resetStats', () => {
    it('should get LLM client statistics', () => {
      mockLLMClient.getStats.mockReturnValue({
        totalCalls: 10,
        successfulCalls: 9,
        failedCalls: 1,
        totalTokens: 5000
      });

      const stats = service.getStats();

      expect(stats.totalCalls).toBe(10);
      expect(stats.successfulCalls).toBe(9);
    });

    it('should reset LLM client statistics', () => {
      service.resetStats();

      expect(mockLLMClient.resetStats).toHaveBeenCalled();
    });
  });

  describe('createImageAnalysisService', () => {
    it('should create service instance with default config', () => {
      const service = createImageAnalysisService();

      expect(service).toBeInstanceOf(ImageAnalysisService);
    });

    it('should create service instance with custom config', () => {
      const customConfig = {
        timeout: 15000,
        analysisType: 'text'
      };

      const service = createImageAnalysisService(customConfig);

      expect(service).toBeInstanceOf(ImageAnalysisService);
      expect(service.config.timeout).toBe(15000);
      expect(service.config.analysisType).toBe('text');
    });
  });
});
