const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const embeddingService = require('./embeddingService');

const prisma = new PrismaClient();

// Configuration for encryption
const ENCRYPTION_KEY = process.env.MEMORY_ENCRYPTION_KEY || 'default_secret_key_32_bytes_long!!'; // Must be 32 chars
const IV_LENGTH = 16; // For AES, this is always 16

class MemoryService {
  constructor() {
    // Ensure key is 32 bytes
    this.key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  }

  /**
   * Encrypt text using AES-256-CBC
   * @param {string} text 
   * @returns {string} iv:encryptedText
   */
  encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  /**
   * Decrypt text using AES-256-CBC
   * @param {string} text iv:encryptedText
   * @returns {string} decrypted text
   */
  decrypt(text) {
    try {
      const textParts = text.split(':');
      const iv = Buffer.from(textParts.shift(), 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch (error) {
      console.error('Decryption failed:', error);
      return '[Encrypted Content]';
    }
  }

  /**
   * Calculate importance score (0.0 - 1.0)
   * TODO: Implement real algorithm based on recency, frequency, and emotion
   * @param {string} content 
   * @returns {number}
   */
  calculateImportance(content) {
    // Mock logic: longer content or questions might be more important
    let score = 0.5;
    if (content.length > 50) score += 0.2;
    if (content.includes('?')) score += 0.1;
    if (content.includes('重要') || content.includes('记住')) score += 0.2;
    return Math.min(score, 1.0);
  }

  /**
   * Add a new memory
   * @param {string} userId 
   * @param {string} content 
   * @param {string} type 'working' | 'semantic' | 'episodic'
   * @param {object} metadata 
   */
  async addMemory(userId, content, type = 'episodic', metadata = {}) {
    try {
      // 1. Generate Embedding
      const embedding = await embeddingService.generateEmbedding(content);
      if (!embedding) {
        throw new Error('Failed to generate embedding');
      }

      // 2. Calculate Importance
      const importanceScore = this.calculateImportance(content);

      // 3. Encrypt Content
      const encryptedContent = this.encrypt(content);

      // 4. Save to DB
      const memory = await prisma.memory.create({
        data: {
          userId,
          type,
          content: encryptedContent,
          embedding: JSON.stringify(embedding), // SQLite stores as string
          importanceScore,
          lastAccessedAt: new Date(),
          metadata: JSON.stringify(metadata)
        }
      });

      return memory;
    } catch (error) {
      console.error('Error adding memory:', error);
      throw error;
    }
  }

  /**
   * Search memories by semantic similarity
   * @param {string} userId 
   * @param {string} query 
   * @param {number} limit 
   * @returns {Promise<Array>}
   */
  async searchMemories(userId, query, limit = 5) {
    try {
      // 1. Generate Query Embedding
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      if (!queryEmbedding) return [];

      // 2. Fetch all memories for user (SQLite limitation: no native vector search)
      // In production with pgvector, this would be a SQL query
      const memories = await prisma.memory.findMany({
        where: { userId },
        select: {
          id: true,
          content: true,
          embedding: true,
          importanceScore: true,
          createdAt: true,
          type: true
        }
      });

      // 3. Parse embeddings and format for similarity search
      const candidates = memories.map(m => ({
        id: m.id,
        embedding: JSON.parse(m.embedding),
        original: m
      }));

      // 4. Find Similar
      const results = await embeddingService.findSimilar(queryEmbedding, candidates, 0.3); // Threshold 0.3

      // 5. Decrypt and Format Results
      const topResults = results.slice(0, limit).map(r => {
        const memory = candidates.find(c => c.id === r.id).original;
        return {
          id: memory.id,
          content: this.decrypt(memory.content),
          similarity: r.similarity,
          type: memory.type,
          createdAt: memory.createdAt,
          importance: memory.importanceScore
        };
      });

      // Update lastAccessedAt for retrieved memories
      const idsToUpdate = topResults.map(r => r.id);
      if (idsToUpdate.length > 0) {
        await prisma.memory.updateMany({
          where: { id: { in: idsToUpdate } },
          data: { lastAccessedAt: new Date() }
        });
      }

      return topResults;

    } catch (error) {
      console.error('Error searching memories:', error);
      return [];
    }
  }

  /**
   * Remove memories with low importance
   * @param {number} threshold 
   */
  async pruneMemories(threshold = 0.3) {
    try {
      const result = await prisma.memory.deleteMany({
        where: {
          importanceScore: { lt: threshold }
        }
      });
      console.log(`Pruned ${result.count} memories.`);
      return result.count;
    } catch (error) {
      console.error('Error pruning memories:', error);
    }
  }

  /**
   * Forget memories for a user (GDPR)
   * @param {string} userId 
   */
  async forgetAll(userId) {
    return await prisma.memory.deleteMany({
      where: { userId }
    });
  }
}

module.exports = new MemoryService();
