import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorBoundary } from '../ErrorBoundary';

// Mock console.error to avoid cluttering test output
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

const ThrowError = ({ message = 'Test error' }) => {
  throw new Error(message);
};

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Child component</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders error message when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="This is a test error" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Rất tiếc!')).toBeInTheDocument();
    expect(screen.getByText('This is a test error')).toBeInTheDocument();
  });

  it('renders specific message for Missing or insufficient permissions error', () => {
    const jsonErrorMsg = JSON.stringify({ error: 'Missing or insufficient permissions' });

    render(
      <ErrorBoundary>
        <ThrowError message={jsonErrorMsg} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Rất tiếc!')).toBeInTheDocument();
    expect(screen.getByText('Bạn không có quyền thực hiện hành động này. Vui lòng kiểm tra lại tài khoản.')).toBeInTheDocument();
  });

  it('renders default message if error object is malformed or no specific message is provided', () => {
    // We throw an Error where the message is an invalid JSON but empty
    const EmptyError = () => {
      // Simulate an error without a message property that is accessible or some default case
      // The ErrorBoundary defaults to "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại."
      // if this.state.error?.message is not present, but Error constructors always create a message.
      // However, if we look at the code:
      // if (this.state.error?.message) { errorMessage = this.state.error.message }
      // So if the message is provided, it will use the message.
      // To test the default "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.", we need to throw an object that isn't a standard Error but behaves like one, or an Error with an empty message.
      throw new Error('');
    };

    render(
      <ErrorBoundary>
        <EmptyError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Rất tiếc!')).toBeInTheDocument();
    expect(screen.getByText('Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.')).toBeInTheDocument();
  });

  it('handles reload button click', () => {
    const originalLocation = window.location;
    // @ts-ignore
    delete window.location;
    // @ts-ignore
    window.location = { ...originalLocation, reload: vi.fn() };

    render(
      <ErrorBoundary>
        <ThrowError message="Reload test error" />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByRole('button', { name: /tải lại trang/i });
    fireEvent.click(reloadButton);

    expect(window.location.reload).toHaveBeenCalled();

    // @ts-ignore
    window.location = originalLocation;
  });
});
