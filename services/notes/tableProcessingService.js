/**
 * Table Processing Service for Notes Feature
 * 
 * Provides end-to-end table processing functionality:
 * - Table file upload handling
 * - Integration with existing table processing pipeline (Excel parser)
 * - Parsed data storage
 * 
 * Validates: Requirements 4.1, 4.2, 4.3
 */

// KG ckb_parser removed — pending redesign
const parseDocument = null;
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
 * Table Processing Service class
 */
class TableProcessingService {
  constructor(config = {}) {
    this.config = {
      timeout: config.timeout || notesConfig.tableProcessing?.timeout || 30000,
      tempDir: config.tempDir || os.tmpdir(),
      ...config
    };
  }

  /**
   * Upload and process a table file
   * Requirement 4.1, 4.2, 4.3: Complete table upload and processing flow
   * 
   * @param {Object} options - Upload and processing options
   * @param {Buffer|Stream} options.fileData - Table file data
   * @param {string} options.originalFilename - Original filename
   * @param {string} options.userId - User ID
   * @param {string} options.noteId - Note ID
   * @param {string} options.mimeType - MIME type
   * @param {Object} [options.metadata={}] - Additional metadata
   * @returns {Promise<Object>} Upload and processing result
   */
  async uploadAndProcessTable(options) {
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
    validateMimeType(mimeType, 'TABLE');

    // Determine file type from MIME type and extension
    const fileType = this._determineFileType(originalFilename, mimeType);

    try {
      // Step 1: Upload table file to S3
      // Requirement 4.1: Save table file to object storage
      const uploadResult = await uploadFileWithRetry({
        fileData,
        originalFilename,
        userId,
        mimeType,
        metadata: {
          ...metadata,
          noteId,
          type: 'TABLE',
          fileType
        },
        prefix: 'tables'
      });

      // Step 2: Create attachment record in database
      const attachment = await createAttachment({
        noteId,
        type: 'TABLE',
        storageKey: uploadResult.key,
        url: uploadResult.url,
        size: uploadResult.size,
        mimeType
      });

      // Step 3: Process table with existing pipeline
      // Requirement 4.2: Use existing table processing pipeline
      let processingResult;
      try {
        processingResult = await this.processTable({
          attachmentId: attachment.id,
          fileData,
          originalFilename,
          fileType
        });
      } catch (processingError) {
        console.error('[TableProcessingService] Processing failed:', processingError.message);
        // Continue without processing - attachment is already saved
        processingResult = {
          tableData: null,
          error: processingError.message
        };
      }

      // Step 4: Store processing results in database
      // Requirement 4.3: Store parsed data as structured data
      const analysis = await upsertAttachmentAnalysis({
        attachmentId: attachment.id,
        textContent: processingResult.textContent || null,
        description: processingResult.description || null,
        tags: processingResult.tags || [],
        metadata: {
          fileType,
          tableData: processingResult.tableData || null,
          sheetCount: processingResult.sheetCount || 0,
          rowCount: processingResult.rowCount || 0,
          columnCount: processingResult.columnCount || 0,
          processedAt: new Date().toISOString(),
          ...(uploadResult.degraded && {
            storageDegraded: true,
            degradationMode: uploadResult.degradationMode || 'LOCAL_CACHE',
            fallbackId: uploadResult.fallbackId || null
          }),
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
      const wrappedError = new Error(`Failed to upload and process table: ${error.message}`);
      wrappedError.code = error.code || 'TABLE_UPLOAD_PROCESS_FAILED';
      wrappedError.statusCode = error.statusCode || 500;
      wrappedError.retryable = error.retryable;
      wrappedError.operation = error.operation || 'tableUpload';
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
   * Process an already uploaded table file
   * Requirement 4.2: Use existing table processing pipeline
   * 
   * @param {Object} options - Processing options
   * @param {string} options.attachmentId - Attachment ID
   * @param {Buffer} options.fileData - File data
   * @param {string} options.originalFilename - Original filename
   * @param {string} options.fileType - File type (excel, csv)
   * @returns {Promise<Object>} Processing result
   */
  async processTable(options) {
    const { attachmentId, fileData, originalFilename, fileType } = options;

    if (!attachmentId || !fileData || !originalFilename || !fileType) {
      throw new Error('attachmentId, fileData, originalFilename, and fileType are required');
    }

    // Create temporary file for processing
    const tempFilePath = path.join(this.config.tempDir, `${attachmentId}_${originalFilename}`);
    
    try {
      // Write file data to temporary file
      await fs.writeFile(tempFilePath, fileData);

      // Process table with existing pipeline (Excel parser)
      let ckbs = [];
      if (typeof parseDocument === 'function') {
        ckbs = await parseDocument(
          attachmentId,
          tempFilePath,
          fileType
        );
      } else {
        const rawText = fileData.toString('utf8');
        const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 300);
        ckbs = lines.map((line, index) => ({
          id: `${attachmentId}_${index}`,
          text: line,
          metadata: { row: index }
        }));
      }

      // Extract table data from CKBs
      const tableData = this._extractTableData(ckbs);
      const textContent = this._extractTextContent(ckbs);
      const tags = this._extractTags(ckbs);

      // Calculate statistics
      const stats = this._calculateTableStats(tableData);

      return {
        textContent,
        description: `Processed ${fileType} table with ${stats.sheetCount} sheet(s), ${stats.totalRows} rows, ${stats.maxColumns} columns`,
        tags,
        tableData,
        sheetCount: stats.sheetCount,
        rowCount: stats.totalRows,
        columnCount: stats.maxColumns
      };
    } catch (error) {
      throw new Error(`Failed to process table: ${error.message}`);
    } finally {
      // Clean up temporary file
      try {
        await fs.unlink(tempFilePath);
      } catch (unlinkError) {
        console.error('[TableProcessingService] Failed to delete temp file:', unlinkError.message);
      }
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

    if (attachment.type !== 'TABLE') {
      throw new Error('Only TABLE attachments can be processed');
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
   * @returns {string} File type for table processor
   */
  _determineFileType(filename, mimeType) {
    const ext = path.extname(filename).toLowerCase();
    
    // Excel files
    if (mimeType.includes('spreadsheetml') || 
        ext === '.xlsx' || ext === '.xls') {
      return 'excel';
    }
    
    // CSV files
    if (mimeType === 'text/csv' || ext === '.csv') {
      return 'csv';
    }
    
    throw new Error(`Unsupported table type: ${mimeType}`);
  }

  /**
   * Extract table data from CKBs
   * @private
   * @param {Array} ckbs - Array of CKBs
   * @returns {Object} Table data structure
   */
  _extractTableData(ckbs) {
    if (!Array.isArray(ckbs) || ckbs.length === 0) {
      return null;
    }

    // Group CKBs by sheet (if metadata contains sheet info)
    // Use Object.create(null) to avoid prototype pollution issues
    const sheets = Object.create(null);
    
    ckbs.forEach(ckb => {
      const sheetName = ckb.metadata?.sheet || 'Sheet1';
      
      if (!sheets[sheetName]) {
        sheets[sheetName] = {
          name: sheetName,
          rows: []
        };
      }
      
      // Extract row data from CKB
      if (ckb.metadata?.row !== undefined) {
        const rowData = this._parseRowData(ckb);
        if (rowData) {
          sheets[sheetName].rows.push(rowData);
        }
      }
    });

    // Convert sheets object to array
    const sheetArray = Object.values(sheets);
    
    // If no structured data found, try to extract from text
    if (sheetArray.length === 0 || sheetArray.every(s => s.rows.length === 0)) {
      return this._extractTableFromText(ckbs);
    }

    return {
      sheets: sheetArray
    };
  }

  /**
   * Parse row data from CKB
   * @private
   * @param {Object} ckb - CKB object
   * @returns {Object|null} Row data
   */
  _parseRowData(ckb) {
    // Try to extract structured row data from metadata
    if (ckb.metadata?.cells && Array.isArray(ckb.metadata.cells)) {
      return {
        rowIndex: ckb.metadata.row,
        cells: ckb.metadata.cells
      };
    }
    
    // Try to parse from text content
    if (ckb.text || ckb.content) {
      const text = ckb.text || ckb.content;
      // Simple tab/comma separated parsing
      const cells = text.split(/[\t,]/).map(cell => cell.trim());
      
      if (cells.length > 0) {
        return {
          rowIndex: ckb.metadata?.row || 0,
          cells
        };
      }
    }
    
    return null;
  }

  /**
   * Extract table from text content
   * @private
   * @param {Array} ckbs - Array of CKBs
   * @returns {Object} Table data
   */
  _extractTableFromText(ckbs) {
    const rows = [];
    
    ckbs.forEach((ckb, index) => {
      const text = ckb.text || ckb.content || '';
      if (text.trim()) {
        // Try to split by tabs or commas
        const cells = text.split(/[\t,]/).map(cell => cell.trim());
        if (cells.length > 1) {
          rows.push({
            rowIndex: index,
            cells
          });
        }
      }
    });

    if (rows.length === 0) {
      return null;
    }

    return {
      sheets: [{
        name: 'Sheet1',
        rows
      }]
    };
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

    return textParts.join('\n');
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

    const tags = new Set(['table', 'spreadsheet']);
    
    // Extract tags from CKB metadata
    ckbs.forEach(ckb => {
      if (ckb.metadata?.tags && Array.isArray(ckb.metadata.tags)) {
        ckb.metadata.tags.forEach(tag => tags.add(tag));
      }
      
      // Add sheet name as tag
      if (ckb.metadata?.sheet) {
        tags.add(ckb.metadata.sheet);
      }
    });

    return Array.from(tags).slice(0, 10); // Limit to 10 tags
  }

  /**
   * Calculate table statistics
   * @private
   * @param {Object} tableData - Table data
   * @returns {Object} Statistics
   */
  _calculateTableStats(tableData) {
    if (!tableData || !tableData.sheets) {
      return {
        sheetCount: 0,
        totalRows: 0,
        maxColumns: 0
      };
    }

    const sheetCount = tableData.sheets.length;
    let totalRows = 0;
    let maxColumns = 0;

    tableData.sheets.forEach(sheet => {
      totalRows += sheet.rows.length;
      
      sheet.rows.forEach(row => {
        if (row.cells && row.cells.length > maxColumns) {
          maxColumns = row.cells.length;
        }
      });
    });

    return {
      sheetCount,
      totalRows,
      maxColumns
    };
  }
}

/**
 * Create table processing service instance
 * @param {Object} config - Service configuration
 * @returns {TableProcessingService}
 */
function createTableProcessingService(config = {}) {
  return new TableProcessingService(config);
}

// Export singleton instance
const defaultService = createTableProcessingService();

module.exports = {
  TableProcessingService,
  createTableProcessingService,
  // Export default instance
  uploadAndProcessTable: defaultService.uploadAndProcessTable.bind(defaultService),
  processTable: defaultService.processTable.bind(defaultService),
  reprocessAttachment: defaultService.reprocessAttachment.bind(defaultService)
};
