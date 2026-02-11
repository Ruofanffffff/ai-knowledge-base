/**
 * Server Configuration
 * Centralizes server and application settings
 */

const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  UPLOAD_DIR: path.join(__dirname, '..', 'uploads'),
  DATA_DIR: path.join(__dirname, '..', 'data'),
  
  FILES: {
    DOCUMENTS: path.join(__dirname, '..', 'data', 'documents.json'),
    CATEGORIES: path.join(__dirname, '..', 'data', 'categories.json'),
    RECOMMENDATIONS_CACHE: path.join(__dirname, '..', 'data', 'recommendations.json'),
    KNOWLEDGE_GRAPH_CACHE: path.join(__dirname, '..', 'data', 'knowledge-graph.json'),
  },
  
  API_TIMEOUT: 30000,
  MAX_FILE_SIZE: 10 * 1024 * 1024,
};
