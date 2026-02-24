/**
 * Notes Feature Configuration
 * 
 * This file contains all configuration settings for the notes feature,
 * including database, storage, LLM, and validation settings.
 */

require('dotenv').config();

const notesConfig = {
  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/knowledge_base?schema=public',
  },

  // S3-Compatible Object Storage Configuration
  storage: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || (process.env.NODE_ENV === 'production' ? undefined : 'minioadmin'),
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || (process.env.NODE_ENV === 'production' ? undefined : 'minioadmin'),
    bucketName: process.env.S3_BUCKET_NAME || 'notes-attachments',
    region: process.env.S3_REGION || 'us-east-1',
    useSSL: process.env.S3_USE_SSL === 'true',
    forcePathStyle: true, // Required for MinIO
  },

  // Attachment Configuration
  attachments: {
    maxSize: parseInt(process.env.NOTES_MAX_ATTACHMENT_SIZE || '10485760', 10), // 10MB
    allowedImageTypes: (process.env.NOTES_ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/gif,image/webp').split(','),
    allowedDocumentTypes: (process.env.NOTES_ALLOWED_DOCUMENT_TYPES || 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain').split(','),
    allowedTableTypes: (process.env.NOTES_ALLOWED_TABLE_TYPES || 'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv').split(','),
  },

  // Multi-modal LLM Configuration (for image analysis)
  // 使用字节火山引擎 seed1.8 模型进行图片分析
  multiModalLLM: {
    provider: process.env.MULTIMODAL_LLM_PROVIDER || 'volcengine',
    model: process.env.MULTIMODAL_LLM_MODEL || 'seed1.8',
    timeout: parseInt(process.env.MULTIMODAL_LLM_TIMEOUT || '30000', 10),
    apiKey: process.env.VOLCENGINE_API_KEY || process.env.QWEN_API_KEY,
  },

  // Text LLM Configuration (for text enhancement)
  // 保持使用阿里Qwen进行文本生成
  textLLM: {
    provider: process.env.TEXT_LLM_PROVIDER || 'qwen',
    model: process.env.TEXT_LLM_MODEL || 'qwen-max',
    timeout: parseInt(process.env.TEXT_LLM_TIMEOUT || '10000', 10),
    apiKey: process.env.QWEN_API_KEY,
  },

  // Video Generation LLM Configuration
  // 使用字节火山引擎 seedance 2.0 模型进行视频生成
  videoLLM: {
    provider: process.env.VIDEO_LLM_PROVIDER || 'volcengine',
    model: process.env.VIDEO_LLM_MODEL || 'seedance-2.0',
    timeout: parseInt(process.env.VIDEO_LLM_TIMEOUT || '60000', 10),
    apiKey: process.env.VOLCENGINE_API_KEY,
  },

  // Image Generation LLM Configuration
  // 使用字节火山引擎 seedream 4.5 模型进行图片生成
  imageGenLLM: {
    provider: process.env.IMAGE_GEN_LLM_PROVIDER || 'volcengine',
    model: process.env.IMAGE_GEN_LLM_MODEL || 'seedream-4.5',
    timeout: parseInt(process.env.IMAGE_GEN_LLM_TIMEOUT || '30000', 10),
    apiKey: process.env.VOLCENGINE_API_KEY,
  },

  // 封面图AI生成配置
  // 使用字节火山引擎即梦AI（seedream）模型为社区帖子生成封面图
  // 支持两种认证方式：
  // 1. API Key 方式：配置 ARK_API_KEY
  // 2. AKSK 方式：配置 VOLCENGINE_ACCESS_KEY_ID 和 VOLCENGINE_SECRET_ACCESS_KEY
  coverGeneration: {
    provider: process.env.IMAGE_GEN_LLM_PROVIDER || 'volcengine',
    model: process.env.JIMENG_MODEL || process.env.IMAGE_GEN_LLM_MODEL || 'doubao-seedream-4-5-251128',
    apiKey: process.env.ARK_API_KEY || process.env.VOLCENGINE_API_KEY,
    accessKeyId: process.env.VOLCENGINE_ACCESS_KEY_ID,
    secretAccessKey: process.env.VOLCENGINE_SECRET_ACCESS_KEY,
    baseURL: process.env.JIMENG_API_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    imageSize: process.env.JIMENG_IMAGE_SIZE || '1024x576',
    timeout: parseInt(process.env.JIMENG_TIMEOUT || '60000', 10),
    maxRetries: 2,
    pipelineTimeout: 120000,
  },

  // Performance Requirements (from requirements.md)
  performance: {
    textSaveTimeout: 500,        // Requirement 1.6: 500ms
    imageUploadTimeout: 3000,    // Requirement 2.7: 3s
    imageAnalysisTimeout: 10000, // Requirement 2.8: 10s
    aiEnhancementTimeout: 30000, // Requirements 5.5, 6.6, 7.5, 8.6: 30s (increased for professional-grade prompt)
    searchTimeout: 500,          // Requirement 9.6: 500ms
  },

  // Retry Configuration (Requirement 12.4)
  retry: {
    maxRetries: 3,
    backoffMultiplier: 2,
    initialDelay: 100, // ms
  },

  // Tag Configuration
  tags: {
    pattern: /#([^\s#]+)/g, // Regex to match hashtags
    maxLength: 50,
  },

  // Search Configuration
  search: {
    minQueryLength: 1,
    maxResults: 100,
    highlightTag: '<mark>',
    highlightEndTag: '</mark>',
  },

  // Image Analysis Configuration
  imageAnalysis: {
    supportedTypes: [
      'text',      // 纯文字图片（文档、截图、手写）
      'landscape', // 风景照片
      'portrait',  // 人物肖像
      'product',   // 产品照片
      'artwork',   // 艺术作品
      'screenshot', // 电影/动画截图
      'mixed',     // 混合内容图片
    ],
  },

  // AI Enhancement Configuration
  aiEnhancement: {
    generate: {
      expansionRatio: 2.5, // Expand text to 2-3x original length
      includeImagePrompt: true,
    },
    proofread: {
      preserveStyle: true,
      trackChanges: true,
    },
    table: {
      maxColumns: 10,
      maxRows: 100,
    },
    mindmap: {
      minBranches: 3,
      maxBranches: 6,
      maxLabelLength: 20,
    },
  },
};

// Validation function
function validateConfig() {
  const errors = [];

  // Validate required environment variables
  if (!notesConfig.multiModalLLM.apiKey) {
    errors.push('VOLCENGINE_API_KEY or QWEN_API_KEY is required for LLM functionality');
  }

  if (!notesConfig.textLLM.apiKey) {
    errors.push('QWEN_API_KEY is required for text generation');
  }

  if (!notesConfig.database.url) {
    errors.push('DATABASE_URL is required');
  }

  if (!notesConfig.storage.accessKeyId || !notesConfig.storage.secretAccessKey) {
    errors.push('S3 credentials (S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY) are required');
  }

  if (errors.length > 0) {
    console.warn('⚠️  Configuration warnings:');
    errors.forEach(error => console.warn(`   - ${error}`));
  }

  return errors.length === 0;
}

// Export configuration
module.exports = {
  notesConfig,
  validateConfig,
};
