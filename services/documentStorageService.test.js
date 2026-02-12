const DocumentStorageService = require('./documentStorageService');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');
const sqlite3 = require('sqlite3').verbose();

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const rmdir = promisify(fs.rmdir);
const readdir = promisify(fs.readdir);

/**
 * Unit Tests for DocumentStorageService
 * 
 * **Validates: Requirements 2.1, 2.3, 9.1, 9.2, 9.3**
 * 
 * These tests verify specific examples and edge cases:
 * - 测试文档保存成功
 * - 测试文档更新成功
 * - 测试文档删除成功
 * - 测试按 hash 查询
 * - 测试按文件名查询
 * - 测试事务回滚
 * - 测试文件验证
 */

describe('DocumentStorageService - Unit Tests', () => {
  let testDir;
  let testDbPath;
  let testDb;
  let service;
  let testFiles = [];

  beforeAll(async () => {
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), 'documentStorageService-unit-test-' + Date.now());
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

  describe('saveDocument - 文档保存测试', () => {
    test('应该成功保存文档和文件', async () => {
      const tempFile = path.join(testDir, 'temp-save-test.txt');
      await writeFile(tempFile, 'Test content for save');
      testFiles.push(tempFile);

      const metadata = {
        userId: 1,
        title: 'test-document.txt',
        content: 'Test content',
        type: 'document',
        fileType: '.txt',
        metadata: { source: 'test' },
        tags: ['test', 'unit'],
        hash: 'abc123def456' + '0'.repeat(52),
        size: 1024
      };

      const savedDoc = await service.saveDocument(metadata, tempFile);

      expect(savedDoc).not.toBeNull();
      expect(savedDoc.id).toBeDefined();
      expect(savedDoc.title).toBe(metadata.title);
      expect(savedDoc.hash).toBe(metadata.hash.toLowerCase());
      expect(savedDoc.size).toBe(metadata.size);
      expect(savedDoc.userId).toBe(metadata.userId);
      expect(savedDoc.filePath).toBeDefined();

      // 验证文件已移动
      const fileExists = await new Promise((resolve) => {
        fs.access(savedDoc.filePath, fs.constants.F_OK, (err) => {
          resolve(!err);
        });
      });
      expect(fileExists).toBe(true);

      // 验证临时文件已被移动
      const tempExists = await new Promise((resolve) => {
        fs.access(tempFile, fs.constants.F_OK, (err) => {
          resolve(!err);
        });
      });
      expect(tempExists).toBe(false);

      testFiles.push(savedDoc.filePath);
    });

    test('应该正确保存元数据和标签', async () => {
      const tempFile = path.join(testDir, 'temp-metadata-test.txt');
      await writeFile(tempFile, 'Metadata test');
      testFiles.push(tempFile);

      const metadata = {
        userId: 2,
        title: 'metadata-doc.pdf',
        content: 'PDF content',
        type: 'pdf',
        fileType: '.pdf',
        metadata: { author: 'Test Author', version: 1 },
        tags: ['important', 'work'],
        hash: 'def789abc123' + '0'.repeat(52),
        size: 2048
      };

      const savedDoc = await service.saveDocument(metadata, tempFile);

      expect(savedDoc.metadata).toEqual(metadata.metadata);
      expect(savedDoc.tags).toEqual(metadata.tags);
      expect(savedDoc.type).toBe('pdf');

      // 验证数据库中的数据
      const dbDoc = await new Promise((resolve, reject) => {
        testDb.get('SELECT * FROM documents WHERE id = ?', [savedDoc.id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(JSON.parse(dbDoc.metadata)).toEqual(metadata.metadata);
      expect(JSON.parse(dbDoc.tags)).toEqual(metadata.tags);

      testFiles.push(savedDoc.filePath);
    });

    test('应该处理没有可选字段的文档', async () => {
      const tempFile = path.join(testDir, 'temp-minimal.txt');
      await writeFile(tempFile, 'Minimal doc');
      testFiles.push(tempFile);

      const metadata = {
        userId: 3,
        title: 'minimal.txt',
        fileType: '.txt',
        hash: '123456789abc' + '0'.repeat(52),
        size: 512
      };

      const savedDoc = await service.saveDocument(metadata, tempFile);

      expect(savedDoc).not.toBeNull();
      expect(savedDoc.content).toBe('');
      expect(savedDoc.type).toBe('document');
      expect(savedDoc.metadata).toEqual({});
      expect(savedDoc.tags).toEqual([]);

      testFiles.push(savedDoc.filePath);
    });

    test('应该将 hash 转换为小写', async () => {
      const tempFile = path.join(testDir, 'temp-hash-case.txt');
      await writeFile(tempFile, 'Hash case test');
      testFiles.push(tempFile);

      const metadata = {
        userId: 4,
        title: 'hash-case.txt',
        fileType: '.txt',
        hash: 'ABCDEF123456' + '0'.repeat(52), // 大写
        size: 256
      };

      const savedDoc = await service.saveDocument(metadata, tempFile);

      expect(savedDoc.hash).toBe(metadata.hash.toLowerCase());
      expect(savedDoc.hash).toMatch(/^[a-f0-9]{64}$/);

      testFiles.push(savedDoc.filePath);
    });
  });

  describe('updateDocument - 文档更新测试', () => {
    test('应该成功更新文档', async () => {
      // 首先创建一个文档
      const tempFile1 = path.join(testDir, 'temp-update-original.txt');
      await writeFile(tempFile1, 'Original content');
      testFiles.push(tempFile1);

      const originalMetadata = {
        userId: 5,
        title: 'original.txt',
        content: 'Original',
        fileType: '.txt',
        hash: 'original123' + '0'.repeat(53),
        size: 100
      };

      const savedDoc = await service.saveDocument(originalMetadata, tempFile1);
      testFiles.push(savedDoc.filePath);

      // 更新文档
      const tempFile2 = path.join(testDir, 'temp-update-new.txt');
      await writeFile(tempFile2, 'Updated content');
      testFiles.push(tempFile2);

      const updatedMetadata = {
        userId: 5,
        title: 'updated.txt',
        content: 'Updated',
        fileType: '.txt',
        hash: 'updated456' + '0'.repeat(54),
        size: 200
      };

      const updatedDoc = await service.updateDocument(savedDoc.id, updatedMetadata, tempFile2);

      expect(updatedDoc.id).toBe(savedDoc.id);
      expect(updatedDoc.title).toBe('updated.txt');
      expect(updatedDoc.hash).toBe(updatedMetadata.hash.toLowerCase());
      expect(updatedDoc.size).toBe(200);

      // 验证新文件存在
      const newFileExists = await new Promise((resolve) => {
        fs.access(updatedDoc.filePath, fs.constants.F_OK, (err) => {
          resolve(!err);
        });
      });
      expect(newFileExists).toBe(true);

      testFiles.push(updatedDoc.filePath);
    });

    test('应该在更新时删除旧文件', async () => {
      // 创建原始文档
      const tempFile1 = path.join(testDir, 'temp-old-file.txt');
      await writeFile(tempFile1, 'Old file content');
      testFiles.push(tempFile1);

      const originalMetadata = {
        userId: 6,
        title: 'old-file.txt',
        fileType: '.txt',
        hash: 'oldfile123' + '0'.repeat(54),
        size: 150
      };

      const savedDoc = await service.saveDocument(originalMetadata, tempFile1);
      const oldFilePath = savedDoc.filePath;
      testFiles.push(oldFilePath);

      // 更新文档
      const tempFile2 = path.join(testDir, 'temp-new-file.txt');
      await writeFile(tempFile2, 'New file content');
      testFiles.push(tempFile2);

      const updatedMetadata = {
        userId: 6,
        title: 'new-file.txt',
        fileType: '.txt',
        hash: 'newfile456' + '0'.repeat(54),
        size: 250
      };

      const updatedDoc = await service.updateDocument(savedDoc.id, updatedMetadata, tempFile2);

      // 验证旧文件已被删除（如果路径不同）
      if (oldFilePath !== updatedDoc.filePath) {
        const oldFileExists = await new Promise((resolve) => {
          fs.access(oldFilePath, fs.constants.F_OK, (err) => {
            resolve(!err);
          });
        });
        expect(oldFileExists).toBe(false);
      }

      testFiles.push(updatedDoc.filePath);
    });

    test('更新不存在的文档应该失败', async () => {
      const tempFile = path.join(testDir, 'temp-nonexistent.txt');
      await writeFile(tempFile, 'Content');
      testFiles.push(tempFile);

      const metadata = {
        userId: 7,
        title: 'nonexistent.txt',
        fileType: '.txt',
        hash: 'nonexist123' + '0'.repeat(53),
        size: 100
      };

      await expect(
        service.updateDocument('99999', metadata, tempFile)
      ).rejects.toThrow('Document not found');
    });

    test('更新时应该验证用户权限', async () => {
      // 创建文档（用户 8）
      const tempFile1 = path.join(testDir, 'temp-user8.txt');
      await writeFile(tempFile1, 'User 8 content');
      testFiles.push(tempFile1);

      const originalMetadata = {
        userId: 8,
        title: 'user8.txt',
        fileType: '.txt',
        hash: 'user8hash' + '0'.repeat(55),
        size: 100
      };

      const savedDoc = await service.saveDocument(originalMetadata, tempFile1);
      testFiles.push(savedDoc.filePath);

      // 尝试用不同用户更新
      const tempFile2 = path.join(testDir, 'temp-user9.txt');
      await writeFile(tempFile2, 'User 9 trying to update');
      testFiles.push(tempFile2);

      const updatedMetadata = {
        userId: 9, // 不同的用户
        title: 'hacked.txt',
        fileType: '.txt',
        hash: 'hackedhash' + '0'.repeat(54),
        size: 200
      };

      await expect(
        service.updateDocument(savedDoc.id, updatedMetadata, tempFile2)
      ).rejects.toThrow('Document not found');
    });
  });

  describe('deleteDocument - 文档删除测试', () => {
    test('应该成功删除文档和文件', async () => {
      // 创建文档
      const tempFile = path.join(testDir, 'temp-delete-test.txt');
      await writeFile(tempFile, 'To be deleted');
      testFiles.push(tempFile);

      const metadata = {
        userId: 10,
        title: 'delete-me.txt',
        fileType: '.txt',
        hash: 'deleteme123' + '0'.repeat(53),
        size: 100
      };

      const savedDoc = await service.saveDocument(metadata, tempFile);
      const filePath = savedDoc.filePath;

      // 删除文档
      const result = await service.deleteDocument(savedDoc.id, metadata.userId);

      expect(result).toBe(true);

      // 验证数据库中已删除
      const dbDoc = await new Promise((resolve, reject) => {
        testDb.get('SELECT * FROM documents WHERE id = ?', [savedDoc.id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(dbDoc).toBeUndefined();

      // 验证文件已删除
      const fileExists = await new Promise((resolve) => {
        fs.access(filePath, fs.constants.F_OK, (err) => {
          resolve(!err);
        });
      });
      expect(fileExists).toBe(false);
    });

    test('删除不存在的文档应该失败', async () => {
      await expect(
        service.deleteDocument('99999', 11)
      ).rejects.toThrow('Document not found');
    });

    test('删除时应该验证用户权限', async () => {
      // 创建文档（用户 12）
      const tempFile = path.join(testDir, 'temp-user12.txt');
      await writeFile(tempFile, 'User 12 content');
      testFiles.push(tempFile);

      const metadata = {
        userId: 12,
        title: 'user12.txt',
        fileType: '.txt',
        hash: 'user12hash' + '0'.repeat(54),
        size: 100
      };

      const savedDoc = await service.saveDocument(metadata, tempFile);
      testFiles.push(savedDoc.filePath);

      // 尝试用不同用户删除
      await expect(
        service.deleteDocument(savedDoc.id, 13) // 不同的用户
      ).rejects.toThrow('Document not found');

      // 验证文档仍然存在
      const dbDoc = await new Promise((resolve, reject) => {
        testDb.get('SELECT * FROM documents WHERE id = ?', [savedDoc.id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(dbDoc).toBeDefined();
    });

    test('删除文档后文件不存在不应该阻止操作', async () => {
      // 创建文档
      const tempFile = path.join(testDir, 'temp-missing-file.txt');
      await writeFile(tempFile, 'File will be missing');
      testFiles.push(tempFile);

      const metadata = {
        userId: 14,
        title: 'missing-file.txt',
        fileType: '.txt',
        hash: 'missingfile' + '0'.repeat(53),
        size: 100
      };

      const savedDoc = await service.saveDocument(metadata, tempFile);
      
      // 手动删除文件（模拟文件丢失）
      await unlink(savedDoc.filePath);

      // 删除文档应该成功（即使文件不存在）
      const result = await service.deleteDocument(savedDoc.id, metadata.userId);

      expect(result).toBe(true);

      // 验证数据库记录已删除
      const dbDoc = await new Promise((resolve, reject) => {
        testDb.get('SELECT * FROM documents WHERE id = ?', [savedDoc.id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(dbDoc).toBeUndefined();
    });
  });

  describe('findByHash - 按 hash 查询测试', () => {
    test('应该成功查询到匹配的文档', async () => {
      const hash = 'findbyhash1' + '0'.repeat(53);
      
      // 创建两个相同 hash 的文档（同一用户）
      const tempFile1 = path.join(testDir, 'temp-hash1.txt');
      await writeFile(tempFile1, 'Content 1');
      testFiles.push(tempFile1);

      const metadata1 = {
        userId: 15,
        title: 'hash-doc1.txt',
        fileType: '.txt',
        hash: hash,
        size: 100
      };

      const savedDoc1 = await service.saveDocument(metadata1, tempFile1);
      testFiles.push(savedDoc1.filePath);

      const tempFile2 = path.join(testDir, 'temp-hash2.txt');
      await writeFile(tempFile2, 'Content 2');
      testFiles.push(tempFile2);

      const metadata2 = {
        userId: 15,
        title: 'hash-doc2.txt',
        fileType: '.txt',
        hash: hash,
        size: 100
      };

      const savedDoc2 = await service.saveDocument(metadata2, tempFile2);
      testFiles.push(savedDoc2.filePath);

      // 查询
      const docs = await service.findByHash(hash, 15);

      expect(docs.length).toBe(2);
      expect(docs[0].hash).toBe(hash.toLowerCase());
      expect(docs[1].hash).toBe(hash.toLowerCase());
    });

    test('应该只返回指定用户的文档', async () => {
      const hash = 'sharedash' + '0'.repeat(55);

      // 用户 16 的文档
      const tempFile1 = path.join(testDir, 'temp-user16-hash.txt');
      await writeFile(tempFile1, 'User 16');
      testFiles.push(tempFile1);

      const metadata1 = {
        userId: 16,
        title: 'user16-hash.txt',
        fileType: '.txt',
        hash: hash,
        size: 100
      };

      const savedDoc1 = await service.saveDocument(metadata1, tempFile1);
      testFiles.push(savedDoc1.filePath);

      // 用户 17 的文档（相同 hash）
      const tempFile2 = path.join(testDir, 'temp-user17-hash.txt');
      await writeFile(tempFile2, 'User 17');
      testFiles.push(tempFile2);

      const metadata2 = {
        userId: 17,
        title: 'user17-hash.txt',
        fileType: '.txt',
        hash: hash,
        size: 100
      };

      const savedDoc2 = await service.saveDocument(metadata2, tempFile2);
      testFiles.push(savedDoc2.filePath);

      // 查询用户 16 的文档
      const docs16 = await service.findByHash(hash, 16);
      expect(docs16.length).toBe(1);
      expect(docs16[0].userId).toBe(16);

      // 查询用户 17 的文档
      const docs17 = await service.findByHash(hash, 17);
      expect(docs17.length).toBe(1);
      expect(docs17[0].userId).toBe(17);
    });

    test('查询不存在的 hash 应该返回空数组', async () => {
      const docs = await service.findByHash('nonexistenthash' + '0'.repeat(49), 18);
      expect(docs).toEqual([]);
    });

    test('查询时应该不区分大小写', async () => {
      const hash = 'CaseSensitive' + '0'.repeat(51);

      const tempFile = path.join(testDir, 'temp-case-hash.txt');
      await writeFile(tempFile, 'Case test');
      testFiles.push(tempFile);

      const metadata = {
        userId: 19,
        title: 'case-hash.txt',
        fileType: '.txt',
        hash: hash,
        size: 100
      };

      const savedDoc = await service.saveDocument(metadata, tempFile);
      testFiles.push(savedDoc.filePath);

      // 用小写查询
      const docsLower = await service.findByHash(hash.toLowerCase(), 19);
      expect(docsLower.length).toBe(1);

      // 用大写查询
      const docsUpper = await service.findByHash(hash.toUpperCase(), 19);
      expect(docsUpper.length).toBe(1);

      // 用混合大小写查询
      const docsMixed = await service.findByHash('cAsEsEnSiTiVe' + '0'.repeat(51), 19);
      expect(docsMixed.length).toBe(1);
    });

    test('空 hash 应该返回空数组', async () => {
      const docs = await service.findByHash('', 20);
      expect(docs).toEqual([]);
    });

    test('null hash 应该返回空数组', async () => {
      const docs = await service.findByHash(null, 21);
      expect(docs).toEqual([]);
    });
  });

  describe('findByFilename - 按文件名查询测试', () => {
    test('应该成功查询到匹配的文档', async () => {
      const filename = 'duplicate-name.txt';

      // 创建两个同名文档（同一用户）
      const tempFile1 = path.join(testDir, 'temp-name1.txt');
      await writeFile(tempFile1, 'Content 1');
      testFiles.push(tempFile1);

      const metadata1 = {
        userId: 22,
        title: filename,
        fileType: '.txt',
        hash: 'hash1' + '0'.repeat(59),
        size: 100
      };

      const savedDoc1 = await service.saveDocument(metadata1, tempFile1);
      testFiles.push(savedDoc1.filePath);

      const tempFile2 = path.join(testDir, 'temp-name2.txt');
      await writeFile(tempFile2, 'Content 2');
      testFiles.push(tempFile2);

      const metadata2 = {
        userId: 22,
        title: filename,
        fileType: '.txt',
        hash: 'hash2' + '0'.repeat(59),
        size: 100
      };

      const savedDoc2 = await service.saveDocument(metadata2, tempFile2);
      testFiles.push(savedDoc2.filePath);

      // 查询
      const docs = await service.findByFilename(filename, 22);

      expect(docs.length).toBe(2);
      expect(docs[0].title).toBe(filename);
      expect(docs[1].title).toBe(filename);
    });

    test('应该只返回指定用户的文档', async () => {
      const filename = 'shared-name.txt';

      // 用户 23 的文档
      const tempFile1 = path.join(testDir, 'temp-user23-name.txt');
      await writeFile(tempFile1, 'User 23');
      testFiles.push(tempFile1);

      const metadata1 = {
        userId: 23,
        title: filename,
        fileType: '.txt',
        hash: 'user23hash' + '0'.repeat(54),
        size: 100
      };

      const savedDoc1 = await service.saveDocument(metadata1, tempFile1);
      testFiles.push(savedDoc1.filePath);

      // 用户 24 的文档（相同文件名）
      const tempFile2 = path.join(testDir, 'temp-user24-name.txt');
      await writeFile(tempFile2, 'User 24');
      testFiles.push(tempFile2);

      const metadata2 = {
        userId: 24,
        title: filename,
        fileType: '.txt',
        hash: 'user24hash' + '0'.repeat(54),
        size: 100
      };

      const savedDoc2 = await service.saveDocument(metadata2, tempFile2);
      testFiles.push(savedDoc2.filePath);

      // 查询用户 23 的文档
      const docs23 = await service.findByFilename(filename, 23);
      expect(docs23.length).toBe(1);
      expect(docs23[0].userId).toBe(23);

      // 查询用户 24 的文档
      const docs24 = await service.findByFilename(filename, 24);
      expect(docs24.length).toBe(1);
      expect(docs24[0].userId).toBe(24);
    });

    test('查询不存在的文件名应该返回空数组', async () => {
      const docs = await service.findByFilename('nonexistent-file.txt', 25);
      expect(docs).toEqual([]);
    });

    test('空文件名应该返回空数组', async () => {
      const docs = await service.findByFilename('', 26);
      expect(docs).toEqual([]);
    });

    test('null 文件名应该返回空数组', async () => {
      const docs = await service.findByFilename(null, 27);
      expect(docs).toEqual([]);
    });

    test('文件名查询应该精确匹配', async () => {
      // 创建相似但不同的文件名
      const tempFile1 = path.join(testDir, 'temp-exact1.txt');
      await writeFile(tempFile1, 'Exact 1');
      testFiles.push(tempFile1);

      const metadata1 = {
        userId: 28,
        title: 'test.txt',
        fileType: '.txt',
        hash: 'exact1hash' + '0'.repeat(54),
        size: 100
      };

      const savedDoc1 = await service.saveDocument(metadata1, tempFile1);
      testFiles.push(savedDoc1.filePath);

      const tempFile2 = path.join(testDir, 'temp-exact2.txt');
      await writeFile(tempFile2, 'Exact 2');
      testFiles.push(tempFile2);

      const metadata2 = {
        userId: 28,
        title: 'test-file.txt',
        fileType: '.txt',
        hash: 'exact2hash' + '0'.repeat(54),
        size: 100
      };

      const savedDoc2 = await service.saveDocument(metadata2, tempFile2);
      testFiles.push(savedDoc2.filePath);

      // 查询 'test.txt' 应该只返回一个
      const docs = await service.findByFilename('test.txt', 28);
      expect(docs.length).toBe(1);
      expect(docs[0].title).toBe('test.txt');
    });
  });

  describe('事务回滚测试', () => {
    test('文件不存在时应该回滚事务', async () => {
      const metadata = {
        userId: 29,
        title: 'rollback-test.txt',
        fileType: '.txt',
        hash: 'rollbackhash' + '0'.repeat(52),
        size: 100
      };

      const nonExistentFile = path.join(testDir, 'nonexistent-rollback.txt');

      // 获取保存前的文档数量
      const countBefore = await new Promise((resolve, reject) => {
        testDb.get('SELECT COUNT(*) as count FROM documents', (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });

      // 尝试保存（应该失败）
      await expect(
        service.saveDocument(metadata, nonExistentFile)
      ).rejects.toThrow('does not exist');

      // 验证数据库中没有新增文档
      const countAfter = await new Promise((resolve, reject) => {
        testDb.get('SELECT COUNT(*) as count FROM documents', (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });

      expect(countAfter).toBe(countBefore);
    });

    test('更新时文件不存在应该回滚事务', async () => {
      // 创建原始文档
      const tempFile1 = path.join(testDir, 'temp-rollback-original.txt');
      await writeFile(tempFile1, 'Original');
      testFiles.push(tempFile1);

      const originalMetadata = {
        userId: 30,
        title: 'rollback-original.txt',
        fileType: '.txt',
        hash: 'originalrollback' + '0'.repeat(48),
        size: 100
      };

      const savedDoc = await service.saveDocument(originalMetadata, tempFile1);
      testFiles.push(savedDoc.filePath);

      // 获取原始标题
      const originalTitle = savedDoc.title;

      // 尝试用不存在的文件更新
      const nonExistentFile = path.join(testDir, 'nonexistent-update.txt');

      const updatedMetadata = {
        userId: 30,
        title: 'rollback-updated.txt',
        fileType: '.txt',
        hash: 'updatedrollback' + '0'.repeat(48),
        size: 200
      };

      await expect(
        service.updateDocument(savedDoc.id, updatedMetadata, nonExistentFile)
      ).rejects.toThrow('does not exist');

      // 验证文档没有被更新
      const dbDoc = await new Promise((resolve, reject) => {
        testDb.get('SELECT * FROM documents WHERE id = ?', [savedDoc.id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(dbDoc.title).toBe(originalTitle);
      expect(dbDoc.hash).toBe(originalMetadata.hash.toLowerCase());
    });

    test('数据库错误应该不保存文件', async () => {
      const tempFile = path.join(testDir, 'temp-db-error.txt');
      await writeFile(tempFile, 'DB error test');
      testFiles.push(tempFile);

      // 创建一个已关闭的数据库连接
      const closedDb = new sqlite3.Database(':memory:');
      await new Promise((resolve) => closedDb.close(resolve));

      const failingService = new DocumentStorageService(closedDb);

      const metadata = {
        userId: 31,
        title: 'db-error.txt',
        fileType: '.txt',
        hash: 'dberrorhash' + '0'.repeat(53),
        size: 100
      };

      // 尝试保存（应该失败）
      await expect(
        failingService.saveDocument(metadata, tempFile)
      ).rejects.toThrow();

      // 验证临时文件仍然存在（没有被移动）
      const tempExists = await new Promise((resolve) => {
        fs.access(tempFile, fs.constants.F_OK, (err) => {
          resolve(!err);
        });
      });
      expect(tempExists).toBe(true);
    });
  });

  describe('文件验证测试', () => {
    test('保存前应该验证文件存在', async () => {
      const metadata = {
        userId: 32,
        title: 'validation-test.txt',
        fileType: '.txt',
        hash: 'validationhash' + '0'.repeat(50),
        size: 100
      };

      const nonExistentFile = path.join(testDir, 'does-not-exist.txt');

      await expect(
        service.saveDocument(metadata, nonExistentFile)
      ).rejects.toThrow('does not exist');
    });

    test('更新前应该验证新文件存在', async () => {
      // 创建原始文档
      const tempFile1 = path.join(testDir, 'temp-validation-original.txt');
      await writeFile(tempFile1, 'Original');
      testFiles.push(tempFile1);

      const originalMetadata = {
        userId: 33,
        title: 'validation-original.txt',
        fileType: '.txt',
        hash: 'validationoriginal' + '0'.repeat(46),
        size: 100
      };

      const savedDoc = await service.saveDocument(originalMetadata, tempFile1);
      testFiles.push(savedDoc.filePath);

      // 尝试用不存在的文件更新
      const nonExistentFile = path.join(testDir, 'validation-does-not-exist.txt');

      const updatedMetadata = {
        userId: 33,
        title: 'validation-updated.txt',
        fileType: '.txt',
        hash: 'validationupdated' + '0'.repeat(47),
        size: 200
      };

      await expect(
        service.updateDocument(savedDoc.id, updatedMetadata, nonExistentFile)
      ).rejects.toThrow('does not exist');
    });

    test('应该拒绝目录路径', async () => {
      const metadata = {
        userId: 34,
        title: 'directory-test.txt',
        fileType: '.txt',
        hash: 'directoryhash' + '0'.repeat(51),
        size: 100
      };

      // 使用目录路径而不是文件路径
      await expect(
        service.saveDocument(metadata, testDir)
      ).rejects.toThrow();
    });

    test('应该处理无效的文件路径', async () => {
      const metadata = {
        userId: 35,
        title: 'invalid-path.txt',
        fileType: '.txt',
        hash: 'invalidpathhash' + '0'.repeat(48),
        size: 100
      };

      const invalidPath = '/invalid/path/that/does/not/exist/file.txt';

      await expect(
        service.saveDocument(metadata, invalidPath)
      ).rejects.toThrow('does not exist');
    });
  });

  describe('边界情况和错误处理', () => {
    test('应该处理非常长的文件名', async () => {
      const tempFile = path.join(testDir, 'temp-long-name.txt');
      await writeFile(tempFile, 'Long name test');
      testFiles.push(tempFile);

      const longTitle = 'a'.repeat(255); // 最大长度

      const metadata = {
        userId: 36,
        title: longTitle,
        fileType: '.txt',
        hash: 'longnamehash' + '0'.repeat(52),
        size: 100
      };

      const savedDoc = await service.saveDocument(metadata, tempFile);

      expect(savedDoc.title).toBe(longTitle);

      testFiles.push(savedDoc.filePath);
    });

    test('应该处理特殊字符的文件名', async () => {
      const tempFile = path.join(testDir, 'temp-special-chars.txt');
      await writeFile(tempFile, 'Special chars test');
      testFiles.push(tempFile);

      const specialTitle = '测试文件-@#$%^&()_+.txt';

      const metadata = {
        userId: 37,
        title: specialTitle,
        fileType: '.txt',
        hash: 'specialcharshash' + '0'.repeat(48),
        size: 100
      };

      const savedDoc = await service.saveDocument(metadata, tempFile);

      expect(savedDoc.title).toBe(specialTitle);

      testFiles.push(savedDoc.filePath);
    });

    test('应该处理零大小的文件', async () => {
      const tempFile = path.join(testDir, 'temp-zero-size.txt');
      await writeFile(tempFile, '');
      testFiles.push(tempFile);

      const metadata = {
        userId: 38,
        title: 'zero-size.txt',
        fileType: '.txt',
        hash: 'zerosizehash' + '0'.repeat(52),
        size: 0
      };

      const savedDoc = await service.saveDocument(metadata, tempFile);

      expect(savedDoc.size).toBe(0);

      testFiles.push(savedDoc.filePath);
    });

    test('应该处理非常大的文件大小值', async () => {
      const tempFile = path.join(testDir, 'temp-large-size.txt');
      await writeFile(tempFile, 'Large size value');
      testFiles.push(tempFile);

      const metadata = {
        userId: 39,
        title: 'large-size.txt',
        fileType: '.txt',
        hash: 'largesizehash' + '0'.repeat(51),
        size: 10 * 1024 * 1024 * 1024 // 10GB
      };

      const savedDoc = await service.saveDocument(metadata, tempFile);

      expect(savedDoc.size).toBe(10 * 1024 * 1024 * 1024);

      testFiles.push(savedDoc.filePath);
    });

    test('应该处理 null hash 值', async () => {
      const tempFile = path.join(testDir, 'temp-null-hash.txt');
      await writeFile(tempFile, 'Null hash test');
      testFiles.push(tempFile);

      const metadata = {
        userId: 40,
        title: 'null-hash.txt',
        fileType: '.txt',
        hash: null,
        size: 100
      };

      const savedDoc = await service.saveDocument(metadata, tempFile);

      expect(savedDoc.hash).toBeNull();

      testFiles.push(savedDoc.filePath);
    });
  });
});
