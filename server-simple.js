const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 创建必要的目录
const dirs = ['uploads'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// API路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.get('/api/documents', (req, res) => {
  // 简化版：返回模拟数据
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
  res.json(mockDocuments);
});

// 知识图谱数据API
app.get('/api/knowledge-graph', (req, res) => {
  const entities = [
    { id: '1', name: '人工智能', type: 'concept', value: 100 },
    { id: '2', name: '机器学习', type: 'concept', value: 80 },
    { id: '3', name: '深度学习', type: 'concept', value: 70 },
    { id: '4', name: '神经网络', type: 'concept', value: 60 },
    { id: '5', name: '语义搜索', type: 'concept', value: 90 },
  ];
  
  const relations = [
    { source: '1', target: '2', type: '包含' },
    { source: '2', target: '3', type: '包含' },
    { source: '3', target: '4', type: '包含' },
    { source: '1', target: '5', type: '应用' },
  ];
  
  res.json({ entities, relations });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// 导出app对象，用于测试
module.exports = app;
