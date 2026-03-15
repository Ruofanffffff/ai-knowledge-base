/**
 * Image Analysis Service for Notes Feature
 * 
 * Provides end-to-end image analysis functionality:
 * - Image upload handling
 * - Multimodal LLM integration for image analysis
 * - Analysis result parsing and storage
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

const { createMultimodalLLMClient } = require('./llmClient');
const { 
  createTextRecognitionPrompt, 
  createImageContentAnalysisPrompt,
  createFullImageAnalysisPrompt 
} = require('./prompts');
const { 
  uploadFileWithRetry, 
  generateFileUrl,
  validateFileSize,
  validateMimeType 
} = require('./s3Client');
const { 
  createAttachment, 
  upsertAttachmentAnalysis,
  getAttachmentById 
} = require('./attachmentDAL');
const { notesConfig } = require('../../config/notes.config');

/**
 * Image Analysis Service class
 */
class ImageAnalysisService {
  constructor(config = {}) {
    this.llmClient = config.llmClient || createMultimodalLLMClient(config.llm);
    this.config = {
      timeout: config.timeout || notesConfig.imageAnalysis?.timeout || 10000,
      analysisType: config.analysisType || 'full', // 'text', 'content', 'full'
      ...config
    };
  }

  /**
   * Upload and analyze an image
   * Requirement 2.1, 2.2, 2.3, 2.4, 2.5, 2.6: Complete image upload and analysis flow
   * 
   * @param {Object} options - Upload and analysis options
   * @param {Buffer|Stream} options.fileData - Image file data
   * @param {string} options.originalFilename - Original filename
   * @param {string} options.userId - User ID
   * @param {string} options.noteId - Note ID
   * @param {string} options.mimeType - MIME type
   * @param {string} [options.analysisType='full'] - Analysis type ('text', 'content', 'full')
   * @param {Object} [options.metadata={}] - Additional metadata
   * @returns {Promise<Object>} Upload and analysis result
   */
  async uploadAndAnalyzeImage(options) {
    const {
      fileData,
      originalFilename,
      userId,
      noteId,
      mimeType,
      analysisType = 'full',
      metadata = {}
    } = options;

    // Validate required parameters
    if (!fileData || !originalFilename || !userId || !noteId || !mimeType) {
      throw new Error('fileData, originalFilename, userId, noteId, and mimeType are required');
    }

    // Validate file size
    const fileSize = fileData.length || 0;
    validateFileSize(fileSize);

    // Validate MIME type
    validateMimeType(mimeType, 'IMAGE');

    try {
      // Step 1: Upload image to S3
      // Requirement 2.1: Save image to object storage
      const uploadResult = await uploadFileWithRetry({
        fileData,
        originalFilename,
        userId,
        mimeType,
        metadata: {
          ...metadata,
          noteId,
          type: 'IMAGE'
        },
        prefix: 'images'
      });

      // Step 2: Create attachment record in database
      const attachment = await createAttachment({
        noteId,
        type: 'IMAGE',
        storageKey: uploadResult.key,
        url: uploadResult.url,
        size: uploadResult.size,
        mimeType
      });

      // Step 3: Analyze image with multimodal LLM
      // Requirement 2.2, 2.3, 2.4: Use multimodal LLM for analysis
      let analysisResult;
      try {
        analysisResult = await this.analyzeImage({
          imageUrl: uploadResult.url,
          analysisType,
          imageType: this._detectImageType(originalFilename, mimeType)
        });
      } catch (analysisError) {
        console.error('[ImageAnalysisService] Analysis failed:', analysisError.message);
        // Continue without analysis - attachment is already saved
        analysisResult = {
          textContent: null,
          description: null,
          tags: [],
          error: analysisError.message
        };
      }

      // Step 4: Store analysis results in database
      // Requirement 2.5, 2.6: Store structured analysis data
      const analysis = await upsertAttachmentAnalysis({
        attachmentId: attachment.id,
        textContent: analysisResult.textContent || null,
        description: analysisResult.description || null,
        tags: analysisResult.tags || [],
        metadata: {
          analysisType,
          imageType: analysisResult.type || null,
          elements: analysisResult.elements || [],
          llmModel: analysisResult.model || null,
          llmProvider: analysisResult.provider || null,
          tokens: analysisResult.tokens || 0,
          analyzedAt: new Date().toISOString(),
          ...(uploadResult.degraded && {
            storageDegraded: true,
            degradationMode: uploadResult.degradationMode || 'LOCAL_CACHE',
            fallbackId: uploadResult.fallbackId || null
          }),
          ...(analysisResult.error && { error: analysisResult.error })
        }
      });

      // Return complete result
      return {
        attachment: {
          id: attachment.id,
          noteId: attachment.noteId,
          type: attachment.type,
          url: attachment.url,
          storageKey: attachment.storageKey,
          size: attachment.size,
          mimeType: attachment.mimeType,
          createdAt: attachment.createdAt,
          ...(uploadResult.degraded && {
            degraded: true,
            degradationMode: uploadResult.degradationMode || 'LOCAL_CACHE',
            fallbackId: uploadResult.fallbackId || null
          })
        },
        analysis: {
          id: analysis.id,
          textContent: analysis.textContent,
          description: analysis.description,
          tags: analysis.tags,
          metadata: analysis.metadata,
          createdAt: analysis.createdAt
        }
      };
    } catch (error) {
      const wrappedError = new Error(`Failed to upload and analyze image: ${error.message}`);
      wrappedError.code = error.code || 'IMAGE_UPLOAD_ANALYZE_FAILED';
      wrappedError.statusCode = error.statusCode || 500;
      wrappedError.retryable = error.retryable;
      wrappedError.operation = error.operation || 'imageUpload';
      wrappedError.context = {
        noteId,
        userId,
        originalFilename,
        mimeType,
        ...(error.context || {})
      };
      wrappedError.retryErrors = error.retryErrors || [];
      wrappedError.cause = error;
      throw wrappedError;
    }
  }

