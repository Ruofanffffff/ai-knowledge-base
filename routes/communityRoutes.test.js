/**
 * Community Routes - POST /publish Unit Tests
 * 
 * Validates: Requirements 1.2, 1.3, 1.4, 1.6
 */

const express = require('express');
const request = require('supertest');

// Mock initDatabase before requiring the route
const mockDb = {
  get: jest.fn(),
  run: jest.fn(),
  all: jest.fn()
};

jest.mock('../database/initUserDB', () => ({
  initDatabase: jest.fn(() => mockDb)
}));

jest.mock('../services/authService', () => ({
  authMiddleware: (req, res, next) => {
    req.userId = 1;
    next();
  }
}));

const { router, initCommunityRoutes } = require('./communityRoutes');

// Setup express app for testing
let app;

beforeAll(() => {
  initCommunityRoutes();
  app = express();
  app.use(express.json());
  app.use('/api/community', router);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/community/publish', () => {
  describe('输入校验', () => {
    test('缺少 documentIds 时返回 400', async () => {
      const res = await request(app)
        .post('/api/community/publish')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('请提供要发布的文档ID');
    });

    test('documentIds 为空数组时返回 400', async () => {
      const res = await request(app)
        .post('/api/community/publish')
        .send({ documentIds: [] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('请提供要发布的文档ID');
    });

    test('documentIds 不是数组时返回 400', async () => {
      const res = await request(app)
        .post('/api/community/publish')
        .send({ documentIds: 'not-an-array' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('请提供要发布的文档ID');
    });
  });

  describe('成功发布', () => {
    test('发布单个文档成功', async () => {
      const doc = { id: 1, title: '测试文档', content: '这是测试内容', tags: '["tag1"]' };

      // db.get for document query
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('documents')) {
          cb(null, doc);
        } else if (sql.includes('community_posts')) {
          cb(null, null); // not yet published
        }
      });

      // db.run for insert
      mockDb.run.mockImplementation(function (sql, params, cb) {
        cb.call({ lastID: 100 }, null);
      });

      const res = await request(app)
        .post('/api/community/publish')
        .send({ documentIds: [1] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.published).toHaveLength(1);
      expect(res.body.data.published[0]).toEqual({
        id: 100,
        documentId: 1,
        title: '测试文档'
      });
      expect(res.body.data.skipped).toHaveLength(0);
    });

    test('summary 为 content 前 200 字符', async () => {
      const longContent = 'A'.repeat(500);
      const doc = { id: 1, title: '长文档', content: longContent, tags: null };

      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('documents')) {
          cb(null, doc);
        } else if (sql.includes('community_posts')) {
          cb(null, null);
        }
      });

      mockDb.run.mockImplementation(function (sql, params, cb) {
        // Verify summary is first 200 chars
        expect(params[3]).toBe(longContent.substring(0, 200));
        cb.call({ lastID: 101 }, null);
      });

      const res = await request(app)
        .post('/api/community/publish')
        .send({ documentIds: [1] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.published).toHaveLength(1);
    });
  });

  describe('跳过已发布文档', () => {
    test('已发布的文档加入 skipped 列表', async () => {
      const doc = { id: 1, title: '已发布文档', content: '内容', tags: null };

      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('documents')) {
          cb(null, doc);
        } else if (sql.includes('community_posts')) {
          cb(null, { id: 50 }); // already published
        }
      });

      const res = await request(app)
        .post('/api/community/publish')
        .send({ documentIds: [1] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.published).toHaveLength(0);
      expect(res.body.data.skipped).toHaveLength(1);
      expect(res.body.data.skipped[0]).toEqual({
        documentId: 1,
        reason: '已发布'
      });
    });
  });

  describe('文档不存在', () => {
    test('不存在的文档加入 skipped 列表', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('documents')) {
          cb(null, null); // document not found
        }
      });

      const res = await request(app)
        .post('/api/community/publish')
        .send({ documentIds: [999] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.published).toHaveLength(0);
      expect(res.body.data.skipped).toHaveLength(1);
      expect(res.body.data.skipped[0]).toEqual({
        documentId: 999,
        reason: '文档不存在'
      });
    });
  });

  describe('混合场景', () => {
    test('多个文档：部分发布、部分跳过', async () => {
      const docs = {
        1: { id: 1, title: '新文档', content: '新内容', tags: '["tag1"]' },
        2: { id: 2, title: '已发布文档', content: '旧内容', tags: null }
      };

      mockDb.get.mockImplementation((sql, params, cb) => {
        const docId = params[0];
        if (sql.includes('documents')) {
          cb(null, docs[docId] || null);
        } else if (sql.includes('community_posts')) {
          // doc 2 is already published
          cb(null, docId === 2 ? { id: 50 } : null);
        }
      });

      mockDb.run.mockImplementation(function (sql, params, cb) {
        cb.call({ lastID: 200 }, null);
      });

      const res = await request(app)
        .post('/api/community/publish')
        .send({ documentIds: [1, 2] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.published).toHaveLength(1);
      expect(res.body.data.published[0].documentId).toBe(1);
      expect(res.body.data.skipped).toHaveLength(1);
      expect(res.body.data.skipped[0].documentId).toBe(2);
    });
  });

  describe('数据库错误', () => {
    test('查询文档时数据库错误返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('documents')) {
          cb(new Error('DB error'));
        }
      });

      const res = await request(app)
        .post('/api/community/publish')
        .send({ documentIds: [1] });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });

    test('插入帖子时数据库错误返回 500', async () => {
      const doc = { id: 1, title: '文档', content: '内容', tags: null };

      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('documents')) {
          cb(null, doc);
        } else if (sql.includes('community_posts')) {
          cb(null, null);
        }
      });

      mockDb.run.mockImplementation(function (sql, params, cb) {
        cb.call(this, new Error('Insert error'));
      });

      const res = await request(app)
        .post('/api/community/publish')
        .send({ documentIds: [1] });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });
  });
});


