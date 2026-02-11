const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { 
  registerUser, 
  loginUser, 
  refreshToken, 
  logoutUser 
} = require('../services/authService');
const { initDatabase } = require('../database/initUserDB');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../uploads/avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB限制
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'), false);
    }
  }
});

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

router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    console.log('头像上传请求开始');
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('未提供认证令牌');
      return res.status(401).json({ 
        success: false, 
        error: '未提供认证令牌' 
      });
    }
    
    const accessToken = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    
    const decoded = jwt.verify(accessToken, JWT_SECRET);
    console.log('用户ID:', decoded.userId);
    
    if (!req.file) {
      console.log('未选择文件');
      return res.status(400).json({ 
        success: false, 
        error: '请选择要上传的图片' 
      });
    }
    
    console.log('文件信息:', req.file);
    
    // 构建头像URL
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    console.log('头像URL:', avatarUrl);
    
    // 更新数据库中的头像字段
    db.run(
      'UPDATE users SET avatar = ? WHERE id = ?',
      [avatarUrl, decoded.userId],
      function(err) {
        if (err) {
          console.error('更新头像失败:', err);
          return res.status(500).json({ success: false, error: '更新头像失败' });
        }
        
        console.log('头像更新成功');
        
        // 获取更新后的用户信息
        db.get(
          'SELECT id, username, email, phone, avatar, role, status, created_at, last_login_at FROM users WHERE id = ?',
          [decoded.userId],
          (err, user) => {
            if (err) {
              console.error('获取用户信息失败:', err);
              return res.status(500).json({ success: false, error: '获取用户信息失败' });
            }
            
            res.json({
              success: true,
              message: '头像更新成功',
              data: {
                avatar: user.avatar
              }
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('上传头像失败:', error);
    console.error('错误堆栈:', error.stack);
    res.status(401).json({ 
      success: false, 
      error: '认证令牌无效或已过期' 
    });
  }
});

module.exports = { router, initAuthRoutes };