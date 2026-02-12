/**
 * Knowledge Graph Status API Routes
 * 
 * Provides endpoints for querying and managing KG build status.
 */

const express = require('express');
const router = express.Router();
const { getInstance: getStatusManager } = require('../kg/services/status_manager');
const { getInstance: getKGService } = require('../kg/services/kg_service');

/**
 * GET /api/kg-status/:docId
 * Get build status for a single document
 */
router.get('/kg-status/:docId', async (req, res) => {
  try {
    const { docId } = req.params;

    if (!docId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      });
    }

    const statusManager = getStatusManager();
    const status = await statusManager.getStatus(docId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: `No build status found for document ${docId}`
      });
    }

    res.json({
      success: true,
      data: {
        docId: status.doc_id,
        status: status.status,
        createdAt: status.created_at,
        updatedAt: status.updated_at,
        errorMessage: status.error_message || undefined,
        errorCategory: status.error_category || undefined,
        entityCount: status.entity_count || 0,
        relationCount: status.relation_count || 0
      }
    });
  } catch (error) {
    console.error('[KGStatusRoutes] Error fetching status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/kg-status/batch
 * Get build status for multiple documents
 */
router.post('/kg-status/batch', async (req, res) => {
  try {
    const { docIds } = req.body;

    if (!Array.isArray(docIds)) {
      return res.status(400).json({
        success: false,
        error: 'docIds must be an array'
      });
    }

    if (docIds.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    const statusManager = getStatusManager();
    const statuses = await statusManager.getBatchStatus(docIds);

    // Transform to response format
    const data = statuses.map(status => ({
      docId: status.doc_id,
      status: status.status,
      createdAt: status.created_at,
      updatedAt: status.updated_at,
      errorMessage: status.error_message || undefined,
      errorCategory: status.error_category || undefined,
      entityCount: status.entity_count || 0,
      relationCount: status.relation_count || 0
    }));

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[KGStatusRoutes] Error fetching batch status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/kg-rebuild/:docId
 * Trigger knowledge graph rebuild for a document
 */
router.post('/kg-rebuild/:docId', async (req, res) => {
  try {
    const { docId } = req.params;

    if (!docId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      });
    }

    const statusManager = getStatusManager();

    // Check if document exists and get current status
    const currentStatus = await statusManager.getStatus(docId);

    if (!currentStatus) {
      return res.status(404).json({
        success: false,
        error: `No document found with ID ${docId}`
      });
    }

    // Prevent concurrent rebuilds
    if (currentStatus.status === 'building') {
      return res.status(409).json({
        success: false,
        error: 'A rebuild is already in progress for this document'
      });
    }

    // Get document details from database
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    const DB_PATH = path.join(__dirname, '../data/users.db');
    
    const document = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        db.get('SELECT * FROM documents WHERE id = ?', [docId], (err, row) => {
          if (err) {
            db.close();
            reject(err);
          } else {
            db.close();
            resolve(row);
          }
        });
      });
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: `Document ${docId} not found in database`
      });
    }

    // Reset status to pending
    await statusManager.updateStatus(docId, 'pending', {
      entityCount: 0,
      relationCount: 0
    });

    // Trigger rebuild using document hooks
    const { onDocumentCreated } = require('../kg/hooks/document_hooks');
    
    // Prepare document object for hook
    const docForHook = {
      id: document.id,
      title: document.title,
      content: document.content,
      fileType: document.file_type || document.fileType,
      metadata: document.metadata ? JSON.parse(document.metadata) : {}
    };

    // Trigger async rebuild
    onDocumentCreated(docForHook, { async: true, skipIfExists: false });

    res.json({
      success: true,
      message: `Rebuild triggered for document ${docId}`
    });
  } catch (error) {
    console.error('[KGStatusRoutes] Error triggering rebuild:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

module.exports = router;