  /**
   * Analyze an already uploaded image
   * Requirement 2.2, 2.3, 2.4: Use multimodal LLM for image analysis
   * 
   * @param {Object} options - Analysis options
   * @param {string} options.imageUrl - Image URL
   * @param {string} [options.analysisType='full'] - Analysis type
   * @param {string} [options.imageType] - Image type hint
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeImage(options) {
    const { imageUrl, analysisType = 'full', imageType } = options;

    if (!imageUrl) {
      throw new Error('imageUrl is required');
    }

    // Generate appropriate prompt based on analysis type
    let prompt;
    switch (analysisType) {
      case 'text':
        prompt = createTextRecognitionPrompt({ imageType });
        break;
      case 'content':
        prompt = createImageContentAnalysisPrompt({ analysisType: 'general' });
        break;
      case 'full':
      default:
        prompt = createFullImageAnalysisPrompt();
        break;
    }

    // Call multimodal LLM
    const llmResult = await this.llmClient.analyzeImage({
      imageUrl,
      prompt,
      config: {
        temperature: 0.3, // Lower temperature for more consistent analysis
        maxTokens: 1500
      }
    });

    // Parse the response
    const parsedResult = this._parseAnalysisResponse(llmResult.content, analysisType);

    return {
      ...parsedResult,
      model: llmResult.model,
      provider: llmResult.provider,
      tokens: llmResult.tokens
    };
  }

  /**
   * Re-analyze an existing attachment
   * 
   * @param {string} attachmentId - Attachment ID
   * @param {string} [analysisType='full'] - Analysis type
   * @returns {Promise<Object>} Updated analysis
   */
  async reanalyzeAttachment(attachmentId, analysisType = 'full') {
    if (!attachmentId) {
      throw new Error('attachmentId is required');
    }

    // Get attachment
    const attachment = await getAttachmentById(attachmentId);
    if (!attachment) {
      throw new Error('Attachment not found');
    }

    if (attachment.type !== 'IMAGE') {
      throw new Error('Only IMAGE attachments can be analyzed');
    }

    // Analyze image
    const analysisResult = await this.analyzeImage({
      imageUrl: attachment.url,
      analysisType,
      imageType: this._detectImageType(attachment.storageKey, attachment.mimeType)
    });

    // Update analysis in database
    const analysis = await upsertAttachmentAnalysis({
      attachmentId: attachment.id,
      textContent: analysisResult.textContent || null,
      description: analysisResult.description || null,
      tags: analysisResult.tags || [],
      metadata: {
        analysisType,
        imageType: analysisResult.type || null,
        elements: analysisResult.elements || [],
        llmModel: analysisResult.model || null,
        llmProvider: analysisResult.provider || null,
        tokens: analysisResult.tokens || 0,
        analyzedAt: new Date().toISOString()
      }
    });

    return analysis;
  }

