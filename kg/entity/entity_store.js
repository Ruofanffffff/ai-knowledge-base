/**
 * Entity Store - Entity Persistence and Retrieval
 * 
 * Handles entity storage, querying, and management in the knowledge graph.
 * Provides CRUD operations and advanced querying capabilities.
 * 
 * Design Reference: Phase 3 - Entity Building Module (Section 6)
 * Validates: Requirements 4.11, 4.12, 9.1-9.10
 * 
 * Key Features:
 * - Entity CRUD operations
 * - Query by id, type, canonical_name, confidence
 * - Entity relationship tracking
 * - Confidence-based filtering
 * - Incremental updates
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Helper function to serialize entity for database storage
 * @param {Object} entity - Entity object
 * @returns {Object} Serialized entity for Prisma
 */
function serializeEntity(entity) {
  return {
    id: entity.entity_id,
    type: entity.entity_type,
    canonicalName: entity.canonical_name,
    aliases: JSON.stringify(entity.aliases || []),
    schemas: JSON.stringify(entity.schemas || []),
    supportedBy: JSON.stringify(entity.supported_by || []),
    attributes: JSON.stringify(entity.attributes || {}),
    confidence: entity.confidence,
    llmEnriched: entity.llm_enriched || false
  };
}

/**
 * Helper function to deserialize entity from database
 * @param {Object} dbEntity - Raw entity from database
 * @returns {Object} Entity with parsed JSON fields
 */
function deserializeEntity(dbEntity) {
  if (!dbEntity) return null;
  
  return {
    entity_id: dbEntity.id,
    entity_type: dbEntity.type,
    canonical_name: dbEntity.canonicalName,
    aliases: JSON.parse(dbEntity.aliases),
    schemas: JSON.parse(dbEntity.schemas),
    supported_by: JSON.parse(dbEntity.supportedBy),
    attributes: JSON.parse(dbEntity.attributes),
    confidence: dbEntity.confidence,
    llm_enriched: dbEntity.llmEnriched,
    created_at: dbEntity.createdAt.toISOString(),
    updated_at: dbEntity.updatedAt.toISOString()
  };
}

/**
 * Save entity to database
 * 
 * Creates a new entity or updates existing one.
 * 
 * @param {Object} entity - Entity object
 * @returns {Promise<Object>} Saved entity
 * 
 * @example
 * const entity = {
 *   entity_id: 'entity_001',
 *   entity_type: 'EventEntity',
 *   canonical_name: '阿里C区_水位_2025-01',
 *   aliases: ['阿里C区水位2025-01'],
 *   schemas: [{ schema_name: '地下水位变化事件', confidence: 0.92 }],
 *   supported_by: ['ckb_001'],
 *   attributes: { 区域: '阿里C区', 时间: '2025-01', 指标: '水位' },
 *   confidence: 0.9,
 *   llm_enriched: false
 * };
 * const saved = await saveEntity(entity);
 */
async function saveEntity(entity) {
  try {
    const data = serializeEntity(entity);
    
    const saved = await prisma.kGEntity.upsert({
      where: { id: entity.entity_id },
      update: {
        ...data,
        updatedAt: new Date()
      },
      create: data
    });
    
    return deserializeEntity(saved);
  } catch (error) {
    console.error('[EntityStore] Error saving entity:', error);
    throw error;
  }
}

/**
 * Save multiple entities in a transaction
 * 
 * @param {Array} entities - Array of entity objects
 * @returns {Promise<Array>} Saved entities
 */
async function saveEntities(entities) {
  try {
    const saved = await prisma.$transaction(
      entities.map(entity => {
        const data = serializeEntity(entity);
        return prisma.kGEntity.upsert({
          where: { id: entity.entity_id },
          update: {
            ...data,
            updatedAt: new Date()
          },
          create: data
        });
      })
    );
    
    return saved.map(deserializeEntity);
  } catch (error) {
    console.error('[EntityStore] Error saving entities:', error);
    throw error;
  }
}

/**
 * Get entity by ID
 * 
 * @param {string} entityId - Entity ID
 * @returns {Promise<Object|null>} Entity object or null if not found
 */
async function getEntityById(entityId) {
  try {
    const entity = await prisma.kGEntity.findUnique({
      where: { id: entityId }
    });
    
    return deserializeEntity(entity);
  } catch (error) {
    console.error('[EntityStore] Error getting entity by ID:', error);
    throw error;
  }
}

/**
 * Get entities by type
 * 
 * @param {string} entityType - Entity type (e.g., 'EventEntity', 'LocationEntity')
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of entities
 */
