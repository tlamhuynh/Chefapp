import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, AlertTriangle, X, Terminal, BrainCircuit, FileSearch } from 'lucide-react';
import { analyzeMenuImage, analyzeInvoiceImage } from '../lib/gemini';
import { cn } from '../lib/utils';

export interface AnalysisState {
  isAnalyzing: boolean;
  progress: number; // 0 to 100
  status: string;
  error: string | null;
  result: any | null;
  fileName: string;
  thumbnail?: string;
}

interface AnalysisAgentProps {
  onComplete: (result: any, isInvoice: boolean) => void;
}

export const AnalysisAgent = ({ onComplete }: AnalysisAgentProps) => {
  const [state, setState] = useState<AnalysisState>({
    isAnalyzing: false,
    progress: 0,
    status: 'Ready',
    error: null,
    result: null,
    fileName: ''
  });

  const [isVisible, setIsVisible] = useState(false);

  // Expose function to global window so MenuManagement can trigger it
  useEffect(() => {
    (window as any).startMenuAnalysis = async (file: File, isInvoice: boolean, config?: any, modelId?: string) => {
      setState({
        isAnalyzing: true,
        progress: 10,
        status: 'Đang đọc tệp tin...',
        error: null,
        result: null,
        fileName: file.name
      });
      setIsVisible(true);

      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          setState(prev => ({ ...prev, progress: 30, status: 'Đang gửi cho Subagent AI...', thumbnail: dataUrl }));
          const base64 = dataUrl.split(',')[1];
          
          try {
            const result = isInvoice 
              ? await analyzeInvoiceImage(base64, file.type, config, modelId)
              : await analyzeMenuImage(base64, file.type, config, modelId);
            
            setState(prev => ({ 
              ...prev, 
              progress: 100, 
              status: 'Hoàn tất phân tích!',
              result 
            }));

            // Notify parent / global system
            onComplete(result, isInvoice);
            
            // Auto hide after 5 seconds
            setTimeout(() => {
              setIsVisible(false);
              setState(prev => ({ ...prev, isAnalyzing: false }));
            }, 5000);

          } catch (err: any) {
            setState(prev => ({ 
              ...prev, 
              isAnalyzing: false, 
              error: err.message || 'Lỗi phân tích AI', 
              status: 'Thất bại' 
            }));
          }
        };
        reader.readAsDataURL(file);
      } catch (err: any) {
        setState(prev => ({ 
          ...prev, 
          isAnalyzing: false, 
          error: err.message, 
          status: 'Lỗi nạp file' 
        }));
      }
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 right-4 z-[60] w-72 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-500/20 rounded-lg">
                  <BrainCircuit className="w-4 h-4 text-orange-500" />
                </div>
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Subagent Phân Tích</span>
              </div>
              <button 
                onClick={() => setIsVisible(false)}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-3 items-center bg-neutral-800/50 p-2 rounded-xl border border-neutral-800">
              {state.thumbnail ? (
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-neutral-700 bg-neutral-900 flex items-center justify-center">
                  <img src={state.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg shrink-0 border border-neutral-700 bg-neutral-900 flex items-center justify-center">
                  <FileSearch className="w-4 h-4 text-neutral-500" />
                </div>
              )}
              
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-neutral-300 font-medium truncate pr-2">{state.fileName}</span>
                  <span className="text-orange-500 font-bold shrink-0">{state.progress}%</span>
                </div>
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${state.progress}%` }}
                    className="h-full bg-orange-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {state.error ? (
                <AlertTriangle className="w-3 h-3 text-red-500" />
              ) : state.progress === 100 ? (
                <CheckCircle2 className="w-3 h-3 text-green-500" />
              ) : (
                <Loader2 className="w-3 h-3 text-orange-500 animate-spin" />
              )}
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-tight",
                state.error ? "text-red-400" : "text-neutral-300"
              )}>
                {state.error || state.status}
              </span>
            </div>

            {state.progress === 100 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pt-2 border-t border-neutral-800"
              >
                <p className="text-[8px] text-neutral-500 leading-tight italic">
                  Dữ liệu đã sẵn sàng trong tab Menu. Bạn có thể tiếp tục công việc khác.
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