describe('GET /api/community/posts', () => {
  const sampleRows = [
    {
      id: 1, user_id: 1, document_id: 10, title: '帖子一', summary: '摘要一',
      cover_image: null, tags: '["tag1"]', likes: 5, view_count: 100,
      status: 'published', created_at: '2024-01-02', updated_at: '2024-01-02',
      authorName: 'user1', authorAvatar: '/avatar1.png', isLiked: 1,
      isBookmarked: 0, commentCount: 3
    },
    {
      id: 2, user_id: 2, document_id: 20, title: '帖子二', summary: '摘要二',
      cover_image: null, tags: '["tag2"]', likes: 10, view_count: 200,
      status: 'published', created_at: '2024-01-01', updated_at: '2024-01-01',
      authorName: 'user2', authorAvatar: null, isLiked: 0,
      isBookmarked: 1, commentCount: 0
    }
  ];

  describe('默认查询', () => {
    test('返回分页帖子列表，默认 page=1, limit=20', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        cb(null, { total: 2 });
      });
      mockDb.all.mockImplementation((sql, params, cb) => {
        cb(null, sampleRows);
      });

      const res = await request(app).get('/api/community/posts');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.limit).toBe(20);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.posts).toHaveLength(2);
    });

    test('帖子字段正确映射为 camelCase', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        cb(null, { total: 1 });
      });
      mockDb.all.mockImplementation((sql, params, cb) => {
        cb(null, [sampleRows[0]]);
      });

      const res = await request(app).get('/api/community/posts');
      const post = res.body.data.posts[0];

      expect(post.id).toBe(1);
      expect(post.userId).toBe(1);
      expect(post.documentId).toBe(10);
      expect(post.title).toBe('帖子一');
      expect(post.summary).toBe('摘要一');
      expect(post.coverImage).toBeNull();
      expect(post.tags).toBe('["tag1"]');
      expect(post.likes).toBe(5);
      expect(post.viewCount).toBe(100);
      expect(post.authorName).toBe('user1');
      expect(post.authorAvatar).toBe('/avatar1.png');
      expect(post.isLiked).toBe(true);
    });

    test('isLiked=0 映射为 false', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        cb(null, { total: 1 });
      });
      mockDb.all.mockImplementation((sql, params, cb) => {
        cb(null, [sampleRows[1]]);
      });

      const res = await request(app).get('/api/community/posts');
      expect(res.body.data.posts[0].isLiked).toBe(false);
    });
  });

  describe('分页参数', () => {
    test('自定义 page 和 limit', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        cb(null, { total: 50 });
      });
      mockDb.all.mockImplementation((sql, params, cb) => {
        // Verify LIMIT and OFFSET params are correct
        // queryParams = [userId, ...whereParams, limit, offset]
        const limit = params[params.length - 2];
        const offset = params[params.length - 1];
        expect(limit).toBe(10);
        expect(offset).toBe(20); // (page 3 - 1) * 10
        cb(null, []);
      });

      const res = await request(app).get('/api/community/posts?page=3&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.data.page).toBe(3);
      expect(res.body.data.limit).toBe(10);
    });

    test('page 小于 1 时默认为 1', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        cb(null, { total: 0 });
      });
      mockDb.all.mockImplementation((sql, params, cb) => {
        const offset = params[params.length - 1];
        expect(offset).toBe(0);
        cb(null, []);
      });

      const res = await request(app).get('/api/community/posts?page=-1');
      expect(res.body.data.page).toBe(1);
    });
  });

  describe('排序', () => {
    test('sort=latest 按 created_at DESC 排序', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        cb(null, { total: 0 });
      });
      mockDb.all.mockImplementation((sql, params, cb) => {
        expect(sql).toContain('cp.created_at DESC');
        cb(null, []);
      });

      await request(app).get('/api/community/posts?sort=latest');
    });

    test('sort=hottest 按 likes DESC 排序', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        cb(null, { total: 0 });
      });
      mockDb.all.mockImplementation((sql, params, cb) => {
        expect(sql).toContain('cp.likes DESC');
        cb(null, []);
      });

      await request(app).get('/api/community/posts?sort=hottest');
    });

    test('无效 sort 值默认为 latest', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        cb(null, { total: 0 });
      });
      mockDb.all.mockImplementation((sql, params, cb) => {
        expect(sql).toContain('cp.created_at DESC');
        cb(null, []);
      });

      await request(app).get('/api/community/posts?sort=invalid');
    });
  });

  describe('过滤', () => {
    test('filter=mine 只返回当前用户的帖子', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        expect(sql).toContain('cp.user_id = ?');
        expect(params).toContain(1); // req.userId = 1
        cb(null, { total: 1 });
      });
      mockDb.all.mockImplementation((sql, params, cb) => {
        expect(sql).toContain('cp.user_id = ?');
        cb(null, [sampleRows[0]]);
      });

      const res = await request(app).get('/api/community/posts?filter=mine');
      expect(res.status).toBe(200);
    });
  });

  describe('搜索', () => {
    test('search 参数过滤 title 和 summary', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        expect(sql).toContain('cp.title LIKE ?');
        expect(sql).toContain('cp.summary LIKE ?');
        expect(params).toContain('%测试%');
        cb(null, { total: 0 });
      });
      mockDb.all.mockImplementation((sql, params, cb) => {
        expect(sql).toContain('cp.title LIKE ?');
        cb(null, []);
      });

      await request(app).get('/api/community/posts?search=测试');
    });
  });

  describe('组合查询', () => {
    test('filter=mine + search 同时生效', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        expect(sql).toContain('cp.user_id = ?');
        expect(sql).toContain('cp.title LIKE ?');
        cb(null, { total: 0 });
      });
      mockDb.all.mockImplementation((sql, params, cb) => {
        expect(sql).toContain('cp.user_id = ?');
        expect(sql).toContain('cp.title LIKE ?');
        cb(null, []);
      });

      await request(app).get('/api/community/posts?filter=mine&search=关键词');
    });
  });

  describe('数据库错误', () => {
    test('count 查询失败返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        cb(new Error('DB error'));
      });

      const res = await request(app).get('/api/community/posts');
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });

    test('posts 查询失败返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        cb(null, { total: 1 });
      });
      mockDb.all.mockImplementation((sql, params, cb) => {
        cb(new Error('DB error'));
      });

      const res = await request(app).get('/api/community/posts');
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });

    test('rows 为 null 时返回空数组', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        cb(null, { total: 0 });
      });
      mockDb.all.mockImplementation((sql, params, cb) => {
        cb(null, null);
      });

      const res = await request(app).get('/api/community/posts');
      expect(res.status).toBe(200);
      expect(res.body.data.posts).toEqual([]);
    });
  });

  /**
   * commentCount 字段测试
   * Validates: Requirements 3.7
   */
  describe('commentCount 字段', () => {
    test('每个帖子包含 commentCount 数值字段', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        cb(null, { total: 2 });
      });
      mockDb.all.mockImplementation((sql, params, cb) => {
        cb(null, sampleRows);
      });

      const res = await request(app).get('/api/community/posts');
      expect(res.status).toBe(200);
      const posts = res.body.data.posts;
      posts.forEach(post => {
        expect(post).toHaveProperty('commentCount');
        expect(typeof post.commentCount).toBe('number');
      });
      expect(posts[0].commentCount).toBe(3);
      expect(posts[1].commentCount).toBe(0);
    });

    test('SQL 包含 commentCount 子查询', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        cb(null, { total: 0 });
      });
      mockDb.all.mockImplementation((sql, params, cb) => {
        expect(sql).toContain('community_comments');
        expect(sql).toContain('commentCount');
        cb(null, []);
      });

      await request(app).get('/api/community/posts');
    });

    test('commentCount 为 null/undefined 时默认为 0', async () => {
      const rowWithoutCount = {
        ...sampleRows[0],
        commentCount: undefined
      };
      mockDb.get.mockImplementation((sql, params, cb) => {
        cb(null, { total: 1 });
      });
      mockDb.all.mockImplementation((sql, params, cb) => {
        cb(null, [rowWithoutCount]);
      });

      const res = await request(app).get('/api/community/posts');
      expect(res.body.data.posts[0].commentCount).toBe(0);
    });
  });
});


