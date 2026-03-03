const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
// const https = require('https');
const os = require('os');
const multer = require('multer');
const cors = require('cors');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const JSZip = require('jszip');
const pdf = require('pdf-parse');
const { processPdfWithOcr } = require('./services/pdfOcrService');
require('dotenv').config();

// KG Pipeline Service (redesigned)
const kgPipelineService = require('./services/kgPipelineService');
const kg = null;

// Fragment Collector (knowledge growth)
const fragmentCollector = require('./services/fragmentCollector');

// Unification Scheduler (dual-layer graph)
const unificationScheduler = require('./services/unificationScheduler');
const unificationService = require('./services/unificationService');
const onDocumentCreated = async (document) => {
  const autoBuild = process.env.AUTO_BUILD_KG !== 'false';
  if (!autoBuild) {
    console.log('[KG Hook] AUTO_BUILD_KG is disabled, skipping KG build for doc:', document.id);
    return { skipped: true };
  }
  console.log('[KG Hook] Triggering KG pipeline for doc:', document.id);
  try {
    const result = await kgPipelineService.runPipeline(String(document.id));
    console.log('[KG Hook] Pipeline completed for doc:', document.id, result);
    
    // 自动触发统一归纳，让用户立即看到统一图谱
    try {
      console.log('[KG Hook] Auto-triggering unification after pipeline...');
      const unifyResult = await unificationService.runUnification('auto');
      console.log('[KG Hook] Unification completed:', unifyResult);
    } catch (unifyErr) {
      console.error('[KG Hook] Unification failed (non-fatal):', unifyErr.message);
    }
    
    return result;
  } catch (err) {
    console.error('[KG Hook] Pipeline failed for doc:', document.id, err.message);
    throw err;
  }
};
const onDocumentUpdated = null;
const onDocumentDeleted = null;

// Import TempFileManager for automatic cleanup
const tempFileManager = require('./services/tempFileManager');

// Import FileHashService for file deduplication
const fileHashService = require('./services/fileHashService');

// Import DocumentStorageService and DeduplicationService
const DocumentStorageService = require('./services/documentStorageService');
const DeduplicationService = require('./services/deduplicationService');

// Import EmbeddingService (extracted from server.js)
const embeddingService = require('./services/embeddingService');

// 导入监控系统
const { logger, accessLogMiddleware, errorHandlerMiddleware, getLogStatus, cleanOldLogs } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

const isElectron = process.env.NODE_ENV === 'production' && process.type !== undefined;

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// APK 下载服务
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// 提供client目录下的静态文件服务（用于React应用）
// 注意：这个要放在 /assets 路由之前，确保 /assets 能正确映射到 client/dist/assets
app.use(express.static(path.join(__dirname, 'client/dist')));

