/**
 * Knowledge Graph API Routes
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../services/authService');
const ckbParser = require('../kg/ckb/ckb_parser');
const ckbStore = require('../kg/ckb/ckb_store');
const schemaManager = require('../kg/schema/schema_manager');
const entityStore = require('../kg/entity/entity_store');
const relationStore = require('../kg/relation/relation_store');
const kgService = require('../kg/services/kg_service');
const graphTraversal = require('../kg/services/graph_traversal');
const tokenTracker = require('../kg/utils/token_tracker');
const qualityFilter = require('../kg/confidence/quality_filter');
const { UniversalDocumentPipeline } = require('../kg/pipeline/universal_document_pipeline');

// Create Pipeline instance (lazy initialization)
let pipelineInstance = null;

function getPipelineInstance() {
  if (!pipelineInstance) {
    pipelineInstance = new UniversalDocumentPipeline({
      extraction: { useLLM: false },
      normalization: { useLLM: false },
      entityBuilding: { useLLM: false },
      relationExtraction: { enableSemantic: false }
    });
  }
  return pipelineInstance;
}

// ============================================
// CKB Routes
// ============================================

/**
 * Parse document to CKBs
 * POST /api/knowledge-graph/ckb/parse
 */
router.post('/ckb/parse', authMiddleware, async (req, res) => {
  try {
    const { docId, filePath, fileType } = req.body;
    
    if (!docId || !filePath || !fileType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: docId, filePath, fileType'
      });
    }
    
    // Parse document to CKBs
    const ckbs = await ckbParser.parseDocument(docId, filePath, fileType);
    
    // Save CKBs to database
    const saved = await ckbStore.saveCKBs(ckbs);
    
    res.json({
      success: true,
      data: {
        count: saved.length,
        ckbs: saved
      }
    });
  } catch (error) {
    console.error('Error parsing document to CKBs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get CKB by ID
 * GET /api/knowledge-graph/ckb/:id
 */
router.get('/ckb/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const ckb = await ckbStore.getCKB(id);
    
    if (!ckb) {
      return res.status(404).json({
        success: false,
        error: 'CKB not found'
      });
    }
    
    res.json({
      success: true,
      data: ckb
    });
  } catch (error) {
    console.error('Error getting CKB:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get CKBs by document ID
 * GET /api/knowledge-graph/ckb/document/:docId
 */
router.get('/ckb/document/:docId', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    
    const ckbs = await ckbStore.getCKBsByDocument(docId);
    
    res.json({
      success: true,
      data: {
        count: ckbs.length,
        ckbs: ckbs
      }
    });
  } catch (error) {
    console.error('Error getting CKBs by document:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get all CKBs
 * GET /api/knowledge-graph/ckb
 */
router.get('/ckb', authMiddleware, async (req, res) => {
  try {
    const { skip, take } = req.query;
    
    const ckbs = await ckbStore.getAllCKBs({
      skip: skip ? parseInt(skip) : 0,
      take: take ? parseInt(take) : 100
    });
    
    const total = await ckbStore.countCKBs();
    
    res.json({
      success: true,
      data: {
        total: total,
        count: ckbs.length,
        ckbs: ckbs
      }
    });
  } catch (error) {
    console.error('Error getting all CKBs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Schema Routes
// ============================================

/**
 * Get all schemas with optional filtering
 * GET /api/knowledge-graph/schemas
 * Query params:
 *   - scene: Filter by scene (e.g., "科研/政府", "个人生活")
 *   - active: Filter by active status (true/false)
 *   - skip: Pagination offset (default: 0)
 *   - take: Number of results (default: 100)
 */
router.get('/schemas', authMiddleware, async (req, res) => {
  try {
    const { scene, active, skip, take } = req.query;
    
    const filters = {};
    if (scene) filters.scene = scene;
    if (active !== undefined) filters.active = active === 'true';
    
    const options = {
      skip: skip ? parseInt(skip) : 0,
      take: take ? parseInt(take) : 100
    };
    
    const schemas = await schemaManager.getSchemas(filters, options);
    const total = await schemaManager.countSchemas(filters);
    
    res.json({
      success: true,
      data: {
        total: total,
        count: schemas.length,
        schemas: schemas
      }
    });
  } catch (error) {
    console.error('Error getting schemas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get schema by ID
 * GET /api/knowledge-graph/schemas/:id
 */
router.get('/schemas/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const schema = await schemaManager.getSchema(id);
    
    if (!schema) {
      return res.status(404).json({
        success: false,
        error: 'Schema not found'
      });
    }
    
    res.json({
      success: true,
      data: schema
    });
  } catch (error) {
    console.error('Error getting schema:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Create new schema
 * POST /api/knowledge-graph/schemas
 */
router.post('/schemas', authMiddleware, async (req, res) => {
  try {
    const schemaData = req.body;
    
    // Validate required fields
    if (!schemaData.schema_name || !schemaData.entity_type || !schemaData.core_fields) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: schema_name, entity_type, core_fields'
      });
    }
    
    const schema = await schemaManager.createSchema(schemaData);
    
    res.status(201).json({
      success: true,
      data: schema
    });
  } catch (error) {
    console.error('Error creating schema:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update schema
 * PUT /api/knowledge-graph/schemas/:id
 */
router.put('/schemas/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const schema = await schemaManager.updateSchema(id, updates);
    
    if (!schema) {
      return res.status(404).json({
        success: false,
        error: 'Schema not found'
      });
    }
    
    res.json({
      success: true,
      data: schema
    });
  } catch (error) {
    console.error('Error updating schema:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Delete schema
 * DELETE /api/knowledge-graph/schemas/:id
 */
router.delete('/schemas/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if schema has dependent entities
    const hasEntities = await schemaManager.hasEntities(id);
    
    if (hasEntities) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete schema with existing entities. Delete entities first.'
      });
    }
    
    await schemaManager.deleteSchema(id);
    
    res.json({
      success: true,
      message: 'Schema deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting schema:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Enable schema
 * PUT /api/knowledge-graph/schemas/:id/enable
 */
router.put('/schemas/:id/enable', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const schema = await schemaManager.updateSchema(id, { active: true });
    
    if (!schema) {
      return res.status(404).json({
        success: false,
        error: 'Schema not found'
      });
    }
    
    res.json({
      success: true,
      data: schema,
      message: 'Schema enabled successfully'
    });
  } catch (error) {
    console.error('Error enabling schema:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Disable schema
 * PUT /api/knowledge-graph/schemas/:id/disable
 */
router.put('/schemas/:id/disable', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const schema = await schemaManager.updateSchema(id, { active: false });
    
    if (!schema) {
      return res.status(404).json({
        success: false,
        error: 'Schema not found'
      });
    }
    
    res.json({
      success: true,
      data: schema,
      message: 'Schema disabled successfully'
    });
  } catch (error) {
    console.error('Error disabling schema:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Import schemas from file
 * POST /api/knowledge-graph/schemas/import
 */
router.post('/schemas/import', authMiddleware, async (req, res) => {
  try {
    const { filePath, skipExisting, updateExisting } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: filePath'
      });
    }
    
    const result = await schemaManager.importSchemas(filePath, {
      skipExisting: skipExisting !== false,
      updateExisting: updateExisting === true
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error importing schemas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Export schemas
 * GET /api/knowledge-graph/schemas/export
 * Query params:
 *   - format: Export format (json or csv, default: json)
 *   - scene: Filter by scene
 *   - active: Filter by active status
 */
router.get('/schemas/export', authMiddleware, async (req, res) => {
  try {
    const { format, scene, active } = req.query;
    
    const filters = {};
    if (scene) filters.scene = scene;
    if (active !== undefined) filters.active = active === 'true';
    
    const schemas = await schemaManager.getSchemas(filters);
    
    if (format === 'csv') {
      // Export as CSV
      const csv = schemaManager.exportToCSV(schemas);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=schemas.csv');
      res.send(csv);
    } else {
      // Export as JSON (default)
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=schemas.json');
      res.json({
        success: true,
        data: {
          count: schemas.length,
          schemas: schemas
        }
      });
    }
  } catch (error) {
    console.error('Error exporting schemas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get schema system status
 * GET /api/knowledge-graph/schemas/status
 * Returns current schema count and health status
 */
router.get('/schemas/status', async (req, res) => {
  try {
    const { schemaStartupCheck } = require('../kg');
    const status = await schemaStartupCheck.getSchemaStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting schema status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Force reimport all schemas
 * POST /api/knowledge-graph/schemas/reimport
 * Triggers a full reimport of schemas from SchemaList.md
 */
router.post('/schemas/reimport', authMiddleware, async (req, res) => {
  try {
    const { schemaStartupCheck } = require('../kg');
    const result = await schemaStartupCheck.forceReimport();
    
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    console.error('Error reimporting schemas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Entity Routes
// ============================================

/**
 * Search entities by name
 * GET /api/knowledge-graph/entities/search
 * Query params:
 *   - q: Search query (required)
 *   - skip: Pagination offset (default: 0)
 *   - take: Number of results (default: 100)
 */
router.get('/entities/search', authMiddleware, async (req, res) => {
  try {
    const { q, skip, take } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: q (search query)'
      });
    }
    
    const options = {
      skip: skip ? parseInt(skip) : 0,
      take: take ? parseInt(take) : 100
    };
    
    const entities = await entityStore.searchEntities(q, options);
    
    res.json({
      success: true,
      data: {
        query: q,
        count: entities.length,
        entities: entities
      }
    });
  } catch (error) {
    console.error('Error searching entities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get entity statistics
 * GET /api/knowledge-graph/entities/stats
 */
router.get('/entities/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await entityStore.getEntityStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting entity stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get all entities with optional filtering
 * GET /api/knowledge-graph/entities
 * Query params:
 *   - type: Filter by entity type (e.g., "EventEntity", "LocationEntity")
 *   - minConfidence: Minimum confidence threshold (0-1)
 *   - maxConfidence: Maximum confidence threshold (0-1)
 *   - skip: Pagination offset (default: 0)
 *   - take: Number of results (default: 100)
 *   - orderBy: Sort field (default: "createdAt")
 *   - order: Sort order ("asc" or "desc", default: "desc")
 */
router.get('/entities', authMiddleware, async (req, res) => {
  try {
    const { 
      type, 
      minConfidence, 
      maxConfidence, 
      skip, 
      take, 
      orderBy, 
      order 
    } = req.query;
    
    let entities;
    let total;
    
    const options = {
      skip: skip ? parseInt(skip) : 0,
      take: take ? parseInt(take) : 100,
      orderBy: orderBy || 'createdAt',
      order: order || 'desc'
    };
    
    // Filter by confidence range
    if (minConfidence !== undefined || maxConfidence !== undefined) {
      const min = minConfidence ? parseFloat(minConfidence) : 0;
      const max = maxConfidence ? parseFloat(maxConfidence) : 1.0;
      
      entities = await entityStore.getEntitiesByConfidence(min, max, {
        ...options,
        entityType: type || null
      });
      
      // Count with same filters
      const allFiltered = await entityStore.getEntitiesByConfidence(min, max, {
        entityType: type || null
      });
      total = allFiltered.length;
    }
    // Filter by type
    else if (type) {
      entities = await entityStore.getEntitiesByType(type, options);
      total = await entityStore.countEntities({ type });
    }
    // Get all entities
    else {
      entities = await entityStore.getAllEntities(options);
      total = await entityStore.countEntities();
    }
    
    res.json({
      success: true,
      data: {
        total: total,
        count: entities.length,
        entities: entities
      }
    });
  } catch (error) {
    console.error('Error getting entities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get entity by ID
 * GET /api/knowledge-graph/entities/:id
 */
router.get('/entities/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const entity = await entityStore.getEntityById(id);
    
    if (!entity) {
      return res.status(404).json({
        success: false,
        error: 'Entity not found'
      });
    }
    
    // Optionally include supporting CKBs
    const includeCKBs = req.query.includeCKBs === 'true';
    if (includeCKBs && entity.supported_by && entity.supported_by.length > 0) {
      const ckbs = [];
      for (const ckbId of entity.supported_by) {
        if (!ckbId) continue; // Skip null/undefined entries
        const ckb = await ckbStore.getCKB(ckbId);
        if (ckb) ckbs.push(ckb);
      }
      entity.supporting_ckbs = ckbs;
    }
    
    res.json({
      success: true,
      data: entity
    });
  } catch (error) {
    console.error('Error getting entity:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get entity context (original text with evidence)
 * GET /api/knowledge-graph/entities/:id/context
 * 
 * Returns the original text context where the entity was found,
 * with highlighted evidence locations.
 * 
 * Query params:
 *   - contextWindow: Context window size in characters (default: 100)
 *   - maxEvidence: Maximum number of evidence locations to return (default: 3)
 */
router.get('/entities/:id/context', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { contextWindow = 100, maxEvidence = 3 } = req.query;
    
    // Get entity
    const entity = await entityStore.getEntityById(id);
    
    if (!entity) {
      return res.status(404).json({
        success: false,
        error: 'Entity not found'
      });
    }
    
    // Check if entity has evidence information
    if (!entity.evidence || !entity.evidence.ckb_id) {
      return res.status(404).json({
        success: false,
        error: 'No evidence information available for this entity'
      });
    }
    
    // Get CKB
    const ckb = await ckbStore.getCKB(entity.evidence.ckb_id);
    
    if (!ckb) {
      return res.status(404).json({
        success: false,
        error: 'Source CKB not found'
      });
    }
    
    // Initialize Evidence Locator
    const { EvidenceLocator } = require('../kg/ckb/evidence_locator');
    const evidenceLocator = new EvidenceLocator({
      contextWindow: parseInt(contextWindow),
      maxEvidence: parseInt(maxEvidence)
    });
    
    // Get entity context
    const contextResult = evidenceLocator.getEntityContext(entity, [ckb], {
      contextWindow: parseInt(contextWindow)
    });
    
    res.json({
      success: true,
      data: {
        entity_id: id,
        entity_name: entity.canonical_name,
        entity_type: entity.entity_type,
        ckb_id: ckb.ckb_id,
        doc_id: ckb.doc_id,
        document_title: ckb.content?.title || 'Untitled',
        contexts: contextResult.contexts || [],
        total_locations: contextResult.total_locations || 0
      }
    });
  } catch (error) {
    console.error('Error getting entity context:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Relation Routes
// ============================================

/**
 * Get relation statistics
 * GET /api/knowledge-graph/relations/stats
 */
router.get('/relations/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await relationStore.getRelationStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting relation stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get all relations with optional filtering
 * GET /api/knowledge-graph/relations
 * Query params:
 *   - type: Filter by relation type (e.g., "builtin", "cooccurrence", "semantic")
 *   - minConfidence: Minimum confidence threshold (0-1)
 *   - skip: Pagination offset (default: 0)
 *   - take: Number of results (default: 100)
 *   - includeEntities: Include entity details (true/false, default: false)
 */
router.get('/relations', authMiddleware, async (req, res) => {
  try {
    const { type, minConfidence, skip, take, includeEntities } = req.query;
    
    const options = {
      skip: skip ? parseInt(skip) : 0,
      take: take ? parseInt(take) : 100,
      includeEntities: includeEntities === 'true'
    };
    
    if (type) {
      options.type = type;
    }
    
    if (minConfidence !== undefined) {
      options.minConfidence = parseFloat(minConfidence);
    }
    
    const relations = await relationStore.getAllRelations(options);
    const total = await relationStore.countRelations({
      type: options.type,
      minConfidence: options.minConfidence
    });
    
    res.json({
      success: true,
      data: {
        total: total,
        count: relations.length,
        relations: relations
      }
    });
  } catch (error) {
    console.error('Error getting relations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get relation by ID
 * GET /api/knowledge-graph/relations/:id
 */
router.get('/relations/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const relation = await relationStore.getRelationById(id);
    
    if (!relation) {
      return res.status(404).json({
        success: false,
        error: 'Relation not found'
      });
    }
    
    res.json({
      success: true,
      data: relation
    });
  } catch (error) {
    console.error('Error getting relation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get relation context (original text with evidence)
 * GET /api/knowledge-graph/relations/:id/context
 * 
 * Returns the original text context where the relation was found,
 * with highlighted evidence locations showing both source and target entities.
 * 
 * Query params:
 *   - contextWindow: Context window size in characters (default: 150)
 */
router.get('/relations/:id/context', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { contextWindow = 150 } = req.query;
    
    // Get relation
    const relation = await relationStore.getRelationById(id);
    
    if (!relation) {
      return res.status(404).json({
        success: false,
        error: 'Relation not found'
      });
    }
    
    // Check if relation has evidence information
    if (!relation.evidence_ckb || relation.evidence_ckb.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No evidence information available for this relation'
      });
    }
    
    // Get source and target entities
    const sourceEntity = await entityStore.getEntityById(relation.source_id);
    const targetEntity = await entityStore.getEntityById(relation.target_id);
    
    if (!sourceEntity || !targetEntity) {
      return res.status(404).json({
        success: false,
        error: 'Source or target entity not found'
      });
    }
    
    // Get CKB
    const ckbId = relation.evidence_ckb[0]; // Use first CKB
    const ckb = await ckbStore.getCKB(ckbId);
    
    if (!ckb) {
      return res.status(404).json({
        success: false,
        error: 'Source CKB not found'
      });
    }
    
    // Initialize Evidence Locator
    const { EvidenceLocator } = require('../kg/ckb/evidence_locator');
    const evidenceLocator = new EvidenceLocator({
      contextWindow: parseInt(contextWindow),
      maxEvidence: 3
    });
    
    // Locate relation evidence
    const relationEvidence = evidenceLocator.locateRelation(
      relation,
      sourceEntity,
      targetEntity,
      [ckb]
    );
    
    // Get contexts for both entities
    const sourceContext = evidenceLocator.getEntityContext(sourceEntity, [ckb], {
      contextWindow: parseInt(contextWindow)
    });
    
    const targetContext = evidenceLocator.getEntityContext(targetEntity, [ckb], {
      contextWindow: parseInt(contextWindow)
    });
    
    // Combine contexts
    const allContexts = [
      ...(sourceContext.contexts || []),
      ...(targetContext.contexts || [])
    ];
    
    // Remove duplicates based on text
    const uniqueContexts = [];
    const seenTexts = new Set();
    
    for (const ctx of allContexts) {
      if (!seenTexts.has(ctx.text)) {
        seenTexts.add(ctx.text);
        uniqueContexts.push(ctx);
      }
    }
    
    res.json({
      success: true,
      data: {
        relation_id: id,
        relation_type: relation.type,
        relation_subtype: relation.subtype,
        source_entity: {
          id: sourceEntity.entity_id,
          name: sourceEntity.canonical_name,
          type: sourceEntity.entity_type
        },
        target_entity: {
          id: targetEntity.entity_id,
          name: targetEntity.canonical_name,
          type: targetEntity.entity_type
        },
        ckb_id: ckb.ckb_id,
        doc_id: ckb.doc_id,
        document_title: ckb.content?.title || 'Untitled',
        evidence_text: relation.metadata?.evidence_text || null,
        contexts: uniqueContexts,
        total_locations: relationEvidence.total_locations || 0,
        confidence: relationEvidence.confidence || 0
      }
    });
  } catch (error) {
    console.error('Error getting relation context:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get relations for an entity
 * GET /api/knowledge-graph/entities/:entityId/relations
 * Query params:
 *   - type: Filter by relation type
 *   - minConfidence: Minimum confidence threshold
 *   - direction: Filter by direction ("outgoing", "incoming", "all", default: "all")
 *   - includeEntities: Include entity details (true/false, default: false)
 */
router.get('/entities/:entityId/relations', authMiddleware, async (req, res) => {
  try {
    const { entityId } = req.params;
    const { type, minConfidence, direction = 'all', includeEntities } = req.query;
    
    const options = {
      includeEntities: includeEntities === 'true'
    };
    
    if (type) {
      options.type = type;
    }
    
    if (minConfidence !== undefined) {
      options.minConfidence = parseFloat(minConfidence);
    }
    
    let relations;
    if (direction === 'outgoing') {
      relations = await relationStore.getOutgoingRelations(entityId, options);
    } else if (direction === 'incoming') {
      relations = await relationStore.getIncomingRelations(entityId, options);
    } else {
      relations = await relationStore.getRelationsByEntity(entityId, options);
    }
    
    res.json({
      success: true,
      data: {
        entity_id: entityId,
        direction: direction,
        count: relations.length,
        relations: relations
      }
    });
  } catch (error) {
    console.error('Error getting entity relations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Graph Traversal Routes
// ============================================

/**
 * Traverse graph using BFS or DFS
 * POST /api/knowledge-graph/traverse
 * Body:
 *   - startEntityId: Starting entity ID (required)
 *   - algorithm: "bfs" or "dfs" (default: "bfs")
 *   - maxDepth: Maximum traversal depth (default: 3)
 *   - relationTypes: Array of relation types to follow (optional)
 *   - minConfidence: Minimum confidence threshold (optional)
 */
router.post('/traverse', authMiddleware, async (req, res) => {
  try {
    const { 
      startEntityId, 
      algorithm = 'bfs', 
      maxDepth = 3, 
      relationTypes, 
      minConfidence 
    } = req.body;
    
    if (!startEntityId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: startEntityId'
      });
    }
    
    const options = {
      maxDepth,
      relationTypes: relationTypes || null,
      minConfidence: minConfidence || 0
    };
    
    let result;
    if (algorithm === 'dfs') {
      result = await graphTraversal.traverseDFS(startEntityId, options);
    } else {
      result = await graphTraversal.traverseBFS(startEntityId, options);
    }
    
    res.json({
      success: true,
      data: {
        algorithm,
        start_entity_id: startEntityId,
        max_depth: maxDepth,
        visited_count: result.visited.length,
        path_count: result.paths.length,
        visited: result.visited,
        paths: result.paths
      }
    });
  } catch (error) {
    console.error('Error traversing graph:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get neighbors of an entity
 * GET /api/knowledge-graph/neighbors/:id
 * Query params:
 *   - direction: "outgoing", "incoming", or "both" (default: "both")
 *   - relationTypes: Comma-separated relation types (optional)
 *   - minConfidence: Minimum confidence threshold (optional)
 */
router.get('/neighbors/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { direction = 'both', relationTypes, minConfidence } = req.query;
    
    const options = {
      direction,
      relationTypes: relationTypes ? relationTypes.split(',') : null,
      minConfidence: minConfidence ? parseFloat(minConfidence) : 0
    };
    
    const neighbors = await graphTraversal.getNeighbors(id, options);
    
    res.json({
      success: true,
      data: {
        entity_id: id,
        direction,
        count: neighbors.length,
        neighbors
      }
    });
  } catch (error) {
    console.error('Error getting neighbors:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Find shortest path between two entities
 * GET /api/knowledge-graph/path/:sourceId/:targetId
 * Query params:
 *   - relationTypes: Comma-separated relation types (optional)
 *   - minConfidence: Minimum confidence threshold (optional)
 */
router.get('/path/:sourceId/:targetId', authMiddleware, async (req, res) => {
  try {
    const { sourceId, targetId } = req.params;
    const { relationTypes, minConfidence } = req.query;
    
    const options = {
      relationTypes: relationTypes ? relationTypes.split(',') : null,
      minConfidence: minConfidence ? parseFloat(minConfidence) : 0
    };
    
    const path = await graphTraversal.findShortestPath(sourceId, targetId, options);
    
    if (!path) {
      return res.json({
        success: true,
        data: {
          source_id: sourceId,
          target_id: targetId,
          path_found: false,
          message: 'No path found between entities'
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        source_id: sourceId,
        target_id: targetId,
        path_found: true,
        length: path.length - 1,
        path
      }
    });
  } catch (error) {
    console.error('Error finding path:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get subgraph around an entity
 * GET /api/knowledge-graph/subgraph/:id
 * Query params:
 *   - depth: Subgraph depth (default: 2)
 *   - relationTypes: Comma-separated relation types (optional)
 *   - minConfidence: Minimum confidence threshold (optional)
 */
router.get('/subgraph/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { depth = 2, relationTypes, minConfidence } = req.query;
    
    const options = {
      depth: parseInt(depth),
      relationTypes: relationTypes ? relationTypes.split(',') : null,
      minConfidence: minConfidence ? parseFloat(minConfidence) : 0
    };
    
    const subgraph = await graphTraversal.getSubgraph(id, options);
    
    res.json({
      success: true,
      data: {
        center_entity_id: id,
        depth: options.depth,
        entity_count: subgraph.entities.length,
        relation_count: subgraph.relations.length,
        entities: subgraph.entities,
        relations: subgraph.relations
      }
    });
  } catch (error) {
    console.error('Error getting subgraph:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// KG Build/Update Routes
// ============================================

/**
 * Build knowledge graph from document
 * POST /api/knowledge-graph/build
 * Body:
 *   - docId: Document ID (required)
 *   - filePath: File path (required)
 *   - fileType: File type (required)
 *   - enableSemanticRelations: Enable semantic relation extraction (default: true)
 *   - enableQualityFilter: Enable quality filtering (default: true)
 */
router.post('/build', authMiddleware, async (req, res) => {
  try {
    const { 
      docId, 
      filePath, 
      fileType, 
      enableSemanticRelations = true,
      enableQualityFilter = true
    } = req.body;
    
    if (!docId || !filePath || !fileType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: docId, filePath, fileType'
      });
    }
    
    const options = {
      enableSemanticRelations,
      enableQualityFilter
    };
    
    const result = await kgService.buildKnowledgeGraph(docId, filePath, fileType, options);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error building knowledge graph:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update knowledge graph for modified document
 * POST /api/knowledge-graph/update
 * Body:
 *   - docId: Document ID (required)
 *   - filePath: File path (required)
 *   - fileType: File type (required)
 *   - enableSemanticRelations: Enable semantic relation extraction (default: true)
 *   - enableQualityFilter: Enable quality filtering (default: true)
 */
router.post('/update', authMiddleware, async (req, res) => {
  try {
    const { 
      docId, 
      filePath, 
      fileType,
      enableSemanticRelations = true,
      enableQualityFilter = true
    } = req.body;
    
    if (!docId || !filePath || !fileType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: docId, filePath, fileType'
      });
    }
    
    const options = {
      enableSemanticRelations,
      enableQualityFilter
    };
    
    const result = await kgService.updateKnowledgeGraph(docId, filePath, fileType, options);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error updating knowledge graph:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rebuild entire knowledge graph
 * POST /api/knowledge-graph/rebuild
 * Body:
 *   - enableSemanticRelations: Enable semantic relation extraction (default: true)
 *   - enableQualityFilter: Enable quality filtering (default: true)
 */
router.post('/rebuild', authMiddleware, async (req, res) => {
  try {
    const { 
      enableSemanticRelations = true,
      enableQualityFilter = true
    } = req.body;
    
    const options = {
      enableSemanticRelations,
      enableQualityFilter
    };
    
    const result = await kgService.rebuildKnowledgeGraph(options);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error rebuilding knowledge graph:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Delete knowledge graph for document
 * DELETE /api/knowledge-graph/document/:docId
 */
router.delete('/document/:docId', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    
    const result = await kgService.deleteKnowledgeGraph(docId);
    
    res.json({
      success: true,
      data: result,
      message: 'Knowledge graph deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting knowledge graph:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Stats Routes
// ============================================

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await kgService.getKnowledgeGraphStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get token usage statistics
 * GET /api/knowledge-graph/stats/tokens
 * Query params:
 *   - startDate: Start date (ISO format, optional)
 *   - endDate: End date (ISO format, optional)
 *   - module: Filter by module (optional)
 *   - operation: Filter by operation (optional)
 */
router.get('/stats/tokens', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, module, operation } = req.query;
    
    const filters = {};
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (module) filters.module = module;
    if (operation) filters.operation = operation;
    
    const stats = await tokenTracker.getTokenStats(filters);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting token stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get token usage time series
 * GET /api/knowledge-graph/stats/tokens/timeseries
 * Query params:
 *   - startDate: Start date (ISO format, required)
 *   - endDate: End date (ISO format, required)
 *   - interval: Time interval ("hour", "day", "week", default: "day")
 */
router.get('/stats/tokens/timeseries', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, interval = 'day' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: startDate, endDate'
      });
    }
    
    const timeSeries = await tokenTracker.getTokenUsageTimeSeries(
      new Date(startDate),
      new Date(endDate),
      interval
    );
    
    res.json({
      success: true,
      data: {
        start_date: startDate,
        end_date: endDate,
        interval,
        data_points: timeSeries.length,
        time_series: timeSeries
      }
    });
  } catch (error) {
    console.error('Error getting token time series:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get daily token budget status
 * GET /api/knowledge-graph/stats/tokens/budget
 */
router.get('/stats/tokens/budget', authMiddleware, async (req, res) => {
  try {
    const budgetStatus = await tokenTracker.getDailyBudgetStatus();
    
    res.json({
      success: true,
      data: budgetStatus
    });
  } catch (error) {
    console.error('Error getting token budget status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get token optimization recommendations
 * GET /api/knowledge-graph/stats/tokens/recommendations
 */
router.get('/stats/tokens/recommendations', authMiddleware, async (req, res) => {
  try {
    const recommendations = await tokenTracker.getOptimizationRecommendations();
    
    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Error getting optimization recommendations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get quality report
 * GET /api/knowledge-graph/stats/quality
 */
router.get('/stats/quality', authMiddleware, async (req, res) => {
  try {
    const qualityReport = await qualityFilter.runQualityCheck();
    
    res.json({
      success: true,
      data: qualityReport
    });
  } catch (error) {
    console.error('Error getting quality report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Performance Monitoring Routes
// ============================================

/**
 * Get performance statistics
 * GET /api/knowledge-graph/stats/performance
 * Query params:
 *   - timeRange: Time range in milliseconds (default: 3600000 = 1 hour)
 *   - includeDetails: Include detailed metrics (true/false, default: false)
 */
router.get('/stats/performance', authMiddleware, async (req, res) => {
  try {
    const { performanceMonitor } = require('../kg');
    const { timeRange, includeDetails } = req.query;
    
    const options = {
      timeRange: timeRange ? parseInt(timeRange) : 3600000,
      includeDetails: includeDetails === 'true'
    };
    
    const stats = performanceMonitor.getStats(options);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting performance stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get performance dashboard metrics
 * GET /api/knowledge-graph/stats/performance/dashboard
 * Returns comprehensive dashboard metrics for the last 24 hours
 */
router.get('/stats/performance/dashboard', authMiddleware, async (req, res) => {
  try {
    const { performanceMonitor } = require('../kg');
    
    const dashboard = performanceMonitor.getDashboardMetrics();
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Error getting performance dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get token budget status
 * GET /api/knowledge-graph/stats/budget/status
 * Returns current token budget status including daily usage and emergency mode
 */
router.get('/stats/budget/status', authMiddleware, async (req, res) => {
  try {
    const { tokenBudgetManager } = require('../kg');
    
    const status = tokenBudgetManager.getBudgetStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting budget status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get budget recommendations
 * GET /api/knowledge-graph/stats/budget/recommendations
 * Returns optimization recommendations based on current budget usage
 */
router.get('/stats/budget/recommendations', authMiddleware, async (req, res) => {
  try {
    const { tokenBudgetManager } = require('../kg');
    
    const recommendations = tokenBudgetManager.getRecommendations();
    
    res.json({
      success: true,
      data: {
        count: recommendations.length,
        recommendations
      }
    });
  } catch (error) {
    console.error('Error getting budget recommendations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get recent budget alerts
 * GET /api/knowledge-graph/stats/budget/alerts
 * Query params:
 *   - limit: Number of alerts to return (default: 10)
 */
router.get('/stats/budget/alerts', authMiddleware, async (req, res) => {
  try {
    const { tokenBudgetManager } = require('../kg');
    const { limit = 10 } = req.query;
    
    const alerts = tokenBudgetManager.getRecentAlerts(parseInt(limit));
    
    res.json({
      success: true,
      data: {
        count: alerts.length,
        alerts
      }
    });
  } catch (error) {
    console.error('Error getting budget alerts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get anchor generation metrics
 * GET /api/knowledge-graph/stats/anchor
 * 
 * Returns metrics for the anchor-driven entity synthesis system including:
 * - Anchor generation performance (count, success rate, duration)
 * - Entity merging statistics
 * - Conflict detection metrics
 * - LLM advisory usage
 * - Coverage statistics
 */
router.get('/stats/anchor', authMiddleware, async (req, res) => {
  try {
    const anchorGenerator = require('../kg/entity/anchor_generator');
    
    const metrics = anchorGenerator.getMetrics();
    const summary = anchorGenerator.getMetricsSummary();
    
    res.json({
      success: true,
      data: {
        summary,
        detailed: metrics
      }
    });
  } catch (error) {
    console.error('Error getting anchor metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Reset anchor generation metrics
 * POST /api/knowledge-graph/stats/anchor/reset
 * 
 * Resets all anchor system metrics to zero.
 * Useful for starting fresh monitoring after deployment or testing.
 */
router.post('/stats/anchor/reset', authMiddleware, async (req, res) => {
  try {
    const anchorGenerator = require('../kg/entity/anchor_generator');
    
    anchorGenerator.resetMetrics();
    
    res.json({
      success: true,
      message: 'Anchor metrics reset successfully'
    });
  } catch (error) {
    console.error('Error resetting anchor metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Enable emergency mode
 * POST /api/knowledge-graph/stats/budget/emergency/enable
 */
router.post('/stats/budget/emergency/enable', authMiddleware, async (req, res) => {
  try {
    const { tokenBudgetManager } = require('../kg');
    
    tokenBudgetManager.enableEmergencyMode();
    const status = tokenBudgetManager.getBudgetStatus();
    
    res.json({
      success: true,
      message: 'Emergency mode enabled',
      data: status
    });
  } catch (error) {
    console.error('Error enabling emergency mode:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Disable emergency mode
 * POST /api/knowledge-graph/stats/budget/emergency/disable
 */
router.post('/stats/budget/emergency/disable', authMiddleware, async (req, res) => {
  try {
    const { tokenBudgetManager } = require('../kg');
    
    tokenBudgetManager.disableEmergencyMode();
    const status = tokenBudgetManager.getBudgetStatus();
    
    res.json({
      success: true,
      message: 'Emergency mode disabled',
      data: status
    });
  } catch (error) {
    console.error('Error disabling emergency mode:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Universal Document Pipeline Routes
// ============================================

/**
 * Process single document using Pipeline
 * POST /api/knowledge-graph/pipeline/process
 * Body:
 *   - document: Document object (required)
 *     - id: Document ID
 *     - type: Document type (text, pdf, word, excel, markdown, html)
 *     - title: Document title (optional)
 *     - content: Document content
 *     - metadata: Document metadata (optional)
 *   - options: Pipeline options (optional)
 */
router.post('/pipeline/process', authMiddleware, async (req, res) => {
  try {
    const { document, options } = req.body;
    
    if (!document || !document.id || !document.content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: document.id, document.content'
      });
    }
    
    const pipeline = getPipelineInstance();
    const context = await pipeline.processDocument(document, options);
    
    res.json({
      success: true,
      data: {
        documentId: context.documentId,
        status: context.status,
        totalDuration: context.totalDuration,
        metrics: context.metrics,
        steps: Object.keys(context.steps).reduce((acc, step) => {
          acc[step] = {
            status: context.steps[step].status,
            duration: context.steps[step].duration
          };
          return acc;
        }, {}),
        warnings: context.warnings,
        errors: context.errors
      }
    });
  } catch (error) {
    console.error('Error processing document with pipeline:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Process multiple documents using Pipeline (batch)
 * POST /api/knowledge-graph/pipeline/batch
 * Body:
 *   - documents: Array of document objects (required)
 *   - options: Batch processing options (optional)
 *     - concurrency: Number of concurrent processes (default: 3)
 *     - stopOnFirstError: Stop on first error (default: false)
 */
router.post('/pipeline/batch', authMiddleware, async (req, res) => {
  try {
    const { documents, options } = req.body;
    
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: documents (must be non-empty array)'
      });
    }
    
    // Validate each document
    for (const doc of documents) {
      if (!doc.id || !doc.content) {
        return res.status(400).json({
          success: false,
          error: 'Each document must have id and content'
        });
      }
    }
    
    const pipeline = getPipelineInstance();
    const contexts = await pipeline.processBatch(documents, options);
    
    // Calculate statistics
    const completed = contexts.filter(c => c.status === 'completed').length;
    const partial = contexts.filter(c => c.status === 'partial').length;
    const failed = contexts.filter(c => c.status === 'failed').length;
    
    res.json({
      success: true,
      data: {
        total: contexts.length,
        completed,
        partial,
        failed,
        results: contexts.map(context => ({
          documentId: context.documentId,
          status: context.status,
          totalDuration: context.totalDuration,
          metrics: context.metrics,
          warnings: context.warnings.length,
          errors: context.errors.length
        }))
      }
    });
  } catch (error) {
    console.error('Error processing batch with pipeline:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get Pipeline configuration
 * GET /api/knowledge-graph/pipeline/config
 */
router.get('/pipeline/config', authMiddleware, async (req, res) => {
  try {
    const pipeline = getPipelineInstance();
    
    res.json({
      success: true,
      data: {
        extraction: pipeline.options.extraction,
        schemaMatching: pipeline.options.schemaMatching,
        normalization: pipeline.options.normalization,
        entityBuilding: pipeline.options.entityBuilding,
        relationExtraction: pipeline.options.relationExtraction
      }
    });
  } catch (error) {
    console.error('Error getting pipeline config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get Pipeline status
 * GET /api/knowledge-graph/pipeline/status
 */
router.get('/pipeline/status', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        available: true,
        version: '1.0.0',
        mode: process.env.USE_PIPELINE === 'true' ? 'enabled' : 'disabled',
        message: process.env.USE_PIPELINE === 'true' 
          ? 'Pipeline mode is enabled in hooks' 
          : 'Pipeline mode is disabled, using traditional kgService'
      }
    });
  } catch (error) {
    console.error('Error getting pipeline status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Relation Type Routes
// ============================================

const relationTypeStore = require('../kg/relation/relation_type_store');
const relationTypeQuery = require('../kg/relation/relation_type_query');
const relationTypeRegistry = require('../kg/relation/relation_type_registry');

/**
 * Get all relation types
 * GET /api/knowledge-graph/relation-types
 */
router.get('/relation-types', authMiddleware, async (req, res) => {
  try {
    const { domain, category, entityType, role, activeOnly } = req.query;
    
    let relationTypes;
    
    if (domain) {
      relationTypes = await relationTypeStore.findByDomain(domain, { activeOnly: activeOnly !== 'false' });
    } else if (category) {
      relationTypes = await relationTypeStore.findByCategory(category, { activeOnly: activeOnly !== 'false' });
    } else if (entityType) {
      relationTypes = await relationTypeStore.findByEntityType(entityType, role || 'both', { activeOnly: activeOnly !== 'false' });
    } else {
      relationTypes = await relationTypeStore.findAll({ activeOnly: activeOnly !== 'false' });
    }
    
    res.json({
      success: true,
      data: {
        count: relationTypes.length,
        relationTypes
      }
    });
  } catch (error) {
    console.error('Error getting relation types:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get relation type by ID
 * GET /api/knowledge-graph/relation-types/:id
 */
router.get('/relation-types/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const relationType = await relationTypeStore.findById(id);
    
    if (!relationType) {
      return res.status(404).json({
        success: false,
        error: 'Relation type not found'
      });
    }
    
    res.json({
      success: true,
      data: relationType
    });
  } catch (error) {
    console.error('Error getting relation type:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Register new relation type
 * POST /api/knowledge-graph/relation-types
 */
router.post('/relation-types', authMiddleware, async (req, res) => {
  try {
    const relationType = req.body;
    
    // Validate required fields
    const requiredFields = [
      'relationTypeId', 'name', 'displayName', 'domain', 'category',
      'sourceEntityTypes', 'targetEntityTypes'
    ];
    
    for (const field of requiredFields) {
      if (!relationType[field]) {
        return res.status(400).json({
          success: false,
          error: `Missing required field: ${field}`
        });
      }
    }
    
    // Create relation type
    const created = await relationTypeStore.create(relationType);
    
    res.status(201).json({
      success: true,
      data: created
    });
  } catch (error) {
    console.error('Error creating relation type:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update relation type
 * PUT /api/knowledge-graph/relation-types/:id
 */
router.put('/relation-types/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updated = await relationTypeStore.update(id, updates);
    
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('Error updating relation type:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Delete relation type
 * DELETE /api/knowledge-graph/relation-types/:id
 */
router.delete('/relation-types/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await relationTypeStore.delete(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Relation type not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Relation type deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting relation type:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get relation type statistics
 * GET /api/knowledge-graph/relation-types/stats
 */
router.get('/relation-types-stats', authMiddleware, async (req, res) => {
  try {
    const stats = await relationTypeStore.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting relation type stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Search relation types
 * GET /api/knowledge-graph/relation-types/search
 */
router.get('/relation-types-search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Missing search query parameter: q'
      });
    }
    
    const registry = relationTypeRegistry;
    const query = new relationTypeQuery(registry);
    const results = query.search(q);
    
    res.json({
      success: true,
      data: {
        count: results.length,
        results
      }
    });
  } catch (error) {
    console.error('Error searching relation types:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get compatible relation types for entity types
 * GET /api/knowledge-graph/relation-types/compatible
 */
router.get('/relation-types-compatible', authMiddleware, async (req, res) => {
  try {
    const { sourceEntityType, targetEntityType, role } = req.query;
    
    if (!sourceEntityType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: sourceEntityType'
      });
    }
    
    const registry = relationTypeRegistry;
    const query = new relationTypeQuery(registry);
    const compatibleTypes = query.getCompatibleTypes(
      sourceEntityType,
      targetEntityType || sourceEntityType,
      role || 'both'
    );
    
    res.json({
      success: true,
      data: {
        count: compatibleTypes.length,
        compatibleTypes
      }
    });
  } catch (error) {
    console.error('Error getting compatible relation types:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Graph Visualization Route
// ============================================

/**
 * Get knowledge graph visualization data
 * GET /api/knowledge-graph
 * 
 * Returns nodes and links formatted for frontend visualization.
 * Query params:
 *   - minConfidence: Minimum confidence threshold (default: 0.5)
 *   - maxNodes: Maximum number of nodes to return (default: 100)
 *   - entityType: Filter by entity type (optional)
 *   - relationType: Filter by relation type (optional)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { 
      minConfidence = 0.5, 
      maxNodes = 100,
      entityType,
      relationType
    } = req.query;
    
    // Get entities
    const entityOptions = {
      take: parseInt(maxNodes),
      orderBy: 'confidence',
      order: 'desc'
    };
    
    let entities;
    if (entityType) {
      entities = await entityStore.getEntitiesByType(entityType, entityOptions);
    } else {
      entities = await entityStore.getEntitiesByConfidence(
        parseFloat(minConfidence),
        1.0,
        entityOptions
      );
    }
    
    // If no entities found, return empty graph
    if (!entities || entities.length === 0) {
      return res.json({
        success: true,
        nodes: [],
        links: [],
        message: 'No entities found. Upload documents to build knowledge graph.'
      });
    }
    
    // Get entity IDs
    const entityIds = entities.map(e => e.entity_id);
    
    // Get relations between these entities
    const relationOptions = {
      minConfidence: parseFloat(minConfidence),
      includeEntities: false
    };
    
    if (relationType) {
      relationOptions.type = relationType;
    }
    
    const allRelations = await relationStore.getAllRelations(relationOptions);
    
    // Filter relations to only include those between our entities
    const entityIdSet = new Set(entityIds);
    const relations = allRelations.filter(r => 
      entityIdSet.has(r.source_id) && entityIdSet.has(r.target_id)
    );
    
    // Transform entities to nodes format
    const nodes = entities.map(entity => ({
      id: entity.entity_id,
      label: entity.canonical_name,
      type: entity.entity_type,
      confidence: entity.confidence,
      // Optional: add position hints (can be used by frontend for layout)
      // x and y will be calculated by frontend if not provided
    }));
    
    // Transform relations to links format
    const links = relations.map(relation => ({
      source: relation.source_id,
      target: relation.target_id,
      relation: relation.subtype || relation.type,
      confidence: relation.confidence,
      // Include human-readable description if available
      description: relation.metadata?.description || null
    }));
    
    res.json({
      success: true,
      nodes,
      links,
      metadata: {
        nodeCount: nodes.length,
        linkCount: links.length,
        minConfidence: parseFloat(minConfidence),
        filters: {
          entityType: entityType || 'all',
          relationType: relationType || 'all'
        }
      }
    });
  } catch (error) {
    console.error('Error getting graph visualization data:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      nodes: [],
      links: []
    });
  }
});

module.exports = router;
