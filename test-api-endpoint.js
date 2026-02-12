const axios = require('axios');

async function testEndpoint() {
  console.log('测试 API 端点...\n');
  
  // 测试 1: 直接访问后端
  console.log('1. 测试直接访问后端 (http://localhost:3000/api/kg-status/batch)');
  try {
    const response = await axios.post('http://localhost:3000/api/kg-status/batch', {
      docIds: ['1', '2']
    });
    console.log('✓ 成功:', response.status, response.data);
  } catch (error) {
    console.log('✗ 失败:', error.response?.status, error.response?.data || error.message);
  }
  
  console.log('\n2. 测试通过前端代理访问 (http://localhost:5173/api/kg-status/batch)');
  try {
    const response = await axios.post('http://localhost:5173/api/kg-status/batch', {
      docIds: ['1', '2']
    });
    console.log('✓ 成功:', response.status, response.data);
  } catch (error) {
    console.log('✗ 失败:', error.response?.status, error.response?.data || error.message);
  }
  
  console.log('\n3. 测试错误的双重 /api 路径 (http://localhost:3000/api/api/kg-status/batch)');
  try {
    const response = await axios.post('http://localhost:3000/api/api/kg-status/batch', {
      docIds: ['1', '2']
    });
    console.log('✓ 成功:', response.status, response.data);
  } catch (error) {
    console.log('✗ 失败:', error.response?.status, error.response?.data || error.message);
  }
}

testEndpoint();
