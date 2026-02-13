/**
 * MinioService - S3 兼容对象存储服务
 * 
 * 使用 @aws-sdk/client-s3 与 MinIO 交互，提供文件上传、下载、删除和预签名 URL 功能。
 * 从 .env 读取配置，导出单例实例。
 */

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class MinioService {
  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
    const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
    const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin123';
    const useSSL = process.env.MINIO_USE_SSL === 'true';

    // Parse endpoint to extract protocol and host
    const url = new URL(endpoint);
    const protocol = useSSL ? 'https' : url.protocol.replace(':', '');

    this.client = new S3Client({
      endpoint: `${protocol}://${url.host}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true, // Required for MinIO compatibility
    });

    this.defaultBucket = process.env.MINIO_BUCKET || 'documents';
  }

  /**
   * 检查存储桶是否存在，不存在则创建
   * @param {string} [bucketName] - 存储桶名称，默认使用 MINIO_BUCKET
   */
  async ensureBucket(bucketName) {
    const bucket = bucketName || this.defaultBucket;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        try {
          await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
        } catch (createError) {
          throw new Error(`MinIO 存储服务不可用：无法创建存储桶 "${bucket}"。${createError.message}`);
        }
      } else {
        throw new Error(`MinIO 存储服务不可用：无法访问存储桶 "${bucket}"。${error.message}`);
      }
    }
  }

  /**
   * 上传文件到 MinIO
   * @param {Object} file - multer 文件对象，包含 buffer、originalname、mimetype
   * @param {string} [bucketName] - 存储桶名称
   * @returns {Promise<{key: string, url: string}>} 上传结果
   */
  async uploadFile(file, bucketName) {
    const bucket = bucketName || this.defaultBucket;
    const ext = path.extname(file.originalname) || '';
    const key = `${uuidv4()}${ext}`;

    try {
      await this.client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || 'application/octet-stream',
      }));

      const url = `/api/images/proxy/${key}`;
      return { key, url };
    } catch (error) {
      throw new Error(`MinIO 存储服务不可用：文件上传失败。${error.message}`);
    }
  }

  /**
   * 生成预签名 URL
   * @param {string} key - 对象键
   * @param {string} [bucketName] - 存储桶名称
   * @param {number} [expiresIn=3600] - URL 有效期（秒）
   * @returns {Promise<string>} 预签名 URL
   */
  async getPresignedUrl(key, bucketName, expiresIn = 3600) {
    const bucket = bucketName || this.defaultBucket;

    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      const url = await getSignedUrl(this.client, command, { expiresIn });
      return url;
    } catch (error) {
      throw new Error(`MinIO 存储服务不可用：无法生成预签名 URL。${error.message}`);
    }
  }

  /**
   * 删除文件
   * @param {string} key - 对象键
   * @param {string} [bucketName] - 存储桶名称
   */
  async deleteFile(key, bucketName) {
    const bucket = bucketName || this.defaultBucket;

    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }));
    } catch (error) {
      throw new Error(`MinIO 存储服务不可用：文件删除失败。${error.message}`);
    }
  }

  /**
   * 列出存储桶中所有对象（用于统计存储用量）
   * @param {string} [bucketName] - 存储桶名称
   * @returns {Promise<Array<{key: string, size: number}>>}
   */
  async listObjects(bucketName) {
    const bucket = bucketName || this.defaultBucket;
    const objects = [];
    let continuationToken;

    try {
      do {
        const response = await this.client.send(new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
        }));
        if (response.Contents) {
          for (const obj of response.Contents) {
            objects.push({ key: obj.Key, size: obj.Size || 0 });
          }
        }
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);

      return objects;
    } catch (error) {
      console.warn(`MinIO listObjects failed: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取文件内容（用于图片代理和 AI 识别）
   * @param {string} key - 对象键
   * @param {string} [bucketName] - 存储桶名称
   * @returns {Promise<{body: ReadableStream, contentType: string}>}
   */
  async getFile(key, bucketName) {
    const bucket = bucketName || this.defaultBucket;

    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }));
      return {
        body: response.Body,
        contentType: response.ContentType || 'application/octet-stream',
      };
    } catch (error) {
      throw new Error(`MinIO 存储服务不可用：文件获取失败。${error.message}`);
    }
  }
}

// 导出单例实例
const minioService = new MinioService();

module.exports = minioService;
module.exports.MinioService = MinioService;