// API路由
const { initAuthService, authMiddleware } = require('./services/authService');
const { initStatsService } = require('./services/statsService');
const authRoutes = require('./routes/authRoutes');
const userCenterRoutes = require('./routes/userCenterRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { router: communityRouter, initCommunityRoutes } = require('./routes/communityRoutes');
const { initDatabase } = require('./database/initUserDB');
const { PrismaClient } = require('@prisma/client');
const kgPrisma = new PrismaClient();

initAuthService();
initStatsService();
const userDb = initDatabase();
const authRouter = authRoutes.initAuthRoutes();
const userCenterRouter = userCenterRoutes.initUserCenterRoutes();
const adminRouter = adminRoutes.initAdminRoutes();
app.use('/api', chatRoutes);
initCommunityRoutes(userDb, kgPrisma);

// Initialize storage and deduplication services
const documentStorageService = new DocumentStorageService(userDb);
const deduplicationService = new DeduplicationService(documentStorageService);

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
  'qwen-turbo': {
    provider: 'aliyun',
    apiKey: process.env.QWEN_API_KEY || '',
    endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    model: 'qwen-turbo'
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
  },
  'text-embedding-v3': {
    provider: 'aliyun',
    apiKey: process.env.QWEN_API_KEY || '',
    endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding',
    model: 'text-embedding-v3'
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

// 生成文本嵌入向量 (delegated to EmbeddingService)
async function generateEmbedding(text) {
  return embeddingService.generateEmbedding(text);
}

// 计算余弦相似度 (delegated to EmbeddingService)
function cosineSimilarity(vecA, vecB) {
  return embeddingService.cosineSimilarity(vecA, vecB);
}

// 自动为没有嵌入的文档生成嵌入
async function backfillEmbeddings() {
  console.log('开始检查并回填文档嵌入...');
  userDb.all('SELECT id, title, content FROM documents WHERE embedding IS NULL', [], async (err, rows) => {
    if (err) {
      console.error('Error fetching documents for backfill:', err);
      return;
    }
    
    if (rows.length === 0) {
      console.log('所有文档已有嵌入');
      return;
    }
    
    console.log(`发现 ${rows.length} 个文档需要生成嵌入`);
    
    for (const doc of rows) {
      try {
        const textToEmbed = `${doc.title}\n${doc.content.substring(0, 1000)}`;
        const embedding = await generateEmbedding(textToEmbed);
        
        if (embedding) {
          const embeddingJson = JSON.stringify(embedding);
          userDb.run('UPDATE documents SET embedding = ? WHERE id = ?', [embeddingJson, doc.id], (err) => {
            if (err) console.error(`Failed to update embedding for doc ${doc.id}:`, err);
            else console.log(`已为文档 ${doc.id} (${doc.title}) 生成并保存嵌入`);
          });
        }
        
        // 避免速率限制
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error processing doc ${doc.id}:`, error);
      }
    }
  });
}

// 启动时尝试回填
if (process.env.NODE_ENV !== 'test') {
  setTimeout(backfillEmbeddings, 5000);
}

// 云端模型API调用函数
async function callCloudModel(modelKey, prompt, options = {}) {
  const modelConfig = CLOUD_MODELS[modelKey];
  
  if (!modelConfig) {
    throw new Error(`Unknown cloud model: ${modelKey}`);
  }
  
  if (!modelConfig.apiKey) {
    throw new Error(`API key not configured for ${modelKey}. Please set ${modelKey.toUpperCase()}_API_KEY environment variable.`);
  }
  
  console.log(`Calling cloud model: ${modelKey} (provider: ${modelConfig.provider})`);
  
  if (modelConfig.provider === 'aliyun') {
    return await callQwenModel(modelConfig, prompt, options);
  } else if (modelConfig.provider === 'deepseek') {
    return await callDeepSeekModel(modelConfig, prompt, options);
  } else {
    throw new Error(`Unsupported provider: ${modelConfig.provider}`);
  }
}

// 调用通义千问模型
async function callQwenModel(modelConfig, prompt, options = {}) {
  console.log('调用通义千问API，endpoint:', modelConfig.endpoint);
  
  // 构建消息列表
  let messages = [];
  
  // 添加系统提示词
  if (options.systemPrompt) {
    messages.push({
      role: 'system',
      content: options.systemPrompt
    });
  }
  
  // 添加历史消息
  if (options.history && Array.isArray(options.history)) {
    // 过滤掉无效消息，并确保格式正确
    const validHistory = options.history
      .filter(msg => msg.role && msg.content)
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));
    messages = messages.concat(validHistory);
  }
  
  // 添加当前用户消息
  messages.push({
    role: 'user',
    content: prompt
  });

  console.log('请求参数:', JSON.stringify({
    model: modelConfig.model,
    input: {
      messages: messages
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
        messages: messages
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
async function callDeepSeekModel(modelConfig, prompt, options = {}) {
  // 构建消息列表
  let messages = [];
  
  // 添加系统提示词
  if (options.systemPrompt) {
    messages.push({
      role: 'system',
      content: options.systemPrompt
    });
  }
  
  // 添加历史消息
  if (options.history && Array.isArray(options.history)) {
    const validHistory = options.history
      .filter(msg => msg.role && msg.content)
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));
    messages = messages.concat(validHistory);
  }
  
  // 添加当前用户消息
  messages.push({
    role: 'user',
    content: prompt
  });

  const response = await fetch(modelConfig.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${modelConfig.apiKey}`
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages: messages,
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
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 添加访问日志中间件
app.use(accessLogMiddleware);

// 文件上传配置
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: function (req, file, cb) {
    // 使用时间戳 + 随机数 + 原始扩展名，避免中文文件名编码问题
    const ext = path.extname(file.originalname) || '';
    const safeName = Date.now() + '-' + Math.random().toString(36).substring(2, 8) + ext;
    cb(null, safeName);
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

// API路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// 添加缓存控制中间件 - 禁用所有 API 响应的缓存
app.use('/api', (req, res, next) => {
  // 禁用缓存
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// 认证路由
app.use('/api/auth', authRouter);

// 用户中心路由
app.use('/api/user', userCenterRouter);

// 管理员路由
app.use('/api/admin', adminRouter);

// 知识图谱路由（重新设计后的LLM驱动Pipeline）
const kgRoutes = require('./routes/kgRoutes');
app.use('/api/kg', kgRoutes);

// 便签路由
const notesRoutes = require('./routes/notesRoutes');
app.use('/api/notes', notesRoutes);

// 社区路由
app.use('/api/community', communityRouter);

// 附件路由
const attachmentRoutes = require('./routes/attachmentRoutes');
app.use('/api/attachments', attachmentRoutes);

// 图像分析路由
const imageAnalysisRoutes = require('./routes/imageAnalysisRoutes');
app.use('/api/image-analysis', imageAnalysisRoutes);

// 图片上传/代理/识别路由（MinIO + AI 识别）
const imageRoutes = require('./routes/imageRoutes');
app.use('/api/images', imageRoutes);

// 存储统计 API
app.get('/api/storage/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    // 统计文档数量和内容大小
    const docStats = await new Promise((resolve, reject) => {
      userDb.get(
        `SELECT COUNT(*) as count, COALESCE(SUM(LENGTH(content)), 0) as totalBytes FROM documents WHERE user_id = ?`,
        [userId],
        (err, row) => err ? reject(err) : resolve(row || { count: 0, totalBytes: 0 })
      );
    });

    // 尝试获取 MinIO 存储大小
    let minioBytes = 0;
    try {
      const minioService = require('./services/minioService');
      const objects = await minioService.listObjects();
      if (Array.isArray(objects)) {
        minioBytes = objects.reduce((sum, obj) => sum + (obj.size || 0), 0);
      }
    } catch { /* MinIO 不可用时忽略 */ }

    const usedBytes = (docStats.totalBytes || 0) + minioBytes;
    const totalBytes = 10 * 1024 * 1024 * 1024; // 10 GB 上限

    res.json({
      documentCount: docStats.count || 0,
      usedBytes,
      totalBytes,
      usedFormatted: formatBytes(usedBytes),
      totalFormatted: formatBytes(totalBytes),
      percentage: Math.min(100, Math.round((usedBytes / totalBytes) * 100)),
    });
  } catch (error) {
    console.error('获取存储统计失败:', error);
    res.json({ documentCount: 0, usedBytes: 0, totalBytes: 10737418240, usedFormatted: '0 B', totalFormatted: '10 GB', percentage: 0 });
  }
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// AI增强路由
const aiEnhancementRoutes = require('./routes/aiEnhancementRoutes');
app.use('/api/ai', aiEnhancementRoutes);

// AI洞察路由
const aiInsightsRoutes = require('./routes/aiInsightsRoutes');
app.use('/api/ai', aiInsightsRoutes);

// 搜索路由
const searchRoutes = require('./routes/searchRoutes');
app.use('/api/search', searchRoutes);

// 知识生长路由
const knowledgeGrowthRoutes = require('./routes/knowledgeGrowthRoutes');
app.use('/api/knowledge-growth', knowledgeGrowthRoutes);

// LLM预处理路由（文档索引查询）

app.get('/api/preprocessing/index/:docId', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    const { version } = req.query;

    if (!docId) {
      return res.status(400).json({ success: false, error: 'Document ID is required' });
    }

    const where = { docId };
    const orderBy = { version: 'desc' };

    let documentIndex;
    if (version) {
      where.version = parseInt(version);
      documentIndex = await kgPrisma.documentIndex.findFirst({ where });
    } else {
      documentIndex = await kgPrisma.documentIndex.findFirst({ where, orderBy });
    }

    if (!documentIndex) {
      return res.status(404).json({
        success: false,
        error: `No document index found for document ${docId}`
      });
    }

    let metadata = {};
    try {
      metadata = documentIndex.metadata ? JSON.parse(documentIndex.metadata) : {};
    } catch { metadata = {}; }

    res.json({
      success: true,
      data: {
        id: documentIndex.id,
        docId: documentIndex.docId,
        indexedText: documentIndex.indexedText,
        version: documentIndex.version,
        metadata,
        createdAt: documentIndex.createdAt,
        updatedAt: documentIndex.updatedAt
      }
    });
  } catch (error) {
    console.error('[Preprocessing] Error getting document index:', error);
    res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
  }
});

const mockTags = [
  { id: '1', name: '前端', color: '#1890ff', description: '前端开发相关内容' },
  { id: '2', name: '后端', color: '#52c41a', description: '后端开发相关内容' },
  { id: '3', name: 'AI', color: '#faad14', description: '人工智能相关内容' },
  { id: '4', name: '数据库', color: '#f5222d', description: '数据库相关内容' },
  { id: '5', name: '笔记', color: '#722ed1', description: '个人笔记' }
];

// === 文档 API 辅助函数 ===

/**
 * 安全解析 JSON 字符串字段，失败时返回默认值
 */
function parseJsonField(value, defaultValue) {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

/**
 * 从 DocumentContentJSON（Tiptap JSON）中提取所有 imageBlock 的 analysisId
 * 递归遍历 content 数组查找 type === 'imageBlock' 的节点
 */
function extractAnalysisIds(contentStr) {
  const ids = [];
  try {
    const doc = typeof contentStr === 'string' ? JSON.parse(contentStr) : contentStr;
    if (!doc || !Array.isArray(doc.content)) return ids;
    
    function walk(nodes) {
      for (const node of nodes) {
        if (node.type === 'imageBlock' && node.attrs && node.attrs.analysisId) {
          ids.push(node.attrs.analysisId);
        }
        if (Array.isArray(node.content)) {
          walk(node.content);
        }
      }
    }
    walk(doc.content);
  } catch {
    // content 不是有效 JSON，忽略
  }
  return ids;
}

/**
 * 将 ImageAnalysis 记录关联到指定文档（设置 documentId）
 * 根据文档内容中的 analysisId 列表批量更新
 */
async function linkImageAnalysesToDocument(documentId, contentStr) {
  const analysisIds = extractAnalysisIds(contentStr);
  if (analysisIds.length === 0) return;
  
  try {
    await kgPrisma.imageAnalysis.updateMany({
      where: { id: { in: analysisIds } },
      data: { documentId: documentId.toString() }
    });
  } catch (err) {
    console.error('Error linking imageAnalyses to document:', err);
  }
}

/**
 * 文档保存后，对所有 pending 状态的图片触发 AI 识别
 */
async function triggerPendingImageRecognition(contentStr, userId) {
  const analysisIds = extractAnalysisIds(contentStr);
  if (analysisIds.length === 0) return;

  try {
    const pendingRecords = await kgPrisma.imageAnalysis.findMany({
      where: { id: { in: analysisIds }, status: 'pending' },
    });

    if (pendingRecords.length === 0) return;

    const { getImageRecognitionService } = require('./services/imageRecognitionService');
    const recognitionService = getImageRecognitionService();

    for (const record of pendingRecords) {
      recognitionService.analyzeImage(record.imageKey, undefined, { userId }).catch((err) => {
        console.error(`[ImageRecognition] 识别失败 [${record.imageKey}]:`, err.message);
      });
    }

    console.log(`[ImageRecognition] 已触发 ${pendingRecords.length} 张图片的 AI 识别`);
  } catch (err) {
    console.error('Error triggering image recognition:', err);
  }
}

// 文档相关路由
app.get('/api/documents', authMiddleware, (req, res) => {
  // 禁用缓存，确保始终获取最新数据
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  
  try {
    const userId = req.userId;
    // 按照最近访问时间排序 (last_viewed_at -> updated_at -> created_at)
    userDb.all('SELECT * FROM documents WHERE user_id = ? ORDER BY COALESCE(last_viewed_at, updated_at, created_at) DESC', [userId], (err, rows) => {
      if (err) {
        console.error('Error fetching documents:', err);
        return res.status(500).json({ error: 'Failed to fetch documents' });
      }
      
      if (!rows || rows.length === 0) {
        return res.json([]);
      }
      
      const documents = [];
      let processedCount = 0;
      
      rows.forEach(row => {
        const document = {
          id: row.id.toString(),
          title: row.title,
          content: row.content,
          type: row.type,
          fileType: row.file_type,
          metadata: row.metadata ? JSON.parse(row.metadata) : {},
          tags: row.tags ? JSON.parse(row.tags) : [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastViewedAt: row.last_viewed_at,
          summaries: []
        };
        
        // 获取文档的总结
        userDb.all('SELECT model, content, created_at FROM summaries WHERE user_id = ? AND document_id = ?', [userId, row.id], (err, summaryRows) => {
          if (err) {
            console.error('Error fetching summaries:', err);
          } else if (summaryRows && summaryRows.length > 0) {
            document.summaries = summaryRows.map(summaryRow => ({
              id: `${document.id}_${summaryRow.model}`,
              model: summaryRow.model,
              content: summaryRow.content,
              createdAt: summaryRow.created_at
            }));
          }
          
          // 添加文档到列表（无论是否获取到总结）
          documents.push(document);
          
          processedCount++;
          if (processedCount === rows.length) {
            // 确保返回顺序正确，因为异步回调可能会打乱顺序
            documents.sort((a, b) => {
              const timeA = new Date(a.lastViewedAt || a.updatedAt || a.createdAt).getTime();
              const timeB = new Date(b.lastViewedAt || b.updatedAt || b.createdAt).getTime();
              return timeB - timeA;
            });
            res.json(documents);
          }
        });
      });
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
    
    // 更新最后访问时间
    userDb.run('UPDATE documents SET last_viewed_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [id, userId], (err) => {
      if (err) console.error('Failed to update last_viewed_at:', err);
    });
    
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
        updatedAt: row.updated_at,
        summaries: [],
        imageAnalyses: []
      };
      
      // 获取文档的总结
      userDb.all('SELECT model, content, created_at FROM summaries WHERE user_id = ? AND document_id = ?', [userId, id], (err, summaryRows) => {
        if (err) {
          console.error('Error fetching summaries:', err);
        } else if (summaryRows && summaryRows.length > 0) {
          document.summaries = summaryRows.map(summaryRow => ({
            id: `${document.id}_${summaryRow.model}`,
            model: summaryRow.model,
            content: summaryRow.content,
            createdAt: summaryRow.created_at
          }));
        }
        
        // 获取关联的图片识别结果
        kgPrisma.imageAnalysis.findMany({
          where: { documentId: id.toString() }
        }).then(analyses => {
          document.imageAnalyses = analyses.map(a => ({
            id: a.id,
            imageKey: a.imageKey,
            imageUrl: a.imageUrl,
            description: a.description,
            elements: parseJsonField(a.elements, []),
            theme: a.theme,
            status: a.status,
            error: a.error,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt
          }));
          res.json(document);
          
          // 异步采集 doc_view 碎片，不阻塞主请求
          setImmediate(() => {
            fragmentCollector.collect({
              userId,
              fragmentType: 'doc_view',
              content: document.title || '',
              sourceId: document.id,
              sourceMeta: { title: document.title, type: document.type }
            }).catch(err => console.error('[FragmentCollector] doc_view collection error:', err));
          });
        }).catch(prismaErr => {
          console.error('Error fetching imageAnalyses:', prismaErr);
          // 即使获取图片分析失败，也返回文档
          res.json(document);
          
          // 异步采集 doc_view 碎片，不阻塞主请求
          setImmediate(() => {
            fragmentCollector.collect({
              userId,
              fragmentType: 'doc_view',
              content: document.title || '',
              sourceId: document.id,
              sourceMeta: { title: document.title, type: document.type }
            }).catch(err => console.error('[FragmentCollector] doc_view collection error:', err));
          });
        });
      });
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
        
        // 关联图片分析记录到新文档（异步）
        linkImageAnalysesToDocument(newDocument.id, content);
        
        // 触发 pending 图片的 AI 识别（异步，保存时才识别）
        triggerPendingImageRecognition(content, userId);
        
        // 触发知识图谱构建钩子 (异步)
        if (onDocumentCreated) onDocumentCreated(newDocument, { async: true, skipIfExists: false })
          .then(result => {
            console.log('[KG Hook] 文档创建钩子结果:', result);
          })
          .catch(error => {
            console.error('[KG Hook] 文档创建钩子失败:', error);
          });
        
        res.json(newDocument);
        
        // 异步采集 doc_create 碎片，不阻塞主请求
        setImmediate(() => {
          const contentSummary = (content || '').substring(0, 200);
          fragmentCollector.collect({
            userId,
            fragmentType: 'doc_create',
            content: `${title || ''} ${contentSummary}`.trim(),
            sourceId: newDocument.id,
            sourceMeta: { title, type: type || 'document' }
          }).catch(err => console.error('[FragmentCollector] doc_create collection error:', err));
        });
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
        
        // 更新图片分析记录关联（异步）
        linkImageAnalysesToDocument(id, content);
        
        // 触发 pending 图片的 AI 识别（异步，保存时才识别）
        triggerPendingImageRecognition(content, userId);
        
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
          if (onDocumentUpdated) onDocumentUpdated(document, { async: true, fullRebuild: false })
            .then(result => {
              console.log('[KG Hook] 文档更新钩子结果:', result);
            })
            .catch(error => {
              console.error('[KG Hook] 文档更新钩子失败:', error);
            });
          
          res.json(document);
          
          // 异步采集 doc_edit 碎片，不阻塞主请求
          setImmediate(() => {
            const contentSummary = (document.content || '').substring(0, 200);
            fragmentCollector.collect({
              userId,
              fragmentType: 'doc_edit',
              content: `${document.title || ''} ${contentSummary}`.trim(),
              sourceId: document.id,
              sourceMeta: { title: document.title, type: document.type }
            }).catch(err => console.error('[FragmentCollector] doc_edit collection error:', err));
          });
        });
      }
    );
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

app.post('/api/documents/batch-delete', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids 数组不能为空' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const params = [...ids, userId];

    userDb.run(
      `DELETE FROM documents WHERE id IN (${placeholders}) AND user_id = ?`,
      params,
      function(err) {
        if (err) {
          console.error('Error batch deleting documents:', err);
          return res.status(500).json({ error: 'Failed to batch delete documents' });
        }

        // 对每个 ID 触发 KG 清理钩子
        ids.forEach(id => {
          if (onDocumentDeleted) {
            onDocumentDeleted(id, { async: true }).catch(e =>
              console.error('[KG Hook] 批量删除钩子失败:', e)
            );
          }
        });

        res.json({
          deletedCount: this.changes,
          failed: []
        });
      }
    );
  } catch (error) {
    console.error('Error batch deleting documents:', error);
    res.status(500).json({ error: 'Failed to batch delete documents' });
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
      if (onDocumentDeleted) onDocumentDeleted(id, { async: true })
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

// 异步 PDF 处理逻辑
const processPdfAsync = async (filePath, docId, userId) => {
  try {
    console.log(`[AsyncPDF] Starting background processing for docId: ${docId}`);
    let finalContent = '';
    const dataBuffer = fs.readFileSync(filePath);
    let data;
    
    // 1. 尝试标准解析
    try {
      data = await pdf(dataBuffer);
    } catch (pdfError) {
      console.warn('[AsyncPDF] Standard parsing failed:', pdfError.message);
      data = { text: '' };
    }
    
    let extractedText = data.text || '';
    
    // 2. 如果文本过短，调用 OCR
    if (!extractedText || extractedText.length < 100) {
      console.log('[AsyncPDF] Text too short, invoking Aliyun OCR...');
      try {
        const ocrText = await processPdfWithOcr(filePath);
        if (ocrText && ocrText.length > 50) {
          extractedText = ocrText;
        }
      } catch (ocrError) {
        console.error('[AsyncPDF] OCR failed:', ocrError);
      }
    }
    
    // 3. 确定最终内容
    if (extractedText && extractedText.length > 0) {
      // 简单分段逻辑
      const paragraphs = extractedText.split(/\n+/).map(line => line.trim()).filter(line => line.length > 0);
      
      // 辅助函数：将纯文本段落数组转换为 Tiptap JSON 格式
      const textToTiptapJson = (paragraphs) => {
        const doc = {
          type: 'doc',
          content: paragraphs.map(text => ({
            type: 'paragraph',
            content: text ? [{ type: 'text', text }] : []
          }))
        };
        if (doc.content.length === 0) doc.content.push({ type: 'paragraph', content: [] });
        return JSON.stringify(doc);
      };
      
      finalContent = textToTiptapJson(paragraphs);
    } else {
      const textToTiptapJson = (paragraphs) => {
        const doc = { type: 'doc', content: paragraphs.map(text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })) };
        return JSON.stringify(doc);
      };
      finalContent = textToTiptapJson(['(此文档为图片或扫描件，OCR识别失败，请查看预览)']);
    }
    
    // 4. 精确更新数据库
    const updateSql = `UPDATE documents SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`;
    userDb.run(updateSql, [finalContent, docId, userId], (err) => {
      if (err) {
        console.error('[AsyncPDF] DB Update failed:', err);
      } else {
        console.log(`[AsyncPDF] Document ${docId} content updated successfully`);
        
        // 5. 触发知识图谱构建 (延迟触发，确保内容已更新)
        // 构造一个完整的 document 对象用于 KG 构建
        // 注意：我们需要重新获取文档元数据，或者使用传入的 filePath 等信息重构
        // 为简化，这里我们假设 onDocumentCreated 可以处理基本的 document 结构
        // 但更好的做法是重新查询文档，这里为了性能我们只构造必要的字段
        
        // 由于 onDocumentCreated 需要 document 对象，我们构造一个包含最新内容的临时对象
        // 注意：这里没有 metadata，可能会影响某些处理，但在知识图谱生成中主要用 content
        const tempDoc = {
          id: docId,
          content: finalContent,
          type: 'document',
          userId: userId
        };
        
        console.log('[AsyncPDF] 内容更新完成，触发延迟的知识图谱构建...');
        const autoBuildKG = process.env.AUTO_BUILD_KG === 'true' || true; // 默认开启
        
        if (autoBuildKG && onDocumentCreated) {
          onDocumentCreated(tempDoc, { async: true, skipIfExists: false })
            .then(result => console.log('[KG Hook] 异步PDF处理后知识图谱构建结果:', result))
            .catch(error => console.error('[KG Hook] 异步PDF处理后知识图谱构建失败:', error));
        }
      }
    });
    
  } catch (bgError) {
    console.error('[AsyncPDF] Background processing error:', bgError);
    // 尝试更新错误状态，但也需要 textToTiptapJson
    // 简单起见这里不再重复定义，只 log
  }
};

// 文件上传处理函数
const handleFileUpload = async (req, res) => {
  try {
    // 检查数据库连接是否已初始化
    if (!userDb) {
      console.error('Database connection not initialized');
      return res.status(500).json({ 
        error: 'Database connection not available',
        message: '数据库连接未初始化，请稍后重试'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { filename, path: filePath, originalname, size, mimetype } = req.file;
    const userId = req.userId; // 从认证中间件获取用户ID
    
    // 验证用户ID
    if (!userId) {
      console.error('User ID not found in request');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: '用户未认证'
      });
    }
    
    // 根据文件类型进行解析
    let content = '';
    let fileType = path.extname(originalname).toLowerCase();
    
    // 辅助函数：将纯文本段落数组转换为 Tiptap JSON 格式
    const textToTiptapJson = (paragraphs) => {
      const doc = {
        type: 'doc',
        content: paragraphs.map(text => ({
          type: 'paragraph',
          content: text ? [{ type: 'text', text }] : []
        }))
      };
      // 确保至少有一个段落
      if (doc.content.length === 0) {
        doc.content.push({ type: 'paragraph', content: [] });
      }
      return JSON.stringify(doc);
    };

    // 简单的文本文件解析示例
    if (fileType === '.txt') {
      const rawText = fs.readFileSync(filePath, 'utf8');
      const paragraphs = rawText.split(/\n/).map(line => line.trim());
      content = textToTiptapJson(paragraphs);
    } else if (fileType === '.md') {
      // Markdown 保持原文，ReactMarkdown 渲染效果较好
      content = fs.readFileSync(filePath, 'utf8');
    } else if (fileType === '.docx') {
      // 处理docx文件，解析后转为 Tiptap JSON 格式
      try {
        const data = fs.readFileSync(filePath);
        const zip = await JSZip.loadAsync(data);
        const docXml = await zip.file('word/document.xml').async('string');
        // 按段落(<w:p>)提取，保持段落内文字连贯
        const paragraphMatches = docXml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g);
        let paragraphs = [];
        if (paragraphMatches) {
          paragraphs = paragraphMatches.map(p => {
            const textMatches = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
            if (textMatches) {
              return textMatches.map(match => match.replace(/<[^>]*>/g, '')).join('');
            }
            return '';
          });
        } else {
          // 回退到提取所有文本
          const textMatches = docXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
          if (textMatches) {
            paragraphs = textMatches.map(match => match.replace(/<[^>]*>/g, ''));
          }
        }
        content = textToTiptapJson(paragraphs);
      } catch (error) {
        console.error('Error parsing docx file:', error);
        content = textToTiptapJson(['无法解析docx文件内容']);
      }
    } else if (fileType === '.pdf') {
      // 异步 PDF 处理逻辑：
      // 1. 设置初始状态为 [PROCESSING]
      // 2. 立即返回成功响应
      // 3. 后台启动 OCR 任务 (在 DB 插入成功后触发)
      content = textToTiptapJson(['[PROCESSING] 文档正在解析中，请稍候...']);
      // processPdfAsync 将在 userDb.run 的回调中调用
      
    } else if (fileType === '.doc') {
      // 对于旧版doc文件，提供提示信息
      content = textToTiptapJson(['旧版.doc文件暂不支持直接预览，建议转换为.docx格式']);
    }
    
    // 修复中文文件名乱码问题
    let title = originalname.replace(fileType, '');
    // 确保标题正确处理中文
    try {
      title = Buffer.from(title, 'latin1').toString('utf8');
    } catch (e) {
      // 如果转换失败，使用原始标题
      title = originalname.replace(fileType, '');
    }
    
    // 计算文件 hash 值用于去重
    let fileHash = null;
    try {
      console.log('[Upload] 开始计算文件 hash:', filePath);
      fileHash = await fileHashService.calculateHash(filePath);
      if (fileHash) {
        console.log('[Upload] 文件 hash 计算成功:', fileHash);
      } else {
        console.warn('[Upload] 文件 hash 计算失败，将继续上传但不进行去重检查');
      }
    } catch (error) {
      // 优雅降级：hash 计算失败不应阻止文件上传
      console.error('[Upload] 文件 hash 计算异常:', error.message);
      console.warn('[Upload] 将继续上传但不进行去重检查');
    }
    
    // 检查文件是否重复
    let duplicateCheck = null;
    if (fileHash) {
      try {
        console.log('[Upload] 开始检查文件重复:', { hash: fileHash, filename: title, userId });
        duplicateCheck = await deduplicationService.checkDuplicate(fileHash, title, userId);
        console.log('[Upload] 重复检查结果:', duplicateCheck);
      } catch (error) {
        console.error('[Upload] 重复检查异常:', error.message);
        // 优雅降级：重复检查失败不应阻止文件上传
      }
    }
    
    // 如果检测到重复，返回重复信息而不是立即保存
    if (duplicateCheck && duplicateCheck.isDuplicate) {
      console.log('[Upload] 检测到重复文件，类型:', duplicateCheck.duplicateType);
      
      // 生成临时文件 ID 并存储临时文件信息
      const tempFileId = tempFileManager.storeTempFile({
        originalName: originalname,
        path: filePath,
        size: size,
        hash: fileHash,
        userId: userId
      });
      
      console.log('[Upload] 临时文件已存储，ID:', tempFileId);
      
      // 返回重复信息，让前端显示模态框
      return res.status(200).json({
        success: false,
        duplicate: true,
        duplicateType: duplicateCheck.duplicateType,
        existingFile: duplicateCheck.existingFile,
        tempFileId: tempFileId,
        newFile: {
          name: originalname,
          size: size,
          title: title,
          fileType: fileType,
          content: content
        }
      });
    }
    
    const metadata = JSON.stringify({
      filename,
      originalname: originalname,
      size,
      mimetype,
      filePath
    });
    
    // 保存到SQLite数据库，包含 hash 和 size 字段
    userDb.run(
      'INSERT INTO documents (user_id, title, content, type, file_type, metadata, hash, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, title, content, 'document', fileType, metadata, fileHash, size],
      function(err) {
        if (err) {
          console.error('Error saving document to database:', err);
          return res.status(500).json({ 
            error: 'Failed to save document',
            message: '保存文档到数据库失败',
            details: err.message
          });
        }
        
        const documentId = this.lastID.toString();
        
        // 如果是 PDF 且处于处理中状态，触发后台解析，并跳过知识图谱构建
        if (fileType === '.pdf' && content.includes('[PROCESSING]')) {
          console.log('[Upload] PDF异步处理模式：跳过初始知识图谱构建，等待内容解析完成...');
          processPdfAsync(filePath, documentId, userId).catch(err => 
            console.error('[AsyncPDF] Trigger failed:', err)
          );
        } else {
          // 非 PDF 或非异步处理，立即触发知识图谱构建
          console.log('[Upload] 同步处理模式：开始触发知识图谱构建...');
          
          const autoBuildKG = process.env.AUTO_BUILD_KG === 'true' || true; // 默认开启
          
          if (autoBuildKG && typeof onDocumentCreated === 'function') {
             // 构建文档对象传递给 onDocumentCreated
             const docForKG = {
                id: documentId,
                title: title,
                content: content,
                type: 'document',
                fileType: fileType,
                metadata: JSON.parse(metadata),
                hash: fileHash,
                size: size,
                userId: userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
             };
             
             onDocumentCreated(docForKG, { async: true, skipIfExists: false })
              .then(result => {
                console.log('[KG Hook] 文档上传后知识图谱构建结果:', result);
              })
              .catch(error => {
                console.error('[KG Hook] 文档上传后知识图谱构建失败:', error);
              });
          }
        }
        
        const document = {
          id: documentId,
          title: title,
          content,
          type: 'document',
          fileType: fileType,
          metadata: JSON.parse(metadata),
          hash: fileHash,
          size: size,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        console.log('[Upload] 文档上传成功，ID:', documentId);
        
        // 移除重复的知识图谱触发逻辑 (因为已经在上面处理了)
        /*
        // 触发知识图谱构建钩子 (异步)
        if (onDocumentCreated) onDocumentCreated(document, { async: true, skipIfExists: false })
          .then(result => {
            console.log('[KG Hook] 文档上传后知识图谱构建结果:', result);
          })
          .catch(error => {
            console.error('[KG Hook] 文档上传后知识图谱构建失败:', error);
          });
        */
        
        // 返回成功响应，包含 success 标志和文档元数据
        res.status(201).json({
          success: true,
          document: document
        });
      }
    );
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ 
      error: 'Failed to upload file',
      message: '文件上传失败',
      details: error.message
    });
  }
};

// 图片上传API（轻量级，仅保存文件并返回URL）
app.post('/api/images/upload', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const { filename, originalname, mimetype } = req.file;
    if (!mimetype.startsWith('image/')) {
      // 删除非图片文件
      const filePath = path.join(__dirname, 'uploads', filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Only image files are allowed' });
    }
    res.json({ success: true, url: `/uploads/${filename}`, filename: originalname });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Image upload failed' });
  }
});

// 文件上传API - 支持两个路径（需要认证）
app.post('/api/upload', authMiddleware, upload.single('file'), handleFileUpload);
app.post('/api/documents/upload', authMiddleware, upload.single('file'), handleFileUpload);

// 处理重复文件解决方案的端点（需要认证）
app.post('/api/documents/upload/resolve-duplicate', authMiddleware, async (req, res) => {
  try {
    const { action, tempFileId, existingFileId } = req.body;
    const userId = req.userId; // 从认证中间件获取用户ID
    
    // 验证用户ID
    if (!userId) {
      console.error('[ResolveDuplicate] User ID not found in request');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: '用户未认证'
      });
    }
    
    // 验证必需参数
    if (!action || !tempFileId) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: '缺少必需参数：action 和 tempFileId'
      });
    }
    
    // 验证 action 值
    const validActions = ['replace', 'keep-both', 'cancel'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ 
        error: 'Invalid action',
        message: `无效的操作：${action}。有效值为：${validActions.join(', ')}`
      });
    }
    
    // 如果是 replace 动作，需要 existingFileId
    if (action === 'replace' && !existingFileId) {
      return res.status(400).json({ 
        error: 'Missing existingFileId',
        message: 'replace 操作需要提供 existingFileId'
      });
    }
    
    console.log('[ResolveDuplicate] 处理重复文件解决方案:', { action, tempFileId, existingFileId, userId });
    
    // 从内存中检索临时文件信息
    const tempFile = tempFileManager.getTempFile(tempFileId);
    
    if (!tempFile) {
      return res.status(404).json({ 
        error: 'Temporary file not found',
        message: '临时文件未找到或已过期'
      });
    }
    
    // 验证临时文件属于当前用户
    if (tempFile.userId !== userId) {
      console.error('[ResolveDuplicate] User ID mismatch:', { tempFileUserId: tempFile.userId, requestUserId: userId });
      return res.status(403).json({ 
        error: 'Forbidden',
        message: '无权访问此临时文件'
      });
    }
    
    // 准备文件元数据
    const fileType = path.extname(tempFile.originalName).toLowerCase();
    let title = tempFile.originalName.replace(fileType, '');
    
    // 处理中文文件名
    try {
      title = Buffer.from(title, 'latin1').toString('utf8');
    } catch (e) {
      title = tempFile.originalName.replace(fileType, '');
    }
    
    // 读取文件内容（如果是文本文件）
    let content = '';
    if (fileType === '.txt' || fileType === '.md') {
      try {
        content = fs.readFileSync(tempFile.path, 'utf8');
      } catch (error) {
        console.error('[ResolveDuplicate] Error reading file content:', error);
      }
    } else if (fileType === '.docx') {
      try {
        const data = fs.readFileSync(tempFile.path);
        const zip = await JSZip.loadAsync(data);
        const docXml = await zip.file('word/document.xml').async('string');
        // 改进的XML解析：按段落(<w:p>)提取，保持段落内文字连贯，仅在段落间换行
        const paragraphMatches = docXml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g);
        if (paragraphMatches) {
          content = paragraphMatches.map(p => {
            const textMatches = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
            if (textMatches) {
              return textMatches.map(match => match.replace(/<[^>]*>/g, '')).join('');
            }
            return '';
          }).filter(text => text.length > 0).join('\n');
        } else {
          const textMatches = docXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
          if (textMatches) {
            content = textMatches.map(match => match.replace(/<[^>]*>/g, '')).join('\n');
          }
        }
      } catch (error) {
        console.error('[ResolveDuplicate] Error parsing docx file:', error);
        content = '无法解析docx文件内容';
      }
    } else if (fileType === '.pdf') {
      try {
        const dataBuffer = fs.readFileSync(tempFile.path);
        
        let data;
        try {
          data = await pdf(dataBuffer);
        } catch (pdfError) {
          console.warn('[ResolveDuplicate] PDF standard parsing failed:', pdfError.message);
          data = { text: '' };
        }
        
        let extractedText = data.text || '';
        
        // OCR 兜底逻辑
        if (extractedText.length < 100) {
          console.log('[ResolveDuplicate] PDF text too short, attempting OCR...');
          try {
            const ocrText = await processPdfWithOcr(tempFile.path);
            if (ocrText && ocrText.length > 50) {
              extractedText = ocrText;
            }
          } catch (ocrError) {
            console.error('[ResolveDuplicate] OCR failed:', ocrError);
          }
        }
        
        content = extractedText || '(此文档为图片或扫描件，OCR识别失败，请查看预览)';
      } catch (error) {
        console.error('[ResolveDuplicate] Error parsing pdf file:', error);
        
        // 解析失败尝试 OCR
        try {
          const ocrText = await processPdfWithOcr(tempFile.path);
          if (ocrText && ocrText.length > 50) {
            content = ocrText;
          } else {
            content = '(PDF 解析失败，请查看预览。原因：OCR识别未返回有效文本)';
          }
        } catch (ocrError) {
          console.error('[ResolveDuplicate] OCR Fallback failed:', ocrError.message);
          content = `(PDF 解析失败，请查看预览。系统错误：${ocrError.message})`;
        }
      }
    }
    
    const metadata = {
      userId: userId,
      title: title,
      content: content,
      type: 'document',
      fileType: fileType,
      metadata: {
        filename: path.basename(tempFile.path),
        originalname: tempFile.originalName,
        size: tempFile.size,
        mimetype: 'application/octet-stream'
      },
      hash: tempFile.hash,
      size: tempFile.size
    };
    
    // 调用 DeduplicationService 处理用户选择
    const newFile = {
      tempFilePath: tempFile.path,
      metadata: metadata
    };
    
    console.log('[ResolveDuplicate] 调用 DeduplicationService.handleDuplicateAction');
    const result = await deduplicationService.handleDuplicateAction(action, newFile, existingFileId);
    
    // 清理临时文件信息（从内存中删除）
    await tempFileManager.deleteTempFile(tempFileId);
    console.log('[ResolveDuplicate] 临时文件信息已清理');
    
    // 如果用户选择取消，返回成功但无文档
    if (action === 'cancel') {
      return res.status(200).json({
        success: true,
        cancelled: true,
        message: '上传已取消'
      });
    }
    
    // 返回最终文档元数据
    console.log('[ResolveDuplicate] 操作成功，文档ID:', result.id);
    
    // 触发知识图谱构建钩子 (异步)
    if (result && result.id) {
      if (onDocumentCreated) onDocumentCreated(result, { async: true, skipIfExists: false })
        .then(kgResult => {
          console.log('[KG Hook] 重复文件解决后知识图谱构建结果:', kgResult);
        })
        .catch(error => {
          console.error('[KG Hook] 重复文件解决后知识图谱构建失败:', error);
        });
    }
    
    res.status(200).json({
      success: true,
      document: {
        id: result.id,
        title: result.title,
        content: result.content,
        type: result.type,
        fileType: result.fileType,
        metadata: result.metadata,
        hash: result.hash,
        size: result.size,
        uploadDate: result.updatedAt || result.createdAt
      }
    });
    
  } catch (error) {
    console.error('[ResolveDuplicate] Error resolving duplicate:', error);
    res.status(500).json({ 
      error: 'Failed to resolve duplicate',
      message: '处理重复文件失败',
      details: error.message
    });
  }
});