describe('POST /api/community/posts/:id/like', () => {
  describe('首次点赞', () => {
    test('未点赞的帖子点赞成功，返回 liked=true 和更新后的 likes', async () => {
      // 查询帖子存在
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('community_posts') && sql.includes('likes') && !sql.includes('community_likes')) {
          if (sql.includes('SELECT id, likes')) {
            cb(null, { id: 1, likes: 5 });
          } else if (sql.includes('SELECT likes FROM')) {
            cb(null, { likes: 6 });
          }
        } else if (sql.includes('community_likes')) {
          cb(null, null); // 未点赞
        }
      });

      mockDb.run.mockImplementation((sql, params, cb) => {
        cb(null);
      });

      const res = await request(app)
        .post('/api/community/posts/1/like');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.liked).toBe(true);
      expect(res.body.data.likes).toBe(6);
    });
  });

  describe('取消点赞', () => {
    test('已点赞的帖子取消点赞，返回 liked=false 和更新后的 likes', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('community_posts') && sql.includes('likes') && !sql.includes('community_likes')) {
          if (sql.includes('SELECT id, likes')) {
            cb(null, { id: 1, likes: 5 });
          } else if (sql.includes('SELECT likes FROM')) {
            cb(null, { likes: 4 });
          }
        } else if (sql.includes('community_likes')) {
          cb(null, { id: 10 }); // 已点赞
        }
      });

      mockDb.run.mockImplementation((sql, params, cb) => {
        cb(null);
      });

      const res = await request(app)
        .post('/api/community/posts/1/like');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.liked).toBe(false);
      expect(res.body.data.likes).toBe(4);
    });
  });

  describe('帖子不存在', () => {
    test('帖子不存在时返回 404', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id, likes FROM community_posts')) {
          cb(null, null); // 帖子不存在
        }
      });

      const res = await request(app)
        .post('/api/community/posts/999/like');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('帖子不存在');
    });
  });

  describe('数据库错误', () => {
    test('查询帖子时数据库错误返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id, likes FROM community_posts')) {
          cb(new Error('DB error'));
        }
      });

      const res = await request(app)
        .post('/api/community/posts/1/like');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });

    test('查询点赞记录时数据库错误返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id, likes FROM community_posts')) {
          cb(null, { id: 1, likes: 5 });
        } else if (sql.includes('community_likes')) {
          cb(new Error('DB error'));
        }
      });

      const res = await request(app)
        .post('/api/community/posts/1/like');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });

    test('插入点赞记录时数据库错误返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id, likes FROM community_posts')) {
          cb(null, { id: 1, likes: 5 });
        } else if (sql.includes('community_likes')) {
          cb(null, null); // 未点赞
        }
      });

      mockDb.run.mockImplementation((sql, params, cb) => {
        if (sql.includes('INSERT INTO community_likes')) {
          cb(new Error('Insert error'));
        }
      });

      const res = await request(app)
        .post('/api/community/posts/1/like');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });

    test('删除点赞记录时数据库错误返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id, likes FROM community_posts')) {
          cb(null, { id: 1, likes: 5 });
        } else if (sql.includes('community_likes')) {
          cb(null, { id: 10 }); // 已点赞
        }
      });

      mockDb.run.mockImplementation((sql, params, cb) => {
        if (sql.includes('DELETE FROM community_likes')) {
          cb(new Error('Delete error'));
        }
      });

      const res = await request(app)
        .post('/api/community/posts/1/like');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });
  });
});


