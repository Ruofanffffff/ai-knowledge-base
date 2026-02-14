/**
 * Property-Based Test: Publish skips already-published documents
 *
 * Property 2: For any document that already has a corresponding Community_Post,
 * re-publishing that document should not create a duplicate post, and the document ID
 * should appear in the response's skipped list.
 *
 * **Validates: Requirements 1.4**
 *
 * Uses fast-check to generate already-published document IDs and verifies
 * that re-publishing returns them in the skipped list without creating duplicates.
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

describe('Property 2: Publish skips already-published documents', () => {
  /**
   * **Validates: Requirements 1.4**
   *
   * For any document that already has a corresponding Community_Post,
   * re-publishing should not create a duplicate and the document ID
   * should appear in the response's skipped list.
   */
  test('re-publishing a single already-published document returns it in skipped list', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          documentId: fc.integer({ min: 1, max: 10000 }),
          existingPostId: fc.integer({ min: 1, max: 10000 }),
          title: fc.string({ minLength: 1, maxLength: 200 }),
          content: fc.string({ minLength: 0, maxLength: 600 }),
          tags: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 })
        }),
        async ({ documentId, existingPostId, title, content, tags }) => {
          const tagsJson = JSON.stringify(tags);
          let insertCalled = false;

          mockDb.get.mockImplementation((sql, params, cb) => {
            if (sql.includes('documents')) {
              cb(null, { id: documentId, title, content, tags: tagsJson });
            } else if (sql.includes('community_posts')) {
              // Document already published — return existing post
              cb(null, { id: existingPostId });
            }
          });

          mockDb.run.mockImplementation(function (sql, params, cb) {
            if (sql.includes('INSERT INTO community_posts')) {
              insertCalled = true;
            }
            cb.call({ lastID: 999 }, null);
          });

          const res = await request(app)
            .post('/api/community/publish')
            .send({ documentIds: [documentId] });

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          // No new posts created
          expect(res.body.data.published).toHaveLength(0);
          // Document appears in skipped list
          expect(res.body.data.skipped).toHaveLength(1);
          expect(res.body.data.skipped[0].documentId).toBe(documentId);
          // No INSERT was executed
          expect(insertCalled).toBe(false);

          mockDb.get.mockReset();
          mockDb.run.mockReset();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('publishing a mix of new and already-published documents skips only the published ones', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          publishedCount: fc.integer({ min: 1, max: 3 }),
          newCount: fc.integer({ min: 1, max: 3 })
        }).chain(({ publishedCount, newCount }) =>
          fc.record({
            publishedDocs: fc.array(
              fc.record({
                title: fc.string({ minLength: 1, maxLength: 100 }),
                content: fc.string({ minLength: 0, maxLength: 300 }),
                tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 3 })
              }),
              { minLength: publishedCount, maxLength: publishedCount }
            ),
            newDocs: fc.array(
              fc.record({
                title: fc.string({ minLength: 1, maxLength: 100 }),
                content: fc.string({ minLength: 0, maxLength: 300 }),
                tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 3 })
              }),
              { minLength: newCount, maxLength: newCount }
            )
          })
        ),
        async ({ publishedDocs, newDocs }) => {
          // Assign IDs: published docs get IDs 1..N, new docs get N+1..N+M
          const publishedIds = publishedDocs.map((_, i) => i + 1);
          const newIds = newDocs.map((_, i) => publishedDocs.length + i + 1);
          const allIds = [...publishedIds, ...newIds];

          const publishedSet = new Set(publishedIds);

          // Build document lookup
          const docMap = {};
          publishedDocs.forEach((doc, i) => {
            const id = i + 1;
            docMap[id] = { id, title: doc.title, content: doc.content, tags: JSON.stringify(doc.tags) };
          });
          newDocs.forEach((doc, i) => {
            const id = publishedDocs.length + i + 1;
            docMap[id] = { id, title: doc.title, content: doc.content, tags: JSON.stringify(doc.tags) };
          });

          const insertedDocIds = [];
          let nextPostId = 500;

          mockDb.get.mockImplementation((sql, params, cb) => {
            const id = params[0];
            if (sql.includes('documents')) {
              cb(null, docMap[id] || null);
            } else if (sql.includes('community_posts')) {
              // Already published if in publishedSet
              if (publishedSet.has(id)) {
                cb(null, { id: id + 1000 }); // existing post
              } else {
                cb(null, null); // not yet published
              }
            }
          });

          mockDb.run.mockImplementation(function (sql, params, cb) {
            if (sql.includes('INSERT INTO community_posts')) {
              insertedDocIds.push(params[1]); // document_id is params[1]
              cb.call({ lastID: nextPostId++ }, null);
            } else {
              cb.call({}, null);
            }
          });

          const res = await request(app)
            .post('/api/community/publish')
            .send({ documentIds: allIds });

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);

          // Only new docs should be published
          expect(res.body.data.published).toHaveLength(newDocs.length);
          // Already-published docs should be skipped
          expect(res.body.data.skipped).toHaveLength(publishedDocs.length);

          // Verify skipped list contains exactly the already-published document IDs
          const skippedDocIds = res.body.data.skipped.map(s => s.documentId);
          for (const id of publishedIds) {
            expect(skippedDocIds).toContain(id);
          }

          // Verify only new documents were inserted
          expect(insertedDocIds).toHaveLength(newDocs.length);
          for (const id of insertedDocIds) {
            expect(publishedSet.has(id)).toBe(false);
          }

          mockDb.get.mockReset();
          mockDb.run.mockReset();
        }
      ),
      { numRuns: 100 }
    );
  });
});
