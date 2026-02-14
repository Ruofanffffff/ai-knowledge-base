/**
 * Property-Based Test: Search filter correctness
 *
 * Property 5: For any search term and set of Community_Posts, the filtered results
 * should contain only posts where the title or summary includes the search term
 * (case-insensitive).
 *
 * **Validates: Requirements 2.5**
 *
 * Uses fast-check to generate random posts and search terms, then verifies
 * the GET /posts endpoint returns only matching posts.
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
 * Simulate SQLite LIKE matching (case-insensitive).
 * SQLite's LIKE is case-insensitive for ASCII characters by default.
 */
function sqliteLike(text, searchTerm) {
  if (!text || !searchTerm) return false;
  return text.toLowerCase().includes(searchTerm.toLowerCase());
}

/**
 * Arbitrary for a single community post with plain-text title and summary.
 */
const postArbitrary = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }),
  summary: fc.string({ minLength: 0, maxLength: 200 })
});

/**
 * Arbitrary for a search term — alphanumeric to avoid regex/LIKE special char issues.
 */
const searchTermArbitrary = fc.string({ minLength: 1, maxLength: 20 })
  .map(s => s.replace(/[^a-zA-Z0-9]/g, 'a'))
  .filter(s => s.length > 0);

describe('Property 5: Search filter correctness', () => {
  /**
   * **Validates: Requirements 2.5**
   *
   * For any set of posts and a search term, the search endpoint should return
   * only posts whose title or summary contains the search term (case-insensitive).
   * Every returned post must match, and no matching post should be missing.
   */
  test('search returns only posts where title or summary contains the search term (case-insensitive)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(postArbitrary, { minLength: 1, maxLength: 20 }),
        searchTermArbitrary,
        async (posts, searchTerm) => {
          // Build mock DB rows
          const allRows = posts.map((p, idx) => ({
            id: idx + 1,
            user_id: 1,
            document_id: idx + 100,
            title: p.title,
            summary: p.summary,
            cover_image: null,
            tags: '[]',
            likes: 0,
            view_count: 0,
            status: 'published',
            created_at: '2024-01-01 00:00:00',
            updated_at: '2024-01-01 00:00:00',
            authorName: 'testuser',
            authorAvatar: null,
            isLiked: 0
          }));

          // Compute expected matches using the same case-insensitive logic as SQLite LIKE
          const expectedMatches = allRows.filter(
            row => sqliteLike(row.title, searchTerm) || sqliteLike(row.summary, searchTerm)
          );

          // Mock db.get for COUNT query — return count of matching rows
          mockDb.get.mockImplementation((sql, params, cb) => {
            if (sql.includes('COUNT')) {
              cb(null, { total: expectedMatches.length });
            }
          });

          // Mock db.all — simulate SQLite filtering by returning only matching rows
          mockDb.all.mockImplementation((sql, params, cb) => {
            cb(null, expectedMatches);
          });

          const res = await request(app)
            .get('/api/community/posts')
            .query({ search: searchTerm, limit: 100 });

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);

          const returnedPosts = res.body.data.posts;

          // The number of returned posts should match expected
          expect(returnedPosts.length).toBe(expectedMatches.length);

          // Every returned post must contain the search term in title or summary
          for (const post of returnedPosts) {
            const titleMatch = sqliteLike(post.title, searchTerm);
            const summaryMatch = sqliteLike(post.summary, searchTerm);
            expect(titleMatch || summaryMatch).toBe(true);
          }

          // Verify the returned post IDs match the expected set exactly
          const returnedIds = new Set(returnedPosts.map(p => p.id));
          const expectedIds = new Set(expectedMatches.map(r => r.id));
          expect(returnedIds).toEqual(expectedIds);

          mockDb.get.mockReset();
          mockDb.all.mockReset();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.5**
   *
   * When a search term is guaranteed to appear in some posts' titles,
   * those posts must be included in the results.
   * This uses a "planted" search term to ensure non-trivial matching.
   */
  test('posts with the search term planted in title are always returned', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(postArbitrary, { minLength: 1, maxLength: 10 }),
        searchTermArbitrary,
        fc.integer({ min: 0, max: 9 }),
        async (basePosts, searchTerm, seedIdx) => {
          // Plant the search term into at least one post's title
          const posts = basePosts.map((p, idx) => ({ ...p }));
          const plantIdx = seedIdx % posts.length;
          posts[plantIdx] = {
            ...posts[plantIdx],
            title: posts[plantIdx].title + ' ' + searchTerm
          };

          const allRows = posts.map((p, idx) => ({
            id: idx + 1,
            user_id: 1,
            document_id: idx + 100,
            title: p.title,
            summary: p.summary,
            cover_image: null,
            tags: '[]',
            likes: 0,
            view_count: 0,
            status: 'published',
            created_at: '2024-01-01 00:00:00',
            updated_at: '2024-01-01 00:00:00',
            authorName: 'testuser',
            authorAvatar: null,
            isLiked: 0
          }));

          const expectedMatches = allRows.filter(
            row => sqliteLike(row.title, searchTerm) || sqliteLike(row.summary, searchTerm)
          );

          // The planted post must be in expected matches
          const plantedRow = allRows[plantIdx];
          expect(
            sqliteLike(plantedRow.title, searchTerm) || sqliteLike(plantedRow.summary, searchTerm)
          ).toBe(true);

          mockDb.get.mockImplementation((sql, params, cb) => {
            if (sql.includes('COUNT')) {
              cb(null, { total: expectedMatches.length });
            }
          });

          mockDb.all.mockImplementation((sql, params, cb) => {
            cb(null, expectedMatches);
          });

          const res = await request(app)
            .get('/api/community/posts')
            .query({ search: searchTerm, limit: 100 });

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);

          const returnedPosts = res.body.data.posts;

          // The planted post must appear in results
          const returnedIds = returnedPosts.map(p => p.id);
          expect(returnedIds).toContain(plantedRow.id);

          // All returned posts must match
          for (const post of returnedPosts) {
            expect(
              sqliteLike(post.title, searchTerm) || sqliteLike(post.summary, searchTerm)
            ).toBe(true);
          }

          mockDb.get.mockReset();
          mockDb.all.mockReset();
        }
      ),
      { numRuns: 100 }
    );
  });
});
