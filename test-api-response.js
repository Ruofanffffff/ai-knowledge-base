/**
 * 测试API响应
 */

const http = require('http');

console.log('========== 测试 /api/documents API ==========\n');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/documents',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJpYXQiOjE3MzkzNDI1NjksImV4cCI6MTczOTQyODk2OX0.placeholder'
  }
};

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  console.log(`响应头:`);
  console.log(JSON.stringify(res.headers, null, 2));
  console.log('\n');

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('========== 响应内容 ==========\n');
    
    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
      
      console.log('\n========== 文档列表 ==========\n');
      if (Array.isArray(jsonData)) {
        console.log(`返回了 ${jsonData.length} 个文档:\n`);
        jsonData.forEach((doc, index) => {
          console.log(`${index + 1}. ID: ${doc.id}, 标题: ${doc.title}`);
        });
      } else {
        console.log('响应不是数组格式');
      }
    } catch (error) {
      console.log('原始响应（非JSON）:');
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('请求失败:', error.message);
});

req.end();
