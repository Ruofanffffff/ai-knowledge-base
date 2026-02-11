/**
 * Helper functions for anchor fields migration
 * Exported for testing purposes
 */

/**
 * Verbose log function (stub for testing)
 */
function vlog(message, level = 'DEBUG') {
  // This is a stub - actual implementation uses options.verbose
  if (process.env.VERBOSE === 'true') {
    console.log(`[${level}] ${message}`);
  }
}

/**
 * Extract anchor fields from entity attributes
 * 
 * This function extracts anchor field values from an entity's attributes.
 * If a schema definition is provided, it uses the schema's anchor_fields configuration.
 * Otherwise, it falls back to common anchor field names.
 * 
 * @param {Object} entity - KGEntity record
 * @param {Object} [schema] - Optional schema definition with anchor_fields configuration
 * @returns {Object} Anchor fields key-value pairs
 */
function extractAnchorFieldsFromEntity(entity, schema = null) {
  try {
    const attributes = JSON.parse(entity.attributes || '{}');
    const anchorFields = {};
    
    // If schema is provided, use its anchor_fields configuration
    if (schema && schema.anchor_fields) {
      const anchorFieldsConfig = schema.anchor_fields;
      
      for (const fieldConfig of anchorFieldsConfig) {
        const fieldName = typeof fieldConfig === 'string' ? fieldConfig : fieldConfig.name;
        const fieldValue = attributes[fieldName];
        
        if (fieldValue !== undefined && fieldValue !== null) {
          anchorFields[fieldName] = fieldValue;
        }
      }
      
      return anchorFields;
    }
    
    // Fallback: Use common anchor field names across different entity types
    const commonAnchorFields = [
      '区域', 'Location', 'location', 'place', 'area',
      '时间', 'Time', 'time', 'date', 'Timestamp', 'timestamp',
      '指标', 'Indicator', 'indicator', 'metric',
      'Camera', 'camera', 'Lens', 'lens',
      'Name', 'name', 'Title', 'title'
    ];
    
    for (const fieldName of commonAnchorFields) {
      if (attributes[fieldName] !== undefined && attributes[fieldName] !== null) {
        anchorFields[fieldName] = attributes[fieldName];
      }
    }
    
    return anchorFields;
    
  } catch (error) {
    vlog(`Error extracting anchor fields from entity ${entity.id}: ${error.message}`, 'ERROR');
    return {};
  }
}

module.exports = {
  extractAnchorFieldsFromEntity
};
