/**
 * S3 Client Wrapper for Notes Feature
 * 
 * Provides S3-compatible object storage operations for note attachments.
 * Validates: Requirements 2.1, 3.1, 4.1, 12.2
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { v4: uuidv4 } = require('uuid');
const { notesConfig } = require('../../config/notes.config');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const LOCAL_FALLBACK_DIR = process.env.NOTES_STORAGE_FALLBACK_DIR
  || path.join(process.cwd(), '.cache', 'notes-storage');

function ensureFallbackDir() {
  if (!fs.existsSync(LOCAL_FALLBACK_DIR)) {
    fs.mkdirSync(LOCAL_FALLBACK_DIR, { recursive: true });
  }
}

function buildStorageError(message, options = {}) {
  const {
    code = 'STORAGE_OPERATION_FAILED',
    statusCode = 500,
    operation,
    retryable,
    attempt,
    maxAttempts,
    context = {},
    cause,
    retryErrors = []
  } = options;

  const error = new Error(message);
  error.name = 'StorageError';
  error.code = code;
  error.statusCode = statusCode;
  error.operation = operation;
  error.retryable = retryable;
  error.attempt = attempt;
  error.maxAttempts = maxAttempts;
  error.context = context;
  error.retryErrors = retryErrors.map(err => ({
    name: err?.name,
    message: err?.message,
    code: err?.code,
    statusCode: err?.statusCode || err?.$metadata?.httpStatusCode
  }));
  error.observedAt = new Date().toISOString();

  if (cause) {
    error.cause = cause;
    error.causeName = cause.name;
    error.causeCode = cause.code;
    error.causeStatusCode = cause.statusCode || cause.$metadata?.httpStatusCode;
  }

  return error;
}

function getErrorStatusCode(error) {
  return error?.statusCode
    || error?.$metadata?.httpStatusCode
    || error?.response?.status
    || undefined;
}

function isRetryableStorageError(error) {
  const statusCode = getErrorStatusCode(error);
  if ([400, 401, 403, 404, 405, 409, 422].includes(statusCode)) {
    return false;
  }

  const nonRetryableNames = new Set([
    'AccessDenied',
    'InvalidAccessKeyId',
    'SignatureDoesNotMatch',
    'NoSuchBucket',
    'NotFound'
  ]);
  if (nonRetryableNames.has(error?.name)) {
    return false;
  }

  if (/credentials|signature|access denied|no such bucket/i.test(error?.message || '')) {
    return false;
  }

  return true;
}

function sanitizeFilename(filename = '') {
  return path.basename(filename).replace(/[^\w.\-]/g, '_') || 'file.bin';
}

function extractFallbackId(key = '') {
  const parts = key.split('/');
  if (parts[0] !== 'local-cache' || parts.length < 2) {
    return null;
  }
  return parts[1] || null;
}

function buildFallbackPaths(fallbackId) {
  return {
    filePath: path.join(LOCAL_FALLBACK_DIR, `${fallbackId}.bin`),
    metaPath: path.join(LOCAL_FALLBACK_DIR, `${fallbackId}.meta.json`)
  };
}

function saveUploadToLocalFallback(options, sourceError, retryErrors = []) {
  const { fileData, originalFilename, userId, mimeType, prefix = 'attachments', metadata = {} } = options;
  ensureFallbackDir();

  const fallbackId = uuidv4();
  const safeFilename = sanitizeFilename(originalFilename);
  const { filePath, metaPath } = buildFallbackPaths(fallbackId);

  fs.writeFileSync(filePath, fileData);
  const fallbackMeta = {
    fallbackId,
    userId,
    mimeType,
    originalFilename: safeFilename,
    size: fileData.length || 0,
    createdAt: new Date().toISOString(),
    sourceError: {
      name: sourceError?.name,
      message: sourceError?.message,
      code: sourceError?.code,
      statusCode: getErrorStatusCode(sourceError)
    },
    retryErrors: retryErrors.map(err => ({
      name: err?.name,
      message: err?.message,
      code: err?.code,
      statusCode: getErrorStatusCode(err)
    })),
    metadata
  };
  fs.writeFileSync(metaPath, JSON.stringify(fallbackMeta, null, 2), 'utf8');

  return {
    key: `local-cache/${fallbackId}/${safeFilename}`,
    url: `local://notes-fallback/${fallbackId}/${encodeURIComponent(safeFilename)}`,
    bucket: notesConfig.storage.bucketName,
    size: fallbackMeta.size,
    mimeType,
    uploadedAt: fallbackMeta.createdAt,
    degraded: true,
    degradationMode: 'LOCAL_CACHE',
    fallbackId,
    fallbackPath: filePath
  };
}

/**
 * Initialize S3 client with configuration
 */
