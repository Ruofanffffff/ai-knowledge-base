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
const graphDtoService = require('../services/graphDtoService');

// 正在执行中的Pipeline状态（收到重复请求时应拒绝）
const ACTIVE_STATUSES = ['pending', 'indexing', 'extracting_four_layers', 'merging', 'saving'];

function stripHtmlToText(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTags(rawTags) {
  if (Array.isArray(rawTags)) {
    return rawTags.map(tag => String(tag).trim()).filter(Boolean);
  }
  if (typeof rawTags === 'string') {
    const text = rawTags.trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parseTags(parsed);
    } catch (_) {}
    return text.split(/[，,\s|/]+/).map(tag => tag.trim()).filter(Boolean);
  }
  return [];
}

function tokenizeText(text) {
  return String(text || '')
    .split(/[\s，,。！？；;、|/]+/)
    .map(token => token.trim())
    .filter(token => token.length >= 2 && token.length <= 12);
}

function createHeuristicGraphFromNote(note) {
  const plain = stripHtmlToText(note?.content || '');
  const tags = parseTags(note?.tags);
  const stopwords = new Set([
    '我们', '你们', '他们', '这个', '那个', '一个', '一种', '可以', '进行', '以及', '因为',
    '所以', '然后', '如果', '但是', '通过', '对于', '关于', '其中', '自己', '已经', '需要',
    '比较', '非常', '还是', '就是', '还有', '并且', '以及', 'the', 'and', 'for', 'with'
  ]);
  const tokenFreq = new Map();
  tags.forEach(tag => tokenFreq.set(tag, (tokenFreq.get(tag) || 0) + 3));
  tokenizeText(plain).forEach(token => {
    const lower = token.toLowerCase();
    if (stopwords.has(lower)) return;
    tokenFreq.set(token, (tokenFreq.get(token) || 0) + 1);
  });
  const entities = Array.from(tokenFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name], idx) => ({
      id: `${note.id}_entity_${idx + 1}`,
      name,
      description: `来自《${stripHtmlToText(note.content).slice(0, 18) || '笔记'}》`,
      noteId: note.id
    }));
  const relations = [];
  for (let i = 0; i < entities.length - 1; i++) {
    relations.push({
      id: `${note.id}_rel_${i + 1}`,
      source: entities[i].id,
      target: entities[i + 1].id,
      name: '共现',
      description: '在同一笔记中共同出现',
      noteId: note.id
    });
  }
  return {
    entities,
    relations
  };
}

async function buildNoteGraph(note) {
  const plain = stripHtmlToText(note?.content || '');
  if (!plain) {
    return createHeuristicGraphFromNote(note);
  }
  try {
    const indexText = await kgPipelineService.generateIndex(plain);
    const extracted = await kgPipelineService.extractFourLayers(indexText);
    const completed = await kgPipelineService.ensureExtractionCompleteness(indexText, extracted);
    const entities = (completed.entities || []).map((entity, idx) => ({
      id: `${note.id}_entity_${idx + 1}`,
      name: entity.name,
      description: entity.definition || '',
      noteId: note.id
    }));
    const entityIdByName = new Map(entities.map(entity => [entity.name, entity.id]));
    const relations = (completed.relations || [])
      .map((relation, idx) => ({
        id: `${note.id}_rel_${idx + 1}`,
        source: entityIdByName.get(relation.source),
        target: entityIdByName.get(relation.target),
        name: relation.name || '关联',
        description: relation.description || '',
        noteId: note.id
      }))
      .filter(relation => relation.source && relation.target);
    if (!entities.length) {
      return createHeuristicGraphFromNote(note);
    }
    return {
      entities,
      relations
    };
  } catch (error) {
    console.warn('[KG Routes] buildNoteGraph fallback:', error.message);
    return createHeuristicGraphFromNote(note);
  }
}

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

    const graph = graphDtoService.fromUnifiedPrisma({ entities, relations, principles });
    res.json({
      success: true,
      data: graph
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

    const graph = graphDtoService.fromUnifiedPrisma({ entities, relations, principles });
    res.json({
      success: true,
      data: graph
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

    const graph = graphDtoService.fromDocPrisma({ docId, entities, relations, principles });
    res.json({
      success: true,
      data: graph
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
        code: 'UNIFICATION_ALREADY_RUNNING',
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
        triggeredBy: 'manual',
        message: '统一归纳已启动'
      }
    });
  } catch (error) {
    console.error('[KG Routes] Error triggering unification:', error);
    res.status(500).json({
      success: false,
      code: 'UNIFICATION_TRIGGER_FAILED',
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
          code: 'UNIFICATION_IDLE',
          message: '尚未执行过统一归纳'
        }
      });
    }

    res.json({
      success: true,
      data: {
        status: latestLog.status,
        code: latestLog.status === 'failed' ? 'UNIFICATION_FAILED' : 'UNIFICATION_OK',
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

router.get('/note/:noteId/graph', authMiddleware, requirePermission('kg:read'), async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.id;
    const note = await prisma.note.findFirst({
      where: { id: noteId, userId },
      select: { id: true, content: true, tags: true, updatedAt: true }
    });
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }
    const graph = await buildNoteGraph(note);
    const graphDto = graphDtoService.fromNoteGraph({ noteId, entities: graph.entities, relations: graph.relations });
    return res.json({
      success: true,
      data: {
        noteId,
        entities: graph.entities,
        relations: graph.relations,
        updatedAt: note.updatedAt,
        graph: graphDto
      }
    });
  } catch (error) {
    console.error('[KG Routes] Error building note graph:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

router.get('/notes/graph', authMiddleware, requirePermission('kg:read'), async (req, res) => {
  try {
    const userId = req.user.id;
    // LLM Wiki pattern: Instead of re-deriving heuristic graphs from 100 raw notes on every query,
    // we query the persistent compiled Wiki pages to form the knowledge graph.
    const pages = await prisma.wikiPage.findMany({
      where: { userId },
      select: { id: true, slug: true, title: true, type: true, related: true }
    });

    const entities = [];
    const relations = [];
    let relationIdCounter = 1;

    const slugToId = {};
    pages.forEach(p => {
      slugToId[p.slug] = p.id;
      entities.push({
        id: p.id,
        name: p.title || p.slug,
        description: `Wiki Page: ${p.slug}`,
        entityType: p.type || 'concept',
        source: 'wiki'
      });
    });

    pages.forEach(p => {
      let related = [];
      try {
        if (typeof p.related === 'string') related = JSON.parse(p.related);
        else if (Array.isArray(p.related)) related = p.related;
      } catch(e) {}
      
      related.forEach(targetSlug => {
        if (slugToId[targetSlug]) {
          relations.push({
            id: `rel_${relationIdCounter++}`,
            source: p.id,
            target: slugToId[targetSlug],
            name: 'related_to',
            description: '',
            layer: 'how',
            source_tag: 'wiki_link'
          });
        }
      });
    });

    const graphData = graphDtoService.fromNotesAggregate({ entities, relations });
    
    res.json({
      success: true,
      data: graphData
    });
  } catch (error) {
    console.error('Error generating graph from wiki pages:', error);
    res.status(500).json({ success: false, error: 'Failed to generate graph' });
  }
});

module.exports = router;
