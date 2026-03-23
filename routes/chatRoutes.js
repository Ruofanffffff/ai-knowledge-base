const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');
const { authMiddleware } = require('../services/authService');

// Middleware to ensure user is authenticated
router.use(authMiddleware);

// Get all conversations
router.get('/conversations', async (req, res) => {
  try {
    const conversations = await chatService.getUserConversations(req.userId);
    res.json({ success: true, data: conversations });
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start a conversation (or get existing)
router.post('/conversations', async (req, res) => {
  try {
    const { otherUserId } = req.body;
    if (!otherUserId) return res.status(400).json({ success: false, error: 'Other User ID required' });
    
    // Check if they are friends
    const { initDatabase } = require('../database/initUserDB');
    const db = initDatabase();
    
    const isFriend = await new Promise((resolve) => {
      db.get(
        'SELECT id FROM friendships WHERE (user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?)',
        [req.userId, otherUserId, otherUserId, req.userId],
        (err, row) => resolve(!!row)
      );
    });

    if (!isFriend) {
      return res.status(403).json({ success: false, error: '只能与好友发起私聊' });
    }

    const conversationId = await chatService.getOrCreateDirectConversation(req.userId, otherUserId);
    res.json({ success: true, data: { conversationId } });
  } catch (err) {
    console.error('Create conversation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get messages
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { limit, offset } = req.query;
    const messages = await chatService.getMessages(conversationId, limit, offset);
    res.json({ success: true, data: messages });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send message
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { content, type, metadata } = req.body;
    
    const message = await chatService.sendMessage(conversationId, req.userId, content, type, metadata);
    
    // Emit via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      const participants = await chatService.getParticipants(conversationId);
      participants.forEach(p => {
        // Emit to the user's room (using their user ID)
        io.to(`user:${p.user_id}`).emit('message', message);
      });
    }
    
    res.json({ success: true, data: message });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark as read
router.post('/conversations/:id/read', async (req, res) => {
  try {
    const conversationId = req.params.id;
    await chatService.markAsRead(conversationId, req.userId);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
