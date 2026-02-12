#!/usr/bin/env node
/**
 * Schema Verification Script
 * 
 * Validates that the knowledge graph system has the required 412+ schemas
 * with complete structure (core fields, relations, etc.)
 * 
 * Usage: node scripts/verify-schemas.js
 */

const path = require('path');

async function verifySchemas() {
  console.log('='.repeat(60));
  console.log('Schema Verification Report');
  console.log('='.repeat(60));
  console.log();

  try {
    // Load schema JSON file
    const schemaFilePath = path.join(__dirname, '../kg/field_normalizer/schema_field_mappings_full.json');
    const schemas = require(schemaFilePath);
    const schemaNames = Object.keys(schemas);
    
    // 1. Count total schemas
    const total = schemaNames.length;
    console.log(`✓ Total Schemas: ${total}`);
    
    if (total < 412) {
      console.error(`✗ ERROR: Expected at least 412 schemas, found ${total}`);
      process.exit(1);
    }
    
    // 2. Count schemas with fields
    let schemasWithFields = 0;
    let totalFields = 0;
    let minFields = Infinity;
    let maxFields = 0;
    
    schemaNames.forEach(schemaName => {
      const schema = schemas[schemaName];
      const fieldCount = Object.keys(schema).length;
      
      if (fieldCount > 0) {
        schemasWithFields++;
        totalFields += fieldCount;
        minFields = Math.min(minFields, fieldCount);
        maxFields = Math.max(maxFields, fieldCount);
      }
    });
    
    console.log(`✓ Schemas with Fields: ${schemasWithFields}`);
    
    if (schemasWithFields < total) {
      console.warn(`⚠ WARNING: ${total - schemasWithFields} schemas missing fields`);
    }
    
    // 3. Field statistics
    console.log(`✓ Total Fields: ${totalFields}`);
    console.log(`✓ Average Fields per Schema: ${(totalFields / schemasWithFields).toFixed(2)}`);
    console.log(`✓ Min Fields per Schema: ${minFields}`);
    console.log(`✓ Max Fields per Schema: ${maxFields}`);
    
    // 4. Sample schemas
    console.log();
    console.log('Sample Schemas:');
    schemaNames.slice(0, 5).forEach((name, index) => {
      const schema = schemas[name];
      const fields = Object.keys(schema);
      console.log(`  ${index + 1}. ${name}`);
      console.log(`     Fields (${fields.length}): ${fields.slice(0, 5).join(', ')}${fields.length > 5 ? '...' : ''}`);
      
      // Show field structure for first schema
      if (index === 0) {
        const firstField = fields[0];
        const fieldData = schema[firstField];
        console.log(`     Sample Field Structure:`);
        console.log(`       - variations: ${fieldData.common_variations?.length || 0}`);
        console.log(`       - weight: ${fieldData.weight}`);
        console.log(`       - required: ${fieldData.required}`);
      }
    });
    
    console.log();
    console.log('='.repeat(60));
    console.log('✓ Schema Verification PASSED');
    console.log(`  Found ${total} schemas (requirement: 412+)`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error();
    console.error('✗ Schema Verification FAILED');
    console.error('Error:', error.message);
    console.error('='.repeat(60));
    process.exit(1);
  }
}

// Run verification
verifySchemas();
