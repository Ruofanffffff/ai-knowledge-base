/**
 * 测试文件上传流程
 * 用于验证重复检测和进度显示功能
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';

// 从环境变量或命令行参数获取 token
const TOKEN = process.env.TEST_TOKEN || process.argv[2];

if (!TOKEN) {
  console.error('❌ 请提供认证 token:');
  console.error('   方式1: TEST_TOKEN=your_token node test-upload-flow.js');
  console.error('   方式2: node test-upload-flow.js your_token');
  process.exit(1);
}

// 创建测试文件
function createTestFile(filename, content) {
  const testDir = path.join(__dirname, 'test-uploads');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const filePath = path.join(testDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

// 上传文件
async function uploadFile(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  
  console.log(`\n📤 上传文件: ${path.basename(filePath)}`);
  console.log(`   文件大小: ${fs.statSync(filePath).size} bytes`);
  
  try {
    const response = await axios.post(
      `${API_BASE_URL}/documents/upload`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${TOKEN}`
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          process.stdout.write(`\r   进度: ${percentCompleted}%`);
        }
      }
    );
    
    console.log('\n✅ 上传成功');
    console.log('   响应:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.log('\n❌ 上传失败');
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   响应:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('   错误:', error.message);
    }
    throw error;
  }
}

// 解决重复文件
async function resolveDuplicate(action, tempFileId, existingFileId) {
  console.log(`\n🔄 解决重复文件: ${action}`);
  console.log(`   tempFileId: ${tempFileId}`);
  console.log(`   existingFileId: ${existingFileId}`);
  
  try {
    const response = await axios.post(
      `${API_BASE_URL}/documents/upload/resolve-duplicate`,
      {
        action,
        tempFileId,
        existingFileId
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ 解决成功');
    console.log('   响应:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.log('❌ 解决失败');
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   响应:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('   错误:', error.message);
    }
    throw error;
  }
}

// 主测试流程
async function runTests() {
  console.log('🧪 开始测试文件上传流程\n');
  console.log('=' .repeat(60));
  
  try {
    // 测试 1: 上传新文件
    console.log('\n📋 测试 1: 上传新文件');
    console.log('-'.repeat(60));
    const testFile1 = createTestFile('test-file-1.txt', 'This is test file 1 content');
    const result1 = await uploadFile(testFile1);
    
    if (result1.success && result1.document) {
      console.log('✅ 测试 1 通过: 新文件上传成功');
    } else {
      console.log('❌ 测试 1 失败: 响应格式不正确');
    }
    
    // 等待一下，确保文件已保存
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试 2: 上传相同内容的文件（内容重复）
    console.log('\n📋 测试 2: 上传相同内容的文件（内容重复）');
    console.log('-'.repeat(60));
    const testFile2 = createTestFile('test-file-2.txt', 'This is test file 1 content'); // 相同内容
    const result2 = await uploadFile(testFile2);
    
    if (result2.duplicate && result2.duplicateType === 'content') {
      console.log('✅ 测试 2 通过: 检测到内容重复');
      console.log('   重复类型:', result2.duplicateType);
      console.log('   现有文件:', result2.existingFile.title);
      console.log('   临时文件ID:', result2.tempFileId);
      
      // 测试解决重复 - keep-both
      console.log('\n📋 测试 2.1: 解决重复 - 保存为新文件');
      const resolveResult = await resolveDuplicate('keep-both', result2.tempFileId, result2.existingFile.id);
      if (resolveResult.success) {
        console.log('✅ 测试 2.1 通过: 保存为新文件成功');
      }
    } else {
      console.log('❌ 测试 2 失败: 未检测到内容重复');
      console.log('   响应:', result2);
    }
    
    // 测试 3: 上传相同文件名的文件（文件名重复）
    console.log('\n📋 测试 3: 上传相同文件名的文件（文件名重复）');
    console.log('-'.repeat(60));
    const testFile3 = createTestFile('test-file-1.txt', 'Different content for test'); // 相同文件名，不同内容
    const result3 = await uploadFile(testFile3);
    
    if (result3.duplicate && result3.duplicateType === 'filename') {
      console.log('✅ 测试 3 通过: 检测到文件名重复');
      console.log('   重复类型:', result3.duplicateType);
      
      // 测试解决重复 - cancel
      console.log('\n📋 测试 3.1: 解决重复 - 取消上传');
      const resolveResult = await resolveDuplicate('cancel', result3.tempFileId, result3.existingFile.id);
      if (resolveResult.success) {
        console.log('✅ 测试 3.1 通过: 取消上传成功');
      }
    } else {
      console.log('❌ 测试 3 失败: 未检测到文件名重复');
      console.log('   响应:', result3);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 所有测试完成！');
    
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ 测试过程中出现错误');
    console.error(error);
    process.exit(1);
  }
}

// 运行测试
runTests().catch(console.error);
