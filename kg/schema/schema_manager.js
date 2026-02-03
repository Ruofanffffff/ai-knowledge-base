/**
 * Schema Manager
 * 
 * Handles CRUD operations for schema definitions, validates schema structures,
 * and provides methods to query and filter schemas.
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.8
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Helper function to deserialize Schema JSON fields
 * @param {Object} schema - Raw schema from database
 * @returns {Object} Schema with parsed JSON fields
 */
function deserializeSchema(schema) {
  if (!schema) return null;
  
  return {
    schema_id: schema.id,
    schema_name: schema.name,
    entity_type: schema.entityType,
    scene: schema.scene,
    core_fields: JSON.parse(schema.coreFields),
    threshold: schema.threshold,
    relations: schema.relations ? JSON.parse(schema.relations) : [],
    example_description: schema.exampleDescription,
    description: schema.description,
    version: schema.version,
    active: schema.active,
    created_at: schema.createdAt,
    updated_at: schema.updatedAt
  };
}

/**
 * Validate schema structure
 * @param {Object} schema - Schema object to validate
 * @throws {Error} If schema is invalid
 */
function validateSchema(schema) {
  // Required fields
  if (!schema.schema_name || typeof schema.schema_name !== 'string') {
    throw new Error('schema_name is required and must be a string');
  }
  
  if (!schema.entity_type || typeof schema.entity_type !== 'string') {
    throw new Error('entity_type is required and must be a string');
  }
  
  if (!Array.isArray(schema.core_fields) || schema.core_fields.length === 0) {
    throw new Error('core_fields is required and must be a non-empty array');
  }
  
  if (typeof schema.threshold !== 'number' || schema.threshold < 0 || schema.threshold > 1) {
    throw new Error('threshold is required and must be a number between 0 and 1');
  }
  
  // Validate core_fields structure
  for (const field of schema.core_fields) {
    if (!field.name || typeof field.name !== 'string') {
      throw new Error('Each core_field must have a name (string)');
    }
    
    if (typeof field.weight !== 'number' || field.weight < 0 || field.weight > 1) {
      throw new Error('Each core_field must have a weight (number between 0 and 1)');
    }
    
    if (typeof field.required !== 'boolean') {
      throw new Error('Each core_field must have a required flag (boolean)');
    }
  }
  
  // Validate weights sum to approximately 1.0 (allow small floating point errors)
  const totalWeight = schema.core_fields.reduce((sum, field) => sum + field.weight, 0);
  if (Math.abs(totalWeight - 1.0) > 0.01) {
    throw new Error(`core_fields weights must sum to 1.0 (current sum: ${totalWeight})`);
  }
  
  // Validate relations structure (if provided)
  if (schema.relations) {
    if (!Array.isArray(schema.relations)) {
      throw new Error('relations must be an array');
    }
    
    for (const relation of schema.relations) {
      if (!relation.type || typeof relation.type !== 'string') {
        throw new Error('Each relation must have a type (string)');
      }
      
      if (!relation.target_field || typeof relation.target_field !== 'string') {
        throw new Error('Each relation must have a target_field (string)');
      }
      
      if (!relation.direction || !['outgoing', 'incoming'].includes(relation.direction)) {
        throw new Error('Each relation must have a direction (outgoing or incoming)');
      }
    }
  }
}

/**
 * Create a new schema
 * @param {Object} schema - Schema object
 * @returns {Promise<string>} Schema ID
 */
async function createSchema(schema) {
  try {
    // Validate schema structure
    validateSchema(schema);
    
    // Set default version if not provided
    const version = schema.version || '1.0.0';
    
    // Create schema in database
    const created = await prisma.schema.create({
      data: {
        name: schema.schema_name,
        entityType: schema.entity_type,
        scene: schema.scene || null,
        coreFields: JSON.stringify(schema.core_fields),
        threshold: schema.threshold,
        relations: schema.relations ? JSON.stringify(schema.relations) : null,
        exampleDescription: schema.example_description || null,
        description: schema.description || null,
        version: version,
        active: schema.active !== undefined ? schema.active : true
      }
    });
    
    return created.id;
  } catch (error) {
    if (error.code === 'P2002') {
      // Unique constraint violation
      throw new Error(`Schema with name '${schema.schema_name}' already exists`);
    }
    throw error;
  }
}

