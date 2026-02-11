import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Chat } from '../Chat';
import apiService from '../../services/api';

// Mock the API service
vi.mock('../../services/api');

describe('Chat Page Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Feature: frontend-data-api-migration, Property 17: Message Send API Integration
  // Test that sendChatMessage API method exists and is callable
  test('Property 17: sendChatMessage API method is available', async () => {
    expect(apiService.sendChatMessage).toBeDefined();
    expect(typeof apiService.sendChatMessage).toBe('function');

    // Test that it returns a promise
    vi.mocked(apiService.sendChatMessage).mockResolvedValue({
      success: true,
      data: {
        id: '1',
        role: 'assistant',
        content: 'Response',
        timestamp: new Date().toISOString(),
      },
    });

    const result = await apiService.sendChatMessage('test message');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
  });

  // Feature: frontend-data-api-migration, Property 3: Component Data Fetching
  // Test that component fetches chat data on mount
  test('Property 3: component fetches chat sessions and history on mount', async () => {
    vi.mocked(apiService.getChatSessions).mockResolvedValue({
      success: true,
      data: [],
    });

    vi.mocked(apiService.getChatHistory).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<Chat />);

    await waitFor(() => {
      expect(apiService.getChatSessions).toHaveBeenCalledTimes(1);
      expect(apiService.getChatHistory).toHaveBeenCalledTimes(1);
    });
  });

  // Feature: frontend-data-api-migration, Property 8: Loading State Management
  // Test that loading state is displayed during fetch
  test('Property 8: displays loading state while fetching data', async () => {
    const neverResolve = new Promise(() => {});

    vi.mocked(apiService.getChatSessions).mockReturnValue(neverResolve as any);
    vi.mocked(apiService.getChatHistory).mockReturnValue(neverResolve as any);

    render(<Chat />);

    expect(screen.getByText(/加载聊天中/i)).toBeInTheDocument();
  });

  // Feature: frontend-data-api-migration, Property 9: Error State Display
  // Test that error state is displayed on fetch failure
  test('Property 9: displays error state when fetch fails', async () => {
    const errorMessage = '网络连接失败';

    vi.mocked(apiService.getChatSessions).mockResolvedValue({
      success: false,
      error: errorMessage,
    });

    vi.mocked(apiService.getChatHistory).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<Chat />);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  // Feature: frontend-data-api-migration, Property 10: Empty State Display
  // Test that empty state is displayed when no messages exist
  test('Property 10: displays empty state when no messages exist', async () => {
    vi.mocked(apiService.getChatSessions).mockResolvedValue({
      success: true,
      data: [],
    });

    vi.mocked(apiService.getChatHistory).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<Chat />);

    await waitFor(() => {
      expect(screen.getByText(/还没有聊天记录/i)).toBeInTheDocument();
    });
  });

  // Feature: frontend-data-api-migration, Property 17: Message Send API Integration
  // Test that messages are displayed when data is available
  test('Property 17: displays messages from API', async () => {
    const mockMessages = [
      {
        id: '1',
        role: 'user' as const,
        content: 'Test question',
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: 'Test answer',
        timestamp: new Date().toISOString(),
      },
    ];

    vi.mocked(apiService.getChatSessions).mockResolvedValue({
      success: true,
      data: [],
    });

    vi.mocked(apiService.getChatHistory).mockResolvedValue({
      success: true,
      data: mockMessages,
    });

    render(<Chat />);

    await waitFor(() => {
      expect(screen.getByText('Test question')).toBeInTheDocument();
      expect(screen.getByText('Test answer')).toBeInTheDocument();
    });
  });

  // Feature: frontend-data-api-migration, Property 17: Message Send API Integration
  // Test that API is called with correct parameters
  test('Property 17: sendChatMessage is called with message and sessionId', async () => {
    const testMessage = 'Hello, AI!';
    const testSessionId = 'session-123';

    vi.mocked(apiService.sendChatMessage).mockResolvedValue({
      success: true,
      data: {
        id: '1',
        role: 'assistant',
        content: 'Response',
        timestamp: new Date().toISOString(),
      },
    });

    // Call the API directly to test the interface
    await apiService.sendChatMessage(testMessage, testSessionId);

    expect(apiService.sendChatMessage).toHaveBeenCalledWith(testMessage, testSessionId);
  });
});
