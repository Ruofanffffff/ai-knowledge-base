/**
 * Temporary File Manager
 * 
 * Manages temporary files during the upload process, storing metadata in memory
 * and providing automatic cleanup of expired files.
 * 
 * Requirements: 7.6
 */

const fs = require('fs').promises;
const path = require('path');

class TempFileManager {
  constructor() {
    // In-memory storage for temporary file metadata
    this.tempFiles = new Map();
    
    // Expiration time: 1 hour (in milliseconds)
    this.expirationTime = 60 * 60 * 1000;
    
    // Cleanup interval: 15 minutes
    this.cleanupInterval = 15 * 60 * 1000;
    
    // Start cleanup task
    this.startCleanupTask();
  }

  /**
   * Store temporary file information
   * @param {Object} fileInfo - Temporary file information
   * @param {string} fileInfo.originalName - Original filename
   * @param {string} fileInfo.path - Path to temporary file
   * @param {number} fileInfo.size - File size in bytes
   * @param {string} fileInfo.hash - File content hash
   * @param {number} fileInfo.userId - User ID
   * @returns {string} - Unique temporary file ID
   */
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

  /**
   * Retrieve temporary file information
   * @param {string} tempFileId - Temporary file ID
   * @returns {Object|null} - Temporary file information or null if not found
   */
  getTempFile(tempFileId) {
    const tempFile = this.tempFiles.get(tempFileId);
    
    if (!tempFile) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > tempFile.expiresAt.getTime()) {
      this.deleteTempFile(tempFileId);
      return null;
    }
    
    return tempFile;
  }

  /**
   * Delete temporary file from memory and file system
   * @param {string} tempFileId - Temporary file ID
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async deleteTempFile(tempFileId) {
    const tempFile = this.tempFiles.get(tempFileId);
    
    if (!tempFile) {
      return false;
    }
    
    // Remove from memory
    this.tempFiles.delete(tempFileId);
    
    // Delete file from file system
    try {
      await fs.unlink(tempFile.path);
      console.log(`[TempFileManager] Deleted temp file: ${tempFile.path}`);
      return true;
    } catch (error) {
      // File might already be deleted or not exist
      console.error(`[TempFileManager] Error deleting temp file ${tempFile.path}:`, error.message);
      return false;
    }
  }

  /**
   * Generate unique temporary file ID
   * @returns {string} - Unique ID
   */
  generateTempFileId() {
    return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Start background cleanup task
   */
  startCleanupTask() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredFiles();
    }, this.cleanupInterval);
    
    // Prevent the timer from keeping the process alive
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
    
    console.log('[TempFileManager] Cleanup task started (runs every 15 minutes)');
  }

  /**
   * Stop background cleanup task
   */
  stopCleanupTask() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('[TempFileManager] Cleanup task stopped');
    }
  }

  /**
   * Clean up expired temporary files
   * @returns {Promise<number>} - Number of files cleaned up
   */
  async cleanupExpiredFiles() {
    const now = Date.now();
    const expiredFiles = [];
    
    // Find expired files
    for (const [tempFileId, tempFile] of this.tempFiles.entries()) {
      if (now > tempFile.expiresAt.getTime()) {
        expiredFiles.push(tempFileId);
      }
    }
    
    // Delete expired files
    let cleanedCount = 0;
    for (const tempFileId of expiredFiles) {
      const deleted = await this.deleteTempFile(tempFileId);
      if (deleted) {
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[TempFileManager] Cleaned up ${cleanedCount} expired temp file(s)`);
    }
    
    return cleanedCount;
  }

  /**
   * Get count of temporary files in memory
   * @returns {number} - Number of temporary files
   */
  getTempFileCount() {
    return this.tempFiles.size;
  }

  /**
   * Clear all temporary files (for testing purposes)
   * @returns {Promise<number>} - Number of files cleared
   */
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
}

// Export singleton instance
const tempFileManager = new TempFileManager();

module.exports = tempFileManager;
