const express = require('express');
const { authMiddleware } = require('../services/authService');

const router = express.Router();

router.post('/events', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const payload = req.body || {};
    const name = payload.name ? String(payload.name) : 'unknown';
    const ts = payload.ts ? String(payload.ts) : new Date().toISOString();
    const data = payload.data || {};

    console.log('[Telemetry]', { userId, name, ts, data });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

module.exports = router;
