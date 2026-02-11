/**
 * Property-Based Tests for File Storage Uniqueness
 * 
 * Feature: notes-feature
 * Property 17: 文件存储唯一性
 * Validates: Requirements 12.2
 * 
 * For any files saved to object storage, unique identifiers should be used
 * as storage keys to ensure no conflicts occur.
 */

const fc = require('fast-check');
const { generateUniqueFileKey, generateFileUrl } = require('./s3Client');

describe('Property 17: File Storage Uniqueness', () => {
  describe('generateUniqueFileKey', () => {
    it('should generate unique keys for different files', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              filename: fc.string({ minLength: 1, maxLength: 50 }),
              userId: fc.uuid(),
              prefix: fc.constantFrom('attachments', 'images', 'documents', 'tables')
            }),
            { minLength: 2, maxLength: 100 }
          ),
          (fileInputs) => {
            const keys = fileInputs.map(input => 
              generateUniqueFileKey(input.filename, input.userId, input.prefix)
            );
            
            // All keys should be unique
            const uniqueKeys = new Set(keys);
            expect(uniqueKeys.size).toBe(keys.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique keys even for identical inputs called at different times', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.uuid(),
          fc.constantFrom('attachments', 'images', 'documents'),
          (filename, userId, prefix) => {
            // Generate multiple keys with same inputs
            const keys = [];
            for (let i = 0; i < 10; i++) {
              keys.push(generateUniqueFileKey(filename, userId, prefix));
            }
            
            // All keys should be unique despite identical inputs
            const uniqueKeys = new Set(keys);
            expect(uniqueKeys.size).toBe(keys.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate keys with proper structure', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.uuid(),
          fc.constantFrom('attachments', 'images', 'documents'),
          (filename, userId, prefix) => {
            const key = generateUniqueFileKey(filename, userId, prefix);
            
            // Key should start with prefix
            expect(key).toMatch(new RegExp(`^${prefix}/`));
            
            // Key should contain UUID pattern (8-4-4-4-12 format)
            expect(key).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
            
            // Key should contain timestamp pattern (numeric)
            expect(key).toMatch(/\/\d+\//);
            
            // Key should contain user hash (8 hex characters)
            expect(key).toMatch(/\/[0-9a-f]{8}\//);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve file extension in generated key', () => {
      fc.assert(
        fc.property(
          // Generate realistic basenames (alphanumeric with some special chars, but not path separators)
          fc.string({ minLength: 1, maxLength: 40 }).filter(s => /[a-zA-Z0-9]/.test(s) && !s.includes('/') && !s.includes('\\')),
          fc.constantFrom('.jpg', '.png', '.pdf', '.docx', '.xlsx', '.txt', '.csv'),
          fc.uuid(),
          (basename, extension, userId) => {
            const filename = basename + extension;
            const key = generateUniqueFileKey(filename, userId);
            
            // Key should end with the same extension (lowercase)
            expect(key.toLowerCase()).toMatch(new RegExp(`${extension.toLowerCase()}$`));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle files without extensions', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('.')),
          fc.uuid(),
          (filename, userId) => {
            const key = generateUniqueFileKey(filename, userId);
            
            // Should not throw error
            expect(key).toBeDefined();
            expect(typeof key).toBe('string');
            expect(key.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different keys for same filename but different users', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
          (filename, userIds) => {
            const keys = userIds.map(userId => 
              generateUniqueFileKey(filename, userId)
            );
            
            // All keys should be unique
            const uniqueKeys = new Set(keys);
            expect(uniqueKeys.size).toBe(keys.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not contain special characters that could cause path issues', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.uuid(),
          (filename, userId) => {
            const key = generateUniqueFileKey(filename, userId);
            
            // Key should only contain safe characters: alphanumeric, dash, underscore, dot, slash
            expect(key).toMatch(/^[a-zA-Z0-9\-_./]+$/);
            
            // Should not contain consecutive slashes
            expect(key).not.toMatch(/\/\//);
            
            // Should not start or end with slash
            expect(key).not.toMatch(/^\/|\/$/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('generateFileUrl', () => {
    it('should generate valid URLs for all keys', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.uuid(),
          (filename, userId) => {
            const key = generateUniqueFileKey(filename, userId);
            const url = generateFileUrl(key);
            
            // URL should be valid
            expect(url).toBeDefined();
            expect(typeof url).toBe('string');
            
            // URL should start with http:// or https://
            expect(url).toMatch(/^https?:\/\//);
            
            // URL should contain the key
            expect(url).toContain(key);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique URLs for unique keys', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              filename: fc.string({ minLength: 1, maxLength: 50 }),
              userId: fc.uuid()
            }),
            { minLength: 2, maxLength: 50 }
          ),
          (fileInputs) => {
            const urls = fileInputs.map(input => {
              const key = generateUniqueFileKey(input.filename, input.userId);
              return generateFileUrl(key);
            });
            
            // All URLs should be unique
            const uniqueUrls = new Set(urls);
            expect(uniqueUrls.size).toBe(urls.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Key collision resistance', () => {
    it('should have extremely low collision probability even with high volume', () => {
      // Simulate high-volume concurrent uploads
      const filename = 'test.jpg';
      const userId = 'user-123';
      const numUploads = 1000;
      
      const keys = [];
      for (let i = 0; i < numUploads; i++) {
        keys.push(generateUniqueFileKey(filename, userId));
      }
      
      // All keys should be unique
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(numUploads);
    });

    it('should maintain uniqueness across different prefixes', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.uuid(),
          (filename, userId) => {
            const prefixes = ['attachments', 'images', 'documents', 'tables', 'temp'];
            const keys = prefixes.map(prefix => 
              generateUniqueFileKey(filename, userId, prefix)
            );
            
            // All keys should be unique
            const uniqueKeys = new Set(keys);
            expect(uniqueKeys.size).toBe(prefixes.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Key format consistency', () => {
    it('should always follow the pattern: prefix/userHash/timestamp/uuid.ext', () => {
      fc.assert(
        fc.property(
          // Generate realistic basenames (no slashes or other path separators)
          fc.string({ minLength: 1, maxLength: 40 }).filter(s => /[a-zA-Z0-9]/.test(s) && !s.includes('/') && !s.includes('\\')),
          fc.constantFrom('.jpg', '.png', '.pdf', '.docx'),
          fc.uuid(),
          fc.constantFrom('attachments', 'images', 'documents'),
          (basename, extension, userId, prefix) => {
            const filename = basename + extension;
            const key = generateUniqueFileKey(filename, userId, prefix);
            
            // Split key into parts
            const parts = key.split('/');
            
            // Should have 4 parts: prefix, userHash, timestamp, uuid.ext
            expect(parts.length).toBe(4);
            
            // Part 0: prefix
            expect(parts[0]).toBe(prefix);
            
            // Part 1: userHash (8 hex characters)
            expect(parts[1]).toMatch(/^[0-9a-f]{8}$/);
            
            // Part 2: timestamp (numeric)
            expect(parts[2]).toMatch(/^\d+$/);
            expect(parseInt(parts[2])).toBeGreaterThan(0);
            
            // Part 3: uuid.ext
            expect(parts[3]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
            expect(parts[3].toLowerCase()).toMatch(new RegExp(`${extension.toLowerCase()}$`));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Temporal uniqueness', () => {
    it('should generate different keys when called in rapid succession', async () => {
      const filename = 'test.jpg';
      const userId = 'user-123';
      
      // Generate keys in rapid succession (no delay)
      const keys = await Promise.all(
        Array(100).fill(null).map(() => 
          Promise.resolve(generateUniqueFileKey(filename, userId))
        )
      );
      
      // All keys should be unique
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(100);
    });
  });
});
