const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const rename = promisify(fs.rename);
const access = promisify(fs.access);

/**
 * DocumentStorageService - 负责文件和元数据的存储操作
 * 
 * 使用数据库事务确保原子性操作
 * 在提交前验证文件存在
 * 使用 prepared statements 防止 SQL 注入
 */
class DocumentStorageService {
  constructor(db) {
    this.db = db;
  }

  /**
   * 保存文档到数据库和文件系统
   * 
   * @param {Object} metadata - 文档元数据
   * @param {number} metadata.userId - 用户ID
   * @param {string} metadata.title - 文档标题
   * @param {string} metadata.content - 文档内容
   * @param {string} metadata.type - 文档类型
   * @param {string} metadata.fileType - 文件类型（扩展名）
   * @param {Object} metadata.metadata - 额外的元数据
   * @param {string} metadata.hash - 文件内容hash值
   * @param {number} metadata.size - 文件大小（字节）
   * @param {Array} [metadata.tags] - 标签数组
   * @param {string} tempFilePath - 临时文件路径
   * @returns {Promise<Object>} - 保存的文档元数据
   */
  async saveDocument(metadata, tempFilePath) {
    return new Promise(async (resolve, reject) => {
      try {
        // 验证临时文件存在
        await this._validateFileExists(tempFilePath);

        // 生成最终文件路径
        const finalFilePath = this._generateFilePath(metadata.userId, metadata.title, metadata.fileType);
        
        // 确保目标目录存在
        await this._ensureDirectoryExists(path.dirname(finalFilePath));

        // 开始数据库事务
        this.db.serialize(() => {
          this.db.run('BEGIN TRANSACTION', (err) => {
            if (err) {
              return reject(new Error(`Failed to begin transaction: ${err.message}`));
            }

            // 准备元数据字符串
            const metadataStr = metadata.metadata ? JSON.stringify(metadata.metadata) : null;
            const tagsStr = metadata.tags ? JSON.stringify(metadata.tags) : null;

            // 插入文档记录（使用 prepared statement）
            this.db.run(
              `INSERT INTO documents (user_id, title, content, type, file_type, metadata, tags, hash, size) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                metadata.userId,
                metadata.title,
                metadata.content || '',
                metadata.type || 'document',
                metadata.fileType,
                metadataStr,
                tagsStr,
                metadata.hash ? metadata.hash.toLowerCase() : null,
                metadata.size
              ],
              async function(err) {
                if (err) {
                  // 回滚事务
                  this.db.run('ROLLBACK', () => {
                    reject(new Error(`Failed to insert document: ${err.message}`));
                  });
                  return;
                }

                const documentId = this.lastID;

                try {
                  // 移动文件到最终位置
                  await rename(tempFilePath, finalFilePath);

                  // 提交事务
                  this.db.run('COMMIT', (err) => {
                    if (err) {
                      // 如果提交失败，尝试删除已移动的文件
                      unlink(finalFilePath).catch(() => {});
                      return reject(new Error(`Failed to commit transaction: ${err.message}`));
                    }

                    // 返回完整的文档对象
                    const document = {
                      id: documentId.toString(),
                      userId: metadata.userId,
                      title: metadata.title,
                      content: metadata.content || '',
                      type: metadata.type || 'document',
                      fileType: metadata.fileType,
                      metadata: metadata.metadata || {},
                      tags: metadata.tags || [],
                      hash: metadata.hash ? metadata.hash.toLowerCase() : null,
                      size: metadata.size,
                      filePath: finalFilePath,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };

                    resolve(document);
                  });

                } catch (fileError) {
                  // 文件移动失败，回滚事务
                  this.db.run('ROLLBACK', () => {
                    reject(new Error(`Failed to move file: ${fileError.message}`));
                  });
                }
              }.bind(this)
            );
          });
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 更新现有文档
   * 
   * @param {string} documentId - 文档ID
   * @param {Object} metadata - 更新的元数据
   * @param {string} tempFilePath - 新文件的临时路径
   * @returns {Promise<Object>} - 更新后的文档元数据
   */
  async updateDocument(documentId, metadata, tempFilePath) {
    return new Promise(async (resolve, reject) => {
      try {
        // 验证临时文件存在
        await this._validateFileExists(tempFilePath);

        // 首先获取现有文档信息
        this.db.get(
          'SELECT * FROM documents WHERE id = ? AND user_id = ?',
          [documentId, metadata.userId],
          async (err, existingDoc) => {
            if (err) {
              return reject(new Error(`Failed to fetch existing document: ${err.message}`));
            }

            if (!existingDoc) {
              return reject(new Error('Document not found'));
            }

            // 解析现有元数据以获取旧文件路径
            let oldFilePath = null;
            try {
              const oldMetadata = existingDoc.metadata ? JSON.parse(existingDoc.metadata) : {};
              oldFilePath = oldMetadata.filePath;
            } catch (e) {
              console.error('[DocumentStorageService] Error parsing old metadata:', e);
            }

            // 生成新文件路径
            const finalFilePath = this._generateFilePath(metadata.userId, metadata.title, metadata.fileType);
            
            // 确保目标目录存在
            await this._ensureDirectoryExists(path.dirname(finalFilePath));

            // 开始数据库事务
            this.db.serialize(() => {
              this.db.run('BEGIN TRANSACTION', (err) => {
                if (err) {
                  return reject(new Error(`Failed to begin transaction: ${err.message}`));
                }

                // 准备元数据字符串
                const metadataStr = metadata.metadata ? JSON.stringify(metadata.metadata) : null;
                const tagsStr = metadata.tags ? JSON.stringify(metadata.tags) : null;

                // 更新文档记录（使用 prepared statement）
                this.db.run(
                  `UPDATE documents 
                   SET title = ?, content = ?, type = ?, file_type = ?, metadata = ?, tags = ?, hash = ?, size = ?, updated_at = CURRENT_TIMESTAMP 
                   WHERE id = ? AND user_id = ?`,
                  [
                    metadata.title,
                    metadata.content || '',
                    metadata.type || 'document',
                    metadata.fileType,
                    metadataStr,
                    tagsStr,
                    metadata.hash ? metadata.hash.toLowerCase() : null,
                    metadata.size,
                    documentId,
                    metadata.userId
                  ],
                  async function(err) {
                    if (err) {
                      // 回滚事务
                      this.db.run('ROLLBACK', () => {
                        reject(new Error(`Failed to update document: ${err.message}`));
                      });
                      return;
                    }

                    if (this.changes === 0) {
                      this.db.run('ROLLBACK', () => {
                        reject(new Error('Document not found or no changes made'));
                      });
                      return;
                    }

                    try {
                      // 移动新文件到最终位置
                      await rename(tempFilePath, finalFilePath);

                      // 提交事务
                      this.db.run('COMMIT', async (err) => {
                        if (err) {
                          // 如果提交失败，尝试删除已移动的文件
                          unlink(finalFilePath).catch(() => {});
                          return reject(new Error(`Failed to commit transaction: ${err.message}`));
                        }

                        // 只有在新文件成功保存后才删除旧文件
                        if (oldFilePath && oldFilePath !== finalFilePath) {
                          try {
                            await unlink(oldFilePath);
                          } catch (unlinkError) {
                            console.error('[DocumentStorageService] Warning: Failed to delete old file:', unlinkError.message);
                            // 不阻止操作完成，只记录警告
                          }
                        }

                        // 返回更新后的文档对象
                        const document = {
                          id: documentId,
                          userId: metadata.userId,
                          title: metadata.title,
                          content: metadata.content || '',
                          type: metadata.type || 'document',
                          fileType: metadata.fileType,
                          metadata: metadata.metadata || {},
                          tags: metadata.tags || [],
                          hash: metadata.hash ? metadata.hash.toLowerCase() : null,
                          size: metadata.size,
                          filePath: finalFilePath,
                          updatedAt: new Date().toISOString()
                        };

                        resolve(document);
                      });

                    } catch (fileError) {
                      // 文件移动失败，回滚事务
                      this.db.run('ROLLBACK', () => {
                        reject(new Error(`Failed to move file: ${fileError.message}`));
                      });
                    }
                  }.bind(this)
                );
              });
            });
          }
        );

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 删除文档
   * 
   * @param {string} documentId - 文档ID
   * @param {number} userId - 用户ID（用于权限验证）
   * @returns {Promise<boolean>} - 删除成功返回 true
   */
  async deleteDocument(documentId, userId) {
    return new Promise((resolve, reject) => {
      // 首先获取文档信息以获取文件路径
      this.db.get(
        'SELECT * FROM documents WHERE id = ? AND user_id = ?',
        [documentId, userId],
        async (err, doc) => {
          if (err) {
            return reject(new Error(`Failed to fetch document: ${err.message}`));
          }

          if (!doc) {
            return reject(new Error('Document not found'));
          }

          // 解析元数据以获取文件路径
          let filePath = null;
          try {
            const metadata = doc.metadata ? JSON.parse(doc.metadata) : {};
            filePath = metadata.filePath;
          } catch (e) {
            console.error('[DocumentStorageService] Error parsing metadata:', e);
          }

          // 开始数据库事务
          this.db.serialize(() => {
            this.db.run('BEGIN TRANSACTION', (err) => {
              if (err) {
                return reject(new Error(`Failed to begin transaction: ${err.message}`));
              }

              // 删除数据库记录（使用 prepared statement）
              this.db.run(
                'DELETE FROM documents WHERE id = ? AND user_id = ?',
                [documentId, userId],
                async function(err) {
                  if (err) {
                    this.db.run('ROLLBACK', () => {
                      reject(new Error(`Failed to delete document: ${err.message}`));
                    });
                    return;
                  }

                  if (this.changes === 0) {
                    this.db.run('ROLLBACK', () => {
                      reject(new Error('Document not found'));
                    });
                    return;
                  }

                  // 提交事务
                  this.db.run('COMMIT', async (err) => {
                    if (err) {
                      return reject(new Error(`Failed to commit transaction: ${err.message}`));
                    }

                    // 删除文件（在事务提交后）
                    if (filePath) {
                      try {
                        await unlink(filePath);
                      } catch (unlinkError) {
                        console.error('[DocumentStorageService] Warning: Failed to delete file:', unlinkError.message);
                        // 不阻止操作完成，只记录警告
                      }
                    }

                    resolve(true);
                  });
                }.bind(this)
              );
            });
          });
        }
      );
    });
  }

  /**
   * 根据 hash 查询文档
   * 
   * @param {string} hash - 文件内容 hash
   * @param {number} userId - 用户ID
   * @returns {Promise<Array>} - 匹配的文档数组
   */
  async findByHash(hash, userId) {
    return new Promise((resolve, reject) => {
      if (!hash) {
        return resolve([]);
      }

      // 使用 prepared statement 防止 SQL 注入
      this.db.all(
        'SELECT * FROM documents WHERE hash = ? AND user_id = ?',
        [hash.toLowerCase(), userId],
        (err, rows) => {
          if (err) {
            return reject(new Error(`Failed to query by hash: ${err.message}`));
          }

          const documents = rows.map(row => this._rowToDocument(row));
          resolve(documents);
        }
      );
    });
  }

  /**
   * 根据文件名查询文档
   * 
   * @param {string} filename - 文件名
   * @param {number} userId - 用户ID
   * @returns {Promise<Array>} - 匹配的文档数组
   */
  async findByFilename(filename, userId) {
    return new Promise((resolve, reject) => {
      if (!filename) {
        return resolve([]);
      }

      // 使用 prepared statement 防止 SQL 注入
      this.db.all(
        'SELECT * FROM documents WHERE title = ? AND user_id = ?',
        [filename, userId],
        (err, rows) => {
          if (err) {
            return reject(new Error(`Failed to query by filename: ${err.message}`));
          }

          const documents = rows.map(row => this._rowToDocument(row));
          resolve(documents);
        }
      );
    });
  }

  /**
   * 验证文件存在
   * 
   * @private
   * @param {string} filePath - 文件路径
   * @returns {Promise<void>}
   * @throws {Error} 如果文件不存在
   */
  async _validateFileExists(filePath) {
    try {
      await access(filePath, fs.constants.F_OK);
    } catch (error) {
      throw new Error(`File does not exist: ${filePath}`);
    }
  }

  /**
   * 生成文件存储路径
   * 
   * @private
   * @param {number} userId - 用户ID
   * @param {string} title - 文件标题
   * @param {string} fileType - 文件类型（扩展名）
   * @returns {string} - 文件路径
   */
  _generateFilePath(userId, title, fileType) {
    const uploadsDir = path.join(__dirname, '../uploads');
    const userDir = path.join(uploadsDir, `user_${userId}`);
    const timestamp = Date.now();
    const filename = `${title}_${timestamp}${fileType}`;
    return path.join(userDir, filename);
  }

  /**
   * 确保目录存在
   * 
   * @private
   * @param {string} dirPath - 目录路径
   * @returns {Promise<void>}
   */
  async _ensureDirectoryExists(dirPath) {
    try {
      await access(dirPath, fs.constants.F_OK);
    } catch (error) {
      // 目录不存在，创建它
      await promisify(fs.mkdir)(dirPath, { recursive: true });
    }
  }

  /**
   * 将数据库行转换为文档对象
   * 
   * @private
   * @param {Object} row - 数据库行
   * @returns {Object} - 文档对象
   */
  _rowToDocument(row) {
    return {
      id: row.id.toString(),
      userId: row.user_id,
      title: row.title,
      content: row.content,
      type: row.type,
      fileType: row.file_type,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      tags: row.tags ? JSON.parse(row.tags) : [],
      hash: row.hash,
      size: row.size,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = DocumentStorageService;