function createS3Client() {
  const config = {
    region: notesConfig.storage.region,
    credentials: {
      accessKeyId: notesConfig.storage.accessKeyId,
      secretAccessKey: notesConfig.storage.secretAccessKey,
    },
    forcePathStyle: notesConfig.storage.forcePathStyle,
  };

  // Add endpoint for MinIO or custom S3-compatible services
  if (notesConfig.storage.endpoint) {
    config.endpoint = notesConfig.storage.endpoint;
  }

  return new S3Client(config);
}

const s3Client = createS3Client();

/**
 * Generates a unique file key for S3 storage
 * Requirement 12.2: Use unique identifier to prevent conflicts
 * 
 * @param {string} originalFilename - Original filename
 * @param {string} userId - User ID
 * @param {string} [prefix='attachments'] - Optional prefix for organization
 * @returns {string} Unique storage key
 */
function generateUniqueFileKey(originalFilename, userId, prefix = 'attachments') {
  // Validate inputs
  if (!originalFilename || typeof originalFilename !== 'string') {
    throw new Error('originalFilename must be a non-empty string');
  }
  if (!userId || typeof userId !== 'string') {
    throw new Error('userId must be a non-empty string');
  }
  
  // Generate UUID for uniqueness
  const uuid = uuidv4();
  
  // Extract file extension BEFORE sanitization to preserve it
  let ext = path.extname(originalFilename).toLowerCase();
  // Ensure extension doesn't contain invalid characters
  if (ext && !/^\.[\w]+$/.test(ext)) {
    ext = '';
  }
  
  // Create timestamp for additional uniqueness and organization
  const timestamp = Date.now();
  
  // Hash user ID for privacy
  const userHash = crypto.createHash('md5').update(userId).digest('hex').substring(0, 8);
  
  // Construct key: prefix/userHash/timestamp/uuid.ext
  const key = `${prefix}/${userHash}/${timestamp}/${uuid}${ext}`;
  
  return key;
}

/**
 * Generates a public URL for a file
 * 
 * @param {string} key - S3 object key
 * @returns {string} Public URL
 */
