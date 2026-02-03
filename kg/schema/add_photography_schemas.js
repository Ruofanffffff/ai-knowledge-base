#!/usr/bin/env node

/**
 * Add Photography-Related Schemas to Database
 * 
 * This script adds PhotographyEntity, PostProcessingEntity, and ProductDesignEntity
 * schemas to the database to support photography PRD processing.
 * 
 * Usage: node kg/schema/add_photography_schemas.js
 */

const schemaManager = require('./schema_manager');
const { allSchemas } = require('./photography_schemas');

async function addPhotographySchemas() {
  console.log('='.repeat(60));
  console.log('Adding Photography-Related Schemas');
  console.log('='.repeat(60));
  console.log();
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  for (const schema of allSchemas) {
    try {
      // Check if schema already exists
      const exists = await schemaManager.schemaExists(schema.schema_name);
      
      if (exists) {
        console.log(`⏭️  Skipping '${schema.schema_name}' (already exists)`);
        skipCount++;
        continue;
      }
      
      // Create schema
      const schemaId = await schemaManager.createSchema(schema);
      console.log(`✅ Created '${schema.schema_name}' (ID: ${schemaId})`);
      console.log(`   Entity Type: ${schema.entity_type}`);
      console.log(`   Scene: ${schema.scene}`);
      console.log(`   Core Fields: ${schema.core_fields.map(f => f.name).join(', ')}`);
      console.log(`   Threshold: ${schema.threshold}`);
      console.log();
      successCount++;
      
    } catch (error) {
      console.error(`❌ Failed to create '${schema.schema_name}':`, error.message);
      errorCount++;
    }
  }
  
  console.log('='.repeat(60));
  console.log('Summary:');
  console.log(`  ✅ Created: ${successCount}`);
  console.log(`  ⏭️  Skipped: ${skipCount}`);
  console.log(`  ❌ Failed: ${errorCount}`);
  console.log('='.repeat(60));
  
  // Verify schemas were added
  if (successCount > 0) {
    console.log('\nVerifying added schemas:');
    for (const schema of allSchemas) {
      const exists = await schemaManager.schemaExists(schema.schema_name);
      if (exists) {
        const loadedSchema = await schemaManager.getSchemaByName(schema.schema_name);
        console.log(`  ✓ ${schema.schema_name} (ID: ${loadedSchema.schema_id})`);
      }
    }
  }
  
  process.exit(errorCount > 0 ? 1 : 0);
}

// Run script
if (require.main === module) {
  addPhotographySchemas().catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { addPhotographySchemas };
