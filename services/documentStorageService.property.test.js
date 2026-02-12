const DocumentStorageService = require('./documentStorageService');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');
const fc = require('fast-check');
const sqlite3 = require('sqlite3').verbose();

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const rmdir = promisify(fs.rmdir);
const readdir = promisify(fs.readdir);

/**
 * Helper function to generate a 64-character hex string
 */
const hexString64 = () => fc.array(
  fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'),
  { minLength: 64, maxLength: 64 }
).map(arr => arr.join(''));

/**
 * Property-Based Tests for DocumentStorageService
 * 
 * These tests verify universal properties that should hold across all inputs:
 * - Property 4: Transaction Atomicity
 * - Property 8: Hash Storage Format Consistency
 */

describe('DocumentStorageService - Property-Based Tests', () => {
  let testDir;
  let testDbPath;
  let testDb;
  let service;
  let testFiles = [];

  beforeAll(async () => {
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), 'documentStorageService-property-test-' + Date.now());
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // 清理测试文件
    for (const file of testFiles) {
      try {
        await unlink(file);
      } catch (error) {
        // 忽略删除错误
      }
    }
    
    // 清理测试目录
    try {
      const files = await readdir(testDir);
      for (const file of files) {
        try {
          await unlink(path.join(testDir, file));
        } catch (error) {
          // 忽略删除错误
        }
      }
      await rmdir(testDir);
    } catch (error) {
      // 忽略删除错误
    }
  });

  beforeEach(async () => {
    // 为每个测试创建新的数据库
    testDbPath = path.join(testDir, `test-${Date.now()}-${Math.random()}.db`);
    testDb = new sqlite3.Database(testDbPath);
    
    // 创建 documents 表
    await new Promise((resolve, reject) => {
      testDb.run(`
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title VARCHAR(255) NOT NULL,
          content TEXT,
          type VARCHAR(50) DEFAULT 'document',
          file_type VARCHAR(50) DEFAULT '.md',
          metadata TEXT,
          tags TEXT,
          hash VARCHAR(64),
          size INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 创建索引
    await new Promise((resolve, reject) => {
      testDb.run('CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(hash)', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise((resolve, reject) => {
      testDb.run('CREATE INDEX IF NOT EXISTS idx_documents_user_filename ON documents(user_id, title)', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    service = new DocumentStorageService(testDb);
    testFiles = [];
  });

  afterEach(async () => {
    // 关闭数据库连接
    if (testDb) {
      await new Promise((resolve) => {
        testDb.close(() => resolve());
      });
    }

    // 删除测试数据库
    try {
      await unlink(testDbPath);
    } catch (error) {
      // 忽略删除错误
    }
  });

  /**
   * Property 4: Transaction Atomicity
   * 
   * **Validates: Requirements 9.1, 9.2**
   * 
   * For any file upload operation, either both the file and its metadata are saved
   * successfully, or neither is saved (rollback on failure). This ensures data consistency.
   */
  describe('Property 4: Transaction Atomicity', () => {
    test('数据库失败时不应该保存任何部分数据', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机文档元数据
          fc.record({
            userId: fc.integer({ min: 1, max: 1000 }),
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.string({ minLength: 0, maxLength: 500 }),
            type: fc.constantFrom('document', 'pdf', 'image', 'text'),
            fileType: fc.constantFrom('.pdf', '.txt', '.md', '.docx', '.jpg'),
            hash: hexString64(),
            size: fc.integer({ min: 0, max: 10000000 })
          }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (metadata, fileContent) => {
            // 创建临时文件
            const tempFile = path.join(testDir, `temp-${Date.now()}-${Math.random()}.txt`);
            await writeFile(tempFile, fileContent);
            testFiles.push(tempFile);

            // 获取保存前的文档数量
            const countBefore = await new Promise((resolve, reject) => {
              testDb.get('SELECT COUNT(*) as count FROM documents', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
              });
            });

            // 创建一个会失败的数据库连接（通过关闭数据库）
            const failingDb = new sqlite3.Database(':memory:');
            await new Promise((resolve) => failingDb.close(resolve));
            
            const failingService = new DocumentStorageService(failingDb);

            // 尝试保存文档（应该失败）
            let saveError = null;
            try {
              await failingService.saveDocument(metadata, tempFile);
            } catch (error) {
              saveError = error;
            }

            // 验证操作失败
            expect(saveError).not.toBeNull();

            // 验证原数据库中没有新增文档（使用正常的数据库连接检查）
            const countAfter = await new Promise((resolve, reject) => {
              testDb.get('SELECT COUNT(*) as count FROM documents', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
              });
            });

            expect(countAfter).toBe(countBefore);

            // 验证临时文件仍然存在（因为移动失败）
            const tempFileExists = await new Promise((resolve) => {
              fs.access(tempFile, fs.constants.F_OK, (err) => {
                resolve(!err);
              });
            });
            expect(tempFileExists).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('文件移动失败时应该回滚数据库事务', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机文档元数据
          fc.record({
            userId: fc.integer({ min: 1, max: 1000 }),
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.string({ minLength: 0, maxLength: 500 }),
            type: fc.constantFrom('document', 'pdf', 'image', 'text'),
            fileType: fc.constantFrom('.pdf', '.txt', '.md', '.docx', '.jpg'),
            hash: hexString64(),
            size: fc.integer({ min: 0, max: 10000000 })
          }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (metadata, fileContent) => {
            // 创建临时文件
            const tempFile = path.join(testDir, `temp-${Date.now()}-${Math.random()}.txt`);
            await writeFile(tempFile, fileContent);
            testFiles.push(tempFile);

            // 获取保存前的文档数量
            const countBefore = await new Promise((resolve, reject) => {
              testDb.get('SELECT COUNT(*) as count FROM documents', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
              });
            });

            // 使用不存在的临时文件路径（会导致文件移动失败）
            const nonExistentFile = path.join(testDir, `nonexistent-${Date.now()}.txt`);

            // 尝试保存文档（应该失败）
            let saveError = null;
            try {
              await service.saveDocument(metadata, nonExistentFile);
            } catch (error) {
              saveError = error;
            }

            // 验证操作失败
            expect(saveError).not.toBeNull();
            expect(saveError.message).toContain('does not exist');

            // 验证数据库中没有新增文档（事务已回滚）
            const countAfter = await new Promise((resolve, reject) => {
              testDb.get('SELECT COUNT(*) as count FROM documents', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
              });
            });

            expect(countAfter).toBe(countBefore);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('成功保存时文件和元数据都应该存在', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机文档元数据
          fc.record({
            userId: fc.integer({ min: 1, max: 1000 }),
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.string({ minLength: 0, maxLength: 500 }),
            type: fc.constantFrom('document', 'pdf', 'image', 'text'),
            fileType: fc.constantFrom('.pdf', '.txt', '.md', '.docx', '.jpg'),
            hash: hexString64(),
            size: fc.integer({ min: 0, max: 10000000 })
          }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (metadata, fileContent) => {
            // 创建临时文件
            const tempFile = path.join(testDir, `temp-${Date.now()}-${Math.random()}.txt`);
            await writeFile(tempFile, fileContent);
            testFiles.push(tempFile);

            // 保存文档
            const savedDoc = await service.saveDocument(metadata, tempFile);

            // 验证返回的文档对象
            expect(savedDoc).not.toBeNull();
            expect(savedDoc.id).toBeDefined();
            expect(savedDoc.title).toBe(metadata.title);
            expect(savedDoc.hash).toBe(metadata.hash.toLowerCase());

            // 验证数据库中存在该文档
            const dbDoc = await new Promise((resolve, reject) => {
              testDb.get('SELECT * FROM documents WHERE id = ?', [savedDoc.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
              });
            });

            expect(dbDoc).not.toBeNull();
            expect(dbDoc.title).toBe(metadata.title);
            expect(dbDoc.hash).toBe(metadata.hash.toLowerCase());

            // 验证文件已移动到最终位置
            const finalFileExists = await new Promise((resolve) => {
              fs.access(savedDoc.filePath, fs.constants.F_OK, (err) => {
                resolve(!err);
              });
            });
            expect(finalFileExists).toBe(true);

            // 验证临时文件已被移动（不再存在）
            const tempFileExists = await new Promise((resolve) => {
              fs.access(tempFile, fs.constants.F_OK, (err) => {
                resolve(!err);
              });
            });
            expect(tempFileExists).toBe(false);

            // 清理
            testFiles.push(savedDoc.filePath);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 8: Hash Storage Format Consistency
   * 
   * **Validates: Requirements 9.5**
   * 
   * For all stored hash values, they should be in lowercase hexadecimal format.
   * This ensures consistent hash comparison and storage.
   */
  describe('Property 8: Hash Storage Format Consistency', () => {
    test('保存的 hash 值应该始终是小写十六进制格式', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机文档元数据，hash 可能包含大写字母
          fc.record({
            userId: fc.integer({ min: 1, max: 1000 }),
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.string({ minLength: 0, maxLength: 500 }),
            type: fc.constantFrom('document', 'pdf', 'image', 'text'),
            fileType: fc.constantFrom('.pdf', '.txt', '.md', '.docx', '.jpg'),
            hash: hexString64().map(h => {
              // 随机混合大小写
              return h.split('').map(c => 
                Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase()
              ).join('');
            }),
            size: fc.integer({ min: 0, max: 10000000 })
          }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (metadata, fileContent) => {
            // 创建临时文件
            const tempFile = path.join(testDir, `temp-${Date.now()}-${Math.random()}.txt`);
            await writeFile(tempFile, fileContent);
            testFiles.push(tempFile);

            // 保存文档
            const savedDoc = await service.saveDocument(metadata, tempFile);

            // 验证返回的 hash 是小写
            expect(savedDoc.hash).toBe(savedDoc.hash.toLowerCase());
            expect(savedDoc.hash).toMatch(/^[a-f0-9]{64}$/);

            // 验证数据库中存储的 hash 是小写
            const dbDoc = await new Promise((resolve, reject) => {
              testDb.get('SELECT hash FROM documents WHERE id = ?', [savedDoc.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
              });
            });

            expect(dbDoc.hash).toBe(dbDoc.hash.toLowerCase());
            expect(dbDoc.hash).toMatch(/^[a-f0-9]{64}$/);
            expect(dbDoc.hash).toBe(metadata.hash.toLowerCase());

            // 清理
            testFiles.push(savedDoc.filePath);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('通过 findByHash 查询时应该不区分大小写', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机文档元数据
          fc.record({
            userId: fc.integer({ min: 1, max: 1000 }),
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.string({ minLength: 0, maxLength: 500 }),
            type: fc.constantFrom('document', 'pdf', 'image', 'text'),
            fileType: fc.constantFrom('.pdf', '.txt', '.md', '.docx', '.jpg'),
            hash: hexString64(),
            size: fc.integer({ min: 0, max: 10000000 })
          }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (metadata, fileContent) => {
            // 创建临时文件
            const tempFile = path.join(testDir, `temp-${Date.now()}-${Math.random()}.txt`);
            await writeFile(tempFile, fileContent);
            testFiles.push(tempFile);

            // 保存文档
            const savedDoc = await service.saveDocument(metadata, tempFile);

            // 使用小写 hash 查询
            const docsLower = await service.findByHash(metadata.hash.toLowerCase(), metadata.userId);
            expect(docsLower.length).toBeGreaterThan(0);
            expect(docsLower[0].id).toBe(savedDoc.id);

            // 使用大写 hash 查询（应该找到相同的文档）
            const docsUpper = await service.findByHash(metadata.hash.toUpperCase(), metadata.userId);
            expect(docsUpper.length).toBeGreaterThan(0);
            expect(docsUpper[0].id).toBe(savedDoc.id);

            // 使用混合大小写 hash 查询
            const mixedHash = metadata.hash.split('').map((c, i) => 
              i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()
            ).join('');
            const docsMixed = await service.findByHash(mixedHash, metadata.userId);
            expect(docsMixed.length).toBeGreaterThan(0);
            expect(docsMixed[0].id).toBe(savedDoc.id);

            // 清理
            testFiles.push(savedDoc.filePath);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('更新文档时 hash 应该保持小写格式', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成两组随机文档元数据（原始和更新）
          fc.record({
            userId: fc.integer({ min: 1, max: 1000 }),
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.string({ minLength: 0, maxLength: 500 }),
            type: fc.constantFrom('document', 'pdf', 'image', 'text'),
            fileType: fc.constantFrom('.pdf', '.txt', '.md', '.docx', '.jpg'),
            hash: hexString64(),
            size: fc.integer({ min: 0, max: 10000000 })
          }),
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.string({ minLength: 0, maxLength: 500 }),
            hash: hexString64().map(h => {
              // 随机混合大小写
              return h.split('').map(c => 
                Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase()
              ).join('');
            }),
            size: fc.integer({ min: 0, max: 10000000 })
          }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (originalMetadata, updateData, fileContent1, fileContent2) => {
            // 创建并保存原始文档
            const tempFile1 = path.join(testDir, `temp1-${Date.now()}-${Math.random()}.txt`);
            await writeFile(tempFile1, fileContent1);
            testFiles.push(tempFile1);

            const savedDoc = await service.saveDocument(originalMetadata, tempFile1);

            // 创建更新文件
            const tempFile2 = path.join(testDir, `temp2-${Date.now()}-${Math.random()}.txt`);
            await writeFile(tempFile2, fileContent2);
            testFiles.push(tempFile2);

            // 更新文档
            const updatedMetadata = {
              userId: originalMetadata.userId,
              title: updateData.title,
              content: updateData.content,
              type: originalMetadata.type,
              fileType: originalMetadata.fileType,
              hash: updateData.hash,
              size: updateData.size
            };

            const updatedDoc = await service.updateDocument(savedDoc.id, updatedMetadata, tempFile2);

            // 验证更新后的 hash 是小写
            expect(updatedDoc.hash).toBe(updatedDoc.hash.toLowerCase());
            expect(updatedDoc.hash).toMatch(/^[a-f0-9]{64}$/);
            expect(updatedDoc.hash).toBe(updateData.hash.toLowerCase());

            // 验证数据库中的 hash 是小写
            const dbDoc = await new Promise((resolve, reject) => {
              testDb.get('SELECT hash FROM documents WHERE id = ?', [savedDoc.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
              });
            });

            expect(dbDoc.hash).toBe(dbDoc.hash.toLowerCase());
            expect(dbDoc.hash).toMatch(/^[a-f0-9]{64}$/);

            // 清理
            testFiles.push(savedDoc.filePath, updatedDoc.filePath);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('批量保存的所有文档 hash 都应该是小写格式', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成多个随机文档
          fc.array(
            fc.record({
              userId: fc.integer({ min: 1, max: 1000 }),
              title: fc.string({ minLength: 1, maxLength: 100 }),
              content: fc.string({ minLength: 0, maxLength: 500 }),
              type: fc.constantFrom('document', 'pdf', 'image', 'text'),
              fileType: fc.constantFrom('.pdf', '.txt', '.md', '.docx', '.jpg'),
              hash: hexString64().map(h => {
                // 随机混合大小写
                return h.split('').map(c => 
                  Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase()
                ).join('');
              }),
              size: fc.integer({ min: 0, max: 10000000 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (documentsMetadata) => {
            const savedDocs = [];

            // 保存所有文档
            for (const metadata of documentsMetadata) {
              const tempFile = path.join(testDir, `temp-${Date.now()}-${Math.random()}.txt`);
              await writeFile(tempFile, `content-${Math.random()}`);
              testFiles.push(tempFile);

              const savedDoc = await service.saveDocument(metadata, tempFile);
              savedDocs.push(savedDoc);
              testFiles.push(savedDoc.filePath);
            }

            // 验证所有保存的文档 hash 都是小写
            for (let i = 0; i < savedDocs.length; i++) {
              const savedDoc = savedDocs[i];
              const originalHash = documentsMetadata[i].hash;

              expect(savedDoc.hash).toBe(savedDoc.hash.toLowerCase());
              expect(savedDoc.hash).toMatch(/^[a-f0-9]{64}$/);
              expect(savedDoc.hash).toBe(originalHash.toLowerCase());

              // 验证数据库中的 hash
              const dbDoc = await new Promise((resolve, reject) => {
                testDb.get('SELECT hash FROM documents WHERE id = ?', [savedDoc.id], (err, row) => {
                  if (err) reject(err);
                  else resolve(row);
                });
              });

              expect(dbDoc.hash).toBe(dbDoc.hash.toLowerCase());
              expect(dbDoc.hash).toMatch(/^[a-f0-9]{64}$/);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
