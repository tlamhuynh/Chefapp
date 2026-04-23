import React, { useState, useEffect, useRef } from 'react';
import { creativeAgentInstruction } from '../lib/gemini';
import { chatWithAIWithFallback, AVAILABLE_MODELS } from '../lib/ai';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Palette, Sparkles, User, Loader2, X, 
  AlertCircle, MessageSquare, Plus, Trash2, Edit2, 
  Search, Menu, Settings, Zap, Cpu, ChevronDown, Image, Video, Paperclip, FileText, Film, Bot, History,
  CheckCircle2, Utensils, ChefHat, Save
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { Logo } from './Logo';
import { ErrorBoundary } from './ErrorBoundary';
import { db, collection, auth, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, deleteDoc, doc, updateDoc, writeBatch, getDocs } from '../lib/firebase';
import { ConfirmModal } from './ConfirmModal';

interface ChatMessageData {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: any;
  conversationId: string;
  suggestions?: { label: string; action: string }[];
  photos?: { url: string; filename: string }[];
  internalMonologue?: string;
  recipe?: any;
}

interface ConversationData {
  id: string;
  title: string;
  updatedAt: any;
  createdAt: any;
}

interface Attachment {
  type: 'image' | 'video' | 'file';
  data: string; // base64
  mimeType: string;
  name: string;
}

