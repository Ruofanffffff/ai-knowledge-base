const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// 创建必要的目录
const dirs = ['uploads'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  // 设置CORS头部
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // 解析请求URL
  const url = req.url;
  
  // 健康检查API
  if (req.method === 'GET' && url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'Server is running' }));
    return;
  }
  
  // 文档API
  if (req.method === 'GET' && url === '/api/documents') {
    const mockDocuments = [
      {
        id: '1',
        title: 'React学习笔记',
        content: 'React是一个用于构建用户界面的JavaScript库。它由Facebook开发，用于构建交互式的UI。',
        type: 'document',
        fileType: '.md',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '2',
        title: 'SQLite数据库使用指南',
        content: 'SQLite是一个轻量级的关系型数据库，无需服务器即可运行。',
        type: 'document',
        fileType: '.md',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockDocuments));
    return;
  }
  
  // 知识图谱API
  if (req.method === 'GET' && url === '/api/knowledge-graph') {
    const data = {
      entities: [
        { id: '1', name: '人工智能', type: 'concept', value: 100 },
        { id: '2', name: '机器学习', type: 'concept', value: 80 },
        { id: '3', name: '深度学习', type: 'concept', value: 70 },
        { id: '4', name: '神经网络', type: 'concept', value: 60 },
        { id: '5', name: '语义搜索', type: 'concept', value: 90 },
      ],
      relations: [
        { source: '1', target: '2', type: '包含' },
        { source: '2', target: '3', type: '包含' },
        { source: '3', target: '4', type: '包含' },
        { source: '1', target: '5', type: '应用' },
      ]
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }
  
  // 404处理
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Available APIs:');
  console.log('- GET /api/health - 健康检查');
  console.log('- GET /api/documents - 获取文档列表');
  console.log('- GET /api/knowledge-graph - 获取知识图谱数据');
});