/**
 * Get schema by ID
 * @param {string} schemaId - Schema ID
 * @returns {Promise<Object>} Schema object
 */
async function getSchema(schemaId) {
  try {
    const schema = await prisma.schema.findUnique({
      where: { id: schemaId }
    });
    
    return deserializeSchema(schema);
  } catch (error) {
    console.error('Error getting schema:', error);
    throw error;
  }
}

/**
 * Get schema by name
 * @param {string} schemaName - Schema name
 * @returns {Promise<Object>} Schema object
 */
async function getSchemaByName(schemaName) {
  try {
    const schema = await prisma.schema.findUnique({
      where: { name: schemaName }
    });
    
    return deserializeSchema(schema);
  } catch (error) {
    console.error('Error getting schema by name:', error);
    throw error;
  }
}

/**
 * List all schemas
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of schemas
 */
async function listSchemas(options = {}) {
  try {
    const { 
      entityType = null,
      skip = 0, 
      take = 100,
      activeOnly = true  // 默认只返回活跃的Schema
    } = options;
    
    const where = {};
    if (entityType) {
      where.entityType = entityType;
    }
    if (activeOnly) {
      where.active = true;  // 只返回活跃的Schema
    }
    
    const schemas = await prisma.schema.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' }
    });
    
    return schemas.map(deserializeSchema);
  } catch (error) {
    console.error('Error listing schemas:', error);
    throw error;
  }
}

/**
 * Get schemas by entity type
 * @param {string} entityType - Entity type
 * @returns {Promise<Array>} Array of schemas
 */
async function getSchemasByEntityType(entityType) {
  try {
    const schemas = await prisma.schema.findMany({
      where: { entityType: entityType },
      orderBy: { createdAt: 'desc' }
    });
    
    return schemas.map(deserializeSchema);
  } catch (error) {
    console.error('Error getting schemas by entity type:', error);
    throw error;
  }
}

/**
 * Update schema
 * @param {string} schemaId - Schema ID
 * @param {Object} updates - Partial schema object with updates
 * @returns {Promise<void>}
 */
async function updateSchema(schemaId, updates) {
  try {
    // Get existing schema
    const existing = await prisma.schema.findUnique({
      where: { id: schemaId }
    });
    
    if (!existing) {
      throw new Error(`Schema with ID '${schemaId}' not found`);
    }
    
    // Merge updates with existing schema
    const merged = {
      schema_name: updates.schema_name || existing.name,
      entity_type: updates.entity_type || existing.entityType,
      core_fields: updates.core_fields || JSON.parse(existing.coreFields),
      threshold: updates.threshold !== undefined ? updates.threshold : existing.threshold,
      relations: updates.relations !== undefined ? updates.relations : (existing.relations ? JSON.parse(existing.relations) : []),
      version: updates.version || existing.version
    };
    
    // Validate merged schema
    validateSchema(merged);
    
    // Update in database
    await prisma.schema.update({
      where: { id: schemaId },
      data: {
        name: merged.schema_name,
        entityType: merged.entity_type,
        coreFields: JSON.stringify(merged.core_fields),
        threshold: merged.threshold,
        relations: merged.relations ? JSON.stringify(merged.relations) : null,
        version: merged.version
      }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      // Unique constraint violation
      throw new Error(`Schema with name '${updates.schema_name}' already exists`);
    }
    throw error;
  }
}

/**
 * Delete schema
 * @param {string} schemaId - Schema ID
 * @returns {Promise<void>}
 */
async function deleteSchema(schemaId) {
  try {
    await prisma.schema.delete({
      where: { id: schemaId }
    });
  } catch (error) {
    if (error.code === 'P2025') {
      // Record not found
      throw new Error(`Schema with ID '${schemaId}' not found`);
    }
    throw error;
  }
}

/**
 * Count schemas
 * @param {Object} where - Where clause
 * @returns {Promise<number>} Count
 */
async function countSchemas(where = {}) {
  try {
    const count = await prisma.schema.count({ where });
    return count;
  } catch (error) {
    console.error('Error counting schemas:', error);
    throw error;
  }
}

/**
 * Check if schema exists by name
 * @param {string} schemaName - Schema name
 * @returns {Promise<boolean>} True if exists
 */
async function schemaExists(schemaName) {
  try {
    const schema = await prisma.schema.findUnique({
      where: { name: schemaName }
    });
    return schema !== null;
  } catch (error) {
    console.error('Error checking schema existence:', error);
    throw error;
  }
}

/**
 * Get schemas with filtering and pagination
 * @param {Object} filters - Filter criteria
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of schemas
 */
async function getSchemas(filters = {}, options = {}) {
  try {
    const { skip = 0, take = 100 } = options;
    
    const where = {};
    if (filters.scene) where.scene = filters.scene;
    if (filters.active !== undefined) where.active = filters.active;
    if (filters.entityType) where.entityType = filters.entityType;
    
    const schemas = await prisma.schema.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' }
    });
    
    return schemas.map(deserializeSchema);
  } catch (error) {
    console.error('Error getting schemas:', error);
    throw error;
  }
}