export function CreativeAgent({ 
  preferences, 
  updatePreference, 
  setActiveTab,
  activeConversationId,
  setActiveConversationId
}: { 
  preferences: any, 
  updatePreference: (key: string, value: any) => void, 
  setActiveTab: (tab: any) => void,
  activeConversationId: string | null,
  setActiveConversationId: (id: string | null) => void
}) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message?: string, onConfirm: () => void } | null>(null);
  const [input, setInput] = useState('');
  const [processingConversations, setProcessingConversations] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const isProcessing = activeConversationId ? processingConversations.has(activeConversationId) : false;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showMonologue, setShowMonologue] = useState<Record<string, boolean>>({});
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [creationHistory, setCreationHistory] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'creative_conversations'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ConversationData[];
      setConversations(convs);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  // Load creation history
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'creation_history'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCreationHistory(history);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  // Load messages for active conversation
  useEffect(() => {
    // Clear immediately to prevent overlapping history
    setMessages([]);
    setError(null);

    if (!activeConversationId || !auth.currentUser) {
      return;
    }

    const q = query(
      collection(db, 'creative_chats'),
      where('conversationId', '==', activeConversationId),
      where('userId', '==', auth.currentUser.uid),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Handle Firestore Timestamp
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp
        };
      }) as ChatMessageData[];

      // Always prepend welcome message if it's a new conversation or if it's not and we want it there
      const welcomeMsg: ChatMessageData = {
        id: 'welcome-' + activeConversationId,
        conversationId: activeConversationId,
        text: 'Chào bạn! Tôi là GemAgent - Chuyên gia Sáng tạo F&B. Tôi có thể giúp bạn thiết kế Menu Izakaya, tư vấn Food Styling Nhật Bản hoặc lên kế hoạch Content Social Media. Bạn cần tôi hỗ trợ mảng nào hôm nay?',
        sender: 'ai',
        timestamp: new Date(0).toISOString(), // Make it earliest
        suggestions: [
          { label: 'Thiết kế Menu Izakaya', action: 'menu_design' },
          { label: 'Tư vấn Food Styling', action: 'food_styling' },
          { label: 'Lịch Content Social', action: 'content_calendar' }
        ]
      };

      setMessages([welcomeMsg, ...msgs]);
    });

    return () => unsubscribe();
  }, [activeConversationId, auth.currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startNewChat = async () => {
    if (!auth.currentUser) return;
    
    try {
      const newConv = {
        title: 'Cuộc hội thoại mới',
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'creative_conversations'), newConv);
      setActiveConversationId(docRef.id);
    } catch (err) {
      console.error("Error starting new chat:", err);
    }
  };

  const renameConversation = async (id: string, currentTitle: string) => {
    if (!auth.currentUser) return;
    
    const newTitle = prompt("Nhập tên mới cho cuộc hội thoại:", currentTitle);
    
    if (newTitle !== null && newTitle.trim() !== "" && newTitle !== currentTitle) {
      try {
        await updateDoc(doc(db, 'creative_conversations', id), {
          title: newTitle.trim(),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Error renaming conversation:", err);
      }
    }
  };

  const deleteConversation = async (id: string) => {
    if (!auth.currentUser) return;
    
    try {
      if (id === 'all') {
        const batch = writeBatch(db);
        
        // Delete all conversations
        const convSnap = await getDocs(query(collection(db, 'creative_conversations'), where('userId', '==', auth.currentUser.uid)));
        convSnap.forEach(d => batch.delete(d.ref));
        
        // Delete all messages
        const chatSnap = await getDocs(query(collection(db, 'creative_chats'), where('userId', '==', auth.currentUser.uid)));
        chatSnap.forEach(d => batch.delete(d.ref));
        
        await batch.commit();
        setActiveConversationId(null);
      } else {
        await deleteDoc(doc(db, 'creative_conversations', id));
        // Also delete associated messages
        const batch = writeBatch(db);
        const chatSnap = await getDocs(query(collection(db, 'creative_chats'), where('conversationId', '==', id)));
        chatSnap.forEach(d => batch.delete(d.ref));
        await batch.commit();

        if (activeConversationId === id) {
          setActiveConversationId(null);
        }
      }
    } catch (err) {
      console.error("Error deleting conversation:", err);
    }
    setShowDeleteConfirm(null);
  };

  const handleDeleteFromHistory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'creation_history', id));
    } catch (err) {
      console.error("Error deleting history:", err);
    }
  };

  const handleClearAllHistory = async () => {
    if (!auth.currentUser) return;
    
    setConfirmModal({
      isOpen: true,
      title: "Xóa tất cả bản thảo?",
      message: "Bạn có chắc chắn muốn xoá tất cả bản thảo sáng tạo không? (Hành động này không thể hoàn tác)",
      onConfirm: async () => {
        try {
          const q = query(
            collection(db, 'creation_history'),
            where('userId', '==', auth.currentUser!.uid)
          );
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        } catch (err) {
          console.error("Error clearing history:", err);
        }
      }
    });
  };

  const handleSelectFromHistory = (h: any) => {
    // Setting up a new chat session with the selected recipe context
    const recipe = h.recipe;
    const msg: ChatMessageData = {
      id: Date.now().toString(),
      conversationId: activeConversationId || 'temp',
      text: `Tôi đang xem lại công thức: **${recipe.title}**. Bạn có thể góp ý thêm cho tôi không?`,
      sender: 'user',
      timestamp: new Date().toISOString(),
      recipe: recipe
    };
    setMessages(prev => [...prev, msg]);
    // Note: In session-only mode it wouldn't persist, but now it will if handleSend is called properly or we just display it.
    // For now, let's just push it to the messages state if there's an active conversation.
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isProcessing || !auth.currentUser) return;

    let currentConvId = activeConversationId;
    if (!currentConvId) {
      try {
        const newConv = {
          title: text.slice(0, 30) + (text.length > 30 ? '...' : ''),
          userId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'creative_conversations'), newConv);
        currentConvId = docRef.id;
        setActiveConversationId(currentConvId);
      } catch (err) {
        console.error("Error creating conversation:", err);
        return;
      }
    } else {
      // Update conversation updatedAt and potentially title
      const conv = conversations.find(c => c.id === currentConvId);
      const updates: any = { updatedAt: serverTimestamp() };
      if (conv?.title === 'Cuộc hội thoại mới') {
        updates.title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
      }
      try {
        await updateDoc(doc(db, 'creative_conversations', currentConvId), updates);
      } catch (err) {
        console.error("Error updating conversation:", err);
      }
    }

    const userMsg = {
      conversationId: currentConvId,
      text,
      sender: 'user',
      userId: auth.currentUser.uid,
      timestamp: serverTimestamp(),
      attachments: attachments.length > 0 ? attachments : null
    };

    setInput('');
    setAttachments([]);
    setProcessingConversations(prev => new Set(prev).add(currentConvId!));
    setError(null);

    try {
      await addDoc(collection(db, 'creative_chats'), userMsg);

      const history = messages.map(m => {
        const parts: any[] = [{ text: m.text }];
        const mAttachments = (m as any).attachments || [];
        mAttachments.forEach((att: Attachment) => {
          parts.push({
            [att.type]: att.data,
            type: att.type,
            mimeType: att.mimeType
          });
        });

        return {
          role: m.sender === 'user' ? 'user' : 'model',
          parts
        };
      });

      // Add the current message to history
      const currentParts: any[] = [{ text }];
      attachments.forEach(att => {
        currentParts.push({
          [att.type]: att.data,
          type: att.type,
          mimeType: att.mimeType
        });
      });
      history.push({ role: 'user', parts: currentParts });

      // Define fallback chain
      const fallbacks = [
        'gemini-flash-latest',
        'gemini-2.0-flash',
        'gpt-4o-mini',
        'groq/llama-3.3-70b-versatile',
        'nvidia/meta/llama-3.3-70b-instruct'
      ].filter(id => id !== preferences.selectedModelId);

      const aiResult = await chatWithAIWithFallback(
        preferences.selectedModelId, 
        history, 
        creativeAgentInstruction,
        undefined,
        { 
          openaiKey: preferences.openaiKey, 
          anthropicKey: preferences.anthropicKey, 
          googleKey: preferences.googleKey,
          nvidiaKey: preferences.nvidiaKey,
          groqKey: preferences.groqKey
        },
        fallbacks,
        z.object({
          text: z.string(),
          suggestions: z.array(z.object({ label: z.string(), action: z.string() })).optional(),
          recipe: z.optional(z.any())
        })
      );
      
      const aiMsg = {
        conversationId: currentConvId,
        text: aiResult.text || 'Xin lỗi, tôi gặp chút trục trặc. Bạn thử lại nhé!',
        sender: 'ai',
        userId: auth.currentUser.uid,
        timestamp: serverTimestamp(),
        suggestions: aiResult.suggestions || null,
        recipe: aiResult.recipe || null,
        internalMonologue: (aiResult as any).internalMonologue || null
      };

      await addDoc(collection(db, 'creative_chats'), aiMsg);

      if (aiResult.recipe && auth.currentUser) {
        // Automatically save to creation_history per user request
        await addDoc(collection(db, 'creation_history'), {
          recipe: aiResult.recipe,
          userId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          source: 'creative_agent'
        });
      }
    } catch (error: any) {
      console.error("Creative Agent Error:", error);
      let errorMsg = error.message || "Đã xảy ra lỗi khi kết nối với AI.";
      setError(errorMsg);
      
      const errAiMsg = {
        conversationId: currentConvId,
        text: "⚠️ **Lỗi kết nối:** " + errorMsg,
        sender: 'ai',
        userId: auth.currentUser.uid,
        timestamp: serverTimestamp(),
        suggestions: [
          { label: '🔄 Thử lại', action: 'retry' },
          { label: '💬 Sang Chef Chat', action: 'go_to_chat' }
        ]
      };
      await addDoc(collection(db, 'creative_chats'), errAiMsg);
    } finally {
      setProcessingConversations(prev => {
        const next = new Set(prev);
        next.delete(currentConvId!);
        return next;
      });
    }
  };

  const handleSuggestionClick = (suggestion: { label: string; action: string }) => {
    if (suggestion.action === 'go_to_chat') {
      setActiveTab('chat');
      return;
    }
    if (suggestion.action === 'retry') {
      const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user');
      if (lastUserMsg) {
        handleSend(lastUserMsg.text);
      }
      return;
    }
    handleSend(suggestion.label);
  };

  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full bg-white overflow-hidden relative">
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {/* Sidebar - Desktop Only Rail */}
      <aside className="hidden lg:flex w-16 flex-col bg-white border-r border-stone-100 z-30 shrink-0">
        <div className="flex-1 py-8 flex flex-col items-center gap-10">
          <Logo size={20} />
          
          <div className="flex flex-col gap-6">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "w-10 h-10 rounded-[1.25rem] flex items-center justify-center transition-all duration-500",
                showHistory ? "bg-stone-900 text-white shadow-xl scale-110" : "text-stone-300 hover:text-stone-900 hover:bg-stone-50"
              )}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            
            <button 
              onClick={startNewChat}
              className="w-10 h-10 rounded-[1.25rem] flex items-center justify-center text-stone-300 hover:text-stone-900 hover:bg-stone-50 transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-stone-50 flex flex-col items-center gap-4">
          <button onClick={() => updatePreference('showInternalThoughts', !preferences.showInternalThoughts)} className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", preferences.showInternalThoughts ? "bg-stone-900 text-white" : "text-stone-300 hover:text-stone-900")}>
            <Cpu className="w-5 h-5" />
          </button>
          <button onClick={() => setActiveTab?.('profile')} className="w-10 h-10 rounded-xl flex items-center justify-center text-stone-300 hover:text-stone-900 transition-all">
            <User className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Sidebar - Made absolute on mobile for better UX */}
      <AnimatePresence>
        {showHistory && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="fixed lg:relative inset-y-0 left-0 w-[260px] md:w-[280px] bg-white border-r border-stone-100 z-[70] lg:z-auto flex flex-col shadow-2xl lg:shadow-none"
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between lg:hidden">
                <Logo />
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-1.5 hover:bg-stone-50 rounded-lg transition-colors border border-stone-100"
                  title="Đóng lịch sử"
                >
                  <X className="w-4 h-4 text-stone-600" />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={startNewChat}
                  className="flex-1 flex items-center justify-center gap-2 bg-stone-900 text-white py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-stone-800 transition-all shadow-md active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Hội thoại mới
                </button>
                <button
                  onClick={() => setShowDeleteConfirm('all')}
                  className="px-3 bg-red-50 text-red-500 border border-red-100 rounded-xl flex items-center justify-center hover:bg-red-100 transition-all active:scale-95 shadow-sm"
                  title="Xoá tất cả lịch sử"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-stone-100 rounded-xl py-2 pl-9 pr-4 text-[11px] focus:outline-none focus:border-stone-900 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 space-y-6 no-scrollbar pb-6 mt-1">
              <div className="space-y-2">
                <p className="text-[9px] font-bold text-stone-400 uppercase tracking-[0.2em] px-1">Gần đây</p>
                {filteredConversations.length === 0 ? (
                  <p className="text-[11px] text-stone-400 italic px-1">Chưa có lịch sử.</p>
                ) : (
                  <div className="space-y-1">
                    {filteredConversations.map((conv) => (
                      <div key={conv.id} className="group relative">
                        <button
                          onClick={() => {
                            setActiveConversationId(conv.id);
                            if (window.innerWidth < 1024) setShowHistory(false);
                          }}
                          className={cn(
                            "w-full flex items-start gap-2.5 p-2.5 rounded-xl transition-all text-left border",
                            activeConversationId === conv.id 
                              ? "bg-white border-stone-200 shadow-sm" 
                              : "bg-transparent border-transparent hover:bg-stone-50 hover:border-stone-100"
                          )}
                        >
                          <div className={cn(
                            "mt-0.5 p-1 rounded-md transition-colors",
                            activeConversationId === conv.id ? "bg-stone-100 text-stone-900" : "bg-transparent text-stone-400 group-hover:bg-stone-200 group-hover:text-stone-700"
                          )}>
                            <MessageSquare className="w-3 h-3" />
                          </div>
                          <div className="flex-1 min-w-0 pr-6">
                            <p className={cn(
                              "text-xs font-medium leading-tight truncate transition-colors",
                              activeConversationId === conv.id ? "text-stone-900 font-semibold" : "text-stone-600 group-hover:text-stone-900"
                            )}>
                              {conv.title}
                            </p>
                            <p className="text-[9px] text-stone-400 mt-0.5 uppercase tracking-wider">
                              {conv.updatedAt?.toDate ? conv.updatedAt.toDate().toLocaleDateString() : new Date(conv.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </button>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              renameConversation(conv.id, conv.title);
                            }}
                            className="p-1.5 text-stone-400 hover:text-stone-900 transition-all rounded-lg hover:bg-white border border-transparent shadow-sm hover:border-stone-200 bg-white md:bg-transparent"
                            title="Đổi tên cuộc hội thoại"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(conv.id);
                            }}
                            className="p-1.5 text-red-400/70 hover:text-red-600 transition-all rounded-lg hover:bg-white border border-transparent shadow-sm hover:border-red-200 bg-white md:bg-transparent"
                            title="Xoá cuộc hội thoại"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {creationHistory.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <History className="w-3.5 h-3.5" />
                      Bản thảo sáng tạo
                    </p>
                    <button 
                      onClick={handleClearAllHistory}
                      className="text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors flex items-center gap-1 group/clear bg-red-50/50 hover:bg-red-50 px-2 py-1 rounded-md"
                      title="Xoá tất cả bản thảo"
                    >
                      <Trash2 className="w-3 h-3 group-hover/clear:scale-110 transition-transform" />
                      Xóa
                    </button>
                  </div>
                  <div className="space-y-2">
                    {creationHistory.map((h, i) => (
                      <div key={h.id || i} className="group relative">
                        <button
                          onClick={() => handleSelectFromHistory(h)}
                          className="w-full flex items-center gap-3 p-3 rounded-2xl bg-orange-50/30 border border-orange-100/50 hover:bg-orange-50 hover:border-orange-200 transition-all text-left"
                        >
                           <div className="p-2 bg-orange-100/50 text-orange-600 rounded-lg">
                             <Sparkles className="w-3.5 h-3.5" />
                           </div>
                           <div className="flex-1 min-w-0 pr-8">
                            <p className="text-[13px] font-medium text-stone-900 truncate leading-snug">{h.recipe.title}</p>
                            <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest mt-1">
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(h.recipe.totalCost || 0)}
                            </p>
                           </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmModal({
                              isOpen: true,
                              title: "Xóa bản thảo này?",
                              onConfirm: () => handleDeleteFromHistory(h.id)
                            });
                          }}
                          className="absolute right-5 top-1/2 -translate-y-1/2 p-2 text-stone-300 hover:text-red-500 transition-all hover:scale-110 active:scale-95 z-10 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-stone-100">
              <div className="flex items-center gap-2 bg-stone-50 rounded-xl p-3 border border-stone-100 hover:border-stone-400 group transition-all">
                <Bot className="w-4 h-4 text-stone-400 group-hover:text-stone-900" />
                <select
                  value={preferences.selectedModelId}
                  onChange={(e) => updatePreference('selectedModelId', e.target.value)}
                  className="w-full bg-transparent text-[10px] font-bold text-stone-500 group-hover:text-stone-900 uppercase tracking-widest focus:outline-none appearance-none"
                >
                  {AVAILABLE_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden h-full relative">
        <header className="h-16 px-4 md:px-12 border-b border-stone-100 bg-white z-30 flex-shrink-0 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowHistory(true)}
              className="lg:hidden w-10 h-10 rounded-xl bg-white border border-stone-100 flex items-center justify-center shadow-sm pointer-events-auto"
            >
              <Menu className="w-5 h-5 text-stone-400" />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 group pointer-events-auto">
                <h1 className="font-display font-semibold text-xl text-stone-900">
                  {conversations.find(c => c.id === activeConversationId)?.title || "GemAgent Sáng tạo"}
                </h1>
              </div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-300">Đã đồng bộ • GemAgent V2.5</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {activeConversationId && (
              <button 
                onClick={() => setShowDeleteConfirm(activeConversationId)}
                className="w-10 h-10 rounded-full hover:bg-stone-50 text-stone-300 hover:text-stone-900 transition-all flex items-center justify-center"
                title="Xoá hội thoại"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300" />
              <input
                type="text"
                placeholder="Tìm nội dung..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-stone-50 border-none rounded-full py-2 pl-9 pr-4 text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-stone-200 transition-all w-48"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 no-scrollbar relative z-0">
          <ErrorBoundary name="CreativeAgentMessages">
          {messages.length === 0 && !activeConversationId ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto">
              <div className="w-20 h-20 bg-stone-900 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-stone-200 mb-4">
                <Palette className="w-10 h-10 text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-display font-bold text-stone-900">Bắt đầu sáng tạo</h2>
                <p className="text-stone-500 text-sm leading-relaxed">
                  Hãy chọn một cuộc hội thoại cũ hoặc bắt đầu một cuộc hội thoại mới để GemAgent hỗ trợ bạn thiết kế Menu, Food Styling hoặc Content Social Media.
                </p>
              </div>
              <button
                onClick={startNewChat}
                className="flex items-center gap-2 bg-stone-900 text-white px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-stone-800 transition-all shadow-xl shadow-stone-200 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Bắt đầu ngay
              </button>
            </div>
          ) : (
            messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-4 w-full max-w-3xl",
                  msg.sender === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm transition-all",
                  msg.sender === 'user' ? "bg-stone-900" : "bg-white border border-stone-100"
                )}>
                  {msg.sender === 'user' ? <User className="w-5 h-5 text-stone-300" /> : <Palette className="w-5 h-5 text-stone-900" />}
                </div>
                <div className={cn(
                  "space-y-3 flex flex-col",
                  msg.sender === 'user' ? "items-end" : "items-start"
                )}>
                  <div className={cn(
                    "p-5 rounded-[2rem] text-sm leading-relaxed shadow-sm transition-all",
                    msg.sender === 'user' 
                      ? "bg-stone-900 text-white rounded-tr-none" 
                      : "bg-white border border-stone-100 text-stone-800 rounded-tl-none"
                  )}>
                    <div className="markdown-body prose prose-stone prose-sm max-w-none">
                      <ReactMarkdown>{typeof msg.text === 'string' ? msg.text : String(msg.text || '')}</ReactMarkdown>
                    </div>
                  </div>

                  {msg.recipe && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="w-full bg-white border border-stone-100 rounded-[2rem] overflow-hidden shadow-sm mt-2"
                    >
                      <div className="bg-stone-900 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ChefHat className="w-5 h-5 text-stone-400" />
                          <h3 className="text-white font-display font-bold text-sm tracking-tight">{msg.recipe.title}</h3>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      </div>
                      <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Food Cost</p>
                            <p className="text-lg font-display font-bold text-stone-900">
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(msg.recipe.totalCost || 0)}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Giá đề xuất</p>
                            <p className="text-lg font-display font-bold text-stone-900 text-green-600">
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(msg.recipe.recommendedPrice || 0)}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3 pt-4 border-t border-stone-50">
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Phân tích chi phí & Nguyên liệu</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[10px] text-left">
                              <thead>
                                <tr className="text-stone-400 border-b border-stone-50">
                                  <th className="pb-2 font-bold uppercase tracking-tighter">Nguyên liệu</th>
                                  <th className="pb-2 font-bold uppercase tracking-tighter text-right">Lượng</th>
                                  <th className="pb-2 font-bold uppercase tracking-tighter text-right text-stone-900">Ước tính (VNĐ)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-50">
                                {msg.recipe.ingredients?.map((ing: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-stone-50/50 transition-colors">
                                    <td className="py-2 text-stone-700 font-medium">{ing.name}</td>
                                    <td className="py-2 text-stone-500 text-right">{ing.amount} {ing.unit}</td>
                                    <td className="py-2 text-stone-900 font-bold text-right">
                                      {ing.price ? new Intl.NumberFormat('vi-VN').format(ing.price) : '---'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setActiveTab('generator');
                              // In a real app, we'd pass this recipe to the generator state
                            }}
                            className="w-full py-3 bg-stone-50 border border-stone-100 rounded-xl text-[10px] font-bold text-stone-600 uppercase tracking-widest hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all flex items-center justify-center gap-2"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Mở chỉnh sửa
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {(msg as any).attachments && (msg as any).attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                       {(msg as any).attachments.map((att: Attachment, i: number) => (
                         <div key={i} className="relative rounded-xl overflow-hidden border border-stone-200 bg-white p-1 shadow-sm">
                           {att.type === 'image' ? (
                             <img src={`data:${att.mimeType};base64,${att.data}`} className="w-24 h-24 object-cover rounded-lg" referrerPolicy="no-referrer" />
                           ) : att.type === 'video' ? (
                             <div className="w-24 h-24 flex flex-col items-center justify-center bg-stone-50 rounded-lg gap-1">
                               <Video className="w-6 h-6 text-stone-400" />
                               <span className="text-[8px] font-bold text-stone-400 uppercase tracking-tighter truncate w-full px-1 text-center">{att.name}</span>
                             </div>
                           ) : (
                             <div className="w-24 h-24 flex flex-col items-center justify-center bg-stone-50 rounded-lg gap-1">
                               <FileText className="w-6 h-6 text-stone-400" />
                               <span className="text-[8px] font-bold text-stone-400 uppercase tracking-tighter truncate w-full px-1 text-center">{att.name}</span>
                             </div>
                           )}
                         </div>
                       ))}
                    </div>
                  )}

                  {preferences.showInternalThoughts && msg.internalMonologue && (
                    <div className="w-full mt-2 overflow-hidden rounded-2xl border border-stone-100 bg-white/50">
                      <button 
                        onClick={() => setShowMonologue(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                        className="w-full flex items-center justify-between p-3 hover:bg-stone-100/50 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px] text-stone-400">
                          <Sparkles className="w-3 h-3 text-orange-400" />
                          Suy nghĩ của GemAgent
                        </div>
                        <ChevronDown className={cn("w-3 h-3 text-stone-400 transition-transform", showMonologue[msg.id] && "rotate-180")} />
                      </button>
                      <AnimatePresence>
                        {showMonologue[msg.id] && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-3 pb-3 pt-1 italic text-[10px] text-stone-500 border-t border-stone-100/50"
                          >
                            {msg.internalMonologue}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {msg.photos && msg.photos.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-4 w-full">
                      {msg.photos.map((photo, i) => (
                        <motion.div 
                          key={i}
                          whileHover={{ scale: 1.02 }}
                          className="relative aspect-square rounded-2xl overflow-hidden border border-stone-100 shadow-sm group"
                        >
                          <img 
                            src={photo.url} 
                            alt={photo.filename}
                            className="w-full h-full object-cover cursor-pointer"
                            referrerPolicy="no-referrer"
                            onClick={() => window.open(photo.url, '_blank')}
                          />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
          {isProcessing && (
            <div className="flex gap-4 mr-auto">
              <div className="w-10 h-10 bg-white border border-stone-100 rounded-2xl flex items-center justify-center shadow-sm">
                <Palette className="w-5 h-5 text-stone-900" />
              </div>
              <div className="bg-white border border-stone-100 p-5 rounded-[2rem] rounded-tl-none shadow-sm flex gap-1.5">
                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-stone-300 rounded-full" />
                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-stone-300 rounded-full" />
                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-stone-300 rounded-full" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
          </ErrorBoundary>
        </div>

        <div className="p-3 md:p-4 bg-white border-t border-stone-100 z-50 flex-shrink-0">
          <div className="max-w-4xl mx-auto space-y-3">
            <AnimatePresence>
              {attachments.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap gap-2 p-3 bg-stone-50 rounded-[1.5rem] border border-stone-100 shadow-inner"
                >
                  {attachments.map((att, i) => (
                    <div key={i} className="relative group">
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-stone-200 bg-white">
                        {att.type === 'image' ? (
                          <img src={`data:${att.mimeType};base64,${att.data}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-stone-100">
                             {att.type === 'video' ? <Video className="w-5 h-5 text-stone-500" /> : <Paperclip className="w-5 h-5 text-stone-500" />}
                             <span className="text-[6px] font-bold text-stone-500 truncate w-full px-0.5 text-center">{att.name}</span>
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-16 h-16 rounded-xl border-2 border-dashed border-stone-200 flex items-center justify-center hover:bg-white hover:border-stone-400 transition-all text-stone-400"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-red-50 text-red-600 px-4 py-3 rounded-2xl text-xs flex items-center justify-between border border-red-100 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-medium">{error}</span>
                  </div>
                  <button onClick={() => setError(null)}>
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {messages.length > 0 && messages[messages.length - 1].sender === 'ai' && messages[messages.length - 1].suggestions && (
              <div className="flex flex-wrap gap-2 mb-1">
                {messages[messages.length - 1].suggestions?.map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => handleSuggestionClick(s)}
                    className="bg-white border border-stone-100 text-stone-500 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all shadow-sm active:scale-95"
                  >
                    <Sparkles className="w-3 h-3 text-orange-400 mr-1.5 inline" />
                    {s.label}
                  </motion.button>
                ))}
              </div>
            )}

            <div className="relative flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []) as File[];
                  for (const file of files) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const base64 = (reader.result as string).split(',')[1];
                      let type: 'image' | 'video' | 'file' = 'file';
                      if (file.type.startsWith('image/')) type = 'image';
                      else if (file.type.startsWith('video/')) type = 'video';
                      
                      setAttachments(prev => [
                        ...prev, 
                        { type, data: base64, mimeType: file.type, name: file.name }
                      ]);
                    };
                    reader.readAsDataURL(file);
                  }
                  // Reset input value to allow selecting the same file again if deleted
                  e.target.value = '';
                }}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-stone-100 text-stone-500 rounded-full hover:bg-stone-200 transition-all active:scale-95 flex-shrink-0"
                title="Đính kèm file"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder={activeConversationId ? "Hỏi GemAgent về thiết kế, styling..." : "Bắt đầu hội thoại mới..."}
                className="w-full bg-stone-100 border-none rounded-[2rem] py-4 pl-6 pr-16 text-sm focus:ring-4 focus:ring-stone-900/5 focus:bg-white transition-all shadow-sm"
              />
              <button
                onClick={() => handleSend()}
                disabled={(!input.trim() && attachments.length === 0) || isProcessing}
                className="absolute right-2 top-2 bottom-2 w-12 bg-stone-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-stone-200 hover:bg-stone-800 disabled:opacity-20 disabled:shadow-none transition-all active:scale-95"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-[9px] text-center text-stone-400 font-bold uppercase tracking-[0.2em]">
              Powered by {AVAILABLE_MODELS.find(m => m.id === preferences.selectedModelId)?.name || preferences.selectedModelId} • AI can make mistakes
            </p>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-stone-100"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-display font-bold text-stone-900 mb-2">
                {showDeleteConfirm === 'all' ? 'Xoá tất cả lịch sử?' : 'Xoá hội thoại?'}
              </h3>
              <p className="text-stone-500 text-sm mb-8 leading-relaxed">
                {showDeleteConfirm === 'all' 
                  ? 'Hành động này sẽ xoá vĩnh viễn toàn bộ lịch sử trò chuyện của GemAgent.'
                  : 'Hành động này không thể hoàn tác. Toàn bộ tin nhắn trong cuộc hội thoại này sẽ bị xoá vĩnh viễn.'
                }
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-stone-200 transition-all"
                >
                  Huỷ
                </button>
                <button
                  onClick={() => deleteConversation(showDeleteConfirm)}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-200"
                >
                  Xoá ngay
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Overlay for mobile when sidebar is open */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHistory(false)}
            className="fixed inset-0 bg-stone-900/20 backdrop-blur-[2px] z-[55] md:hidden"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
