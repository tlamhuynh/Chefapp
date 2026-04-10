import { useState, useEffect, useRef } from 'react';
import { LocalDb } from '../lib/localDb';
import { chatWithCreativeAgent, ChatMessage } from '../lib/gemini';
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

export function CreativeAgent() {
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
      const chatHistory: ChatMessage[] = messages.concat(userMsg).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const response = await chatWithCreativeAgent(chatHistory);
      
      const aiMsg: ChatMessageData = {
        id: (Date.now() + 1).toString(),
        text: response.text || 'Xin lỗi, tôi gặp chút trục trặc. Bạn thử lại nhé!',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        suggestions: response.suggestions
      };

      setMessages(prev => [...prev, aiMsg]);
      await LocalDb.addDoc('creative_chats', aiMsg);
    } catch (error) {
      console.error("Creative Agent Error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

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
            
            {msg.suggestions && msg.suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {msg.suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s.label)}
                    className="bg-white border border-purple-100 text-purple-600 px-3 py-1.5 rounded-full text-[10px] font-bold hover:bg-purple-50 transition-colors shadow-sm"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {isProcessing && (
          <div className="flex items-start gap-3">
            <div className="bg-white border border-stone-100 p-4 rounded-2xl rounded-tl-none shadow-sm">
              <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-stone-100">
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