describe('DELETE /api/community/posts/:id', () => {
  describe('成功删除', () => {
    test('帖子所有者删除帖子成功，返回 success: true', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id, user_id FROM community_posts')) {
          cb(null, { id: 1, user_id: 1 }); // userId matches req.userId (1)
        }
      });

      mockDb.run.mockImplementation((sql, params, cb) => {
        cb(null);
      });

      const res = await request(app)
        .delete('/api/community/posts/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('删除时按顺序清理 likes、bookmarks、comments 再删除帖子', async () => {
      const deletedTables = [];

      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id, user_id FROM community_posts')) {
          cb(null, { id: 1, user_id: 1 });
        }
      });

      mockDb.run.mockImplementation((sql, params, cb) => {
        if (sql.includes('DELETE FROM community_likes')) {
          deletedTables.push('community_likes');
        } else if (sql.includes('DELETE FROM community_bookmarks')) {
          deletedTables.push('community_bookmarks');
        } else if (sql.includes('DELETE FROM community_comments')) {
          deletedTables.push('community_comments');
        } else if (sql.includes('DELETE FROM community_posts')) {
          deletedTables.push('community_posts');
        }
        cb(null);
      });

      await request(app).delete('/api/community/posts/1');

      expect(deletedTables).toEqual([
        'community_likes',
        'community_bookmarks',
        'community_comments',
        'community_posts'
      ]);
    });
  });

  describe('帖子不存在', () => {
    test('帖子不存在时返回 404', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id, user_id FROM community_posts')) {
          cb(null, null);
        }
      });

      const res = await request(app)
        .delete('/api/community/posts/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('帖子不存在');
    });
  });

  describe('无权删除', () => {
    test('非帖子所有者删除时返回 403', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id, user_id FROM community_posts')) {
          cb(null, { id: 1, user_id: 999 }); // different user_id
        }
      });

      const res = await request(app)
        .delete('/api/community/posts/1');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('无权删除此帖子');
    });
  });

  describe('数据库错误', () => {
    test('查询帖子时数据库错误返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id, user_id FROM community_posts')) {
          cb(new Error('DB error'));
        }
      });

      const res = await request(app)
        .delete('/api/community/posts/1');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });

    test('删除点赞记录时数据库错误返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id, user_id FROM community_posts')) {
          cb(null, { id: 1, user_id: 1 });
        }
      });

      mockDb.run.mockImplementation((sql, params, cb) => {
        if (sql.includes('DELETE FROM community_likes')) {
          cb(new Error('Delete likes error'));
        }
      });

      const res = await request(app)
        .delete('/api/community/posts/1');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });

    test('删除收藏记录时数据库错误返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id, user_id FROM community_posts')) {
          cb(null, { id: 1, user_id: 1 });
        }
      });

      mockDb.run.mockImplementation((sql, params, cb) => {
        if (sql.includes('DELETE FROM community_likes')) {
          cb(null);
        } else if (sql.includes('DELETE FROM community_bookmarks')) {
          cb(new Error('Delete bookmarks error'));
        }
      });

      const res = await request(app)
        .delete('/api/community/posts/1');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });

    test('删除评论记录时数据库错误返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id, user_id FROM community_posts')) {
          cb(null, { id: 1, user_id: 1 });
        }
      });

      mockDb.run.mockImplementation((sql, params, cb) => {
        if (sql.includes('DELETE FROM community_likes')) {
          cb(null);
        } else if (sql.includes('DELETE FROM community_bookmarks')) {
          cb(null);
        } else if (sql.includes('DELETE FROM community_comments')) {
          cb(new Error('Delete comments error'));
        }
      });

      const res = await request(app)
        .delete('/api/community/posts/1');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });

    test('删除帖子时数据库错误返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id, user_id FROM community_posts')) {
          cb(null, { id: 1, user_id: 1 });
        }
      });

      mockDb.run.mockImplementation((sql, params, cb) => {
        if (sql.includes('DELETE FROM community_likes')) {
          cb(null);
        } else if (sql.includes('DELETE FROM community_bookmarks')) {
          cb(null);
        } else if (sql.includes('DELETE FROM community_comments')) {
          cb(null);
        } else if (sql.includes('DELETE FROM community_posts')) {
          cb(new Error('Delete post error'));
        }
      });

      const res = await request(app)
        .delete('/api/community/posts/1');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });
  });
});


