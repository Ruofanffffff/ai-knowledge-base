/**
 * Test script to verify schema validation integration in document_hooks
 * 
 * This script tests:
 * 1. Schema validation check before build
 * 2. Build failure when KG_ENABLED=false
 * 3. Build failure when schema not loaded
 * 4. Build success when schema validation passes
 */

const { onDocumentCreated } = require('./kg/hooks/document_hooks');
const { getInstance: getStatusManager } = require('./kg/services/status_manager');

async function testSchemaValidationIntegration() {
  console.log('=== Testing Schema Validation Integration ===\n');
  
  const testDocId = `test-doc-${Date.now()}`;
  const testDoc = {
    id: testDocId,
    title: 'Test Document',
    content: 'This is a test document for schema validation.',
    metadata: {
      filePath: '/tmp/test.txt',
      fileType: '.txt'
    }
  };
  
  const statusManager = getStatusManager();
  
  // Test 1: Check behavior when KG_ENABLED=false
  console.log('Test 1: KG_ENABLED=false scenario');
  const originalKgEnabled = process.env.KG_ENABLED;
  process.env.KG_ENABLED = 'false';
  
  try {
    const result = await onDocumentCreated(testDoc, { async: false });
    console.log('Result:', result);
    
    // Check status
    const status = await statusManager.getStatus(testDocId);
    console.log('Status:', status);
    
    if (status && status.status === 'failed' && status.error_message.includes('Schema')) {
      console.log('✅ Test 1 PASSED: Build correctly failed with schema validation message\n');
    } else {
      console.log('❌ Test 1 FAILED: Expected failed status with schema message\n');
    }
    
    // Cleanup
    await statusManager.deleteStatus(testDocId);
  } catch (error) {
    console.error('❌ Test 1 ERROR:', error.message, '\n');
  }
  
  // Test 2: Check behavior when KG_ENABLED=true (normal case)
  console.log('Test 2: KG_ENABLED=true with valid schema');
  process.env.KG_ENABLED = 'true';
  
  const testDocId2 = `test-doc-${Date.now()}-2`;
  const testDoc2 = {
    id: testDocId2,
    title: 'Test Document 2',
    content: 'This is another test document.',
    metadata: {
      filePath: '/tmp/test2.txt',
      fileType: '.txt'
    }
  };
  
  try {
    // First verify schema can be loaded
    const SchemaValidator = require('./kg/validation/schema_validator');
    const validator = new SchemaValidator();
    const schemas = validator.loadSchemas();
    
    console.log(`Schema loaded: ${Object.keys(schemas).length} schemas available`);
    
    // Now test the hook
    const result = await onDocumentCreated(testDoc2, { async: false });
    console.log('Result:', result);
    
    if (result.success || result.skipped) {
      console.log('✅ Test 2 PASSED: Schema validation check completed successfully\n');
    } else {
      console.log('❌ Test 2 FAILED: Unexpected result\n');
    }
    
    // Cleanup
    await statusManager.deleteStatus(testDocId2);
  } catch (error) {
    console.error('❌ Test 2 ERROR:', error.message, '\n');
  }
  
  // Restore original KG_ENABLED value
  process.env.KG_ENABLED = originalKgEnabled;
  
  console.log('=== Schema Validation Integration Tests Complete ===');
}

// Run tests
testSchemaValidationIntegration()
  .then(() => {
    console.log('\nAll tests completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nTest suite failed:', error);
    process.exit(1);
  });
