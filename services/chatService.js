const { initDatabase } = require('../database/initUserDB');
const db = initDatabase();

// Helper to run query as promise
const run = (sql, params) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const get = (sql, params) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const all = (sql, params) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

class ChatService {
  // Get all conversations for a user
  async getUserConversations(userId) {
    const sql = `
      SELECT c.id, c.type, c.updated_at,
             u.id as other_user_id, u.username as other_username, u.avatar as other_avatar,
             (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
             (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
             (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != ? AND is_read = 0) as unread_count
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id
      JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id != ?
      JOIN users u ON cp2.user_id = u.id
      WHERE cp.user_id = ?
      ORDER BY c.updated_at DESC
    `;
    return await all(sql, [userId, userId, userId]);
  }

  // Get or create a direct conversation with another user
  async getOrCreateDirectConversation(userId, otherUserId) {
    // Check if exists
    const findSql = `
      SELECT c.id 
      FROM conversations c
      JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
      JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
      WHERE c.type = 'direct' AND cp1.user_id = ? AND cp2.user_id = ?
    `;
    const existing = await get(findSql, [userId, otherUserId]);
    
    if (existing) {
      return existing.id;
    }

    // Create new
    return new Promise(async (resolve, reject) => {
      try {
        await run('BEGIN TRANSACTION');
        
        const result = await run('INSERT INTO conversations (type) VALUES (?)', ['direct']);
        const conversationId = result.lastID;
        
        await run('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [conversationId, userId]);
        await run('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [conversationId, otherUserId]);
        
        await run('COMMIT');
        resolve(conversationId);
      } catch (err) {
        await run('ROLLBACK');
        reject(err);
      }
    });
  }

  // Get messages for a conversation
  async getMessages(conversationId, limit = 50, offset = 0) {
    const sql = `
      SELECT m.*, u.username as sender_name, u.avatar as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const messages = await all(sql, [conversationId, limit, offset]);
    return messages.reverse(); // Return in chronological order
  }

  // Send a message
  async sendMessage(conversationId, senderId, content, type = 'text', metadata = null) {
    const result = await run(
      'INSERT INTO messages (conversation_id, sender_id, content, type, metadata) VALUES (?, ?, ?, ?, ?)',
      [conversationId, senderId, content, type, metadata ? JSON.stringify(metadata) : null]
    );
    
    // Update conversation timestamp
    await run('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conversationId]);
    
    // Get the full message object to return/emit
    const msg = await get(`
      SELECT m.*, u.username as sender_name, u.avatar as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `, [result.lastID]);
    
    // Asynchronously add to episodic memory if it's a text message
    if (type === 'text' && content && content.length > 5) {
      memoryService.addMemory(String(senderId), content, 'episodic', { conversationId, messageId: msg.id })
        .catch(err => console.error('[ChatService] Failed to add episodic memory:', err.message));
    }

    return msg;
  }

  // Mark messages as read
  async markAsRead(conversationId, userId) {
    // Mark all messages in this conversation not sent by me as read
    await run(`
      UPDATE messages 
      SET is_read = 1 
      WHERE conversation_id = ? AND sender_id != ? AND is_read = 0
    `, [conversationId, userId]);
  }
  
  // Get participants of a conversation (for socket emission)
  async getParticipants(conversationId) {
    const sql = `SELECT user_id FROM conversation_participants WHERE conversation_id = ?`;
    return await all(sql, [conversationId]);
  }
}

module.exports = new ChatService();
