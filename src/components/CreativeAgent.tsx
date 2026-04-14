import { useState, useEffect, useRef } from 'react';
import { LocalDb } from '../lib/localDb';
import { creativeAgentInstruction, ChatMessage } from '../lib/gemini';
import { chatWithAIWithFallback, AVAILABLE_MODELS } from '../lib/ai';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Palette, Sparkles, User, Loader2, Paperclip, X, Image as ImageIcon, Layout, Camera, Share2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';

interface ChatMessageData {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: any;
  suggestions?: { label: string; action: string }[];
}

export function CreativeAgent({ preferences, updatePreference, setActiveTab }: { preferences: any, updatePreference: (key: string, value: string) => void, setActiveTab: (tab: any) => void }) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadMessages = async () => {
      const savedMessages = await LocalDb.getCollection('creative_chats');
      if (savedMessages.length === 0) {
        const welcomeMsg: ChatMessageData = {
          id: 'welcome',
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
        setMessages(savedMessages.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
      }
    };
    loadMessages();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isProcessing) return;

    const userMsg: ChatMessageData = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);
    await LocalDb.addDoc('creative_chats', userMsg);

    try {
      const history = messages.concat(userMsg).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      // Define fallback chain
      const fallbacks = [
        'gemini-2.0-flash',
        'openrouter/deepseek/deepseek-chat',
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
          openrouterKey: preferences.openrouterKey,
          nvidiaKey: preferences.nvidiaKey,
          groqKey: preferences.groqKey
        },
        fallbacks
      );
      
      const aiMsg: ChatMessageData = {
        id: (Date.now() + 1).toString(),
        text: aiResult.text || 'Xin lỗi, tôi gặp chút trục trặc. Bạn thử lại nhé!',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        suggestions: aiResult.suggestions
      };

      setMessages(prev => [...prev, aiMsg]);
      await LocalDb.addDoc('creative_chats', aiMsg);
    } catch (error: any) {
      console.error("Creative Agent Error:", error);
      const errorStr = String(error).toLowerCase();
      let errorMessage = 'Xin lỗi, tôi gặp chút trục trặc. Bạn thử lại nhé!';
      
      if (errorStr.includes('quota') || errorStr.includes('429') || errorStr.includes('limit')) {
        errorMessage = '⚠️ **Hết hạn mức (Quota Limit):** GemAgent hiện đã hết lượt sử dụng. Bạn có thể thử lại sau hoặc chuyển sang **Chef Chat** để dùng các model khác.';
      }

      const aiMsg: ChatMessageData = {
        id: (Date.now() + 1).toString(),
        text: errorMessage,
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

  const isActuallyTyping = isProcessing;

  return (
    <div className="flex flex-col h-full bg-stone-50/50">
      <header className="px-6 py-8 space-y-1">
        <div className="flex justify-between items-center">
          <div className="space-y-0.5">
            <h1 className="text-3xl font-display font-bold text-stone-900 tracking-tight">Sáng tạo</h1>
            <p className="text-stone-400 text-[10px] font-bold uppercase tracking-[0.2em]">Branding • Styling • Content</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="w-12 h-12 bg-stone-900 rounded-2xl flex items-center justify-center shadow-xl shadow-stone-200">
              <Palette className="w-6 h-6 text-white" />
            </div>
            <select
              value={preferences.selectedModelId}
              onChange={(e) => updatePreference('selectedModelId', e.target.value)}
              className="bg-transparent border-none p-0 font-bold text-stone-400 uppercase tracking-widest cursor-pointer focus:ring-0 text-[9px] appearance-none hover:text-stone-600 transition-colors text-right"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id} className="text-stone-900 bg-white uppercase">
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 space-y-6 no-scrollbar pb-10">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-4 max-w-[90%] md:max-w-[85%]",
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
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        {isActuallyTyping && (
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
                  {s.label}
                </motion.button>
              ))}
            </div>
          )}
          <div className="relative flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Hỏi GemAgent về thiết kế, styling..."
              className="w-full bg-stone-100 border-none rounded-[2rem] py-4 pl-6 pr-16 text-sm focus:ring-4 focus:ring-stone-900/5 focus:bg-white transition-all shadow-sm"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isProcessing}
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
    </div>
  );
}
