/**
 * Controllers Index
 * Exports all controllers for easy importing
 */

const DocumentController = require('./documentController');
const KnowledgeGraphController = require('./knowledgeGraphController');
const AIController = require('./aiController');

module.exports = {
  DocumentController,
  KnowledgeGraphController,
  AIController,
};