async function getEntitiesByType(entityType, options = {}) {
  try {
    const { skip = 0, take = 100, orderBy = 'createdAt', order = 'desc' } = options;
    
    const entities = await prisma.kGEntity.findMany({
      where: { type: entityType },
      skip,
      take,
      orderBy: { [orderBy]: order }
    });
    
    return entities.map(deserializeEntity);
  } catch (error) {
    console.error('[EntityStore] Error getting entities by type:', error);
    throw error;
  }
}

/**
 * Get entity by canonical name
 * 
 * @param {string} canonicalName - Canonical name
 * @returns {Promise<Object|null>} Entity object or null if not found
 */
async function getEntityByCanonicalName(canonicalName) {
  try {
    const entity = await prisma.kGEntity.findFirst({
      where: { canonicalName: canonicalName }
    });
    
    return deserializeEntity(entity);
  } catch (error) {
    console.error('[EntityStore] Error getting entity by canonical name:', error);
    throw error;
  }
}

/**
 * Search entities by name (canonical name or aliases)
 * 
 * @param {string} query - Search query
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of matching entities
 */
async function searchEntities(query, options = {}) {
  try {
    const { skip = 0, take = 100 } = options;
    
    // Since SQLite doesn't support JSON search, we need to fetch all entities
    // and filter in memory for alias matching
    const entities = await prisma.kGEntity.findMany({
      orderBy: { confidence: 'desc' }
    });
    
    // Filter for canonical name or aliases
    const filtered = entities.filter(entity => {
      const aliases = JSON.parse(entity.aliases);
      return entity.canonicalName.includes(query) || 
             aliases.some(alias => alias.includes(query));
    });
    
    // Apply pagination after filtering
    const paginated = filtered.slice(skip, skip + take);
    
    return paginated.map(deserializeEntity);
  } catch (error) {
    console.error('[EntityStore] Error searching entities:', error);
    throw error;
  }
}

/**
 * Get entities by confidence range
 * 
 * @param {number} minConfidence - Minimum confidence (0-1)
 * @param {number} maxConfidence - Maximum confidence (0-1)
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of entities
 */
async function getEntitiesByConfidence(minConfidence, maxConfidence = 1.0, options = {}) {
  try {
    const { skip = 0, take = 100, entityType = null } = options;
    
    const where = {
      confidence: {
        gte: minConfidence,
        lte: maxConfidence
      }
    };
    
    if (entityType) {
      where.type = entityType;
    }
    
    const entities = await prisma.kGEntity.findMany({
      where,
      skip,
      take,
      orderBy: { confidence: 'desc' }
    });
    
    return entities.map(deserializeEntity);
  } catch (error) {
    console.error('[EntityStore] Error getting entities by confidence:', error);
    throw error;
  }
}

/**
 * Get entities supported by specific CKB
 * 
 * @param {string} ckbId - CKB ID
 * @returns {Promise<Array>} Array of entities
 */
async function getEntitiesByCKB(ckbId) {
  try {
    // Get all entities and filter by supported_by
    // Note: SQLite doesn't support JSON search, so we fetch all and filter
    const entities = await prisma.kGEntity.findMany();
    
    const filtered = entities.filter(entity => {
      const supportedBy = JSON.parse(entity.supportedBy);
      return supportedBy.includes(ckbId);
    });
    
    return filtered.map(deserializeEntity);
  } catch (error) {
    console.error('[EntityStore] Error getting entities by CKB:', error);
    throw error;
  }
}

/**
 * Update entity
 * 
 * @param {string} entityId - Entity ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated entity
 */
