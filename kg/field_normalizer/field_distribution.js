/**
 * Field Distribution Statistics
 * 
 * Tracks unmapped field names and their frequencies to identify patterns
 * and guide synonym dictionary expansion.
 * 
 * Design Reference: Task 7.13.3 - Field Distribution Statistics
 * Validates: Requirement 18.19
 * 
 * Key Features:
 * - Record unmapped field names
 * - Track field occurrence frequency
 * - Identify high-frequency unmapped fields
 * - Provide statistics for dictionary expansion
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Record an unmapped field
 * 
 * Stores information about a field that failed to map to any schema field.
 * Updates frequency count if the field was seen before.
 * 
 * @param {Object} field - Unmapped field object
 * @param {string} schemaName - Schema name where mapping failed
 * @returns {Promise<Object>} Updated field distribution record
 * 
 * @example
 * await recordUnmappedField(
 *   { name: '时刻', value: '10:30', type: 'time' },
 *   '地下水位变化事件'
 * );
 */
async function recordUnmappedField(field, schemaName) {
  if (!field || !field.name || !schemaName) {
    throw new Error('field and schemaName are required');
  }
  
  try {
    // Try to find existing record
    const existing = await prisma.fieldDistribution.findUnique({
      where: { fieldName: field.name }
    });
    
    if (existing) {
      // Update existing record
      const schemas = existing.schemas ? JSON.parse(existing.schemas) : [];
      if (!schemas.includes(schemaName)) {
        schemas.push(schemaName);
      }
      
      return await prisma.fieldDistribution.update({
        where: { fieldName: field.name },
        data: {
          count: { increment: 1 },
          lastSeen: new Date(),
          schemas: JSON.stringify(schemas),
          fieldType: field.type || existing.fieldType,
          exampleValue: field.value || existing.exampleValue
        }
      });
    } else {
      // Create new record
      return await prisma.fieldDistribution.create({
        data: {
          fieldName: field.name,
          count: 1,
          lastSeen: new Date(),
          schemas: JSON.stringify([schemaName]),
          fieldType: field.type,
          exampleValue: field.value
        }
      });
    }
  } catch (error) {
    console.error('Error recording unmapped field:', error);
    throw error;
  }
}

/**
 * Record multiple unmapped fields in batch
 * 
 * @param {Array} unmappedFields - Array of unmapped field objects
 * @param {string} schemaName - Schema name
 * @returns {Promise<number>} Number of fields recorded
 */
async function recordUnmappedFieldsBatch(unmappedFields, schemaName) {
  if (!Array.isArray(unmappedFields)) {
    throw new Error('unmappedFields must be an array');
  }
  
  let recorded = 0;
  
  for (const field of unmappedFields) {
    try {
      await recordUnmappedField(field, schemaName);
      recorded++;
    } catch (error) {
      console.error(`Error recording field ${field.name}:`, error);
    }
  }
  
  return recorded;
}

/**
 * Get high-frequency unmapped fields
 * 
 * Returns fields that appear frequently but are not mapped,
 * indicating they should be added to the synonym dictionary.
 * 
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of high-frequency unmapped fields
 * 
 * @example
 * const highFreqFields = await getHighFrequencyUnmappedFields({
 *   minCount: 10,
 *   limit: 50
 * });
 * // Returns: [
 * //   { fieldName: '时刻', count: 45, schemas: ['Schema1', 'Schema2'], ... },
 * //   { fieldName: '发生时间', count: 32, schemas: ['Schema3'], ... }
 * // ]
 */
async function getHighFrequencyUnmappedFields(options = {}) {
  const {
    minCount = 5,
    limit = 50,
    orderBy = 'count'  // 'count' or 'lastSeen'
  } = options;
  
  try {
    const fields = await prisma.fieldDistribution.findMany({
      where: {
        count: { gte: minCount }
      },
      orderBy: orderBy === 'count' 
        ? { count: 'desc' }
        : { lastSeen: 'desc' },
      take: limit
    });
    
    return fields;
  } catch (error) {
    console.error('Error getting high-frequency fields:', error);
    return [];
  }
}