// 同时支持另一个路径（兼容性）
app.post('/api/upload/resolve-duplicate', authMiddleware, async (req, res) => {
  try {
    const { action, tempFileId, existingFileId } = req.body;
    const userId = req.userId;
    
    if (!userId) {
      console.error('[ResolveDuplicate] User ID not found in request');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: '用户未认证'
      });
    }
    
    if (!action || !tempFileId) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: '缺少必需参数：action 和 tempFileId'
      });
    }
    
    const validActions = ['replace', 'keep-both', 'cancel'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ 
        error: 'Invalid action',
        message: `无效的操作：${action}。有效值为：${validActions.join(', ')}`
      });
    }
    
    if (action === 'replace' && !existingFileId) {
      return res.status(400).json({ 
        error: 'Missing existingFileId',
        message: 'replace 操作需要提供 existingFileId'
      });
    }
    
    console.log('[ResolveDuplicate] 处理重复文件解决方案:', { action, tempFileId, existingFileId, userId });
    
    const tempFile = tempFileManager.getTempFile(tempFileId);
    
    if (!tempFile) {
      return res.status(404).json({ 
        error: 'Temporary file not found',
        message: '临时文件未找到或已过期'
      });
    }
    
    if (tempFile.userId !== userId) {
      console.error('[ResolveDuplicate] User ID mismatch:', { tempFileUserId: tempFile.userId, requestUserId: userId });
      return res.status(403).json({ 
        error: 'Forbidden',
        message: '无权访问此临时文件'
      });
    }
    
    const fileType = path.extname(tempFile.originalName).toLowerCase();
    let title = tempFile.originalName.replace(fileType, '');
    
    try {
      title = Buffer.from(title, 'latin1').toString('utf8');
    } catch (e) {
      title = tempFile.originalName.replace(fileType, '');
    }
    
    let content = '';
    if (fileType === '.txt' || fileType === '.md') {
      try {
        content = fs.readFileSync(tempFile.path, 'utf8');
      } catch (error) {
        console.error('[ResolveDuplicate] Error reading file content:', error);
      }
    } else if (fileType === '.docx') {
      try {
        const data = fs.readFileSync(tempFile.path);
        const zip = await JSZip.loadAsync(data);
        const docXml = await zip.file('word/document.xml').async('string');
        const textMatches = docXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
        if (textMatches) {
          content = textMatches.map(match => match.replace(/<[^>]*>/g, '')).join('\n');
        }
      } catch (error) {
        console.error('[ResolveDuplicate] Error parsing docx file:', error);
        content = '无法解析docx文件内容';
      }
    }
    
    const metadata = {
      userId: userId,
      title: title,
      content: content,
      type: 'document',
      fileType: fileType,
      metadata: {
        filename: path.basename(tempFile.path),
        originalname: tempFile.originalName,
        size: tempFile.size,
        mimetype: 'application/octet-stream'
      },
      hash: tempFile.hash,
      size: tempFile.size
    };
    
    const newFile = {
      tempFilePath: tempFile.path,
      metadata: metadata
    };
    
    console.log('[ResolveDuplicate] 调用 DeduplicationService.handleDuplicateAction');
    const result = await deduplicationService.handleDuplicateAction(action, newFile, existingFileId);
    
    await tempFileManager.deleteTempFile(tempFileId);
    console.log('[ResolveDuplicate] 临时文件信息已清理');
    
    if (action === 'cancel') {
      return res.status(200).json({
        success: true,
        cancelled: true,
        message: '上传已取消'
      });
    }
    
    console.log('[ResolveDuplicate] 操作成功，文档ID:', result.id);
    
    if (result && result.id) {
      if (onDocumentCreated) onDocumentCreated(result, { async: true, skipIfExists: false })
        .then(kgResult => {
          console.log('[KG Hook] 重复文件解决后知识图谱构建结果:', kgResult);
        })
        .catch(error => {
          console.error('[KG Hook] 重复文件解决后知识图谱构建失败:', error);
        });
    }
    
    res.status(200).json({
      success: true,
      document: {
        id: result.id,
        title: result.title,
        content: result.content,
        type: result.type,
        fileType: result.fileType,
        metadata: result.metadata,
        hash: result.hash,
        size: result.size,
        uploadDate: result.updatedAt || result.createdAt
      }
    });
    
  } catch (error) {
    console.error('[ResolveDuplicate] Error resolving duplicate:', error);
    res.status(500).json({ 
      error: 'Failed to resolve duplicate',
      message: '处理重复文件失败',
      details: error.message
    });
  }
});

