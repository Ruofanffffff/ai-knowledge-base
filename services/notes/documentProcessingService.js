/**
 * Document Processing Service for Notes Feature
 * 
 * Provides end-to-end document processing functionality:
 * - Document upload handling
 * - Integration with existing document processing pipeline
 * - Parsed content storage
 * 
 * Validates: Requirements 3.1, 3.2, 3.3
 */

// KG document_processor removed — pending redesign
const processDocumentWithFullProcessing = null;
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
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

/**
 * Document Processing Service class
 */
class DocumentProcessingService {
  constructor(config = {}) {
    this.config = {
      timeout: config.timeout || notesConfig.documentProcessing?.timeout || 30000,
      tempDir: config.tempDir || os.tmpdir(),
      ...config
    };
  }

  /**
   * Upload and process a document
   * Requirement 3.1, 3.2, 3.3: Complete document upload and processing flow
   * 
   * @param {Object} options - Upload and processing options
   * @param {Buffer|Stream} options.fileData - Document file data
   * @param {string} options.originalFilename - Original filename
   * @param {string} options.userId - User ID
   * @param {string} options.noteId - Note ID
   * @param {string} options.mimeType - MIME type
   * @param {Object} [options.metadata={}] - Additional metadata
   * @returns {Promise<Object>} Upload and processing result
   */
  async uploadAndProcessDocument(options) {
    const {
      fileData,
      originalFilename,
      userId,
      noteId,
      mimeType,
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
    validateMimeType(mimeType, 'DOCUMENT');

    // Determine file type from MIME type and extension
    const fileType = this._determineFileType(originalFilename, mimeType);

    try {
      // Step 1: Upload document to S3
      // Requirement 3.1: Save document to object storage
      const uploadResult = await uploadFileWithRetry({
        fileData,
        originalFilename,
        userId,
        mimeType,
        metadata: {
          ...metadata,
          noteId,
          type: 'DOCUMENT',
          fileType
        },
        prefix: 'documents'
      });

      // Step 2: Create attachment record in database
      const attachment = await createAttachment({
        noteId,
        type: 'DOCUMENT',
        storageKey: uploadResult.key,
        url: uploadResult.url,
        size: uploadResult.size,
        mimeType
      });

      // Step 3: Process document with existing pipeline
      // Requirement 3.2: Use existing document processing pipeline
      let processingResult;
      try {
        processingResult = await this.processDocument({
          attachmentId: attachment.id,
          fileData,
          originalFilename,
          fileType
        });
      } catch (processingError) {
        console.error('[DocumentProcessingService] Processing failed:', processingError.message);
        // Continue without processing - attachment is already saved
        processingResult = {
          textContent: null,
          structuredData: null,
          error: processingError.message
        };
      }

      // Step 4: Store processing results in database
      // Requirement 3.3: Store parsed content as structured data
      const analysis = await upsertAttachmentAnalysis({
        attachmentId: attachment.id,
        textContent: processingResult.textContent || null,
        description: processingResult.description || null,
        tags: processingResult.tags || [],
        metadata: {
          fileType,
          structuredData: processingResult.structuredData || null,
          ckbCount: processingResult.ckbCount || 0,
          coverageRate: processingResult.coverageRate || null,
          qualityScore: processingResult.qualityScore || null,
          processedAt: new Date().toISOString(),
          ...(processingResult.error && { error: processingResult.error })
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
          createdAt: attachment.createdAt
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
      throw new Error(`Failed to upload and process document: ${error.message}`);
    }
  }

  /**
   * Process an already uploaded document
   * Requirement 3.2: Use existing document processing pipeline
   * 
   * @param {Object} options - Processing options
   * @param {string} options.attachmentId - Attachment ID
   * @param {Buffer} options.fileData - File data
   * @param {string} options.originalFilename - Original filename
   * @param {string} options.fileType - File type (word, pdf, excel, markdown)
   * @returns {Promise<Object>} Processing result
   */
  async processDocument(options) {
    const { attachmentId, fileData, originalFilename, fileType } = options;

    if (!attachmentId || !fileData || !originalFilename || !fileType) {
      throw new Error('attachmentId, fileData, originalFilename, and fileType are required');
    }

    // Create temporary file for processing
    const tempFilePath = path.join(this.config.tempDir, `${attachmentId}_${originalFilename}`);
    
    try {
      // Write file data to temporary file
      await fs.writeFile(tempFilePath, fileData);

      // Process document with existing pipeline when available
      if (typeof processDocumentWithFullProcessing === 'function') {
        const result = await processDocumentWithFullProcessing(
          attachmentId,
          tempFilePath,
          fileType
        );

        // Extract relevant information from processing result
        const textContent = this._extractTextContent(result.ckbs);
        const structuredData = this._extractStructuredData(result);
        const tags = this._extractTags(result.ckbs);

        return {
          textContent,
          description: `Processed ${fileType} document with ${result.ckbs.length} content blocks`,
          tags,
          structuredData,
          ckbCount: result.ckbs.length,
          coverageRate: result.validation_result?.coverage_rate || null,
          qualityScore: result.report?.summary?.quality_score || null
        };
      }

      // Fallback parser: keep upload usable for Word/PDF even without KG pipeline.
      const fallbackText = await this._extractTextByFileType(fileData, fileType);
      const safeText = (fallbackText || '').trim();

      return {
        textContent: safeText || null,
        description: safeText
          ? `Processed ${fileType} document with fallback parser`
          : `Uploaded ${fileType} document (no parsable text extracted)`,
        tags: safeText ? [fileType, 'document'] : [fileType],
        structuredData: {
          parser: 'fallback',
          filename: originalFilename
        },
        ckbCount: safeText ? 1 : 0,
        coverageRate: null,
        qualityScore: null
      };
    } catch (error) {
      throw new Error(`Failed to process document: ${error.message}`);
    } finally {
      // Clean up temporary file
      try {
        await fs.unlink(tempFilePath);
      } catch (unlinkError) {
        console.error('[DocumentProcessingService] Failed to delete temp file:', unlinkError.message);
      }
    }
  }

  async _extractTextByFileType(fileData, fileType) {
    switch (fileType) {
      case 'pdf':
        return this._extractPdfText(fileData);
      case 'word':
        return this._extractWordText(fileData);
      case 'markdown':
      case 'excel':
      default:
        return fileData.toString('utf8');
    }
  }

  async _extractPdfText(fileData) {
    try {
      const pdfParse = require('pdf-parse');
      const result = await pdfParse(fileData);
      return result?.text || '';
    } catch (error) {
      console.warn('[DocumentProcessingService] pdf fallback parse failed:', error.message);
      return '';
    }
  }

  async _extractWordText(fileData) {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: fileData });
      return result?.value || '';
    } catch (error) {
      // .doc or damaged .docx may fail in mammoth; keep upload success.
      console.warn('[DocumentProcessingService] word fallback parse failed:', error.message);
      return '';
    }
  }

  /**
   * Re-process an existing attachment
   * 
   * @param {string} attachmentId - Attachment ID
   * @returns {Promise<Object>} Updated analysis
   */
  async reprocessAttachment(attachmentId) {
    if (!attachmentId) {
      throw new Error('attachmentId is required');
    }

    // Get attachment
    const attachment = await getAttachmentById(attachmentId);
    if (!attachment) {
      throw new Error('Attachment not found');
    }

    if (attachment.type !== 'DOCUMENT') {
      throw new Error('Only DOCUMENT attachments can be processed');
    }

    // Download file data (would need to implement downloadFile in s3Client)
    // For now, throw error indicating this needs implementation
    throw new Error('Re-processing requires downloading file from S3 - not yet implemented');
  }

  /**
   * Determine file type from filename and MIME type
   * @private
   * @param {string} filename - Filename
   * @param {string} mimeType - MIME type
   * @returns {string} File type for document processor
   */
  _determineFileType(filename, mimeType) {
    const ext = path.extname(filename).toLowerCase();
    
    // Word documents
    if (mimeType.includes('wordprocessingml') || 
        ext === '.docx' || ext === '.doc') {
      return 'word';
    }
    
    // PDF documents
    if (mimeType === 'application/pdf' || ext === '.pdf') {
      return 'pdf';
    }
    
    // Excel documents (treated as tables, but can be documents too)
    if (mimeType.includes('spreadsheetml') || 
        ext === '.xlsx' || ext === '.xls') {
      return 'excel';
    }
    
    // Markdown
    if (mimeType === 'text/markdown' || 
        ext === '.md' || ext === '.markdown') {
      return 'markdown';
    }
    
    // Default to word for text-based documents
    if (mimeType.startsWith('text/')) {
      return 'word';
    }
    
    throw new Error(`Unsupported document type: ${mimeType}`);
  }

  /**
   * Extract text content from CKBs
   * @private
   * @param {Array} ckbs - Array of CKBs
   * @returns {string} Combined text content
   */
  _extractTextContent(ckbs) {
    if (!Array.isArray(ckbs) || ckbs.length === 0) {
      return null;
    }

    // Combine text from all CKBs
    const textParts = ckbs
      .map(ckb => ckb.text || ckb.content || '')
      .filter(text => text.trim().length > 0);

    return textParts.join('\n\n');
  }

  /**
   * Extract structured data from processing result
   * @private
   * @param {Object} result - Processing result
   * @returns {Object} Structured data
   */
  _extractStructuredData(result) {
    return {
      ckbs: result.ckbs.map(ckb => ({
        id: ckb.id,
        text: ckb.text || ckb.content,
        type: ckb.type,
        metadata: ckb.metadata
      })),
      validation: {
        coverageRate: result.validation_result?.coverage_rate,
        isComplete: result.validation_result?.is_complete,
        missingUnits: result.validation_result?.missing_units?.length || 0
      },
      quality: {
        score: result.report?.summary?.quality_score,
        recommendations: result.report?.summary?.recommendations || []
      }
    };
  }

  /**
   * Extract tags from CKBs
   * @private
   * @param {Array} ckbs - Array of CKBs
   * @returns {Array<string>} Extracted tags
   */
  _extractTags(ckbs) {
    if (!Array.isArray(ckbs) || ckbs.length === 0) {
      return [];
    }

    const tags = new Set();
    
    // Extract tags from CKB metadata
    ckbs.forEach(ckb => {
      if (ckb.metadata?.tags && Array.isArray(ckb.metadata.tags)) {
        ckb.metadata.tags.forEach(tag => tags.add(tag));
      }
      
      // Add document type as tag
      if (ckb.type) {
        tags.add(ckb.type);
      }
    });

    return Array.from(tags).slice(0, 10); // Limit to 10 tags
  }
}

/**
 * Create document processing service instance
 * @param {Object} config - Service configuration
 * @returns {DocumentProcessingService}
 */
function createDocumentProcessingService(config = {}) {
  return new DocumentProcessingService(config);
}

// Export singleton instance
const defaultService = createDocumentProcessingService();

module.exports = {
  DocumentProcessingService,
  createDocumentProcessingService,
  // Export default instance
  uploadAndProcessDocument: defaultService.uploadAndProcessDocument.bind(defaultService),
  processDocument: defaultService.processDocument.bind(defaultService),
  reprocessAttachment: defaultService.reprocessAttachment.bind(defaultService)
};
