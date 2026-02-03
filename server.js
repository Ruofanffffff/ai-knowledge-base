const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const JSZip = require('jszip');
require('dotenv').config();

// Import KG module for startup initialization
const kg = require('./kg');
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('./kg/hooks/document_hooks');

const app = express();
const PORT = 3000;

// 初始化用户认证服务
const { initAuthService, authMiddleware } = require('./services/authService');
const { initStatsService } = require('./services/statsService');
const authRoutes = require('./routes/authRoutes');
const userCenterRoutes = require('./routes/userCenterRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { initDatabase } = require('./database/initUserDB');

initAuthService();
initStatsService();
const userDb = initDatabase();
const authRouter = authRoutes.initAuthRoutes();
const userCenterRouter = userCenterRoutes.initUserCenterRoutes();
const adminRouter = adminRoutes.initAdminRoutes();

// Ollama配置
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api';

// 云端模型配置
const CLOUD_MODELS = {
  'qwen-plus': {
    provider: 'aliyun',
    apiKey: process.env.QWEN_API_KEY || '',
    endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    model: 'qwen-plus'
  },
  'qwen-max': {
    provider: 'aliyun',
    apiKey: process.env.QWEN_API_KEY || '',
    endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    model: 'qwen-max'
  },
  'deepseek-chat': {
    provider: 'deepseek',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat'
  },
  'deepseek-reasoner': {
    provider: 'deepseek',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-reasoner'
  }
};

// 本地模型列表
const LOCAL_MODELS = ['llama2:7b', 'mistral:7b', 'deepseek-r1:7b'];

// 数据持久化文件路径
const DATA_FILE = path.join(__dirname, 'data', 'documents.json');
const CATEGORIES_FILE = path.join(__dirname, 'data', 'categories.json');
const RECOMMENDATIONS_CACHE_FILE = path.join(__dirname, 'data', 'recommendations.json');
const KNOWLEDGE_GRAPH_CACHE_FILE = path.join(__dirname, 'data', 'knowledge-graph.json');

// 创建数据目录
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// 从文件加载文档数据
function loadDocuments() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading documents:', error);
  }
  return [];
}

// 保存文档数据到文件
function saveDocuments(documents) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(documents, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving documents:', error);
  }
}

// 从文件加载分类数据
function loadCategories(userId) {
  return new Promise((resolve, reject) => {
    userDb.all(
      'SELECT * FROM categories WHERE user_id = ? ORDER BY created_at ASC',
      [userId],
      (err, rows) => {
        if (err) {
          console.error('Error loading categories from database:', err);
          return reject(err);
        }
        
        if (!rows || rows.length === 0) {
          return resolve(null);
        }
        
        const categories = rows.map(row => ({
          id: row.category_id,
          name: row.name,
          description: row.description,
          color: row.color,
          documentIds: row.document_ids ? JSON.parse(row.document_ids) : [],
          documentCount: row.document_count
        }));
        
        resolve(categories);
      }
    );
  });
}