// Chat History Routes
app.get('/api/chat/sessions', authMiddleware, (req, res) => {
  const userId = req.userId;
  userDb.all('SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC', [userId], (err, rows) => {
    if (err) {
      console.error('Error fetching chat sessions:', err);
      return res.status(500).json({ error: 'Failed to fetch chat sessions' });
    }
    
    // For each session, fetch the last message or just return the session info
    // The frontend might need messages for preview, but let's keep it simple for now
    const sessions = rows.map(row => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages: [] // Messages will be loaded on demand or we can load them here if needed
    }));
    
    res.json(sessions);
  });
});

app.post('/api/chat/sessions', authMiddleware, (req, res) => {
  const userId = req.userId;
  const { id, title, messages } = req.body;
  
  // Use provided ID or generate one if not provided (though frontend usually generates ID for optimistic UI)
  const sessionId = id || Date.now().toString();
  const sessionTitle = title || '新对话';
  const initialMessages = messages || [];
  
  userDb.serialize(() => {
    userDb.run(
      'INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [sessionId, userId, sessionTitle],
      function(err) {
        if (err) {
          console.error('Error creating chat session:', err);
          return res.status(500).json({ error: 'Failed to create chat session' });
        }
        
        // If there are initial messages, insert them
        if (initialMessages.length > 0) {
          const stmt = userDb.prepare('INSERT INTO chat_messages (session_id, role, content, sources, web_sources, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)');
          
          initialMessages.forEach(msg => {
            stmt.run([
              sessionId, 
              msg.role, 
              msg.content, 
              JSON.stringify(msg.sources || []), 
              JSON.stringify(msg.webSources || []),
              msg.timestamp
            ]);
          });
          
          stmt.finalize();
        }
        
        res.status(201).json({
          id: sessionId,
          title: sessionTitle,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: initialMessages
        });
      }
    );
  });
});

