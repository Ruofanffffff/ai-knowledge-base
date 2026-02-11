import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Graph } from '../Graph';
import apiService from '../../services/api';

// Mock the API service
vi.mock('../../services/api');

describe('Graph Page Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test component fetches data on mount
  test('should fetch graph data when component mounts', async () => {
    const mockNodes = [
      { id: '1', label: 'Node 1', type: 'concept', x: 100, y: 100 },
      { id: '2', label: 'Node 2', type: 'entity', x: 200, y: 200 },
    ];
    
    const mockLinks = [
      { source: '1', target: '2', relation: 'related' },
    ];

    vi.mocked(apiService.getGraphNodes).mockResolvedValue({
      success: true,
      data: mockNodes,
    });

    vi.mocked(apiService.getGraphLinks).mockResolvedValue({
      success: true,
      data: mockLinks,
    });

    render(<Graph />);

    // Verify API methods were called
    await waitFor(() => {
      expect(apiService.getGraphNodes).toHaveBeenCalledTimes(1);
      expect(apiService.getGraphLinks).toHaveBeenCalledTimes(1);
    });
  });

  // Test loading state displays
  test('should display loading state while fetching data', async () => {
    // Create a promise that never resolves to keep loading state
    const neverResolve = new Promise(() => {});
    
    vi.mocked(apiService.getGraphNodes).mockReturnValue(neverResolve as any);
    vi.mocked(apiService.getGraphLinks).mockReturnValue(neverResolve as any);

    render(<Graph />);

    // Verify loading indicator is shown
    expect(screen.getByText(/加载知识图谱中/i)).toBeInTheDocument();
  });

  // Test error state displays
  test('should display error state when fetch fails', async () => {
    const errorMessage = '网络连接失败';
    
    vi.mocked(apiService.getGraphNodes).mockResolvedValue({
      success: false,
      error: errorMessage,
    });

    vi.mocked(apiService.getGraphLinks).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<Graph />);

    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    // Verify retry button is present
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  // Test empty state displays
  test('should display empty state when no data exists', async () => {
    vi.mocked(apiService.getGraphNodes).mockResolvedValue({
      success: true,
      data: [],
    });

    vi.mocked(apiService.getGraphLinks).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<Graph />);

    // Wait for empty state to be displayed
    await waitFor(() => {
      expect(screen.getByText(/知识图谱为空/i)).toBeInTheDocument();
    });
  });

  // Test that API is called with correct parameters
  test('should call API methods without parameters', async () => {
    vi.mocked(apiService.getGraphNodes).mockResolvedValue({
      success: true,
      data: [],
    });

    vi.mocked(apiService.getGraphLinks).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<Graph />);

    await waitFor(() => {
      expect(apiService.getGraphNodes).toHaveBeenCalledWith();
      expect(apiService.getGraphLinks).toHaveBeenCalledWith();
    });
  });

  // Test that both API calls are made
  test('should fetch both nodes and links', async () => {
    vi.mocked(apiService.getGraphNodes).mockResolvedValue({
      success: true,
      data: [],
    });

    vi.mocked(apiService.getGraphLinks).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<Graph />);

    await waitFor(() => {
      expect(apiService.getGraphNodes).toHaveBeenCalledTimes(1);
      expect(apiService.getGraphLinks).toHaveBeenCalledTimes(1);
    });
  });

  // Test error handling for both API calls
  test('should display error if either API call fails', async () => {
    vi.mocked(apiService.getGraphNodes).mockResolvedValue({
      success: true,
      data: [],
    });

    vi.mocked(apiService.getGraphLinks).mockResolvedValue({
      success: false,
      error: 'Failed to load links',
    });

    render(<Graph />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load links/i)).toBeInTheDocument();
    });
  });
});

