const { getInstance } = require('./kg/services/status_manager');

async function test() {
  const statusManager = getInstance();
  
  try {
    // Test getStatus
    console.log('Testing getStatus for doc 1...');
    const status = await statusManager.getStatus('1');
    console.log('Status:', status);
    
    // Test getBatchStatus
    console.log('\nTesting getBatchStatus...');
    const batchStatus = await statusManager.getBatchStatus(['1', '2', '3']);
    console.log('Batch status:', batchStatus);
    
    await statusManager.close();
    console.log('\n✓ All tests passed');
  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  }
}

test();