function generateFileUrl(key) {
  const { endpoint, bucketName, useSSL } = notesConfig.storage;
  
  // For MinIO or custom endpoints
  if (endpoint) {
    const protocol = useSSL ? 'https' : 'http';
    // Remove protocol from endpoint if present
    const cleanEndpoint = endpoint.replace(/^https?:\/\//, '');
    return `${protocol}://${cleanEndpoint}/${bucketName}/${key}`;
  }
  
  // For AWS S3
  const region = notesConfig.storage.region;
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Uploads a file to S3
 * Requirement 2.1, 3.1, 4.1: Upload files to object storage
 * 
 * @param {Object} options - Upload options
 * @param {Buffer|Stream} options.fileData - File data (Buffer or Stream)
 * @param {string} options.originalFilename - Original filename
 * @param {string} options.userId - User ID
 * @param {string} options.mimeType - MIME type
 * @param {Object} [options.metadata={}] - Additional metadata
 * @param {string} [options.prefix='attachments'] - Storage prefix
 * @returns {Promise<Object>} Upload result with key and url
 */
async function uploadFile(options) {
  const { fileData, originalFilename, userId, mimeType, metadata = {}, prefix = 'attachments' } = options;

  if (!fileData || !originalFilename || !userId || !mimeType) {
    throw new Error('fileData, originalFilename, userId, and mimeType are required');
  }

  // Generate unique key
  const key = generateUniqueFileKey(originalFilename, userId, prefix);
  
  // Prepare upload parameters
  const uploadParams = {
    Bucket: notesConfig.storage.bucketName,
    Key: key,
    Body: fileData,
    ContentType: mimeType,
    Metadata: {
      userId,
      originalFilename,
      uploadedAt: new Date().toISOString(),
      ...metadata
    }
  };

  try {
    // Use Upload for better handling of large files and streams
    const upload = new Upload({
      client: s3Client,
      params: uploadParams,
    });

    // Execute upload
    await upload.done();

    // Generate public URL
    const url = generateFileUrl(key);

    return {
      key,
      url,
      bucket: notesConfig.storage.bucketName,
      size: fileData.length || 0,
      mimeType,
      uploadedAt: new Date().toISOString()
    };
  } catch (error) {
    throw buildStorageError(`Failed to upload file: ${error.message}`, {
      code: 'STORAGE_UPLOAD_FAILED',
      statusCode: getErrorStatusCode(error) || 502,
      operation: 'upload',
      retryable: isRetryableStorageError(error),
      cause: error,
      context: {
        bucket: notesConfig.storage.bucketName,
        originalFilename,
        mimeType,
        prefix
      }
    });
  }
}

/**
 * Downloads a file from S3
 * 
 * @param {string} key - S3 object key
 * @returns {Promise<Object>} File data and metadata
 */
async function downloadFile(key) {
  if (!key) {
    throw new Error('key is required');
  }

  try {
    if (key.startsWith('local-cache/')) {
      const fallbackId = extractFallbackId(key);
      if (!fallbackId) {
        throw buildStorageError(`Invalid local fallback key: ${key}`, {
          code: 'STORAGE_FALLBACK_KEY_INVALID',
          statusCode: 400,
          operation: 'download',
          retryable: false,
          context: { key }
        });
      }

      const { filePath, metaPath } = buildFallbackPaths(fallbackId);
      if (!fs.existsSync(filePath) || !fs.existsSync(metaPath)) {
        throw buildStorageError(`File not found: ${key}`, {
          code: 'STORAGE_FALLBACK_NOT_FOUND',
          statusCode: 404,
          operation: 'download',
          retryable: false,
          context: { key, fallbackId }
        });
      }

      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const data = fs.readFileSync(filePath);
      return {
        data,
        contentType: meta.mimeType || 'application/octet-stream',
        contentLength: meta.size || data.length,
        metadata: {
          source: 'local-fallback',
          fallbackId
        },
        lastModified: new Date(meta.createdAt || Date.now())
      };
    }

    const command = new GetObjectCommand({
      Bucket: notesConfig.storage.bucketName,
      Key: key,
    });

    const response = await s3Client.send(command);

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return {
      data: buffer,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      metadata: response.Metadata,
      lastModified: response.LastModified,
    };
  } catch (error) {
    if (error.name === 'NoSuchKey' || error.code === 'STORAGE_FALLBACK_NOT_FOUND') {
      throw new Error(`File not found: ${key}`);
    }
    throw new Error(`Failed to download file: ${error.message}`);
  }
}

/**
 * Deletes a file from S3
 * 
 * @param {string} key - S3 object key
 * @returns {Promise<Object>} Deletion result
 */
async function deleteFile(key) {
  if (!key) {
    throw new Error('key is required');
  }

  try {
    if (key.startsWith('local-cache/')) {
      const fallbackId = extractFallbackId(key);
      if (!fallbackId) {
        return {
          deleted: false,
          key,
          deletedAt: new Date().toISOString()
        };
      }
      const { filePath, metaPath } = buildFallbackPaths(fallbackId);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
      return {
        deleted: true,
        key,
        deletedAt: new Date().toISOString()
      };
    }

    const command = new DeleteObjectCommand({
      Bucket: notesConfig.storage.bucketName,
      Key: key,
    });

    await s3Client.send(command);

    return {
      deleted: true,
      key,
      deletedAt: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Checks if a file exists in S3
 * 
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(key) {
  if (!key) {
    throw new Error('key is required');
  }

  try {
    if (key.startsWith('local-cache/')) {
      const fallbackId = extractFallbackId(key);
      if (!fallbackId) return false;
      const { filePath, metaPath } = buildFallbackPaths(fallbackId);
      return fs.existsSync(filePath) && fs.existsSync(metaPath);
    }

    const command = new HeadObjectCommand({
      Bucket: notesConfig.storage.bucketName,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
      return false;
    }
    throw new Error(`Failed to check file existence: ${error.message}`);
  }
}

/**
 * Gets file metadata without downloading the file
 * 
 * @param {string} key - S3 object key
 * @returns {Promise<Object>} File metadata
 */
async function getFileMetadata(key) {
  if (!key) {
    throw new Error('key is required');
  }

  try {
    if (key.startsWith('local-cache/')) {
      const fallbackId = extractFallbackId(key);
      if (!fallbackId) {
        throw new Error(`File not found: ${key}`);
      }
      const { metaPath } = buildFallbackPaths(fallbackId);
      if (!fs.existsSync(metaPath)) {
        throw new Error(`File not found: ${key}`);
      }
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      return {
        contentType: meta.mimeType || 'application/octet-stream',
        contentLength: meta.size || 0,
        lastModified: new Date(meta.createdAt || Date.now()),
        metadata: {
          source: 'local-fallback',
          fallbackId,
          originalFilename: meta.originalFilename
        },
        etag: null
      };
    }

    const command = new HeadObjectCommand({
      Bucket: notesConfig.storage.bucketName,
      Key: key,
    });

    const response = await s3Client.send(command);

    return {
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
      metadata: response.Metadata,
      etag: response.ETag,
    };
  } catch (error) {
    if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
      throw new Error(`File not found: ${key}`);
    }
    throw new Error(`Failed to get file metadata: ${error.message}`);
  }
}

/**
 * Uploads a file with retry logic
 * Requirement 12.4: Retry operations up to 3 times
 * 
 * @param {Object} options - Upload options (same as uploadFile)
 * @param {number} [maxRetries=3] - Maximum number of retries
 * @returns {Promise<Object>} Upload result
 */
async function uploadFileWithRetry(options, maxRetries = notesConfig.retry.maxRetries) {
  let lastError;
  let delay = notesConfig.retry.initialDelay;
  const retryErrors = [];
  const maxAttempts = maxRetries + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await uploadFile(options);
    } catch (error) {
      lastError = error;
      retryErrors.push(error);
      const attemptNo = attempt + 1;
      const retryable = isRetryableStorageError(error);
      const isLastAttempt = attempt === maxAttempts - 1;

      console.warn('[S3UploadRetry] attempt failed', {
        operation: 'upload',
        attempt: attemptNo,
        maxAttempts,
        retryable,
        errorCode: error.code,
        statusCode: getErrorStatusCode(error),
        message: error.message
      });

      if (!retryable) {
        throw buildStorageError(
          `Failed to upload file: non-retryable error on attempt ${attemptNo} - ${error.message}`,
          {
            code: 'STORAGE_UPLOAD_NON_RETRYABLE',
            statusCode: getErrorStatusCode(error) || 502,
            operation: 'upload',
            retryable: false,
            attempt: attemptNo,
            maxAttempts,
            cause: error,
            retryErrors,
            context: {
              originalFilename: options?.originalFilename,
              mimeType: options?.mimeType,
              userId: options?.userId,
              prefix: options?.prefix || 'attachments'
            }
          }
        );
      }

      if (!isLastAttempt) {
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= notesConfig.retry.backoffMultiplier;
      }
    }
  }

  try {
    const fallbackResult = saveUploadToLocalFallback(options, lastError, retryErrors);
    console.warn('[S3UploadRetry] switched to local fallback', {
      operation: 'upload',
      fallbackId: fallbackResult.fallbackId,
      degradationMode: fallbackResult.degradationMode,
      attempts: maxAttempts,
      originalFilename: options?.originalFilename
    });
    return fallbackResult;
  } catch (fallbackError) {
    throw buildStorageError(
      `Failed to upload file after ${maxAttempts} attempts and local fallback failed: ${lastError?.message}`,
      {
        code: 'STORAGE_UPLOAD_RETRY_EXHAUSTED',
        statusCode: 503,
        operation: 'upload',
        retryable: false,
        attempt: maxAttempts,
        maxAttempts,
        cause: fallbackError,
        retryErrors,
        context: {
          originalFilename: options?.originalFilename,
          mimeType: options?.mimeType,
          userId: options?.userId,
          prefix: options?.prefix || 'attachments',
          fallbackError: fallbackError.message
        }
      }
    );
  }
}

/**
 * Deletes a file with retry logic
 * 
 * @param {string} key - S3 object key
 * @param {number} [maxRetries=3] - Maximum number of retries
 * @returns {Promise<Object>} Deletion result
 */
async function deleteFileWithRetry(key, maxRetries = notesConfig.retry.maxRetries) {
  let lastError;
  let delay = notesConfig.retry.initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await deleteFile(key);
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= notesConfig.retry.backoffMultiplier;
      }
    }
  }

  throw new Error(`Failed to delete file after ${maxRetries + 1} attempts: ${lastError.message}`);
}