/**
 * POST /api/community/posts/:id/comments - 发表评论
 *
 * Validates: Requirements 3.2, 3.3, 3.4
 */
describe('POST /api/community/posts/:id/comments', () => {
  describe('成功发表评论', () => {
    test('提交非空评论内容，返回新评论含作者信息', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id FROM community_posts')) {
          cb(null, { id: 1 });
        } else if (sql.includes('community_comments cc')) {
          cb(null, {
            id: 10,
            post_id: 1,
            user_id: 1,
            content: '好文章',
            created_at: '2024-01-01 12:00:00',
            authorName: 'testuser',
            authorAvatar: '/avatar.png'
          });
        }
      });

      mockDb.run.mockImplementation(function (sql, params, cb) {
        cb.call({ lastID: 10 }, null);
      });

      const res = await request(app)
        .post('/api/community/posts/1/comments')
        .send({ content: '好文章' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        id: 10,
        postId: 1,
        userId: 1,
        content: '好文章',
        createdAt: '2024-01-01 12:00:00',
        authorName: 'testuser',
        authorAvatar: '/avatar.png'
      });
    });

    test('content 前后有空格时 trim 后存储', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id FROM community_posts')) {
          cb(null, { id: 1 });
        } else if (sql.includes('community_comments cc')) {
          cb(null, {
            id: 11,
            post_id: 1,
            user_id: 1,
            content: '有空格的评论',
            created_at: '2024-01-01 12:00:00',
            authorName: 'testuser',
            authorAvatar: null
          });
        }
      });

      let insertedContent;
      mockDb.run.mockImplementation(function (sql, params, cb) {
        if (sql.includes('INSERT INTO community_comments')) {
          insertedContent = params[2];
        }
        cb.call({ lastID: 11 }, null);
      });

      const res = await request(app)
        .post('/api/community/posts/1/comments')
        .send({ content: '  有空格的评论  ' });

      expect(res.status).toBe(200);
      expect(insertedContent).toBe('有空格的评论');
    });
  });

  describe('空白评论拒绝 (Req 3.3)', () => {
    test('空字符串返回 400', async () => {
      const res = await request(app)
        .post('/api/community/posts/1/comments')
        .send({ content: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('评论内容不能为空');
    });

    test('纯空格字符串返回 400', async () => {
      const res = await request(app)
        .post('/api/community/posts/1/comments')
        .send({ content: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('评论内容不能为空');
    });

    test('未提供 content 字段返回 400', async () => {
      const res = await request(app)
        .post('/api/community/posts/1/comments')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('评论内容不能为空');
    });
  });

  describe('帖子不存在 (Req 3.4)', () => {
    test('帖子不存在时返回 404', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id FROM community_posts')) {
          cb(null, null);
        }
      });

      const res = await request(app)
        .post('/api/community/posts/999/comments')
        .send({ content: '评论内容' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('帖子不存在');
    });
  });

  describe('无效帖子 ID', () => {
    test('非数字帖子 ID 返回 400', async () => {
      const res = await request(app)
        .post('/api/community/posts/abc/comments')
        .send({ content: '评论内容' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('无效的帖子ID');
    });
  });

  describe('数据库错误', () => {
    test('查询帖子时数据库错误返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id FROM community_posts')) {
          cb(new Error('DB error'));
        }
      });

      const res = await request(app)
        .post('/api/community/posts/1/comments')
        .send({ content: '评论内容' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });

    test('插入评论时数据库错误返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id FROM community_posts')) {
          cb(null, { id: 1 });
        }
      });

      mockDb.run.mockImplementation(function (sql, params, cb) {
        cb.call(this, new Error('Insert error'));
      });

      const res = await request(app)
        .post('/api/community/posts/1/comments')
        .send({ content: '评论内容' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });

    test('查询新评论时数据库错误返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id FROM community_posts')) {
          cb(null, { id: 1 });
        } else if (sql.includes('community_comments cc')) {
          cb(new Error('Query error'));
        }
      });

      mockDb.run.mockImplementation(function (sql, params, cb) {
        cb.call({ lastID: 10 }, null);
      });

      const res = await request(app)
        .post('/api/community/posts/1/comments')
        .send({ content: '评论内容' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });
  });
});

