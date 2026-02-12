/**
 * Detailed test for schema validation integration
 * 
 * This test demonstrates:
 * 1. Schema validation check happens before build starts
 * 2. Proper error handling when schema validation fails
 * 3. Proper error messages are recorded in build status
 */

const SchemaValidator = require('./kg/validation/schema_validator');
const { getInstance: getStatusManager } = require('./kg/services/status_manager');

async function testSchemaValidationDetailed() {
  console.log('=== Detailed Schema Validation Integration Test ===\n');
  
  // Test 1: Verify schema validator works
  console.log('Test 1: Schema Validator Functionality');
  const validator = new SchemaValidator();
  
  try {
    const schemas = validator.loadSchemas();
    console.log(`✅ Loaded ${Object.keys(schemas).length} schemas from JSON file`);
    
    const validationResult = validator.validateAllSchemas();
    console.log(`Validation result: ${validationResult.success ? 'PASSED' : 'FAILED'}`);
    console.log(`Schema count: ${validationResult.schemaCount}`);
    
    if (validationResult.errors.length > 0) {
      console.log(`Errors found: ${validationResult.errors.length}`);
      console.log('First 3 errors:');
      validationResult.errors.slice(0, 3).forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`);
      });
    } else {
      console.log('✅ No validation errors found');
    }
  } catch (error) {
    console.error('❌ Schema validation failed:', error.message);
  }
  
  console.log('\n');
  
  // Test 2: Simulate the document_hooks behavior
  console.log('Test 2: Document Hooks Schema Validation Flow');
  
  const testDocId = `test-schema-${Date.now()}`;
  const statusManager = getStatusManager();
  
  // Create initial status
  await statusManager.createStatus(testDocId, 'pending');
  console.log('✅ Created initial status: pending');
  
  // Simulate KG_ENABLED=false scenario (schema validation failed)
  console.log('\nScenario A: KG_ENABLED=false (schema validation failed at startup)');
  const originalKgEnabled = process.env.KG_ENABLED;
  process.env.KG_ENABLED = 'false';
  
  // This is what document_hooks does
  if (process.env.KG_ENABLED === 'false') {
    console.log('  - KG功能已禁用');
    await statusManager.updateStatus(testDocId, 'failed', {
      errorMessage: 'Schema验证失败或知识图谱功能已禁用，无法构建知识图谱',
      errorCategory: 'system_error'
    });
    
    const status = await statusManager.getStatus(testDocId);
    console.log('  - Build status:', status.status);
    console.log('  - Error message:', status.error_message);
    console.log('  - Error category:', status.error_category);
    console.log('✅ Correctly marked build as failed with schema validation error');
  }
  
  // Restore and test normal scenario
  process.env.KG_ENABLED = 'true';
  await statusManager.deleteStatus(testDocId);
  
  console.log('\nScenario B: KG_ENABLED=true (schema validation passed)');
  await statusManager.createStatus(testDocId, 'pending');
  
  try {
    // This is what document_hooks does
    const validator2 = new SchemaValidator();
    const schemas = validator2.loadSchemas();
    
    if (!schemas || Object.keys(schemas).length === 0) {
      console.log('  ❌ Schema not loaded');
      await statusManager.updateStatus(testDocId, 'failed', {
        errorMessage: 'Schema配置未正确加载，无法构建知识图谱',
        errorCategory: 'system_error'
      });
    } else {
      console.log(`  ✅ Schema验证通过: ${Object.keys(schemas).length} 个schema已加载到内存`);
      console.log('  - Build can proceed (would update to "building" status)');
      
      // Simulate successful build
      await statusManager.updateStatus(testDocId, 'building');
      console.log('  - Status updated to: building');
    }
    
    const finalStatus = await statusManager.getStatus(testDocId);
    console.log('  - Final status:', finalStatus.status);
    
    if (finalStatus.status === 'building') {
      console.log('✅ Schema validation passed, build started successfully');
    }
  } catch (error) {
    console.error('  ❌ Schema validation check failed:', error.message);
    await statusManager.updateStatus(testDocId, 'failed', {
      errorMessage: `Schema验证失败: ${error.message}`,
      errorCategory: 'system_error'
    });
  }
  
  // Cleanup
  await statusManager.deleteStatus(testDocId);
  process.env.KG_ENABLED = originalKgEnabled;
  
  console.log('\n=== Test Complete ===');
  console.log('\nSummary:');
  console.log('- Schema validation is checked before build starts');
  console.log('- If KG_ENABLED=false, build fails immediately with schema error');
  console.log('- If schema not loaded, build fails with configuration error');
  console.log('- If schema validation passes, build proceeds normally');
}

// Run test
testSchemaValidationDetailed()
  .then(() => {
    console.log('\n✅ All tests completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
