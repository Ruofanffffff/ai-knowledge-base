import { describe, it, expect, afterEach, vi } from 'vitest';
import { uploadApi } from './upload';
import type { Document } from './types';

// Mock the API client
vi.mock('./client', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('uploadApi', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const mockDocument: Document = {
        id: '1',
        title: 'uploaded-file.pdf',
        content: 'File content',
        type: 'document',
        fileType: '.pdf',
        metadata: {},
        tags: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockResponse: { data: Document } = {
        data: mockDocument,
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const result = await uploadApi.uploadFile(file);

      expect(result).toEqual(mockDocument);
      expect(result.title).toBe('uploaded-file.pdf');
      expect(result.fileType).toBe('.pdf');
      
      // Verify the API was called with FormData
      expect(apiClient.default.post).toHaveBeenCalledWith(
        '/upload',
        expect.any(FormData),
        expect.objectContaining({
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      );
    });

    it('should call progress callback during upload', async () => {
      const mockDocument: Document = {
        id: '2',
        title: 'test.txt',
        content: 'Test content',
        type: 'document',
        fileType: '.txt',
        metadata: {},
        tags: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockResponse: { data: Document } = {
        data: mockDocument,
      };

      const apiClient = await import('./client');
      
      // Mock the post method to capture the config and simulate progress
      vi.mocked(apiClient.default.post).mockImplementation(async (_url, _data, config) => {
        // Simulate upload progress
        if (config?.onUploadProgress) {
          config.onUploadProgress({ loaded: 50, total: 100 } as any);
          config.onUploadProgress({ loaded: 100, total: 100 } as any);
        }
        return mockResponse;
      });

      const progressCallback = vi.fn();
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      await uploadApi.uploadFile(file, progressCallback);

      // Verify progress callback was called with correct percentages
      expect(progressCallback).toHaveBeenCalledWith(50);
      expect(progressCallback).toHaveBeenCalledWith(100);
      expect(progressCallback).toHaveBeenCalledTimes(2);
    });

    it('should work without progress callback', async () => {
      const mockDocument: Document = {
        id: '3',
        title: 'no-progress.md',
        content: 'Content',
        type: 'document',
        fileType: '.md',
        metadata: {},
        tags: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockResponse: { data: Document } = {
        data: mockDocument,
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      const file = new File(['markdown content'], 'test.md', { type: 'text/markdown' });
      const result = await uploadApi.uploadFile(file);

      expect(result).toEqual(mockDocument);
      expect(result.title).toBe('no-progress.md');
    });

    it('should handle upload errors', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockRejectedValue(
        new Error('File too large')
      );

      const file = new File(['large content'], 'large.pdf', { type: 'application/pdf' });

      await expect(
        uploadApi.uploadFile(file)
      ).rejects.toThrow('File too large');
    });

    it('should not call progress callback when total is undefined', async () => {
      const mockDocument: Document = {
        id: '4',
        title: 'test.txt',
        content: 'Test',
        type: 'document',
        fileType: '.txt',
        metadata: {},
        tags: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockResponse: { data: Document } = {
        data: mockDocument,
      };

      const apiClient = await import('./client');
      
      // Mock with undefined total
      vi.mocked(apiClient.default.post).mockImplementation(async (_url, _data, config) => {
        if (config?.onUploadProgress) {
          config.onUploadProgress({ loaded: 50, total: undefined } as any);
        }
        return mockResponse;
      });

      const progressCallback = vi.fn();
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      await uploadApi.uploadFile(file, progressCallback);

      // Progress callback should not be called when total is undefined
      expect(progressCallback).not.toHaveBeenCalled();
    });

    it('should create FormData with correct file', async () => {
      const mockDocument: Document = {
        id: '5',
        title: 'image.png',
        content: '',
        type: 'document',
        fileType: '.png',
        metadata: {},
        tags: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockResponse: { data: Document } = {
        data: mockDocument,
      };

      const apiClient = await import('./client');
      let capturedFormData: FormData | undefined;
      
      vi.mocked(apiClient.default.post).mockImplementation(async (_url, data) => {
        capturedFormData = data as FormData;
        return mockResponse;
      });

      const file = new File(['image data'], 'image.png', { type: 'image/png' });
      await uploadApi.uploadFile(file);

      // Verify FormData contains the file
      expect(capturedFormData).toBeInstanceOf(FormData);
      if (capturedFormData) {
        expect(capturedFormData.get('file')).toBe(file);
      }
    });
  });
});
