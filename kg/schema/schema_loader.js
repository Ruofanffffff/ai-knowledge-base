/**
 * Schema Loader
 * 
 * Loads and imports schemas from SchemaList.md file into the database.
 * Parses the markdown table format and converts to structured Schema JSON.
 * 
 * Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7
 */

const fs = require('fs').promises;
const path = require('path');
const schemaManager = require('./schema_manager');

/**
 * Parse core fields string into structured array
 * @param {string} coreFieldsStr - Comma-separated field names (e.g., "Entity, Indicator, Time, Value, Unit")
 * @returns {Array} Array of core field objects with name, weight, and required properties
 */
function parseCoreFields(coreFieldsStr) {
  if (!coreFieldsStr || typeof coreFieldsStr !== 'string') {
    return [];
  }
  
  // Split by comma and trim whitespace
  const fieldNames = coreFieldsStr
    .split(',')
    .map(f => f.trim())
    .filter(f => f.length > 0);
  
  if (fieldNames.length === 0) {
    return [];
  }
  
  // Calculate equal weight for each field
  const weight = 1.0 / fieldNames.length;
  
  // Create field objects
  return fieldNames.map(name => ({
    name: name,
    weight: parseFloat(weight.toFixed(4)), // Round to 4 decimal places
    required: true  // Default: all fields are required
  }));
}

/**
 * Infer entity type from schema name and scene
 * @param {string} schemaName - Schema name
 * @param {string} scene - Scene/category
 * @returns {string} Entity type
 */
function inferEntityType(schemaName, scene) {
  // Check scene first
  if (scene.includes('科研') || scene.includes('政府') || scene.includes('学术')) {
    return 'ResearchEntity';
  } else if (scene.includes('旅行') || scene.includes('休闲')) {
    return 'TravelEntity';
  } else if (scene.includes('摄影')) {
    return 'PhotographyEntity';
  } else if (scene.includes('后期')) {
    return 'PostProcessingEntity';
  } else if (scene.includes('运动')) {
    return 'SportsEntity';
  } else if (scene.includes('个人生活')) {
    return 'LifeEntity';
  } else if (scene.includes('娱乐')) {
    return 'EntertainmentEntity';
  }
  
  // Check schema name for specific patterns
  if (schemaName.includes('事件') || schemaName.includes('Event')) {
    return 'EventEntity';
  } else if (schemaName.includes('实体') || schemaName.includes('Entity')) {
    return 'GeneralEntity';
  } else if (schemaName.includes('记录') || schemaName.includes('Log') || schemaName.includes('Record')) {
    return 'RecordEntity';
  } else if (schemaName.includes('观察') || schemaName.includes('Observation')) {
    return 'ObservationEntity';
  }
  
  // Default
  return 'GeneralEntity';
}

/**
 * Parse a single line from SchemaList.md
 * @param {string} line - Space-separated line from the markdown table
 * @param {number} lineNumber - Line number for error reporting
 * @returns {Object|null} Schema object or null if invalid
 */
function parseSchemaLine(line, lineNumber) {
  // Split by multiple spaces (4 or more spaces as separator)
  const columns = line.split(/\s{4,}/).map(col => col.trim());
  
  // Validate column count (should be 6: ID, Name, Scene, CoreFields, Example, Description)
  if (columns.length < 5) {
    console.warn(`Line ${lineNumber}: Invalid column count (${columns.length}), skipping`);
    return null;
  }
  
  const [id, schemaName, scene, coreFieldsStr, exampleDesc, description = ''] = columns;
  
  // Validate required fields
  if (!id || !schemaName || !scene || !coreFieldsStr) {
    console.warn(`Line ${lineNumber}: Missing required fields, skipping`);
    return null;
  }
  
  // Skip if ID is not a number (header row)
  if (isNaN(parseInt(id))) {
    return null;
  }
  
  // Parse core fields
  const coreFields = parseCoreFields(coreFieldsStr);
  if (coreFields.length === 0) {
    console.warn(`Line ${lineNumber}: No valid core fields found, skipping`);
    return null;
  }
  
  // Infer entity type
  const entityType = inferEntityType(schemaName, scene);
  
  // Create schema object
  return {
    schema_name: schemaName,
    entity_type: entityType,
    scene: scene,
    core_fields: coreFields,
    threshold: 0.75,  // Default threshold
    relations: [],    // Relations can be configured later
    example_description: exampleDesc || '',
    description: description || '',
    version: '1.0.0'
  };
}

/**
 * Load schemas from SchemaList.md file
 * @param {string} filePath - Path to SchemaList.md file
 * @returns {Promise<Array>} Array of parsed schema objects
 */
