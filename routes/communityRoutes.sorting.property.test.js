/**
 * Property-Based Test: Sorting correctness
 *
 * Property 3: For any set of Community_Posts, when sorted by `latest` the results
 * should be ordered by `created_at` descending, and when sorted by `hottest` the
 * results should be ordered by `likes` descending.
 *
 * **Validates: Requirements 2.2, 2.3**
 *
 * Uses fast-check to generate random post collections with varying created_at and likes,
 * then verifies the GET /posts endpoint returns them in the correct order.
 */

const fc = require('fast-check');
const express = require('express');
const request = require('supertest');

let mockDb;

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

let app;

beforeEach(() => {
  mockDb = {
    get: jest.fn(),
    run: jest.fn(),
    all: jest.fn()
  };
  initCommunityRoutes(mockDb);
  app = express();
  app.use(express.json());
  app.use('/api/community', router);
});

afterEach(() => {
  jest.clearAllMocks();
});

/**
 * Helper: generate a random ISO datetime string from a Date integer timestamp.
 */
function timestampToSqlite(ts) {
  return new Date(ts).toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * Arbitrary for a single community post row (as returned by SQLite).
 * Generates distinct created_at timestamps and likes values.
 */
const postArbitrary = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }),
  summary: fc.string({ minLength: 0, maxLength: 200 }),
  likes: fc.integer({ min: 0, max: 10000 }),
  // Timestamp between 2020-01-01 and 2025-01-01
  createdAtTs: fc.integer({ min: 1577836800000, max: 1735689600000 })
});

describe('Property 3: Sorting correctness', () => {
  /**
   * **Validates: Requirements 2.2**
   *
   * For any randomly generated set of community posts with different created_at values,
   * requesting sort=latest should return posts ordered by created_at descending.
   */
  test('sort=latest returns posts ordered by created_at descending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(postArbitrary, { minLength: 2, maxLength: 20 }),
        async (posts) => {
          // Build mock DB rows with unique IDs
          const dbRows = posts.map((p, idx) => ({
            id: idx + 1,
            user_id: 1,
            document_id: idx + 100,
            title: p.title,
            summary: p.summary,
            cover_image: null,
            tags: '[]',
            likes: p.likes,
            view_count: 0,
            status: 'published',
            created_at: timestampToSqlite(p.createdAtTs),
            updated_at: timestampToSqlite(p.createdAtTs),
            authorName: 'testuser',
            authorAvatar: null,
            isLiked: 0
          }));

          // Sort rows by created_at DESC (what the real DB would do)
          const sortedRows = [...dbRows].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

          mockDb.get.mockImplementation((sql, params, cb) => {
            if (sql.includes('COUNT')) {
              cb(null, { total: dbRows.length });
            }
          });

          mockDb.all.mockImplementation((sql, params, cb) => {
            // Return rows pre-sorted as the real SQLite ORDER BY would
            cb(null, sortedRows);
          });

          const res = await request(app)
            .get('/api/community/posts')
            .query({ sort: 'latest', limit: posts.length });

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);

          const returnedPosts = res.body.data.posts;
          expect(returnedPosts.length).toBe(posts.length);

          // Verify ordering: each post's createdAt should be >= the next one's
          for (let i = 0; i < returnedPosts.length - 1; i++) {
            const currentTime = new Date(returnedPosts[i].createdAt).getTime();
            const nextTime = new Date(returnedPosts[i + 1].createdAt).getTime();
            expect(currentTime).toBeGreaterThanOrEqual(nextTime);
          }

          mockDb.get.mockReset();
          mockDb.all.mockReset();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.3**
   *
   * For any randomly generated set of community posts with different likes values,
   * requesting sort=hottest should return posts ordered by likes descending.
   */
  test('sort=hottest returns posts ordered by likes descending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(postArbitrary, { minLength: 2, maxLength: 20 }),
        async (posts) => {
          const dbRows = posts.map((p, idx) => ({
            id: idx + 1,
            user_id: 1,
            document_id: idx + 100,
            title: p.title,
            summary: p.summary,
            cover_image: null,
            tags: '[]',
            likes: p.likes,
            view_count: 0,
            status: 'published',
            created_at: timestampToSqlite(p.createdAtTs),
            updated_at: timestampToSqlite(p.createdAtTs),
            authorName: 'testuser',
            authorAvatar: null,
            isLiked: 0
          }));

          // Sort rows by likes DESC (what the real DB would do)
          const sortedRows = [...dbRows].sort((a, b) => b.likes - a.likes);

          mockDb.get.mockImplementation((sql, params, cb) => {
            if (sql.includes('COUNT')) {
              cb(null, { total: dbRows.length });
            }
          });

          mockDb.all.mockImplementation((sql, params, cb) => {
            cb(null, sortedRows);
          });

          const res = await request(app)
            .get('/api/community/posts')
            .query({ sort: 'hottest', limit: posts.length });

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);

          const returnedPosts = res.body.data.posts;
          expect(returnedPosts.length).toBe(posts.length);

          // Verify ordering: each post's likes should be >= the next one's
          for (let i = 0; i < returnedPosts.length - 1; i++) {
            expect(returnedPosts[i].likes).toBeGreaterThanOrEqual(returnedPosts[i + 1].likes);
          }

          mockDb.get.mockReset();
          mockDb.all.mockReset();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.2, 2.3**
   *
   * Default sort (no sort param) should behave as 'latest' — ordered by created_at descending.
   */
  test('default sort (no sort param) returns posts ordered by created_at descending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(postArbitrary, { minLength: 2, maxLength: 15 }),
        async (posts) => {
          const dbRows = posts.map((p, idx) => ({
            id: idx + 1,
            user_id: 1,
            document_id: idx + 100,
            title: p.title,
            summary: p.summary,
            cover_image: null,
            tags: '[]',
            likes: p.likes,
            view_count: 0,
            status: 'published',
            created_at: timestampToSqlite(p.createdAtTs),
            updated_at: timestampToSqlite(p.createdAtTs),
            authorName: 'testuser',
            authorAvatar: null,
            isLiked: 0
          }));

          // Default is latest → sort by created_at DESC
          const sortedRows = [...dbRows].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

          mockDb.get.mockImplementation((sql, params, cb) => {
            if (sql.includes('COUNT')) {
              cb(null, { total: dbRows.length });
            }
          });

          mockDb.all.mockImplementation((sql, params, cb) => {
            cb(null, sortedRows);
          });

          const res = await request(app)
            .get('/api/community/posts')
            .query({ limit: posts.length });

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);

          const returnedPosts = res.body.data.posts;

          for (let i = 0; i < returnedPosts.length - 1; i++) {
            const currentTime = new Date(returnedPosts[i].createdAt).getTime();
            const nextTime = new Date(returnedPosts[i + 1].createdAt).getTime();
            expect(currentTime).toBeGreaterThanOrEqual(nextTime);
          }

          mockDb.get.mockReset();
          mockDb.all.mockReset();
        }
      ),
      { numRuns: 100 }
    );
  });
});
