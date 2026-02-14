/**
 * Property-Based Test: Publish creates correct posts
 *
 * Property 1: For any set of valid document IDs and their corresponding document records,
 * publishing those documents should create exactly one Community_Post per document,
 * where each post's title matches the document's title, the summary equals the first
 * 200 characters of the document's content, and the tags match the document's tags.
 *
 * **Validates: Requirements 1.2, 1.3**
 *
 * Uses fast-check to generate random document data (title, content, tags) and verifies
 * that the publish endpoint creates posts with matching fields.
 */

const fc = require('fast-check');
const express = require('express');
const request = require('supertest');

// Mock DB that records inserts for verification
let mockDb;
let insertedRows;

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

beforeAll(() => {
  // We'll init with a fresh mockDb per test via beforeEach
});

beforeEach(() => {
  insertedRows = [];
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

describe('Property 1: Publish creates correct posts', () => {
  /**
   * **Validates: Requirements 1.2, 1.3**
   *
   * For any randomly generated document with title, content, and tags,
   * publishing that document should create a Community_Post where:
   * - The post title matches the document title
   * - The summary equals the first 200 characters of the document content
   * - The tags match the document tags
   * - Exactly one post is created per document
   */
  test('publishing a single document creates a post with matching title, summary (first 200 chars of content), and tags', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 200 }),
          content: fc.string({ minLength: 0, maxLength: 600 }),
          tags: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 })
        }),
        async ({ title, content, tags }) => {
          const tagsJson = JSON.stringify(tags);
          const documentId = 1;
          let lastInsertId = 100;

          // Track what was inserted
          const captured = {};

          mockDb.get.mockImplementation((sql, params, cb) => {
            if (sql.includes('documents')) {
              cb(null, { id: documentId, title, content, tags: tagsJson });
            } else if (sql.includes('community_posts')) {
              cb(null, null); // not yet published
            }
          });

          mockDb.run.mockImplementation(function (sql, params, cb) {
            if (sql.includes('INSERT INTO community_posts')) {
              // Capture the inserted values:
              // params = [userId, documentId, title, summary, coverImage, tags, ...]
              captured.userId = params[0];
              captured.documentId = params[1];
              captured.title = params[2];
              captured.summary = params[3];
              captured.coverImage = params[4];
              captured.tags = params[5];
              cb.call({ lastID: lastInsertId++ }, null);
            } else {
              cb.call({}, null);
            }
          });

          const res = await request(app)
            .post('/api/community/publish')
            .send({ documentIds: [documentId] });

          // Exactly one post published, none skipped
          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data.published).toHaveLength(1);
          expect(res.body.data.skipped).toHaveLength(0);

          // Title matches
          expect(captured.title).toBe(title);

          // Summary is first 200 chars of content
          const expectedSummary = content.substring(0, 200);
          expect(captured.summary).toBe(expectedSummary);

          // Tags match
          expect(captured.tags).toBe(tagsJson);

          // Reset mocks for next iteration
          mockDb.get.mockReset();
          mockDb.run.mockReset();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('publishing multiple documents creates exactly one post per document with correct fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 200 }),
            content: fc.string({ minLength: 0, maxLength: 600 }),
            tags: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 })
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (docs) => {
          const docMap = {};
          const capturedInserts = [];
          let nextId = 200;

          docs.forEach((doc, idx) => {
            const docId = idx + 1;
            docMap[docId] = {
              id: docId,
              title: doc.title,
              content: doc.content,
              tags: JSON.stringify(doc.tags)
            };
          });

          mockDb.get.mockImplementation((sql, params, cb) => {
            const id = params[0];
            if (sql.includes('documents')) {
              cb(null, docMap[id] || null);
            } else if (sql.includes('community_posts')) {
              cb(null, null); // none published yet
            }
          });

          mockDb.run.mockImplementation(function (sql, params, cb) {
            if (sql.includes('INSERT INTO community_posts')) {
              capturedInserts.push({
                documentId: params[1],
                title: params[2],
                summary: params[3],
                tags: params[5]
              });
              cb.call({ lastID: nextId++ }, null);
            } else {
              cb.call({}, null);
            }
          });

          const documentIds = docs.map((_, idx) => idx + 1);

          const res = await request(app)
            .post('/api/community/publish')
            .send({ documentIds });

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);

          // Exactly one post per document
          expect(res.body.data.published).toHaveLength(docs.length);
          expect(res.body.data.skipped).toHaveLength(0);
          expect(capturedInserts).toHaveLength(docs.length);

          // Each post's fields match the source document
          for (const insert of capturedInserts) {
            const sourceDoc = docMap[insert.documentId];
            expect(insert.title).toBe(sourceDoc.title);
            expect(insert.summary).toBe(sourceDoc.content.substring(0, 200));
            expect(insert.tags).toBe(sourceDoc.tags);
          }

          // Reset mocks for next iteration
          mockDb.get.mockReset();
          mockDb.run.mockReset();
        }
      ),
      { numRuns: 100 }
    );
  });
});