/**
 * Get field distribution statistics
 * 
 * Provides overall statistics about unmapped fields.
 * 
 * @returns {Promise<Object>} Statistics object
 * 
 * @example
 * const stats = await getFieldDistributionStats();
 * // Returns: {
 * //   totalUniqueFields: 150,
 * //   totalOccurrences: 1250,
 * //   avgOccurrencesPerField: 8.33,
 * //   highFrequencyFields: 25,
 * //   recentFields: 45
 * // }
 */
async function getFieldDistributionStats() {
  try {
    const totalUniqueFields = await prisma.fieldDistribution.count();
    
    const allFields = await prisma.fieldDistribution.findMany({
      select: { count: true }
    });
    
    const totalOccurrences = allFields.reduce((sum, f) => sum + f.count, 0);
    const avgOccurrencesPerField = totalUniqueFields > 0 
      ? totalOccurrences / totalUniqueFields 
      : 0;
    
    const highFrequencyFields = await prisma.fieldDistribution.count({
      where: { count: { gte: 10 } }
    });
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentFields = await prisma.fieldDistribution.count({
      where: { lastSeen: { gte: oneWeekAgo } }
    });
    
    return {
      totalUniqueFields,
      totalOccurrences,
      avgOccurrencesPerField: Math.round(avgOccurrencesPerField * 100) / 100,
      highFrequencyFields,
      recentFields
    };
  } catch (error) {
    console.error('Error getting field distribution stats:', error);
    return {
      totalUniqueFields: 0,
      totalOccurrences: 0,
      avgOccurrencesPerField: 0,
      highFrequencyFields: 0,
      recentFields: 0
    };
  }
}

/**
 * Get fields by schema
 * 
 * Returns all unmapped fields for a specific schema.
 * 
 * @param {string} schemaName - Schema name
 * @returns {Promise<Array>} Array of unmapped fields for the schema
 */
async function getFieldsBySchema(schemaName) {
  if (!schemaName) {
    throw new Error('schemaName is required');
  }
  
  try {
    // Get all fields and filter in JavaScript (SQLite doesn't support JSON array queries)
    const allFields = await prisma.fieldDistribution.findMany({
      orderBy: { count: 'desc' }
    });
    
    const filtered = allFields.filter(field => {
      try {
        const schemas = JSON.parse(field.schemas || '[]');
        return schemas.includes(schemaName);
      } catch (e) {
        return false;
      }
    });
    
    return filtered;
  } catch (error) {
    console.error('Error getting fields by schema:', error);
    return [];
  }
}

/**
 * Get fields by type
 * 
 * Returns all unmapped fields of a specific type.
 * 
 * @param {string} fieldType - Field type (time, location, number, etc.)
 * @returns {Promise<Array>} Array of unmapped fields of the type
 */
async function getFieldsByType(fieldType) {
  if (!fieldType) {
    throw new Error('fieldType is required');
  }
  
  try {
    const fields = await prisma.fieldDistribution.findMany({
      where: { fieldType },
      orderBy: { count: 'desc' }
    });
    
    return fields;
  } catch (error) {
    console.error('Error getting fields by type:', error);
    return [];
  }
}

/**
 * Clear old field distribution records
 * 
 * Removes records that haven't been seen in a specified number of days.
 * Useful for keeping the database clean.
 * 
 * @param {number} daysOld - Number of days (default: 90)
 * @returns {Promise<number>} Number of records deleted
 */
async function clearOldRecords(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  try {
    const result = await prisma.fieldDistribution.deleteMany({
      where: {
        lastSeen: { lt: cutoffDate },
        count: { lt: 5 }  // Only delete low-frequency old records
      }
    });
    
    return result.count;
  } catch (error) {
    console.error('Error clearing old records:', error);
    return 0;
  }
}