/**
 * Validates file size against configuration limits
 * 
 * @param {number} fileSize - File size in bytes
 * @returns {boolean} True if valid
 * @throws {Error} If file size exceeds limit
 */
function validateFileSize(fileSize) {
  const maxSize = notesConfig.attachments.maxSize;
  
  if (fileSize > maxSize) {
    throw new Error(`File size ${fileSize} bytes exceeds maximum allowed size of ${maxSize} bytes`);
  }
  
  return true;
}

/**
 * Validates MIME type against allowed types
 * 
 * @param {string} mimeType - MIME type to validate
 * @param {string} attachmentType - Attachment type (IMAGE, DOCUMENT, TABLE)
 * @returns {boolean} True if valid
 * @throws {Error} If MIME type not allowed
 */
function validateMimeType(mimeType, attachmentType) {
  let allowedTypes;
  
  switch (attachmentType) {
    case 'IMAGE':
      allowedTypes = notesConfig.attachments.allowedImageTypes;
      break;
    case 'DOCUMENT':
      allowedTypes = notesConfig.attachments.allowedDocumentTypes;
      break;
    case 'TABLE':
      allowedTypes = notesConfig.attachments.allowedTableTypes;
      break;
    default:
      throw new Error(`Invalid attachment type: ${attachmentType}`);
  }
  
  if (!allowedTypes.includes(mimeType)) {
    throw new Error(`MIME type ${mimeType} not allowed for ${attachmentType} attachments`);
  }
  
  return true;
}

module.exports = {
  uploadFile,
  downloadFile,
  deleteFile,
  fileExists,
  getFileMetadata,
  uploadFileWithRetry,
  deleteFileWithRetry,
  generateUniqueFileKey,
  generateFileUrl,
  validateFileSize,
  validateMimeType,
  // Export for testing
  _s3Client: s3Client,
  _createS3Client: createS3Client,
};