app.delete('/api/chat/sessions/:id', authMiddleware, (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  
  userDb.run('DELETE FROM chat_sessions WHERE id = ? AND user_id = ?', [id, userId], function(err) {
    if (err) {
      console.error('Error deleting chat session:', err);
      return res.status(500).json({ error: 'Failed to delete chat session' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Cascading delete should handle messages, but let's be safe if foreign keys aren't enabled
    userDb.run('DELETE FROM chat_messages WHERE session_id = ?', [id]);
    
    res.json({ success: true });
  });
});

app.get('/api/chat/sessions/:id', authMiddleware, (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  
  userDb.get('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?', [id, userId], (err, session) => {
    if (err) {
      console.error('Error fetching chat session:', err);
      return res.status(500).json({ error: 'Failed to fetch chat session' });
    }
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    userDb.all('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY id ASC', [id], (err, messages) => {
      if (err) {
        console.error('Error fetching chat messages:', err);
        return res.status(500).json({ error: 'Failed to fetch chat messages' });
      }
      
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        sources: JSON.parse(msg.sources || '[]'),
        webSources: JSON.parse(msg.web_sources || '[]'),
        timestamp: msg.timestamp
      }));
      
      res.json({
        id: session.id,
        title: session.title,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        messages: formattedMessages
      });
    });
  });
});

