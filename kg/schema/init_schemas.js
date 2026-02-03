/**
 * Initialize Default Schemas
 * 
 * This script initializes the database with default schema definitions.
 * Run this script after database migration to set up example schemas.
 * 
 * Usage: node kg/schema/init_schemas.js
 */

const schemaManager = require('./schema_manager');
// 使用新生成的所有255个schemas
const { allSchemas } = require('./all_schemas_generated');

async function initializeSchemas() {
  console.log('Initializing default schemas...\n');
  
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
      successCount++;
      
    } catch (error) {
      console.error(`❌ Failed to create '${schema.schema_name}':`, error.message);
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('Schema Initialization Summary:');
  console.log(`  ✅ Created: ${successCount}`);
  console.log(`  ⏭️  Skipped: ${skipCount}`);
  console.log(`  ❌ Failed: ${errorCount}`);
  console.log('='.repeat(50));
  
  // List all schemas
  console.log('\nCurrent schemas in database:');
  const schemasInDb = await schemaManager.listSchemas();
  schemasInDb.forEach((schema, index) => {
    console.log(`  ${index + 1}. ${schema.schema_name} (${schema.entity_type})`);
  });
  
  process.exit(errorCount > 0 ? 1 : 0);
}

// Run initialization
initializeSchemas().catch(error => {
  console.error('Fatal error during schema initialization:', error);
  process.exit(1);
});
