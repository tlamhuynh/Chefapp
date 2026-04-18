import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Paperclip, X, Send, Loader2, Sparkles, Cpu } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ChatInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  selectedFiles: { data: string, mimeType: string, name: string }[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<{ data: string, mimeType: string, name: string }[]>>;
  fileError: string | null;
  setFileError: (error: string | null) => void;
  handleSend: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isProcessing: boolean;
  isActuallyTyping: boolean;
  preferences: any;
}

export function ChatInput({
  inputText,
  setInputText,
  selectedFiles,
  setSelectedFiles,
  fileError,
  setFileError,
  handleSend,
  handleFileChange,
  isProcessing,
  isActuallyTyping,
  preferences
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 md:p-12 md:pt-0 max-w-4xl mx-auto w-full space-y-4">
      <AnimatePresence>
        {(isProcessing || isActuallyTyping) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center gap-3 px-6 py-3 bg-neutral-900 text-white rounded-full w-fit luxury-shadow mx-auto mb-6"
          >
            <div className="relative">
              <Loader2 className="w-4 h-4 animate-spin text-white/40" />
              <Sparkles className="absolute inset-0 w-4 h-4 text-white animate-pulse" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">
              {isActuallyTyping ? "Đang tra cứu kho lưu trữ..." : "Đang tổng hợp kiến thức ẩm thực..."}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-[2.5rem] border border-neutral-100 luxury-shadow-hover transition-all duration-700 focus-within:ring-1 focus-within:ring-neutral-200 p-2 group bg-clip-padding backdrop-blur-3xl overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-100 to-transparent" />
        
        {selectedFiles.length > 0 && (
          <div className="px-6 py-4 flex flex-wrap gap-2 border-b border-neutral-50/50">
            {selectedFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-2 bg-neutral-50 px-3 py-1.5 rounded-full border border-neutral-100">
                <span className="text-[10px] font-bold text-neutral-600 truncate max-w-[100px] uppercase tracking-widest">{file.name}</span>
                <button 
                  onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-neutral-400 hover:text-red-500 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3 p-2">
          <button 
            onClick={() => fileInputRef.current?.click()}
            title="Đính kèm tệp (Ảnh, Hóa đơn, PDF)"
            className="w-12 h-12 rounded-full flex items-center justify-center text-neutral-300 hover:text-neutral-900 border border-transparent hover:border-neutral-100 transition-all active:scale-95"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            multiple 
            accept="image/*,video/*,application/pdf,text/plain"
          />

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={isProcessing ? "Bếp trưởng đang suy nghĩ..." : "Hỏi Bếp trưởng bất cứ điều gì..."}
            disabled={isProcessing}
            className="flex-1 bg-transparent border-none py-4 px-2 focus:ring-0 resize-none max-h-48 min-h-[56px] text-sm text-neutral-900 placeholder:text-neutral-300 font-medium no-scrollbar"
            rows={1}
          />

          <button
            onClick={() => handleSend()}
            disabled={(!inputText.trim() && selectedFiles.length === 0) || isProcessing}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 luxury-shadow-hover active:scale-95",
              inputText.trim() || selectedFiles.length > 0 
                ? "bg-neutral-900 text-white shadow-xl shadow-neutral-900/20" 
                : "bg-neutral-50 text-neutral-300 border border-neutral-100"
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {fileError && (
          <div className="px-8 pb-4">
            <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest animate-pulse">{fileError}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1 bg-neutral-50 rounded-full border border-neutral-100">
             <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
             <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400">Hệ thống Neural Hoạt động</span>
          </div>
          <div className="flex items-center gap-2 group cursor-help">
             <Cpu className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-900 transition-colors" />
             <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-300 group-hover:text-neutral-900 transition-colors">
               Mô hình: {preferences.selectedModelId?.split('/').pop()}
             </span>
          </div>
        </div>
        
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-200">
           Chef Intelligence v4.0.2
        </p>
      </div>
    </div>
  );
}
