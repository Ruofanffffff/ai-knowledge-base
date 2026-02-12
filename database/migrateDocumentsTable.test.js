const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { applyMigration, rollbackMigration } = require('./migrateDocumentsTable');

const unlink = promisify(fs.unlink);
const exists = promisify(fs.exists);

describe('Database Migration - migrateDocumentsTable', () => {
  let testDb;
  let testDbPath;

  beforeEach(async () => {
    // Create a unique test database for each test
    testDbPath = path.join(__dirname, `../data/test_migration_${Date.now()}.db`);
    
    // Create test database with original schema
    testDb = await createTestDatabase(testDbPath);
  });

  afterEach(async () => {
    // Close database connection
    if (testDb) {
      await new Promise((resolve) => {
        testDb.close((err) => {
          if (err) console.error('Error closing test database:', err);
          resolve();
        });
      });
    }

    // Delete test database file
    try {
      if (await exists(testDbPath)) {
        await unlink(testDbPath);
      }
    } catch (error) {
      console.error('Error deleting test database:', error);
    }
  });

  describe('applyMigration', () => {
    test('应该成功添加 hash 和 size 列', async () => {
      // Apply migration
      await applyMigration(testDb);

      // Verify columns were added
      const columns = await getTableColumns(testDb, 'documents');
      const columnNames = columns.map(col => col.name);

      expect(columnNames).toContain('hash');
      expect(columnNames).toContain('size');
    });

    test('应该创建 hash 列索引', async () => {
      // Apply migration
      await applyMigration(testDb);

      // Verify index was created
      const indexes = await getTableIndexes(testDb, 'documents');
      const indexNames = indexes.map(idx => idx.name);

      expect(indexNames).toContain('idx_documents_hash');
    });

    test('应该创建 user_id 和 title 复合索引', async () => {
      // Apply migration
      await applyMigration(testDb);

      // Verify index was created
      const indexes = await getTableIndexes(testDb, 'documents');
      const indexNames = indexes.map(idx => idx.name);

      expect(indexNames).toContain('idx_documents_user_filename');
    });

    test('应该保留现有数据不受影响', async () => {
      // Insert test data before migration
      const testData = {
        user_id: 1,
        title: 'test-document.pdf',
        content: 'Test content',
        type: 'document',
        file_type: '.pdf'
      };

      await insertTestDocument(testDb, testData);

      // Get count before migration
      const countBefore = await getDocumentCount(testDb);

      // Apply migration
      await applyMigration(testDb);

      // Get count after migration
      const countAfter = await getDocumentCount(testDb);

      // Verify data integrity
      expect(countAfter).toBe(countBefore);

      // Verify specific document still exists
      const document = await getDocumentByTitle(testDb, testData.title);
      expect(document).toBeTruthy();
      expect(document.title).toBe(testData.title);
      expect(document.content).toBe(testData.content);
      expect(document.user_id).toBe(testData.user_id);
    });

    test('应该处理重复执行（幂等性）', async () => {
      // Apply migration first time
      await applyMigration(testDb);

      // Apply migration second time (should not throw error)
      await expect(applyMigration(testDb)).resolves.not.toThrow();

      // Verify columns still exist
      const columns = await getTableColumns(testDb, 'documents');
      const columnNames = columns.map(col => col.name);

      expect(columnNames).toContain('hash');
      expect(columnNames).toContain('size');
    });

    test('hash 列应该是 VARCHAR(64) 类型', async () => {
      // Apply migration
      await applyMigration(testDb);

      // Get column info
      const columns = await getTableColumns(testDb, 'documents');
      const hashColumn = columns.find(col => col.name === 'hash');

      expect(hashColumn).toBeTruthy();
      expect(hashColumn.type).toBe('VARCHAR(64)');
    });

    test('size 列应该是 INTEGER 类型', async () => {
      // Apply migration
      await applyMigration(testDb);

      // Get column info
      const columns = await getTableColumns(testDb, 'documents');
      const sizeColumn = columns.find(col => col.name === 'size');

      expect(sizeColumn).toBeTruthy();
      expect(sizeColumn.type).toBe('INTEGER');
    });
  });

  describe('rollbackMigration', () => {
    test('应该成功删除 hash 和 size 列', async () => {
      // Apply migration first
      await applyMigration(testDb);

      // Verify columns exist
      let columns = await getTableColumns(testDb, 'documents');
      let columnNames = columns.map(col => col.name);
      expect(columnNames).toContain('hash');
      expect(columnNames).toContain('size');

      // Rollback migration
      await rollbackMigration(testDb);

      // Verify columns were removed
      columns = await getTableColumns(testDb, 'documents');
      columnNames = columns.map(col => col.name);
      expect(columnNames).not.toContain('hash');
      expect(columnNames).not.toContain('size');
    });

    test('应该删除索引', async () => {
      // Apply migration first
      await applyMigration(testDb);

      // Verify indexes exist
      let indexes = await getTableIndexes(testDb, 'documents');
      let indexNames = indexes.map(idx => idx.name);
      expect(indexNames).toContain('idx_documents_hash');
      expect(indexNames).toContain('idx_documents_user_filename');

      // Rollback migration
      await rollbackMigration(testDb);

      // Verify indexes were removed
      indexes = await getTableIndexes(testDb, 'documents');
      indexNames = indexes.map(idx => idx.name);
      expect(indexNames).not.toContain('idx_documents_hash');
      expect(indexNames).not.toContain('idx_documents_user_filename');
    });

    test('应该保留现有数据不受影响', async () => {
      // Insert test data
      const testData = {
        user_id: 1,
        title: 'rollback-test.pdf',
        content: 'Rollback test content',
        type: 'document',
        file_type: '.pdf'
      };

      await insertTestDocument(testDb, testData);

      // Apply migration
      await applyMigration(testDb);

      // Get count after migration
      const countAfterMigration = await getDocumentCount(testDb);

      // Rollback migration
      await rollbackMigration(testDb);

      // Get count after rollback
      const countAfterRollback = await getDocumentCount(testDb);

      // Verify data integrity
      expect(countAfterRollback).toBe(countAfterMigration);

      // Verify specific document still exists
      const document = await getDocumentByTitle(testDb, testData.title);
      expect(document).toBeTruthy();
      expect(document.title).toBe(testData.title);
      expect(document.content).toBe(testData.content);
    });

    test('应该保留所有原始列', async () => {
      // Apply migration
      await applyMigration(testDb);

      // Rollback migration
      await rollbackMigration(testDb);

      // Verify original columns still exist
      const columns = await getTableColumns(testDb, 'documents');
      const columnNames = columns.map(col => col.name);

      const expectedColumns = [
        'id',
        'user_id',
        'title',
        'content',
        'type',
        'file_type',
        'metadata',
        'tags',
        'created_at',
        'updated_at'
      ];

      expectedColumns.forEach(colName => {
        expect(columnNames).toContain(colName);
      });
    });

    test('回滚后应该能够重新应用迁移', async () => {
      // Apply migration
      await applyMigration(testDb);

      // Rollback migration
      await rollbackMigration(testDb);

      // Re-apply migration
      await expect(applyMigration(testDb)).resolves.not.toThrow();

      // Verify columns were added again
      const columns = await getTableColumns(testDb, 'documents');
      const columnNames = columns.map(col => col.name);

      expect(columnNames).toContain('hash');
      expect(columnNames).toContain('size');
    });
  });

  describe('数据完整性测试', () => {
    test('迁移后应该能够插入带有 hash 和 size 的新记录', async () => {
      // Apply migration
      await applyMigration(testDb);

      // Insert document with hash and size
      const testData = {
        user_id: 1,
        title: 'new-document.pdf',
        content: 'New content',
        type: 'document',
        file_type: '.pdf',
        hash: 'abc123def456',
        size: 1024000
      };

      await insertTestDocumentWithHash(testDb, testData);

      // Retrieve and verify
      const document = await getDocumentByTitle(testDb, testData.title);
      expect(document).toBeTruthy();
      expect(document.hash).toBe(testData.hash);
      expect(document.size).toBe(testData.size);
    });

    test('迁移后现有记录的 hash 和 size 应该为 NULL', async () => {
      // Insert test data before migration
      const testData = {
        user_id: 1,
        title: 'existing-document.pdf',
        content: 'Existing content',
        type: 'document',
        file_type: '.pdf'
      };

      await insertTestDocument(testDb, testData);

      // Apply migration
      await applyMigration(testDb);

      // Retrieve document
      const document = await getDocumentByTitle(testDb, testData.title);
      expect(document).toBeTruthy();
      expect(document.hash).toBeNull();
      expect(document.size).toBeNull();
    });

    test('应该能够更新现有记录的 hash 和 size', async () => {
      // Insert test data before migration
      const testData = {
        user_id: 1,
        title: 'update-test.pdf',
        content: 'Update test content',
        type: 'document',
        file_type: '.pdf'
      };

      await insertTestDocument(testDb, testData);

      // Apply migration
      await applyMigration(testDb);

      // Update hash and size
      const newHash = 'updated_hash_123';
      const newSize = 2048000;
      await updateDocumentHash(testDb, testData.title, newHash, newSize);

      // Retrieve and verify
      const document = await getDocumentByTitle(testDb, testData.title);
      expect(document.hash).toBe(newHash);
      expect(document.size).toBe(newSize);
    });
  });

  describe('索引性能测试', () => {
    test('hash 索引应该加速按 hash 查询', async () => {
      // Apply migration
      await applyMigration(testDb);

      // Insert multiple documents with hashes
      for (let i = 0; i < 100; i++) {
        await insertTestDocumentWithHash(testDb, {
          user_id: 1,
          title: `document-${i}.pdf`,
          content: `Content ${i}`,
          type: 'document',
          file_type: '.pdf',
          hash: `hash_${i}`,
          size: 1024 * i
        });
      }

      // Query by hash (should use index)
      const targetHash = 'hash_50';
      const document = await getDocumentByHash(testDb, targetHash);

      expect(document).toBeTruthy();
      expect(document.hash).toBe(targetHash);
    });

    test('user_filename 索引应该加速按用户和文件名查询', async () => {
      // Apply migration
      await applyMigration(testDb);

      // Insert multiple documents
      for (let i = 0; i < 100; i++) {
        await insertTestDocument(testDb, {
          user_id: i % 5, // 5 different users
          title: `document-${i}.pdf`,
          content: `Content ${i}`,
          type: 'document',
          file_type: '.pdf'
        });
      }

      // Query by user_id and title (should use index)
      const targetUserId = 2;
      const targetTitle = 'document-12.pdf';
      const document = await getDocumentByUserAndTitle(testDb, targetUserId, targetTitle);

      expect(document).toBeTruthy();
      expect(document.user_id).toBe(targetUserId);
      expect(document.title).toBe(targetTitle);
    });
  });
});

