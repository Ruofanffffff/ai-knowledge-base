import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Graph } from '../Graph';

let mockUseGraphReturn: any;

vi.mock('../../hooks/useGraph', () => ({
  useGraph: () => mockUseGraphReturn,
}));

const apiClientGet = vi.fn().mockResolvedValue({ data: [] });
vi.mock('../../api/client', () => ({
  default: {
    get: (...args: any[]) => apiClientGet(...args),
  },
}));

vi.mock('../../components/DocumentIndexDrawer', () => ({
  default: () => null,
}));

describe('Graph Page Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGraphReturn = {
      graphData: { nodes: [], links: [] },
      graphMeta: null,
      isLoading: false,
      error: null,
      viewMode: 'unified',
      selectedDocId: null,
      setViewMode: vi.fn(),
      setSelectedDocId: vi.fn(),
      fetchGraphData: vi.fn(),
      fetchUnifiedGraph: vi.fn(),
      fetchDocGraph: vi.fn(),
      unifiedStatus: null,
      unifiedStatusLoading: false,
      unifiedStatusError: null,
      fetchUnifiedStatus: vi.fn(),
      triggerUnified: vi.fn(),
    };
  });

  test('should fetch unified graph and unified status on mount', async () => {
    render(<Graph />);

    await waitFor(() => {
      expect(mockUseGraphReturn.fetchUnifiedGraph).toHaveBeenCalledTimes(1);
      expect(mockUseGraphReturn.fetchUnifiedStatus).toHaveBeenCalledTimes(1);
    });

    expect(apiClientGet).toHaveBeenCalledTimes(1);
  });

  test('should display non-blocking loading indicator when loading', () => {
    mockUseGraphReturn.isLoading = true;
    render(<Graph />);
    expect(screen.getByText('更新数据中...')).toBeInTheDocument();
  });

  test('should display error overlay when fetch fails', async () => {
    mockUseGraphReturn.error = new Error('Failed');
    render(<Graph />);

    await waitFor(() => {
      expect(screen.getByText('加载失败')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });
});
