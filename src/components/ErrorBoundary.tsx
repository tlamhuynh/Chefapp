import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Cập nhật state để lần render tiếp theo hiển thị UI dự phòng
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log lỗi ra console hoặc gửi đến service tracking (Sentry, v.v.)
    console.error(`[ErrorBoundary:${this.props.name || 'App'}] Uncaught error:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      // Hiển thị UI dự phòng nếu có lỗi
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center', 
          fontFamily: 'sans-serif',
          backgroundColor: '#fff5f5',
          color: '#c53030',
          borderRadius: '8px',
          margin: '1rem'
        }}>
          <h2>Đã xảy ra lỗi không mong muốn</h2>
          <p>Xin vui lòng thử tải lại trang.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              backgroundColor: '#e53e3e',
              color: 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            Tải lại trang
          </button>
          {/* Chỉ hiển thị chi tiết lỗi ở môi trường dev */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ marginTop: '1rem', textAlign: 'left', fontSize: '0.8rem' }}>
              <summary>Chi tiết lỗi (Dev only)</summary>
              <pre>{this.state.error.toString()}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
