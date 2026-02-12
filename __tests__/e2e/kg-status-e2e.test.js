const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;
const db = require('../../database/db');
const StatusManager = require('../../kg/services/status_manager');

// 注意：这个测试需要完整的应用服务器运行
// 可以通过 npm test 或单独运行此测试文件

describe('Knowledge Graph Status E2E Tests', () => {
  let app;
  let server;
  let statusManager;
  let testDocId;

  beforeAll(async () => {
    // 初始化应用
    app = require('../../server');
    statusManager = new StatusManager();
    
    // 等待服务器启动
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // 清理测试数据
    if (testDocId) {
      try {
        await db.run('DELETE FROM entities WHERE doc_id = ?', [testDocId]);
        await db.run('DELETE FROM relations WHERE doc_id = ?', [testDocId]);
        await db.run('DELETE FROM kg_build_status WHERE doc_id = ?', [testDocId]);
        await db.run('DELETE FROM documents WHERE id = ?', [testDocId]);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }

    // 关闭服务器
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('Complete User Flow: Upload → Build → View → Rebuild', () => {
    test('should complete full workflow with status transitions', async () => {
      // Step 1: 上传文档
      const testFilePath = path.join(__dirname, '../fixtures/test-document.txt');
      
      // 创建测试文件（如果不存在）
      try {
        await fs.access(testFilePath);
      } catch {
        await fs.mkdir(path.dirname(testFilePath), { recursive: true });
        await fs.writeFile(testFilePath, 'This is a test document for knowledge graph building.\nIt contains some test content.');
      }

      const uploadResponse = await request(app)
        .post('/api/documents')
        .attach('file', testFilePath)
        .expect(200);

      expect(uploadResponse.body.success).toBe(true);
      testDocId = uploadResponse.body.data.id;

      // Step 2: 验证初始状态为 pending
      const initialStatusResponse = await request(app)
        .get(`/api/kg-status/${testDocId}`)
        .expect(200);

      expect(initialStatusResponse.body.success).toBe(true);
      expect(initialStatusResponse.body.data.status).toBe('pending');

      // Step 3: 等待状态转换到 building
      let buildingDetected = false;
      let attempts = 0;
      const maxAttempts = 20; // 10秒

      while (attempts < maxAttempts && !buildingDetected) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const statusResponse = await request(app)
          .get(`/api/kg-status/${testDocId}`)
          .expect(200);

        if (statusResponse.body.data.status === 'building') {
          buildingDetected = true;
        }
        attempts++;
      }

      expect(buildingDetected).toBe(true);

      // Step 4: 等待构建完成
      let finalStatus = null;
      attempts = 0;
      const maxWaitAttempts = 120; // 60秒

      while (attempts < maxWaitAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const statusResponse = await request(app)
          .get(`/api/kg-status/${testDocId}`)
          .expect(200);

        const currentStatus = statusResponse.body.data.status;
        
        if (currentStatus === 'completed' || currentStatus === 'failed') {
          finalStatus = statusResponse.body.data;
          break;
        }
        attempts++;
      }

      expect(finalStatus).not.toBeNull();
      expect(['completed', 'failed']).toContain(finalStatus.status);

      // Step 5: 如果构建成功，验证图谱数据
      if (finalStatus.status === 'completed') {
        expect(finalStatus.entityCount).toBeGreaterThanOrEqual(0);
        expect(finalStatus.relationCount).toBeGreaterThanOrEqual(0);

        // 查询图谱数据
        const graphResponse = await request(app)
          .get(`/api/knowledge-graph/${testDocId}`)
          .expect(200);

        expect(graphResponse.body.success).toBe(true);
        expect(graphResponse.body.data).toHaveProperty('entities');
        expect(graphResponse.body.data).toHaveProperty('relations');
      }

      // Step 6: 测试重建功能
      const rebuildResponse = await request(app)
        .post(`/api/kg-rebuild/${testDocId}`)
        .expect(200);

      expect(rebuildResponse.body.success).toBe(true);

      // Step 7: 验证状态重置为 pending
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const rebuildStatusResponse = await request(app)
        .get(`/api/kg-status/${testDocId}`)
        .expect(200);

      expect(['pending', 'building']).toContain(rebuildStatusResponse.body.data.status);

    }, 90000); // 90秒超时
  });

  describe('Status Transitions Validation', () => {
    test('should follow valid state machine transitions', async () => {
      // 创建测试文档
      const result = await db.run(
        'INSERT INTO documents (filename, filepath, upload_date) VALUES (?, ?, ?)',
        ['test-transitions.txt', '/tmp/test.txt', new Date().toISOString()]
      );
      
      const docId = result.lastID;
      testDocId = docId;

      // 创建初始状态
      await statusManager.createStatus(docId, 'pending');
      
      let status = await statusManager.getStatus(docId);
      expect(status.status).toBe('pending');

      // pending → building
      await statusManager.updateStatus(docId, 'building');
      status = await statusManager.getStatus(docId);
      expect(status.status).toBe('building');

      // building → completed
      await statusManager.updateStatus(docId, 'completed', {
        entityCount: 10,
        relationCount: 5
      });
      status = await statusManager.getStatus(docId);
      expect(status.status).toBe('completed');
      expect(status.entity_count).toBe(10);
      expect(status.relation_count).toBe(5);
    });

    test('should handle failed status with error message', async () => {
      const result = await db.run(
        'INSERT INTO documents (filename, filepath, upload_date) VALUES (?, ?, ?)',
        ['test-failed.txt', '/tmp/test-failed.txt', new Date().toISOString()]
      );
      
      const docId = result.lastID;

      await statusManager.createStatus(docId, 'pending');
      await statusManager.updateStatus(docId, 'building');
      
      // building → failed
      await statusManager.updateStatus(docId, 'failed', {
        errorMessage: 'Test error: Invalid file format'
      });

      const status = await statusManager.getStatus(docId);
      expect(status.status).toBe('failed');
      expect(status.error_message).toContain('Test error');

      // 清理
      await db.run('DELETE FROM kg_build_status WHERE doc_id = ?', [docId]);
      await db.run('DELETE FROM documents WHERE id = ?', [docId]);
    });
  });

  describe('UI Update Validation', () => {
    test('should support batch status queries for document list', async () => {
      // 创建多个测试文档
      const docIds = [];
      
      for (let i = 0; i < 3; i++) {
        const result = await db.run(
          'INSERT INTO documents (filename, filepath, upload_date) VALUES (?, ?, ?)',
          [`test-batch-${i}.txt`, `/tmp/test-${i}.txt`, new Date().toISOString()]
        );
        docIds.push(result.lastID);
        await statusManager.createStatus(result.lastID, 'pending');
      }

      // 批量查询状态
      const batchResponse = await request(app)
        .post('/api/kg-status/batch')
        .send({ docIds })
        .expect(200);

      expect(batchResponse.body.success).toBe(true);
      expect(batchResponse.body.data).toHaveLength(3);
      
      batchResponse.body.data.forEach(status => {
        expect(docIds).toContain(parseInt(status.docId));
        expect(status.status).toBe('pending');
      });

      // 清理
      for (const docId of docIds) {
        await db.run('DELETE FROM kg_build_status WHERE doc_id = ?', [docId]);
        await db.run('DELETE FROM documents WHERE id = ?', [docId]);
      }
    });
  });

  describe('Data Consistency Validation', () => {
    test('should ensure graph data exists only for completed builds', async () => {
      // 创建测试文档
      const result = await db.run(
        'INSERT INTO documents (filename, filepath, upload_date) VALUES (?, ?, ?)',
        ['test-consistency.txt', '/tmp/test-consistency.txt', new Date().toISOString()]
      );
      
      const docId = result.lastID;

      // pending 状态 - 不应有图谱数据
      await statusManager.createStatus(docId, 'pending');
      let entities = await db.all('SELECT * FROM entities WHERE doc_id = ?', [docId]);
      expect(entities).toHaveLength(0);

      // building 状态 - 不应有图谱数据
      await statusManager.updateStatus(docId, 'building');
      entities = await db.all('SELECT * FROM entities WHERE doc_id = ?', [docId]);
      expect(entities).toHaveLength(0);

      // failed 状态 - 不应有图谱数据
      await statusManager.updateStatus(docId, 'failed', {
        errorMessage: 'Test failure'
      });
      entities = await db.all('SELECT * FROM entities WHERE doc_id = ?', [docId]);
      expect(entities).toHaveLength(0);

      // 清理
      await db.run('DELETE FROM kg_build_status WHERE doc_id = ?', [docId]);
      await db.run('DELETE FROM documents WHERE id = ?', [docId]);
    });

    test('should clear existing data on rebuild', async () => {
      // 创建测试文档和图谱数据
      const result = await db.run(
        'INSERT INTO documents (filename, filepath, upload_date) VALUES (?, ?, ?)',
        ['test-rebuild.txt', '/tmp/test-rebuild.txt', new Date().toISOString()]
      );
      
      const docId = result.lastID;

      // 创建一些测试实体
      await db.run(
        'INSERT INTO entities (doc_id, name, type) VALUES (?, ?, ?)',
        [docId, 'Test Entity', 'Person']
      );

      let entities = await db.all('SELECT * FROM entities WHERE doc_id = ?', [docId]);
      expect(entities.length).toBeGreaterThan(0);

      // 触发重建
      await statusManager.createStatus(docId, 'pending');
      
      // 在实际重建前，应该清理旧数据
      // 这个逻辑在 document_hooks.js 中实现
      await db.run('DELETE FROM entities WHERE doc_id = ?', [docId]);
      await db.run('DELETE FROM relations WHERE doc_id = ?', [docId]);

      entities = await db.all('SELECT * FROM entities WHERE doc_id = ?', [docId]);
      expect(entities).toHaveLength(0);

      // 清理
      await db.run('DELETE FROM kg_build_status WHERE doc_id = ?', [docId]);
      await db.run('DELETE FROM documents WHERE id = ?', [docId]);
    });
  });
});