/**
 * Check if schema has entities
 * @param {string} schemaId - Schema ID
 * @returns {Promise<boolean>} True if has entities
 */
async function hasEntities(schemaId) {
  try {
    // TODO: Implement when entity table is ready
    // For now, return false
    return false;
  } catch (error) {
    console.error('Error checking schema entities:', error);
    throw error;
  }
}

/**
 * Import schemas from file
 * @param {string} filePath - Path to schema file
 * @param {Object} options - Import options
 * @returns {Promise<Object>} Import result
 */
async function importSchemas(filePath, options = {}) {
  try {
    const { loadSchemasFromFile } = require('./schema_loader');
    const { skipExisting = true, updateExisting = false } = options;
    
    // Load schemas from file
    const schemas = await loadSchemasFromFile(filePath);
    
    const result = {
      total: schemas.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };
    
    for (const schema of schemas) {
      try {
        const exists = await schemaExists(schema.schema_name);
        
        if (exists) {
          if (updateExisting) {
            const existing = await getSchemaByName(schema.schema_name);
            await updateSchema(existing.schema_id, schema);
            result.updated++;
          } else if (skipExisting) {
            result.skipped++;
          } else {
            throw new Error(`Schema '${schema.schema_name}' already exists`);
          }
        } else {
          await createSchema(schema);
          result.created++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          schema: schema.schema_name,
          error: error.message
        });
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error importing schemas:', error);
    throw error;
  }
}

/**
 * Export schemas to CSV format
 * @param {Array} schemas - Array of schemas
 * @returns {string} CSV string
 */
function exportToCSV(schemas) {
  const headers = [
    'Schema Name',
    'Entity Type',
    'Scene',
    'Core Fields',
    'Threshold',
    'Example Description',
    'Description',
    'Active',
    'Version'
  ];
  
  const rows = schemas.map(schema => [
    schema.schema_name,
    schema.entity_type,
    schema.scene || '',
    schema.core_fields.map(f => `${f.name}(${f.weight})`).join(', '),
    schema.threshold,
    schema.example_description || '',
    schema.description || '',
    schema.active ? 'Yes' : 'No',
    schema.version
  ]);
  
  const csvLines = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ];
  
  return csvLines.join('\n');
}

module.exports = {
  createSchema,
  getSchema,
  getSchemaByName,
  listSchemas,
  getSchemasByEntityType,
  updateSchema,
  deleteSchema,
  countSchemas,
  schemaExists,
  validateSchema,
  getSchemas,
  hasEntities,
  importSchemas,
  exportToCSV
};
