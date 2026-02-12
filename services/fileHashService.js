const crypto = require('crypto');
const fs = require('fs');
const { promisify } = require('util');

const stat = promisify(fs.stat);

/**
 * FileHashService - 负责计算文件内容的 hash 值
 * 
 * 对于小文件（<= 10MB），直接读取整个文件计算 hash
 * 对于大文件（> 10MB），使用流式处理以优化内存使用
 */
class FileHashService {
  /**
   * 计算文件的 hash 值
   * 自动根据文件大小选择合适的方法（流式或非流式）
   * 
   * @param {string} filePath - 文件路径
   * @param {string} algorithm - Hash 算法 (默认: 'sha256')
   * @param {number} threshold - 使用流式处理的文件大小阈值（字节，默认: 10MB）
   * @returns {Promise<string|null>} - 小写十六进制 hash 字符串，失败时返回 null
   */
  async calculateHash(filePath, algorithm = 'sha256', threshold = 10 * 1024 * 1024) {
    try {
      // 检查文件是否存在并获取大小
      const stats = await stat(filePath);
      
      // 根据文件大小选择处理方法
      if (stats.size > threshold) {
        return await this.calculateHashStreaming(filePath, algorithm);
      }
      
      // 小文件：直接读取
      const fileBuffer = await promisify(fs.readFile)(filePath);
      const hash = crypto.createHash(algorithm);
      hash.update(fileBuffer);
      return hash.digest('hex').toLowerCase();
      
    } catch (error) {
      console.error(`[FileHashService] Error calculating hash for ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * 使用流式处理计算文件 hash（用于大文件）
   * 
   * @param {string} filePath - 文件路径
   * @param {string} algorithm - Hash 算法 (默认: 'sha256')
   * @returns {Promise<string|null>} - 小写十六进制 hash 字符串，失败时返回 null
   */
  async calculateHashStreaming(filePath, algorithm = 'sha256') {
    return new Promise((resolve) => {
      try {
        const hash = crypto.createHash(algorithm);
        const stream = fs.createReadStream(filePath, {
          highWaterMark: 64 * 1024 // 64KB chunks
        });

        stream.on('data', (chunk) => {
          hash.update(chunk);
        });

        stream.on('end', () => {
          resolve(hash.digest('hex').toLowerCase());
        });

        stream.on('error', (error) => {
          console.error(`[FileHashService] Error streaming hash for ${filePath}:`, error.message);
          resolve(null);
        });

      } catch (error) {
        console.error(`[FileHashService] Error creating stream for ${filePath}:`, error.message);
        resolve(null);
      }
    });
  }
}

module.exports = new FileHashService();
