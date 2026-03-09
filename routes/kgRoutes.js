/**
 * KG API Routes (Redesigned)
 *
 * 三个简洁的知识图谱API端点，基于新的LLM驱动Pipeline。
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission } = require('../services/authService');
const kgPipelineService = require('../services/kgPipelineService');
const { pipelineStatus, prisma } = require('../services/kgPipelineService');
const unificationService = require('../services/unificationService');

// 正在执行中的Pipeline状态（收到重复请求时应拒绝）
const ACTIVE_STATUSES = ['pending', 'indexing', 'extracting_four_layers', 'merging', 'saving'];

/**
 * POST /api/kg/build
 * 触发文档图谱构建（异步）
 */
router.post('/build', authMiddleware, requirePermission('kg:run'), async (req, res) => {
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
      console.log(`[KG Routes] Pipeline completed for docId: ${docId}`);
    }).catch((err) => {
      console.error(`[KG Routes] Pipeline failed for docId: ${docId}`, err);
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
    console.error('[KG Routes] Error starting KG build:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/kg/graph
 * 获取完整图谱数据（兼容旧接口，返回统一图谱数据）
 */
router.get('/graph', authMiddleware, requirePermission('kg:read'), async (req, res) => {
  try {
    const entities = await prisma.unifiedEntity.findMany();
    const relations = await prisma.unifiedRelation.findMany();
    const principles = await prisma.unifiedPrinciple.findMany();

    res.json({
      success: true,
      data: {
        entities: entities.map(e => ({
          id: e.id,
          name: e.cleanedName,
          description: e.description,
          entityType: e.entityType,
          source: e.source
        })),
        relations: relations.map(r => ({
          id: r.id,
          source: r.sourceEntityId,
          target: r.targetEntityId,
          name: r.cleanedName,
          description: r.description,
          layer: r.layer,
          source_tag: r.source
        })),
        principles: principles.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          source: p.source
        }))
      }
    });
  } catch (error) {
    console.error('[KG Routes] Error fetching graph data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
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
          relationCount: 0,
          principleCount: 0
        }
      });
    }

    res.json({
      success: true,
      data: {
        docId: status.docId,
        status: status.status,
        entityCount: status.entityCount || 0,
        relationCount: status.relationCount || 0,
        principleCount: status.principleCount || 0
      }
    });
  } catch (error) {
    console.error('[KG Routes] Error getting KG status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/kg/unified/graph
 * 获取统一图谱数据（UnifiedEntity + UnifiedRelation）
 */
router.get('/unified/graph', authMiddleware, requirePermission('kg:read'), async (req, res) => {
  try {
    const entities = await prisma.unifiedEntity.findMany();
    const relations = await prisma.unifiedRelation.findMany();
    const principles = await prisma.unifiedPrinciple.findMany();

    res.json({
      success: true,
      data: {
        entities: entities.map(e => ({
          id: e.id,
          name: e.cleanedName,
          description: e.description,
          entityType: e.entityType,
          source: e.source
        })),
        relations: relations.map(r => ({
          id: r.id,
          source: r.sourceEntityId,
          target: r.targetEntityId,
          name: r.cleanedName,
          description: r.description,
          layer: r.layer,
          source_tag: r.source
        })),
        principles: principles.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          source: p.source
        }))
      }
    });
  } catch (error) {
    console.error('[KG Routes] Error fetching unified graph data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/kg/doc/:docId/graph
 * 获取指定文档的分文章图谱数据（DocEntity + DocRelation）
 */
router.get('/doc/:docId/graph', authMiddleware, requirePermission('kg:read'), async (req, res) => {
  try {
    const { docId } = req.params;

    const entities = await prisma.docEntity.findMany({
      where: { docId }
    });

    const relations = await prisma.docRelation.findMany({
      where: { docId }
    });

    const principles = await prisma.docPrinciple.findMany({
      where: { docId }
    });

    res.json({
      success: true,
      data: {
        docId,
        entities: entities.map(e => ({
          id: e.id,
          name: e.cleanedName,
          description: e.description,
          entityType: e.entityType,
          source: e.source
        })),
        relations: relations.map(r => ({
          id: r.id,
          source: r.sourceEntityId,
          target: r.targetEntityId,
          name: r.cleanedName,
          description: r.description,
          layer: r.layer,
          source_tag: r.source
        })),
        principles: principles.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          relatedEntityIds: p.relatedEntityIds,
          source: p.source
        }))
      }
    });
  } catch (error) {
    console.error('[KG Routes] Error fetching doc graph data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/kg/unified/trigger
 * 手动触发统一归纳（检查是否已在执行中）
 */
router.post('/unified/trigger', authMiddleware, requirePermission('kg:run'), async (req, res) => {
  try {
    // 检查是否有正在执行的归纳
    const latestLog = await unificationService.getLatestLog();
    if (latestLog && latestLog.status === 'running') {
      return res.status(409).json({
        success: false,
        error: '统一归纳正在执行中，请勿重复触发',
        data: {
          status: latestLog.status,
          startedAt: latestLog.startedAt
        }
      });
    }

    // 异步启动统一归纳（不等待完成）
    unificationService.runUnification('manual').then((result) => {
      console.log('[KG Routes] Manual unification completed:', result);
    }).catch((err) => {
      console.error('[KG Routes] Manual unification failed:', err);
    });

    res.json({
      success: true,
      data: {
        status: 'running',
        message: '统一归纳已启动'
      }
    });
  } catch (error) {
    console.error('[KG Routes] Error triggering unification:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/kg/unified/status
 * 获取统一归纳状态（返回最近一条 UnificationLog）
 */
router.get('/unified/status', authMiddleware, async (req, res) => {
  try {
    const latestLog = await unificationService.getLatestLog();

    if (!latestLog) {
      return res.json({
        success: true,
        data: {
          status: 'idle',
          message: '尚未执行过统一归纳'
        }
      });
    }

    res.json({
      success: true,
      data: {
        status: latestLog.status,
        entityCount: latestLog.entityCount,
        relationCount: latestLog.relationCount,
        principleCount: latestLog.principleCount || 0,
        triggeredBy: latestLog.triggeredBy,
        startedAt: latestLog.startedAt,
        completedAt: latestLog.completedAt,
        error: latestLog.error
      }
    });
  } catch (error) {
    console.error('[KG Routes] Error getting unification status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

module.exports = router;
