/**
 * Knowledge Graph Build Status Manager
 * 
 * Manages CRUD operations for knowledge graph build status records.
 * Provides methods to create, update, query, and delete build status.
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Database path
const DB_PATH = path.join(__dirname, '../../data/users.db');

/**
 * StatusManager class
 */
class StatusManager {
  constructor(dbPath = DB_PATH) {
    this.dbPath = dbPath;
    this.db = null;
  }

  /**
   * Get database connection
   */
  async getDatabase() {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('[StatusManager] Error opening database:', err.message);
          return reject(err);
        }
        resolve(this.db);
      });
    });
  }

  /**
   * Close database connection
   */
  async close() {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          console.error('[StatusManager] Error closing database:', err.message);
          return reject(err);
        }
        this.db = null;
        resolve();
      });
    });
  }

  /**
   * Create a new build status record
   * 
   * @param {string} docId - Document ID
   * @param {string} status - Initial status (default: 'pending')
   * @returns {Promise<Object>} Created status record
   */
  async createStatus(docId, status = 'pending') {
      if (!docId) {
        throw new Error('Document ID is required');
      }

      const validStatuses = ['pending', 'building', 'completed', 'failed'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
      }

      try {
        const db = await this.getDatabase();

        return new Promise((resolve, reject) => {
          // Use INSERT OR REPLACE to handle existing records (upsert)
          db.run(
            `INSERT OR REPLACE INTO kg_build_status (doc_id, status, updated_at)
             VALUES (?, ?, datetime('now'))`,
            [docId, status],
            function(err) {
              if (err) {
                console.error('[StatusManager] Error creating status:', err.message);
                return reject(err);
              }

              // Fetch the created/updated record
              db.get(
                'SELECT * FROM kg_build_status WHERE doc_id = ?',
                [docId],
                (err, row) => {
                  if (err) {
                    console.error('[StatusManager] Error fetching created status:', err.message);
                    return reject(err);
                  }
                  console.log(`[StatusManager] Created/reset status for doc ${docId}: ${status}`);
                  resolve(row);
                }
              );
            }
          );
        });
      } catch (error) {
        console.error('[StatusManager] Failed to create status:', error.message);
        throw error;
      }
    }

  /**
   * Update build status
   * 
   * @param {string} docId - Document ID
   * @param {string} status - New status
   * @param {Object} metadata - Additional metadata
   * @param {string} metadata.errorMessage - Error message (for failed status)
   * @param {string} metadata.errorCategory - Error category (user_error, system_error, unknown_error)
   * @param {number} metadata.entityCount - Number of entities
   * @param {number} metadata.relationCount - Number of relations
   * @returns {Promise<Object>} Updated status record
   */
  async updateStatus(docId, status, metadata = {}) {
    if (!docId) {
      throw new Error('Document ID is required');
    }

    const validStatuses = ['pending', 'building', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    try {
      const db = await this.getDatabase();

      // Build update query dynamically based on metadata
      const updates = ['status = ?'];
      const params = [status];

      if (metadata.errorMessage !== undefined) {
        updates.push('error_message = ?');
        params.push(metadata.errorMessage);
      }

      if (metadata.errorCategory !== undefined) {
        const validCategories = ['user_error', 'system_error', 'unknown_error', null];
        if (metadata.errorCategory !== null && !validCategories.includes(metadata.errorCategory)) {
          throw new Error(`Invalid error category: ${metadata.errorCategory}`);
        }
        updates.push('error_category = ?');
        params.push(metadata.errorCategory);
      }

      if (metadata.entityCount !== undefined) {
        updates.push('entity_count = ?');
        params.push(metadata.entityCount);
      }

      if (metadata.relationCount !== undefined) {
        updates.push('relation_count = ?');
        params.push(metadata.relationCount);
      }

      params.push(docId);

      return new Promise((resolve, reject) => {
        db.run(
          `UPDATE kg_build_status 
           SET ${updates.join(', ')}
           WHERE doc_id = ?`,
          params,
          function(err) {
            if (err) {
              console.error('[StatusManager] Error updating status:', err.message);
              return reject(err);
            }

            if (this.changes === 0) {
              return reject(new Error(`No status record found for doc ${docId}`));
            }

            // Fetch the updated record
            db.get(
              'SELECT * FROM kg_build_status WHERE doc_id = ?',
              [docId],
              (err, row) => {
                if (err) {
                  console.error('[StatusManager] Error fetching updated status:', err.message);
                  return reject(err);
                }
                console.log(`[StatusManager] Updated status for doc ${docId}: ${status}`);
                resolve(row);
              }
            );
          }
        );
      });
    } catch (error) {
      console.error('[StatusManager] Failed to update status:', error.message);
      throw error;
    }
  }

  /**
   * Get build status for a single document
   * 
   * @param {string} docId - Document ID
   * @returns {Promise<Object|null>} Status record or null if not found
   */
  async getStatus(docId) {
    if (!docId) {
      throw new Error('Document ID is required');
    }

    try {
      const db = await this.getDatabase();

      return new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM kg_build_status WHERE doc_id = ?',
          [docId],
          (err, row) => {
            if (err) {
              console.error('[StatusManager] Error fetching status:', err.message);
              return reject(err);
            }
            resolve(row || null);
          }
        );
      });
    } catch (error) {
      console.error('[StatusManager] Failed to get status:', error.message);
      throw error;
    }
  }

  /**
   * Get detailed status with progress information
   * 
   * @param {string} docId - Document ID
   * @returns {Promise<Object|null>} Detailed status with progress or null if not found
   */
  async getDetailedStatus(docId) {
    if (!docId) {
      throw new Error('Document ID is required');
    }

    try {
      const status = await this.getStatus(docId);
      
      if (!status) {
        return null;
      }

      // If building or queued, try to get progress from queue manager
      if (status.status === 'building' || status.status === 'queued') {
        try {
          const { getInstance: getBuildQueueManager } = require('./build_queue_manager');
          const queueManager = getBuildQueueManager();
          
          const progress = queueManager.getProgress(docId);
          const queuePosition = queueManager.getQueuePosition(docId);
          
          return {
            ...status,
            progress: progress?.percentage || 0,
            currentStage: progress?.stage || 'unknown',
            estimatedTimeRemaining: progress?.estimatedTime || null,
            queuePosition: queuePosition || null
          };
        } catch (error) {
          console.error('[StatusManager] Error getting progress info:', error.message);
          // Return basic status if progress info unavailable
          return status;
        }
      }

      return status;
    } catch (error) {
      console.error('[StatusManager] Failed to get detailed status:', error.message);
      throw error;
    }
  }

  /**
   * Get build status for multiple documents
   * 
   * @param {Array<string>} docIds - Array of document IDs
   * @returns {Promise<Object>} Batch status summary with individual statuses
   */
  async getBatchStatus(docIds) {
    if (!Array.isArray(docIds) || docIds.length === 0) {
      return {
        total: 0,
        completed: 0,
        building: 0,
        failed: 0,
        pending: 0,
        statuses: []
      };
    }

    try {
      const db = await this.getDatabase();

      // Create placeholders for SQL IN clause
      const placeholders = docIds.map(() => '?').join(',');

      return new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM kg_build_status WHERE doc_id IN (${placeholders})`,
          docIds,
          (err, rows) => {
            if (err) {
              console.error('[StatusManager] Error fetching batch status:', err.message);
              return reject(err);
            }
            
            const statuses = rows || [];
            
            // Calculate summary statistics
            const summary = {
              total: docIds.length,
              completed: statuses.filter(s => s.status === 'completed').length,
              building: statuses.filter(s => s.status === 'building').length,
              failed: statuses.filter(s => s.status === 'failed').length,
              pending: statuses.filter(s => s.status === 'pending').length,
              statuses: statuses
            };
            
            resolve(summary);
          }
        );
      });
    } catch (error) {
      console.error('[StatusManager] Failed to get batch status:', error.message);
      throw error;
    }
  }

  /**
   * Delete build status record
   * 
   * @param {string} docId - Document ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteStatus(docId) {
    if (!docId) {
      throw new Error('Document ID is required');
    }

    try {
      const db = await this.getDatabase();

      return new Promise((resolve, reject) => {
        db.run(
          'DELETE FROM kg_build_status WHERE doc_id = ?',
          [docId],
          function(err) {
            if (err) {
              console.error('[StatusManager] Error deleting status:', err.message);
              return reject(err);
            }
            const deleted = this.changes > 0;
            if (deleted) {
              console.log(`[StatusManager] Deleted status for doc ${docId}`);
            }
            resolve(deleted);
          }
        );
      });
    } catch (error) {
      console.error('[StatusManager] Failed to delete status:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
let instance = null;

function getInstance() {
  if (!instance) {
    instance = new StatusManager();
  }
  return instance;
}

module.exports = {
  StatusManager,
  getInstance
};
