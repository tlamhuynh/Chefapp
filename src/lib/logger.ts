export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  category?: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];

  private addLog(level: LogLevel, message: string, data?: any, category?: string) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      level,
      message,
      category,
      data
    };
    this.logs = [entry, ...this.logs].slice(0, 500); // Keep last 500 logs
    this.notifyListeners();
    
    // Also log to console
    const consoleMsg = category ? `[${category}] ${message}` : message;
    if (level === 'error') {
      console.error(consoleMsg, data || '');
    } else if (level === 'warn') {
      console.warn(consoleMsg, data || '');
    } else {
      console.log(`[${level.toUpperCase()}] ${consoleMsg}`, data || '');
    }
  }

  info(message: string, data?: any, category?: string) { this.addLog('info', message, data, category); }
  warn(message: string, data?: any, category?: string) { this.addLog('warn', message, data, category); }
  error(message: string, data?: any, category?: string) { this.addLog('error', message, data, category); }
  debug(message: string, data?: any, category?: string) { this.addLog('debug', message, data, category); }

  captureApiError(source: string, err: any) {
    let message = err?.message || 'Unknown API Error';
    let dataToLog: any = err;
    
    // Categorize common API errors
    if (message.includes('429') || message.toLowerCase().includes('quota')) {
       message = 'Lỗi API: Đã vượt quá hạn mức sử dụng (Quota Exceeded) hoặc Request quá nhanh.';
    } else if (message.includes('401') || message.toLowerCase().includes('key')) {
       message = 'Lỗi API: API Key không hợp lệ hoặc đã hết hạn.';
    } else if (message.includes('503') || message.includes('500')) {
       message = 'Lỗi Server AI: Dịch vụ đang bảo trì hoặc quá tải, vui lòng thử lại sau.';
    }

    if (err.response) {
      // Axios or fetch response
      dataToLog = {
         status: err.response.status,
         statusText: err.response.statusText,
         data: err.response.data || err.response,
         url: err.config?.url
      };
    } else if (err instanceof Error) {
      dataToLog = { name: err.name, message: err.message, stack: err.stack };
    }

    this.addLog('error', message, dataToLog, source);
  }

  getLogs() { return this.logs; }
  
  clear() {
    this.logs = [];
    this.notifyListeners();
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l([...this.logs]));
  }
}

export const logger = new Logger();
