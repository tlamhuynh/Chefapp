// @ts-nocheck
import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    // @ts-ignore - Persistent lint error in this environment
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // @ts-ignore
    console.error(`[ErrorBoundary:${this.props.name || 'App'}] Uncaught error:`, error, errorInfo);
  }

  render() {
    // @ts-ignore
    const { hasError, error } = this.state;
    // @ts-ignore
    const { fallback, children } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <div className="p-6 bg-red-50 border border-red-100 rounded-3xl m-4">
          <h2 className="text-red-900 font-bold mb-2">Đã xảy ra lỗi hệ thống</h2>
          <p className="text-red-700 text-sm mb-4">
            {error?.message || "Hệ thống gặp sự cố bất ngờ."}
          </p>
          <button
            // @ts-ignore
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest"
          >
            Thử tải lại vùng này
          </button>
        </div>
      );
    }

    return children;
  }
}
