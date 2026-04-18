import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, MessageSquare, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ConversationData } from '../../types/chat';

interface ChatSidebarProps {
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  conversations: ConversationData[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string) => void;
  createNewConversation: () => void;
}

export function ChatSidebar({
  showHistory,
  setShowHistory,
  searchQuery,
  setSearchQuery,
  conversations,
  activeConversationId,
  setActiveConversationId,
  createNewConversation
}: ChatSidebarProps) {
  return (
    <AnimatePresence>
      {showHistory && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHistory(false)}
            className="fixed inset-0 bg-neutral-900/20 backdrop-blur-sm z-[60]"
          />
          <motion.aside
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            className="fixed inset-y-0 left-0 w-80 bg-white shadow-2xl z-[70] flex flex-col"
          >
            <div className="p-8 border-b border-neutral-50 flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold">Nhật ký Bếp</h3>
              <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-neutral-50 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
              <div className="flex items-center gap-2 mb-6 px-4">
                <Search className="w-4 h-4 text-neutral-300" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm hội thoại..." 
                  className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-neutral-300"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {conversations.length === 0 ? (
                <div className="p-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto">
                    <MessageSquare className="w-8 h-8 text-neutral-200" />
                  </div>
                  <p className="text-xs text-neutral-400 font-medium">Không tìm thấy lịch sử</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setActiveConversationId(conv.id);
                      setShowHistory(false);
                    }}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl transition-all group",
                      activeConversationId === conv.id ? "bg-neutral-900 text-white shadow-xl" : "hover:bg-neutral-50"
                    )}
                  >
                    <p className="font-medium text-sm truncate">{conv.title || "Hội thoại chưa đặt tên"}</p>
                    <p className={cn("text-[9px] mt-1 font-bold uppercase tracking-[0.1em]", activeConversationId === conv.id ? "text-neutral-400" : "text-neutral-300")}>
                      {conv.updatedAt?.seconds ? new Date(conv.updatedAt.seconds * 1000).toLocaleDateString('vi-VN') : 'Vừa xong'}
                    </p>
                  </button>
                ))
              )}
            </div>

            <div className="p-6 border-t border-neutral-50">
              <button 
                onClick={createNewConversation}
                className="w-full py-4 bg-neutral-900 text-white rounded-full font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" /> Phiên mới
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
