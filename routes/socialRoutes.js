const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../services/authService');
const { initDatabase } = require('../database/initUserDB');

let db;

function initSocialRoutes(externalDb) {
  db = externalDb || initDatabase();
  return router;
}

// 关注用户
router.post('/follow', authMiddleware, (req, res) => {
  try {
    const followerId = req.userId;
    const { followingId } = req.body;

    if (!followingId || isNaN(parseInt(followingId))) {
      return res.status(400).json({ success: false, error: '无效的用户ID' });
    }

    if (followerId === parseInt(followingId)) {
      return res.status(400).json({ success: false, error: '不能关注自己' });
    }

    db.get('SELECT id FROM users WHERE id = ?', [followingId], (err, user) => {
      if (err || !user) {
        return res.status(404).json({ success: false, error: '用户不存在' });
      }

      db.run(
        'INSERT OR IGNORE INTO user_follows (follower_id, following_id) VALUES (?, ?)',
        [followerId, followingId],
        (err) => {
          if (err) {
            console.error('关注失败:', err);
            return res.status(500).json({ success: false, error: '关注失败' });
          }
          res.json({ success: true, data: { followed: true } });
        }
      );
    });
  } catch (err) {
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 取消关注
router.delete('/follow', authMiddleware, (req, res) => {
  try {
    const followerId = req.userId;
    const { followingId } = req.body;

    if (!followingId) return res.status(400).json({ success: false, error: '无效的用户ID' });

    db.run(
      'DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?',
      [followerId, followingId],
      (err) => {
        if (err) return res.status(500).json({ success: false, error: '取消关注失败' });
        res.json({ success: true, data: { followed: false } });
      }
    );
  } catch (err) {
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 发起好友请求
router.post('/friends/request', authMiddleware, (req, res) => {
  try {
    const senderId = req.userId;
    const { receiverId, message = '' } = req.body;

    if (!receiverId || senderId === parseInt(receiverId)) {
      return res.status(400).json({ success: false, error: '无效的用户ID' });
    }

    db.get(
      'SELECT id FROM friendships WHERE (user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?)',
      [senderId, receiverId, receiverId, senderId],
      (err, friendship) => {
        if (friendship) return res.status(400).json({ success: false, error: '已经是好友了' });

        db.run(
          'INSERT INTO friend_requests (sender_id, receiver_id, message) VALUES (?, ?, ?) ON CONFLICT(sender_id, receiver_id) DO UPDATE SET status = "pending", message = excluded.message, updated_at = CURRENT_TIMESTAMP',
          [senderId, receiverId, message],
          (err) => {
            if (err) return res.status(500).json({ success: false, error: '发送请求失败' });
            res.json({ success: true });
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 接受好友请求
router.post('/friends/accept', authMiddleware, (req, res) => {
  try {
    const receiverId = req.userId;
    const { requestId } = req.body;

    db.get('SELECT sender_id FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = "pending"', [requestId, receiverId], (err, reqRecord) => {
      if (err || !reqRecord) return res.status(404).json({ success: false, error: '请求不存在' });

      db.run('UPDATE friend_requests SET status = "accepted", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [requestId], (err) => {
        if (err) return res.status(500).json({ success: false, error: '接受失败' });
        
        const user1 = Math.min(reqRecord.sender_id, receiverId);
        const user2 = Math.max(reqRecord.sender_id, receiverId);

        db.run(
          'INSERT OR IGNORE INTO friendships (user_id1, user_id2) VALUES (?, ?)',
          [user1, user2],
          (err) => {
            res.json({ success: true });
          }
        );
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 获取好友列表
router.get('/friends', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    db.all(`
      SELECT u.id, u.username, u.avatar
      FROM friendships f
      JOIN users u ON (f.user_id1 = u.id AND f.user_id2 = ?) OR (f.user_id2 = u.id AND f.user_id1 = ?)
    `, [userId, userId], (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: '获取失败' });
      res.json({ success: true, data: rows || [] });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

module.exports = { router, initSocialRoutes };