async function loadSchemasFromFile(filePath) {
  try {
    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Split into lines
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      throw new Error('SchemaList.md file is empty');
    }
    
    console.log(`Found ${lines.length} lines in SchemaList.md`);
    
    // Parse each line (skip header row)
    const schemas = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const schema = parseSchemaLine(line, i + 1);
      
      if (schema) {
        schemas.push(schema);
      }
    }
    
    console.log(`Successfully parsed ${schemas.length} schemas`);
    return schemas;
    
  } catch (error) {
    console.error('Error loading schemas from file:', error);
    throw error;
  }
}

/**
 * Import schemas to database with enhanced progress tracking and retry mechanism
 * @param {Array} schemas - Array of schema objects
 * @param {Object} options - Import options
 * @returns {Promise<Object>} Import statistics
 * 
 * Validates: Requirements 17.16, 17.17, 17.18
 */
async function importSchemas(schemas, options = {}) {
  const {
    skipExisting = true,  // Skip schemas that already exist
    updateExisting = false, // Update existing schemas
    maxRetries = 3,       // Maximum retry attempts per schema
    retryDelay = 1000,    // Delay between retries (ms)
    showProgress = true,  // Show progress bar
    logErrors = true      // Log detailed errors
  } = options;
  
  const stats = {
    total: schemas.length,
    created: 0,
    skipped: 0,
    updated: 0,
    failed: 0,
    errors: [],
    retries: 0,
    startTime: Date.now(),
    endTime: null
  };
  
  console.log(`\nImporting ${schemas.length} schemas...`);
  console.log(`Options: skipExisting=${skipExisting}, updateExisting=${updateExisting}, maxRetries=${maxRetries}\n`);
  
  // Process each schema with retry logic
  for (let i = 0; i < schemas.length; i++) {
    const schema = schemas[i];
    let success = false;
    let lastError = null;
    let retryCount = 0;
    
    // Show progress
    if (showProgress) {
      const progress = ((i / schemas.length) * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(progress / 2)) + '░'.repeat(50 - Math.floor(progress / 2));
      process.stdout.write(`\r[${bar}] ${progress}% (${i}/${schemas.length})`);
    }
    
    // Retry loop
    while (!success && retryCount <= maxRetries) {
      try {
        // Check if schema already exists
        const existing = await schemaManager.getSchemaByName(schema.schema_name);
        
        if (existing) {
          if (updateExisting) {
            // Update existing schema
            await schemaManager.updateSchema(existing.schema_id, schema);
            if (!showProgress) console.log(`✏️  Updated: ${schema.schema_name}`);
            stats.updated++;
          } else if (skipExisting) {
            // Skip existing schema
            if (!showProgress) console.log(`⏭️  Skipped: ${schema.schema_name} (already exists)`);
            stats.skipped++;
          } else {
            // Error: schema exists but not allowed to skip or update
            throw new Error(`Schema '${schema.schema_name}' already exists`);
          }
        } else {
          // Create new schema
          const schemaId = await schemaManager.createSchema(schema);
          if (!showProgress) console.log(`✅ Created: ${schema.schema_name} (ID: ${schemaId})`);
          stats.created++;
        }
        
        success = true;
        
      } catch (error) {
        lastError = error;
        
        if (retryCount < maxRetries) {
          retryCount++;
          stats.retries++;
          
          // Log retry attempt
          if (logErrors) {
            console.log(`\n⚠️  Retry ${retryCount}/${maxRetries} for: ${schema.schema_name} - ${error.message}`);
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          // Max retries reached
          break;
        }
      }
    }
    
    // If all retries failed, record the error
    if (!success) {
      if (!showProgress) console.error(`❌ Failed: ${schema.schema_name} - ${lastError.message}`);
      stats.failed++;
      stats.errors.push({
        schema_name: schema.schema_name,
        error: lastError.message,
        stack: logErrors ? lastError.stack : undefined,
        retries: retryCount
      });
    }
  }
  
  // Clear progress bar
  if (showProgress) {
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
  }
  
  stats.endTime = Date.now();
  stats.duration = stats.endTime - stats.startTime;
  
  return stats;
}

/**
 * Validate import results
 * @param {Object} stats - Import statistics
 * @param {number} expectedCount - Expected number of schemas (default: 250)
 * @returns {Object} Validation result
 * 
 * Validates: Requirement 17.16
 */
function validateImportResults(stats, expectedCount = 250) {
  const actualCount = stats.created + stats.updated + stats.skipped;
  const validation = {
    isValid: true,
    expectedCount,
    actualCount,
    successCount: stats.created + stats.updated,
    issues: []
  };
  
  // Check if actual count matches expected count
  if (actualCount !== expectedCount) {
    validation.isValid = false;
    validation.issues.push({
      type: 'COUNT_MISMATCH',
      message: `Expected ${expectedCount} schemas, but processed ${actualCount}`,
      severity: 'ERROR'
    });
  }
  
  // Check if there are failed imports
  if (stats.failed > 0) {
    validation.isValid = false;
    validation.issues.push({
      type: 'IMPORT_FAILURES',
      message: `${stats.failed} schemas failed to import`,
      severity: 'ERROR',
      details: stats.errors
    });
  }
  
  // Check if success rate is acceptable (>= 95%)
  const successRate = actualCount > 0 ? (validation.successCount / actualCount) * 100 : 0;
  if (successRate < 95) {
    validation.issues.push({
      type: 'LOW_SUCCESS_RATE',
      message: `Success rate ${successRate.toFixed(1)}% is below 95% threshold`,
      severity: 'WARNING'
    });
  }
  
  // Check if import took too long (> 5 minutes)
  if (stats.duration && stats.duration > 5 * 60 * 1000) {
    validation.issues.push({
      type: 'SLOW_IMPORT',
      message: `Import took ${(stats.duration / 1000).toFixed(1)}s, which is longer than expected`,
      severity: 'WARNING'
    });
  }
  
  return validation;
}

/**
 * Log detailed error information
 * @param {Object} stats - Import statistics
 * @param {string} logFilePath - Path to error log file (optional)
 * 
 * Validates: Requirement 17.17
 */
async function logImportErrors(stats, logFilePath = null) {
  if (stats.errors.length === 0) {
    return;
  }
  
  const timestamp = new Date().toISOString();
  const logContent = [
    '='.repeat(80),
    `Schema Import Error Log - ${timestamp}`,
    '='.repeat(80),
    '',
    `Total Errors: ${stats.errors.length}`,
    `Total Retries: ${stats.retries}`,
    '',
    'Error Details:',
    ''
  ];
  
  stats.errors.forEach((err, index) => {
    logContent.push(`${index + 1}. Schema: ${err.schema_name}`);
    logContent.push(`   Error: ${err.error}`);
    if (err.retries) {
      logContent.push(`   Retries: ${err.retries}`);
    }
    if (err.stack) {
      logContent.push(`   Stack Trace:`);
      logContent.push(`   ${err.stack.split('\n').join('\n   ')}`);
    }
    logContent.push('');
  });
  
  const logText = logContent.join('\n');
  
  // Write to file if path provided
  if (logFilePath) {
    try {
      await fs.writeFile(logFilePath, logText, 'utf-8');
      console.log(`\n📝 Error log written to: ${logFilePath}`);
    } catch (error) {
      console.error(`Failed to write error log: ${error.message}`);
    }
  }
  
  // Also log to console
  console.error('\n' + logText);
}

/**
 * Load and import schemas from SchemaList.md
 * @param {string} filePath - Path to SchemaList.md file (default: ./SchemaList.md)
 * @param {Object} options - Import options
 * @returns {Promise<Object>} Import statistics
 */
async function loadAndImportSchemas(filePath = null, options = {}) {
  try {
    // Default file path
    if (!filePath) {
      filePath = path.join(process.cwd(), 'SchemaList.md');
    }
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`SchemaList.md file not found at: ${filePath}`);
    }
    
    console.log(`Loading schemas from: ${filePath}`);
    
    // Load schemas from file
    const schemas = await loadSchemasFromFile(filePath);
    
    if (schemas.length === 0) {
      console.warn('No valid schemas found in file');
      return {
        total: 0,
        created: 0,
        skipped: 0,
        updated: 0,
        failed: 0,
        errors: [],
        validation: {
          isValid: false,
          issues: [{ type: 'NO_SCHEMAS', message: 'No schemas found in file', severity: 'ERROR' }]
        }
      };
    }
    
    // Import schemas to database
    const stats = await importSchemas(schemas, options);
    
    // Validate import results (Requirement 17.16)
    const validation = validateImportResults(stats, options.expectedCount || 250);
    stats.validation = validation;
    
    // Log errors if any (Requirement 17.17)
    if (stats.errors.length > 0) {
      const logFilePath = options.errorLogPath || path.join(process.cwd(), 'kg', 'schema', 'import_errors.log');
      await logImportErrors(stats, logFilePath);
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('Schema Import Summary:');
    console.log(`  Total:   ${stats.total}`);
    console.log(`  ✅ Created: ${stats.created}`);
    console.log(`  ✏️  Updated: ${stats.updated}`);
    console.log(`  ⏭️  Skipped: ${stats.skipped}`);
    console.log(`  ❌ Failed:  ${stats.failed}`);
    console.log(`  🔄 Retries: ${stats.retries}`);
    console.log(`  ⏱️  Duration: ${(stats.duration / 1000).toFixed(1)}s`);
    console.log('='.repeat(60));
    
    // Print validation results
    if (!validation.isValid) {
      console.log('\n⚠️  Validation Issues:');
      validation.issues.forEach((issue, index) => {
        const icon = issue.severity === 'ERROR' ? '❌' : '⚠️';
        console.log(`  ${icon} ${issue.type}: ${issue.message}`);
      });
    } else {
      console.log('\n✅ Validation: All checks passed');
    }
    
    if (stats.errors.length > 0) {
      console.log('\nErrors:');
      stats.errors.forEach((err, index) => {
        console.log(`  ${index + 1}. ${err.schema_name}: ${err.error}`);
      });
    }
    
    return stats;
    
  } catch (error) {
    console.error('Fatal error during schema loading:', error);
    throw error;
  }
}

