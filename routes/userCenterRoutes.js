const express = require('express');
const { authMiddleware } = require('../services/authService');
const { 
  getUserTokenUsage, 
  getUserDailyStats, 
  getUserTotalStats,
  getModelUsageStats 
} = require('../services/statsService');
const { initDatabase } = require('../database/initUserDB');

let db;

const router = express.Router();

function initUserCenterRoutes() {
  db = initDatabase();
  return router;
}

router.get('/stats/overview', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const totalStats = await getUserTotalStats(userId);
    const dailyStats = await getUserDailyStats(userId, 7);
    
    res.json({
      success: true,
      data: {
        total: totalStats,
        daily: dailyStats
      }
    });
  } catch (error) {
    console.error('获取用户统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats/token-usage', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { start_date, end_date, model_name } = req.query;
    
    const usageData = await getUserTokenUsage(
      userId, 
      start_date, 
      end_date
    );
    
    if (model_name) {
      const modelStats = await getModelUsageStats(userId, model_name);
      res.json({
        success: true,
        data: {
          usage: usageData,
          model_stats: modelStats
        }
      });
    } else {
      res.json({
        success: true,
        data: usageData
      });
    }
  } catch (error) {
    console.error('获取token使用记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/models', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    
    db.all(
      'SELECT * FROM user_models WHERE user_id = ? ORDER BY priority DESC, created_at DESC',
      [userId],
      (err, rows) => {
        if (err) {
          console.error('获取用户模型失败:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        res.json({
          success: true,
          data: rows
        });
      }
    );
  } catch (error) {
    console.error('获取用户模型失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/models', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { model_name, model_type, api_key, endpoint, priority } = req.body;
    
    if (!model_name) {
      return res.status(400).json({ success: false, error: '模型名称不能为空' });
    }
    
    db.run(
      `INSERT INTO user_models (user_id, model_name, model_type, api_key, endpoint, priority) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, model_name, model_type || 'custom', api_key, endpoint, priority || 0],
      function(err) {
        if (err) {
          console.error('创建用户模型失败:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        res.json({
          success: true,
          data: {
            id: this.lastID,
            user_id: userId,
            model_name,
            model_type: model_type || 'custom',
            api_key,
            endpoint,
            priority: priority || 0,
            is_enabled: true
          }
        });
      }
    );
  } catch (error) {
    console.error('创建用户模型失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/models/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const modelId = req.params.id;
    const { model_name, model_type, api_key, endpoint, is_enabled, priority } = req.body;
    
    db.run(
      `UPDATE user_models 
       SET model_name = ?, model_type = ?, api_key = ?, endpoint = ?, is_enabled = ?, priority = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [model_name, model_type, api_key, endpoint, is_enabled, priority, modelId, userId],
      (err) => {
        if (err) {
          console.error('更新用户模型失败:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        res.json({
          success: true,
          message: '模型更新成功'
        });
      }
    );
  } catch (error) {
    console.error('更新用户模型失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/models/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const modelId = req.params.id;
    
    db.run(
      'DELETE FROM user_models WHERE id = ? AND user_id = ?',
      [modelId, userId],
      (err) => {
        if (err) {
          console.error('删除用户模型失败:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        res.json({
          success: true,
          message: '模型删除成功'
        });
      }
    );
  } catch (error) {
    console.error('删除用户模型失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/agents', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    
    db.all(
      'SELECT * FROM agents WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
      (err, rows) => {
        if (err) {
          console.error('获取智能体失败:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        res.json({
          success: true,
          data: rows
        });
      }
    );
  } catch (error) {
    console.error('获取智能体失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/agents', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { 
      name, 
      description, 
      system_prompt, 
      model_name, 
      temperature, 
      max_tokens, 
      is_public,
      icon 
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: '智能体名称不能为空' });
    }
    
    db.run(
      `INSERT INTO agents (user_id, name, description, system_prompt, model_name, temperature, max_tokens, is_public, icon) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, 
        name, 
        description, 
        system_prompt, 
        model_name || 'deepseek-chat', 
        temperature || 0.70, 
        max_tokens || 2000, 
        is_public || 0, 
        icon
      ],
      function(err) {
        if (err) {
          console.error('创建智能体失败:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        res.json({
          success: true,
          data: {
            id: this.lastID,
            user_id: userId,
            name,
            description,
            system_prompt,
            model_name: model_name || 'deepseek-chat',
            temperature: temperature || 0.70,
            max_tokens: max_tokens || 2000,
            is_public: is_public || 0,
            icon
          }
        });
      }
    );
  } catch (error) {
    console.error('创建智能体失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/agents/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const agentId = req.params.id;
    const { 
      name, 
      description, 
      system_prompt, 
      model_name, 
      temperature, 
      max_tokens, 
      is_public,
      icon 
    } = req.body;
    
    db.run(
      `UPDATE agents 
       SET name = ?, description = ?, system_prompt = ?, model_name = ?, temperature = ?, max_tokens = ?, is_public = ?, icon = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        name, 
        description, 
        system_prompt, 
        model_name, 
        temperature, 
        max_tokens, 
        is_public, 
        icon, 
        agentId, 
        userId
      ],
      (err) => {
        if (err) {
          console.error('更新智能体失败:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        res.json({
          success: true,
          message: '智能体更新成功'
        });
      }
    );
  } catch (error) {
    console.error('更新智能体失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/agents/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const agentId = req.params.id;
    
    db.run(
      'DELETE FROM agents WHERE id = ? AND user_id = ?',
      [agentId, userId],
      (err) => {
        if (err) {
          console.error('删除智能体失败:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        res.json({
          success: true,
          message: '智能体删除成功'
        });
      }
    );
  } catch (error) {
    console.error('删除智能体失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/agents/public', async (req, res) => {
  try {
    db.all(
      'SELECT * FROM agents WHERE is_public = 1 ORDER BY created_at DESC',
      [],
      (err, rows) => {
        if (err) {
          console.error('获取公开智能体失败:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        res.json({
          success: true,
          data: rows
        });
      }
    );
  } catch (error) {
    console.error('获取公开智能体失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { router, initUserCenterRoutes };