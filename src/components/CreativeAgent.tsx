import { useState, useEffect, useRef } from 'react';
import { LocalDb } from '../lib/localDb';
import { creativeAgentInstruction, ChatMessage } from '../lib/gemini';
import { chatWithAIWithFallback } from '../lib/ai';
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

export function CreativeAgent({ preferences, setActiveTab }: { preferences: any, setActiveTab: (tab: any) => void }) {
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
        'gemini-flash-latest',
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
    <div className="flex flex-col h-[calc(100vh-120px)] bg-stone-50">
      <header className="p-4 bg-white border-b border-stone-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center shadow-inner">
            <Palette className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="font-bold text-stone-900 leading-none">GemAgent</h2>
            <p className="text-[10px] text-purple-600 font-bold uppercase tracking-widest mt-1">Creative Expert</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex flex-col", msg.sender === 'user' ? "items-end" : "items-start")}>
            <div className={cn(
              "max-w-[85%] p-4 rounded-2xl shadow-sm",
              msg.sender === 'user' 
                ? "bg-purple-600 text-white rounded-tr-none" 
                : "bg-white border border-stone-100 text-stone-800 rounded-tl-none"
            )}>
              <div className="markdown-body text-sm">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isActuallyTyping && (
          <div className="flex items-start gap-3 mr-auto">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Palette className="w-4 h-4 text-purple-600" />
            </div>
            <div className="bg-white border border-stone-100 p-4 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-purple-300 rounded-full" />
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-purple-300 rounded-full" />
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-purple-300 rounded-full" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-stone-100 space-y-3">
        {messages.length > 0 && messages[messages.length - 1].sender === 'ai' && messages[messages.length - 1].suggestions && (
          <div className="flex flex-wrap gap-2 mb-1">
            {messages[messages.length - 1].suggestions?.map((s, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => handleSuggestionClick(s)}
                className="bg-purple-50 border border-purple-100 text-purple-700 px-3 py-1.5 rounded-full text-[10px] font-bold hover:bg-purple-100 transition-all shadow-sm flex items-center gap-1.5 group"
              >
                <Sparkles className="w-3 h-3 text-purple-400 group-hover:rotate-12 transition-transform" />
                {s.label}
              </motion.button>
            ))}
          </div>
        )}
        <div className="relative flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Hỏi GemAgent về thiết kế, styling..."
            className="flex-1 bg-stone-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 transition-all"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isProcessing}
            className="bg-purple-600 text-white p-3 rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:scale-100 transition-all active:scale-95 shadow-lg shadow-purple-100"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