// Helper functions

/**
 * Create a test database with original schema
 */
function createTestDatabase(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        return reject(err);
      }

      // Create original documents table (without hash and size columns)
      db.run(`CREATE TABLE documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        type VARCHAR(50) DEFAULT 'document',
        file_type VARCHAR(50) DEFAULT '.md',
        metadata TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          return reject(err);
        }
        resolve(db);
      });
    });
  });
}

/**
 * Get table columns
 */
function getTableColumns(db, tableName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
      if (err) {
        return reject(err);
      }
      resolve(columns);
    });
  });
}

/**
 * Get table indexes
 */
function getTableIndexes(db, tableName) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name=?`, [tableName], (err, indexes) => {
      if (err) {
        return reject(err);
      }
      resolve(indexes);
    });
  });
}

/**
 * Insert test document
 */
function insertTestDocument(db, data) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO documents (user_id, title, content, type, file_type) VALUES (?, ?, ?, ?, ?)`,
      [data.user_id, data.title, data.content, data.type, data.file_type],
      function(err) {
        if (err) {
          return reject(err);
        }
        resolve(this.lastID);
      }
    );
  });
}

/**
 * Insert test document with hash and size
 */
function insertTestDocumentWithHash(db, data) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO documents (user_id, title, content, type, file_type, hash, size) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.user_id, data.title, data.content, data.type, data.file_type, data.hash, data.size],
      function(err) {
        if (err) {
          return reject(err);
        }
        resolve(this.lastID);
      }
    );
  });
}

/**
 * Get document count
 */
function getDocumentCount(db) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as count FROM documents`, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row.count);
    });
  });
}

/**
 * Get document by title
 */
function getDocumentByTitle(db, title) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM documents WHERE title = ?`, [title], (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row);
    });
  });
}

/**
 * Get document by hash
 */
function getDocumentByHash(db, hash) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM documents WHERE hash = ?`, [hash], (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row);
    });
  });
}

/**
 * Get document by user_id and title
 */
function getDocumentByUserAndTitle(db, userId, title) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM documents WHERE user_id = ? AND title = ?`, [userId, title], (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row);
    });
  });
}

/**
 * Update document hash and size
 */
function updateDocumentHash(db, title, hash, size) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE documents SET hash = ?, size = ? WHERE title = ?`,
      [hash, size, title],
      function(err) {
        if (err) {
          return reject(err);
        }
        resolve(this.changes);
      }
    );
  });
}
