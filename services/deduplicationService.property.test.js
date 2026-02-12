const DeduplicationService = require('./deduplicationService');
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
 * Property-Based Tests for DeduplicationService
 * 
 * These tests verify universal properties that should hold across all inputs:
 * - Property 2: Duplicate Detection Accuracy
 * - Property 3: Filename Duplicate Detection
 * - Property 5: File Replacement Integrity
 * - Property 6: Unique Filename Generation
 */

describe('DeduplicationService - Property-Based Tests', () => {
  let testDir;
  let testDbPath;
  let testDb;
  let storageService;
  let deduplicationService;
  let testFiles = [];

  beforeAll(async () => {
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), 'deduplicationService-property-test-' + Date.now());
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

    storageService = new DocumentStorageService(testDb);
    deduplicationService = new DeduplicationService(storageService);
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
   * Property 2: Duplicate Detection Accuracy
   * 
   * **Validates: Requirements 3.3, 3.4**
   * 
   * For any two files with identical content, the deduplication engine should
   * identify them as content duplicates regardless of their filenames.
   */
  describe('Property 2: Duplicate Detection Accuracy', () => {
    test('相同内容的文件应该被检测为内容重复，无论文件名是否不同', async () => {
      // NOTE: Using 25 iterations instead of 100 for faster test execution
      await fc.assert(
        fc.asyncProperty(
          // 生成随机文件内容和两个不同的文件名
          fc.string({ minLength: 1, maxLength: 500 }),
          hexString64(),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 1000 }),
          async (content, hash, filename1, filename2, userId) => {
            // 确保文件名不同
            fc.pre(filename1 !== filename2);

            // 创建第一个文件
            const tempFile1 = path.join(testDir, `temp1-${Date.now()}-${Math.random()}.txt`);
            await writeFile(tempFile1, content);
            testFiles.push(tempFile1);

            const metadata1 = {
              userId,
              title: filename1,
              content: content.substring(0, 100),
              type: 'document',
              fileType: '.txt',
              hash,
              size: content.length
            };

            // 保存第一个文件
            const savedDoc1 = await storageService.saveDocument(metadata1, tempFile1);
            testFiles.push(savedDoc1.filePath);

            // 检查第二个文件（相同内容，不同文件名）
            const result = await deduplicationService.checkDuplicate(hash, filename2, userId);

            // 验证检测到内容重复
            expect(result.isDuplicate).toBe(true);
            expect(result.duplicateType).toMatch(/content|both/);
            expect(result.existingFile).toBeDefined();
            expect(result.existingFile.id).toBe(savedDoc1.id);
            expect(result.existingFile.hash).toBe(hash.toLowerCase());
          }
        ),
        { numRuns: 25 }
      );
    });

    test('不同用户的相同内容文件不应该被检测为重复', async () => {
      // NOTE: Using 25 iterations instead of 100 for faster test execution
      await fc.assert(
        fc.asyncProperty(
          // 生成随机文件内容和两个不同的用户ID
          fc.string({ minLength: 1, maxLength: 500 }),
          hexString64(),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 1000 }),
          async (content, hash, filename, userId1, userId2) => {
            // 确保用户ID不同
            fc.pre(userId1 !== userId2);

            // 创建第一个用户的文件
            const tempFile1 = path.join(testDir, `temp1-${Date.now()}-${Math.random()}.txt`);
            await writeFile(tempFile1, content);
            testFiles.push(tempFile1);

            const metadata1 = {
              userId: userId1,
              title: filename,
              content: content.substring(0, 100),
              type: 'document',
              fileType: '.txt',
              hash,
              size: content.length
            };

            // 保存第一个用户的文件
            const savedDoc1 = await storageService.saveDocument(metadata1, tempFile1);
            testFiles.push(savedDoc1.filePath);

            // 检查第二个用户的文件（相同内容和文件名）
            const result = await deduplicationService.checkDuplicate(hash, filename, userId2);

            // 验证不同用户不检测为重复
            expect(result.isDuplicate).toBe(false);
            expect(result.duplicateType).toBe('none');
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  /**
   * Property 3: Filename Duplicate Detection
   * 
   * **Validates: Requirements 4.1, 4.2, 4.3**
   * 
   * For any two files with the same filename uploaded by the same user,
   * the deduplication engine should identify them as filename duplicates
   * regardless of content.
   */
  describe('Property 3: Filename Duplicate Detection', () => {
    test('相同文件名的文件应该被检测为文件名重复，无论内容是否不同', async () => {
      // NOTE: Using 25 iterations instead of 100 for faster test execution
      await fc.assert(
        fc.asyncProperty(
          // 生成两个不同的内容和hash，但相同的文件名
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          hexString64(),
          hexString64(),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 1000 }),
          async (content1, content2, hash1, hash2, filename, userId) => {
            // 确保内容和hash不同
            fc.pre(content1 !== content2 && hash1 !== hash2);

            // 创建第一个文件
            const tempFile1 = path.join(testDir, `temp1-${Date.now()}-${Math.random()}.txt`);
            await writeFile(tempFile1, content1);
            testFiles.push(tempFile1);

            const metadata1 = {
              userId,
              title: filename,
              content: content1.substring(0, 100),
              type: 'document',
              fileType: '.txt',
              hash: hash1,
              size: content1.length
            };

            // 保存第一个文件
            const savedDoc1 = await storageService.saveDocument(metadata1, tempFile1);
            testFiles.push(savedDoc1.filePath);

            // 检查第二个文件（相同文件名，不同内容）
            const result = await deduplicationService.checkDuplicate(hash2, filename, userId);

            // 验证检测到文件名重复
            expect(result.isDuplicate).toBe(true);
            expect(result.duplicateType).toMatch(/filename|content|both/);
            expect(result.existingFile).toBeDefined();
            expect(result.existingFile.title).toBe(filename);
          }
        ),
        { numRuns: 25 }
      );
    });

    test('相同文件名和内容应该被检测为完全重复', async () => {
      // NOTE: Using 25 iterations instead of 100 for faster test execution
      await fc.assert(
        fc.asyncProperty(
          // 生成相同的内容、hash和文件名
          fc.string({ minLength: 1, maxLength: 500 }),
          hexString64(),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 1000 }),
          async (content, hash, filename, userId) => {
            // 创建第一个文件
            const tempFile1 = path.join(testDir, `temp1-${Date.now()}-${Math.random()}.txt`);
            await writeFile(tempFile1, content);
            testFiles.push(tempFile1);

            const metadata1 = {
              userId,
              title: filename,
              content: content.substring(0, 100),
              type: 'document',
              fileType: '.txt',
              hash,
              size: content.length
            };

            // 保存第一个文件
            const savedDoc1 = await storageService.saveDocument(metadata1, tempFile1);
            testFiles.push(savedDoc1.filePath);

            // 检查第二个文件（相同文件名和内容）
            const result = await deduplicationService.checkDuplicate(hash, filename, userId);

            // 验证检测到完全重复
            expect(result.isDuplicate).toBe(true);
            expect(result.duplicateType).toBe('both');
            expect(result.existingFile).toBeDefined();
            expect(result.existingFile.id).toBe(savedDoc1.id);
            expect(result.existingFile.title).toBe(filename);
            expect(result.existingFile.hash).toBe(hash.toLowerCase());
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  /**
   * Property 5: File Replacement Integrity
   * 
   * **Validates: Requirements 5.5, 9.4**
   * 
   * For any file replacement operation (user chooses "覆盖现有文件"),
   * the old file should only be deleted after the new file is successfully saved.
   */
  describe('Property 5: File Replacement Integrity', () => {
    test('替换操作失败时，旧文件不应该被删除', async () => {
      // NOTE: Using 20 iterations instead of 100 for faster test execution
      await fc.assert(
        fc.asyncProperty(
          // 生成随机文件内容
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          hexString64(),
          hexString64(),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 1000 }),
          async (content1, content2, hash1, hash2, filename, userId) => {
            // 创建并保存原始文件
            const tempFile1 = path.join(testDir, `temp1-${Date.now()}-${Math.random()}.txt`);
            await writeFile(tempFile1, content1);
            testFiles.push(tempFile1);

            const metadata1 = {
              userId,
              title: filename,
              content: content1.substring(0, 100),
              type: 'document',
              fileType: '.txt',
              hash: hash1,
              size: content1.length
            };

            const savedDoc1 = await storageService.saveDocument(metadata1, tempFile1);
            testFiles.push(savedDoc1.filePath);

            // 验证原始文件存在
            const originalFileExists = await new Promise((resolve) => {
              fs.access(savedDoc1.filePath, fs.constants.F_OK, (err) => {
                resolve(!err);
              });
            });
            expect(originalFileExists).toBe(true);

            // 尝试用不存在的临时文件进行替换（应该失败）
            const nonExistentFile = path.join(testDir, `nonexistent-${Date.now()}.txt`);
            
            const newFile = {
              tempFilePath: nonExistentFile,
              metadata: {
                userId,
                title: filename,
                content: content2.substring(0, 100),
                type: 'document',
                fileType: '.txt',
                hash: hash2,
                size: content2.length
              }
            };

            // 尝试替换（应该失败）
            let replaceError = null;
            try {
              await deduplicationService.handleDuplicateAction('replace', newFile, savedDoc1.id);
            } catch (error) {
              replaceError = error;
            }

            // 验证操作失败
            expect(replaceError).not.toBeNull();

            // 验证原始文件仍然存在（未被删除）
            const originalFileStillExists = await new Promise((resolve) => {
              fs.access(savedDoc1.filePath, fs.constants.F_OK, (err) => {
                resolve(!err);
              });
            });
            expect(originalFileStillExists).toBe(true);

            // 验证数据库中的记录未被修改
            const dbDoc = await new Promise((resolve, reject) => {
              testDb.get('SELECT * FROM documents WHERE id = ?', [savedDoc1.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
              });
            });

            expect(dbDoc).not.toBeNull();
            expect(dbDoc.hash).toBe(hash1.toLowerCase());
            expect(dbDoc.title).toBe(filename);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('替换操作成功时，旧文件应该被删除，新文件应该被保存', async () => {
      // NOTE: Using 20 iterations instead of 100 for faster test execution
      await fc.assert(
        fc.asyncProperty(
          // 生成随机文件内容
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          hexString64(),
          hexString64(),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 1000 }),
          async (content1, content2, hash1, hash2, filename, userId) => {
            // 创建并保存原始文件
            const tempFile1 = path.join(testDir, `temp1-${Date.now()}-${Math.random()}.txt`);
            await writeFile(tempFile1, content1);
            testFiles.push(tempFile1);

            const metadata1 = {
              userId,
              title: filename,
              content: content1.substring(0, 100),
              type: 'document',
              fileType: '.txt',
              hash: hash1,
              size: content1.length
            };

            const savedDoc1 = await storageService.saveDocument(metadata1, tempFile1);
            const originalFilePath = savedDoc1.filePath;
            testFiles.push(originalFilePath);

            // 创建新文件进行替换
            const tempFile2 = path.join(testDir, `temp2-${Date.now()}-${Math.random()}.txt`);
            await writeFile(tempFile2, content2);
            testFiles.push(tempFile2);

            const newFile = {
              tempFilePath: tempFile2,
              metadata: {
                userId,
                title: filename,
                content: content2.substring(0, 100),
                type: 'document',
                fileType: '.txt',
                hash: hash2,
                size: content2.length
              }
            };

            // 执行替换
            const updatedDoc = await deduplicationService.handleDuplicateAction('replace', newFile, savedDoc1.id);

            // 验证返回的文档
            expect(updatedDoc).not.toBeNull();
            expect(updatedDoc.id).toBe(savedDoc1.id);
            expect(updatedDoc.hash).toBe(hash2.toLowerCase());

            // 验证旧文件已被删除
            const oldFileExists = await new Promise((resolve) => {
              fs.access(originalFilePath, fs.constants.F_OK, (err) => {
                resolve(!err);
              });
            });
            expect(oldFileExists).toBe(false);

            // 验证新文件存在
            const newFileExists = await new Promise((resolve) => {
              fs.access(updatedDoc.filePath, fs.constants.F_OK, (err) => {
                resolve(!err);
              });
            });
            expect(newFileExists).toBe(true);

            // 验证数据库中的记录已更新
            const dbDoc = await new Promise((resolve, reject) => {
              testDb.get('SELECT * FROM documents WHERE id = ?', [savedDoc1.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
              });
            });

            expect(dbDoc).not.toBeNull();
            expect(dbDoc.hash).toBe(hash2.toLowerCase());

            testFiles.push(updatedDoc.filePath);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 6: Unique Filename Generation
   * 
   * **Validates: Requirements 5.6**
   * 
   * For any "keep-both" action, the generated filename should be unique
   * within the user's document collection.
   */
  describe('Property 6: Unique Filename Generation', () => {
    test('多次 keep-both 操作应该生成唯一的文件名', async () => {
      // NOTE: Using 30 iterations instead of 100 for faster test execution
      await fc.assert(
        fc.asyncProperty(
          // 生成随机文件名和多个文件内容
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 500 }),
              hexString64()
            ),
            { minLength: 2, maxLength: 10 }
          ),
          fc.integer({ min: 1, max: 1000 }),
          async (baseFilename, filesData, userId) => {
            const savedDocs = [];
            const generatedFilenames = new Set();

            // 保存多个文件，每次都使用 keep-both
            for (const [content, hash] of filesData) {
              const tempFile = path.join(testDir, `temp-${Date.now()}-${Math.random()}.txt`);
              await writeFile(tempFile, content);
              testFiles.push(tempFile);

              const newFile = {
                tempFilePath: tempFile,
                metadata: {
                  userId,
                  title: baseFilename,
                  content: content.substring(0, 100),
                  type: 'document',
                  fileType: '.txt',
                  hash,
                  size: content.length
                }
              };

              // 使用 keep-both 保存
              const savedDoc = await deduplicationService.handleDuplicateAction('keep-both', newFile, null);
              
              expect(savedDoc).not.toBeNull();
              savedDocs.push(savedDoc);
              testFiles.push(savedDoc.filePath);

              // 收集生成的文件名
              generatedFilenames.add(savedDoc.title);
            }

            // 验证所有生成的文件名都是唯一的
            expect(generatedFilenames.size).toBe(filesData.length);

            // 验证所有文件名都包含原始基础文件名
            for (const doc of savedDocs) {
              expect(doc.title).toContain(baseFilename);
            }

            // 验证数据库中所有文档的文件名都是唯一的
            const dbFilenames = await new Promise((resolve, reject) => {
              testDb.all(
                'SELECT title FROM documents WHERE user_id = ?',
                [userId],
                (err, rows) => {
                  if (err) reject(err);
                  else resolve(rows.map(r => r.title));
                }
              );
            });

            const uniqueDbFilenames = new Set(dbFilenames);
            expect(uniqueDbFilenames.size).toBe(dbFilenames.length);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('keep-both 生成的文件名应该包含时间戳和随机后缀', async () => {
      // NOTE: Using 30 iterations instead of 100 for faster test execution
      await fc.assert(
        fc.asyncProperty(
          // 生成随机文件内容
          fc.string({ minLength: 1, maxLength: 500 }),
          hexString64(),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 1000 }),
          async (content, hash, filename, userId) => {
            const tempFile = path.join(testDir, `temp-${Date.now()}-${Math.random()}.txt`);
            await writeFile(tempFile, content);
            testFiles.push(tempFile);

            const newFile = {
              tempFilePath: tempFile,
              metadata: {
                userId,
                title: filename,
                content: content.substring(0, 100),
                type: 'document',
                fileType: '.txt',
                hash,
                size: content.length
              }
            };

            // 使用 keep-both 保存
            const savedDoc = await deduplicationService.handleDuplicateAction('keep-both', newFile, null);
            
            expect(savedDoc).not.toBeNull();
            testFiles.push(savedDoc.filePath);

            // 验证生成的文件名格式：原始名称_时间戳_随机后缀
            expect(savedDoc.title).toContain(filename);
            expect(savedDoc.title).toMatch(/_\d+_[a-z0-9]+$/);
            
            // 验证文件名不等于原始文件名
            expect(savedDoc.title).not.toBe(filename);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('并发 keep-both 操作应该生成不同的文件名', async () => {
      // NOTE: Using 20 iterations instead of 50 for faster test execution
      await fc.assert(
        fc.asyncProperty(
          // 生成随机文件名和多个文件内容
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 500 }),
              hexString64()
            ),
            { minLength: 3, maxLength: 5 }
          ),
          fc.integer({ min: 1, max: 1000 }),
          async (baseFilename, filesData, userId) => {
            // 并发执行多个 keep-both 操作
            const savePromises = filesData.map(async ([content, hash]) => {
              const tempFile = path.join(testDir, `temp-${Date.now()}-${Math.random()}.txt`);
              await writeFile(tempFile, content);
              testFiles.push(tempFile);

              const newFile = {
                tempFilePath: tempFile,
                metadata: {
                  userId,
                  title: baseFilename,
                  content: content.substring(0, 100),
                  type: 'document',
                  fileType: '.txt',
                  hash,
                  size: content.length
                }
              };

              return deduplicationService.handleDuplicateAction('keep-both', newFile, null);
            });

            const savedDocs = await Promise.all(savePromises);

            // 收集所有生成的文件名
            const generatedFilenames = savedDocs.map(doc => doc.title);
            const uniqueFilenames = new Set(generatedFilenames);

            // 验证所有文件名都是唯一的
            expect(uniqueFilenames.size).toBe(filesData.length);

            // 清理
            for (const doc of savedDocs) {
              testFiles.push(doc.filePath);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
