/**
 * KG API Routes (Redesigned)
 *
 * 三个简洁的知识图谱API端点，基于新的LLM驱动Pipeline。
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../services/authService');
const kgPipelineService = require('../services/kgPipelineService');
const { pipelineStatus, prisma } = require('../services/kgPipelineService');

// 正在执行中的Pipeline状态（收到重复请求时应拒绝）
const ACTIVE_STATUSES = ['pending', 'indexing', 'extracting_entities', 'extracting_relations', 'merging', 'saving'];

/**
 * POST /api/kg/build
 * 触发文档图谱构建（异步）
 */
router.post('/build', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.body;

    if (!docId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: docId'
      });
    }

    // 检查是否有正在进行的构建
    const currentStatus = pipelineStatus.get(docId);
    if (currentStatus && ACTIVE_STATUSES.includes(currentStatus.status)) {
      return res.status(409).json({
        success: false,
        error: '该文档正在构建中，请勿重复请求',
        data: {
          docId,
          status: currentStatus.status
        }
      });
    }

    // 异步启动Pipeline（不等待完成）
    kgPipelineService.runPipeline(docId).then(() => {
      console.log(`Pipeline completed for docId: ${docId}`);
    }).catch((err) => {
      console.error(`Pipeline failed for docId: ${docId}`, err.message);
    });

    res.json({
      success: true,
      data: {
        docId,
        status: 'pending',
        message: '图谱构建已启动'
      }
    });
  } catch (error) {
    console.error('Error starting KG build:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/kg/graph
 * 获取完整图谱数据（CleanedEntity + CleanedRelation）
 */
router.get('/graph', authMiddleware, async (req, res) => {
  try {
    const entities = await prisma.cleanedEntity.findMany();
    const relations = await prisma.cleanedRelation.findMany();

    res.json({
      success: true,
      data: {
        entities: entities.map(e => ({
          id: e.id,
          name: e.cleanedName,
          description: e.description
        })),
        relations: relations.map(r => ({
          id: r.id,
          source: r.sourceEntityId,
          target: r.targetEntityId,
          name: r.cleanedName,
          description: r.description
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching graph data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/kg/status/:docId
 * 获取Pipeline构建状态
 */
router.get('/status/:docId', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    const status = kgPipelineService.getStatus(docId);

    if (!status) {
      // 没有构建记录时返回idle状态，而不是404
      return res.json({
        success: true,
        data: {
          docId,
          status: 'idle',
          entityCount: 0,
          relationCount: 0
        }
      });
    }

    res.json({
      success: true,
      data: {
        docId: status.docId,
        status: status.status,
        entityCount: status.entityCount || 0,
        relationCount: status.relationCount || 0
      }
    });
  } catch (error) {
    console.error('Error getting KG status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