/**
 * Get schemas by scene/category
 * @param {string} scene - Scene name (e.g., "科研/政府", "旅行", "摄影")
 * @returns {Promise<Array>} Array of schemas matching the scene
 */
async function getSchemasByScene(scene) {
  try {
    // Note: This requires adding a 'scene' field to the Schema model
    // For now, we'll need to filter in memory after loading all schemas
    const allSchemas = await schemaManager.listSchemas();
    
    // Filter by scene (case-insensitive partial match)
    const filtered = allSchemas.filter(schema => {
      // Check if schema has scene field (may not exist in old schemas)
      if (!schema.scene) return false;
      
      // Partial match
      return schema.scene.toLowerCase().includes(scene.toLowerCase());
    });
    
    return filtered;
  } catch (error) {
    console.error('Error getting schemas by scene:', error);
    throw error;
  }
}

/**
 * Export schemas to JSON file
 * @param {string} outputPath - Output file path
 * @param {Object} options - Export options
 * @returns {Promise<number>} Number of schemas exported
 */
async function exportSchemasToJSON(outputPath, options = {}) {
  try {
    const { scene = null } = options;
    
    // Get schemas
    let schemas;
    if (scene) {
      schemas = await getSchemasByScene(scene);
    } else {
      schemas = await schemaManager.listSchemas();
    }
    
    // Write to file
    await fs.writeFile(
      outputPath,
      JSON.stringify(schemas, null, 2),
      'utf-8'
    );
    
    console.log(`Exported ${schemas.length} schemas to ${outputPath}`);
    return schemas.length;
    
  } catch (error) {
    console.error('Error exporting schemas:', error);
    throw error;
  }
}

