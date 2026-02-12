const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testDuplicateUpload() {
  try {
    // 1. 登录
    console.log('1. 登录...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.data.accessToken;
    console.log('✓ 登录成功');
    
    // 2. 创建测试文件
    console.log('\n2. 创建测试文件...');
    const testFilePath = path.join(__dirname, 'duplicate-test.txt');
    fs.writeFileSync(testFilePath, '这是一个重复测试文件');
    console.log('✓ 测试文件已创建');
    
    // 3. 第一次上传
    console.log('\n3. 第一次上传...');
    const form1 = new FormData();
    form1.append('file', fs.createReadStream(testFilePath));
    
    const upload1Response = await fetch('http://localhost:3000/api/documents/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...form1.getHeaders()
      },
      body: form1
    });
    
    const upload1Data = await upload1Response.json();
    console.log('第一次上传响应:', JSON.stringify(upload1Data, null, 2));
    
    // 4. 第二次上传（应该检测到重复）
    console.log('\n4. 第二次上传同一个文件（应该检测到重复）...');
    const form2 = new FormData();
    form2.append('file', fs.createReadStream(testFilePath));
    
    const upload2Response = await fetch('http://localhost:3000/api/documents/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...form2.getHeaders()
      },
      body: form2
    });
    
    const upload2Data = await upload2Response.json();
    console.log('第二次上传响应:', JSON.stringify(upload2Data, null, 2));
    
    if (upload2Data.duplicate) {
      console.log('\n✅ 重复检测成功！');
      console.log('重复类型:', upload2Data.duplicateType);
      console.log('临时文件ID:', upload2Data.tempFileId);
    } else {
      console.log('\n❌ 重复检测失败！应该检测到重复但没有');
    }
    
    // 5. 清理
    fs.unlinkSync(testFilePath);
    console.log('\n测试文件已删除');
    
  } catch (error) {
    console.error('测试出错:', error);
  }
}

testDuplicateUpload();
