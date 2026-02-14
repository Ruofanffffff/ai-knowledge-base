/**
 * Property-Based Test: Like/unlike round trip
 *
 * Property 7: For any user and any Community_Post, liking then unliking
 * (two consecutive toggle calls) should restore the post's like count
 * to its original value and remove the Community_Like record.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3**
 *
 * Uses fast-check to generate random user-post pairs and verifies
 * that like → unlike restores the original likes value.
 */

const fc = require('fast-check');
const express = require('express');
const request = require('supertest');

let mockDb;
let mockUserId = 1;

jest.mock('../database/initUserDB', () => ({
  initDatabase: jest.fn(() => mockDb)
}));

jest.mock('../services/authService', () => ({
  authMiddleware: (req, res, next) => {
    req.userId = mockUserId;
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
  mockUserId = 1;
  initCommunityRoutes(mockDb);
  app = express();
  app.use(express.json());
  app.use('/api/community', router);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Property 7: Like/unlike round trip', () => {
  /**
   * **Validates: Requirements 4.1, 4.2, 4.3**
   *
   * For any random user and post with an initial like count,
   * calling like (toggle) then unlike (toggle again) should restore
   * the post's like count to its original value and remove the
   * Community_Like record.
   */
  test('like then unlike restores original like count for any user-post pair', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 10000 }),
          postId: fc.integer({ min: 1, max: 10000 }),
          initialLikes: fc.integer({ min: 0, max: 100000 })
        }),
        async ({ userId, postId, initialLikes }) => {
          mockUserId = userId;

          // Track state: simulate in-memory like state
          let likesCount = initialLikes;
          let likeRecordExists = false;

          mockDb.get.mockImplementation((sql, params, cb) => {
            if (sql.includes('community_posts') && sql.includes('likes') && !sql.includes('community_likes')) {
              // SELECT id, likes FROM community_posts WHERE id = ?
              // or SELECT likes FROM community_posts WHERE id = ?
              if (params[0] === postId || params[1] === postId) {
                cb(null, { id: postId, likes: likesCount });
              } else {
                cb(null, { id: params[0], likes: likesCount });
              }
            } else if (sql.includes('community_likes')) {
              // SELECT id FROM community_likes WHERE user_id = ? AND post_id = ?
              cb(null, likeRecordExists ? { id: 999 } : null);
            } else if (sql.includes('community_posts')) {
              cb(null, { id: postId, likes: likesCount });
            }
          });

          mockDb.run.mockImplementation(function (sql, params, cb) {
            if (sql.includes('INSERT INTO community_likes')) {
              likeRecordExists = true;
              cb.call({ lastID: 999 }, null);
            } else if (sql.includes('DELETE FROM community_likes')) {
              likeRecordExists = false;
              cb(null);
            } else if (sql.includes('likes = likes + 1')) {
              likesCount += 1;
              cb(null);
            } else if (sql.includes('likes = likes - 1')) {
              likesCount -= 1;
              cb(null);
            } else {
              cb(null);
            }
          });

          // Step 1: Like the post (first toggle)
          const likeRes = await request(app)
            .post(`/api/community/posts/${postId}/like`)
            .send();

          expect(likeRes.status).toBe(200);
          expect(likeRes.body.success).toBe(true);
          expect(likeRes.body.data.liked).toBe(true);
          expect(likeRes.body.data.likes).toBe(initialLikes + 1);
          expect(likeRecordExists).toBe(true);

          // Step 2: Unlike the post (second toggle)
          const unlikeRes = await request(app)
            .post(`/api/community/posts/${postId}/like`)
            .send();

          expect(unlikeRes.status).toBe(200);
          expect(unlikeRes.body.success).toBe(true);
          expect(unlikeRes.body.data.liked).toBe(false);
          expect(unlikeRes.body.data.likes).toBe(initialLikes);
          expect(likeRecordExists).toBe(false);

          // The like count is restored to the original value
          expect(likesCount).toBe(initialLikes);

          // Reset mocks for next iteration
          mockDb.get.mockReset();
          mockDb.run.mockReset();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('unlike then like restores original like count for already-liked posts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 10000 }),
          postId: fc.integer({ min: 1, max: 10000 }),
          initialLikes: fc.integer({ min: 1, max: 100000 })
        }),
        async ({ userId, postId, initialLikes }) => {
          mockUserId = userId;

          // Start with the post already liked by this user
          let likesCount = initialLikes;
          let likeRecordExists = true;

          mockDb.get.mockImplementation((sql, params, cb) => {
            if (sql.includes('community_posts') && sql.includes('likes') && !sql.includes('community_likes')) {
              if (params[0] === postId || params[1] === postId) {
                cb(null, { id: postId, likes: likesCount });
              } else {
                cb(null, { id: params[0], likes: likesCount });
              }
            } else if (sql.includes('community_likes')) {
              cb(null, likeRecordExists ? { id: 999 } : null);
            } else if (sql.includes('community_posts')) {
              cb(null, { id: postId, likes: likesCount });
            }
          });

          mockDb.run.mockImplementation(function (sql, params, cb) {
            if (sql.includes('INSERT INTO community_likes')) {
              likeRecordExists = true;
              cb.call({ lastID: 999 }, null);
            } else if (sql.includes('DELETE FROM community_likes')) {
              likeRecordExists = false;
              cb(null);
            } else if (sql.includes('likes = likes + 1')) {
              likesCount += 1;
              cb(null);
            } else if (sql.includes('likes = likes - 1')) {
              likesCount -= 1;
              cb(null);
            } else {
              cb(null);
            }
          });

          // Step 1: Unlike the post (first toggle — removes existing like)
          const unlikeRes = await request(app)
            .post(`/api/community/posts/${postId}/like`)
            .send();

          expect(unlikeRes.status).toBe(200);
          expect(unlikeRes.body.success).toBe(true);
          expect(unlikeRes.body.data.liked).toBe(false);
          expect(unlikeRes.body.data.likes).toBe(initialLikes - 1);
          expect(likeRecordExists).toBe(false);

          // Step 2: Like the post again (second toggle — restores)
          const likeRes = await request(app)
            .post(`/api/community/posts/${postId}/like`)
            .send();

          expect(likeRes.status).toBe(200);
          expect(likeRes.body.success).toBe(true);
          expect(likeRes.body.data.liked).toBe(true);
          expect(likeRes.body.data.likes).toBe(initialLikes);
          expect(likeRecordExists).toBe(true);

          // The like count is restored to the original value
          expect(likesCount).toBe(initialLikes);

          // Reset mocks for next iteration
          mockDb.get.mockReset();
          mockDb.run.mockReset();
        }
      ),
      { numRuns: 100 }
    );
  });
});
