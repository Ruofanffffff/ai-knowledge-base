#!/usr/bin/env node

/**
 * 测试前端 API 调用
 * 模拟前端的 axios 请求，查看返回的数据
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 读取 token
const DB_PATH = path.join(__dirname, 'data', 'users.db');
const sqlite3 = require('sqlite3').verbose();

console.log('=== 测试前端 API 调用 ===\n');

// 首先从数据库获取一个有效的 token
const db = new sqlite3.Database(DB_PATH);

db.get('SELECT * FROM users WHERE username = ?', ['admin'], async (err, user) => {
  if (err || !user) {
    console.error('❌ 无法找到 admin 用户');
    db.close();
    return;
  }

  console.log('✅ 找到用户:', user.username);
  console.log('');

  // 生成一个简单的 token（实际应该使用 JWT）
  // 但我们可以直接使用用户 ID 来测试
  
  // 测试 API 调用
  try {
    console.log('📡 发送请求到: http://localhost:3000/api/documents');
    console.log('');

    const response = await axios.get('http://localhost:3000/api/documents', {
      headers: {
        // 这里需要一个有效的 token
        // 让我们先检查是否有 token 文件
      }
    });

    console.log('✅ API 响应成功');
    console.log('');
    console.log('📊 返回的文档数量:', response.data.length);
    console.log('');

    if (response.data.length > 0) {
      console.log('📄 文档列表:');
      console.log('─'.repeat(80));
      response.data.forEach((doc, index) => {
        console.log(`${index + 1}. ID: ${doc.id}`);
        console.log(`   标题: ${doc.title}`);
        console.log(`   类型: ${doc.fileType}`);
        console.log('');
      });
    }

    // 检查响应头
    console.log('📋 响应头:');
    console.log('─'.repeat(80));
    console.log('Cache-Control:', response.headers['cache-control']);
    console.log('Pragma:', response.headers['pragma']);
    console.log('Expires:', response.headers['expires']);
    console.log('');

  } catch (error) {
    if (error.response) {
      console.error('❌ API 错误:', error.response.status, error.response.statusText);
      console.error('错误信息:', error.response.data);
    } else {
      console.error('❌ 请求失败:', error.message);
      console.error('');
      console.error('💡 提示: 请确保后端服务器正在运行 (node server.js)');
    }
  }

  db.close();
});
