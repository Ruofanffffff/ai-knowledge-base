import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import apiService from '../api';
import apiClient from '../../api/client';

// Mock the apiClient
vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('API Service Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('Property: all KG-related API methods handle errors without throwing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<
          | { method: 'getKGStatus'; args: [string]; transport: 'get' }
          | { method: 'getBatchKGStatus'; args: [string[]]; transport: 'get' }
          | { method: 'rebuildKG'; args: [string]; transport: 'post' }
          | { method: 'buildKG'; args: [string]; transport: 'post' }
        >(
          { method: 'getKGStatus', args: ['doc-1'], transport: 'get' },
          { method: 'getBatchKGStatus', args: [['doc-1', 'doc-2']], transport: 'get' },
          { method: 'rebuildKG', args: ['doc-1'], transport: 'post' },
          { method: 'buildKG', args: ['doc-1'], transport: 'post' }
        ),
        async ({ method, args, transport }) => {
          if (transport === 'get') vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));
          if (transport === 'post') vi.mocked(apiClient.post).mockRejectedValue(new Error('Network error'));

          const result = await (apiService as any)[method](...args);
          expect(result).toBeDefined();
          if (method === 'getBatchKGStatus') {
            expect(result.success).toBe(true);
            expect(Array.isArray(result.data)).toBe(true);
          } else {
            expect(result.success).toBe(false);
            expect(result.error).toBeTruthy();
            expect(typeof result.error).toBe('string');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property: getKGStatus handles different error types gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          { response: { status: 404, statusText: 'Not Found', data: { message: 'Resource not found' } } },
          { response: { status: 500, statusText: 'Internal Server Error', data: {} } },
          { request: {}, message: 'Network Error' },
          { message: 'Timeout error' }
        ),
        async (errorType) => {
          vi.mocked(apiClient.get).mockRejectedValue(errorType);

          const result = await apiService.getKGStatus('doc-err');
          expect(result.success).toBe(false);
          expect(result.error).toBeTruthy();
          expect(typeof result.error).toBe('string');
          expect(result.error.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property: successful getKGStatus returns success without errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          docId: fc.string({ minLength: 1, maxLength: 64 }),
          status: fc.constantFrom('pending', 'building', 'completed', 'failed'),
          createdAt: fc.string({ minLength: 1, maxLength: 64 }),
          updatedAt: fc.string({ minLength: 1, maxLength: 64 }),
        }),
        async (payload) => {
          vi.mocked(apiClient.get).mockResolvedValue({
            data: {
              success: true,
              data: payload,
            },
          } as any);

          const result = await apiService.getKGStatus(payload.docId);
          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();
          expect(result.error).toBeUndefined();
          expect(result.data?.docId).toBe(payload.docId);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property: getBatchKGStatus returns aggregated statuses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 32 }), { minLength: 1, maxLength: 5 }),
        async (docIds) => {
          vi.mocked(apiClient.get).mockImplementation(async (url: any) => {
            const match = String(url).match(/\/kg\/status\/([^?]+)/);
            const docId = match?.[1] || '';
            return {
              data: {
                success: true,
                data: { docId, status: 'completed', createdAt: 't', updatedAt: 't' },
              },
            } as any;
          });

          const result = await apiService.getBatchKGStatus(docIds);
          expect(result.success).toBe(true);
          expect(Array.isArray(result.data)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});
