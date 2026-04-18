import { useState, useEffect, useRef } from 'react';
import { LocalDb } from '../lib/localDb';
import { creativeAgentInstruction } from '../lib/gemini';
import { chatWithAIWithFallback, AVAILABLE_MODELS } from '../lib/ai';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Palette, Sparkles, User, Loader2, X, 
  AlertCircle, MessageSquare, Plus, Trash2, 
  Search, Menu, Settings, Zap, Cpu, ChevronDown, Image, Video, Paperclip, FileText, Film
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { Logo } from './Logo';

interface ChatMessageData {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: any;
  conversationId: string;
  suggestions?: { label: string; action: string }[];
  photos?: { url: string; filename: string }[];
  internalMonologue?: string;
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
  updatePreference: (key: string, value: string) => void, 
  setActiveTab: (tab: any) => void,
  activeConversationId: string | null,
  setActiveConversationId: (id: string | null) => void
}) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showMonologue, setShowMonologue] = useState<Record<string, boolean>>({});
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations
  useEffect(() => {
    const loadConversations = async () => {
      const saved = await LocalDb.getCollection('creative_conversations');
      const sorted = saved.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setConversations(sorted);
      
      // Auto-select most recent if nothing selected but history exists
      if (!activeConversationId && sorted.length > 0) {
        setActiveConversationId(sorted[0].id);
      }
    };
    loadConversations();
  }, []);

  // Load messages for active conversation
  useEffect(() => {
    const loadMessages = async () => {
      if (!activeConversationId) {
        setMessages([]);
        return;
      }
      const allMessages = await LocalDb.getCollection('creative_chats');
      const filtered = allMessages
        .filter((m: any) => m.conversationId === activeConversationId)
        .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      if (filtered.length === 0) {
        const welcomeMsg: ChatMessageData = {
          id: 'welcome-' + activeConversationId,
          conversationId: activeConversationId,
          text: 'Chào bạn! Tôi là GemAgent - Chuyên gia Sáng tạo F&B. Tôi có thể giúp bạn thiết kế Menu Izakaya, tư vấn Food Styling Nhật Bản hoặc lên kế hoạch Content Social Media. Bạn cần tôi hỗ trợ mảng nào hôm nay?',
          sender: 'ai',
          timestamp: new Date().toISOString(),
          suggestions: [
            { label: 'Thiết kế Menu Izakaya', action: 'menu_design' },
            { label: 'Tư vấn Food Styling', action: 'food_styling' },
            { label: 'Lịch Content Social', action: 'content_calendar' }
          ]
        };
        setMessages([welcomeMsg]);
        await LocalDb.addDoc('creative_chats', welcomeMsg);
      } else {
        setMessages(filtered);
      }
      localStorage.setItem('last_creative_conv_id', activeConversationId);
    };
    loadMessages();
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startNewChat = async () => {
    const newConv: ConversationData = {
      id: Date.now().toString(),
      title: 'Cuộc hội thoại mới',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await LocalDb.addDoc('creative_conversations', newConv);
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
  };

  const deleteConversation = async (id: string) => {
    if (id === 'all') {
      await LocalDb.saveCollection('creative_conversations', []);
      await LocalDb.saveCollection('creative_chats', []);
      setConversations([]);
      setMessages([]);
      setActiveConversationId(null);
      localStorage.removeItem('last_creative_conv_id');
      setShowDeleteConfirm(null);
      return;
    }
    await LocalDb.deleteDoc('creative_conversations', id);
    const allMessages = await LocalDb.getCollection('creative_chats');
    const remainingMessages = allMessages.filter((m: any) => m.conversationId !== id);
    await LocalDb.saveCollection('creative_chats', remainingMessages);
    
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
      localStorage.removeItem('last_creative_conv_id');
    }
    setShowDeleteConfirm(null);
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isProcessing) return;

    let currentConvId = activeConversationId;
    if (!currentConvId) {
      const newConv: ConversationData = {
        id: Date.now().toString(),
        title: text.slice(0, 30) + (text.length > 30 ? '...' : ''),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await LocalDb.addDoc('creative_conversations', newConv);
      setConversations(prev => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      currentConvId = newConv.id;
    } else {
      // Update conversation title if it's still "Cuộc hội thoại mới"
      const conv = conversations.find(c => c.id === currentConvId);
      if (conv?.title === 'Cuộc hội thoại mới') {
        const updatedConv = { ...conv, title: text.slice(0, 30) + (text.length > 30 ? '...' : ''), updatedAt: new Date().toISOString() };
        await LocalDb.updateDoc('creative_conversations', currentConvId, updatedConv);
        setConversations(prev => prev.map(c => c.id === currentConvId ? updatedConv : c));
      } else {
        // Just update updatedAt
        await LocalDb.updateDoc('creative_conversations', currentConvId, { updatedAt: new Date().toISOString() });
        setConversations(prev => prev.map(c => c.id === currentConvId ? { ...c, updatedAt: new Date().toISOString() } : c));
      }
    }

    const userMsg: ChatMessageData = {
      id: Date.now().toString(),
      conversationId: currentConvId,
      text,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    if (attachments.length > 0) {
      (userMsg as any).attachments = attachments;
    }

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    setIsProcessing(true);
    setError(null);
    await LocalDb.addDoc('creative_chats', userMsg);

    try {
      const history = messages.concat(userMsg).map(m => {
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

      // Define fallback chain
      const fallbacks = [
        'gemini-2.0-flash',
        'gemini-1.5-pro',
        'gpt-4o-mini',
        'groq/llama-3.3-70b-versatile'
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
          suggestions: z.array(z.object({ label: z.string(), action: z.string() })).optional()
        })
      );
      
      const aiMsg: ChatMessageData = {
        id: (Date.now() + 1).toString(),
        conversationId: currentConvId,
        text: aiResult.text || 'Xin lỗi, tôi gặp chút trục trặc. Bạn thử lại nhé!',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        suggestions: aiResult.suggestions,
        photos: (aiResult as any).photos,
        internalMonologue: (aiResult as any).internalMonologue
      };

      setMessages(prev => [...prev, aiMsg]);
      await LocalDb.addDoc('creative_chats', aiMsg);
    } catch (error: any) {
      console.error("Creative Agent Error:", error);
      let errorMsg = error.message || "Đã xảy ra lỗi khi kết nối với AI.";
      setError(errorMsg);
      
      const aiMsg: ChatMessageData = {
        id: (Date.now() + 1).toString(),
        conversationId: currentConvId,
        text: "⚠️ **Lỗi kết nối:** " + errorMsg,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        suggestions: [
          { label: '🔄 Thử lại', action: 'retry' },
          { label: '💬 Sang Chef Chat', action: 'go_to_chat' }
        ]
      };
      setMessages(prev => [...prev, aiMsg]);
      await LocalDb.addDoc('creative_chats', aiMsg);
    } finally {
      setIsProcessing(false);
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
    <div className="flex h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] bg-white rounded-3xl overflow-hidden border border-stone-100 shadow-sm">
      {/* Sidebar - Made absolute on mobile for better UX */}
      <AnimatePresence>
        {showHistory && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="fixed md:relative inset-y-0 left-0 w-[280px] md:w-[300px] bg-white border-r border-stone-100 z-[60] md:z-auto flex flex-col shadow-2xl md:shadow-none"
          >
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <Logo />
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-stone-50 rounded-xl transition-colors border border-stone-100"
                  title="Đóng lịch sử"
                >
                  <X className="w-5 h-5 text-stone-600" />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={startNewChat}
                  className="flex-1 flex items-center justify-center gap-2 bg-stone-900 text-white py-3.5 rounded-2xl font-bold text-[11px] uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Hội thoại mới
                </button>
                <button
                  onClick={() => setShowDeleteConfirm('all')}
                  className="px-4 bg-red-50 text-red-500 border border-red-100 rounded-2xl flex items-center justify-center hover:bg-red-100 transition-all active:scale-95 shadow-sm"
                  title="Xoá tất cả lịch sử"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-stone-100 rounded-xl py-2.5 pl-10 pr-4 text-xs focus:outline-none focus:border-stone-900 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 space-y-1 no-scrollbar">
              {filteredConversations.map((conv) => (
                <div key={conv.id} className="group relative">
                  <button
                    onClick={() => setActiveConversationId(conv.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                      activeConversationId === conv.id 
                        ? "bg-white shadow-sm border border-stone-100" 
                        : "hover:bg-stone-100/50"
                    )}
                  >
                    <MessageSquare className={cn(
                      "w-4 h-4 shrink-0",
                      activeConversationId === conv.id ? "text-stone-900" : "text-stone-400"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs font-bold truncate",
                        activeConversationId === conv.id ? "text-stone-900" : "text-stone-600"
                      )}>
                        {conv.title}
                      </p>
                      <p className="text-[9px] text-stone-400 font-medium">
                        {new Date(conv.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(conv.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 text-red-400/50 hover:text-red-500 transition-all z-10"
                    title="Xoá cuộc hội thoại"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-stone-100">
              <div className="bg-white rounded-2xl p-4 border border-stone-100 space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  <Settings className="w-3 h-3" />
                  Cấu hình AI
                </div>
                <select
                  value={preferences.selectedModelId}
                  onChange={(e) => updatePreference('selectedModelId', e.target.value)}
                  className="w-full bg-stone-50 border border-stone-100 rounded-xl p-2.5 text-[10px] font-bold text-stone-600 focus:outline-none focus:border-stone-900"
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
      <main className="flex-1 flex flex-col relative min-w-0 bg-stone-50/30">
        <header className="px-6 py-4 border-b border-stone-100 bg-white/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            {!showHistory && (
              <button 
                onClick={() => setShowHistory(true)}
                className="p-2.5 bg-stone-900 text-white rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2"
              >
                <Menu className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Lịch sử</span>
              </button>
            )}
            <div className="space-y-0.5">
              <h1 className="text-lg font-display font-bold text-stone-900 tracking-tight">GemAgent</h1>
              <p className="text-stone-400 text-[9px] font-bold uppercase tracking-[0.2em]">Sáng tạo • Branding • Content</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {activeConversationId && (
              <button 
                onClick={() => setShowDeleteConfirm(activeConversationId)}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-500 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-100 transition-all active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Xoá Chat</span>
              </button>
            )}
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Model Hiện Tại</span>
              <span className="text-[10px] font-bold text-stone-900">{AVAILABLE_MODELS.find(m => m.id === preferences.selectedModelId)?.name}</span>
            </div>
            <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center shadow-lg shadow-stone-200">
              <Palette className="w-5 h-5 text-white" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 no-scrollbar">
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
        </div>

        <div className="p-4 md:p-6 bg-white/80 backdrop-blur-xl border-t border-stone-100 sticky bottom-0 z-30">
          <div className="max-w-4xl mx-auto space-y-4">
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
                  const files = Array.from(e.target.files || []);
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
