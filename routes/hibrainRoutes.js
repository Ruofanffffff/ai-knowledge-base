const express = require('express');
const router = express.Router();
const ragService = require('../services/ragService');
const memoryService = require('../services/memoryService');
const { authMiddleware } = require('../services/authService');

// Unified RAG Query Endpoint
router.post('/query', authMiddleware, async (req, res) => {
  try {
    const { query } = req.body;
    const userId = req.user.id;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await ragService.generateResponse(userId, query);
    res.json(result);
  } catch (error) {
    console.error('HiBrain Query Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add Explicit Memory Endpoint
router.post('/memory', authMiddleware, async (req, res) => {
  try {
    const { content, type } = req.body;
    const userId = req.user.id;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const memory = await memoryService.addMemory(userId, content, type || 'episodic');
    res.json(memory);
  } catch (error) {
    console.error('Add Memory Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Forget Memory Endpoint (GDPR)
router.delete('/memory/forget', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    // For now, this clears all memories. 
    // In future, can accept 'criteria' like date range or topic.
    const result = await memoryService.forgetAll(userId);
    res.json({ message: 'All memories forgotten', count: result.count });
  } catch (error) {
    console.error('Forget Memory Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
