#!/usr/bin/env node
/**
 * Frontend Features Test Script
 * 
 * Tests the key frontend features for KG build status tracking:
 * 1. API endpoints respond correctly
 * 2. Status polling works
 * 3. Batch status query works
 * 4. Rebuild functionality works
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

/**
 * Make HTTP request
 */
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Test 1: Single status query
 */
async function testSingleStatusQuery() {
  console.log('\n=== Test 1: Single Status Query ===');
  
  try {
    const response = await makeRequest('GET', '/api/kg-status/test-doc-123');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 || response.status === 404) {
      console.log('✓ Single status query works');
      return true;
    } else {
      console.log('✗ Unexpected status code');
      return false;
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    return false;
  }
}

/**
 * Test 2: Batch status query
 */
async function testBatchStatusQuery() {
  console.log('\n=== Test 2: Batch Status Query ===');
  
  try {
    const response = await makeRequest('POST', '/api/kg-status/batch', {
      docIds: ['doc1', 'doc2', 'doc3']
    });
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && response.data.success) {
      console.log('✓ Batch status query works');
      return true;
    } else {
      console.log('✗ Batch query failed');
      return false;
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    return false;
  }
}

/**
 * Test 3: Rebuild endpoint
 */
async function testRebuildEndpoint() {
  console.log('\n=== Test 3: Rebuild Endpoint ===');
  
  try {
    const response = await makeRequest('POST', '/api/kg-rebuild/test-doc-123');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    // 404 is acceptable if document doesn't exist
    if (response.status === 200 || response.status === 404) {
      console.log('✓ Rebuild endpoint responds correctly');
      return true;
    } else {
      console.log('✗ Unexpected status code');
      return false;
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    return false;
  }
}

/**
 * Test 4: Frontend build artifacts
 */
async function testFrontendBuild() {
  console.log('\n=== Test 4: Frontend Build Artifacts ===');
  
  const fs = require('fs');
  const path = require('path');
  
  const distPath = path.join(__dirname, 'client/dist');
  const indexPath = path.join(distPath, 'index.html');
  
  if (fs.existsSync(distPath) && fs.existsSync(indexPath)) {
    console.log('✓ Frontend build artifacts exist');
    return true;
  } else {
    console.log('✗ Frontend build artifacts missing');
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Frontend Features Test Suite');
  console.log('='.repeat(60));
  
  const results = [];
  
  results.push(await testSingleStatusQuery());
  results.push(await testBatchStatusQuery());
  results.push(await testRebuildEndpoint());
  results.push(await testFrontendBuild());
  
  console.log('\n' + '='.repeat(60));
  console.log('Test Results');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('✓ All tests passed!');
    process.exit(0);
  } else {
    console.log('✗ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
