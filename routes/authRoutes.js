const express = require('express');
const { 
  registerUser, 
  loginUser, 
  refreshToken, 
  logoutUser 
} = require('../services/authService');
const { initDatabase } = require('../database/initUserDB');

let db;

const router = express.Router();

function initAuthRoutes() {
  db = initDatabase();
  return router;
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, phone, password, wechat_openid } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: '用户名和密码不能为空' 
      });
    }
    
    if (!email && !phone && !wechat_openid) {
      return res.status(400).json({ 
        success: false, 
        error: '请至少提供手机号或邮箱' 
      });
    }
    
    const user = await registerUser({
      username,
      email,
      phone,
      password,
      wechat_openid
    });
    
    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, email, phone, password, wechat_openid } = req.body;
    
    if (!username && !email && !phone && !wechat_openid) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供用户名、邮箱、手机号或微信OpenID' 
      });
    }
    
    if (!password && !wechat_openid) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供密码或微信OpenID' 
      });
    }
    
    const result = await loginUser({
      username,
      email,
      phone,
      password,
      wechat_openid
    });
    
    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(401).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({ 
        success: false, 
        error: '刷新令牌不能为空' 
      });
    }
    
    const result = await refreshToken(refresh_token);
    
    res.json({
      success: true,
      message: '刷新成功',
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt
      }
    });
  } catch (error) {
    console.error('刷新令牌失败:', error);
    res.status(401).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({ 
        success: false, 
        error: '未提供认证令牌' 
      });
    }
    
    const accessToken = authHeader.substring(7);
    const result = await logoutUser(accessToken);
    
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('登出失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: '未提供认证令牌' 
      });
    }
    
    const accessToken = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    
    const decoded = jwt.verify(accessToken, JWT_SECRET);
    
    db.get(
      'SELECT id, username, email, phone, avatar, role, status, created_at, last_login_at FROM users WHERE id = ?',
      [decoded.userId],
      (err, user) => {
        if (err) {
          console.error('获取用户信息失败:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        if (!user) {
          return res.status(404).json({ success: false, error: '用户不存在' });
        }
        
        delete user.password;
        
        res.json({
          success: true,
          data: user
        });
      }
    );
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(401).json({ 
      success: false, 
      error: '认证令牌无效或已过期' 
    });
  }
});

module.exports = { router, initAuthRoutes };