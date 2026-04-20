import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-stone-900/40 backdrop-blur-sm"
            onClick={onCancel}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl pointer-events-auto border border-stone-100"
            >
              <div className="p-6 pb-4 text-center">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-stone-900">{title}</h3>
                {message && (
                  <p className="text-sm text-stone-500 mt-2">{message}</p>
                )}
              </div>
              <div className="p-4 bg-stone-50 flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 px-4 bg-white text-stone-700 rounded-xl font-bold text-sm tracking-wide border border-stone-200 hover:bg-stone-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onCancel();
                  }}
                  className="flex-1 py-3 px-4 bg-red-500 text-white rounded-xl font-bold text-sm tracking-wide hover:bg-red-600 shadow-lg shadow-red-200 transition-all active:scale-[0.98]"
                >
                  Xóa
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
