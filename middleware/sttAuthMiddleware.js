const jwt = require('jsonwebtoken');

const STT_JWT_SECRET = process.env.STT_JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, STT_JWT_SECRET);
    if (decoded && decoded.typ && decoded.typ !== 'stt') {
      return res.status(401).json({ error: '认证令牌无效或已过期' });
    }
    req.stt = decoded;
    if (!req.userId && decoded && decoded.userId) req.userId = String(decoded.userId);
    return next();
  } catch (err) {
    return res.status(401).json({ error: '认证令牌无效或已过期' });
  }
}

module.exports = { authMiddleware };
