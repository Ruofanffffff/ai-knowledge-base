/**
 * Unit tests for TempFileManager
 * 
 * Tests temporary file storage, retrieval, deletion, expiration, and cleanup.
 * Requirements: 7.6
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Import the TempFileManager class directly for testing
const TempFileManager = require('./tempFileManager').constructor || class TempFileManager {
  constructor() {
    this.tempFiles = new Map();
    this.expirationTime = 60 * 60 * 1000;
    this.cleanupInterval = 15 * 60 * 1000;
  }
  
  storeTempFile(fileInfo) {
    const tempFileId = this.generateTempFileId();
    const now = Date.now();
    
    this.tempFiles.set(tempFileId, {
      id: tempFileId,
      originalName: fileInfo.originalName,
      path: fileInfo.path,
      size: fileInfo.size,
      hash: fileInfo.hash,
      userId: fileInfo.userId,
      uploadedAt: new Date(now),
      expiresAt: new Date(now + this.expirationTime)
    });
    
    return tempFileId;
  }
  
  getTempFile(tempFileId) {
    const tempFile = this.tempFiles.get(tempFileId);
    
    if (!tempFile) {
      return null;
    }
    
    if (Date.now() > tempFile.expiresAt.getTime()) {
      this.deleteTempFile(tempFileId);
      return null;
    }
    
    return tempFile;
  }
  
  async deleteTempFile(tempFileId) {
    const tempFile = this.tempFiles.get(tempFileId);
    
    if (!tempFile) {
      return false;
    }
    
    this.tempFiles.delete(tempFileId);
    
    try {
      await fs.unlink(tempFile.path);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  generateTempFileId() {
    return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  
  startCleanupTask() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredFiles();
    }, this.cleanupInterval);
    
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }
  
  stopCleanupTask() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
  
  async cleanupExpiredFiles() {
    const now = Date.now();
    const expiredFiles = [];
    
    for (const [tempFileId, tempFile] of this.tempFiles.entries()) {
      if (now > tempFile.expiresAt.getTime()) {
        expiredFiles.push(tempFileId);
      }
    }
    
    let cleanedCount = 0;
    for (const tempFileId of expiredFiles) {
      const deleted = await this.deleteTempFile(tempFileId);
      if (deleted) {
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }
  
  getTempFileCount() {
    return this.tempFiles.size;
  }
  
  async clearAll() {
    const tempFileIds = Array.from(this.tempFiles.keys());
    let clearedCount = 0;
    
    for (const tempFileId of tempFileIds) {
      const deleted = await this.deleteTempFile(tempFileId);
      if (deleted) {
        clearedCount++;
      }
    }
    
    return clearedCount;
  }
};

describe('TempFileManager', () => {
  let manager;
  let testTempDir;
  let testFilePath;

  beforeEach(async () => {
    // Create a new manager instance for each test
    manager = new TempFileManager();
    
    // Create a temporary directory for test files
    testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tempfile-test-'));
    testFilePath = path.join(testTempDir, 'test-file.txt');
    
    // Create a test file
    await fs.writeFile(testFilePath, 'test content');
  });

  afterEach(async () => {
    // Stop cleanup task
    if (manager.stopCleanupTask) {
      manager.stopCleanupTask();
    }
    
    // Clean up test directory
    try {
      await fs.rm(testTempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('storeTempFile', () => {
    test('should store temporary file information', () => {
      const fileInfo = {
        originalName: 'test.txt',
        path: testFilePath,
        size: 1024,
        hash: 'abc123',
        userId: 1
      };

      const tempFileId = manager.storeTempFile(fileInfo);

      expect(tempFileId).toBeTruthy();
      expect(tempFileId).toMatch(/^temp_\d+_[a-z0-9]+$/);
      expect(manager.getTempFileCount()).toBe(1);
    });

    test('should generate unique IDs for multiple files', () => {
      const fileInfo = {
        originalName: 'test.txt',
        path: testFilePath,
        size: 1024,
        hash: 'abc123',
        userId: 1
      };

      const id1 = manager.storeTempFile(fileInfo);
      const id2 = manager.storeTempFile(fileInfo);
      const id3 = manager.storeTempFile(fileInfo);

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
      expect(manager.getTempFileCount()).toBe(3);
    });

    test('should set expiration time to 1 hour from now', () => {
      const fileInfo = {
        originalName: 'test.txt',
        path: testFilePath,
        size: 1024,
        hash: 'abc123',
        userId: 1
      };

      const now = Date.now();
      const tempFileId = manager.storeTempFile(fileInfo);
      const tempFile = manager.getTempFile(tempFileId);

      expect(tempFile).toBeTruthy();
      expect(tempFile.expiresAt.getTime()).toBeGreaterThan(now);
      expect(tempFile.expiresAt.getTime()).toBeLessThanOrEqual(now + 60 * 60 * 1000 + 100);
    });
  });

  describe('getTempFile', () => {
    test('should retrieve stored temporary file', () => {
      const fileInfo = {
        originalName: 'test.txt',
        path: testFilePath,
        size: 1024,
        hash: 'abc123',
        userId: 1
      };

      const tempFileId = manager.storeTempFile(fileInfo);
      const retrieved = manager.getTempFile(tempFileId);

      expect(retrieved).toBeTruthy();
      expect(retrieved.id).toBe(tempFileId);
      expect(retrieved.originalName).toBe('test.txt');
      expect(retrieved.path).toBe(testFilePath);
      expect(retrieved.size).toBe(1024);
      expect(retrieved.hash).toBe('abc123');
      expect(retrieved.userId).toBe(1);
    });

    test('should return null for non-existent ID', () => {
      const retrieved = manager.getTempFile('non-existent-id');
      expect(retrieved).toBeNull();
    });

    test('should return null and delete expired file', async () => {
      const fileInfo = {
        originalName: 'test.txt',
        path: testFilePath,
        size: 1024,
        hash: 'abc123',
        userId: 1
      };

      const tempFileId = manager.storeTempFile(fileInfo);
      
      // Manually set expiration to past
      const tempFile = manager.tempFiles.get(tempFileId);
      tempFile.expiresAt = new Date(Date.now() - 1000);

      const retrieved = manager.getTempFile(tempFileId);

      expect(retrieved).toBeNull();
      expect(manager.getTempFileCount()).toBe(0);
    });
  });

  describe('deleteTempFile', () => {
    test('should delete temporary file from memory and file system', async () => {
      const fileInfo = {
        originalName: 'test.txt',
        path: testFilePath,
        size: 1024,
        hash: 'abc123',
        userId: 1
      };

      const tempFileId = manager.storeTempFile(fileInfo);
      expect(manager.getTempFileCount()).toBe(1);

      const deleted = await manager.deleteTempFile(tempFileId);

      expect(deleted).toBe(true);
      expect(manager.getTempFileCount()).toBe(0);
      expect(manager.getTempFile(tempFileId)).toBeNull();
      
      // Verify file is deleted from file system
      await expect(fs.access(testFilePath)).rejects.toThrow();
    });

    test('should return false for non-existent ID', async () => {
      const deleted = await manager.deleteTempFile('non-existent-id');
      expect(deleted).toBe(false);
    });

    test('should handle file system errors gracefully', async () => {
      const fileInfo = {
        originalName: 'test.txt',
        path: '/non/existent/path/file.txt',
        size: 1024,
        hash: 'abc123',
        userId: 1
      };

      const tempFileId = manager.storeTempFile(fileInfo);
      const deleted = await manager.deleteTempFile(tempFileId);

      // Should still remove from memory even if file doesn't exist
      expect(deleted).toBe(false);
      expect(manager.getTempFileCount()).toBe(0);
    });
  });

  describe('cleanupExpiredFiles', () => {
    test('should clean up expired files', async () => {
      // Create multiple temp files
      const fileInfo1 = {
        originalName: 'test1.txt',
        path: testFilePath,
        size: 1024,
        hash: 'abc123',
        userId: 1
      };

      const fileInfo2 = {
        originalName: 'test2.txt',
        path: path.join(testTempDir, 'test2.txt'),
        size: 2048,
        hash: 'def456',
        userId: 1
      };

      await fs.writeFile(fileInfo2.path, 'test content 2');

      const id1 = manager.storeTempFile(fileInfo1);
      const id2 = manager.storeTempFile(fileInfo2);

      expect(manager.getTempFileCount()).toBe(2);

      // Expire first file
      const tempFile1 = manager.tempFiles.get(id1);
      tempFile1.expiresAt = new Date(Date.now() - 1000);

      const cleanedCount = await manager.cleanupExpiredFiles();

      expect(cleanedCount).toBe(1);
      expect(manager.getTempFileCount()).toBe(1);
      expect(manager.getTempFile(id1)).toBeNull();
      expect(manager.getTempFile(id2)).toBeTruthy();
    });

    test('should not clean up non-expired files', async () => {
      const fileInfo = {
        originalName: 'test.txt',
        path: testFilePath,
        size: 1024,
        hash: 'abc123',
        userId: 1
      };

      const tempFileId = manager.storeTempFile(fileInfo);
      const cleanedCount = await manager.cleanupExpiredFiles();

      expect(cleanedCount).toBe(0);
      expect(manager.getTempFileCount()).toBe(1);
      expect(manager.getTempFile(tempFileId)).toBeTruthy();
    });

    test('should return 0 when no files to clean', async () => {
      const cleanedCount = await manager.cleanupExpiredFiles();
      expect(cleanedCount).toBe(0);
    });
  });

  describe('clearAll', () => {
    test('should clear all temporary files', async () => {
      const fileInfo1 = {
        originalName: 'test1.txt',
        path: testFilePath,
        size: 1024,
        hash: 'abc123',
        userId: 1
      };

      const fileInfo2 = {
        originalName: 'test2.txt',
        path: path.join(testTempDir, 'test2.txt'),
        size: 2048,
        hash: 'def456',
        userId: 1
      };

      await fs.writeFile(fileInfo2.path, 'test content 2');

      manager.storeTempFile(fileInfo1);
      manager.storeTempFile(fileInfo2);

      expect(manager.getTempFileCount()).toBe(2);

      const clearedCount = await manager.clearAll();

      expect(clearedCount).toBe(2);
      expect(manager.getTempFileCount()).toBe(0);
    });
  });

  describe('cleanup task', () => {
    test('should start cleanup task on initialization', () => {
      const newManager = new TempFileManager();
      expect(newManager.cleanupTimer).toBeTruthy();
      newManager.stopCleanupTask();
    });

    test('should stop cleanup task', () => {
      manager.startCleanupTask();
      expect(manager.cleanupTimer).toBeTruthy();
      
      manager.stopCleanupTask();
      expect(manager.cleanupTimer).toBeNull();
    });
  });
});