app.post('/api/chat/sessions/:id/messages', authMiddleware, (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { role, content, sources, webSources, timestamp } = req.body;
  
  // Verify session belongs to user
  userDb.get('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?', [id, userId], (err, session) => {
    if (err || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    userDb.run(
      'INSERT INTO chat_messages (session_id, role, content, sources, web_sources, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [id, role, content, JSON.stringify(sources || []), JSON.stringify(webSources || []), timestamp],
      function(err) {
        if (err) {
          console.error('Error adding message:', err);
          return res.status(500).json({ error: 'Failed to add message' });
        }
        
        // Update session timestamp
        userDb.run('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
        
        res.status(201).json({
          id: this.lastID,
          role,
          content,
          sources: sources || [],
          webSources: webSources || [],
          timestamp
        });
      }
    );
  });
});

app.put('/api/chat/sessions/:id', authMiddleware, (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { title } = req.body;
  
  userDb.run(
    'UPDATE chat_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    [title, id, userId],
    function(err) {
      if (err) {
        console.error('Error updating session:', err);
        return res.status(500).json({ error: 'Failed to update session' });
      }
      res.json({ success: true, title });
    }
  );
});

// AI功能相关API（模拟实现）

// AI搜索API
app.post('/api/ai/search', authMiddleware, async (req, res) => {
  try {
    const { query, model: requestedModel, topK = 5, messages: history } = req.body;
    
    console.log('收到AI搜索请求:', query);
    console.log('请求的模型:', requestedModel);
    
    // 读取 SOUL.md 获取系统提示词
    let soulPrompt = '';
    try {
      const soulPath = path.join(__dirname, 'config', 'soul.md');
      if (fs.existsSync(soulPath)) {
        soulPrompt = fs.readFileSync(soulPath, 'utf8');
      }
    } catch (error) {
      console.error('Failed to read soul.md:', error);
    }
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }
    
    // 从数据库获取所有文档，而不是从JSON文件
    // 注意：这里没有用户ID过滤，在实际多用户系统中应该加上 WHERE user_id = ?
    // 但为了保持当前上下文简单，我们先获取所有文档，或者假设这是一个单用户/演示环境
    // 如果有 userId 在 request 中 (authMiddleware)，应该使用它
    
    let documents = [];
    try {
      // 尝试从数据库获取文档
      const rows = await new Promise((resolve, reject) => {
        userDb.all('SELECT * FROM documents ORDER BY created_at DESC', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
      
      documents = rows.map(row => ({
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
      console.log('从数据库加载文档成功，数量:', documents.length);
    } catch (dbError) {
      console.error('从数据库加载文档失败，回退到JSON文件:', dbError);
      documents = loadDocuments();
    }
    
    // Agentic RAG 实现
    console.log('启动 Agentic RAG 流程...');
    
    // 步骤 1: 意图分析与查询重写
    const intentPrompt = `你是一个专业的搜索专家。请分析用户的查询 "${query}"。
    请生成一个最优的搜索关键词列表（JSON数组格式），用于在知识库中检索相关文档。
    如果用户查询包含"AI内涝"等具体概念，请确保包含该确切短语。
    同时生成一个文本嵌入查询语句，用于语义搜索。
    
    返回格式：
    {
      "keywords": ["关键词1", "关键词2"],
      "semantic_query": "用于语义匹配的完整句子"
    }`;
    
    let searchPlan = { keywords: [query], semantic_query: query };
    try {
      const planResponse = await callCloudModel('qwen-turbo', intentPrompt);
      const jsonMatch = planResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        searchPlan = JSON.parse(jsonMatch[0]);
        console.log('搜索计划:', searchPlan);
      }
    } catch (e) {
      console.error('意图分析失败，使用原始查询:', e);
    }
    
    // 步骤 2: 执行混合搜索 (向量 + 关键词)
    const allDocs = await new Promise((resolve, reject) => {
      userDb.all('SELECT id, title, content, embedding FROM documents', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    // 向量搜索
    let vectorResults = [];
    try {
      const queryEmbedding = await generateEmbedding(searchPlan.semantic_query);
      if (queryEmbedding) {
        vectorResults = allDocs
          .filter(doc => doc.embedding)
          .map(doc => {
            try {
              const docEmbedding = JSON.parse(doc.embedding);
              return {
                doc,
                score: cosineSimilarity(queryEmbedding, docEmbedding),
                source: 'vector'
              };
            } catch (e) { return null; }
          })
          .filter(item => item !== null)
          .sort((a, b) => b.score - a.score)
          .slice(0, topK * 2);
      }
    } catch (e) {
      console.error('向量搜索失败:', e);
    }
    
    // 关键词搜索
    const keywordResults = allDocs.map(doc => {
      let score = 0;
      const titleLower = doc.title.toLowerCase();
      const contentLower = doc.content.toLowerCase();
      
      searchPlan.keywords.forEach(kw => {
        const kwLower = kw.toLowerCase();
        if (titleLower.includes(kwLower)) score += 10;
        if (contentLower.includes(kwLower)) score += 5;
      });
      
      return { doc, score, source: 'keyword' };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK * 2);
    
    // 合并去重
    const combinedMap = new Map();
    [...vectorResults, ...keywordResults].forEach(item => {
      if (!combinedMap.has(item.doc.id)) {
        combinedMap.set(item.doc.id, { ...item, finalScore: item.score });
      } else {
        const existing = combinedMap.get(item.doc.id);
        existing.finalScore += item.score; // 提升同时匹配两者的文档排名
        existing.source = 'hybrid';
      }
    });
    
    const relevantDocs = Array.from(combinedMap.values())
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, topK)
      .map(item => item.doc);
      
    console.log(`检索到 ${relevantDocs.length} 个相关文档`);
    
    // 构建上下文
    const knowledgeBaseContext = relevantDocs.length > 0 ? 
      relevantDocs.map((doc, index) => 
        `【文档${index + 1}】标题：${doc.title}\n内容摘要：\n${doc.content.substring(0, 1500)}...\n`
      ).join('\n\n') : 
      '知识库中没有找到相关文档';

    // 步骤 3: 联网搜索 (如果知识库结果不足)
    // ... (保持原有的联网搜索逻辑)
    
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
    
    // 智能意图识别
    const isChat = /^(你好|你是谁|自我介绍|嗨|hello|hi|早安|晚安|再见|谢谢)/i.test(query);
    
    // 如果是闲聊，直接调用模型回答，不进行搜索
    if (isChat) {
      // ... (保持原有的闲聊逻辑)
    }

    // 构建综合提示词
    const prompt = `你是一个基于Agentic RAG架构的智能助手。
请综合利用以下检索到的信息回答用户问题。

用户问题：${query}

【检索到的知识库文档】：
${knowledgeBaseContext}

【联网搜索结果】：
${webSearchContext}

思考过程（内部）：
1. 分析用户问题的核心需求。
2. 评估检索到的文档是否足以回答问题。
3. 综合多方信息，给出准确、结构化的回答。

回答要求：
1. 优先依据【知识库文档】中的信息。
2. 如果知识库中有"AI内涝"等具体文档，必须详细引用其内容。
3. 语言通顺，逻辑清晰，不要暴露系统内部的思考过程。
4. 直接给出最终答案。`;
    
    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 发送初始数据（源信息）
    res.write(`data: ${JSON.stringify({
      type: 'sources',
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
    })}\n\n`);

    // 调用AI模型（流式）
    console.log('正在调用AI模型生成答案(流式)...');
    
    // 如果是闲聊意图，使用简化prompt
    const finalPrompt = isChat ? `你是一个智能助手。请用自然、亲切的语气回答用户。
    
    用户输入：${query}
    
    要求：
    1. 不要使用Markdown格式，像真人打字一样直接回复
    2. 不要输出思考过程
    3. 语气要像老朋友一样自然` : prompt;

    // 模型调用策略
    const modelCallOrder = [];
    if (requestedModel) {
      modelCallOrder.push(requestedModel);
    }
    const cloudModels = ['deepseek-chat', 'qwen-plus', 'qwen-turbo'];
    cloudModels.forEach(model => {
      if (!modelCallOrder.includes(model)) {
        modelCallOrder.push(model);
      }
    });

    let success = false;
    let lastError = null;
    let accumulatedAIContent = '';

    for (const cloudModel of modelCallOrder) {
      try {
        console.log(`尝试使用模型(流式): ${cloudModel}`);
        
        let apiKey, apiUrl, requestBody;
        
        if (cloudModel.startsWith('qwen')) {
          apiKey = process.env.QWEN_API_KEY;
          apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
          requestBody = {
            model: cloudModel,
            messages: [
              ...(history || []),
              { role: 'system', content: soulPrompt },
              { role: 'user', content: finalPrompt }
            ],
            stream: true,
            temperature: 0.7,
            max_tokens: 2000
          };
        } else if (cloudModel.startsWith('deepseek')) {
          apiKey = process.env.DEEPSEEK_API_KEY;
          apiUrl = 'https://api.deepseek.com/v1/chat/completions';
          requestBody = {
            model: cloudModel,
            messages: [
               ...(history || []),
              { role: 'system', content: soulPrompt },
              { role: 'user', content: finalPrompt }
            ],
            stream: true,
            temperature: 0.7,
            max_tokens: 2000
          };
        } else {
          continue;
        }

        if (!apiKey) continue;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'text/event-stream'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
           throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6));
                const content = data.choices?.[0]?.delta?.content || '';
                if (content) {
                  accumulatedAIContent += content;
                  res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);
                }
              } catch (e) {
                // Ignore parse errors for partial chunks
              }
            }
          }
        }
        
        success = true;
        break;
      } catch (error) {
        console.error(`模型 ${cloudModel} 流式调用失败:`, error);
        lastError = error;
        continue;
      }
    }

    if (!success) {
       res.write(`data: ${JSON.stringify({ type: 'error', error: '所有模型调用失败' })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();

    // 异步采集 ai_chat 碎片（不阻塞响应）
    if (success && req.userId) {
      const crypto = require('crypto');
      const sessionId = crypto.randomUUID();
      fragmentCollector.collect({
        userId: req.userId,
        fragmentType: 'ai_chat',
        content: `${query}\n${accumulatedAIContent}`.slice(0, 500),
        sourceId: sessionId,
        sourceMeta: { userMessage: query, aiResponse: accumulatedAIContent.slice(0, 500) }
      }).catch(err => console.error('[FragmentCollector] ai_chat collection error:', err));
    }

  } catch (error) {
    console.error('AI search failed:', error);
    // 如果已经开始发送流，就发送错误事件
    if (res.headersSent) {
       res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
       res.end();
    } else {
      res.status(500).json({ 
        success: false,
        error: error.message || 'AI search failed'
      });
    }
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

// 文档总结API
app.post('/api/ai/summary', authMiddleware, async (req, res) => {
  try {
    const { documentId, model: requestedModel } = req.body;
    const userId = req.userId;
    
    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      });
    }
    
    // 从数据库加载文档
    userDb.get('SELECT * FROM documents WHERE id = ? AND user_id = ?', [documentId, userId], async (err, row) => {
      if (err) {
        console.error('Error fetching document:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch document'
        });
      }
      
      if (!row) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }
      
      const document = {
        id: row.id.toString(),
        title: row.title,
        content: row.content
      };
      
      // 提取纯文本内容（如果是 Tiptap JSON 格式）
      let plainContent = document.content;
      try {
        const parsed = JSON.parse(document.content);
        if (parsed && parsed.type === 'doc' && Array.isArray(parsed.content)) {
          plainContent = parsed.content.map(node => {
            if (node.content && Array.isArray(node.content)) {
              return node.content.map(c => c.text || '').join('');
            }
            return '';
          }).filter(t => t).join('\n');
        }
      } catch { /* 不是 JSON，使用原始内容 */ }

      // 构建结构化总结提示
      const prompt = `请对以下文档内容进行结构化分析，返回严格的JSON格式（不要包含markdown代码块标记）：

文档标题：${document.title}
文档内容：
${plainContent.substring(0, 6000)}

请返回如下JSON格式（必须是合法JSON，不要有多余文字）：
{
  "documentType": "文章类型（如：简历、技术文档、学术论文、会议纪要、产品文档、笔记等）",
  "typeTags": ["类型标签1", "类型标签2"],
  "overview": "一段话概括文档的主要内容（100-200字）",
  "keyPoints": [
    "要点1",
    "要点2",
    "要点3"
  ],
  "keywords": ["关键词1", "关键词2", "关键词3", "关键词4", "关键词5"],
  "applications": [
    "应用方向1：具体说明",
    "应用方向2：具体说明"
  ],
  "quality": {
    "completeness": 85,
    "clarity": 90,
    "comment": "对文档质量的简短评价"
  }
}`;
      
      // 模型调用策略
      const modelCallOrder = [];
      if (requestedModel) {
        modelCallOrder.push(requestedModel);
      }
      const cloudModels = ['deepseek-chat', 'qwen-plus', 'qwen-turbo'];
      cloudModels.forEach(model => {
        if (!modelCallOrder.includes(model)) {
          modelCallOrder.push(model);
        }
      });
      
      console.log('文档总结模型调用顺序:', modelCallOrder);
      
      let summary = null;
      let lastError = null;
      
      // 尝试调用模型
      for (const model of modelCallOrder) {
        try {
          console.log(`尝试使用模型 ${model} 进行文档总结`);
          
          if (LOCAL_MODELS.includes(model)) {
            // 本地模型调用
            const localResponse = await fetch(`${OLLAMA_API_URL}/chat`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: model,
                messages: [
                  { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 2000
              })
            });
            
            if (!localResponse.ok) {
              throw new Error(`本地模型调用失败: ${localResponse.status}`);
            }
            
            const localData = await localResponse.json();
            if (localData.message && localData.message.content) {
              summary = localData.message.content;
              console.log(`本地模型 ${model} 总结成功`);
              break;
            } else {
              throw new Error(`本地模型返回格式无效`);
            }
          } else {
            // 云端模型调用
            let apiKey, apiUrl, requestBody;
            
            if (model.startsWith('qwen')) {
              apiKey = process.env.QWEN_API_KEY;
              apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
              requestBody = {
                model: model,
                messages: [
                  { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 2000
              };
            } else if (model.startsWith('deepseek')) {
              apiKey = process.env.DEEPSEEK_API_KEY;
              apiUrl = 'https://api.deepseek.com/v1/chat/completions';
              requestBody = {
                model: model,
                messages: [
                  { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 2000
              };
            } else {
              continue;
            }
            
            if (!apiKey) {
              console.log(`模型 ${model} 的API密钥未配置，跳过`);
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
              console.error(`模型 ${model} API error:`, errorText);
              lastError = `模型 ${model} API error: ${cloudResponse.status} - ${errorText}`;
              continue;
            }
            
            const cloudData = await cloudResponse.json();
            
            if (cloudData.choices && cloudData.choices.length > 0) {
              summary = cloudData.choices[0].message.content;
              console.log(`模型 ${model} 总结成功`);
              break;
            } else if (cloudData.output && cloudData.output.text) {
              summary = cloudData.output.text;
              console.log(`模型 ${model} 总结成功`);
              break;
            } else {
              console.error(`模型 ${model} 返回格式无效`);
              lastError = `模型 ${model} 返回格式无效`;
              continue;
            }
          }
        } catch (error) {
          console.error(`模型 ${model} 调用失败:`, error);
          lastError = error.message;
          continue;
        }
      }
      
      if (!summary) {
        return res.status(500).json({
          success: false,
          error: `生成总结失败: ${lastError || '所有模型调用失败'}`
        });
      }
      
      // 尝试解析结构化 JSON
      let structuredSummary = null;
      try {
        // 清理可能的 markdown 代码块标记
        let cleaned = summary.trim();
        if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
        if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
        if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
        cleaned = cleaned.trim();
        structuredSummary = JSON.parse(cleaned);
      } catch {
        // 如果解析失败，包装为兼容格式
        structuredSummary = {
          documentType: '文档',
          typeTags: [],
          overview: summary,
          keyPoints: [],
          keywords: [],
          applications: [],
          quality: { completeness: 0, clarity: 0, comment: '' }
        };
      }
      
      // 存储总结到数据库（存储结构化 JSON）
      const summaryToStore = JSON.stringify(structuredSummary);
      userDb.run(
        'INSERT OR REPLACE INTO summaries (user_id, document_id, model, content, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [userId, documentId, requestedModel || 'qwen-plus', summaryToStore],
        (err) => {
          if (err) {
            console.error('Error saving summary to database:', err);
            return res.json({
              success: true,
              summary: summaryToStore,
              structured: structuredSummary
            });
          }
          
          console.log('Summary saved to database successfully');
          res.json({
            success: true,
            summary: summaryToStore,
            structured: structuredSummary
          });
        }
      );
    });
  } catch (error) {
    console.error('生成文档总结失败:', error);
    res.status(500).json({
      success: false,
      error: '生成文档总结失败'
    });
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

// 获取可用模型配置（本地和云端）
app.get('/api/ai/available-models', (req, res) => {
  try {
    const localModels = LOCAL_MODELS.map(modelName => ({
      model_name: modelName,
      model_type: 'local',
      endpoint: OLLAMA_API_URL,
      is_enabled: true,
      priority: 1
    }));

    const cloudModels = Object.keys(CLOUD_MODELS).map(modelName => ({
      model_name: modelName,
      model_type: 'cloud',
      provider: CLOUD_MODELS[modelName].provider,
      endpoint: CLOUD_MODELS[modelName].endpoint,
      is_enabled: !!CLOUD_MODELS[modelName].apiKey,
      priority: 0
    }));

    res.json({
      success: true,
      data: {
        local: localModels,
        cloud: cloudModels,
        all: [...localModels, ...cloudModels]
      }
    });
  } catch (error) {
    console.error('Failed to get available models:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get available models'
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
    
    // 如果缓存为空且需要重新生成，则返回空并提示需要生成
    if ((!cachedKnowledgeGraph || !cachedKnowledgeGraph.entities || cachedKnowledgeGraph.entities.length === 0) && needRegenerate) {
      console.log('缓存为空且文档有更新，需要重新生成知识图谱');
      return res.json({
        success: true,
        entities: null,
        relations: null,
        needRegenerate: true,
        message: '文档内容变化或缓存为空，需要重新生成知识图谱'
      });
    }
    
    // 否则返回缓存（即使需要更新），并标记 needRegenerate
    // 这样前端可以先显示旧图谱，同时后台触发更新（或者前端根据标记触发）
    res.json({
      success: true,
      entities: cachedKnowledgeGraph ? cachedKnowledgeGraph.entities : [],
      relations: cachedKnowledgeGraph ? cachedKnowledgeGraph.relations : [],
      needRegenerate: needRegenerate,
      message: needRegenerate ? '返回缓存的知识图谱（数据已过期，建议更新）' : '使用缓存的知识图谱'
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
    },
    {
      id: 'technical',
      name: '技术文档',
      description: '技术相关的文档和资料',
      color: '#50E3C2',
      documentIds: documents.filter(doc => 
        doc.title.toLowerCase().includes('技术') || 
        doc.title.toLowerCase().includes('tech') ||
        doc.tags?.some(tag => tag.toLowerCase().includes('技术') || tag.toLowerCase().includes('tech'))
      ).map(doc => doc.id)
    },
    {
      id: 'ai',
      name: 'AI相关',
      description: '人工智能相关的文档和资料',
      color: '#9013FE',
      documentIds: documents.filter(doc => 
        doc.title.toLowerCase().includes('ai') || 
        doc.title.toLowerCase().includes('人工智能') ||
        doc.tags?.some(tag => tag.toLowerCase().includes('ai') || tag.toLowerCase().includes('人工智能'))
      ).map(doc => doc.id)
    },
    {
      id: 'project',
      name: '项目文档',
      description: '项目相关的文档和资料',
      color: '#FF6B6B',
      documentIds: documents.filter(doc => 
        doc.title.toLowerCase().includes('项目') || 
        doc.title.toLowerCase().includes('project') ||
        doc.tags?.some(tag => tag.toLowerCase().includes('项目') || tag.toLowerCase().includes('project'))
      ).map(doc => doc.id)
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
  }).filter(category => category.documentCount > 0);
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

// 监控API端点
app.get('/api/monitoring', (req, res) => {
  try {
    const logStatus = getLogStatus();
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    res.json({
      success: true,
      data: {
        server: {
          status: 'running',
          uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
          memory: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
          },
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        },
        logs: logStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Monitoring endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get monitoring data'
    });
  }
});

// 清理日志API
app.post('/api/monitoring/clean-logs', (req, res) => {
  try {
    cleanOldLogs(7); // 清理7天前的日志
    res.json({
      success: true,
      message: 'Logs cleaned successfully'
    });
  } catch (error) {
    console.error('Failed to clean logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean logs'
    });
  }
});

// 健康检查（增强版）
app.get('/api/health', (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    
    res.json({
      status: 'ok',
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      server: {
        uptime: process.uptime(),
        memory: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
        }
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server health check failed'
    });
  }
});

// Add 404 handler for API routes BEFORE SPA catch-all
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// 处理 SPA 路由：所有未匹配 API 的请求都返回 index.html
app.get('*', (req, res, next) => {
  const indexPath = path.join(__dirname, 'client/dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // 如果没有 index.html，说明前端未构建，返回 404 或提示
    next(new Error('Frontend build not found. Please run "npm run build" in client directory.'));
  }
});

// 使用错误处理中间件
app.use(notFound);
app.use(errorHandlerMiddleware);

// 启动HTTP服务器

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();

if (process.env.NODE_ENV !== 'test') {
  const server = http.createServer(app);
  
  // Initialize Socket.IO
  const { Server } = require("socket.io");
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  app.set('io', io);
  
  io.on('connection', (socket) => {
    socket.on('join', (userId) => {
      socket.join(`user:${userId}`);
    });
  });

  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Server is accessible on network: http://${localIP}:${PORT}`);
    
    // Initialize MinIO bucket
    try {
      const minioService = require('./services/minioService');
      await minioService.ensureBucket();
      console.log('[MinIO] Bucket initialized successfully');
    } catch (err) {
      console.warn('[MinIO] Bucket initialization failed (MinIO may not be running):', err.message);
    }
    
    // Initialize TempFileManager (cleanup task already started in constructor)
    console.log('[TempFileManager] Automatic cleanup enabled (runs every 15 minutes)');
    
    // Start UnificationScheduler
    unificationScheduler.start();
    console.log('[UnificationScheduler] Started (checking every hour for new documents)');
    
    // KG module removed — pending redesign
    console.log('[KG Module] Knowledge Graph module removed, pending redesign');
    console.log('Available APIs:');
    console.log('- GET /api/health - 健康检查');
    console.log('- GET /api/monitoring - 监控状态');
    console.log('- POST /api/monitoring/clean-logs - 清理日志');
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
    console.log('- GET /api/admin/users/:id/role - 更新用户角色（管理员）');
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
    console.log('- POST /api/images/upload - 上传图片到MinIO');
    console.log('- GET /api/images/:id/analysis - 查询图片AI识别结果');
    console.log('- GET /api/images/proxy/* - 代理MinIO图片访问');
    
    console.log('\n=== 网络访问信息 ===');
    console.log(`本地访问: http://localhost:${PORT}`);
    console.log(`局域网访问: http://${localIP}:${PORT}`);
    console.log(`请确保防火墙允许端口 ${PORT} 的访问`);
  });
}

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  
  // Stop UnificationScheduler
  unificationScheduler.stop();
  console.log('[UnificationScheduler] Stopped');
  
  // Close Prisma connection if needed
  // prisma.$disconnect() can be called here if needed
  
  process.exit(0);
};

// Handle various shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 导出app对象，用于测试
module.exports = app;