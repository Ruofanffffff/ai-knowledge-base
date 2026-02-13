/**
 * Documents List API Test
 * 
 * Verifies that the GET /api/documents endpoint works correctly
 * for the dual-layer graph document selector feature.
 * 
 * Validates: Requirements 5.2 (文档列表获取)
 */

const request = require('supertest');
const express = require('express');
const { initDatabase } = require('../../database/initUserDB');

// Mock auth middleware
jest.mock('../../services/authService', () => ({
  authMiddleware: (req, res, next) => {
    req.userId = 'test-user-123';
    next();
  },
  initAuthService: jest.fn(),
}));

describe('GET /api/documents - Document List for Dual-Layer Graph', () => {
  let app;
  let userDb;

  beforeAll(() => {
    // Initialize test database
    userDb = initDatabase(':memory:');
    
    // Create express app with documents route
    app = express();
    app.use(express.json());
    
    const { authMiddleware } = require('../../services/authService');
    
    // Add the documents endpoint
    app.get('/api/documents', authMiddleware, (req, res) => {
      const userId = req.userId;
      
      userDb.all(
        'SELECT * FROM documents WHERE user_id = ? ORDER BY COALESCE(last_viewed_at, updated_at, created_at) DESC',
        [userId],
        (err, rows) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to fetch documents' });
          }
          
          if (!rows || rows.length === 0) {
            return res.json({ documents: [] });
          }
          
          const documents = rows.map(row => ({
            id: row.id.toString(),
            title: row.title,
            content: row.content,
            type: row.type,
            fileType: row.file_type,
            metadata: row.metadata ? JSON.parse(row.metadata) : {},
            tags: row.tags ? JSON.parse(row.tags) : [],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lastViewedAt: row.last_viewed_at,
          }));
          
          res.json({ documents });
        }
      );
    });
  });

  afterAll((done) => {
    if (userDb) {
      userDb.close(done);
    } else {
      done();
    }
  });

  beforeEach((done) => {
    // Clear documents table before each test
    userDb.run('DELETE FROM documents', [], (err) => {
      if (err) {
        done(err);
      } else {
        done();
      }
    });
  });

  it('should return empty array when no documents exist', async () => {
    const res = await request(app)
      .get('/api/documents')
      .expect(200);

    expect(res.body).toEqual({ documents: [] });
  });

  it('should return list of documents with id and title', async () => {
    // Insert test documents
    await new Promise((resolve, reject) => {
      userDb.run(
        `INSERT INTO documents (user_id, title, content, type, file_type) 
         VALUES (?, ?, ?, ?, ?)`,
        ['test-user-123', '摄影技巧文档', '这是关于摄影的内容', 'document', '.md'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    await new Promise((resolve, reject) => {
      userDb.run(
        `INSERT INTO documents (user_id, title, content, type, file_type) 
         VALUES (?, ?, ?, ?, ?)`,
        ['test-user-123', 'React开发指南', 'React相关内容', 'document', '.md'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    const res = await request(app)
      .get('/api/documents')
      .expect(200);

    expect(res.body.documents).toHaveLength(2);
    expect(res.body.documents[0]).toHaveProperty('id');
    expect(res.body.documents[0]).toHaveProperty('title');
    expect(res.body.documents[1]).toHaveProperty('id');
    expect(res.body.documents[1]).toHaveProperty('title');
    
    // Verify titles
    const titles = res.body.documents.map(doc => doc.title);
    expect(titles).toContain('摄影技巧文档');
    expect(titles).toContain('React开发指南');
  });

  it('should only return documents for the authenticated user', async () => {
    // Insert documents for different users
    await new Promise((resolve, reject) => {
      userDb.run(
        `INSERT INTO documents (user_id, title, content, type, file_type) 
         VALUES (?, ?, ?, ?, ?)`,
        ['test-user-123', '我的文档', '内容', 'document', '.md'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    await new Promise((resolve, reject) => {
      userDb.run(
        `INSERT INTO documents (user_id, title, content, type, file_type) 
         VALUES (?, ?, ?, ?, ?)`,
        ['other-user-456', '其他用户文档', '内容', 'document', '.md'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    const res = await request(app)
      .get('/api/documents')
      .expect(200);

    expect(res.body.documents).toHaveLength(1);
    expect(res.body.documents[0].title).toBe('我的文档');
  });

  it('should return documents sorted by most recent first', async () => {
    // Insert documents with different timestamps
    const doc1Id = await new Promise((resolve, reject) => {
      userDb.run(
        `INSERT INTO documents (user_id, title, content, type, file_type, created_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['test-user-123', '旧文档', '内容', 'document', '.md', '2024-01-01T00:00:00Z'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    const doc2Id = await new Promise((resolve, reject) => {
      userDb.run(
        `INSERT INTO documents (user_id, title, content, type, file_type, created_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['test-user-123', '新文档', '内容', 'document', '.md', '2024-01-02T00:00:00Z'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    const res = await request(app)
      .get('/api/documents')
      .expect(200);

    expect(res.body.documents).toHaveLength(2);
    expect(res.body.documents[0].title).toBe('新文档');
    expect(res.body.documents[1].title).toBe('旧文档');
  });
});
