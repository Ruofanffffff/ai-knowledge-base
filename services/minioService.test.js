/**
 * MinioService 单元测试
 */

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('uuid', () => ({ v4: jest.fn(() => 'test-uuid-1234') }));

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Set env before requiring the module
process.env.MINIO_ENDPOINT = 'http://localhost:9000';
process.env.MINIO_ACCESS_KEY = 'testaccess';
process.env.MINIO_SECRET_KEY = 'testsecret';
process.env.MINIO_BUCKET = 'test-bucket';
process.env.MINIO_USE_SSL = 'false';

const { MinioService } = require('./minioService');

describe('MinioService', () => {
  let service;
  let mockSend;

  beforeEach(() => {
    mockSend = jest.fn();
    S3Client.mockImplementation(() => ({ send: mockSend }));
    service = new MinioService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize S3Client with forcePathStyle for MinIO', () => {
      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          forcePathStyle: true,
          endpoint: 'http://localhost:9000',
          credentials: {
            accessKeyId: 'testaccess',
            secretAccessKey: 'testsecret',
          },
        })
      );
    });

    it('should default bucket from env', () => {
      expect(service.defaultBucket).toBe('test-bucket');
    });
  });

  describe('ensureBucket', () => {
    it('should not create bucket if it already exists', async () => {
      mockSend.mockResolvedValueOnce({});
      await service.ensureBucket('my-bucket');
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(HeadBucketCommand).toHaveBeenCalledWith({ Bucket: 'my-bucket' });
    });

    it('should create bucket if not found', async () => {
      const notFoundError = new Error('Not Found');
      notFoundError.name = 'NotFound';
      mockSend.mockRejectedValueOnce(notFoundError).mockResolvedValueOnce({});

      await service.ensureBucket('new-bucket');
      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(CreateBucketCommand).toHaveBeenCalledWith({ Bucket: 'new-bucket' });
    });

    it('should create bucket on 404 status code', async () => {
      const error = new Error('Not Found');
      error.$metadata = { httpStatusCode: 404 };
      mockSend.mockRejectedValueOnce(error).mockResolvedValueOnce({});

      await service.ensureBucket('new-bucket');
      expect(CreateBucketCommand).toHaveBeenCalledWith({ Bucket: 'new-bucket' });
    });

    it('should throw on non-404 errors', async () => {
      const error = new Error('Connection refused');
      error.name = 'NetworkError';
      mockSend.mockRejectedValueOnce(error);

      await expect(service.ensureBucket('bucket')).rejects.toThrow('MinIO 存储服务不可用');
    });

    it('should throw if bucket creation fails', async () => {
      const notFoundError = new Error('Not Found');
      notFoundError.name = 'NotFound';
      mockSend
        .mockRejectedValueOnce(notFoundError)
        .mockRejectedValueOnce(new Error('Access Denied'));

      await expect(service.ensureBucket('bucket')).rejects.toThrow('无法创建存储桶');
    });

    it('should use default bucket when no name provided', async () => {
      mockSend.mockResolvedValueOnce({});
      await service.ensureBucket();
      expect(HeadBucketCommand).toHaveBeenCalledWith({ Bucket: 'test-bucket' });
    });
  });

  describe('uploadFile', () => {
    const mockFile = {
      buffer: Buffer.from('test image data'),
      originalname: 'photo.png',
      mimetype: 'image/png',
    };

    it('should upload file and return key and url', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await service.uploadFile(mockFile);
      expect(result.key).toBe('test-uuid-1234.png');
      expect(result.url).toBe('/api/images/proxy/test-uuid-1234.png');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'test-uuid-1234.png',
          Body: mockFile.buffer,
          ContentType: 'image/png',
        })
      );
    });

    it('should use custom bucket name', async () => {
      mockSend.mockResolvedValueOnce({});
      await service.uploadFile(mockFile, 'custom-bucket');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ Bucket: 'custom-bucket' })
      );
    });

    it('should handle files without extension', async () => {
      mockSend.mockResolvedValueOnce({});
      const file = { buffer: Buffer.from('data'), originalname: 'noext', mimetype: 'application/octet-stream' };
      const result = await service.uploadFile(file);
      expect(result.key).toBe('test-uuid-1234');
    });

    it('should throw on upload failure', async () => {
      mockSend.mockRejectedValueOnce(new Error('Upload failed'));
      await expect(service.uploadFile(mockFile)).rejects.toThrow('文件上传失败');
    });
  });

  describe('getPresignedUrl', () => {
    it('should return presigned URL', async () => {
      getSignedUrl.mockResolvedValueOnce('https://minio:9000/bucket/key?signed=true');

      const url = await service.getPresignedUrl('my-key.png');
      expect(url).toBe('https://minio:9000/bucket/key?signed=true');
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'my-key.png',
      });
    });

    it('should use custom bucket and expiry', async () => {
      getSignedUrl.mockResolvedValueOnce('https://signed-url');
      await service.getPresignedUrl('key', 'other-bucket', 7200);
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'other-bucket',
        Key: 'key',
      });
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 7200 }
      );
    });

    it('should throw on presign failure', async () => {
      getSignedUrl.mockRejectedValueOnce(new Error('Sign failed'));
      await expect(service.getPresignedUrl('key')).rejects.toThrow('无法生成预签名 URL');
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      mockSend.mockResolvedValueOnce({});
      await service.deleteFile('my-key.png');
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'my-key.png',
      });
    });

    it('should use custom bucket', async () => {
      mockSend.mockResolvedValueOnce({});
      await service.deleteFile('key', 'other-bucket');
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'other-bucket',
        Key: 'key',
      });
    });

    it('should throw on delete failure', async () => {
      mockSend.mockRejectedValueOnce(new Error('Delete failed'));
      await expect(service.deleteFile('key')).rejects.toThrow('文件删除失败');
    });
  });

  describe('getFile', () => {
    it('should return file body and content type', async () => {
      const mockBody = Buffer.from('file content');
      mockSend.mockResolvedValueOnce({
        Body: mockBody,
        ContentType: 'image/jpeg',
      });

      const result = await service.getFile('photo.jpg');
      expect(result.body).toBe(mockBody);
      expect(result.contentType).toBe('image/jpeg');
    });

    it('should default content type to octet-stream', async () => {
      mockSend.mockResolvedValueOnce({ Body: Buffer.from('data') });
      const result = await service.getFile('file');
      expect(result.contentType).toBe('application/octet-stream');
    });

    it('should throw on get failure', async () => {
      mockSend.mockRejectedValueOnce(new Error('Not found'));
      await expect(service.getFile('key')).rejects.toThrow('文件获取失败');
    });
  });
});
