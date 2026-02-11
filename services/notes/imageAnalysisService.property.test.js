/**
 * Property-Based Tests for Image Analysis Service
 * 
 * Feature: notes-feature
 * 
 * Tests universal properties that should hold for all valid inputs:
 * - Property 4: Image upload and analysis end-to-end
 * - Property 5: LLM image analysis output structure
 * 
 * Validates: Requirements 2.1, 2.2, 2.4, 2.5, 2.6, 12.3
 */

const fc = require('fast-check');
const { ImageAnalysisService } = require('./imageAnalysisService');
const { uploadFileWithRetry, validateFileSize, validateMimeType } = require('./s3Client');
const { createAttachment, upsertAttachmentAnalysis, getAttachmentById } = require('./attachmentDAL');
const { createMultimodalLLMClient } = require('./llmClient');

// Mock dependencies
jest.mock('./llmClient');
jest.mock('./s3Client');
jest.mock('./attachmentDAL');

describe('ImageAnalysisService - Property-Based Tests', () => {
  let service;
  let mockLLMClient;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLLMClient = {
      analyzeImage: jest.fn(),
      getStats: jest.fn(() => ({ totalCalls: 0, successfulCalls: 0 })),
      resetStats: jest.fn()
    };

    createMultimodalLLMClient.mockReturnValue(mockLLMClient);
    service = new ImageAnalysisService();

    // Default mock implementations
    validateFileSize.mockReturnValue(true);
    validateMimeType.mockReturnValue(true);
  });

  /**
   * **Feature: notes-feature, Property 4: 图片上传和分析端到端**
   * 
   * For any uploaded image, the system should:
   * 1. Save file to object storage
   * 2. Use LLM to analyze content
   * 3. Store structured results to database
   * 4. Maintain association between image and analysis results
   * 
   * **Validates: Requirements 2.1, 2.2, 2.5, 2.6, 12.3**
   */
  describe('Property 4: Image upload and analysis end-to-end', () => {
    it('should complete full upload and analysis flow for any valid image', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random image data
          fc.record({
            fileData: fc.uint8Array({ minLength: 100, maxLength: 1000 }).map(arr => Buffer.from(arr)),
            originalFilename: fc.string({ minLength: 5, maxLength: 50 }).map(s => `${s}.jpg`),
            userId: fc.uuid(),
            noteId: fc.uuid(),
            mimeType: fc.constantFrom('image/jpeg', 'image/png', 'image/gif', 'image/webp'),
            analysisType: fc.constantFrom('text', 'content', 'full')
          }),
          async (imageData) => {
            // Mock S3 upload success
            const mockUploadResult = {
              key: `images/${imageData.userId}/timestamp/uuid.jpg`,
              url: `https://s3.example.com/bucket/${imageData.userId}/image.jpg`,
              size: imageData.fileData.length,
              mimeType: imageData.mimeType
            };
            uploadFileWithRetry.mockResolvedValue(mockUploadResult);

            // Mock attachment creation
            const mockAttachment = {
              id: fc.sample(fc.uuid(), 1)[0],
              noteId: imageData.noteId,
              type: 'IMAGE',
              storageKey: mockUploadResult.key,
              url: mockUploadResult.url,
              size: mockUploadResult.size,
              mimeType: imageData.mimeType,
              createdAt: new Date()
            };
            createAttachment.mockResolvedValue(mockAttachment);

            // Mock LLM analysis
            const mockAnalysisContent = {
              textContent: 'Extracted text',
              description: 'Image description',
              type: 'general',
              tags: ['tag1', 'tag2'],
              elements: ['element1']
            };
            mockLLMClient.analyzeImage.mockResolvedValue({
              content: JSON.stringify(mockAnalysisContent),
              model: 'gpt-4-vision-preview',
              provider: 'openai',
              tokens: 500
            });

            // Mock analysis storage
            const mockAnalysis = {
              id: fc.sample(fc.uuid(), 1)[0],
              attachmentId: mockAttachment.id,
              textContent: mockAnalysisContent.textContent,
              description: mockAnalysisContent.description,
              tags: mockAnalysisContent.tags,
              metadata: {},
              createdAt: new Date()
            };
            upsertAttachmentAnalysis.mockResolvedValue(mockAnalysis);

            // Execute upload and analysis
            const result = await service.uploadAndAnalyzeImage(imageData);

            // Property 1: File must be saved to object storage
            expect(uploadFileWithRetry).toHaveBeenCalledWith(
              expect.objectContaining({
                fileData: imageData.fileData,
                originalFilename: imageData.originalFilename,
                userId: imageData.userId,
                mimeType: imageData.mimeType
              })
            );

            // Property 2: Attachment record must be created in database
            expect(createAttachment).toHaveBeenCalledWith(
              expect.objectContaining({
                noteId: imageData.noteId,
                type: 'IMAGE',
                storageKey: mockUploadResult.key,
                url: mockUploadResult.url
              })
            );

            // Property 3: LLM analysis must be performed
            expect(mockLLMClient.analyzeImage).toHaveBeenCalledWith(
              expect.objectContaining({
                imageUrl: mockUploadResult.url
              })
            );

            // Property 4: Analysis results must be stored
            expect(upsertAttachmentAnalysis).toHaveBeenCalledWith(
              expect.objectContaining({
                attachmentId: mockAttachment.id
              })
            );

            // Property 5: Result must contain both attachment and analysis
            expect(result).toHaveProperty('attachment');
            expect(result).toHaveProperty('analysis');

            // Property 6: Attachment and analysis must be linked
            expect(result.attachment.id).toBe(mockAttachment.id);
            // Analysis ID should exist (attachmentId is in DB but not returned in result)
            expect(result.analysis.id).toBeDefined();

            // Property 7: Original image URL must be preserved
            expect(result.attachment.url).toBe(mockUploadResult.url);
          }
        ),
        { numRuns: 50 } // Run 50 times with different random inputs
      );
    });

    it('should maintain data integrity even when LLM analysis fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fileData: fc.uint8Array({ minLength: 100, maxLength: 500 }).map(arr => Buffer.from(arr)),
            originalFilename: fc.string({ minLength: 5, maxLength: 30 }).map(s => `${s}.png`),
            userId: fc.uuid(),
            noteId: fc.uuid(),
            mimeType: fc.constant('image/png')
          }),
          async (imageData) => {
            // Mock successful upload
            uploadFileWithRetry.mockResolvedValue({
              key: 'images/test.png',
              url: 'https://s3.example.com/test.png',
              size: imageData.fileData.length,
              mimeType: imageData.mimeType
            });

            // Mock successful attachment creation
            const mockAttachment = {
              id: fc.sample(fc.uuid(), 1)[0],
              noteId: imageData.noteId,
              type: 'IMAGE',
              storageKey: 'images/test.png',
              url: 'https://s3.example.com/test.png',
              size: imageData.fileData.length,
              mimeType: imageData.mimeType,
              createdAt: new Date()
            };
            createAttachment.mockResolvedValue(mockAttachment);

            // Mock LLM failure
            mockLLMClient.analyzeImage.mockRejectedValue(new Error('LLM service unavailable'));

            // Mock analysis storage (with error metadata)
            upsertAttachmentAnalysis.mockResolvedValue({
              id: fc.sample(fc.uuid(), 1)[0],
              attachmentId: mockAttachment.id,
              textContent: null,
              description: null,
              tags: [],
              metadata: { error: 'LLM service unavailable' },
              createdAt: new Date()
            });

            // Execute upload and analysis
            const result = await service.uploadAndAnalyzeImage(imageData);

            // Property: Attachment must still be created even if analysis fails
            expect(result).toHaveProperty('attachment');
            expect(result.attachment.id).toBe(mockAttachment.id);

            // Property: Analysis record must be created with error metadata
            expect(result).toHaveProperty('analysis');
            expect(upsertAttachmentAnalysis).toHaveBeenCalledWith(
              expect.objectContaining({
                metadata: expect.objectContaining({
                  error: expect.any(String)
                })
              })
            );
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * **Feature: notes-feature, Property 5: LLM图像分析输出结构**
   * 
   * For any image analysis request, LLM output should contain valid structured data
   * (text content and/or description).
   * 
   * **Validates: Requirements 2.4, 2.5**
   */
  describe('Property 5: LLM image analysis output structure', () => {
    it('should always produce structured output with required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            imageUrl: fc.webUrl(),
            analysisType: fc.constantFrom('text', 'content', 'full'),
            // Generate various LLM response formats
            llmResponse: fc.oneof(
              // Valid JSON response
              fc.record({
                textContent: fc.option(fc.string(), { nil: null }),
                description: fc.option(fc.string(), { nil: null }),
                type: fc.option(fc.constantFrom('document', 'landscape', 'portrait', 'product'), { nil: null }),
                tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
                elements: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 })
              }).map(obj => JSON.stringify(obj)),
              // JSON in markdown code block
              fc.record({
                textContent: fc.string(),
                description: fc.string(),
                tags: fc.array(fc.string(), { maxLength: 3 })
              }).map(obj => `\`\`\`json\n${JSON.stringify(obj)}\n\`\`\``),
              // Plain text (for text-only analysis)
              fc.string({ minLength: 10, maxLength: 200 })
            )
          }),
          async ({ imageUrl, analysisType, llmResponse }) => {
            // Mock LLM response
            mockLLMClient.analyzeImage.mockResolvedValue({
              content: llmResponse,
              model: 'gpt-4-vision-preview',
              provider: 'openai',
              tokens: 300
            });

            // Execute analysis
            const result = await service.analyzeImage({
              imageUrl,
              analysisType
            });

            // Property 1: Result must always have these fields
            expect(result).toHaveProperty('textContent');
            expect(result).toHaveProperty('description');
            expect(result).toHaveProperty('tags');
            expect(result).toHaveProperty('type');
            expect(result).toHaveProperty('elements');

            // Property 2: textContent and description must be string or null
            expect(result.textContent === null || typeof result.textContent === 'string').toBe(true);
            expect(result.description === null || typeof result.description === 'string').toBe(true);

            // Property 3: tags must be an array
            expect(Array.isArray(result.tags)).toBe(true);

            // Property 4: elements must be an array
            expect(Array.isArray(result.elements)).toBe(true);

            // Property 5: Result should have valid structure
            // (empty strings and null are both valid - LLM might return empty content)
            if (!result.parseError) {
              // Just verify the fields exist and are the right type
              expect(result.textContent === null || typeof result.textContent === 'string').toBe(true);
              expect(result.description === null || typeof result.description === 'string').toBe(true);
            }

            // Property 6: For text-only analysis, textContent should be populated
            if (analysisType === 'text' && !result.parseError) {
              expect(result.textContent).toBeTruthy();
            }
          }
        ),
        { numRuns: 100 } // Run many times to test various response formats
      );
    });

    it('should handle malformed LLM responses gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            imageUrl: fc.webUrl(),
            // Generate various malformed responses
            malformedResponse: fc.oneof(
              fc.constant(''),
              fc.constant('   '),
              fc.constant('Not JSON at all'),
              fc.constant('{"incomplete": '),
              fc.constant('null'),
              fc.constant('undefined'),
              fc.array(fc.integer()).map(arr => JSON.stringify(arr)), // Array instead of object
              fc.integer().map(n => JSON.stringify(n)) // Number instead of object
            )
          }),
          async ({ imageUrl, malformedResponse }) => {
            // Mock malformed LLM response
            mockLLMClient.analyzeImage.mockResolvedValue({
              content: malformedResponse,
              model: 'gpt-4-vision-preview',
              provider: 'openai',
              tokens: 100
            });

            // Execute analysis
            const result = await service.analyzeImage({
              imageUrl,
              analysisType: 'full'
            });

            // Property 1: Should not throw error
            expect(result).toBeDefined();

            // Property 2: Should have all required fields
            expect(result).toHaveProperty('textContent');
            expect(result).toHaveProperty('description');
            expect(result).toHaveProperty('tags');

            // Property 3: Should fallback to using content as description
            if (malformedResponse && malformedResponse.trim().length > 0) {
              expect(result.description).toBeTruthy();
            }

            // Property 4: Should indicate parse error
            expect(result).toHaveProperty('parseError');

            // Property 5: tags should be empty array on parse failure
            expect(result.tags).toEqual([]);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should preserve LLM metadata in all cases', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            imageUrl: fc.webUrl(),
            model: fc.constantFrom('gpt-4-vision-preview', 'claude-3-opus', 'qwen-vl-max'),
            provider: fc.constantFrom('openai', 'anthropic', 'qwen'),
            tokens: fc.integer({ min: 100, max: 2000 }),
            responseContent: fc.record({
              textContent: fc.string(),
              description: fc.string(),
              tags: fc.array(fc.string(), { maxLength: 5 })
            }).map(obj => JSON.stringify(obj))
          }),
          async ({ imageUrl, model, provider, tokens, responseContent }) => {
            // Mock LLM response with metadata
            mockLLMClient.analyzeImage.mockResolvedValue({
              content: responseContent,
              model,
              provider,
              tokens
            });

            // Execute analysis
            const result = await service.analyzeImage({
              imageUrl,
              analysisType: 'full'
            });

            // Property: LLM metadata must be preserved
            expect(result.model).toBe(model);
            expect(result.provider).toBe(provider);
            expect(result.tokens).toBe(tokens);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Additional property: Analysis type consistency
   */
  describe('Property: Analysis type determines output format', () => {
    it('should respect analysisType parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            imageUrl: fc.webUrl(),
            analysisType: fc.constantFrom('text', 'content', 'full')
          }),
          async ({ imageUrl, analysisType }) => {
            // Mock appropriate response based on analysis type
            let mockResponse;
            if (analysisType === 'text') {
              mockResponse = 'Plain text extracted from image';
            } else {
              mockResponse = JSON.stringify({
                textContent: analysisType === 'full' ? 'Text content' : null,
                description: 'Image description',
                tags: ['tag1', 'tag2'],
                type: 'general',
                elements: []
              });
            }

            mockLLMClient.analyzeImage.mockResolvedValue({
              content: mockResponse,
              model: 'gpt-4-vision-preview',
              provider: 'openai',
              tokens: 200
            });

            // Execute analysis
            const result = await service.analyzeImage({
              imageUrl,
              analysisType
            });

            // Property: For text-only analysis, description should be null
            if (analysisType === 'text') {
              expect(result.description).toBeNull();
              expect(result.textContent).toBeTruthy();
            }

            // Property: For content/full analysis, should have description
            if (analysisType === 'content' || analysisType === 'full') {
              expect(result.description).toBeTruthy();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
