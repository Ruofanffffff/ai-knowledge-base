import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import fc from 'fast-check';
import { DocumentsList } from '../DocumentsList';
import apiService from '../../services/api';

// Mock the API service
vi.mock('../../services/api');

describe('DocumentsList Page Property Tests', () => {
  const mockOnNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup(); // Clean up DOM after each test
  });

  // Feature: frontend-data-api-migration, Property 15: Data Transformation Correctness
  // Test that API document data is correctly transformed to display format
  test('Property 15: document metadata is correctly transformed for display', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string(),
            name: fc.string({ minLength: 1, maxLength: 64 }).filter(s => s.trim().length > 0).map(s => s.trim()),
            uploadDate: fc.date().map(d => d.toISOString()),
            status: fc.constantFrom('processing', 'completed', 'failed'),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (mockDocuments) => {
          vi.mocked(apiService.getDocuments).mockResolvedValue({
            success: true,
            data: mockDocuments,
          });

          const { unmount } = render(<DocumentsList onNavigate={mockOnNavigate} />);
          try {
            await waitFor(() => {
              expect(apiService.getDocuments).toHaveBeenCalled();
              const firstDoc = mockDocuments[0];
              expect(screen.getByText(firstDoc.name)).toBeInTheDocument();
            });
          } finally {
            unmount();
            cleanup();
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 20000);

  // Feature: frontend-data-api-migration, Property 15: Data Transformation Correctness
  // Test that file sizes are correctly formatted
  test('Property 15: file sizes are correctly formatted', async () => {
    const mockDocuments = [
      {
        id: '1',
        name: 'small.txt',
        uploadDate: new Date().toISOString(),
        status: 'completed' as const,
        size: 1024, // 1 KB
      },
      {
        id: '2',
        name: 'medium.pdf',
        uploadDate: new Date().toISOString(),
        status: 'completed' as const,
        size: 1048576, // 1 MB
      },
      {
        id: '3',
        name: 'large.zip',
        uploadDate: new Date().toISOString(),
        status: 'completed' as const,
        size: 1073741824, // 1 GB
      },
    ];

    vi.mocked(apiService.getDocuments).mockResolvedValue({
      success: true,
      data: mockDocuments,
    });

    render(<DocumentsList onNavigate={mockOnNavigate} />);

    await waitFor(() => {
      // Check that file sizes are formatted correctly
      expect(screen.getByText(/KB/)).toBeInTheDocument();
      expect(screen.getByText(/MB/)).toBeInTheDocument();
      expect(screen.getByText(/GB/)).toBeInTheDocument();
    });
  });

  // Feature: frontend-data-api-migration, Property 15: Data Transformation Correctness
  // Test that dates are correctly formatted
  test('Property 15: dates are correctly formatted', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const mockDocuments = [
      {
        id: '1',
        name: 'today.txt',
        uploadDate: now.toISOString(),
        status: 'completed' as const,
      },
      {
        id: '2',
        name: 'yesterday.txt',
        uploadDate: yesterday.toISOString(),
        status: 'completed' as const,
      },
      {
        id: '3',
        name: 'lastweek.txt',
        uploadDate: lastWeek.toISOString(),
        status: 'completed' as const,
      },
    ];

    vi.mocked(apiService.getDocuments).mockResolvedValue({
      success: true,
      data: mockDocuments,
    });

    render(<DocumentsList onNavigate={mockOnNavigate} />);

    await waitFor(() => {
      // Check that dates are formatted correctly
      expect(screen.getByText('今天')).toBeInTheDocument();
      expect(screen.getByText('昨天')).toBeInTheDocument();
    });
  });

  // Feature: frontend-data-api-migration, Property 3: Component Data Fetching
  // Test that component fetches documents on mount
  test('Property 3: component fetches documents on mount', async () => {
    vi.mocked(apiService.getDocuments).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<DocumentsList onNavigate={mockOnNavigate} />);

    await waitFor(() => {
      expect(apiService.getDocuments).toHaveBeenCalledTimes(1);
    });
  });

  // Feature: frontend-data-api-migration, Property 8: Loading State Management
  // Test that loading state is displayed during fetch
  test('Property 8: displays loading state while fetching data', async () => {
    const neverResolve = new Promise(() => {});

    vi.mocked(apiService.getDocuments).mockReturnValue(neverResolve as any);

    render(<DocumentsList onNavigate={mockOnNavigate} />);

    expect(screen.getByText(/加载文档中/i)).toBeInTheDocument();
  });

  // Feature: frontend-data-api-migration, Property 9: Error State Display
  // Test that error state is displayed on fetch failure
  test('Property 9: displays error state when fetch fails', async () => {
    const errorMessage = '网络连接失败';

    vi.mocked(apiService.getDocuments).mockResolvedValue({
      success: false,
      error: errorMessage,
    });

    render(<DocumentsList onNavigate={mockOnNavigate} />);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  // Feature: frontend-data-api-migration, Property 10: Empty State Display
  // Test that empty state is displayed when no documents exist
  test('Property 10: displays empty state when no documents exist', async () => {
    vi.mocked(apiService.getDocuments).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<DocumentsList onNavigate={mockOnNavigate} />);

    await waitFor(() => {
      expect(screen.getByText(/还没有上传任何文档/i)).toBeInTheDocument();
    });
  });

  // Feature: frontend-data-api-migration, Property 15: Data Transformation Correctness
  // Test that document types are correctly identified
  test('Property 15: document types are correctly identified', async () => {
    const mockDocuments = [
      {
        id: '1',
        name: 'document.pdf',
        fileType: 'pdf',
        uploadDate: new Date().toISOString(),
        status: 'completed' as const,
      },
      {
        id: '2',
        name: 'image.jpg',
        fileType: 'jpg',
        uploadDate: new Date().toISOString(),
        status: 'completed' as const,
      },
      {
        id: '3',
        name: 'document.docx',
        fileType: 'docx',
        uploadDate: new Date().toISOString(),
        status: 'completed' as const,
      },
    ];

    vi.mocked(apiService.getDocuments).mockResolvedValue({
      success: true,
      data: mockDocuments,
    });

    render(<DocumentsList onNavigate={mockOnNavigate} />);

    await waitFor(() => {
      // All documents should be displayed
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('image.jpg')).toBeInTheDocument();
      expect(screen.getByText('document.docx')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Feature: frontend-data-api-migration, Property 16: Operation-Triggered Refetch
  // **Validates: Requirements 8.3**
  // For any data mutation operation (create, update, delete), 
  // the component triggers a refetch of the affected data from the API.
  // ============================================================================

  test('Property 16: refetches documents after successful upload', async () => {
    // Initial documents
    const initialDocs = [
      {
        id: '1',
        name: 'existing-doc.pdf',
        uploadDate: new Date().toISOString(),
        status: 'completed' as const,
        size: 1000,
        fileType: 'application/pdf',
      },
    ];

    // Mock initial fetch
    vi.mocked(apiService.getDocuments).mockResolvedValueOnce({
      success: true,
      data: initialDocs,
    });

    const { container } = render(<DocumentsList onNavigate={mockOnNavigate} />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getAllByText('existing-doc.pdf')[0]).toBeInTheDocument();
    });

    // Verify initial API call
    expect(apiService.getDocuments).toHaveBeenCalledTimes(1);

    // Mock upload response
    vi.mocked(apiService.uploadDocument).mockResolvedValueOnce({
      success: true,
      data: {
        id: 'uploaded-1',
        name: 'new-file.pdf',
        uploadDate: new Date().toISOString(),
        status: 'completed' as const,
        size: 2000,
      },
    });

    // Mock refetch after upload
    const updatedDocs = [
      ...initialDocs,
      {
        id: 'uploaded-1',
        name: 'new-file.pdf',
        uploadDate: new Date().toISOString(),
        status: 'completed' as const,
        size: 2000,
        fileType: 'application/pdf',
      },
    ];

    vi.mocked(apiService.getDocuments).mockResolvedValueOnce({
      success: true,
      data: updatedDocs,
    });

    // Simulate file upload
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const file = new File(['content'], 'new-file.pdf', { type: 'application/pdf' });

    // Upload file
    const changeEvent = new Event('change', { bubbles: true });
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    fileInput.dispatchEvent(changeEvent);

    // Wait for upload to complete and refetch to happen
    await waitFor(
      () => {
        // Should have called getDocuments: 1 (initial) + 1 (refetch)
        expect(apiService.getDocuments).toHaveBeenCalledTimes(2);
      },
      { timeout: 5000 }
    );

    // Verify upload was called
    expect(apiService.uploadDocument).toHaveBeenCalledTimes(1);
  }, 10000); // 10 second timeout

  test('Property 16: does not refetch after upload failure', async () => {
    // Initial documents
    const initialDocs = [
      {
        id: '1',
        name: 'existing-doc.pdf',
        uploadDate: new Date().toISOString(),
        status: 'completed' as const,
        size: 1000,
        fileType: 'application/pdf',
      },
    ];

    // Mock initial fetch
    vi.mocked(apiService.getDocuments).mockResolvedValueOnce({
      success: true,
      data: initialDocs,
    });

    const { container } = render(<DocumentsList onNavigate={mockOnNavigate} />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getAllByText('existing-doc.pdf')[0]).toBeInTheDocument();
    });

    // Mock upload failure
    vi.mocked(apiService.uploadDocument).mockResolvedValueOnce({
      success: false,
      error: 'Upload failed',
    });

    // Simulate file upload
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test-file.pdf', { type: 'application/pdf' });

    const changeEvent = new Event('change', { bubbles: true });
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    fileInput.dispatchEvent(changeEvent);

    // Wait for upload to fail
    await waitFor(
      () => {
        expect(apiService.uploadDocument).toHaveBeenCalledTimes(1);
      },
      { timeout: 3000 }
    );

    // Give it a bit more time to ensure no refetch happens
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should NOT trigger refetch on failure
    // Only initial fetch should have been called
    expect(apiService.getDocuments).toHaveBeenCalledTimes(1);
  }, 10000); // 10 second timeout
});
