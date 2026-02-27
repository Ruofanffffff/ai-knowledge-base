/**
 * Knowledge Growth API Routes
 *
 * 知识生长系统 API 端点
 * 需求: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../services/authService');
const { validateParentIdMiddleware } = require('../services/parentIdValidator');
const knowledgeGrowthService = require('../services/knowledgeGrowthService');
const structuralCompletion = require('../services/structuralCompletion');
const interestConstrainedGeneration = require('../services/interestConstrainedGeneration');
const themeDiscoveryEngine = require('../services/themeDiscoveryEngine');
const lifecycleService = require('../services/lifecycleService');
const digestService = require('../services/digestService');

const prisma = new PrismaClient();

/**
 * 格式化知识体为 API 响应对象
 * @param {object} body - Prisma KnowledgeBody record
 * @returns {object} formatted body object
 */
function formatBody(body) {
  return {
    id: body.id,
    themeName: body.themeName,
    themeDescription: body.themeDescription,
    confidenceScore: body.confidenceScore,
    growthPhase: body.growthPhase,
    bodyType: body.bodyType || 'topic',
    lifecycleStatus: body.lifecycleStatus || 'active',
    lastActiveAt: body.lastActiveAt || body.createdAt,
    fragmentCount: JSON.parse(body.relatedFragmentIds || '[]').length,
    childCount: (body.children || []).length,
    parentId: body.parentId || null,
    createdAt: body.createdAt,
    updatedAt: body.updatedAt,
  };
}

/**
 * 计算意图知识体的 growthPhase（当所有子知识体均为 mature 时标记为 mature）
 * @param {object} intentBody - formatted intent body with children array
 * @returns {string} adjusted growthPhase
 */
function computeIntentGrowthPhase(intentBody, children) {
  if (children.length > 0 && children.every(c => c.growthPhase === 'mature')) {
    return 'mature';
  }
  return intentBody.growthPhase;
}

/**
 * GET /bodies
 * 知识体列表，默认返回树形结构，支持 ?flat=true 返回扁平列表（向后兼容）
 * 支持按 growthPhase 和 confidenceScore 筛选，默认按 confidenceScore 降序
 *
 * Query: flat, growthPhase, minConfidence, maxConfidence
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
router.get('/bodies', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { flat, growthPhase, minConfidence, maxConfidence, includeArchived } = req.query;

    const where = { userId };

    // 默认排除已归档知识体，includeArchived=true 时返回全部
    if (includeArchived !== 'true') {
      where.lifecycleStatus = { not: 'archived' };
    }

    if (growthPhase) {
      where.growthPhase = growthPhase;
    }

    if (minConfidence !== undefined || maxConfidence !== undefined) {
      where.confidenceScore = {};
      if (minConfidence !== undefined) {
        where.confidenceScore.gte = parseFloat(minConfidence);
      }
      if (maxConfidence !== undefined) {
        where.confidenceScore.lte = parseFloat(maxConfidence);
      }
    }

    // Flat mode: backward-compatible flat list
    if (flat === 'true') {
      const bodies = await prisma.knowledgeBody.findMany({
        where,
        orderBy: { confidenceScore: 'desc' },
        include: {
          children: true,
          nodes: true,
          themeEvolutionLogs: { select: { id: true } },
        },
      });

      const result = bodies.map(body => ({
        ...formatBody(body),
        nodeCount: body.nodes.length,
        themeEvolutionCount: (body.themeEvolutionLogs || []).length,
      }));

      return res.json({ success: true, data: result });
    }

    // Tree mode (default): top level = intent bodies (with nested children) + standalone topic bodies
    const allBodies = await prisma.knowledgeBody.findMany({
      where,
      orderBy: { confidenceScore: 'desc' },
      include: {
        children: {
          orderBy: { confidenceScore: 'desc' },
          include: { children: true },
        },
      },
    });

    // Build tree: top-level = intent bodies + standalone topic bodies (parentId=null, bodyType="topic")
    const topLevel = allBodies.filter(
      body => body.bodyType === 'intent' && body.parentId === null
    );
    const standaloneTopic = allBodies.filter(
      body => body.bodyType === 'topic' && body.parentId === null
    );

    const treeData = [];

    // Add intent bodies with nested children
    for (const intentBody of topLevel) {
      const formattedChildren = (intentBody.children || []).map(child => formatBody(child));
      const formatted = formatBody(intentBody);
      formatted.growthPhase = computeIntentGrowthPhase(formatted, intentBody.children || []);
      formatted.children = formattedChildren;
      treeData.push(formatted);
    }

    // Add standalone topic bodies
    for (const topicBody of standaloneTopic) {
      treeData.push(formatBody(topicBody));
    }

    // Sort top-level nodes by confidenceScore descending
    treeData.sort((a, b) => b.confidenceScore - a.confidenceScore);

    res.json({ success: true, data: treeData });
  } catch (error) {
    console.error('Error fetching knowledge bodies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * GET /bodies/:id/evolution-history
 * 返回指定知识体的主题演化历史，按 createdAt 降序
 */
