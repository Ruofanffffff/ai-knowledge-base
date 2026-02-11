/**
 * Document Controller
 * Handles HTTP requests for document operations
 */

const { asyncHandler, successResponse } = require('../middleware');

class DocumentController {
  constructor(documentService) {
    this.documentService = documentService;
  }

  getAllDocuments = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const documents = await this.documentService.getAllByUserId(userId);
    res.json(successResponse(documents));
  });

  getDocumentById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;
    const document = await this.documentService.getByIdAndUserId(id, userId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }
    
    res.json(successResponse(document));
  });

  createDocument = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const documentData = {
      ...req.body,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const document = await this.documentService.create(documentData);
    res.status(201).json(successResponse(document, 'Document created successfully'));
  });

  updateDocument = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;
    const updateData = {
      ...req.body,
      updatedAt: new Date().toISOString(),
    };
    
    const document = await this.documentService.updateByIdAndUserId(id, userId, updateData);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }
    
    res.json(successResponse(document, 'Document updated successfully'));
  });

  deleteDocument = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;
    
    const deleted = await this.documentService.deleteByIdAndUserId(id, userId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }
    
    res.json(successResponse(null, 'Document deleted successfully'));
  });
}

module.exports = DocumentController;
