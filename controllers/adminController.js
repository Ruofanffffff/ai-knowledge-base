const { initDatabase } = require('../database/initUserDB');

let db;

function getDb() {
  if (!db) {
    db = initDatabase();
  }
  return db;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

exports.getStats = async (req, res) => {
  try {
    const database = getDb();
    
    // 1. Total Users & Active Users
    const userStats = await new Promise((resolve, reject) => {
      database.get(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN last_login_at >= date('now', '-30 days') THEN 1 ELSE 0 END) as active
         FROM users`,
        [],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    // 2. Total Documents & Storage (DB content size)
    const docStats = await new Promise((resolve, reject) => {
      database.get(
        `SELECT 
           COUNT(*) as count,
           COALESCE(SUM(LENGTH(content)), 0) as size
         FROM documents`,
        [],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    // 3. MinIO Storage
    let minioSize = 0;
    try {
      const minioService = require('../services/minioService');
      const objects = await minioService.listObjects();
      if (Array.isArray(objects)) {
        minioSize = objects.reduce((sum, obj) => sum + (obj.size || 0), 0);
      }
    } catch (e) {
      // ignore
    }

    const totalStorageBytes = (docStats.size || 0) + minioSize;
    const totalStorageFormatted = formatBytes(totalStorageBytes);
    const totalLimit = 10 * 1024 * 1024 * 1024; // 10GB example
    const storagePercentage = Math.min(100, (totalStorageBytes / totalLimit) * 100);

    res.json({
      success: true,
      data: {
        totalUsers: userStats.total || 0,
        totalDocuments: docStats.count || 0,
        totalStorage: totalStorageFormatted,
        storagePercentage: storagePercentage,
        activeUsersLast30Days: userStats.active || 0
      }
    });
  } catch (error) {
    console.error('Get admin stats failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getUsers = async (req, res) => {
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
    
    const database = getDb();
    database.all(query, params, (err, rows) => {
      if (err) {
        console.error('获取用户列表失败:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      
      database.get('SELECT COUNT(*) as total FROM users WHERE 1=1', [], (err, countRow) => {
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
};

exports.getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    
    const database = getDb();
    database.get(
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
};

exports.updateUserStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const { status } = req.body;
    
    if (!status || !['active', 'disabled', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, error: '无效的状态值' });
    }
    
    const database = getDb();
    database.run(
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
};

exports.updateUserRole = async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;
    
    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, error: '无效的角色值' });
    }
    
    const database = getDb();
    database.run(
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
};

exports.getUserGrowthStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const database = getDb();
    database.all(
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
};

exports.getTokenUsageStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const database = getDb();
    database.all(
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
};

exports.getModels = async (req, res) => {
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
};

exports.getUserStats = async (req, res) => {
  try {
    const userId = req.params.id;
    
    const database = getDb();
    database.get(
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
        
        database.get(
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
};
