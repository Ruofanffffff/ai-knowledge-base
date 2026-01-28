const { initDatabase } = require('../database/initUserDB');

let db;

function initStatsService() {
  db = initDatabase();
}

async function recordTokenUsage(userId, usageData) {
  return new Promise((resolve, reject) => {
    const { model_name, tokens_used, cost, api_type, request_type } = usageData;
    
    db.run(
      `INSERT INTO token_usage (user_id, model_name, tokens_used, cost, api_type, request_type) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, model_name, tokens_used, cost, api_type, request_type],
      function(err) {
        if (err) {
          return reject(err);
        }
        
        updateUserDailyStats(userId, tokens_used, cost)
          .then(() => resolve({ id: this.lastID, ...usageData }))
          .catch(reject);
      }
    );
  });
}

async function updateUserDailyStats(userId, tokensUsed, cost) {
  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0];
    
    db.get(
      'SELECT * FROM user_stats WHERE user_id = ? AND date = ?',
      [userId, today],
      (err, row) => {
        if (err) {
          return reject(err);
        }
        
        if (row) {
          db.run(
            `UPDATE user_stats 
             SET total_tokens_used = total_tokens_used + ?,
                 total_cost = total_cost + ?,
                 total_requests = total_requests + 1
             WHERE user_id = ? AND date = ?`,
            [tokensUsed, cost, userId, today],
            (err) => {
              if (err) return reject(err);
              resolve();
            }
          );
        } else {
          db.run(
            `INSERT INTO user_stats (user_id, total_tokens_used, total_cost, total_requests, date) 
             VALUES (?, ?, ?, ?, ?)`,
            [userId, tokensUsed, cost, 1, today],
            (err) => {
              if (err) return reject(err);
              resolve();
            }
          );
        }
      }
    );
  });
}

async function getUserTokenUsage(userId, startDate, endDate) {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM token_usage WHERE user_id = ?';
    let params = [userId];
    
    if (startDate && endDate) {
      query += ' AND created_at BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.all(query, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
}

async function getUserDailyStats(userId, days = 7) {
  return new Promise((resolve, reject) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    db.all(
      'SELECT * FROM user_stats WHERE user_id = ? AND date >= ? ORDER BY date DESC',
      [userId, startDateStr],
      (err, rows) => {
        if (err) {
          return reject(err);
        }
        resolve(rows);
      }
    );
  });
}

async function getUserTotalStats(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT 
         SUM(total_tokens_used) as total_tokens,
         SUM(total_cost) as total_cost,
         SUM(total_requests) as total_requests,
         COUNT(*) as active_days
       FROM user_stats 
       WHERE user_id = ?`,
      [userId],
      (err, row) => {
        if (err) {
          return reject(err);
        }
        resolve(row || { total_tokens: 0, total_cost: 0, total_requests: 0, active_days: 0 });
      }
    );
  });
}

async function getModelUsageStats(userId, modelName) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
         DATE(created_at) as date,
         SUM(tokens_used) as daily_tokens,
         SUM(cost) as daily_cost,
         COUNT(*) as request_count
       FROM token_usage 
       WHERE user_id = ? AND model_name = ? 
       GROUP BY DATE(created_at) 
       ORDER BY date DESC 
       LIMIT 30`,
      [userId, modelName],
      (err, rows) => {
        if (err) {
          return reject(err);
        }
        resolve(rows);
      }
    );
  });
}

module.exports = {
  initStatsService,
  recordTokenUsage,
  getUserTokenUsage,
  getUserDailyStats,
  getUserTotalStats,
  getModelUsageStats
};