router.get('/bodies/:id/evolution-history', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const body = await prisma.knowledgeBody.findUnique({ where: { id } });

    if (!body) {
      return res.status(404).json({ success: false, error: '知识体不存在' });
    }

    if (body.userId !== userId) {
      return res.status(403).json({ success: false, error: '无权访问此知识体' });
    }

    const evolutionLogs = await prisma.themeEvolutionLog.findMany({
      where: { bodyId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        bodyId: true,
        previousThemeName: true,
        previousThemeDescription: true,
        newThemeName: true,
        newThemeDescription: true,
        driftScore: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data: evolutionLogs });
  } catch (error) {
    console.error('Error fetching evolution history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /bodies/:id
 * 知识体详情，根据 growthPhase 返回不同字段集合
 * - discovery: 基本信息（themeName, themeDescription, confidenceScore, growthPhase, fragmentCount）
 * - skeleton: 额外返回大纲（nodes）和节点状态
 * - flesh/mature: 返回完整数据包括节点内容
 */
router.get('/bodies/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const [body, themeEvolutionCount] = await Promise.all([
      prisma.knowledgeBody.findUnique({
        where: { id },
        include: { nodes: { orderBy: { sortOrder: 'asc' } } },
      }),
      prisma.themeEvolutionLog.count({ where: { bodyId: id } }),
    ]);

    if (!body) {
      return res.status(404).json({ success: false, error: '知识体不存在' });
    }

    if (body.userId !== userId) {
      return res.status(403).json({ success: false, error: '无权访问此知识体' });
    }

    const fragmentIds = JSON.parse(body.relatedFragmentIds || '[]');

    // discovery: basic info only
    if (body.growthPhase === 'discovery') {
      return res.json({
        success: true,
        data: {
          id: body.id,
          themeName: body.themeName,
          themeDescription: body.themeDescription,
          confidenceScore: body.confidenceScore,
          growthPhase: body.growthPhase,
          fragmentCount: fragmentIds.length,
          themeEvolutionCount,
          createdAt: body.createdAt,
          updatedAt: body.updatedAt,
        },
      });
    }

    // skeleton: additionally return outline nodes (without content)
    if (body.growthPhase === 'skeleton') {
      return res.json({
        success: true,
        data: {
          id: body.id,
          themeName: body.themeName,
          themeDescription: body.themeDescription,
          confidenceScore: body.confidenceScore,
          growthPhase: body.growthPhase,
          fragmentCount: fragmentIds.length,
          themeEvolutionCount,
          nodes: body.nodes.map(n => ({
            id: n.id,
            parentNodeId: n.parentNodeId,
            title: n.title,
            status: n.status,
            sortOrder: n.sortOrder,
          })),
          createdAt: body.createdAt,
          updatedAt: body.updatedAt,
        },
      });
    }

    // flesh / mature: return complete data including node content
    return res.json({
      success: true,
      data: {
        id: body.id,
        themeName: body.themeName,
        themeDescription: body.themeDescription,
        confidenceScore: body.confidenceScore,
        growthPhase: body.growthPhase,
        fragmentCount: fragmentIds.length,
        themeEvolutionCount,
        exportedDocId: body.exportedDocId,
        relatedEntityIds: JSON.parse(body.relatedEntityIds || '[]'),
        nodes: body.nodes.map(n => ({
          id: n.id,
          parentNodeId: n.parentNodeId,
          title: n.title,
          status: n.status,
          content: n.content,
          generationMode: n.generationMode,
          sortOrder: n.sortOrder,
        })),
        createdAt: body.createdAt,
        updatedAt: body.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching knowledge body detail:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /bodies/:id/outline
 * 知识体大纲 JSON
 */
router.get('/bodies/:id/outline', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const body = await prisma.knowledgeBody.findUnique({
      where: { id },
      include: { nodes: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!body) {
      return res.status(404).json({ success: false, error: '知识体不存在' });
    }

    if (body.userId !== userId) {
      return res.status(403).json({ success: false, error: '无权访问此知识体' });
    }

    // Build tree structure from flat nodes
    const nodeMap = new Map();
    const roots = [];

    for (const node of body.nodes) {
      nodeMap.set(node.id, {
        id: node.id,
        title: node.title,
        status: node.status,
        content: node.content,
        children: [],
      });
    }

    for (const node of body.nodes) {
      const treeNode = nodeMap.get(node.id);
      if (node.parentNodeId && nodeMap.has(node.parentNodeId)) {
        nodeMap.get(node.parentNodeId).children.push(treeNode);
      } else {
        roots.push(treeNode);
      }
    }

    res.json({ success: true, data: roots });
  } catch (error) {
    console.error('Error fetching knowledge body outline:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /bodies/:id/generate
 * 触发节点内容补全，接收 nodeId 和 mode 参数
 */
router.post('/bodies/:id/generate', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { nodeId, mode } = req.body;

    if (!nodeId) {
      return res.status(400).json({ success: false, error: '缺少 nodeId 参数' });
    }

    if (!mode || !['full', 'append', 'replace'].includes(mode)) {
      return res.status(400).json({ success: false, error: 'mode 参数无效，必须为 full、append 或 replace' });
    }

    // Verify body ownership
    const body = await prisma.knowledgeBody.findUnique({ where: { id } });
    if (!body) {
      return res.status(404).json({ success: false, error: '知识体不存在' });
    }
    if (body.userId !== req.userId) {
      return res.status(403).json({ success: false, error: '无权操作此知识体' });
    }

    const result = await interestConstrainedGeneration.generate({ bodyId: id, nodeId, mode });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error generating node content:', error);
    const statusCode = error.message.includes('permission') || error.message.includes('许可') ? 403
      : error.message.includes('not found') || error.message.includes('不存在') ? 404
      : error.message.includes('Invalid') || error.message.includes('无效') ? 400
      : 500;
    res.status(statusCode).json({ success: false, error: error.message });
  }
});

/**
 * POST /bodies/:id/export
 * 导出为文档
 */
router.post('/bodies/:id/export', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify body ownership
    const body = await prisma.knowledgeBody.findUnique({ where: { id } });
    if (!body) {
      return res.status(404).json({ success: false, error: '知识体不存在' });
    }
    if (body.userId !== req.userId) {
      return res.status(403).json({ success: false, error: '无权操作此知识体' });
    }

    let document;
    if (body.exportedDocId) {
      document = await knowledgeGrowthService.updateExportedDocument(id);
    } else {
      document = await knowledgeGrowthService.exportToDocument(id);
    }

    res.json({
      success: true,
      data: {
        documentId: document.id,
        title: document.title,
        isUpdate: !!body.exportedDocId,
      },
    });
  } catch (error) {
    console.error('Error exporting knowledge body:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /bodies/:id/parent
 * 设置或解除知识体的父子关系
 * 请求体: { parentId: string | null }
 * - parentId 为有效 ID 时：设置父节点（需通过验证中间件）
 * - parentId 为 null 时：解除父子关系
 *
 * Requirements: 9.1, 9.2, 9.4, 9.5, 1.7
 */
router.patch('/bodies/:id/parent', authMiddleware, validateParentIdMiddleware(), async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { parentId } = req.body;

    const body = await prisma.knowledgeBody.findUnique({ where: { id } });

    if (!body) {
      return res.status(404).json({ success: false, error: '知识体不存在' });
    }

    if (body.userId !== userId) {
      return res.status(403).json({ success: false, error: '无权操作此知识体' });
    }

    // Prevent intent bodies from being children (Req 9.1: max 2 levels)
    if (parentId !== null && body.bodyType === 'intent') {
      return res.status(400).json({
        success: false,
        error: 'intent 类型知识体不能作为子节点',
      });
    }

    // Use transaction for atomicity (Req 9.4)
    await prisma.$transaction(async (tx) => {
      await tx.knowledgeBody.update({
        where: { id },
        data: { parentId: parentId || null },
      });
    });

    // If we set a new parent, recalculate its confidence
    if (parentId) {
      const intentAggregationService = require('../services/intentAggregationService');
      await intentAggregationService.calculateIntentConfidence(parentId);
    }

    // If we removed from a previous parent, recalculate that parent's confidence
    if (body.parentId && body.parentId !== parentId) {
      const intentAggregationService = require('../services/intentAggregationService');
      await intentAggregationService.calculateIntentConfidence(body.parentId);
    }

    res.json({ success: true, data: { id, parentId: parentId || null } });
  } catch (error) {
    console.error('Error updating knowledge body parent:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /bodies/:id
 * 删除知识体。当删除 bodyType="intent" 的知识体时，将其子知识体的 parentId 设为 null（解除父子关系，不级联删除子知识体）。
 *
 * Requirements: 9.6
 */
router.delete('/bodies/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const body = await prisma.knowledgeBody.findUnique({ where: { id } });

    if (!body) {
      return res.status(404).json({ success: false, error: '知识体不存在' });
    }

    if (body.userId !== userId) {
      return res.status(403).json({ success: false, error: '无权操作此知识体' });
    }

    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // If deleting an intent body, unlink children first
      if (body.bodyType === 'intent') {
        await tx.knowledgeBody.updateMany({
          where: { parentId: id },
          data: { parentId: null },
        });
      }

      // Delete associated nodes
      await tx.knowledgeBodyNode.deleteMany({ where: { bodyId: id } });

      // Delete associated theme evolution logs
      await tx.themeEvolutionLog.deleteMany({ where: { bodyId: id } });

      // Delete the knowledge body
      await tx.knowledgeBody.delete({ where: { id } });
    });

    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error deleting knowledge body:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /fragments
 * 碎片列表，支持按 fragmentType 和时间范围筛选
 *
 * Query: fragmentType, startDate, endDate, page, limit
 */
router.get('/fragments', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { fragmentType, startDate, endDate, page = 1, limit = 20 } = req.query;

    const where = { userId };

    if (fragmentType) {
      where.fragmentType = fragmentType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [fragments, total] = await Promise.all([
      prisma.cognitiveFragment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.cognitiveFragment.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        fragments: fragments.map(f => ({
          id: f.id,
          fragmentType: f.fragmentType,
          content: f.content,
          sourceId: f.sourceId,
          sourceMeta: f.sourceMeta ? JSON.parse(f.sourceMeta) : null,
          createdAt: f.createdAt,
        })),
        total,
        page: pageNum,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error('Error fetching fragments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /discover
 * 手动触发主题发现，已有任务执行中时拒绝并返回状态
 */
router.post('/discover', authMiddleware, async (req, res) => {
  try {
    const result = await themeDiscoveryEngine.discover('manual');

    if (result.status === 'rejected') {
      return res.status(409).json({
        success: false,
        error: '主题发现任务正在执行中，请勿重复触发',
        data: {
          status: result.status,
          reason: result.reason,
        },
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error triggering theme discovery:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /lifecycle/scan
 * 手动触发生命周期扫描（衰减 + 陈旧检测 + 自动归档 + 级联归档）
 *
 * Requirements: 8.4
 */
router.post('/lifecycle/scan', authMiddleware, async (req, res) => {
  try {
    const result = await lifecycleService.runLifecycleScan(req.userId);
    res.json({ success: true, data: { staleCount: result.staleCount, archivedCount: result.archivedCount } });
  } catch (error) {
    console.error('Error running lifecycle scan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /bodies/:id/reactivate
 * 手动恢复已归档的知识体
 *
 * Requirements: 5.4
 */
router.patch('/bodies/:id/reactivate', authMiddleware, async (req, res) => {
  try {
    const body = await lifecycleService.reactivateBody(req.params.id);
    res.json({
      success: true,
      data: {
        id: body.id,
        lifecycleStatus: body.lifecycleStatus,
        lastActiveAt: body.lastActiveAt,
        confidenceScore: body.confidenceScore,
      },
    });
  } catch (error) {
    if (error.message === 'KnowledgeBody not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    console.error('Error reactivating knowledge body:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /digest
 * 生成知识摘要，通过 LLM 归纳用户所有活跃知识体
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
router.post('/digest', authMiddleware, async (req, res) => {
  try {
    const digest = await digestService.generateDigest(req.userId);
    res.json({ success: true, data: digest });
  } catch (error) {
    console.error('Error generating knowledge digest:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
