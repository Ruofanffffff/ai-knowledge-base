const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { initDatabase } = require('../database/initUserDB');
const authenClient = require('./authenClient');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET is required in production'); })() : 'your-secret-key-change-in-production');
const JWT_EXPIRES_IN = '7d';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

let db;

// --- Authen integration helpers ---

/**
 * Check if Authen mode is enabled by verifying AUTHEN_APP_ID is configured.
 */
function isAuthenEnabled() {
  return !!(process.env.AUTHEN_APP_ID && process.env.AUTHEN_APP_ID.trim());
}

/**
 * Extract Bearer token from the Authorization header.
 * Returns the token string or null if not present/invalid format.
 */
function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// Output warning at startup if Authen is not configured
if (!isAuthenEnabled()) {
  console.warn('[WARN] AUTHEN_APP_ID not configured, falling back to local auth mode');
}

function initAuthService() {
  db = initDatabase();
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function generateTokens(userId) {
  const accessToken = jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  
  const refreshToken = crypto.randomBytes(64).toString('hex');
  
  return { accessToken, refreshToken };
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

async function registerUser(userData) {
  return new Promise((resolve, reject) => {
    const { username, email, phone, password, wechat_openid } = userData;
    
    if (!username && !password) {
      return reject(new Error('用户名和密码不能为空'));
    }
    
    if (!email && !phone && !wechat_openid) {
      // 允许仅通过用户名注册（如果业务允许），或者强制要求至少一个联系方式
      // 这里修改为：如果有用户名和密码，就允许注册，email/phone 可选
      // 但为了账号安全，建议至少保留一个联系方式。
      // 如果前端没有传 email/phone，则不做强制校验，视业务需求而定。
      // 假设当前需求是允许仅用户名注册：
      // return reject(new Error('邮箱、手机号或微信OpenID至少需要提供一个'));
    }
    
    const hashedPassword = hashPassword(password);
    
    db.get(
      'SELECT id FROM users WHERE username = ? OR email = ? OR phone = ? OR wechat_openid = ?',
      [username, email, phone, wechat_openid],
      (err, row) => {
        if (err) {
          return reject(err);
        }
        
        if (row) {
          return reject(new Error('用户名、邮箱、手机号或微信已存在'));
        }
        
        db.run(
          `INSERT INTO users (username, email, phone, wechat_openid, password, role, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [username, email, phone, wechat_openid, hashedPassword, 'user', 'active'],
          function(err) {
            if (err) {
              return reject(err);
            }
            resolve({ id: this.lastID, username, email, phone });
          }
        );
      }
    );
  });
}

async function loginUser(loginData) {
  return new Promise((resolve, reject) => {
    const { username, password, email, phone, wechat_openid } = loginData;
    
    let query, params;
    
    if (wechat_openid) {
      query = 'SELECT * FROM users WHERE wechat_openid = ?';
      params = [wechat_openid];
    } else if (email) {
      query = 'SELECT * FROM users WHERE email = ?';
      params = [email];
    } else if (phone) {
      query = 'SELECT * FROM users WHERE phone = ?';
      params = [phone];
    } else if (username) {
      query = 'SELECT * FROM users WHERE username = ?';
      params = [username];
    } else {
      return reject(new Error('请提供用户名、邮箱、手机号或微信OpenID'));
    }
    
    db.get(query, params, (err, user) => {
      if (err) {
        return reject(err);
      }
      
      if (!user) {
        return reject(new Error('用户不存在'));
      }
      
      if (user.status !== 'active') {
        return reject(new Error('账号已被禁用'));
      }
      
      if (!wechat_openid && !verifyPassword(password, user.password)) {
        return reject(new Error('密码错误'));
      }
      
      const { accessToken, refreshToken } = generateTokens(user.id);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      db.run(
        `INSERT INTO user_sessions (user_id, token, refresh_token, expires_at) 
         VALUES (?, ?, ?, ?)`,
        [user.id, accessToken, refreshToken, expiresAt.toISOString()],
        (err) => {
          if (err) {
            return reject(err);
          }
          
          db.run(
            'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id],
            (err) => {
              if (err) {
                return reject(err);
              }
              
              resolve({
                user: {
                  id: user.id,
                  username: user.username,
                  email: user.email,
                  phone: user.phone,
                  role: user.role,
                  avatar: user.avatar,
                  status: user.status,
                  createdAt: user.created_at
                },
                accessToken,
                refreshToken,
                expiresAt: expiresAt
              });
            }
          );
        }
      );
    });
  });
}

async function refreshToken(refreshToken) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT s.*, u.* FROM user_sessions s JOIN users u ON s.user_id = u.id WHERE s.refresh_token = ? AND s.expires_at > CURRENT_TIMESTAMP',
      [refreshToken],
      (err, row) => {
        if (err) {
          return reject(err);
        }
        
        if (!row) {
          return reject(new Error('刷新令牌无效或已过期'));
        }
        
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(row.user_id);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        
        db.run(
          'UPDATE user_sessions SET token = ?, refresh_token = ?, expires_at = ? WHERE id = ?',
          [accessToken, newRefreshToken, expiresAt.toISOString(), row.id],
          (err) => {
            if (err) {
              return reject(err);
            }
            
            resolve({
              accessToken,
              refreshToken: newRefreshToken,
              expiresAt
            });
          }
        );
      }
    );
  });
}

async function logoutUser(accessToken) {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM user_sessions WHERE token = ?',
      [accessToken],
      (err) => {
        if (err) {
          return reject(err);
        }
        resolve({ message: '登出成功' });
      }
    );
  });
}

function legacyAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }
  
  const token = authHeader.substring(7);
  let decoded;
  
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: '认证令牌无效或已过期' });
  }
  
  if (!db) db = initDatabase();
  
  db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], (err, user) => {
    if (err) {
      console.error('Auth middleware DB error:', err);
      return res.status(500).json({ error: '服务器内部错误' });
    }
    
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    
    if (user.status !== 'active') {
      return res.status(403).json({ error: '账号已被禁用' });
    }
    
    req.userId = user.id;
    req.user = user;
    next();
  });
}

/**
 * Authen-aware auth middleware.
 * When Authen is enabled: extracts Bearer token, verifies JWT locally with
 * AUTHEN_JWT_SECRET (HS256), and injects req.user + req.userId.
 * When Authen is not enabled: falls back to legacy local auth middleware.
 */
function authMiddleware(req, res, next) {
  if (!isAuthenEnabled()) {
    return legacyAuthMiddleware(req, res, next);
  }

  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, process.env.AUTHEN_JWT_SECRET, { algorithms: ['HS256'] });

    // Inject req.user compatible with existing format (id, username, email, role)
    req.user = {
      id: decoded.sub,
      username: decoded.username || '',
      email: decoded.email || '',
      role: decoded.role || 'user',
      app_id: decoded.app_id,
    };
    req.userId = decoded.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: '认证令牌无效或已过期' });
  }
}

/**
 * Factory function that returns an Express middleware to check if the
 * authenticated user has the specified permission via Authen Gateway.
 *
 * @param {string} permissionCode - The permission code to check
 * @returns {Function} Express middleware (req, res, next)
 */
function requirePermission(permissionCode) {
  return async (req, res, next) => {
    // When Authen is not enabled, skip permission check (local dev mode)
    if (!isAuthenEnabled()) return next();
    try {
      const result = await authenClient.checkPermission(
        req.userId, permissionCode, extractBearerToken(req)
      );
      if (result.has_permission) return next();
      return res.status(403).json({ error: '权限不足' });
    } catch (err) {
      return res.status(503).json({ error: '认证服务暂时不可用' });
    }
  };
}

function adminMiddleware(req, res, next) {
  authMiddleware(req, res, (err) => {
    if (err) return;
    
    db.get(
      'SELECT role FROM users WHERE id = ?',
      [req.userId],
      (err, user) => {
        if (err) {
          return res.status(500).json({ error: '数据库错误' });
        }
        
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ error: '需要管理员权限' });
        }
        
        next();
      }
    );
  });
}

module.exports = {
  initAuthService,
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  authMiddleware,
  adminMiddleware,
  requirePermission,
  hashPassword,
  verifyPassword,
  generateTokens,
  isAuthenEnabled,
  extractBearerToken,
};