/**
 * Export schemas to CSV file
 * @param {string} outputPath - Output file path
 * @param {Object} options - Export options
 * @returns {Promise<number>} Number of schemas exported
 */
async function exportSchemasToCSV(outputPath, options = {}) {
  try {
    const { scene = null } = options;
    
    // Get schemas
    let schemas;
    if (scene) {
      schemas = await getSchemasByScene(scene);
    } else {
      schemas = await schemaManager.listSchemas();
    }
    
    // Create CSV header
    const header = 'ID,Name,EntityType,Scene,CoreFields,Threshold,Version\n';
    
    // Create CSV rows
    const rows = schemas.map(schema => {
      const coreFieldsStr = schema.core_fields
        .map(f => f.name)
        .join(', ');
      
      return [
        schema.schema_id,
        `"${schema.schema_name}"`,
        schema.entity_type,
        `"${schema.scene || ''}"`,
        `"${coreFieldsStr}"`,
        schema.threshold,
        schema.version
      ].join(',');
    });
    
    // Write to file
    const csv = header + rows.join('\n');
    await fs.writeFile(outputPath, csv, 'utf-8');
    
    console.log(`Exported ${schemas.length} schemas to ${outputPath}`);
    return schemas.length;
    
  } catch (error) {
    console.error('Error exporting schemas to CSV:', error);
    throw error;
  }
}

module.exports = {
  loadSchemasFromFile,
  importSchemas,
  loadAndImportSchemas,
  getSchemasByScene,
  exportSchemasToJSON,
  exportSchemasToCSV,
  parseCoreFields,
  inferEntityType,
  parseSchemaLine,
  validateImportResults,
  logImportErrors
};
