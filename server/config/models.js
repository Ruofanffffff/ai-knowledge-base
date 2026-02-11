/**
 * Cloud Models Configuration
 * Centralizes configuration for all cloud AI models
 */

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

const LOCAL_MODELS = ['llama2:7b', 'mistral:7b', 'deepseek-r1:7b'];

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api';

module.exports = {
  CLOUD_MODELS,
  LOCAL_MODELS,
  OLLAMA_API_URL,
};
