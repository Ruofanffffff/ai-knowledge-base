const express = require('express');
const { adminMiddleware } = require('../services/authService');
const { initDatabase } = require('../database/initUserDB');

let db;

const router = express.Router();

function initAdminRoutes() {
  db = initDatabase();
  return router;
}

router.get('/users', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, page_size, limit = 20, search, status, role } = req.query;
    const pageSize = page_size || limit;
    const offset = (page - 1) * pageSize;
    
    let query = `
      SELECT 
        u.id, u.username, u.email, u.phone, u.role, u.status, 
        u.created_at, u.last_login_at,
        COUNT(DISTINCT d.id) as document_count,
        COALESCE(SUM(tu.tokens_used), 0) as token_usage
      FROM users u
      LEFT JOIN documents d ON u.id = d.user_id
      LEFT JOIN token_usage tu ON u.id = tu.user_id
      WHERE 1=1
    `;
    let params = [];
    
    if (search) {
      query += ' AND (u.username LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    if (status) {
      query += ' AND u.status = ?';
      params.push(status);
    }
    
    if (role) {
      query += ' AND u.role = ?';
      params.push(role);
    }
    
    query += ' GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('获取用户列表失败:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      
      db.get('SELECT COUNT(*) as total FROM users WHERE 1=1', [], (err, countRow) => {
        if (err) {
          return res.status(500).json({ success: false, error: err.message });
        }
        
        res.json({
          success: true,
          data: {
            users: rows,
            totalPages: Math.ceil(countRow.total / pageSize)
          }
        });
      });
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/users/:id', adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    
    db.get(
      'SELECT * FROM users WHERE id = ?',
      [userId],
      (err, user) => {
        if (err) {
          console.error('获取用户详情失败:', err);
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
    console.error('获取用户详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/users/:id/status', adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    const { status } = req.body;
    
    if (!status || !['active', 'disabled', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, error: '无效的状态值' });
    }
    
    db.run(
      'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, userId],
      (err) => {
        if (err) {
          console.error('更新用户状态失败:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        res.json({
          success: true,
          message: '用户状态更新成功'
        });
      }
    );
  } catch (error) {
    console.error('更新用户状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/users/:id/role', adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;
    
    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, error: '无效的角色值' });
    }
    
    db.run(
      'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [role, userId],
      (err) => {
        if (err) {
          console.error('更新用户角色失败:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        res.json({
          success: true,
          message: '用户角色更新成功'
        });
      }
    );
  } catch (error) {
    console.error('更新用户角色失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats/overview', adminMiddleware, async (req, res) => {
  try {
    db.get(
      `SELECT 
         COUNT(*) as total_users,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
         SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_users,
         SUM(CASE WHEN created_at >= date('now', '-7 days') THEN 1 ELSE 0 END) as new_users_week
       FROM users`,
      [],
      (err, userStats) => {
        if (err) {
          console.error('获取用户统计失败:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        db.get(
          `SELECT 
             SUM(total_tokens_used) as total_tokens,
             SUM(total_cost) as total_cost,
             SUM(total_requests) as total_requests
           FROM user_stats`,
          [],
          (err, tokenStats) => {
            if (err) {
              console.error('获取token统计失败:', err);
              return res.status(500).json({ success: false, error: err.message });
            }
            
            db.get(
              `SELECT COUNT(*) as total FROM documents`,
              [],
              (err, docStats) => {
                if (err) {
                  console.error('获取文档统计失败:', err);
                  return res.status(500).json({ success: false, error: err.message });
                }
                
                res.json({
                  success: true,
                  data: {
                    users: {
                      total: userStats.total_users,
                      active: userStats.active_users,
                      admin: userStats.admin_users,
                      newThisWeek: userStats.new_users_week
                    },
                    tokens: {
                      total: tokenStats.total_tokens || 0,
                      totalCost: tokenStats.total_cost || 0,
                      totalRequests: tokenStats.total_requests || 0
                    },
                    documents: {
                      total: docStats.total
                    }
                  }
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('获取系统统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats/users', adminMiddleware, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    db.all(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as new_users
       FROM users 
       WHERE created_at >= date('now', '-${days} days')
       GROUP BY DATE(created_at) 
       ORDER BY date DESC`,
      [],
      (err, rows) => {
        if (err) {
          console.error('获取用户增长统计失败:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        res.json({
          success: true,
          data: rows
        });
      }
    );
  } catch (error) {
    console.error('获取用户增长统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats/tokens', adminMiddleware, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    db.all(
      `SELECT 
         DATE(created_at) as date,
         SUM(tokens_used) as daily_tokens,
         SUM(cost) as daily_cost,
         COUNT(*) as request_count
       FROM token_usage 
       WHERE created_at >= date('now', '-${days} days')
       GROUP BY DATE(created_at) 
       ORDER BY date DESC`,
      [],
      (err, rows) => {
        if (err) {
          console.error('获取token使用统计失败:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        res.json({
          success: true,
          data: rows
        });
      }
    );
  } catch (error) {
    console.error('获取token使用统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/models', adminMiddleware, async (req, res) => {
  try {
    const LOCAL_MODELS = ['llama2:7b', 'mistral:7b', 'deepseek-r1:7b'];
    const CLOUD_MODELS = {
      'qwen-plus': {
        provider: 'aliyun',
        name: '通义千问 Plus',
        description: '阿里云大语言模型'
      },
      'qwen-max': {
        provider: 'aliyun',
        name: '通义千问 Max',
        description: '阿里云大语言模型'
      },
      'deepseek-chat': {
        provider: 'deepseek',
        name: 'DeepSeek Chat',
        description: 'DeepSeek大语言模型'
      },
      'deepseek-reasoner': {
        provider: 'deepseek',
        name: 'DeepSeek Reasoner',
        description: 'DeepSeek推理模型'
      }
    };
    
    const cloudModelsWithKeys = Object.keys(CLOUD_MODELS).filter(modelKey => {
      const apiKey = process.env[`${modelKey.split('-')[0].toUpperCase()}_API_KEY`];
      return apiKey && apiKey.length > 0;
    });
    
    res.json({
      success: true,
      data: {
        local: {
          available: LOCAL_MODELS,
          count: LOCAL_MODELS.length,
          status: 'available'
        },
        cloud: {
          models: Object.keys(CLOUD_MODELS).map(key => ({
            key: key,
            name: CLOUD_MODELS[key].name,
            provider: CLOUD_MODELS[key].provider,
            description: CLOUD_MODELS[key].description,
            configured: cloudModelsWithKeys.includes(key)
          })),
          configured_count: cloudModelsWithKeys.length,
          total_count: Object.keys(CLOUD_MODELS).length
        }
      }
    });
  } catch (error) {
    console.error('获取模型信息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/users/:id/stats', adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    
    db.get(
      `SELECT 
         COUNT(*) as document_count,
         SUM(CASE WHEN created_at >= date('now', '-7 days') THEN 1 ELSE 0 END) as new_documents_week
       FROM documents 
       WHERE user_id = ?`,
      [userId],
      (err, docStats) => {
        if (err) {
          console.error('获取用户文档统计失败:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        db.get(
          `SELECT 
             SUM(tokens_used) as total_tokens,
             SUM(cost) as total_cost,
             COUNT(*) as total_requests,
             SUM(CASE WHEN created_at >= date('now', '-7 days') THEN tokens_used ELSE 0 END) as tokens_week,
             SUM(CASE WHEN created_at >= date('now', '-30 days') THEN tokens_used ELSE 0 END) as tokens_month
           FROM token_usage 
           WHERE user_id = ?`,
          [userId],
          (err, tokenStats) => {
            if (err) {
              console.error('获取用户token统计失败:', err);
              return res.status(500).json({ success: false, error: err.message });
            }
            
            res.json({
              success: true,
              data: {
                documents: docStats,
                tokens: tokenStats
              }
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('获取用户统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { router, initAdminRoutes };