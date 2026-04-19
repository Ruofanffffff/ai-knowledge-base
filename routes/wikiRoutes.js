const express = require('express');
const { authMiddleware } = require('../services/authService');
const wikiService = require('../services/wiki/wikiService');

const router = express.Router();

router.post('/compile-source', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const {
      sourceType,
      sourceId,
      sourceUrl,
      url,
      title,
      rawContent,
      force,
    } = req.body || {};

    const result = await wikiService.compileSource({
      userId,
      sourceType,
      sourceId,
      sourceUrl: sourceUrl || url || null,
      title: title || null,
      rawContent: rawContent || null,
      force: !!force,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    const message = String(error?.message || error || 'compile_failed');
    const statusCode =
      message.includes('required') ? 400
        : message.includes('not found') ? 404
          : 500;
    res.status(statusCode).json({ success: false, error: message });
  }
});

router.get('/pages', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { limit, offset, q, type } = req.query || {};
    const pages = await wikiService.listPages(userId, { limit, offset, q, type });
    res.json({ success: true, data: pages });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error?.message || error || 'list_failed') });
  }
});

// [NEW] Get Wiki pages generated from a specific source (note, document, etc.)
router.get('/pages/by-source/:sourceId', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const pages = await wikiService.getPagesBySourceId(userId, req.params.sourceId);
    res.json({ success: true, data: pages });
  } catch (error) {
    console.error('[WikiRoutes] getPagesBySourceId error:', error);
    res.status(500).json({ success: false, error: String(error?.message || error || 'get_failed') });
  }
});

// [NEW] Get single Wiki page by slug
router.get('/pages/:slug', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const page = await wikiService.getPage(userId, req.params.slug);
    if (!page) return res.status(404).json({ success: false, error: 'not_found' });
    res.json({ success: true, data: page });
  } catch (error) {
    console.error('[WikiRoutes] getPage error:', error);
    res.status(500).json({ success: false, error: String(error?.message || error || 'get_failed') });
  }
});

router.get('/healthcheck', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const result = await wikiService.healthcheck(userId);
    const status = result.ok ? 200 : 503;
    res.status(status).json({ success: true, data: result });
  } catch (error) {
    res.status(503).json({ success: false, error: String(error?.message || error || 'healthcheck_failed') });
  }
});

router.get('/health', async (req, res) => {
  try {
    const result = await wikiService.health();
    const status = result.ok ? 200 : 503;
    res.status(status).json({ success: true, data: result });
  } catch (error) {
    res.status(503).json({ success: false, error: String(error?.message || error || 'unhealthy') });
  }
});

module.exports = router;
