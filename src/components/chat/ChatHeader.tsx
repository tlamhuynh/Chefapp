import React from 'react';
import { Menu, Search, Trash2, Globe, Pencil, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ConversationData } from '../../types/chat';

interface ChatHeaderProps {
  setShowHistory: (show: boolean) => void;
  activeConversation: ConversationData | undefined;
  editingTitle: boolean;
  setEditingTitle: (editing: boolean) => void;
  tempTitle: string;
  setTempTitle: (title: string) => void;
  updateConversationTitle: (id: string, title: string) => void;
  showDeleteConfirm: string | 'all' | null;
  setShowDeleteConfirm: (id: string | 'all' | null) => void;
  deleteConversation: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isRecipeCrawActive: boolean;
  setIsRecipeCrawActive: (active: boolean) => void;
  createNewConversation: () => void;
}

export function ChatHeader({
  setShowHistory,
  activeConversation,
  editingTitle,
  setEditingTitle,
  tempTitle,
  setTempTitle,
  updateConversationTitle,
  showDeleteConfirm,
  setShowDeleteConfirm,
  deleteConversation,
  searchQuery,
  setSearchQuery,
  isRecipeCrawActive,
  setIsRecipeCrawActive,
  createNewConversation
}: ChatHeaderProps) {
  return (
    <header className="h-16 px-4 md:px-12 flex items-center justify-between z-30 sticky top-0 bg-white/10 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setShowHistory(true)}
          className="lg:hidden w-10 h-10 rounded-xl bg-white border border-neutral-100 flex items-center justify-center shadow-sm pointer-events-auto"
        >
          <Menu className="w-5 h-5 text-neutral-400" />
        </button>
        <div className="flex flex-col">
          <div className="flex items-center gap-2 group pointer-events-auto">
             {editingTitle ? (
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={() => activeConversation && updateConversationTitle(activeConversation.id, tempTitle)}
                onKeyDown={(e) => e.key === 'Enter' && activeConversation && updateConversationTitle(activeConversation.id, tempTitle)}
                autoFocus
                className="text-lg font-display font-semibold text-neutral-900 border-b border-neutral-900 focus:outline-none bg-transparent"
              />
            ) : (
              <h1 
                className="font-display font-semibold text-xl text-neutral-900 cursor-pointer"
                onClick={() => {
                    if (activeConversation) {
                      setTempTitle(activeConversation.title || '');
                      setEditingTitle(true);
                    }
                }}
              >
                {activeConversation?.title || "Bếp trưởng AI"}
              </h1>
            )}
            <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-neutral-50 rounded transition-all">
              <Pencil className="w-3 h-3 text-neutral-300" />
            </button>
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-300">Đã đồng bộ với Cloud</p>
        </div>
      </div>

      <div className="flex items-center gap-2 pointer-events-auto">
        <button 
          onClick={() => createNewConversation()}
          title="Tạo phiên mới"
          className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center hover:bg-neutral-800 transition-all shadow-sm"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setIsRecipeCrawActive(!isRecipeCrawActive)}
          title="Thu thập công thức từ URL"
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
            isRecipeCrawActive ? "bg-neutral-900 text-white shadow-lg" : "hover:bg-neutral-50 text-neutral-300"
          )}
        >
           <Globe className="w-5 h-5" />
        </button>
        {activeConversation && (
          <button 
            onClick={() => setShowDeleteConfirm(activeConversation.id)}
            title="Xóa hội thoại"
            className="w-10 h-10 rounded-full hover:bg-neutral-50 text-neutral-300 hover:text-neutral-900 transition-all flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-300" />
          <input
            type="text"
            placeholder="Tìm trong phiên chat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-neutral-50 border-none rounded-full py-2 pl-9 pr-4 text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-neutral-200 transition-all w-48"
          />
        </div>
      </div>
    </header>
  );
}
