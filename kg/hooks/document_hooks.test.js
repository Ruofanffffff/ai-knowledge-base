/**
 * 文档操作钩子集成测试
 */

const { 
  onDocumentCreated, 
  onDocumentUpdated, 
  onDocumentDeleted,
  onBatchDocuments 
} = require('./document_hooks');
const kgService = require('../services/kg_service');
const { PrismaClient } = require('@prisma/client');

// Mock KG Service
jest.mock('../services/kg_service');

// Mock Build Queue Manager
jest.mock('../services/build_queue_manager', () => {
  const mockQueueManager = {
    enqueue: jest.fn((docId, buildFn) => {
      // Execute immediately for testing
      return buildFn();
    }),
    isQueued: jest.fn(() => false),
    getStats: jest.fn(() => ({
      maxConcurrent: 3,
      running: 0,
      queued: 0,
      total: 0,
      runningTasks: [],
      queuedTasks: []
    }))
  };
  return {
    getInstance: jest.fn(() => mockQueueManager)
  };
});

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    cKB: {
      findFirst: jest.fn(),
      deleteMany: jest.fn()
    },
    entity: {
      deleteMany: jest.fn()
    },
    relation: {
      deleteMany: jest.fn()
    }
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma)
  };
});

describe('文档操作钩子集成测试', () => {
  let prisma;
  
  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient();
    
    // 设置环境变量
    process.env.KG_ENABLED = 'true';
  });
  
  afterEach(() => {
    delete process.env.KG_ENABLED;
  });
  
  describe('onDocumentCreated - 文档创建钩子', () => {
    const mockDocument = {
      id: 'doc-123',
      title: '测试文档',
      content: '这是一个测试文档的内容',
      metadata: {
        filePath: '/path/to/test.txt'
      }
    };
    
    test('应该异步触发知识图谱构建', async () => {
      kgService.buildKnowledgeGraph.mockResolvedValue({
        success: true,
        entities_created: 5,
        relations_created: { builtin: 2, cooccurrence: 1, semantic: 0 }
      });
      
      const result = await onDocumentCreated(mockDocument, { async: true });
      
      expect(result.success).toBe(true);
      expect(result.async).toBe(true);
      expect(result.message).toContain('KG build');
    });
    
    test('应该同步触发知识图谱构建', async () => {
      const mockResult = {
        success: true,
        entities_created: 5,
        relations_created: { builtin: 2, cooccurrence: 1, semantic: 0 }
      };
      
      kgService.buildKnowledgeGraph.mockResolvedValue(mockResult);
      
      const result = await onDocumentCreated(mockDocument, { async: false });
      
      expect(result.success).toBe(true);
      expect(result.async).toBe(false);
      expect(result.result).toBeDefined();
    });
    
    test('应该在 KG 禁用时跳过构建', async () => {
      process.env.KG_ENABLED = 'false';
      jest.clearAllMocks(); // Clear previous mock calls
      
      const result = await onDocumentCreated(mockDocument);
      
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('KG disabled');
    });
    
    test('应该在已存在时跳过构建', async () => {
      prisma.cKB.findFirst.mockResolvedValue({ id: 'ckb-1' });
      
      const result = await onDocumentCreated(mockDocument, { skipIfExists: true });
      
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('Already exists');
      expect(kgService.buildKnowledgeGraph).not.toHaveBeenCalled();
    });
    
    test('应该处理构建失败', async () => {
      kgService.buildKnowledgeGraph.mockRejectedValue(new Error('Build failed'));
      
      const result = await onDocumentCreated(mockDocument, { async: false });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Build failed');
    });
  });
  
  describe('onDocumentUpdated - 文档更新钩子', () => {
    const mockDocument = {
      id: 'doc-123',
      title: '更新的文档',
      content: '这是更新后的内容',
      metadata: {
        filePath: '/path/to/test.txt'
      }
    };
    
    test('应该异步触发增量更新', async () => {
      kgService.updateKnowledgeGraph.mockResolvedValue({
        success: true,
        updated: true
      });
      
      const result = await onDocumentUpdated(mockDocument, { async: true });
      
      expect(result.success).toBe(true);
      expect(result.async).toBe(true);
      expect(result.message).toBe('KG update started in background');
    });
    
    test('应该同步触发增量更新', async () => {
      const mockResult = {
        success: true,
        updated: true
      };
      
      kgService.updateKnowledgeGraph.mockResolvedValue(mockResult);
      
      const result = await onDocumentUpdated(mockDocument, { async: false });
      
      expect(result.success).toBe(true);
      expect(result.async).toBe(false);
      expect(result.result).toEqual(mockResult);
      expect(kgService.updateKnowledgeGraph).toHaveBeenCalledWith('doc-123');
    });
    
    test('应该支持全量重建', async () => {
      kgService.deleteKnowledgeGraph.mockResolvedValue({ success: true });
      kgService.buildKnowledgeGraph.mockResolvedValue({
        success: true,
        entities: 5,
        relations: 3
      });
      
      const result = await onDocumentUpdated(mockDocument, { 
        async: false, 
        fullRebuild: true 
      });
      
      expect(result.success).toBe(true);
      expect(kgService.deleteKnowledgeGraph).toHaveBeenCalledWith('doc-123');
      expect(kgService.buildKnowledgeGraph).toHaveBeenCalledWith('doc-123');
    });
    
    test('应该在 KG 禁用时跳过更新', async () => {
      process.env.KG_ENABLED = 'false';
      
      const result = await onDocumentUpdated(mockDocument);
      
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('KG disabled');
      expect(kgService.updateKnowledgeGraph).not.toHaveBeenCalled();
    });
    
    test('应该处理更新失败', async () => {
      kgService.updateKnowledgeGraph.mockRejectedValue(new Error('Update failed'));
      
      const result = await onDocumentUpdated(mockDocument, { async: false });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });
  
  describe('onDocumentDeleted - 文档删除钩子', () => {
    const documentId = 'doc-123';
    
    test('应该异步触发知识图谱清理', async () => {
      kgService.deleteKnowledgeGraph.mockResolvedValue({
        success: true,
        deleted: true
      });
      
      const result = await onDocumentDeleted(documentId, { async: true });
      
      expect(result.success).toBe(true);
      expect(result.async).toBe(true);
      expect(result.message).toBe('KG cleanup started in background');
    });
    
    test('应该同步触发知识图谱清理', async () => {
      const mockResult = {
        success: true,
        deleted: true
      };
      
      kgService.deleteKnowledgeGraph.mockResolvedValue(mockResult);
      
      const result = await onDocumentDeleted(documentId, { async: false });
      
      expect(result.success).toBe(true);
      expect(result.async).toBe(false);
      expect(result.result).toEqual(mockResult);
      expect(kgService.deleteKnowledgeGraph).toHaveBeenCalledWith('doc-123');
    });
    
    test('应该在 KG 禁用时跳过清理', async () => {
      process.env.KG_ENABLED = 'false';
      
      const result = await onDocumentDeleted(documentId);
      
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('KG disabled');
      expect(kgService.deleteKnowledgeGraph).not.toHaveBeenCalled();
    });
    
    test('应该处理清理失败', async () => {
      kgService.deleteKnowledgeGraph.mockRejectedValue(new Error('Delete failed'));
      
      const result = await onDocumentDeleted(documentId, { async: false });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });
  
  describe('onBatchDocuments - 批量文档操作钩子', () => {
    const mockDocuments = [
      { id: 'doc-1', title: '文档1', content: '内容1', metadata: { filePath: '/path/to/doc1.txt' } },
      { id: 'doc-2', title: '文档2', content: '内容2', metadata: { filePath: '/path/to/doc2.txt' } },
      { id: 'doc-3', title: '文档3', content: '内容3', metadata: { filePath: '/path/to/doc3.txt' } }
    ];
    
    test('应该批量创建文档的知识图谱', async () => {
      kgService.buildKnowledgeGraph.mockResolvedValue({ success: true });
      
      const result = await onBatchDocuments(mockDocuments, 'create', { async: true });
      
      expect(result.success).toBe(true);
      expect(result.total).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
    });
    
    test('应该批量更新文档的知识图谱', async () => {
      kgService.updateKnowledgeGraph.mockResolvedValue({ success: true });
      
      const result = await onBatchDocuments(mockDocuments, 'update', { async: true });
      
      expect(result.success).toBe(true);
      expect(result.total).toBe(3);
      expect(result.successCount).toBe(3);
    });
    
    test('应该批量删除文档的知识图谱', async () => {
      kgService.deleteKnowledgeGraph.mockResolvedValue({ success: true });
      
      const documentIds = ['doc-1', 'doc-2', 'doc-3'];
      const result = await onBatchDocuments(documentIds, 'delete', { async: true });
      
      expect(result.success).toBe(true);
      expect(result.total).toBe(3);
      expect(result.successCount).toBe(3);
    });
    
    test('应该处理部分失败的情况', async () => {
      kgService.buildKnowledgeGraph
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ success: true });
      
      const result = await onBatchDocuments(mockDocuments, 'create', { async: false });
      
      expect(result.success).toBe(true);
      expect(result.total).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
    });
    
    test('应该在 KG 禁用时跳过批量操作', async () => {
      process.env.KG_ENABLED = 'false';
      
      const result = await onBatchDocuments(mockDocuments, 'create');
      
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('KG disabled');
      expect(kgService.buildKnowledgeGraph).not.toHaveBeenCalled();
    });
    
    test('应该处理未知操作类型', async () => {
      const result = await onBatchDocuments(mockDocuments, 'unknown', { async: false });
      
      expect(result.success).toBe(true);
      expect(result.failureCount).toBe(3);
      expect(result.results[0].error).toContain('Unknown operation');
    });
  });
  
  describe('集成场景测试', () => {
    test('应该完整处理文档生命周期', async () => {
      const document = {
        id: 'doc-lifecycle',
        title: '生命周期测试',
        content: '测试内容',
        metadata: {
          filePath: '/path/to/lifecycle.txt'
        }
      };
      
      // 1. 创建文档
      kgService.buildKnowledgeGraph.mockResolvedValue({ 
        success: true,
        entities_created: 5,
        relations_created: { builtin: 2, cooccurrence: 1, semantic: 0 }
      });
      const createResult = await onDocumentCreated(document, { async: false });
      expect(createResult.success).toBe(true);
      
      // 2. 更新文档
      kgService.updateKnowledgeGraph.mockResolvedValue({ success: true });
      const updateResult = await onDocumentUpdated(document, { async: false });
      expect(updateResult.success).toBe(true);
      
      // 3. 删除文档
      kgService.deleteKnowledgeGraph.mockResolvedValue({ success: true });
      const deleteResult = await onDocumentDeleted(document.id, { async: false });
      expect(deleteResult.success).toBe(true);
    });
    
    test('应该处理并发文档操作', async () => {
      const documents = Array.from({ length: 10 }, (_, i) => ({
        id: `doc-${i}`,
        title: `文档${i}`,
        content: `内容${i}`,
        metadata: {
          filePath: `/path/to/doc${i}.txt`
        }
      }));
      
      kgService.buildKnowledgeGraph.mockResolvedValue({ 
        success: true,
        entities_created: 5,
        relations_created: { builtin: 2, cooccurrence: 1, semantic: 0 }
      });
      
      // 并发创建
      const promises = documents.map(doc => 
        onDocumentCreated(doc, { async: true })
      );
      
      const results = await Promise.all(promises);
      
      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.async)).toBe(true);
    });
  });
});