async function updateEntity(entityId, updates) {
  try {
    // Serialize updates if they contain complex fields
    const data = {};
    
    if (updates.aliases) data.aliases = JSON.stringify(updates.aliases);
    if (updates.schemas) data.schemas = JSON.stringify(updates.schemas);
    if (updates.supported_by) data.supportedBy = JSON.stringify(updates.supported_by);
    if (updates.attributes) data.attributes = JSON.stringify(updates.attributes);
    if (updates.confidence !== undefined) data.confidence = updates.confidence;
    if (updates.llm_enriched !== undefined) data.llmEnriched = updates.llm_enriched;
    if (updates.canonical_name) data.canonicalName = updates.canonical_name;
    
    const updated = await prisma.kGEntity.update({
      where: { id: entityId },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
    
    return deserializeEntity(updated);
  } catch (error) {
    console.error('[EntityStore] Error updating entity:', error);
    throw error;
  }
}

/**
 * Delete entity by ID
 * 
 * @param {string} entityId - Entity ID
 * @returns {Promise<void>}
 */
async function deleteEntity(entityId) {
  try {
    await prisma.kGEntity.delete({
      where: { id: entityId }
    });
  } catch (error) {
    console.error('[EntityStore] Error deleting entity:', error);
    throw error;
  }
}

/**
 * Delete entities by confidence threshold
 * 
 * Removes low-quality entities below the threshold.
 * 
 * @param {number} threshold - Confidence threshold (entities below this are deleted)
 * @returns {Promise<number>} Number of deleted entities
 */
async function deleteEntitiesByConfidence(threshold) {
  try {
    const result = await prisma.kGEntity.deleteMany({
      where: {
        confidence: { lt: threshold }
      }
    });
    
    return result.count;
  } catch (error) {
    console.error('[EntityStore] Error deleting entities by confidence:', error);
    throw error;
  }
}

/**
 * Get all entities with pagination
 * 
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of entities
 */
async function getAllEntities(options = {}) {
  try {
    const { skip = 0, take = 100, orderBy = 'createdAt', order = 'desc' } = options;
    
    const entities = await prisma.kGEntity.findMany({
      skip,
      take,
      orderBy: { [orderBy]: order }
    });
    
    return entities.map(deserializeEntity);
  } catch (error) {
    console.error('[EntityStore] Error getting all entities:', error);
    throw error;
  }
}

/**
 * Count entities
 * 
 * @param {Object} where - Where clause
 * @returns {Promise<number>} Count
 */
async function countEntities(where = {}) {
  try {
    const count = await prisma.kGEntity.count({ where });
    return count;
  } catch (error) {
    console.error('[EntityStore] Error counting entities:', error);
    throw error;
  }
}

/**
 * Get entity statistics
 * 
 * @returns {Promise<Object>} Statistics object
 */
async function getEntityStats() {
  try {
    const total = await prisma.kGEntity.count();
    
    // Count by type
    const types = await prisma.kGEntity.groupBy({
      by: ['type'],
      _count: true
    });
    
    const byType = {};
    types.forEach(t => {
      byType[t.type] = t._count;
    });
    
    // Average confidence
    const avgResult = await prisma.kGEntity.aggregate({
      _avg: { confidence: true }
    });
    
    return {
      total,
      by_type: byType,
      average_confidence: avgResult._avg.confidence || 0
    };
  } catch (error) {
    console.error('[EntityStore] Error getting entity stats:', error);
    throw error;
  }
}

/**
 * Find entities with similar names
 * 
 * Used for entity deduplication and merging.
 * 
 * @param {string} canonicalName - Canonical name to search for
 * @param {string} entityType - Entity type filter
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {Promise<Array>} Array of similar entities
 */
async function findSimilarEntities(canonicalName, entityType, threshold = 0.7) {
  try {
    // Get all entities of the same type
    const entities = await prisma.kGEntity.findMany({
      where: { type: entityType }
    });
    
    // Calculate similarity and filter
    const similar = [];
    
    for (const entity of entities) {
      const similarity = calculateNameSimilarity(canonicalName, entity.canonicalName);
      
      if (similarity >= threshold) {
        const deserialized = deserializeEntity(entity);
        deserialized.similarity = similarity;
        similar.push(deserialized);
      }
    }
    
    // Sort by similarity (descending)
    return similar.sort((a, b) => b.similarity - a.similarity);
  } catch (error) {
    console.error('[EntityStore] Error finding similar entities:', error);
    throw error;
  }
}

/**
 * Calculate name similarity using Levenshtein distance
 * 
 * @param {string} name1 - First name
 * @param {string} name2 - Second name
 * @returns {number} Similarity score (0-1)
 */
function calculateNameSimilarity(name1, name2) {
  if (name1 === name2) return 1.0;
  
  const maxLen = Math.max(name1.length, name2.length);
  if (maxLen === 0) return 1.0;
  
  const distance = levenshteinDistance(name1, name2);
  return 1 - (distance / maxLen);
}

/**
 * Calculate Levenshtein distance
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // deletion
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

module.exports = {
  // Core CRUD operations
  saveEntity,
  saveEntities,
  getEntityById,
  getEntityByCanonicalName,
  updateEntity,
  deleteEntity,
  
  // Query operations
  getEntitiesByType,
  searchEntities,
  getEntitiesByConfidence,
  getEntitiesByCKB,
  getAllEntities,
  
  // Bulk operations
  deleteEntitiesByConfidence,
  
  // Statistics and analysis
  countEntities,
  getEntityStats,
  findSimilarEntities,
  
  // Helper functions (exported for testing)
  serializeEntity,
  deserializeEntity,
  calculateNameSimilarity,
  levenshteinDistance
};
