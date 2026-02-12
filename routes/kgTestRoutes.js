const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const StatusManager = require('../kg/services/status_manager');
const db = require('../database/db');

const upload = multer({ dest: 'uploads/' });
const statusManager = new StatusManager();

/**
 * POST /api/kg-test/e2e
 * 端到端测试端点 - 完整测试知识图谱构建流程
 */
router.post('/kg-test/e2e', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  const testReport = {
    success: false,
    steps: [],
    totalTime: 0,
    errors: []
  };

  let docId = null;
  let uploadedFilePath = null;

  try {
    // Step 1: 上传测试文档
    testReport.steps.push({ step: 1, name: '上传测试文档', status: 'started' });
    
    if (!req.file) {
      throw new Error('No test file provided');
    }

    uploadedFilePath = req.file.path;
    const originalName = req.file.originalname || 'test-document.txt';
    
    // 创建文档记录
    const result = await db.run(
      'INSERT INTO documents (filename, filepath, upload_date) VALUES (?, ?, ?)',
      [originalName, uploadedFilePath, new Date().toISOString()]
    );
    
    docId = result.lastID;
    testReport.steps[0].status = 'completed';
    testReport.steps[0].docId = docId;

    // Step 2: 验证初始状态为 pending
    testReport.steps.push({ step: 2, name: '验证初始状态', status: 'started' });
    
    const initialStatus = await statusManager.getStatus(docId);
    if (!initialStatus || initialStatus.status !== 'pending') {
      throw new Error(`Expected initial status 'pending', got '${initialStatus?.status}'`);
    }
    
    testReport.steps[1].status = 'completed';
    testReport.steps[1].initialStatus = initialStatus.status;

    // Step 3: 触发KG构建
    testReport.steps.push({ step: 3, name: '触发KG构建', status: 'started' });
    
    // 导入并触发文档钩子
    const documentHooks = require('../kg/hooks/document_hooks');
    const document = await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
    
    // 异步触发构建
    documentHooks.onDocumentCreated(document, { async: true });
    
    testReport.steps[2].status = 'completed';

    // Step 4: 等待并验证状态转换 (pending → building → completed/failed)
    testReport.steps.push({ step: 4, name: '验证状态转换', status: 'started' });
    
    const statusTransitions = [];
    const maxWaitTime = 60000; // 60秒超时
    const pollInterval = 500; // 每500ms检查一次
    let elapsedTime = 0;
    let finalStatus = null;

    while (elapsedTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      elapsedTime += pollInterval;

      const currentStatus = await statusManager.getStatus(docId);
      const lastTransition = statusTransitions[statusTransitions.length - 1];
      
      if (!lastTransition || lastTransition.status !== currentStatus.status) {
        statusTransitions.push({
          status: currentStatus.status,
          timestamp: Date.now() - startTime,
          errorMessage: currentStatus.error_message
        });
      }

      if (currentStatus.status === 'completed' || currentStatus.status === 'failed') {
        finalStatus = currentStatus;
        break;
      }
    }

    if (!finalStatus) {
      throw new Error('Build timeout - status did not reach terminal state');
    }

    testReport.steps[3].status = 'completed';
    testReport.steps[3].statusTransitions = statusTransitions;
    testReport.steps[3].finalStatus = finalStatus.status;

    // Step 5: 验证生成的图谱数据
    testReport.steps.push({ step: 5, name: '验证图谱数据', status: 'started' });
    
    if (finalStatus.status === 'completed') {
      // 查询实体和关系
      const entities = await db.all('SELECT * FROM entities WHERE doc_id = ?', [docId]);
      const relations = await db.all('SELECT * FROM relations WHERE doc_id = ?', [docId]);

      testReport.steps[4].status = 'completed';
      testReport.steps[4].entityCount = entities.length;
      testReport.steps[4].relationCount = relations.length;
      testReport.steps[4].hasValidData = entities.length > 0;

      // 验证数据完整性
      if (entities.length === 0) {
        testReport.steps[4].warning = 'No entities generated';
      }

      // 验证实体结构
      const sampleEntity = entities[0];
      if (sampleEntity) {
        testReport.steps[4].sampleEntity = {
          id: sampleEntity.id,
          name: sampleEntity.name,
          type: sampleEntity.type
        };
      }
    } else {
      testReport.steps[4].status = 'skipped';
      testReport.steps[4].reason = `Build failed: ${finalStatus.error_message}`;
    }

    // 测试成功
    testReport.success = finalStatus.status === 'completed';
    testReport.totalTime = Date.now() - startTime;

    res.json(testReport);

  } catch (error) {
    console.error('[E2E Test] Error:', error);
    
    testReport.success = false;
    testReport.errors.push({
      message: error.message,
      stack: error.stack
    });
    testReport.totalTime = Date.now() - startTime;

    res.status(500).json(testReport);

  } finally {
    // 清理：删除测试文档和数据
    if (docId) {
      try {
        await db.run('DELETE FROM entities WHERE doc_id = ?', [docId]);
        await db.run('DELETE FROM relations WHERE doc_id = ?', [docId]);
        await db.run('DELETE FROM kg_build_status WHERE doc_id = ?', [docId]);
        await db.run('DELETE FROM documents WHERE id = ?', [docId]);
      } catch (cleanupError) {
        console.error('[E2E Test] Cleanup error:', cleanupError);
      }
    }

    // 删除上传的文件
    if (uploadedFilePath) {
      try {
        await fs.unlink(uploadedFilePath);
      } catch (unlinkError) {
        console.error('[E2E Test] File cleanup error:', unlinkError);
      }
    }
  }
});

module.exports = router;
