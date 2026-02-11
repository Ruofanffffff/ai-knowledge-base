/**
 * Knowledge Graph Controller
 * Handles HTTP requests for knowledge graph operations
 */

const { asyncHandler, successResponse } = require('../middleware');

class KnowledgeGraphController {
  constructor(knowledgeGraphService) {
    this.knowledgeGraphService = knowledgeGraphService;
  }

  getGraphData = asyncHandler(async (req, res) => {
    const { minConfidence, entityType, relationType } = req.query;
    const graphData = await this.knowledgeGraphService.getGraphData({
      minConfidence: minConfidence ? parseFloat(minConfidence) : undefined,
      entityType,
      relationType,
    });
    res.json(successResponse(graphData));
  });

  getStats = asyncHandler(async (req, res) => {
    const stats = await this.knowledgeGraphService.getStats();
    res.json(successResponse(stats));
  });

  buildGraph = asyncHandler(async (req, res) => {
    const { documentId } = req.body;
    const userId = req.userId;
    
    const result = await this.knowledgeGraphService.buildFromDocument(documentId, userId);
    res.json(successResponse(result, 'Graph built successfully'));
  });

  getEntities = asyncHandler(async (req, res) => {
    const { type, minConfidence, skip = 0, take = 100 } = req.query;
    const entities = await this.knowledgeGraphService.getEntities({
      type,
      minConfidence: minConfidence ? parseFloat(minConfidence) : undefined,
      skip: parseInt(skip),
      take: parseInt(take),
    });
    res.json(successResponse(entities));
  });

  getRelations = asyncHandler(async (req, res) => {
    const { type, minConfidence, skip = 0, take = 100 } = req.query;
    const relations = await this.knowledgeGraphService.getRelations({
      type,
      minConfidence: minConfidence ? parseFloat(minConfidence) : undefined,
      skip: parseInt(skip),
      take: parseInt(take),
    });
    res.json(successResponse(relations));
  });
}

module.exports = KnowledgeGraphController;
