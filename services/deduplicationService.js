const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const unlink = promisify(fs.unlink);

/**
 * DeduplicationService - 负责检测重复文件并管理重复处理逻辑
 * 
 * 检测基于内容 hash 和文件名的重复
 * 提供三种重复处理策略：replace（覆盖）、keep-both（保留两者）、cancel（取消）
 */
class DeduplicationService {
  constructor(documentStorageService) {
    this.storageService = documentStorageService;
  }

  /**
   * 检查文件是否重复
   * 
   * @param {string} hash - 文件内容 hash
   * @param {string} filename - 原始文件名
   * @param {number} userId - 用户ID
   * @returns {Promise<DuplicateCheckResult>} - 重复检测结果
   * 
   * @typedef {Object} DuplicateCheckResult
   * @property {boolean} isDuplicate - 是否存在重复
   * @property {'none'|'content'|'filename'|'both'} duplicateType - 重复类型
   * @property {Object} [existingFile] - 现有文件信息（如果存在重复）
   * @property {string} existingFile.id - 文件ID
   * @property {string} existingFile.title - 文件标题
   * @property {number} existingFile.size - 文件大小
   * @property {string} existingFile.uploadDate - 上传日期
   * @property {string} existingFile.hash - 文件hash
   */
  async checkDuplicate(hash, filename, userId) {
    try {
      // 并行查询内容重复和文件名重复
      const [contentDuplicates, filenameDuplicates] = await Promise.all([
        hash ? this.storageService.findByHash(hash, userId) : Promise.resolve([]),
        filename ? this.storageService.findByFilename(filename, userId) : Promise.resolve([])
      ]);

      // 判断重复类型
      const hasContentDuplicate = contentDuplicates.length > 0;
      const hasFilenameDuplicate = filenameDuplicates.length > 0;

      if (!hasContentDuplicate && !hasFilenameDuplicate) {
        return {
          isDuplicate: false,
          duplicateType: 'none'
        };
      }

      // 确定重复类型和返回哪个现有文件
      let duplicateType;
      let existingFile;

      if (hasContentDuplicate && hasFilenameDuplicate) {
        // 检查是否是同一个文件（完全重复）
        const contentIds = new Set(contentDuplicates.map(d => d.id));
        const isCompleteDuplicate = filenameDuplicates.some(d => contentIds.has(d.id));
        
        duplicateType = isCompleteDuplicate ? 'both' : 'content';
        existingFile = contentDuplicates[0]; // 优先显示内容重复的文件
      } else if (hasContentDuplicate) {
        duplicateType = 'content';
        existingFile = contentDuplicates[0];
      } else {
        duplicateType = 'filename';
        existingFile = filenameDuplicates[0];
      }

      return {
        isDuplicate: true,
        duplicateType,
        existingFile: {
          id: existingFile.id,
          title: existingFile.title,
          size: existingFile.size,
          uploadDate: existingFile.createdAt || existingFile.updatedAt,
          hash: existingFile.hash
        }
      };

    } catch (error) {
      console.error('[DeduplicationService] Error checking duplicate:', error.message);
      // 发生错误时，返回无重复以允许上传继续
      return {
        isDuplicate: false,
        duplicateType: 'none'
      };
    }
  }

  /**
   * 处理用户的重复解决选择
   * 
   * @param {string} action - 用户选择的动作：'replace' | 'keep-both' | 'cancel'
   * @param {Object} newFile - 新文件数据
   * @param {string} newFile.tempFilePath - 临时文件路径
   * @param {Object} newFile.metadata - 文件元数据
   * @param {string} [existingFileId] - 现有文件ID（replace 动作需要）
   * @returns {Promise<Object|null>} - 保存的文档对象，cancel 时返回 null
   */
  async handleDuplicateAction(action, newFile, existingFileId) {
    try {
      switch (action) {
        case 'replace':
          return await this._handleReplace(newFile, existingFileId);
        
        case 'keep-both':
          return await this._handleKeepBoth(newFile);
        
        case 'cancel':
          return await this._handleCancel(newFile);
        
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error('[DeduplicationService] Error handling duplicate action:', error.message);
      // 清理临时文件
      if (newFile.tempFilePath) {
        await this._cleanupTempFile(newFile.tempFilePath);
      }
      throw error;
    }
  }

  /**
   * 处理 'replace' 动作：删除旧文件，保存新文件
   * 
   * @private
   * @param {Object} newFile - 新文件数据
   * @param {string} existingFileId - 现有文件ID
   * @returns {Promise<Object>} - 更新后的文档对象
   */
  async _handleReplace(newFile, existingFileId) {
    if (!existingFileId) {
      throw new Error('existingFileId is required for replace action');
    }

    // 使用 updateDocument 方法，它会自动处理旧文件的删除
    const document = await this.storageService.updateDocument(
      existingFileId,
      newFile.metadata,
      newFile.tempFilePath
    );

    return document;
  }

  /**
   * 处理 'keep-both' 动作：生成唯一文件名并保存新文件
   * 
   * @private
   * @param {Object} newFile - 新文件数据
   * @returns {Promise<Object>} - 保存的文档对象
   */
  async _handleKeepBoth(newFile) {
    // 生成唯一文件名（添加时间戳）
    const uniqueFilename = this._generateUniqueFilename(
      newFile.metadata.title,
      newFile.metadata.fileType
    );

    // 更新元数据中的文件名
    const updatedMetadata = {
      ...newFile.metadata,
      title: uniqueFilename
    };

    // 保存为新文档
    const document = await this.storageService.saveDocument(
      updatedMetadata,
      newFile.tempFilePath
    );

    return document;
  }

  /**
   * 处理 'cancel' 动作：删除临时文件
   * 
   * @private
   * @param {Object} newFile - 新文件数据
   * @returns {Promise<null>}
   */
  async _handleCancel(newFile) {
    // 删除临时文件
    await this._cleanupTempFile(newFile.tempFilePath);
    return null;
  }

  /**
   * 生成唯一文件名（添加时间戳）
   * 
   * @private
   * @param {string} originalTitle - 原始文件名（不含扩展名）
   * @param {string} fileType - 文件扩展名（如 '.pdf'）
   * @returns {string} - 唯一文件名（不含扩展名）
   */
  _generateUniqueFilename(originalTitle, fileType) {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    
    // 移除原始标题中的扩展名（如果有）
    const titleWithoutExt = originalTitle.replace(new RegExp(`${fileType}$`), '');
    
    // 生成格式：原始名称_时间戳_随机后缀
    return `${titleWithoutExt}_${timestamp}_${randomSuffix}`;
  }

  /**
   * 清理临时文件
   * 
   * @private
   * @param {string} tempFilePath - 临时文件路径
   * @returns {Promise<void>}
   */
  async _cleanupTempFile(tempFilePath) {
    if (!tempFilePath) {
      return;
    }

    try {
      await unlink(tempFilePath);
      console.log(`[DeduplicationService] Cleaned up temp file: ${tempFilePath}`);
    } catch (error) {
      // 文件可能已经不存在，只记录警告
      console.warn(`[DeduplicationService] Warning: Failed to cleanup temp file ${tempFilePath}:`, error.message);
    }
  }
}

module.exports = DeduplicationService;