/**
 * GET /api/community/posts/:id/comments - 获取评论列表
 *
 * Validates: Requirements 3.5
 */
describe('GET /api/community/posts/:id/comments', () => {
  describe('成功获取评论列表', () => {
    test('返回按 created_at DESC 排序的评论列表和 total', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id FROM community_posts')) {
          cb(null, { id: 1 });
        }
      });

      const rows = [
        {
          id: 3, post_id: 1, user_id: 2, content: '最新评论',
          created_at: '2024-01-03T00:00:00Z', authorName: '用户B', authorAvatar: 'avatar2.png'
        },
        {
          id: 2, post_id: 1, user_id: 1, content: '第二条评论',
          created_at: '2024-01-02T00:00:00Z', authorName: '用户A', authorAvatar: 'avatar1.png'
        },
        {
          id: 1, post_id: 1, user_id: 1, content: '第一条评论',
          created_at: '2024-01-01T00:00:00Z', authorName: '用户A', authorAvatar: 'avatar1.png'
        }
      ];

      mockDb.all.mockImplementation((sql, params, cb) => {
        cb(null, rows);
      });

      const res = await request(app)
        .get('/api/community/posts/1/comments');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.comments).toHaveLength(3);
      expect(res.body.data.comments[0]).toEqual({
        id: 3,
        postId: 1,
        userId: 2,
        content: '最新评论',
        createdAt: '2024-01-03T00:00:00Z',
        authorName: '用户B',
        authorAvatar: 'avatar2.png'
      });
    });

    test('帖子无评论时返回空数组和 total 为 0', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id FROM community_posts')) {
          cb(null, { id: 1 });
        }
      });

      mockDb.all.mockImplementation((sql, params, cb) => {
        cb(null, []);
      });

      const res = await request(app)
        .get('/api/community/posts/1/comments');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.comments).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });
  });

  describe('错误处理', () => {
    test('帖子不存在返回 404', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id FROM community_posts')) {
          cb(null, null);
        }
      });

      const res = await request(app)
        .get('/api/community/posts/999/comments');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('帖子不存在');
    });

    test('非数字帖子 ID 返回 400', async () => {
      const res = await request(app)
        .get('/api/community/posts/abc/comments');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('无效的帖子ID');
    });

    test('查询帖子数据库错误返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id FROM community_posts')) {
          cb(new Error('DB error'));
        }
      });

      const res = await request(app)
        .get('/api/community/posts/1/comments');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });

    test('查询评论列表数据库错误返回 500', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (sql.includes('SELECT id FROM community_posts')) {
          cb(null, { id: 1 });
        }
      });

      mockDb.all.mockImplementation((sql, params, cb) => {
        cb(new Error('Query error'));
      });

      const res = await request(app)
        .get('/api/community/posts/1/comments');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('服务器内部错误');
    });
  });
});

