/**
 * 简单的文件上传测试
 * 用于诊断上传问题
 */

const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

// 创建一个测试文件
const testContent = '这是一个测试文档，用于测试文件上传功能。\n\n测试内容包括中文字符。';
const testFilePath = './test-upload-file.txt';
fs.writeFileSync(testFilePath, testContent, 'utf8');

async function testUpload() {
  try {
    console.log('开始测试文件上传...');
    
    // 首先注册用户
    console.log('1. 注册测试用户...');
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, {
        username: 'testuser',
        password: 'test123',
        email: 'test@example.com'
      });
      console.log('✓ 用户注册成功');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✓ 用户已存在，跳过注册');
      } else {
        throw error;
      }
    }
    
    // 登录获取 token
    console.log('\n2. 登录获取 token...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      username: 'testuser',
      password: 'test123'
    });
    
    console.log('登录响应:', loginResponse.data);
    const token = loginResponse.data.data?.accessToken || loginResponse.data.token;
    if (!token) {
      throw new Error('未能获取 token');
    }
    console.log('✓ 登录成功，token:', token.substring(0, 20) + '...');
    
    // 准备上传文件
    console.log('\n3. 准备上传文件...');
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));
    
    // 上传文件
    console.log('4. 上传文件...');
    const uploadResponse = await axios.post(
      `${API_BASE_URL}/documents/upload`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('\n✓ 上传成功！');
    console.log('响应:', JSON.stringify(uploadResponse.data, null, 2));
    
    // 清理测试文件
    fs.unlinkSync(testFilePath);
    console.log('\n✓ 测试完成，已清理测试文件');
    
  } catch (error) {
    console.error('\n✗ 测试失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
      console.error('响应头:', error.response.headers);
    } else if (error.request) {
      console.error('请求已发送但没有收到响应');
      console.error('请求:', error.request);
    } else {
      console.error('错误信息:', error.message);
    }
    
    // 清理测试文件
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    
    process.exit(1);
  }
}

testUpload();
