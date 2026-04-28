import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCcw, AlertOctagon, Trash2, Home, Sparkles, Settings } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isReloading: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isReloading: false
    };
  }

  public static getDerivedStateFromError(error: any): State {
    // Ensure error is an Error object even if something else was thrown
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    return { hasError: true, error: normalizedError, isReloading: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name || 'App'}] Uncaught error:`, error, errorInfo);
    
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        // Safe logging
        const errorData = {
          message: error?.message || 'Unknown error',
          stack: error?.stack || 'No stack trace available',
          componentStack: errorInfo?.componentStack || 'No component stack',
          time: new Date().toISOString()
        };
        sessionStorage.setItem('last_crash_error', JSON.stringify(errorData));

        // Automatic retry logic
        const crashCount = parseInt(sessionStorage.getItem('recurrent_crash_count') || '0');
        const lastCrashTime = parseInt(sessionStorage.getItem('last_crash_timestamp') || '0');
        const now = Date.now();
        
        // If crash repeat within 10s, increase count
        if (now - lastCrashTime < 10000) {
          sessionStorage.setItem('recurrent_crash_count', (crashCount + 1).toString());
        } else {
          sessionStorage.setItem('recurrent_crash_count', '1');
        }
        sessionStorage.setItem('last_crash_timestamp', now.toString());

        const errStr = (error?.message || '').toLowerCase();
        const isNetworkError = errStr.includes("load") || errStr.includes("fetch") || errStr.includes("network") || errStr.includes("firebase") || errStr.includes("permissions");
        const isAIModelError = errStr.includes("model") || errStr.includes("ai") || errStr.includes("token") || errStr.includes("limit") || errStr.includes("gemini") || errStr.includes("safety");
        
        // Auto reload only on first crash if it's transient
        if (crashCount < 1 && (isNetworkError || isAIModelError)) {
          setTimeout(() => {
            window.location.reload();
          }, 800);
          return;
        }
      }
    } catch (e) {
      // Ignore errors in error logging
    }
  }

  public resetError = () => {
    try {
      localStorage.removeItem('last_creative_conv_id');
      sessionStorage.removeItem('recurrent_crash_count');
      sessionStorage.removeItem('last_crash_timestamp');
    } catch (e) {}
    this.setState({ hasError: false, error: null, isReloading: false });
  };

  public handleReload = () => {
    this.setState({ isReloading: true });
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  public handleFullReload = () => {
    this.setState({ isReloading: true });
    try {
       localStorage.clear();
       sessionStorage.clear();
    } catch (e) {}
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  public handleOpenSettings = () => {
    this.setState({ isReloading: true });
    // Set a flag in session storage to open settings after reload
    try {
      sessionStorage.setItem('trigger_open_settings', 'true');
    } catch (e) {}
    
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      const errStr = (this.state.error?.message || '').toLowerCase();
      const isQuotaError = errStr.includes("hạn mức") || errStr.includes("quota") || errStr.includes("credits") || errStr.includes("limit");
      const isAIError = isQuotaError || errStr.includes("model") || errStr.includes("ai") || errStr.includes("token") || errStr.includes("gemini") || errStr.includes("safety");

      return (
        <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4 font-sans select-none overflow-hidden text-stone-200">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.08),transparent_70%)] pointer-events-none" />
          
          <div className="max-w-md w-full bg-stone-900 border border-stone-800 rounded-[2.5rem] p-10 relative shadow-2xl overflow-hidden">
            <div className="flex flex-col items-center text-center space-y-8">
              <div className={cn(
                "p-5 rounded-3xl border",
                isQuotaError ? "bg-orange-500/10 border-orange-500/20" : 
                isAIError ? "bg-amber-500/10 border-amber-500/20" : 
                "bg-red-500/10 border-red-500/20"
              )}>
                {isQuotaError ? (
                  <Sparkles className="w-12 h-12 text-orange-500" />
                ) : isAIError ? (
                  <Sparkles className="w-12 h-12 text-amber-500" />
                ) : (
                  <AlertOctagon className="w-12 h-12 text-red-500" />
                )}
              </div>
              
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {isQuotaError ? "Hết Hạn Mức Tạm Thời" : isAIError ? "Mô hình AI đang bận" : "Hệ thống tạm ngắt quãng"}
                </h2>
                <p className="text-stone-400 text-sm leading-relaxed px-4">
                  {isQuotaError
                    ? "Hạn mức API miễn phí đã hết. Quota sẽ tự động reset vào ngày mai. Để tiếp tục ngay, bạn có thể nhập Key cá nhân trong phần Cài đặt."
                    : isAIError 
                    ? "Phản hồi từ AI không đúng định dạng hoặc vượt quá giới hạn an toàn. Vui lòng thử lại sau giây lát hoặc làm mới ứng dụng."
                    : "Đã xảy ra một lỗi nghiêm trọng trong quá trình vận hành. SousChef cần được khởi động lại để phục hồi trạng thái ổn định."}
                </p>
              </div>

              <div className="w-full space-y-3 pt-4">
                {isQuotaError ? (
                   <button 
                   onClick={this.handleOpenSettings}
                   className="w-full py-5 bg-orange-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-orange-600 transition-all active:scale-[0.98]"
                 >
                   <Settings className="w-5 h-5" />
                   Cài đặt API cá nhân
                 </button>
                ) : (
                  <button 
                    onClick={this.handleReload}
                    disabled={this.state.isReloading}
                    className="w-full py-5 bg-white text-stone-950 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-stone-100 transition-all active:scale-[0.98] disabled:opacity-50"
                    id="reload-button"
                  >
                    {this.state.isReloading ? (
                      <RefreshCcw className="w-5 h-5 animate-spin" />
                    ) : (
                      <RefreshCcw className="w-5 h-5" />
                    )}
                    {this.state.isReloading ? "Đang tải lại..." : "Làm mới ứng dụng"}
                  </button>
                )}
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={this.resetError}
                    disabled={this.state.isReloading}
                    className="py-4 bg-stone-800 text-stone-300 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-stone-700 transition-all border border-stone-700 disabled:opacity-50"
                  >
                    <Home className="w-4 h-4" />
                    Thử lại
                  </button>
                  <button 
                    onClick={this.handleFullReload}
                    disabled={this.state.isReloading}
                    className="py-4 bg-red-500/5 text-red-400 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-500/10 transition-all border border-red-500/20 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Xóa sạch Cache
                  </button>
                </div>
              </div>

              {this.state.error && (
                <div className="w-full pt-8 border-t border-white/5 mt-4">
                  <button 
                    onClick={() => {
                      const el = document.getElementById('error-details-summary');
                      if (el) el.classList.toggle('hidden');
                    }}
                    className="text-[10px] uppercase tracking-widest text-stone-500 font-bold hover:text-stone-300 transition-colors py-2 px-4 rounded-full border border-stone-800"
                  >
                    Chi tiết lỗi kỹ thuật
                  </button>
                  <div id="error-details-summary" className="hidden mt-6 text-left">
                    <div className="bg-black/40 border border-white/5 p-5 rounded-2xl max-h-60 overflow-y-auto custom-scrollbar">
                      <div className="text-[11px] font-bold text-red-400 mb-2 font-mono uppercase tracking-wider">
                        {this.state.error?.name || 'Error'}
                      </div>
                      <pre className="text-[10px] text-stone-400 font-mono leading-relaxed whitespace-pre-wrap italic">
                        {this.state.error?.message}
                        {"\n\n"}
                        <span className="opacity-50">STACK TRACE:</span>{"\n"}
                        {this.state.error?.stack || 'No stack trace available'}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="absolute bottom-8 text-[10px] text-stone-600 font-bold uppercase tracking-[0.2em]">
            SousChef AI • Recovery Environment
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

