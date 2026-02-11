/**
 * Unit Tests for Image Type Support in Image Analysis Service
 * 
 * Tests various image types to ensure the analyzer can handle:
 * - Pure text images (documents, screenshots, handwritten)
 * - Landscape photos
 * - Portrait photos
 * - Product photos
 * - Artwork
 * - Movie/animation screenshots
 * - Mixed content images
 * 
 * Validates: Requirement 2.9
 */

const { ImageAnalysisService } = require('./imageAnalysisService');
const { createMultimodalLLMClient } = require('./llmClient');
const { uploadFileWithRetry, validateFileSize, validateMimeType } = require('./s3Client');
const { createAttachment, upsertAttachmentAnalysis } = require('./attachmentDAL');

// Mock dependencies
jest.mock('./llmClient');
jest.mock('./s3Client');
jest.mock('./attachmentDAL');

describe('ImageAnalysisService - Image Type Support', () => {
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

    // Mock S3 upload
    uploadFileWithRetry.mockResolvedValue({
      key: 'images/test/uuid.jpg',
      url: 'https://s3.example.com/test.jpg',
      size: 1024,
      mimeType: 'image/jpeg'
    });

    // Mock attachment creation
    createAttachment.mockResolvedValue({
      id: 'attachment-123',
      noteId: 'note-456',
      type: 'IMAGE',
      storageKey: 'images/test/uuid.jpg',
      url: 'https://s3.example.com/test.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
      createdAt: new Date()
    });

    // Mock analysis storage
    upsertAttachmentAnalysis.mockImplementation((data) => Promise.resolve({
      id: 'analysis-789',
      attachmentId: data.attachmentId,
      textContent: data.textContent,
      description: data.description,
      tags: data.tags,
      metadata: data.metadata,
      createdAt: new Date()
    }));
  });

  /**
   * Test 1: Pure Text Images - Documents
   * Requirement 2.9: Support for document images
   */
  describe('Pure Text Images - Documents', () => {
    it('should analyze document images and extract text content', async () => {
      // Mock LLM response for document image
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: 'This is a business document with important information.\nDate: 2024-01-15\nSubject: Quarterly Report',
          description: 'A scanned business document with text content',
          type: 'document',
          tags: ['document', 'business', 'text'],
          elements: ['text', 'header', 'date']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 450
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake document image'),
        originalFilename: 'business-document.jpg',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/jpeg',
        analysisType: 'full'
      });

      expect(result.analysis.textContent).toBeTruthy();
      expect(result.analysis.textContent).toContain('business document');
      expect(result.analysis.tags).toContain('document');
      expect(result.analysis.metadata.imageType).toBe('document');
    });

    it('should handle PDF-like document images', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: 'Invoice #12345\nAmount: $1,234.56\nDue Date: 2024-02-01',
          description: 'An invoice document with structured information',
          type: 'document',
          tags: ['invoice', 'document', 'financial'],
          elements: ['text', 'numbers', 'table']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 400
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake pdf document'),
        originalFilename: 'invoice-scan.pdf.jpg',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/jpeg'
      });

      expect(result.analysis.textContent).toContain('Invoice');
      expect(result.analysis.tags).toContain('document');
    });
  });

  /**
   * Test 2: Pure Text Images - Screenshots
   * Requirement 2.9: Support for screenshot images
   */
  describe('Pure Text Images - Screenshots', () => {
    it('should analyze screenshot images and extract UI text', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: 'Welcome to the App\nLogin\nUsername: _____\nPassword: _____\nForgot Password?',
          description: 'A screenshot of a login screen with form fields',
          type: 'screenshot',
          tags: ['screenshot', 'ui', 'login'],
          elements: ['text', 'buttons', 'input-fields']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 380
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake screenshot'),
        originalFilename: 'screenshot-2024-01-15.png',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/png'
      });

      expect(result.analysis.textContent).toBeTruthy();
      expect(result.analysis.description).toContain('screenshot');
      expect(result.analysis.metadata.imageType).toBe('screenshot');
    });

    it('should handle code screenshot images', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: 'function hello() {\n  console.log("Hello World");\n}',
          description: 'A screenshot of code in an IDE',
          type: 'screenshot',
          tags: ['code', 'screenshot', 'programming'],
          elements: ['code', 'syntax-highlighting', 'text']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 420
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake code screenshot'),
        originalFilename: 'code-screen-capture.png',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/png'
      });

      expect(result.analysis.textContent).toContain('function');
      expect(result.analysis.tags).toContain('code');
    });
  });

  /**
   * Test 3: Pure Text Images - Handwritten
   * Requirement 2.9: Support for handwritten images
   */
  describe('Pure Text Images - Handwritten', () => {
    it('should analyze handwritten notes and extract text', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: 'Meeting notes:\n- Discuss project timeline\n- Review budget\n- Assign tasks',
          description: 'Handwritten meeting notes on paper',
          type: 'handwritten',
          tags: ['handwritten', 'notes', 'meeting'],
          elements: ['handwriting', 'bullet-points', 'text']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 410
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake handwritten note'),
        originalFilename: 'handwritten-note.jpg',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/jpeg'
      });

      expect(result.analysis.textContent).toBeTruthy();
      expect(result.analysis.description).toContain('Handwritten');
      expect(result.analysis.metadata.imageType).toBe('handwritten');
    });

    it('should handle handwritten sketches with annotations', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: 'Design sketch\nMain feature: User dashboard\nNotes: Add charts and graphs',
          description: 'A hand-drawn sketch with annotations',
          type: 'handwritten',
          tags: ['sketch', 'handwritten', 'design'],
          elements: ['drawing', 'handwriting', 'annotations']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 430
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake sketch'),
        originalFilename: 'design-sketch-handwritten.jpg',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/jpeg'
      });

      expect(result.analysis.textContent).toContain('sketch');
      expect(result.analysis.tags).toContain('handwritten');
    });
  });

  /**
   * Test 4: Landscape Photos
   * Requirement 2.9: Support for landscape photos
   */
  describe('Landscape Photos', () => {
    it('should analyze landscape photos and describe scenery', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: null,
          description: 'A breathtaking mountain landscape at sunset with snow-capped peaks, pine forests in the foreground, and golden light illuminating the scene',
          type: 'landscape',
          tags: ['landscape', 'nature', 'mountains', 'sunset'],
          elements: ['mountains', 'trees', 'sky', 'sunset']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 480
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake landscape photo'),
        originalFilename: 'mountain-sunset.jpg',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/jpeg'
      });

      expect(result.analysis.description).toBeTruthy();
      expect(result.analysis.description).toContain('landscape');
      expect(result.analysis.tags).toContain('landscape');
      expect(result.analysis.textContent).toBeNull();
    });

    it('should handle beach and ocean landscapes', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: null,
          description: 'A serene beach scene with turquoise water, white sand, and palm trees swaying in the breeze',
          type: 'landscape',
          tags: ['beach', 'ocean', 'landscape', 'tropical'],
          elements: ['water', 'sand', 'palm-trees', 'sky']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 460
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake beach photo'),
        originalFilename: 'tropical-beach.jpg',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/jpeg'
      });

      expect(result.analysis.description).toContain('beach');
      expect(result.analysis.tags).toContain('landscape');
    });
  });

  /**
   * Test 5: Portrait Photos
   * Requirement 2.9: Support for portrait photos
   */
  describe('Portrait Photos', () => {
    it('should analyze portrait photos and describe people', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: null,
          description: 'A professional portrait of a person in business attire, smiling at the camera with a neutral background',
          type: 'portrait',
          tags: ['portrait', 'person', 'professional', 'headshot'],
          elements: ['face', 'person', 'clothing', 'background']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 440
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake portrait photo'),
        originalFilename: 'professional-headshot.jpg',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/jpeg'
      });

      expect(result.analysis.description).toBeTruthy();
      expect(result.analysis.description).toContain('portrait');
      expect(result.analysis.tags).toContain('portrait');
    });

    it('should handle group portrait photos', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: null,
          description: 'A group photo of five people standing together, smiling and posing for the camera in a casual outdoor setting',
          type: 'portrait',
          tags: ['portrait', 'group', 'people', 'outdoor'],
          elements: ['people', 'faces', 'outdoor-setting']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 450
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake group photo'),
        originalFilename: 'team-photo.jpg',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/jpeg'
      });

      expect(result.analysis.description).toContain('group');
      expect(result.analysis.tags).toContain('portrait');
    });
  });

  /**
   * Test 6: Product Photos
   * Requirement 2.9: Support for product photos
   */
  describe('Product Photos', () => {
    it('should analyze product photos and describe items', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: 'Brand Name\nModel: XYZ-2024\nPrice: $299',
          description: 'A professional product photo of a sleek black smartphone on a white background, showing the front screen and elegant design',
          type: 'product',
          tags: ['product', 'smartphone', 'electronics', 'commercial'],
          elements: ['product', 'text', 'branding', 'clean-background']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 470
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake product photo'),
        originalFilename: 'smartphone-product.jpg',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/jpeg'
      });

      expect(result.analysis.description).toBeTruthy();
      expect(result.analysis.description).toContain('product');
      expect(result.analysis.tags).toContain('product');
    });

    it('should handle food product photos', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: null,
          description: 'An appetizing photo of a gourmet burger with fresh ingredients, melted cheese, and crispy bacon on a wooden board',
          type: 'product',
          tags: ['food', 'product', 'burger', 'restaurant'],
          elements: ['food', 'ingredients', 'presentation']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 460
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake food photo'),
        originalFilename: 'gourmet-burger.jpg',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/jpeg'
      });

      expect(result.analysis.description).toContain('burger');
      expect(result.analysis.tags).toContain('product');
    });
  });

  /**
   * Test 7: Artwork
   * Requirement 2.9: Support for artwork images
   */
  describe('Artwork', () => {
    it('should analyze artwork and describe artistic elements', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: null,
          description: 'An abstract painting with vibrant colors including blues, reds, and yellows, featuring bold brushstrokes and geometric shapes',
          type: 'artwork',
          tags: ['art', 'painting', 'abstract', 'colorful'],
          elements: ['colors', 'brushstrokes', 'shapes', 'composition']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 490
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake artwork'),
        originalFilename: 'abstract-painting.jpg',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/jpeg'
      });

      expect(result.analysis.description).toBeTruthy();
      expect(result.analysis.description).toContain('painting');
      expect(result.analysis.tags).toContain('art');
    });

    it('should handle digital artwork and illustrations', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: null,
          description: 'A digital illustration of a fantasy character with detailed armor, magical effects, and a dramatic background',
          type: 'artwork',
          tags: ['digital-art', 'illustration', 'fantasy', 'character'],
          elements: ['character', 'armor', 'effects', 'background']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 480
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake digital art'),
        originalFilename: 'fantasy-character.png',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/png'
      });

      expect(result.analysis.description).toContain('illustration');
      expect(result.analysis.tags).toContain('digital-art');
    });
  });

  /**
   * Test 8: Movie/Animation Screenshots
   * Requirement 2.9: Support for movie/animation screenshots
   */
  describe('Movie/Animation Screenshots', () => {
    it('should analyze movie screenshots and describe scenes', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: 'Subtitle: "We need to go back"',
          description: 'A dramatic movie scene showing two characters in conversation, with cinematic lighting and composition',
          type: 'movie-screenshot',
          tags: ['movie', 'screenshot', 'cinema', 'scene'],
          elements: ['characters', 'dialogue', 'lighting', 'composition']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 470
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake movie screenshot'),
        originalFilename: 'movie-scene.jpg',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/jpeg'
      });

      expect(result.analysis.description).toBeTruthy();
      expect(result.analysis.description).toContain('movie');
      expect(result.analysis.tags).toContain('movie');
    });

    it('should handle animation screenshots', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: null,
          description: 'An animated scene featuring colorful characters in a whimsical environment with vibrant colors and stylized art',
          type: 'animation-screenshot',
          tags: ['animation', 'cartoon', 'screenshot', 'colorful'],
          elements: ['characters', 'animation-style', 'colors', 'environment']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 460
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake animation screenshot'),
        originalFilename: 'anime-screenshot.png',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/png'
      });

      expect(result.analysis.description).toContain('animated');
      expect(result.analysis.tags).toContain('animation');
    });
  });

  /**
   * Test 9: Mixed Content Images
   * Requirement 2.9: Support for mixed content images
   */
  describe('Mixed Content Images', () => {
    it('should analyze images with both text and visual content', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: 'Infographic Title: Climate Change Statistics\n2024 Data\nTemperature: +1.5°C\nSea Level: +20cm',
          description: 'An infographic combining text, charts, and images about climate change, with colorful data visualizations and icons',
          type: 'mixed',
          tags: ['infographic', 'data', 'mixed-content', 'educational'],
          elements: ['text', 'charts', 'icons', 'images', 'data-visualization']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 520
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake infographic'),
        originalFilename: 'climate-infographic.jpg',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/jpeg'
      });

      expect(result.analysis.textContent).toBeTruthy();
      expect(result.analysis.description).toBeTruthy();
      expect(result.analysis.tags).toContain('infographic');
    });

    it('should handle social media posts with text and images', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: '@username: Check out this amazing view! #travel #nature\n❤️ 1.2K 💬 45',
          description: 'A social media post showing a scenic photo with text overlay, username, caption, and engagement metrics',
          type: 'mixed',
          tags: ['social-media', 'mixed-content', 'post', 'photo'],
          elements: ['photo', 'text', 'username', 'hashtags', 'metrics']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 500
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake social media post'),
        originalFilename: 'instagram-post.jpg',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/jpeg'
      });

      expect(result.analysis.textContent).toContain('@username');
      expect(result.analysis.description).toContain('social media');
      expect(result.analysis.tags).toContain('mixed-content');
    });

    it('should handle presentation slides with text and graphics', async () => {
      mockLLMClient.analyzeImage.mockResolvedValue({
        content: JSON.stringify({
          textContent: 'Quarterly Results Q4 2024\nRevenue: $10M (+25%)\nCustomers: 50K (+40%)\nKey Achievements',
          description: 'A presentation slide with title, bullet points, charts, and company branding',
          type: 'mixed',
          tags: ['presentation', 'slide', 'business', 'mixed-content'],
          elements: ['text', 'charts', 'graphics', 'branding']
        }),
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        tokens: 510
      });

      const result = await service.uploadAndAnalyzeImage({
        fileData: Buffer.from('fake presentation slide'),
        originalFilename: 'quarterly-results-slide.png',
        userId: 'user-123',
        noteId: 'note-456',
        mimeType: 'image/png'
      });

      expect(result.analysis.textContent).toContain('Quarterly Results');
      expect(result.analysis.description).toContain('presentation');
      expect(result.analysis.tags).toContain('presentation');
    });
  });

  /**
   * Test 10: Edge Cases and Type Detection
   */
  describe('Image Type Detection', () => {
    it('should correctly detect document type from filename', () => {
      const type = service._detectImageType('scanned-document.jpg', 'image/jpeg');
      expect(type).toBe('document');
    });

    it('should correctly detect screenshot type from filename', () => {
      const type = service._detectImageType('screenshot-2024.png', 'image/png');
      expect(type).toBe('screenshot');
    });

    it('should correctly detect handwritten type from filename', () => {
      const type = service._detectImageType('handwritten-notes.jpg', 'image/jpeg');
      expect(type).toBe('handwritten');
    });

    it('should default to general for unknown types', () => {
      const type = service._detectImageType('random-photo.jpg', 'image/jpeg');
      expect(type).toBe('general');
    });

    it('should handle various image formats', async () => {
      const formats = [
        { mimeType: 'image/jpeg', ext: 'jpg' },
        { mimeType: 'image/png', ext: 'png' },
        { mimeType: 'image/gif', ext: 'gif' },
        { mimeType: 'image/webp', ext: 'webp' }
      ];

      for (const format of formats) {
        // Reset mocks for each format
        uploadFileWithRetry.mockResolvedValue({
          key: `images/test/uuid.${format.ext}`,
          url: `https://s3.example.com/test.${format.ext}`,
          size: 1024,
          mimeType: format.mimeType
        });

        createAttachment.mockResolvedValue({
          id: 'attachment-123',
          noteId: 'note-456',
          type: 'IMAGE',
          storageKey: `images/test/uuid.${format.ext}`,
          url: `https://s3.example.com/test.${format.ext}`,
          size: 1024,
          mimeType: format.mimeType,
          createdAt: new Date()
        });

        mockLLMClient.analyzeImage.mockResolvedValue({
          content: JSON.stringify({
            textContent: null,
            description: `Test image in ${format.ext} format`,
            type: 'general',
            tags: ['test'],
            elements: []
          }),
          model: 'gpt-4-vision-preview',
          provider: 'openai',
          tokens: 300
        });

        const result = await service.uploadAndAnalyzeImage({
          fileData: Buffer.from('fake image'),
          originalFilename: `test.${format.ext}`,
          userId: 'user-123',
          noteId: 'note-456',
          mimeType: format.mimeType
        });

        expect(result.attachment.mimeType).toBe(format.mimeType);
      }
    });
  });

  /**
   * Test 11: Comprehensive Type Coverage
   */
  describe('Comprehensive Image Type Coverage', () => {
    it('should successfully analyze all supported image types', async () => {
      const imageTypes = [
        { type: 'document', filename: 'document.jpg', hasText: true },
        { type: 'screenshot', filename: 'screenshot.png', hasText: true },
        { type: 'handwritten', filename: 'handwritten-note.jpg', hasText: true },
        { type: 'landscape', filename: 'landscape.jpg', hasText: false },
        { type: 'portrait', filename: 'portrait.jpg', hasText: false },
        { type: 'product', filename: 'product.jpg', hasText: false },
        { type: 'artwork', filename: 'artwork.jpg', hasText: false },
        { type: 'movie-screenshot', filename: 'movie.jpg', hasText: false },
        { type: 'mixed', filename: 'infographic.jpg', hasText: true }
      ];

      for (const imageType of imageTypes) {
        mockLLMClient.analyzeImage.mockResolvedValue({
          content: JSON.stringify({
            textContent: imageType.hasText ? `Sample text for ${imageType.type}` : null,
            description: `A ${imageType.type} image`,
            type: imageType.type,
            tags: [imageType.type, 'test'],
            elements: ['element1', 'element2']
          }),
          model: 'gpt-4-vision-preview',
          provider: 'openai',
          tokens: 400
        });

        const result = await service.uploadAndAnalyzeImage({
          fileData: Buffer.from(`fake ${imageType.type} image`),
          originalFilename: imageType.filename,
          userId: 'user-123',
          noteId: 'note-456',
          mimeType: 'image/jpeg'
        });

        // Verify analysis completed successfully
        expect(result.analysis).toBeDefined();
        expect(result.analysis.description).toContain(imageType.type);
        
        // Verify text content presence matches expectation
        if (imageType.hasText) {
          expect(result.analysis.textContent).toBeTruthy();
        }
      }
    });
  });
});
