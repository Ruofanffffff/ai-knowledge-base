/**
 * Import schemas from schema_field_mappings_full.json to database
 * 
 * This script reads the JSON file containing 414 schemas and imports them
 * into the database for use by the knowledge graph builder.
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Path to the schema JSON file
const SCHEMA_FILE_PATH = path.join(__dirname, '../kg/field_normalizer/schema_field_mappings_full.json');

/**
 * Parse schema from JSON format to database format
 * @param {string} schemaName - Schema name (key in JSON)
 * @param {Object} schemaData - Schema field mappings
 * @returns {Object} Schema object for database
 */
function parseSchema(schemaName, schemaData) {
  // Extract core fields from schema data
  const coreFields = [];
  let totalWeight = 0;
  
  for (const [fieldName, fieldData] of Object.entries(schemaData)) {
    if (fieldData && typeof fieldData === 'object' && fieldData.weight !== undefined) {
      coreFields.push({
        name: fieldName,
        weight: fieldData.weight,
        required: fieldData.required || false,
        description: fieldData.description || fieldName
      });
      totalWeight += fieldData.weight;
    }
  }
  
  // Normalize weights if they don't sum to 1.0
  if (Math.abs(totalWeight - 1.0) > 0.01 && totalWeight > 0) {
    coreFields.forEach(field => {
      field.weight = field.weight / totalWeight;
    });
  }
  
  // Infer entity type from schema name
  let entityType = 'GeneralEntity';
  if (schemaName.includes('事件') || schemaName.includes('Event')) {
    entityType = 'EventEntity';
  } else if (schemaName.includes('实体') || schemaName.includes('Entity')) {
    entityType = 'GeneralEntity';
  } else if (schemaName.includes('记录') || schemaName.includes('Log') || schemaName.includes('Record')) {
    entityType = 'RecordEntity';
  } else if (schemaName.includes('观察') || schemaName.includes('Observation')) {
    entityType = 'ObservationEntity';
  }
  
  return {
    name: schemaName,
    entityType: entityType,
    scene: null, // Can be inferred or set later
    coreFields: JSON.stringify(coreFields),
    threshold: 0.6, // Default threshold (60% field match required)
    relations: null,
    exampleDescription: null,
    description: `Schema for ${schemaName}`,
    version: '1.0.0',
    active: true
  };
}

/**
 * Main import function
 */
async function importSchemas() {
  try {
    console.log('Loading schemas from JSON file...');
    console.log(`File path: ${SCHEMA_FILE_PATH}`);
    
    // Read JSON file
    const jsonContent = fs.readFileSync(SCHEMA_FILE_PATH, 'utf-8');
    const schemasData = JSON.parse(jsonContent);
    
    const schemaNames = Object.keys(schemasData);
    console.log(`Found ${schemaNames.length} schemas in JSON file`);
    
    // Statistics
    const stats = {
      total: schemaNames.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };
    
    // Import each schema
    for (let i = 0; i < schemaNames.length; i++) {
      const schemaName = schemaNames[i];
      const schemaData = schemasData[schemaName];
      
      // Show progress
      if (i % 10 === 0) {
        const progress = ((i / schemaNames.length) * 100).toFixed(1);
        process.stdout.write(`\rProgress: ${progress}% (${i}/${schemaNames.length})`);
      }
      
      try {
        // Parse schema
        const schema = parseSchema(schemaName, schemaData);
        
        // Check if schema already exists
        const existing = await prisma.schema.findUnique({
          where: { name: schemaName }
        });
        
        if (existing) {
          // Update existing schema
          await prisma.schema.update({
            where: { id: existing.id },
            data: schema
          });
          stats.updated++;
        } else {
          // Create new schema
          await prisma.schema.create({
            data: schema
          });
          stats.created++;
        }
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          schema: schemaName,
          error: error.message
        });
        console.error(`\nError importing schema "${schemaName}":`, error.message);
      }
    }
    
    // Clear progress line
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('Schema Import Summary:');
    console.log(`  Total:   ${stats.total}`);
    console.log(`  ✅ Created: ${stats.created}`);
    console.log(`  ✏️  Updated: ${stats.updated}`);
    console.log(`  ⏭️  Skipped: ${stats.skipped}`);
    console.log(`  ❌ Failed:  ${stats.failed}`);
    console.log('='.repeat(60));
    
    if (stats.errors.length > 0) {
      console.log('\nErrors:');
      stats.errors.forEach((err, index) => {
        console.log(`  ${index + 1}. ${err.schema}: ${err.error}`);
      });
    }
    
    // Verify final count
    const finalCount = await prisma.schema.count();
    console.log(`\nFinal schema count in database: ${finalCount}`);
    
    if (finalCount >= 412) {
      console.log('✅ Success! All schemas imported.');
    } else {
      console.log(`⚠️  Warning: Expected at least 412 schemas, but found ${finalCount}`);
    }
    
  } catch (error) {
    console.error('Fatal error during schema import:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run import
importSchemas()
  .then(() => {
    console.log('\nSchema import completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nSchema import failed:', error);
    process.exit(1);
  });