function saveCategories(userId, categories) {
  return new Promise((resolve, reject) => {
    userDb.serialize(() => {
      userDb.run('DELETE FROM categories WHERE user_id = ?', [userId], (err) => {
        if (err) {
          console.error('Error deleting old categories:', err);
          return reject(err);
        }
        
        const stmt = userDb.prepare(`
          INSERT INTO categories (user_id, category_id, name, description, color, document_ids, document_count)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        let completed = 0;
        const total = categories.length;
        
        categories.forEach(category => {
          const documentIdsJson = JSON.stringify(category.documentIds || []);
          stmt.run(
            [userId, category.id, category.name, category.description, category.color, documentIdsJson, category.documentCount],
            (err) => {
              if (err) {
                console.error('Error saving category:', err);
              }
              completed++;
              
              if (completed === total) {
                stmt.finalize();
                resolve();
              }
            }
          );
        });
        
        if (total === 0) {
          stmt.finalize();
          resolve();
        }
      });
    });
  });
}

// 从文件加载推荐缓存
function loadRecommendationsCache() {
  try {
    if (fs.existsSync(RECOMMENDATIONS_CACHE_FILE)) {
      const data = fs.readFileSync(RECOMMENDATIONS_CACHE_FILE, 'utf8');
      const cacheData = JSON.parse(data);
      return {
        recommendations: cacheData.recommendations || [],
        docCount: cacheData.docCount || 0,
        docHash: cacheData.docHash || ''
      };
    }
  } catch (error) {
    console.error('Error loading recommendations cache:', error);
  }
  return {
    recommendations: [],
    docCount: 0,
    docHash: ''
  };
}

// 保存推荐缓存到文件
function saveRecommendationsCache(recommendations, docCount, docHash) {
  try {
    const data = {
      recommendations: recommendations,
      docCount: docCount,
      docHash: docHash,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(RECOMMENDATIONS_CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving recommendations cache:', error);
  }
}

// 从文件加载知识图谱缓存
function loadKnowledgeGraphCache() {
  try {
    if (fs.existsSync(KNOWLEDGE_GRAPH_CACHE_FILE)) {
      const data = fs.readFileSync(KNOWLEDGE_GRAPH_CACHE_FILE, 'utf8');
      const cacheData = JSON.parse(data);
      return {
        entities: cacheData.entities || [],
        relations: cacheData.relations || [],
        docCount: cacheData.docCount || 0,
        docHash: cacheData.docHash || ''
      };
    }
  } catch (error) {
    console.error('Error loading knowledge graph cache:', error);
  }
  return {
    entities: [],
    relations: [],
    docCount: 0,
    docHash: ''
  };
}

// 保存知识图谱缓存到文件
function saveKnowledgeGraphCache(entities, relations, docCount, docHash) {
  try {
    const data = {
      entities: entities,
      relations: relations,
      docCount: docCount,
      docHash: docHash,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(KNOWLEDGE_GRAPH_CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving knowledge graph cache:', error);
  }
}

// 初始化文档数据
let mockDocuments = loadDocuments();

// 如果没有数据，添加一些默认数据
if (mockDocuments.length === 0) {
  mockDocuments = [
    {
      id: '1',
      title: 'React学习笔记',
      content: 'React是一个用于构建用户界面的JavaScript库。它由Facebook开发，用于构建交互式的UI。',
      type: 'document',
      fileType: '.md',
      metadata: { source: 'manual', tags: ['前端', 'React'] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '2',
      title: 'SQLite数据库使用指南',
      content: 'SQLite是一个轻量级的关系型数据库，无需服务器即可运行。',
      type: 'document',
      fileType: '.md',
      metadata: { source: 'manual', tags: ['数据库', 'SQLite'] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '3',
      title: 'AI语义搜索原理',
      content: '语义搜索是基于自然语言理解的搜索技术，能够理解用户的意图并返回相关结果。',
      type: 'document',
      fileType: '.md',
      metadata: { source: 'manual', tags: ['AI', '搜索'] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  saveDocuments(mockDocuments);
}

// 云端模型API调用函数
async function callCloudModel(modelKey, prompt) {
  const modelConfig = CLOUD_MODELS[modelKey];
  
  if (!modelConfig) {
    throw new Error(`Unknown cloud model: ${modelKey}`);
  }
  
  if (!modelConfig.apiKey) {
    throw new Error(`API key not configured for ${modelKey}. Please set ${modelKey.toUpperCase()}_API_KEY environment variable.`);
  }
  
  console.log(`Calling cloud model: ${modelKey} (provider: ${modelConfig.provider})`);
  
  if (modelConfig.provider === 'aliyun') {
    return await callQwenModel(modelConfig, prompt);
  } else if (modelConfig.provider === 'deepseek') {
    return await callDeepSeekModel(modelConfig, prompt);
  } else {
    throw new Error(`Unsupported provider: ${modelConfig.provider}`);
  }
}

// 调用通义千问模型
async function callQwenModel(modelConfig, prompt) {
  console.log('调用通义千问API，endpoint:', modelConfig.endpoint);
  console.log('请求参数:', JSON.stringify({
    model: modelConfig.model,
    input: {
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    },
    parameters: {
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 2000
    }
  }, null, 2));

  const response = await fetch(modelConfig.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${modelConfig.apiKey}`
    },
    body: JSON.stringify({
      model: modelConfig.model,
      input: {
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      parameters: {
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 2000
      }
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Qwen API error:', errorText);
    throw new Error(`Qwen API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log('通义千问API响应:', JSON.stringify(data, null, 2));
  
  if (data.output && data.output.text) {
    return data.output.text;
  } else if (data.output && data.output.choices && data.output.choices.length > 0) {
    return data.output.choices[0].message.content;
  } else if (data.choices && data.choices.length > 0) {
    return data.choices[0].message.content;
  } else {
    console.error('无法解析通义千问API响应，完整数据:', data);
    throw new Error('Invalid response format from Qwen API');
  }
}

// 调用DeepSeek模型
async function callDeepSeekModel(modelConfig, prompt) {
  const response = await fetch(modelConfig.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${modelConfig.apiKey}`
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 2000
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('DeepSeek API error:', errorText);
    throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message.content;
  } else {
    throw new Error('Invalid response format from DeepSeek API');
  }
}

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 文件上传配置
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// 创建上传目录
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

// 根路径路由（必须在静态文件中间件之前）
app.get('/', (req, res) => {
  try {
    const htmlPath = path.join(__dirname, 'index-simple.html');
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      res.status(200).json({ 
        message: '个人智能知识库API服务器', 
        version: '1.0.0',
        endpoints: [
          '/api/health - 健康检查',
          '/api/documents - 文档管理',
          '/api/tags - 标签管理',
          '/api/ai/* - AI功能',
          '/api/knowledge-graph - 知识图谱'
        ]
      });
    }
  } catch (error) {
    console.error('Error serving root path:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 静态文件服务
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 提供client目录下的静态文件服务（用于React应用）
app.use(express.static(path.join(__dirname, 'client')));

// 提供根目录下的静态文件服务
app.use(express.static(path.join(__dirname)));

// API路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// 认证路由
app.use('/api/auth', authRouter);

// 用户中心路由
app.use('/api/user', userCenterRouter);

// 管理员路由
app.use('/api/admin', adminRouter);

// 知识图谱路由
const knowledgeGraphRoutes = require('./routes/knowledgeGraphRoutes');
app.use('/api/knowledge-graph', knowledgeGraphRoutes);

// 文档处理路由
const documentProcessingRoutes = require('./routes/documentProcessingRoutes');
app.use('/api', documentProcessingRoutes);

const mockTags = [
  { id: '1', name: '前端', color: '#1890ff', description: '前端开发相关内容' },
  { id: '2', name: '后端', color: '#52c41a', description: '后端开发相关内容' },
  { id: '3', name: 'AI', color: '#faad14', description: '人工智能相关内容' },
  { id: '4', name: '数据库', color: '#f5222d', description: '数据库相关内容' },
  { id: '5', name: '笔记', color: '#722ed1', description: '个人笔记' }
];

// 文档相关路由
app.get('/api/documents', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    userDb.all('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
      if (err) {
        console.error('Error fetching documents:', err);
        return res.status(500).json({ error: 'Failed to fetch documents' });
      }
      
      const documents = rows.map(row => ({
        id: row.id.toString(),
        title: row.title,
        content: row.content,
        type: row.type,
        fileType: row.file_type,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        tags: row.tags ? JSON.parse(row.tags) : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      res.json(documents);
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

app.get('/api/documents/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    userDb.get('SELECT * FROM documents WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
      if (err) {
        console.error('Error fetching document:', err);
        return res.status(500).json({ error: 'Failed to fetch document' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const document = {
        id: row.id.toString(),
        title: row.title,
        content: row.content,
        type: row.type,
        fileType: row.file_type,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        tags: row.tags ? JSON.parse(row.tags) : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
      
      res.json(document);
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

app.post('/api/documents', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    const { title, content, type, fileType, metadata, tags } = req.body;
    
    const metadataStr = metadata ? JSON.stringify(metadata) : null;
    const tagsStr = tags ? JSON.stringify(tags) : null;
    
    userDb.run(
      `INSERT INTO documents (user_id, title, content, type, file_type, metadata, tags) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, title, content, type || 'document', fileType || '.md', metadataStr, tagsStr],
      function(err) {
        if (err) {
          console.error('Error creating document:', err);
          return res.status(500).json({ error: 'Failed to create document' });
        }
        
        const newDocument = {
          id: this.lastID.toString(),
          title,
          content,
          type: type || 'document',
          fileType: fileType || '.md',
          metadata: metadata || {},
          tags: tags || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        console.log('创建新文档:', newDocument);
        
        // 触发知识图谱构建钩子 (异步)
        onDocumentCreated(newDocument, { async: true, skipIfExists: false })
          .then(result => {
            console.log('[KG Hook] 文档创建钩子结果:', result);
          })
          .catch(error => {
            console.error('[KG Hook] 文档创建钩子失败:', error);
          });
        
        res.json(newDocument);
      }
    );
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

app.put('/api/documents/:id', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { title, content, type, fileType, metadata, tags } = req.body;
    
    const metadataStr = metadata ? JSON.stringify(metadata) : null;
    const tagsStr = tags ? JSON.stringify(tags) : null;
    
    userDb.run(
      `UPDATE documents 
       SET title = ?, content = ?, type = ?, file_type = ?, metadata = ?, tags = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND user_id = ?`,
      [title, content, type, fileType, metadataStr, tagsStr, id, userId],
      function(err) {
        if (err) {
          console.error('Error updating document:', err);
          return res.status(500).json({ error: 'Failed to update document' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Document not found' });
        }
        
        userDb.get('SELECT * FROM documents WHERE id = ?', [id], (err, row) => {
          if (err || !row) {
            return res.status(500).json({ error: 'Failed to fetch updated document' });
          }
          
          const document = {
            id: row.id.toString(),
            title: row.title,
            content: row.content,
            type: row.type,
            fileType: row.file_type,
            metadata: row.metadata ? JSON.parse(row.metadata) : {},
            tags: row.tags ? JSON.parse(row.tags) : [],
            createdAt: row.created_at,
            updatedAt: row.updated_at
          };
          
          // 触发知识图谱增量更新钩子 (异步)
          onDocumentUpdated(document, { async: true, fullRebuild: false })
            .then(result => {
              console.log('[KG Hook] 文档更新钩子结果:', result);
            })
            .catch(error => {
              console.error('[KG Hook] 文档更新钩子失败:', error);
            });
          
          res.json(document);
        });
      }
    );
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

app.delete('/api/documents/:id', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    
    userDb.run('DELETE FROM documents WHERE id = ? AND user_id = ?', [id, userId], function(err) {
      if (err) {
        console.error('Error deleting document:', err);
        return res.status(500).json({ error: 'Failed to delete document' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      // 触发知识图谱清理钩子 (异步)
      onDocumentDeleted(id, { async: true })
        .then(result => {
          console.log('[KG Hook] 文档删除钩子结果:', result);
        })
        .catch(error => {
          console.error('[KG Hook] 文档删除钩子失败:', error);
        });
      
      res.json({ message: 'Document deleted successfully' });
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// 标签相关路由
app.get('/api/tags', (req, res) => {
  try {
    res.json(mockTags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

app.post('/api/tags', (req, res) => {
  try {
    const { name, color, description } = req.body;
    const newTag = {
      id: (mockTags.length + 1).toString(),
      name,
      color: color || '#999999',
      description
    };
    mockTags.push(newTag);
    res.status(201).json(newTag);
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// 文件上传API
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { filename, path: filePath, originalname, size, mimetype } = req.file;
    
    // 根据文件类型进行解析
    let content = '';
    let fileType = path.extname(originalname).toLowerCase();
    
    // 简单的文本文件解析示例
    if (fileType === '.txt' || fileType === '.md') {
      content = fs.readFileSync(filePath, 'utf8');
    } else if (fileType === '.docx') {
      // 处理docx文件
      try {
        const data = fs.readFileSync(filePath);
        const zip = await JSZip.loadAsync(data);
        const docXml = await zip.file('word/document.xml').async('string');
        // 简单的XML解析，提取文本内容
        const textMatches = docXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
        if (textMatches) {
          content = textMatches.map(match => match.replace(/<[^>]*>/g, '')).join('\n');
        }
      } catch (error) {
        console.error('Error parsing docx file:', error);
        content = '无法解析docx文件内容';
      }
    } else if (fileType === '.doc') {
      // 对于旧版doc文件，提供提示信息
      content = '旧版.doc文件暂不支持直接预览，建议转换为.docx格式';
    }
    
    // 创建文档记录（使用模拟数据）
    // 修复中文文件名乱码问题
    let title = originalname.replace(fileType, '');
    // 确保标题正确处理中文
    title = Buffer.from(title, 'latin1').toString('utf8');
    
    const document = {
      id: (mockDocuments.length + 1).toString(),
      title: title,
      content,
      type: 'document',
      fileType: fileType,
      metadata: {
        filename,
        originalname: Buffer.from(originalname, 'latin1').toString('utf8'),
        size,
        mimetype,
        filePath
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    mockDocuments.push(document);
    
    // 保存到文件
    saveDocuments(mockDocuments);
    
    // 模拟添加到向量数据库（异步处理）
    setTimeout(() => {
      console.log('Mock: Document added to vector DB');
    }, 1000);
    
    res.status(201).json(document);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// AI功能相关API（模拟实现）

// AI搜索API
app.post('/api/ai/search', async (req, res) => {
  try {
    const { query, topK = 5 } = req.body;
    
    console.log('收到AI搜索请求:', query);
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }
    
    // 获取所有文档
    const documents = loadDocuments();
    
    // 改进的文档搜索逻辑
    const queryLower = query.toLowerCase();
    
    // 智能关键词提取 - 支持中文分词
    let queryKeywords = [];
    
    // 尝试按空格拆分
    const spaceSplit = queryLower.split(/\s+/).filter(k => k.length > 0);
    
    if (spaceSplit.length > 1) {
      // 如果有空格，按空格拆分
      queryKeywords = spaceSplit;
    } else {
      // 如果没有空格，尝试按常见中文分隔符拆分
      const separators = ['、', '，', ',', '。', '的', '和', '与', '或', '及', '是', '在', '有', '个', '种'];
      let tempQuery = queryLower;
      
      // 先移除常见停用词
      const stopWords = ['的', '了', '和', '是', '在', '有', '个', '种', '等', '等'];
      stopWords.forEach(word => {
        tempQuery = tempQuery.replace(new RegExp(word, 'g'), ' ');
      });
      
      // 按空格拆分
      queryKeywords = tempQuery.split(/\s+/).filter(k => k.length > 1);
      
      // 如果拆分后只有一个词，尝试按字符拆分（保留有意义的词组）
      if (queryKeywords.length === 0 || queryKeywords.length === 1) {
        // 对于中文，尝试提取2-4字的词组
        const charArray = queryLower.split('');
        for (let i = 0; i < charArray.length - 1; i++) {
          for (let len = 2; len <= Math.min(4, charArray.length - i); len++) {
            const phrase = charArray.slice(i, i + len).join('');
            if (phrase.length >= 2 && !queryKeywords.includes(phrase)) {
              queryKeywords.push(phrase);
            }
          }
        }
      }
    }
    
    // 确保至少包含原始查询
    if (!queryKeywords.includes(queryLower)) {
      queryKeywords.unshift(queryLower);
    }
    
    console.log('原始查询:', query);
    console.log('搜索关键词:', queryKeywords);
    console.log('文档总数:', documents.length);
    
    // 为每个文档计算相关性分数
    const scoredDocs = documents.map(doc => {
      const titleLower = doc.title.toLowerCase();
      const contentLower = doc.content.toLowerCase();
      
      let score = 0;
      const matchDetails = [];
      
      // 检查标题完全匹配
      if (titleLower.includes(queryLower)) {
        score += 15; // 标题完全匹配给予最高分
        matchDetails.push('标题完全匹配');
      }
      
      // 检查内容完全匹配
      if (contentLower.includes(queryLower)) {
        score += 12; // 内容完全匹配给予高分
        matchDetails.push('内容完全匹配');
      }
      
      // 检查标题中的关键词匹配
      queryKeywords.forEach(keyword => {
        if (keyword.length >= 2 && titleLower.includes(keyword)) {
          const keywordScore = keyword === queryLower ? 8 : 5;
          score += keywordScore;
          matchDetails.push(`标题关键词: "${keyword}"`);
        }
      });
      
      // 检查内容中的关键词匹配
      queryKeywords.forEach(keyword => {
        if (keyword.length >= 2 && contentLower.includes(keyword)) {
          const keywordScore = keyword === queryLower ? 6 : 3;
          score += keywordScore;
          matchDetails.push(`内容关键词: "${keyword}"`);
        }
      });
      
      // 计算关键词覆盖率
      const matchedKeywords = queryKeywords.filter(keyword => 
        keyword.length >= 2 && (titleLower.includes(keyword) || contentLower.includes(keyword))
      );
      const coverageRatio = matchedKeywords.length / queryKeywords.length;
      score += coverageRatio * 8; // 关键词覆盖率给予额外分数
      
      return {
        doc,
        score,
        matchDetails
      };
    });
    
    // 按分数排序并取前topK个
    const sortedDocs = scoredDocs
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    
    const relevantDocs = sortedDocs.map(item => item.doc);
    
    console.log('找到相关文档数:', relevantDocs.length);
    console.log('文档匹配分数:', sortedDocs.slice(0, topK).map(item => ({
      title: item.doc.title,
      score: item.score,
      details: item.matchDetails
    })));
    
    // 构建知识库上下文
    const knowledgeBaseContext = relevantDocs.length > 0 ? 
      relevantDocs.map((doc, index) => 
        `【知识库文档${index + 1}】\n标题：${doc.title}\n完整内容：\n${doc.content}\n\n`
      ).join('') : 
      '知识库中没有找到相关文档';
    
    console.log('知识库上下文长度:', knowledgeBaseContext.length);
    
    // 联网搜索
    let webSearchResults = [];
    try {
      console.log('正在进行联网搜索...');
      webSearchResults = await performWebSearch(query);
      console.log('联网搜索完成，找到结果数:', webSearchResults.length);
    } catch (error) {
      console.error('联网搜索失败:', error);
      webSearchResults = [];
    }
    
    // 构建联网搜索上下文
    const webSearchContext = webSearchResults.length > 0 ?
      webSearchResults.map((result, index) => 
        `网络搜索结果${index + 1}：${result.title}\n摘要：${result.snippet}\n链接：${result.url}\n`
      ).join('\n') :
      '联网搜索没有找到相关结果';
    
    // 构建综合提示词
    const prompt = `你是一个智能助手，需要基于知识库内容和联网搜索结果来回答用户的问题。

知识库内容：
${knowledgeBaseContext}

联网搜索结果：
${webSearchContext}

用户问题：${query}

重要提示：
1. 请仔细阅读知识库中的所有文档内容，特别是文档的标题和完整内容
2. 如果知识库中有与用户问题相关的文档，必须优先使用知识库中的信息
3. 即使知识库中的文档标题与用户问题不完全一致，也要检查文档内容是否包含相关信息
4. 知识库中的信息是最权威的来源，请优先参考

要求：
1. 综合知识库和联网搜索的信息，给出全面、准确的答案
2. 如果知识库和联网搜索都有相关信息，要整合两者的内容
3. 如果知识库有相关信息但联网搜索没有，以知识库为主
4. 如果联网搜索有相关信息但知识库没有，以联网搜索为主
5. 如果两者都没有相关信息，诚实说明无法回答
6. 回答要结构清晰，分点说明
7. 引用信息来源时，明确标注是来自知识库还是联网搜索
8. 用中文回答，语言简洁明了

请给出详细的回答。`;
    
    // 调用云端大模型
    console.log('正在调用云端大模型生成答案...');
    let aiResponse = null;
    let lastError = null;
    
    const cloudModels = ['deepseek-chat', 'qwen-plus', 'qwen-turbo'];
    
    for (const cloudModel of cloudModels) {
      try {
        console.log(`尝试使用模型: ${cloudModel}`);
        
        let apiKey;
        if (cloudModel.startsWith('qwen')) {
          apiKey = process.env.QWEN_API_KEY;
        } else if (cloudModel.startsWith('deepseek')) {
          apiKey = process.env.DEEPSEEK_API_KEY;
        }
        
        if (!apiKey) {
          console.log(`模型 ${cloudModel} 的API密钥未配置，跳过`);
          continue;
        }
        
        let apiUrl, requestBody;
        
        if (cloudModel === 'qwen-turbo' || cloudModel === 'qwen-plus') {
          apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
          requestBody = {
            model: cloudModel,
            messages: [
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
          };
        } else if (cloudModel === 'deepseek-chat' || cloudModel === 'deepseek-reasoner') {
          apiUrl = 'https://api.deepseek.com/v1/chat/completions';
          requestBody = {
            model: cloudModel,
            messages: [
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
          };
        } else {
          continue;
        }
        
        const cloudResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody)
        });
        
        if (!cloudResponse.ok) {
          const errorText = await cloudResponse.text();
          console.error(`模型 ${cloudModel} API error:`, errorText);
          lastError = `模型 ${cloudModel} API error: ${cloudResponse.status} - ${errorText}`;
          continue;
        }
        
        const cloudData = await cloudResponse.json();
        
        if (cloudData.choices && cloudData.choices.length > 0) {
          aiResponse = cloudData.choices[0].message.content;
          console.log(`模型 ${cloudModel} 调用成功`);
          break;
        } else if (cloudData.output && cloudData.output.text) {
          aiResponse = cloudData.output.text;
          console.log(`模型 ${cloudModel} 调用成功`);
          break;
        } else {
          console.error(`模型 ${cloudModel} 返回格式无效`);
          lastError = `模型 ${cloudModel} 返回格式无效`;
          continue;
        }
      } catch (error) {
        console.error(`模型 ${cloudModel} 调用失败:`, error);
        lastError = error.message;
        continue;
      }
    }
    
    if (!aiResponse) {
      throw new Error(`所有模型调用失败，最后错误: ${lastError}`);
    }
    
    console.log('AI搜索完成，回答长度:', aiResponse.length);
    
    res.json({
      success: true,
      answer: aiResponse,
      sources: relevantDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        preview: doc.content.substring(0, 100) + (doc.content.length > 100 ? '...' : '')
      })),
      webSources: webSearchResults.map(result => ({
        title: result.title,
        url: result.url,
        snippet: result.snippet
      }))
    });
  } catch (error) {
    console.error('AI search failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'AI search failed'
    });
  }
});

// 联网搜索功能
async function performWebSearch(query) {
  try {
    const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error('联网搜索请求失败');
    }
    
    const html = await response.text();
    const results = [];
    
    const titleRegex = /<a[^>]*class="result__a[^>]*>([^<]*)<\/a>/g;
    const snippetRegex = /<a[^>]*class="result__a[^>]*>[\s\S]*?<\/a>[\s\S]*?<\/div>/g;
    
    let match;
    while ((match = titleRegex.exec(html)) !== null && results.length < 5) {
      results.push({
        title: match[1],
        url: '',
        snippet: ''
      });
    }
    
    return results;
  } catch (error) {
    console.error('联网搜索失败:', error);
    return [];
  }
}

// 智能标签生成API
app.post('/api/ai/generate-tags', (req, res) => {
  try {
    const { content, topN = 5 } = req.body;
    // 简单的关键词提取实现
    const keywords = ['前端', '后端', 'AI', '数据库', '笔记'];
    // 随机选择一些关键词作为标签
    const shuffled = keywords.sort(() => 0.5 - Math.random());
    const tags = shuffled.slice(0, topN);
    
    res.json({ tags });
  } catch (error) {
    console.error('Tag generation failed:', error);
    res.status(500).json({ error: 'Tag generation failed' });
  }
});

// 获取可用的AI模型列表
app.get('/api/ai/models', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_API_URL}/tags`);
    const data = await response.json();
    
    if (data.models && data.models.length > 0) {
      const models = data.models.map(model => ({
        name: model.name,
        size: model.size,
        modified: model.modified_at
      }));
      
      res.json({
        success: true,
        models
      });
    } else {
      res.json({
        success: false,
        models: [],
        message: 'No models found'
      });
    }
  } catch (error) {
    console.error('Failed to fetch models:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch models from Ollama'
    });
  }
});

// AI文档总结API
app.post('/api/ai/summarize', authMiddleware, async (req, res) => {
  try {
    const { content, model, documentId } = req.body;
    const userId = req.userId;
    
    console.log('收到AI总结请求');
    console.log('模型:', model);
    console.log('文档ID:', documentId);
    console.log('用户ID:', userId);
    console.log('内容长度:', content ? content.length : 0);
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }
    
    if (!model) {
      return res.status(400).json({
        success: false,
        error: 'Model is required'
      });
    }
    
    if (typeof content !== 'string') {
      console.error('内容类型错误:', typeof content);
      return res.status(400).json({
        success: false,
        error: 'Content must be a string'
      });
    }
    
    console.log(`使用模型 ${model} 进行AI总结...`);
    console.log(`文档内容长度: ${content.length} 字符`);
    
    // 构建简洁的提示词
    const prompt = `请总结以下文档的核心内容：

${content}

要求：简洁明了，突出重点。`;
    
    // 创建超时控制器
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 600000); // 10分钟超时
    
    try {
      let summary;
      
      // 判断是本地模型还是云端模型
      if (LOCAL_MODELS.includes(model)) {
        // 调用本地Ollama API
        console.log('正在调用本地Ollama API...');
        const ollamaResponse = await fetch(`${OLLAMA_API_URL}/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            prompt: prompt,
            stream: false,
            options: {
              temperature: 0.7,
              top_p: 0.9,
              num_ctx: 2048,
              num_predict: 300
            }
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!ollamaResponse.ok) {
          const errorText = await ollamaResponse.text();
          console.error('Ollama API error:', errorText);
          throw new Error(`Ollama API error: ${ollamaResponse.status} - ${errorText}`);
        }
        
        console.log('正在解析Ollama响应...');
        const ollamaData = await ollamaResponse.json();
        summary = ollamaData.response || '无法生成总结';
      } else {
        // 调用云端模型API
        console.log('正在调用云端模型API...');
        clearTimeout(timeout);
        summary = await callCloudModel(model, prompt);
      }
      
      console.log('AI总结生成成功，长度:', summary.length);
      
      // 分析文档
      const sentences = content.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
      const analysis = {
        wordCount: content.length,
        sentenceCount: sentences.length,
        mainTopics: ['技术', '开发', '应用'].slice(0, Math.floor(Math.random() * 3) + 1),
        complexity: sentences.length > 10 ? '复杂' : sentences.length > 5 ? '中等' : '简单'
      };
      
      // 创建新的总结版本
      const summaryVersion = {
        id: Date.now().toString(),
        summary,
        analysis,
        model,
        timestamp: new Date().toISOString()
      };
      
      // 如果有文档ID，保存总结到文档
      if (documentId) {
        userDb.get('SELECT * FROM documents WHERE id = ? AND user_id = ?', [documentId, userId], (err, row) => {
          if (err) {
            console.error('Error fetching document:', err);
            return res.json({ 
              success: true,
              summary,
              analysis,
              model,
              timestamp: new Date().toISOString(),
              summaryVersion
            });
          }
          
          if (!row) {
            console.log('Document not found or does not belong to user');
            return res.json({ 
              success: true,
              summary,
              analysis,
              model,
              timestamp: new Date().toISOString(),
              summaryVersion
            });
          }
          
          let summaries = [];
          try {
            summaries = row.summaries ? JSON.parse(row.summaries) : [];
          } catch (e) {
            console.error('Error parsing summaries:', e);
          }
          
          // 检查是否已有相同模型的总结
          const existingIndex = summaries.findIndex(s => s.model === model);
          
          if (existingIndex !== -1) {
            // 已有相同模型的总结，需要对比
            const oldSummary = summaries[existingIndex];
            return res.json({
              success: true,
              summary,
              analysis,
              model,
              timestamp: new Date().toISOString(),
              hasConflict: true,
              oldSummary: oldSummary,
              summaryVersion
            });
          } else {
            // 新模型的总结，直接保存
            summaries.push(summaryVersion);
            const summariesJson = JSON.stringify(summaries);
            
            userDb.run(
              'UPDATE documents SET summaries = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
              [summariesJson, documentId, userId],
              (err) => {
                if (err) {
                  console.error('Error saving summary:', err);
                }
              }
            );
          }
        });
      }
      
      res.json({ 
        success: true,
        summary,
        analysis,
        model,
        timestamp: new Date().toISOString(),
        summaryVersion
      });
    } catch (error) {
      clearTimeout(timeout);
      
      if (error.name === 'AbortError') {
        console.error('AI总结超时:', error);
        throw new Error('AI总结超时，请稍后重试');
      } else {
        console.error('AI总结错误:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Document summarization failed:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Document summarization failed'
    });
  }
});

// 保存选中的总结版本
app.post('/api/ai/summary/select', authMiddleware, (req, res) => {
  try {
    const { documentId, summaryId } = req.body;
    const userId = req.userId;
    
    if (!documentId || !summaryId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID and summary ID are required'
      });
    }
    
    userDb.get('SELECT * FROM documents WHERE id = ? AND user_id = ?', [documentId, userId], (err, row) => {
      if (err) {
        console.error('Error fetching document:', err);
        return res.status(500).json({
          success: false,
          error: 'Database error'
        });
      }
      
      if (!row) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }
      
      let summaries = [];
      try {
        summaries = row.summaries ? JSON.parse(row.summaries) : [];
      } catch (e) {
        console.error('Error parsing summaries:', e);
      }
      
      if (!summaries || summaries.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No summaries found for this document'
        });
      }
      
      const selectedSummary = summaries.find(s => s.id === summaryId);
    
      if (!selectedSummary) {
        return res.status(404).json({
          success: false,
          error: 'Summary version not found'
        });
      }
      
      const summariesJson = JSON.stringify(summaries);
      
      userDb.run(
        'UPDATE documents SET summaries = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        [summariesJson, documentId, userId],
        (err) => {
          if (err) {
            console.error('Error updating current summary:', err);
            return res.status(500).json({
              success: false,
              error: 'Database error'
            });
          }
          
          res.json({
            success: true,
            message: 'Summary selected successfully'
          });
        }
      );
    });
  } catch (error) {
    console.error('Failed to select summary:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to select summary'
    });
  }
});

// 实体识别API
app.post('/api/ai/extract-entities', (req, res) => {
  try {
    const { content } = req.body;
    // 模拟实体和关系数据
    const entities = [
      { text: 'React', type: 'FRAMEWORK', confidence: 0.9 },
      { text: 'JavaScript', type: 'LANGUAGE', confidence: 0.85 },
      { text: 'SQLite', type: 'DATABASE', confidence: 0.8 },
      { text: '语义搜索', type: 'TECHNOLOGY', confidence: 0.75 }
    ];
    
    const relations = [
      { source: 'React', target: 'JavaScript', type: 'USING' },
      { source: '语义搜索', target: 'AI', type: 'CATEGORY' }
    ];
    
    res.json({ entities, relations });
  } catch (error) {
    console.error('Entity extraction failed:', error);
    res.status(500).json({ error: 'Entity extraction failed' });
  }
});

// 知识图谱数据API
// 知识图谱缓存
let cachedKnowledgeGraph = null;
let lastKnowledgeGraphDocCount = 0;
let lastKnowledgeGraphDocHash = '';

// AI搜索推荐缓存
let cachedRecommendations = null;
let lastRecommendationDocCount = 0;
let lastRecommendationDocHash = '';

// 初始化缓存
function initializeCaches() {
  const recommendationsCache = loadRecommendationsCache();
  cachedRecommendations = recommendationsCache.recommendations;
  lastRecommendationDocCount = recommendationsCache.docCount;
  lastRecommendationDocHash = recommendationsCache.docHash;
  
  const knowledgeGraphCache = loadKnowledgeGraphCache();
  cachedKnowledgeGraph = {
    entities: knowledgeGraphCache.entities,
    relations: knowledgeGraphCache.relations
  };
  lastKnowledgeGraphDocCount = knowledgeGraphCache.docCount;
  lastKnowledgeGraphDocHash = knowledgeGraphCache.docHash;
  
  console.log('缓存初始化完成');
  console.log('推荐缓存:', { count: cachedRecommendations.length, docCount: lastRecommendationDocCount });
  console.log('知识图谱缓存:', { entities: cachedKnowledgeGraph.entities.length, docCount: lastKnowledgeGraphDocCount });
}

initializeCaches();

function calculateDocumentsHash(documents) {
  const content = documents.map(doc => `${doc.id}:${doc.title}:${doc.content}`).join('|');
  const crypto = require('crypto');
  return crypto.createHash('md5').update(content).digest('hex');
}

// 获取知识图谱数据
app.get('/api/knowledge-graph', (req, res) => {
  try {
    const documents = loadDocuments();
    
    console.log('获取知识图谱');
    console.log('当前文档数量:', documents.length);
    console.log('上次生成时文档数量:', lastKnowledgeGraphDocCount);
    
    const currentHash = calculateDocumentsHash(documents);
    console.log('当前文档哈希:', currentHash);
    console.log('上次文档哈希:', lastKnowledgeGraphDocHash);
    
    const needRegenerate = documents.length !== lastKnowledgeGraphDocCount || 
                          currentHash !== lastKnowledgeGraphDocHash;
    
    if (needRegenerate || !cachedKnowledgeGraph || !cachedKnowledgeGraph.entities || cachedKnowledgeGraph.entities.length === 0) {
      console.log('文档内容变化或缓存为空，需要重新生成知识图谱');
      return res.json({
        success: true,
        entities: null,
        relations: null,
        needRegenerate: true,
        message: '文档内容变化或缓存为空，需要重新生成知识图谱'
      });
    }
    
    res.json({
      success: true,
      entities: cachedKnowledgeGraph.entities,
      relations: cachedKnowledgeGraph.relations,
      needRegenerate: false,
      message: '使用缓存的知识图谱'
    });
  } catch (error) {
    console.error('获取知识图谱失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 生成知识图谱
app.post('/api/knowledge-graph', async (req, res) => {
  try {
    const { model = 'deepseek-chat' } = req.body;
    
    console.log('收到知识图谱生成请求');
    console.log('使用模型:', model);
    
    const documents = loadDocuments();
    
    console.log('加载到的文档数量:', documents.length);
    console.log('文档列表:', documents.map(doc => ({ id: doc.id, title: doc.title, contentLength: doc.content?.length || 0 })));
    
    if (documents.length === 0) {
      cachedKnowledgeGraph = { entities: [], relations: [] };
      lastKnowledgeGraphDocCount = 0;
      lastKnowledgeGraphDocHash = '';
      return res.json({
        success: true,
        entities: [],
        relations: [],
        message: '暂无文档，使用空知识图谱'
      });
    }
    
    const documentsText = documents.map(doc => 
      `文档ID: ${doc.id}\n标题: ${doc.title}\n内容: ${doc.content.substring(0, 800)}`
    ).join('\n\n');
    
    console.log('发送给AI的文档文本长度:', documentsText.length);
    
    const prompt = `请基于以下文档内容，构建一个知识图谱。

${documentsText}

要求：
1. 识别文档中的重要实体（如概念、技术、方法、工具等）
2. 识别实体之间的关系（如包含、应用、相关、依赖等）
3. 返回JSON格式，包含entities数组和relations数组
4. 每个entity包含：id（唯一标识）、name（实体名称）、type（实体类型，如concept、technology、method、tool等）、value（重要性权重，50-100之间的整数）
5. 每个relation包含：source（源实体ID）、target（目标实体ID）、type（关系类型）
6. 实体数量控制在10-20个，关系数量控制在15-30个
7. 确保关系图是连通的，避免孤立的实体

返回格式示例：
{
  "entities": [
    { "id": "1", "name": "人工智能", "type": "concept", "value": 100 },
    { "id": "2", "name": "机器学习", "type": "technology", "value": 90 }
  ],
  "relations": [
    { "source": "1", "target": "2", "type": "包含" }
  ]
}

请只返回JSON，不要包含其他文字说明。`;
    
    const cloudModels = ['deepseek-chat', 'qwen-plus', 'qwen-turbo'];
    let aiResponse = null;
    let lastError = null;
    
    for (const cloudModel of cloudModels) {
      try {
        console.log(`尝试使用模型: ${cloudModel}`);
        
        let apiKey;
        if (cloudModel.startsWith('qwen')) {
          apiKey = process.env.QWEN_API_KEY;
        } else if (cloudModel.startsWith('deepseek')) {
          apiKey = process.env.DEEPSEEK_API_KEY;
        }
        
        if (!apiKey) {
          console.log(`模型 ${cloudModel} 的API密钥未配置，跳过`);
          continue;
        }
        
        let apiUrl, requestBody;
        
        if (cloudModel === 'qwen-turbo' || cloudModel === 'qwen-plus') {
          apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
          requestBody = {
            model: cloudModel,
            messages: [
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
          };
        } else if (cloudModel === 'deepseek-chat' || cloudModel === 'deepseek-reasoner') {
          apiUrl = 'https://api.deepseek.com/v1/chat/completions';
          requestBody = {
            model: cloudModel,
            messages: [
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
          };
        } else {
          continue;
        }
        
        const cloudResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody)
        });
        
        if (!cloudResponse.ok) {
          const errorText = await cloudResponse.text();
          console.error(`模型 ${cloudModel} API error:`, errorText);
          lastError = `模型 ${cloudModel} API error: ${cloudResponse.status} - ${errorText}`;
          continue;
        }
        
        const cloudData = await cloudResponse.json();
        
        if (cloudData.choices && cloudData.choices.length > 0) {
          aiResponse = cloudData.choices[0].message.content;
          console.log(`模型 ${cloudModel} 调用成功`);
          break;
        } else if (cloudData.output && cloudData.output.text) {
          aiResponse = cloudData.output.text;
          console.log(`模型 ${cloudModel} 调用成功`);
          break;
        } else {
          console.error(`模型 ${cloudModel} 返回格式无效`);
          lastError = `模型 ${cloudModel} 返回格式无效`;
          continue;
        }
      } catch (error) {
        console.error(`模型 ${cloudModel} 调用失败:`, error);
        lastError = error.message;
        continue;
      }
    }
    
    if (!aiResponse) {
      throw new Error(`所有模型调用失败，最后错误: ${lastError}`);
    }
    
    console.log('AI响应:', aiResponse);
    
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI响应中未找到有效的JSON');
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    if (!result.entities || !Array.isArray(result.entities)) {
      throw new Error('AI响应格式错误：缺少entities数组');
    }
    
    if (!result.relations || !Array.isArray(result.relations)) {
      throw new Error('AI响应格式错误：缺少relations数组');
    }
    
    cachedKnowledgeGraph = result;
    lastKnowledgeGraphDocCount = documents.length;
    lastKnowledgeGraphDocHash = calculateDocumentsHash(documents);
    
    saveKnowledgeGraphCache(result.entities, result.relations, lastKnowledgeGraphDocCount, lastKnowledgeGraphDocHash);
    
    console.log('生成的知识图谱实体数:', result.entities.length);
    console.log('生成的知识图谱关系数:', result.relations.length);
    console.log('知识图谱已保存到缓存文件');
    
    res.json({
      success: true,
      entities: result.entities,
      relations: result.relations,
      message: '知识图谱生成成功'
    });
  } catch (error) {
    console.error('生成知识图谱失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// AI自动分类API
app.post('/api/ai/classify', authMiddleware, async (req, res) => {
  try {
    const { model = 'deepseek-chat' } = req.body;
    const userId = req.userId;
    
    console.log('收到AI分类请求');
    console.log('使用模型:', model);
    console.log('用户ID:', userId);
    
    userDb.all('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC', [userId], async (err, rows) => {
      if (err) {
        console.error('Error fetching documents:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch documents'
        });
      }
      
      const documents = rows.map(row => ({
        id: row.id.toString(),
        title: row.title,
        content: row.content,
        type: row.type,
        fileType: row.file_type,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        tags: row.tags ? JSON.parse(row.tags) : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      console.log('加载到的文档数量:', documents.length);
      console.log('文档列表:', documents.map(doc => ({ id: doc.id, title: doc.title, contentLength: doc.content?.length || 0 })));
      
      if (documents.length === 0) {
        return res.json({
          success: true,
          categories: [],
          message: '暂无文档需要分类'
        });
      }
      
      const documentsText = documents.map(doc => 
        `文档ID: ${doc.id}\n标题: ${doc.title}\n内容: ${doc.content.substring(0, 500)}`
      ).join('\n\n');
    
      console.log('发送给AI的文档文本长度:', documentsText.length);
      
      const prompt = `请分析以下文档，将它们分为合理的类别。

${documentsText}

要求：
1. 根据文档内容自动确定合适的类别数量，不做数量限制
2. 每个类别要有明确的主题
3. 为每个类别提供简短的描述（不超过50字）
4. 返回JSON格式，包含categories数组
5. 每个category包含：id（唯一标识）、name（类别名称）、description（类别描述）、color（颜色，使用十六进制格式，如#FF6B6B）、documentIds（属于该类别的文档ID数组）

返回格式示例：
{
  "categories": [
    {
      "id": "tech",
      "name": "技术文档",
      "description": "包含技术规范、开发指南等技术相关文档",
      "color": "#4A90E2",
      "documentIds": ["1", "2", "3"]
    }
  ]
}

请只返回JSON，不要包含其他文字说明。`;
      
      let classificationResult;
      let usedModel = model;
      
      try {
        if (LOCAL_MODELS.includes(model)) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 300000);
          
          try {
            const ollamaResponse = await fetch(`${OLLAMA_API_URL}/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: model,
                prompt: prompt,
                stream: false,
                options: {
                  temperature: 0.3,
                  top_p: 0.9,
                  num_ctx: 4096
                }
              }),
              signal: controller.signal
            });
            
            clearTimeout(timeout);
            
            if (!ollamaResponse.ok) {
              throw new Error(`Ollama API error: ${ollamaResponse.status}`);
            }
            
            const ollamaData = await ollamaResponse.json();
            classificationResult = ollamaData.response;
          } catch (error) {
            clearTimeout(timeout);
            throw error;
          }
        } else {
          console.log('使用云端模型进行分类:', model);
          
          // 获取所有可用的云端模型
          const cloudModels = Object.keys(CLOUD_MODELS);
          const cloudModelsWithKeys = cloudModels.filter(modelKey => {
            const config = CLOUD_MODELS[modelKey];
            return config && config.apiKey && config.apiKey.length > 0;
          });
          
          if (cloudModelsWithKeys.length === 0) {
            throw new Error('没有可用的云端模型，请配置API密钥');
          }
          
          console.log('可用的云端模型:', cloudModelsWithKeys);
          
          // 如果用户指定的模型在可用列表中，优先使用，否则使用第一个可用模型
          let modelsToTry = [];
          if (cloudModelsWithKeys.includes(model)) {
            modelsToTry = [model, ...cloudModelsWithKeys.filter(m => m !== model)];
          } else {
            modelsToTry = cloudModelsWithKeys;
          }
          
          console.log('尝试模型顺序:', modelsToTry);
          
          // 依次尝试每个云端模型，直到成功
          for (const modelToTry of modelsToTry) {
            try {
              console.log(`尝试使用模型: ${modelToTry}`);
              classificationResult = await callCloudModel(modelToTry, prompt);
              usedModel = modelToTry;
              console.log(`模型 ${modelToTry} 调用成功`);
              break;
            } catch (error) {
              console.error(`模型 ${modelToTry} 调用失败:`, error.message);
              if (modelToTry === modelsToTry[modelsToTry.length - 1]) {
                throw new Error(`所有云端模型调用失败，最后错误: ${error.message}`);
              }
              console.log(`尝试下一个模型...`);
            }
          }
        }
        
        console.log('AI分类原始结果:', classificationResult);
        console.log('分类结果长度:', classificationResult ? classificationResult.length : 0);
        console.log('实际使用的模型:', usedModel);
        
        let categories;
        try {
          const jsonMatch = classificationResult.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            categories = JSON.parse(jsonMatch[0]);
          } else {
            categories = JSON.parse(classificationResult);
          }
        } catch (parseError) {
          console.error('解析分类结果失败:', parseError);
          categories = generateDefaultCategories(documents);
        }
        
        if (!categories.categories || !Array.isArray(categories.categories)) {
          categories = generateDefaultCategories(documents);
        }
        
        const categoriesWithDocuments = categories.categories.map(category => {
          const categoryDocs = category.documentIds
            ? documents.filter(doc => category.documentIds.includes(doc.id))
            : [];
          
          return {
            ...category,
            documentCount: categoryDocs.length,
            sampleDocuments: categoryDocs.slice(0, 3).map(doc => ({
              id: doc.id,
              title: doc.title,
              fileType: doc.fileType
            }))
          };
        });
        
        await saveCategories(userId, categoriesWithDocuments);
        
        res.json({
          success: true,
          categories: categoriesWithDocuments,
          model: usedModel,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('AI分类失败:', error);
        const defaultCategories = generateDefaultCategories(documents);
        
        res.json({
          success: true,
          categories: defaultCategories,
          message: 'AI分类失败，使用默认分类',
          error: error.message
        });
      }
    });
  } catch (error) {
    console.error('AI分类错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'AI分类失败'
    });
  }
});

function generateDefaultCategories(documents) {
  const categories = [
    {
      id: 'general',
      name: '通用文档',
      description: '包含各类通用文档和资料',
      color: '#4A90E2',
      documentIds: documents.map(doc => doc.id)
    }
  ];
  
  return categories.map(category => {
    const categoryDocs = category.documentIds
      ? documents.filter(doc => category.documentIds.includes(doc.id))
      : [];
    
    return {
      ...category,
      documentCount: categoryDocs.length,
      sampleDocuments: categoryDocs.slice(0, 3).map(doc => ({
        id: doc.id,
        title: doc.title,
        fileType: doc.fileType
      }))
    };
  });
}

app.get('/api/categories', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    
    userDb.all('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC', [userId], async (err, rows) => {
      if (err) {
        console.error('Error fetching documents:', err);
        return res.status(500).json({
          success: false,
          error: err.message
        });
      }
      
      const documents = rows.map(row => ({
        id: row.id.toString(),
        title: row.title,
        content: row.content,
        type: row.type,
        fileType: row.file_type,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        tags: row.tags ? JSON.parse(row.tags) : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      const savedCategories = await loadCategories(userId);
      
      if (savedCategories && savedCategories.length > 0) {
        const cachedDocCount = savedCategories.reduce((total, cat) => total + cat.documentCount, 0);
        
        if (cachedDocCount === documents.length) {
          res.json({
            success: true,
            categories: savedCategories,
            fromCache: true
          });
        } else {
          const defaultCategories = generateDefaultCategories(documents);
          await saveCategories(userId, defaultCategories);
          res.json({
            success: true,
            categories: defaultCategories,
            fromCache: false
          });
        }
      } else {
        const defaultCategories = generateDefaultCategories(documents);
        await saveCategories(userId, defaultCategories);
        res.json({
          success: true,
          categories: defaultCategories,
          fromCache: false
        });
      }
    });
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/categories/:id/documents', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    userDb.all('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC', [userId], async (err, rows) => {
      if (err) {
        console.error('Error fetching documents:', err);
        return res.status(500).json({
          success: false,
          error: err.message
        });
      }
      
      const documents = rows.map(row => ({
        id: row.id.toString(),
        title: row.title,
        content: row.content,
        type: row.type,
        fileType: row.file_type,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        tags: row.tags ? JSON.parse(row.tags) : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      let filteredDocuments;
      
      if (id === 'all') {
        filteredDocuments = documents;
      } else {
        const savedCategories = await loadCategories(userId);
        const category = savedCategories.find(cat => cat.id === id);
        if (category && category.documentIds) {
          filteredDocuments = documents.filter(doc => category.documentIds.includes(doc.id));
        } else {
          filteredDocuments = [];
        }
      }
      
      res.json({
        success: true,
        documents: filteredDocuments,
        total: filteredDocuments.length
      });
    });
  } catch (error) {
    console.error('获取分类文档失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 生成AI搜索推荐
app.post('/api/ai/recommendations', async (req, res) => {
  try {
    const { model = 'deepseek-chat' } = req.body;
    
    console.log('收到AI搜索推荐生成请求');
    console.log('使用模型:', model);
    
    const documents = loadDocuments();
    
    console.log('加载到的文档数量:', documents.length);
    
    if (documents.length === 0) {
      cachedRecommendations = [];
      lastRecommendationDocCount = 0;
      return res.json({
        success: true,
        recommendations: [],
        message: '暂无文档，使用默认推荐'
      });
    }
    
    const documentsText = documents.map(doc => 
      `文档ID: ${doc.id}\n标题: ${doc.title}\n内容: ${doc.content.substring(0, 300)}`
    ).join('\n\n');
    
    console.log('发送给AI的文档文本长度:', documentsText.length);
    
    const prompt = `请基于以下文档内容，生成8个智能搜索推荐标签。

${documentsText}

要求：
1. 推荐标签应该是用户可能感兴趣搜索的关键词或问题
2. 标签要简洁明了，每个标签不超过10个字
3. 标签要覆盖文档的主要内容和主题
4. 返回JSON格式，包含recommendations数组
5. 每个recommendation包含：text（推荐标签文本）

返回格式示例：
{
  "recommendations": [
    { "text": "如何使用AI搜索" },
    { "text": "文档上传格式" },
    { "text": "知识图谱功能" }
  ]
}

请只返回JSON，不要包含其他文字说明。`;
    
    let aiResponse = null;
    let lastError = null;
    
    if (model.startsWith('ollama:')) {
      const modelName = model.replace('ollama:', '');
      const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 500
          }
        })
      });
      
      if (!ollamaResponse.ok) {
        throw new Error(`Ollama API error: ${ollamaResponse.status}`);
      }
      
      const ollamaData = await ollamaResponse.json();
      aiResponse = ollamaData.response;
    } else {
      const cloudModels = ['deepseek-chat', 'qwen-plus', 'qwen-turbo'];
      
      for (const cloudModel of cloudModels) {
        try {
          console.log(`尝试使用模型: ${cloudModel}`);
          
          let apiKey;
          if (cloudModel.startsWith('qwen')) {
            apiKey = process.env.QWEN_API_KEY;
          } else if (cloudModel.startsWith('deepseek')) {
            apiKey = process.env.DEEPSEEK_API_KEY;
          }
          
          if (!apiKey) {
            console.log(`模型 ${cloudModel} 的API密钥未配置，跳过`);
            continue;
          }
          
          let apiUrl, requestBody;
          
          if (cloudModel === 'qwen-turbo' || cloudModel === 'qwen-plus') {
            apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
            requestBody = {
              model: cloudModel,
              messages: [
                { role: 'user', content: prompt }
              ],
              temperature: 0.7,
              max_tokens: 500
            };
          } else if (cloudModel === 'deepseek-chat' || cloudModel === 'deepseek-reasoner') {
            apiUrl = 'https://api.deepseek.com/v1/chat/completions';
            requestBody = {
              model: cloudModel,
              messages: [
                { role: 'user', content: prompt }
              ],
              temperature: 0.7,
              max_tokens: 500
            };
          } else {
            continue;
          }
          
          const cloudResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
          });
          
          if (!cloudResponse.ok) {
            const errorText = await cloudResponse.text();
            console.error(`模型 ${cloudModel} API error:`, errorText);
            lastError = `模型 ${cloudModel} API error: ${cloudResponse.status} - ${errorText}`;
            continue;
          }
          
          const cloudData = await cloudResponse.json();
          
          if (cloudData.choices && cloudData.choices.length > 0) {
            aiResponse = cloudData.choices[0].message.content;
            console.log(`模型 ${cloudModel} 调用成功`);
            break;
          } else if (cloudData.output && cloudData.output.text) {
            aiResponse = cloudData.output.text;
            console.log(`模型 ${cloudModel} 调用成功`);
            break;
          } else {
            console.error(`模型 ${cloudModel} 返回格式无效`);
            lastError = `模型 ${cloudModel} 返回格式无效`;
            continue;
          }
        } catch (error) {
          console.error(`模型 ${cloudModel} 调用失败:`, error);
          lastError = error.message;
          continue;
        }
      }
      
      if (!aiResponse) {
        throw new Error(`所有模型调用失败，最后错误: ${lastError}`);
      }
    }
    
    console.log('AI响应:', aiResponse);
    
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI响应中未找到有效的JSON');
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    if (!result.recommendations || !Array.isArray(result.recommendations)) {
      throw new Error('AI响应格式错误：缺少recommendations数组');
    }
    
    cachedRecommendations = result.recommendations;
    lastRecommendationDocCount = documents.length;
    lastRecommendationDocHash = calculateDocumentsHash(documents);
    
    saveRecommendationsCache(cachedRecommendations, lastRecommendationDocCount, lastRecommendationDocHash);
    
    console.log('生成的推荐:', cachedRecommendations);
    console.log('推荐已保存到缓存文件');
    
    res.json({
      success: true,
      recommendations: cachedRecommendations,
      message: '推荐生成成功'
    });
  } catch (error) {
    console.error('生成AI搜索推荐失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取AI搜索推荐
app.get('/api/ai/recommendations', (req, res) => {
  try {
    const documents = loadDocuments();
    
    console.log('获取AI搜索推荐');
    console.log('当前文档数量:', documents.length);
    console.log('上次推荐时文档数量:', lastRecommendationDocCount);
    
    const currentHash = calculateDocumentsHash(documents);
    console.log('当前文档哈希:', currentHash);
    console.log('上次文档哈希:', lastRecommendationDocHash);
    
    const needRegenerate = documents.length !== lastRecommendationDocCount || 
                          currentHash !== lastRecommendationDocHash;
    
    if (needRegenerate || !cachedRecommendations || cachedRecommendations.length === 0) {
      console.log('文档内容变化或缓存为空，需要重新生成推荐');
      return res.json({
        success: true,
        recommendations: null,
        needRegenerate: true,
        message: '文档内容变化或缓存为空，需要重新生成推荐'
      });
    }
    
    res.json({
      success: true,
      recommendations: cachedRecommendations,
      needRegenerate: false,
      message: '使用缓存的推荐'
    });
  } catch (error) {
    console.error('获取AI搜索推荐失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 使用错误处理中间件
app.use(notFound);
app.use(errorHandler);

// 启动服务器
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
  console.log(`Server is running on http://localhost:${PORT}`);
  
  // Initialize KG module (includes schema startup check)
  try {
    await kg.initialize();
  } catch (error) {
    console.error('KG module initialization failed:', error);
    console.error('Server will continue, but KG functionality may be limited');
  }
  console.log('Available APIs:');
  console.log('- GET /api/health - 健康检查');
  console.log('- POST /api/auth/register - 用户注册');
  console.log('- POST /api/auth/login - 用户登录');
  console.log('- POST /api/auth/refresh - 刷新令牌');
  console.log('- POST /api/auth/logout - 用户登出');
  console.log('- GET /api/auth/me - 获取当前用户信息');
  console.log('- GET /api/user/stats/overview - 获取用户统计概览');
  console.log('- GET /api/user/stats/token-usage - 获取token使用记录');
  console.log('- GET /api/user/models - 获取用户模型列表');
  console.log('- POST /api/user/models - 创建用户模型');
  console.log('- PUT /api/user/models/:id - 更新用户模型');
  console.log('- DELETE /api/user/models/:id - 删除用户模型');
  console.log('- GET /api/user/agents - 获取智能体列表');
  console.log('- POST /api/user/agents - 创建智能体');
  console.log('- PUT /api/user/agents/:id - 更新智能体');
  console.log('- DELETE /api/user/agents/:id - 删除智能体');
  console.log('- GET /api/user/agents/public - 获取公开智能体');
  console.log('- GET /api/admin/users - 获取用户列表（管理员）');
  console.log('- GET /api/admin/users/:id - 获取用户详情（管理员）');
  console.log('- PUT /api/admin/users/:id/status - 更新用户状态（管理员）');
  console.log('- PUT /api/admin/users/:id/role - 更新用户角色（管理员）');
  console.log('- GET /api/admin/stats/overview - 获取系统统计（管理员）');
  console.log('- GET /api/admin/stats/users - 获取用户增长统计（管理员）');
  console.log('- GET /api/admin/stats/tokens - 获取token使用统计（管理员）');
  console.log('- GET /api/documents - 获取文档列表');
  console.log('- GET /api/documents/:id - 获取单个文档');
  console.log('- POST /api/documents - 创建文档');
  console.log('- PUT /api/documents/:id - 更新文档');
  console.log('- DELETE /api/documents/:id - 删除文档');
  console.log('- GET /api/tags - 获取标签列表');
  console.log('- POST /api/tags - 创建标签');
  console.log('- POST /api/upload - 上传文件');
  console.log('- POST /api/ai/search - 语义搜索');
  console.log('- POST /api/ai/generate-tags - 智能标签生成');
  console.log('- POST /api/ai/extract-entities - 实体识别');
  console.log('- GET /api/knowledge-graph - 获取知识图谱数据（带缓存）');
  console.log('- POST /api/knowledge-graph - 生成知识图谱（云端大模型）');
  console.log('- POST /api/ai/classify - AI自动分类');
  console.log('- GET /api/categories - 获取分类列表');
  console.log('- GET /api/categories/:id/documents - 获取分类文档');
  console.log('- POST /api/ai/recommendations - 生成AI搜索推荐');
  console.log('- GET /api/ai/recommendations - 获取AI搜索推荐');
  
  console.log('\n=== 网络访问信息 ===');
  console.log(`本地访问: http://localhost:${PORT}`);
  console.log(`局域网访问: http://0.0.0.0:${PORT}`);
  console.log(`请确保防火墙允许端口 ${PORT} 的访问`);
});

// 导出app对象，用于测试
module.exports = app;