import React from 'react';
import { render, screen } from '@testing-library/react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};

class ErrorBoundary extends React.Component<ErrorBoundaryProps, { hasError: boolean }> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div data-testid="error-boundary-fallback">Something went wrong.</div>;
    }

    return this.props.children;
  }
}

// A component that will throw an error
const ErrorComponent = () => {
  throw new Error('Test Error');
};

// A component that won't throw an error
const SafeComponent = () => <div>Safe Component</div>;

describe('ErrorBoundary', () => {
  // Suppress console errors during tests
  const originalError = console.error;
  const mockError = jest.fn();
  
  beforeAll(() => {
    console.error = jest.fn();
    // Mock console.error to avoid error logs in test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    console.error = originalError;
  });

  test('renders children when there is no error', () => {
    render(
      <ErrorBoundary onError={mockError}>
        <SafeComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Safe Component')).toBeInTheDocument();
    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument();
    expect(mockError).not.toHaveBeenCalled();
  });

  test('renders fallback when child throws an error', () => {
    // Mock console.error to avoid error logs in test output
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ErrorBoundary onError={mockError}>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    expect(mockError).toHaveBeenCalled();
    
    errorSpy.mockRestore();
  });

  test('renders custom fallback when provided', () => {
    // Mock console.error to avoid error logs in test output
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const customFallback = <div data-testid="custom-fallback">Custom Error Message</div>;
    
    render(
      <ErrorBoundary fallback={customFallback} onError={mockError}>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('Custom Error Message')).toBeInTheDocument();
    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument();
    expect(mockError).toHaveBeenCalled();
    
    errorSpy.mockRestore();
  });

  test('calls onError when child throws an error', () => {
    // Mock console.error to avoid error logs in test output
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockOnError = jest.fn();
    
    render(
      <ErrorBoundary onError={mockOnError}>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(mockOnError).toHaveBeenCalledTimes(1);
    expect(mockOnError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
    
    errorSpy.mockRestore();
  });
});
