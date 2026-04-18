import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Trash2, ChevronDown, ChevronRight, AlertCircle, Info, Bug, AlertTriangle } from 'lucide-react';
import { logger, LogEntry } from '../lib/logger';
import { cn } from '../lib/utils';

export function DebugLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'error' | 'info' | 'debug'>('all');

  useEffect(() => {
    setLogs(logger.getLogs());
    const unsubscribe = logger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return () => unsubscribe();
  }, []);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedLogs(newExpanded);
  };

  const clearLogs = () => {
    logger.clear();
    setExpandedLogs(new Set());
  };

  const filteredLogs = logs.filter(log => filter === 'all' || log.level === filter);

  const getIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warn': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'debug': return <Bug className="w-4 h-4 text-purple-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] bg-stone-950 rounded-3xl overflow-hidden border border-stone-800 flex flex-col text-stone-300 font-mono text-xs">
      <header className="px-6 py-4 border-b border-stone-800 flex justify-between items-center bg-stone-900">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-stone-400" />
          <h1 className="text-lg font-bold text-stone-100 tracking-tight font-sans">Debug Logs</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-stone-950 rounded-lg p-1 border border-stone-800">
            {(['all', 'info', 'debug', 'error'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-md capitalize transition-colors font-sans font-medium",
                  filter === f ? "bg-stone-800 text-stone-100" : "text-stone-500 hover:text-stone-300"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={clearLogs}
            className="p-2 text-stone-500 hover:text-red-400 hover:bg-stone-800 rounded-lg transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <AnimatePresence>
          {filteredLogs.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-stone-600 space-y-2"
            >
              <Terminal className="w-8 h-8 opacity-50" />
              <p className="font-sans">No logs available</p>
            </motion.div>
          ) : (
            filteredLogs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "rounded-lg border overflow-hidden",
                  log.level === 'error' ? "bg-red-950/20 border-red-900/50" :
                  log.level === 'warn' ? "bg-yellow-950/20 border-yellow-900/50" :
                  "bg-stone-900/50 border-stone-800"
                )}
              >
                <div 
                  className="flex items-start gap-3 p-3 cursor-pointer hover:bg-stone-800/50 transition-colors"
                  onClick={() => toggleExpand(log.id)}
                >
                  <div className="mt-0.5">{getIcon(log.level)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-stone-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      {log.category && (
                        <span className="px-1.5 py-0.5 bg-stone-800 text-stone-300 rounded text-[10px] font-bold uppercase tracking-wider">
                          {log.category}
                        </span>
                      )}
                      <span className={cn(
                        "font-medium truncate",
                        log.level === 'error' ? "text-red-400" :
                        log.level === 'warn' ? "text-yellow-400" :
                        "text-stone-300"
                      )}>
                        {log.message}
                      </span>
                    </div>
                  </div>
                  {log.data && (
                    <div className="shrink-0 text-stone-500">
                      {expandedLogs.has(log.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  )}
                </div>
                
                {log.data && expandedLogs.has(log.id) && (
                  <div className="p-3 pt-0 border-t border-stone-800/50 bg-stone-950/50 overflow-x-auto">
                    <pre className="text-[10px] leading-relaxed text-stone-400 mt-2">
                      {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                    </pre>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