/**
 * GET /api/community/posts/:id - 帖子详情 commentCount
 *
 * Validates: Requirements 3.6
 */
describe('GET /api/community/posts/:id - commentCount', () => {
  const baseRow = {
    id: 1,
    user_id: 1,
    document_id: 10,
    title: '测试帖子',
    summary: '摘要',
    tags: 'tag1',
    likes: 0,
    view_count: 0,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    authorName: 'testuser',
    authorAvatar: null,
    isLiked: 0,
    isBookmarked: 0,
  };

  test('帖子有评论时返回正确的 commentCount', async () => {
    // db.get for post detail query
    mockDb.get.mockImplementation((sql, params, cb) => {
      if (sql.includes('community_posts')) {
        cb(null, { ...baseRow, commentCount: 5 });
      } else if (sql.includes('documents')) {
        cb(null, null);
      } else {
        cb(null, null);
      }
    });

    const res = await request(app)
      .get('/api/community/posts/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.commentCount).toBe(5);
  });

  test('帖子无评论时 commentCount 为 0', async () => {
    mockDb.get.mockImplementation((sql, params, cb) => {
      if (sql.includes('community_posts')) {
        cb(null, { ...baseRow, commentCount: 0 });
      } else if (sql.includes('documents')) {
        cb(null, null);
      } else {
        cb(null, null);
      }
    });

    const res = await request(app)
      .get('/api/community/posts/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.commentCount).toBe(0);
  });

  test('commentCount 为 null/undefined 时默认返回 0', async () => {
    mockDb.get.mockImplementation((sql, params, cb) => {
      if (sql.includes('community_posts')) {
        // Simulate row without commentCount field
        cb(null, { ...baseRow });
      } else if (sql.includes('documents')) {
        cb(null, null);
      } else {
        cb(null, null);
      }
    });

    const res = await request(app)
      .get('/api/community/posts/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.commentCount).toBe(0);
  });

  test('响应同时包含 isBookmarked、contentImages 和 commentCount', async () => {
    mockDb.get.mockImplementation((sql, params, cb) => {
      if (sql.includes('community_posts')) {
        cb(null, { ...baseRow, isBookmarked: 1, commentCount: 3 });
      } else if (sql.includes('documents')) {
        cb(null, { content: JSON.stringify({ type: 'doc', content: [] }) });
      } else {
        cb(null, null);
      }
    });

    const res = await request(app)
      .get('/api/community/posts/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('commentCount', 3);
    expect(res.body.data).toHaveProperty('isBookmarked', true);
    expect(res.body.data).toHaveProperty('contentImages');
  });
});
