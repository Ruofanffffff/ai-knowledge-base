/**
 * Services Index
 * Exports all services for easy importing
 */

const DocumentService = require('./documentService');
const AIService = require('./aiService');
const KnowledgeGraphService = require('./knowledgeGraphService');

module.exports = {
  DocumentService,
  AIService,
  KnowledgeGraphService,
};
