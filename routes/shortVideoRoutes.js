const express = require('express');
const router = express.Router();

const { authMiddleware, requirePermission } = require('../services/authService');
const { normalizeUrl } = require('../services/shortVideo/shortVideoUrlService');
const shortVideoDAL = require('../services/shortVideo/shortVideoDAL');
const noteDAL = require('../services/notes/noteDAL');

router.post('/ingest', authMiddleware, requirePermission('document:write'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { url, text } = req.body || {};
    const { platform, originalUrl, normalizedUrl } = normalizeUrl(url);

    const inputText = typeof text === 'string' && text.trim() ? text.trim() : null;
    const ingestLevel = inputText ? 'L1' : 'L0';

    const existing = await shortVideoDAL.findLatestByUrl(userId, normalizedUrl);
    if (existing && ['queued', 'running', 'succeeded'].includes(existing.status)) {
      return res.status(200).json({ success: true, data: existing });
    }

    const limit = Number(process.env.SHORT_VIDEO_DAILY_LIMIT || 30);
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const used = await shortVideoDAL.countSourcesSince(userId, start);
    if (Number.isFinite(limit) && limit > 0 && used >= limit) {
      return res.status(429).json({ success: false, error: '今日短视频导入次数已达上限' });
    }

    const source = await shortVideoDAL.createSource({
      userId,
      platform,
      originalUrl,
      normalizedUrl,
      inputText,
      ingestLevel,
      status: 'queued',
      progress: { stage: 'queued' },
    });

    shortVideoDAL.upsertDigestSetting(userId, {}).catch(() => {});

    res.status(201).json({ success: true, data: source });
  } catch (e) {
    const msg = String(e?.message || e || 'Bad Request');
    const lower = msg.toLowerCase();
    if (lower.includes('short_video_sources') || lower.includes('short_video') || lower.includes('no such table') || lower.includes('does not exist')) {
      return res.status(500).json({ success: false, error: '服务器需要先执行数据库迁移：npx prisma migrate deploy' });
    }
    res.status(400).json({ success: false, error: msg });
  }
});

router.get('/sources/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const source = await shortVideoDAL.getSourceById(req.params.id);
    if (!source || source.userId !== userId) return res.status(404).json({ success: false, error: 'Not Found' });

    res.json({ success: true, data: source });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e?.message || e || 'Internal Error') });
  }
});

router.get('/sources', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const status = typeof req.query.status === 'string' && req.query.status.trim() ? req.query.status.trim() : undefined;
    const sources = await shortVideoDAL.listSourcesByUser(userId, { status, limit: 50 });
    res.json({ success: true, data: sources });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e?.message || e || 'Internal Error') });
  }
});

router.post('/sources/:id/cancel', authMiddleware, requirePermission('document:write'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const ok = await shortVideoDAL.cancelSource(req.params.id, userId);
    if (!ok) return res.status(404).json({ success: false, error: 'Not Found' });
    res.json({ success: true, data: { canceled: true } });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e?.message || e || 'Internal Error') });
  }
});

router.post('/sources/:id/retry', authMiddleware, requirePermission('document:write'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const ok = await shortVideoDAL.retrySource(req.params.id, userId);
    if (!ok) return res.status(404).json({ success: false, error: 'Not Found' });
    res.json({ success: true, data: { queued: true } });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e?.message || e || 'Internal Error') });
  }
});

router.get('/sources/:id/artifacts', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const source = await shortVideoDAL.getSourceById(req.params.id);
    if (!source || source.userId !== userId) return res.status(404).json({ success: false, error: 'Not Found' });
    const artifacts = await shortVideoDAL.listArtifacts(source.id);
    res.json({ success: true, data: { source, artifacts } });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e?.message || e || 'Internal Error') });
  }
});

router.delete('/sources/:id', authMiddleware, requirePermission('document:delete'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const existing = await shortVideoDAL.getSourceById(req.params.id);
    if (!existing || existing.userId !== userId) return res.status(404).json({ success: false, error: 'Not Found' });

    const noteIds = [existing.noteRefinedId, existing.noteQuickId].filter(Boolean);
    for (const nid of noteIds) {
      try {
        await noteDAL.deleteNote(nid, userId);
      } catch {}
    }

    await shortVideoDAL.deleteSource(existing.id, userId);
    res.json({ success: true, data: { deleted: true } });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e?.message || e || 'Internal Error') });
  }
});

router.get('/digest/settings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const setting = await shortVideoDAL.getDigestSetting(userId);
    res.json({ success: true, data: setting || { userId, enabled: true, hour: 20, minute: 0, timezone: 'Asia/Shanghai' } });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e?.message || e || 'Internal Error') });
  }
});

router.put('/digest/settings', authMiddleware, requirePermission('document:write'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { enabled, hour, minute, timezone } = req.body || {};
    const patch = {
      enabled: typeof enabled === 'boolean' ? enabled : undefined,
      hour: Number.isFinite(hour) ? hour : undefined,
      minute: Number.isFinite(minute) ? minute : undefined,
      timezone: typeof timezone === 'string' && timezone.trim() ? timezone.trim() : undefined,
    };
    const saved = await shortVideoDAL.upsertDigestSetting(userId, patch);
    res.json({ success: true, data: saved });
  } catch (e) {
    res.status(400).json({ success: false, error: String(e?.message || e || 'Bad Request') });
  }
});

router.get('/digest/today', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const digest = await shortVideoDAL.getDailyDigest(userId, date);
    res.json({ success: true, data: digest });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e?.message || e || 'Internal Error') });
  }
});

module.exports = router;
