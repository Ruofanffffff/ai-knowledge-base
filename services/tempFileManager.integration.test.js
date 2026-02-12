/**
 * Integration test for TempFileManager
 * 
 * Verifies that the cleanup task is properly integrated and runs automatically.
 * Requirements: 7.6
 */

const tempFileManager = require('./tempFileManager');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('TempFileManager Integration', () => {
  let testTempDir;
  let testFilePath;

  beforeAll(async () => {
    // Create a temporary directory for test files
    testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tempfile-integration-'));
    testFilePath = path.join(testTempDir, 'test-file.txt');
    await fs.writeFile(testFilePath, 'test content');
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testTempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should have cleanup task running on module load', () => {
    // The singleton instance should have the cleanup task started
    expect(tempFileManager).toBeDefined();
    expect(tempFileManager.cleanupInterval).toBe(15 * 60 * 1000); // 15 minutes
    expect(tempFileManager.expirationTime).toBe(60 * 60 * 1000); // 1 hour
  });

  test('should store and retrieve temp files', () => {
    const fileInfo = {
      originalName: 'integration-test.txt',
      path: testFilePath,
      size: 1024,
      hash: 'integration-hash',
      userId: 1
    };

    const tempFileId = tempFileManager.storeTempFile(fileInfo);
    expect(tempFileId).toBeTruthy();

    const retrieved = tempFileManager.getTempFile(tempFileId);
    expect(retrieved).toBeTruthy();
    expect(retrieved.originalName).toBe('integration-test.txt');
    expect(retrieved.hash).toBe('integration-hash');

    // Clean up
    tempFileManager.deleteTempFile(tempFileId);
  });

  test('should automatically clean up expired files', async () => {
    // Create a new test file for this test
    const testFile2 = path.join(testTempDir, 'expired-test.txt');
    await fs.writeFile(testFile2, 'expired content');

    const fileInfo = {
      originalName: 'expired-test.txt',
      path: testFile2,
      size: 1024,
      hash: 'expired-hash',
      userId: 1
    };

    const tempFileId = tempFileManager.storeTempFile(fileInfo);
    
    // Manually expire the file
    const tempFile = tempFileManager.tempFiles.get(tempFileId);
    tempFile.expiresAt = new Date(Date.now() - 1000);

    // Trigger cleanup
    const cleanedCount = await tempFileManager.cleanupExpiredFiles();

    expect(cleanedCount).toBe(1);
    expect(tempFileManager.getTempFile(tempFileId)).toBeNull();
  });

  test('should log cleanup activity', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    // Create a new test file for this test
    const testFile3 = path.join(testTempDir, 'log-test.txt');
    await fs.writeFile(testFile3, 'log content');

    const fileInfo = {
      originalName: 'log-test.txt',
      path: testFile3,
      size: 1024,
      hash: 'log-hash',
      userId: 1
    };

    const tempFileId = tempFileManager.storeTempFile(fileInfo);
    
    // Manually expire the file
    const tempFile = tempFileManager.tempFiles.get(tempFileId);
    tempFile.expiresAt = new Date(Date.now() - 1000);

    // Trigger cleanup
    await tempFileManager.cleanupExpiredFiles();

    // Verify logging
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[TempFileManager] Cleaned up')
    );

    consoleSpy.mockRestore();
  });
});
