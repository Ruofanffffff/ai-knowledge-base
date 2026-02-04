import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorModal } from './ErrorModal';
import { ErrorProvider, useError } from '../../contexts/ErrorContext';
import React from 'react';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock Radix UI Dialog to simplify testing
vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  Portal: ({ children }: any) => <div>{children}</div>,
  Overlay: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Content: ({ children, ...props }: any) => <div role="dialog" {...props}>{children}</div>,
  Title: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
  Description: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  Close: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

describe('ErrorModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should not render when there is no error', () => {
    render(
      <ErrorProvider>
        <ErrorModal />
      </ErrorProvider>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render error modal with correct content', () => {
    const TestComponent = () => {
      const { showError } = useError();
      React.useEffect(() => {
        showError({
          title: 'Test Error',
          message: 'This is a test error message',
          type: 'error',
        });
      }, [showError]);
      return <ErrorModal />;
    };

    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    );

    expect(screen.getByText('Test Error')).toBeInTheDocument();
    expect(screen.getByText('This is a test error message')).toBeInTheDocument();
  });

  it('should close modal when close button is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    
    const TestComponent = () => {
      const { showError } = useError();
      React.useEffect(() => {
        showError({
          title: 'Test Error',
          message: 'This is a test error message',
          type: 'error',
        });
      }, [showError]);
      return <ErrorModal />;
    };

    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    );

    expect(screen.getByText('Test Error')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Test Error')).not.toBeInTheDocument();
    });
  });

  it('should auto-dismiss info messages after 5 seconds', async () => {
    const TestComponent = () => {
      const { showError } = useError();
      React.useEffect(() => {
        showError({
          title: 'Info Message',
          message: 'This is an info message',
          type: 'info',
        });
      }, [showError]);
      return <ErrorModal />;
    };

    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    );

    expect(screen.getByText('Info Message')).toBeInTheDocument();

    // Fast-forward time by 5 seconds
    vi.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(screen.queryByText('Info Message')).not.toBeInTheDocument();
    });
  });

  it('should display technical details when provided', () => {
    const TestComponent = () => {
      const { showError } = useError();
      React.useEffect(() => {
        showError({
          title: 'Error with Details',
          message: 'An error occurred',
          type: 'error',
          details: 'Stack trace here',
        });
      }, [showError]);
      return <ErrorModal />;
    };

    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    );

    expect(screen.getByText('Technical Details')).toBeInTheDocument();
    expect(screen.getByText('Stack trace here')).toBeInTheDocument();
  });

  it('should render different icons for different error types', () => {
    const TestComponent = ({ type }: { type: 'error' | 'warning' | 'info' }) => {
      const { showError } = useError();
      React.useEffect(() => {
        showError({
          title: `${type} message`,
          message: 'Test message',
          type,
        });
      }, [showError, type]);
      return <ErrorModal />;
    };

    // Test error icon
    const { rerender } = render(
      <ErrorProvider>
        <TestComponent type="error" />
      </ErrorProvider>
    );
    expect(document.querySelector('.error-icon.error')).toBeInTheDocument();

    // Test warning icon
    rerender(
      <ErrorProvider>
        <TestComponent type="warning" />
      </ErrorProvider>
    );
    expect(document.querySelector('.error-icon.warning')).toBeInTheDocument();

    // Test info icon
    rerender(
      <ErrorProvider>
        <TestComponent type="info" />
      </ErrorProvider>
    );
    expect(document.querySelector('.error-icon.info')).toBeInTheDocument();
  });

  it('should show OK button for info messages and Close button for others', () => {
    const TestComponent = ({ type }: { type: 'error' | 'warning' | 'info' }) => {
      const { showError } = useError();
      React.useEffect(() => {
        showError({
          title: 'Test',
          message: 'Test message',
          type,
        });
      }, [showError, type]);
      return <ErrorModal />;
    };

    // Test info message shows OK button
    const { rerender } = render(
      <ErrorProvider>
        <TestComponent type="info" />
      </ErrorProvider>
    );
    expect(screen.getByRole('button', { name: /ok/i })).toBeInTheDocument();

    // Test error message shows Close button
    rerender(
      <ErrorProvider>
        <TestComponent type="error" />
      </ErrorProvider>
    );
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });
});