/**
 * Export field distribution data
 * 
 * Exports all field distribution data for analysis or backup.
 * 
 * @returns {Promise<Array>} All field distribution records
 */
async function exportFieldDistribution() {
  try {
    const fields = await prisma.fieldDistribution.findMany({
      orderBy: { count: 'desc' }
    });
    
    return fields;
  } catch (error) {
    console.error('Error exporting field distribution:', error);
    return [];
  }
}

/**
 * Get field suggestions for synonym dictionary expansion
 * 
 * Analyzes field distribution and suggests which fields should be added
 * to the synonym dictionary based on frequency and patterns.
 * 
 * @param {Object} options - Options for suggestion
 * @returns {Promise<Array>} Array of field suggestions
 */
async function getSuggestionsForDictionaryExpansion(options = {}) {
  const {
    minCount = 10,
    limit = 20
  } = options;
  
  try {
    // Get high-frequency fields
    const highFreqFields = await getHighFrequencyUnmappedFields({
      minCount,
      limit: limit * 2  // Get more to filter
    });
    
    // Group by field type for better suggestions
    const suggestions = [];
    const typeGroups = {};
    
    for (const field of highFreqFields) {
      const type = field.fieldType || 'unknown';
      if (!typeGroups[type]) {
        typeGroups[type] = [];
      }
      typeGroups[type].push(field);
    }
    
    // Create suggestions with context
    for (const [type, fields] of Object.entries(typeGroups)) {
      for (const field of fields.slice(0, Math.ceil(limit / Object.keys(typeGroups).length))) {
        let schemas = [];
        try {
          schemas = JSON.parse(field.schemas || '[]');
        } catch (e) {
          // Ignore parse errors
        }
        
        suggestions.push({
          fieldName: field.fieldName,
          count: field.count,
          fieldType: type,
          schemas: schemas,
          exampleValue: field.exampleValue,
          priority: calculatePriority(field),
          suggestedStandardField: suggestStandardField(field)
        });
      }
    }
    
    // Sort by priority
    suggestions.sort((a, b) => b.priority - a.priority);
    
    return suggestions.slice(0, limit);
  } catch (error) {
    console.error('Error getting suggestions:', error);
    return [];
  }
}

/**
 * Calculate priority for dictionary expansion
 * 
 * @param {Object} field - Field distribution record
 * @returns {number} Priority score
 */
function calculatePriority(field) {
  let priority = 0;
  
  // Frequency score (0-50)
  priority += Math.min(field.count, 50);
  
  // Recency score (0-30)
  const daysSinceLastSeen = (Date.now() - new Date(field.lastSeen).getTime()) / (1000 * 60 * 60 * 24);
  priority += Math.max(0, 30 - daysSinceLastSeen);
  
  // Schema diversity score (0-20)
  try {
    const schemas = JSON.parse(field.schemas || '[]');
    priority += Math.min(schemas.length * 5, 20);
  } catch (e) {
    // Ignore parse errors
  }
  
  return Math.round(priority);
}

/**
 * Suggest standard field for an unmapped field
 * 
 * @param {Object} field - Field distribution record
 * @returns {string|null} Suggested standard field name
 */
function suggestStandardField(field) {
  // Simple heuristic based on field type
  const typeToStandard = {
    'time': '时间',
    'location': '区域',
    'number': '数值',
    'unit': '单位',
    'indicator': '指标',
    'entity': '实体'
  };
  
  return typeToStandard[field.fieldType] || null;
}

module.exports = {
  recordUnmappedField,
  recordUnmappedFieldsBatch,
  getHighFrequencyUnmappedFields,
  getFieldDistributionStats,
  getFieldsBySchema,
  getFieldsByType,
  clearOldRecords,
  exportFieldDistribution,
  getSuggestionsForDictionaryExpansion
};
