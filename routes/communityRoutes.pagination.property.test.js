/**
 * Property-Based Test: Pagination correctness
 *
 * Property 6: For any set of N Community_Posts and pagination parameters (page, limit),
 * the returned results should contain at most `limit` items, and the total count should
 * equal N. Requesting page P should skip `(P-1) * limit` items.
 *
 * **Validates: Requirements 2.6**
 *
 * Uses fast-check to generate random post collections with varying sizes and pagination
 * parameters, then verifies the GET /posts endpoint returns correct page slices.
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
 * Helper: build a mock DB row for a community post.
 */
function buildPostRow(id) {
  return {
    id,
    user_id: 1,
    document_id: id + 100,
    title: `Post ${id}`,
    summary: `Summary for post ${id}`,
    cover_image: null,
    tags: '[]',
    likes: 0,
    view_count: 0,
    status: 'published',
    created_at: new Date(1700000000000 + id * 1000).toISOString().replace('T', ' ').replace('Z', ''),
    updated_at: new Date(1700000000000 + id * 1000).toISOString().replace('T', ' ').replace('Z', ''),
    authorName: 'testuser',
    authorAvatar: null,
    isLiked: 0
  };
}

describe('Property 6: Pagination correctness', () => {
  /**
   * **Validates: Requirements 2.6**
   *
   * For any N posts and pagination params (page, limit), the response should:
   * - contain at most `limit` items
   * - report total equal to N
   * - skip (page-1)*limit items (i.e. return the correct slice)
   */
  test('pagination returns at most limit items and correct total for any N posts and page/limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 50 }),           // N: total number of posts
        fc.integer({ min: 1, max: 20 }),            // limit
        fc.integer({ min: 1, max: 10 }),            // page
        async (n, limit, page) => {
          // Build all N post rows sorted by created_at DESC (default)
          const allRows = [];
          for (let i = n; i >= 1; i--) {
            allRows.push(buildPostRow(i));
          }

          const offset = (page - 1) * limit;
          const pageSlice = allRows.slice(offset, offset + limit);

          mockDb.get.mockImplementation((sql, params, cb) => {
            if (sql.includes('COUNT')) {
              cb(null, { total: n });
            }
          });

          mockDb.all.mockImplementation((sql, params, cb) => {
            // Simulate LIMIT/OFFSET: return the correct slice
            cb(null, pageSlice);
          });

          const res = await request(app)
            .get('/api/community/posts')
            .query({ page, limit });

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);

          const data = res.body.data;

          // Total should equal N
          expect(data.total).toBe(n);

          // Page and limit echoed back correctly
          expect(data.page).toBe(page);
          expect(data.limit).toBe(limit);

          // Returned posts should be at most limit items
          expect(data.posts.length).toBeLessThanOrEqual(limit);

          // Returned posts count should match the expected slice length
          const expectedCount = Math.min(limit, Math.max(0, n - offset));
          expect(data.posts.length).toBe(expectedCount);

          // Verify the returned posts match the expected slice by id
          for (let i = 0; i < data.posts.length; i++) {
            expect(data.posts[i].id).toBe(pageSlice[i].id);
          }

          mockDb.get.mockReset();
          mockDb.all.mockReset();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.6**
   *
   * Verifies that the SQL query receives the correct LIMIT and OFFSET parameters
   * derived from page and limit query params.
   */
  test('SQL query receives correct LIMIT and OFFSET parameters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 50 }),            // N
        fc.integer({ min: 1, max: 20 }),             // limit
        fc.integer({ min: 1, max: 10 }),             // page
        async (n, limit, page) => {
          const expectedOffset = (page - 1) * limit;
          let capturedQueryParams = null;

          mockDb.get.mockImplementation((sql, params, cb) => {
            if (sql.includes('COUNT')) {
              cb(null, { total: n });
            }
          });

          mockDb.all.mockImplementation((sql, params, cb) => {
            capturedQueryParams = params;
            cb(null, []);
          });

          await request(app)
            .get('/api/community/posts')
            .query({ page, limit });

          // The query params should end with [limit, offset]
          // params = [userId, ...whereParams, limit, offset]
          expect(capturedQueryParams).not.toBeNull();
          const paramLen = capturedQueryParams.length;
          expect(capturedQueryParams[paramLen - 2]).toBe(limit);
          expect(capturedQueryParams[paramLen - 1]).toBe(expectedOffset);

          mockDb.get.mockReset();
          mockDb.all.mockReset();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.6**
   *
   * Default pagination (no page/limit params) should use page=1 and limit=20.
   */
  test('default pagination uses page=1 and limit=20', async () => {
    const n = 25;
    const defaultSlice = [];
    for (let i = n; i >= 1; i--) {
      defaultSlice.push(buildPostRow(i));
    }
    // Default: page=1, limit=20 → first 20 items
    const expectedSlice = defaultSlice.slice(0, 20);

    mockDb.get.mockImplementation((sql, params, cb) => {
      if (sql.includes('COUNT')) {
        cb(null, { total: n });
      }
    });

    mockDb.all.mockImplementation((sql, params, cb) => {
      cb(null, expectedSlice);
    });

    const res = await request(app)
      .get('/api/community/posts');

    expect(res.status).toBe(200);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(20);
    expect(res.body.data.total).toBe(n);
    expect(res.body.data.posts.length).toBe(20);
  });
});