  /**
   * Parse LLM analysis response
   * @private
   * @param {string} content - LLM response content
   * @param {string} analysisType - Analysis type
   * @returns {Object} Parsed analysis result
   */
  _parseAnalysisResponse(content, analysisType) {
    try {
      // For 'text' analysis, return plain text
      if (analysisType === 'text') {
        return {
          textContent: content.trim(),
          description: null,
          tags: [],
          type: null,
          elements: []
        };
      }

      // For 'content' and 'full' analysis, parse JSON
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/```\s*([\s\S]*?)\s*```/) ||
                       content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      // Validate and normalize the parsed result
      return {
        textContent: parsed.textContent || null,
        description: parsed.description || null,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        type: parsed.type || null,
        elements: Array.isArray(parsed.elements) ? parsed.elements : []
      };
    } catch (error) {
      console.error('[ImageAnalysisService] Failed to parse analysis response:', error.message);
      
      // Fallback: return content as description
      return {
        textContent: null,
        description: content.trim(),
        tags: [],
        type: null,
        elements: [],
        parseError: error.message
      };
    }
  }

  /**
   * Detect image type from filename and MIME type
   * @private
   * @param {string} filename - Filename
   * @param {string} mimeType - MIME type
   * @returns {string} Image type hint
   */
  _detectImageType(filename, mimeType) {
    const lowerFilename = filename.toLowerCase();
    
    // Check for document-like images
    if (lowerFilename.includes('document') || 
        lowerFilename.includes('scan') || 
        lowerFilename.includes('pdf')) {
      return 'document';
    }
    
    // Check for screenshots
    if (lowerFilename.includes('screenshot') || 
        lowerFilename.includes('screen') ||
        lowerFilename.includes('capture')) {
      return 'screenshot';
    }
    
    // Check for handwritten
    if (lowerFilename.includes('handwritten') || 
        lowerFilename.includes('note') ||
        lowerFilename.includes('sketch')) {
      return 'handwritten';
    }
    
    // Default to general
    return 'general';
  }

  /**
   * Get LLM client statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return this.llmClient.getStats();
  }

  /**
   * Reset LLM client statistics
   */
  resetStats() {
    this.llmClient.resetStats();
  }
}

/**
 * Create image analysis service instance
 * @param {Object} config - Service configuration
 * @returns {ImageAnalysisService}
 */
function createImageAnalysisService(config = {}) {
  return new ImageAnalysisService(config);
}

// Export singleton instance
const defaultService = createImageAnalysisService({
  llm: {
    apiKey: process.env.VOLCENGINE_API_KEY || process.env.QWEN_API_KEY,
    provider: process.env.MULTIMODAL_LLM_PROVIDER || 'volcengine',
    model: process.env.MULTIMODAL_LLM_MODEL || 'seed1.8',
    timeout: parseInt(process.env.MULTIMODAL_LLM_TIMEOUT) || 30000
  }
});

module.exports = {
  ImageAnalysisService,
  createImageAnalysisService,
  // Export default instance
  uploadAndAnalyzeImage: defaultService.uploadAndAnalyzeImage.bind(defaultService),
  analyzeImage: defaultService.analyzeImage.bind(defaultService),
  reanalyzeAttachment: defaultService.reanalyzeAttachment.bind(defaultService),
  getStats: defaultService.getStats.bind(defaultService),
  resetStats: defaultService.resetStats.bind(defaultService)
};
