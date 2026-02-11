/**
 * AI Controller
 * Handles HTTP requests for AI operations
 */

const { asyncHandler, successResponse } = require('../middleware');

class AIController {
  constructor(aiService) {
    this.aiService = aiService;
  }

  search = asyncHandler(async (req, res) => {
    const { query, topK = 10 } = req.body;
    const userId = req.userId;
    
    const results = await this.aiService.semanticSearch(query, topK, userId);
    res.json(successResponse(results));
  });

  summarize = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { model = 'deepseek-chat' } = req.body;
    const userId = req.userId;
    
    const summary = await this.aiService.summarizeDocument(id, model, userId);
    res.json(successResponse(summary, 'Document summarized successfully'));
  });

  classify = asyncHandler(async (req, res) => {
    const { documentId } = req.body;
    const userId = req.userId;
    
    const result = await this.aiService.classifyDocument(documentId, userId);
    res.json(successResponse(result, 'Document classified successfully'));
  });

  generateTags = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { model = 'deepseek-chat' } = req.body;
    const userId = req.userId;
    
    const tags = await this.aiService.generateTags(id, model, userId);
    res.json(successResponse(tags, 'Tags generated successfully'));
  });
}

module.exports = AIController;
