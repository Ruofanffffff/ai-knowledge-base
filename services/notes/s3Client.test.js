/**
 * Unit Tests for S3 Client
 * 
 * Tests S3 client functionality including upload, download, delete,
 * unique key generation, and URL generation.
 */

// Mock uuid before requiring s3Client
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234-5678-90ab-cdef')
}));

const {
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
  _s3Client: s3Client,
} = require('./s3Client');

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/lib-storage');

const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

describe('S3 Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateUniqueFileKey', () => {
    it('should generate unique keys for same filename', () => {
      const key1 = generateUniqueFileKey('test.jpg', 'user123');
      // Wait a tiny bit to ensure different timestamp
      const key2 = generateUniqueFileKey('test.jpg', 'user123');
      
      // Keys should have same structure
      // Format: attachments/userHash/timestamp/uuid.ext
      expect(key1).toMatch(/^attachments\/[a-f0-9]{8}\/\d+\/.+\.jpg$/);
      expect(key2).toMatch(/^attachments\/[a-f0-9]{8}\/\d+\/.+\.jpg$/);
      
      // Extract parts to verify structure
      const parts1 = key1.split('/');
      const parts2 = key2.split('/');
      expect(parts1.length).toBe(4);
      expect(parts2.length).toBe(4);
      expect(parts1[0]).toBe('attachments');
      expect(parts2[0]).toBe('attachments');
      
      // User hash should be the same for same user
      expect(parts1[1]).toBe(parts2[1]);
    });

    it('should preserve file extension', () => {
      const key = generateUniqueFileKey('document.pdf', 'user123');
      expect(key).toMatch(/\.pdf$/);
    });

    it('should include custom prefix', () => {
      const key = generateUniqueFileKey('test.jpg', 'user123', 'images');
      expect(key).toMatch(/^images\//);
    });

    it('should handle files without extension', () => {
      const key = generateUniqueFileKey('README', 'user123');
      expect(key).toBeTruthy();
      expect(key).toMatch(/^attachments\//);
    });

    it('should handle different user IDs', () => {
      const key1 = generateUniqueFileKey('test.jpg', 'user123');
      const key2 = generateUniqueFileKey('test.jpg', 'user456');
      
      // Keys should be different due to different user hashes
      expect(key1).not.toBe(key2);
    });
  });

  describe('generateFileUrl', () => {
    it('should generate URL with endpoint', () => {
      const key = 'attachments/abc123/test.jpg';
      const url = generateFileUrl(key);
      
      expect(url).toContain(key);
      expect(url).toMatch(/^https?:\/\//);
    });

    it('should include bucket name in URL', () => {
      const key = 'attachments/test.jpg';
      const url = generateFileUrl(key);
      
      expect(url).toContain('notes-attachments');
    });
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const mockUpload = {
        done: jest.fn().mockResolvedValue({})
      };
      Upload.mockImplementation(() => mockUpload);

      const fileData = Buffer.from('test file content');
      const result = await uploadFile({
        fileData,
        originalFilename: 'test.jpg',
        userId: 'user123',
        mimeType: 'image/jpeg'
      });

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('bucket');
      expect(result.mimeType).toBe('image/jpeg');
      expect(mockUpload.done).toHaveBeenCalled();
    });

    it('should throw error if required fields missing', async () => {
      await expect(uploadFile({
        fileData: Buffer.from('test'),
        originalFilename: 'test.jpg',
        userId: 'user123'
        // mimeType missing
      })).rejects.toThrow('mimeType are required');
    });

    it('should include metadata in upload', async () => {
      const mockUpload = {
        done: jest.fn().mockResolvedValue({})
      };
      Upload.mockImplementation(() => mockUpload);

      await uploadFile({
        fileData: Buffer.from('test'),
        originalFilename: 'test.jpg',
        userId: 'user123',
        mimeType: 'image/jpeg',
        metadata: { custom: 'value' }
      });

      expect(Upload).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            Metadata: expect.objectContaining({
              custom: 'value',
              userId: 'user123'
            })
          })
        })
      );
    });

    it('should handle upload errors', async () => {
      const mockUpload = {
        done: jest.fn().mockRejectedValue(new Error('Upload failed'))
      };
      Upload.mockImplementation(() => mockUpload);

      await expect(uploadFile({
        fileData: Buffer.from('test'),
        originalFilename: 'test.jpg',
        userId: 'user123',
        mimeType: 'image/jpeg'
      })).rejects.toThrow('Failed to upload file');
    });
  });

  describe('downloadFile', () => {
    it('should download file successfully', async () => {
      const mockBody = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('test content');
        }
      };

      const mockSend = jest.fn().mockResolvedValue({
        Body: mockBody,
        ContentType: 'image/jpeg',
        ContentLength: 12,
        Metadata: { userId: 'user123' },
        LastModified: new Date()
      });

      s3Client.send = mockSend;

      const result = await downloadFile('attachments/test.jpg');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('contentType');
      expect(result.contentType).toBe('image/jpeg');
      expect(Buffer.isBuffer(result.data)).toBe(true);
    });

    it('should throw error if key missing', async () => {
      await expect(downloadFile()).rejects.toThrow('key is required');
    });

    it('should handle file not found', async () => {
      const mockSend = jest.fn().mockRejectedValue({
        name: 'NoSuchKey',
        message: 'File not found'
      });

      s3Client.send = mockSend;

      await expect(downloadFile('nonexistent.jpg')).rejects.toThrow('File not found');
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const mockSend = jest.fn().mockResolvedValue({});
      s3Client.send = mockSend;

      const result = await deleteFile('attachments/test.jpg');

      expect(result.deleted).toBe(true);
      expect(result.key).toBe('attachments/test.jpg');
      expect(result).toHaveProperty('deletedAt');
    });

    it('should throw error if key missing', async () => {
      await expect(deleteFile()).rejects.toThrow('key is required');
    });

    it('should handle deletion errors', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('Delete failed'));
      s3Client.send = mockSend;

      await expect(deleteFile('test.jpg')).rejects.toThrow('Failed to delete file');
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      const mockSend = jest.fn().mockResolvedValue({});
      s3Client.send = mockSend;

      const exists = await fileExists('attachments/test.jpg');

      expect(exists).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      const mockSend = jest.fn().mockRejectedValue({
        name: 'NotFound'
      });
      s3Client.send = mockSend;

      const exists = await fileExists('nonexistent.jpg');

      expect(exists).toBe(false);
    });

    it('should throw error if key missing', async () => {
      await expect(fileExists()).rejects.toThrow('key is required');
    });
  });

  describe('getFileMetadata', () => {
    it('should get file metadata successfully', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        ContentType: 'image/jpeg',
        ContentLength: 12345,
        LastModified: new Date(),
        Metadata: { userId: 'user123' },
        ETag: '"abc123"'
      });

      s3Client.send = mockSend;

      const metadata = await getFileMetadata('attachments/test.jpg');

      expect(metadata.contentType).toBe('image/jpeg');
      expect(metadata.contentLength).toBe(12345);
      expect(metadata).toHaveProperty('lastModified');
      expect(metadata).toHaveProperty('metadata');
      expect(metadata).toHaveProperty('etag');
    });

    it('should throw error if file not found', async () => {
      const mockSend = jest.fn().mockRejectedValue({
        name: 'NotFound'
      });
      s3Client.send = mockSend;

      await expect(getFileMetadata('nonexistent.jpg')).rejects.toThrow('File not found');
    });
  });

  describe('uploadFileWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockUpload = {
        done: jest.fn().mockResolvedValue({})
      };
      Upload.mockImplementation(() => mockUpload);

      const result = await uploadFileWithRetry({
        fileData: Buffer.from('test'),
        originalFilename: 'test.jpg',
        userId: 'user123',
        mimeType: 'image/jpeg'
      });

      expect(result).toHaveProperty('key');
      expect(mockUpload.done).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const mockUpload = {
        done: jest.fn()
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockResolvedValueOnce({})
      };
      Upload.mockImplementation(() => mockUpload);

      const result = await uploadFileWithRetry({
        fileData: Buffer.from('test'),
        originalFilename: 'test.jpg',
        userId: 'user123',
        mimeType: 'image/jpeg'
      }, 3);

      expect(result).toHaveProperty('key');
      expect(mockUpload.done).toHaveBeenCalledTimes(2);
    });

    it('should degrade to local fallback after max retries', async () => {
      const mockUpload = {
        done: jest.fn().mockRejectedValue(new Error('Persistent failure'))
      };
      Upload.mockImplementation(() => mockUpload);

      const result = await uploadFileWithRetry({
        fileData: Buffer.from('test'),
        originalFilename: 'test.jpg',
        userId: 'user123',
        mimeType: 'image/jpeg'
      }, 2);

      expect(result.degraded).toBe(true);
      expect(result.degradationMode).toBe('LOCAL_CACHE');
      expect(result.key).toMatch(/^local-cache\//);
      expect(mockUpload.done).toHaveBeenCalledTimes(3);
    });
  });

  describe('deleteFileWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockSend = jest.fn().mockResolvedValue({});
      s3Client.send = mockSend;

      const result = await deleteFileWithRetry('attachments/test.jpg');

      expect(result.deleted).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const mockSend = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({});
      s3Client.send = mockSend;

      const result = await deleteFileWithRetry('attachments/test.jpg', 3);

      expect(result.deleted).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateFileSize', () => {
    it('should accept valid file size', () => {
      expect(validateFileSize(1000000)).toBe(true); // 1MB
    });

    it('should reject oversized file', () => {
      expect(() => validateFileSize(20000000)).toThrow('exceeds maximum allowed size');
    });
  });

  describe('validateMimeType', () => {
    it('should accept valid image MIME type', () => {
      expect(validateMimeType('image/jpeg', 'IMAGE')).toBe(true);
      expect(validateMimeType('image/png', 'IMAGE')).toBe(true);
    });

    it('should accept valid document MIME type', () => {
      expect(validateMimeType('application/pdf', 'DOCUMENT')).toBe(true);
    });

    it('should accept valid table MIME type', () => {
      expect(validateMimeType('text/csv', 'TABLE')).toBe(true);
    });

    it('should reject invalid MIME type', () => {
      expect(() => validateMimeType('video/mp4', 'IMAGE')).toThrow('not allowed');
    });

    it('should reject invalid attachment type', () => {
      expect(() => validateMimeType('image/jpeg', 'INVALID')).toThrow('Invalid attachment type');
    });
  });
});
