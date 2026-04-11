import { useState, useEffect, useRef } from 'react';
import { db, collection, query, where, orderBy, onSnapshot, auth, addDoc, serverTimestamp, doc, getDoc, getDocs, updateDoc, deleteDoc, setDoc, handleFirestoreError, OperationType, googleProvider, signInWithPopup } from '../lib/firebase';
import { chatWithChef, ChatMessage, searchGoogleDriveTool, searchGooglePhotosTool, searchGoogleKeepTool, crawlRecipeTool } from '../lib/gemini';
import { chatWithAI, chatWithAIWithFallback, AVAILABLE_MODELS, AIModel } from '../lib/ai';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ChefHat, User, Sparkles, Settings, X, Palette, Save, Check, Paperclip, FileText, Video, Image as ImageIcon, Globe, Loader2, Search, Trash2, MessageSquare, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn, validateRecipe } from '../lib/utils';
import { DollarSign, Clock, ListChecks, Utensils } from 'lucide-react';

interface RecipeData {
  title: string;
  ingredients: { name: string; amount: string; unit: string; purchasePrice: number; costPerAmount: number }[];
  instructions: string;
  totalCost: number;
  recommendedPrice: number;
  image?: string;
}

function RecipeCard({ recipe, onSave, isSaving }: { recipe: RecipeData, onSave?: () => void, isSaving?: boolean }) {
  if (!recipe) return null;

  return (
    <motion.div 
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onSave}
      className={cn(
        "mt-4 bg-white border rounded-2xl overflow-hidden shadow-sm cursor-pointer transition-all group",
        isSaving ? "border-orange-500 ring-1 ring-orange-500" : "border-stone-200 hover:border-orange-300 hover:shadow-md"
      )}
    >
      {recipe.image && (
        <div className="aspect-video w-full overflow-hidden relative">
          <img 
            src={recipe.image} 
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
            <h3 className="text-white font-bold text-lg drop-shadow-md">
              {recipe.title || "Công thức không tên"}
            </h3>
          </div>
        </div>
      )}
      <div className={cn(
        "p-4 text-white flex items-center justify-between transition-colors",
        recipe.image ? "bg-stone-900/90 backdrop-blur-sm" : (isSaving ? "bg-orange-600" : "bg-stone-900 group-hover:bg-stone-800")
      )}>
        {!recipe.image && (
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Utensils className="w-5 h-5 text-orange-400" />
            {recipe.title || "Công thức không tên"}
          </h3>
        )}
        {recipe.image && <div className="flex items-center gap-2 text-xs font-medium text-stone-300"><Utensils className="w-4 h-4" /> Chi tiết công thức</div>}
        {isSaving ? (
          <Check className="w-5 h-5 animate-bounce" />
        ) : (
          <Save className="w-5 h-5 text-stone-400 group-hover:text-white transition-colors" />
        )}
      </div>
      
      <div className="p-4 space-y-4">
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 flex items-center gap-1">
              <ListChecks className="w-3 h-3" />
              Nguyên liệu & Chi phí
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-100">
                    <th className="py-2 font-bold text-stone-400">Tên</th>
                    <th className="py-2 font-bold text-stone-400 text-right">Lượng</th>
                    <th className="py-2 font-bold text-stone-400 text-right">Giá nhập</th>
                    <th className="py-2 font-bold text-stone-400 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {recipe.ingredients.map((ing, i) => (
                    <tr key={i} className="border-b border-stone-50 last:border-0">
                      <td className="py-2 text-stone-700 font-medium">{ing.name}</td>
                      <td className="py-2 text-stone-500 text-right">{ing.amount} {ing.unit}</td>
                      <td className="py-2 text-stone-400 text-right">${ing.purchasePrice?.toLocaleString()}</td>
                      <td className="py-2 text-stone-900 font-bold text-right">${ing.costPerAmount?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {recipe.instructions && (
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Hướng dẫn
            </h4>
            <div className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">
              {recipe.instructions}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Tổng chi phí</p>
            <p className="text-sm font-bold text-stone-900">${recipe.totalCost || 0}</p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Giá đề xuất</p>
            <p className="text-sm font-bold text-orange-600">${recipe.recommendedPrice || 0}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface ChatMessageData {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  userId: string;
  conversationId?: string;
  timestamp: any;
  suggestions?: { label: string; action: string }[];
  recipe?: RecipeData;
  status?: 'pending' | 'processing' | 'completed' | 'error';
  hasFiles?: boolean;
  fileNames?: string[];
  files?: {data: string, mimeType: string, name: string}[];
  photos?: { url: string; filename: string }[];
}

interface ConversationData {
  id: string;
  title: string;
  userId: string;
  lastMessage?: string;
  updatedAt: any;
  createdAt: any;
}

interface ChefChatProps {
  preferences: any;
  updatePreference: (key: string, value: string) => void;
}

export function ChefChat({ preferences, updatePreference }: ChefChatProps) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [savingRecipeId, setSavingRecipeId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<{data: string, mimeType: string, name: string}[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isRecipeCrawActive, setIsRecipeCrawActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Listen for conversations
    const convQ = query(
      collection(db, 'conversations'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribeConv = onSnapshot(convQ, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ConversationData[];
      setConversations(convs);
      
      // Auto-select first conversation if none selected
      if (convs.length > 0 && !activeConversationId) {
        setActiveConversationId(convs[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations');
    });

    return () => unsubscribeConv();
  }, []);

  useEffect(() => {
    if (!auth.currentUser || !activeConversationId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'chats'),
      where('userId', '==', auth.currentUser.uid),
      where('conversationId', '==', activeConversationId),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessageData[];
      setMessages(msgs);
      
      console.log("Messages updated for conv:", activeConversationId, msgs.length);

      // Check for pending messages to process
      const needsProcessing = msgs.find(m => 
        m.sender === 'user' && m.status === 'pending'
      );

      if (needsProcessing && !isProcessingRef.current) {
        console.log("Processing message:", needsProcessing.id);
        processAiResponse(needsProcessing, msgs);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });
    return () => unsubscribe();
  }, [activeConversationId, isProcessing, preferences.selectedModelId, googleToken]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const deleteConversation = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, 'conversations', id));
      // Also delete messages in this conversation
      const msgQ = query(collection(db, 'chats'), where('conversationId', '==', id));
      const msgSnapshot = await getDocs(msgQ);
      const deletePromises = msgSnapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'conversations');
    }
  };

  const connectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
      googleProvider.addScope('https://www.googleapis.com/auth/photoslibrary.readonly');
      const result = await signInWithPopup(auth, googleProvider);
      const credential = (result as any)._credential;
      if (credential && credential.accessToken) {
        setGoogleToken(credential.accessToken);
      }
    } catch (error) {
      console.error("Google connection failed", error);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const crawlRecipe = async (url: string) => {
    try {
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!response.ok) throw new Error('Crawl failed');
      const data = await response.json();
      return `
        Dữ liệu từ URL: ${url}
        Tiêu đề: ${data.title}
        Nguyên liệu tìm thấy: ${data.ingredients?.join(', ') || 'Không tìm thấy'}
        Hướng dẫn tìm thấy: ${data.instructions?.join('\n') || 'Không tìm thấy'}
        Nội dung thô (AI hãy phân tích): ${data.rawText}
      `;
    } catch (error) {
      console.error('Crawl error:', error);
      return "Không thể lấy dữ liệu từ URL này. Vui lòng kiểm tra lại URL hoặc trang web có thể chặn truy cập.";
    }
  };

  const searchDrive = async (searchQuery: string) => {
    if (!googleToken) return "Vui lòng kết nối Google Drive trước.";
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=name contains '${searchQuery}' and mimeType != 'application/vnd.google-apps.folder'&fields=files(id, name, webViewLink)`, {
        headers: {
          'Authorization': `Bearer ${googleToken}`
        }
      });
      const data = await response.json();
      if (data.files && data.files.length > 0) {
        return `Tôi tìm thấy ${data.files.length} tệp tin trong Drive của bạn:\n` + 
          data.files.map((f: any) => `- [${f.name}](${f.webViewLink})`).join('\n');
      }
      return "Không tìm thấy tệp tin nào liên quan trong Drive của bạn.";
    } catch (error) {
      console.error("Drive search failed", error);
      return "Có lỗi xảy ra khi tìm kiếm trong Drive.";
    }
  };

  const searchPhotos = async (searchQuery: string) => {
    if (!googleToken) return "Vui lòng kết nối Google Photos trước.";
    try {
      const response = await fetch(`https://photoslibrary.googleapis.com/v1/mediaItems:search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pageSize: 6,
          filters: {
            contentFilter: {
              includedContentCategories: ['FOOD']
            }
          }
        })
      });
      const data = await response.json();
      if (data.mediaItems && data.mediaItems.length > 0) {
        const photos = data.mediaItems.map((m: any) => ({
          url: `${m.baseUrl}=w800-h800`,
          filename: m.filename
        }));
        return `Tôi tìm thấy ${photos.length} hình ảnh liên quan đến ẩm thực trong Photos của bạn. Hãy trả về danh sách này trong trường 'photos' của JSON phản hồi.\n\nDữ liệu hình ảnh: ${JSON.stringify(photos)}`;
      }
      return "Không tìm thấy hình ảnh món ăn nào liên quan trong Photos của bạn.";
    } catch (error) {
      console.error("Photos search failed", error);
      return "Có lỗi xảy ra khi tìm kiếm trong Photos.";
    }
  };

  const searchKeep = async (searchQuery: string) => {
    return `Tính năng tìm kiếm Google Keep đang được đồng bộ. Bạn có thể kiểm tra trực tiếp tại [Google Keep](https://keep.google.com/) với từ khóa: "${searchQuery}".`;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setFileError(null);
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain', 'video/mp4', 'video/quicktime'];

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_SIZE) {
        setFileError(`Tệp "${file.name}" quá lớn. Giới hạn tối đa là 10MB.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (!SUPPORTED_TYPES.includes(file.type)) {
        setFileError(`Định dạng tệp "${file.name}" (${file.type}) không được hỗ trợ.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      validFiles.push(file);
    }

    try {
      const newFiles = await Promise.all(validFiles.map(async file => {
        return new Promise<{data: string, mimeType: string, name: string}>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve({ data: base64, mimeType: file.type, name: file.name });
          };
          reader.onerror = () => reject(new Error(`Không thể đọc tệp ${file.name}`));
          reader.readAsDataURL(file);
        });
      }));

      setSelectedFiles(prev => [...prev, ...newFiles]);
    } catch (err: any) {
      setFileError(err.message || "Đã xảy ra lỗi khi tải tệp lên.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const processAiResponse = async (userMsg: ChatMessageData, allMessages: ChatMessageData[]) => {
    if (!auth.currentUser || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    setIsProcessing(true);

    try {
      // Mark as processing in Firestore
      await updateDoc(doc(db, 'chats', userMsg.id), { status: 'processing' });
      
      let history: ChatMessage[] = allMessages.filter(m => m.id !== userMsg.id).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const currentParts: any[] = [{ text: userMsg.text }];
      if (userMsg.files) {
        userMsg.files.forEach(f => {
          currentParts.push({ inlineData: { data: f.data, mimeType: f.mimeType } });
        });
      }
      history.push({ role: 'user', parts: currentParts });

      const { systemInstruction } = await import('../lib/gemini');
      const tools = [crawlRecipeTool, ...(googleToken ? [searchGoogleDriveTool, searchGooglePhotosTool, searchGoogleKeepTool] : [])];
      
      // Define fallback chain: Primary -> Gemini Flash -> DeepSeek (OR) -> Llama (Groq)
      const fallbacks = [
        'gemini-flash-latest',
        'openrouter/deepseek/deepseek-chat',
        'groq/llama-3.3-70b-versatile'
      ].filter(id => id !== preferences.selectedModelId);

      const aiConfig = { 
        openaiKey: preferences.openaiKey, 
        anthropicKey: preferences.anthropicKey, 
        googleKey: preferences.googleKey,
        openrouterKey: preferences.openrouterKey,
        nvidiaKey: preferences.nvidiaKey,
        groqKey: preferences.groqKey
      };

      let aiResult;
      try {
        aiResult = await chatWithAIWithFallback(
          preferences.selectedModelId, 
          history, 
          systemInstruction,
          tools,
          aiConfig,
          fallbacks
        );

        if (aiResult.functionCalls) {
          for (const call of aiResult.functionCalls) {
            let toolResult = "";
            if (call.name === 'crawl_recipe') {
              toolResult = await crawlRecipe(call.args.url);
            } else if (call.name === 'search_google_drive') {
              toolResult = await searchDrive(call.args.query);
            } else if (call.name === 'search_google_photos') {
              toolResult = await searchPhotos(call.args.query);
            } else if (call.name === 'search_google_keep') {
              toolResult = await searchKeep(call.args.query);
            }

            const actionMsg = call.name === 'crawl_recipe' 
              ? `Đang lấy công thức từ: ${call.args.url}` 
              : `Đang tìm kiếm: ${call.args.query}`;

            history.push({ 
              role: 'model', 
              parts: [{ text: actionMsg }] 
            });
            history.push({ 
              role: 'user', 
              parts: [{ text: toolResult || "Không tìm thấy kết quả nào từ công cụ này." }] 
            });
            aiResult = await chatWithAIWithFallback(
              preferences.selectedModelId, 
              history, 
              systemInstruction,
              tools,
              aiConfig,
              fallbacks
            );
          }
        }
      } catch (error) {
        throw error; // Let the outer catch handle it
      }

        // Update user message status to completed
        await updateDoc(doc(db, 'chats', userMsg.id), { status: 'completed' });

        let finalSuggestions = aiResult.suggestions || [];
        if (aiResult.recipe && !finalSuggestions.some((s: any) => s.action === 'save_recipe')) {
          finalSuggestions = [
            { label: "💾 Lưu công thức này", action: "save_recipe" },
            ...finalSuggestions
          ];
        }

        await addDoc(collection(db, 'chats'), {
          text: aiResult.text || "Xin lỗi, tôi gặp chút trục trặc khi xử lý yêu cầu này (Không có phản hồi từ AI). Vui lòng thử lại hoặc đổi mô hình.",
          suggestions: finalSuggestions,
          recipe: aiResult.recipe || null,
          photos: aiResult.photos || null,
          sender: 'ai',
          userId: auth.currentUser.uid,
          conversationId: userMsg.conversationId,
          timestamp: serverTimestamp()
        });

        // Update conversation last message with AI response
        if (userMsg.conversationId) {
          await updateDoc(doc(db, 'conversations', userMsg.conversationId), {
            lastMessage: aiResult.text?.slice(0, 100) || "Phản hồi từ AI",
            updatedAt: serverTimestamp()
          });
        }
      } catch (aiError: any) {
        console.error("AI Call failed:", aiError);
        await updateDoc(doc(db, 'chats', userMsg.id), { status: 'error' });

        let errorMessage = "Đã xảy ra lỗi khi kết nối với AI.";
        const errorStr = String(aiError).toLowerCase();
        
        if (errorStr.includes('quota') || errorStr.includes('429') || errorStr.includes('limit')) {
          errorMessage = "⚠️ **Hết hạn mức (Quota Limit):** Mô hình AI này hiện đã hết lượt sử dụng hoặc vượt quá giới hạn tốc độ. \n\n**Lời khuyên:** Bạn có thể chuyển sang **Gemini Flash** (Miễn phí) hoặc các model từ **OpenRouter/NVIDIA** để tiếp tục.";
          
          const suggestions = [
            { label: "🔄 Thử lại", action: "retry" },
            { label: "✨ Chuyển sang Gemini Flash (Free)", action: "switch_to_gemini" },
            { label: "🚀 Dùng DeepSeek (OpenRouter)", action: "switch_to_deepseek" },
            { label: "⚙️ Cài đặt API", action: "open_settings" }
          ];

          await addDoc(collection(db, 'chats'), {
            text: errorMessage,
            sender: 'ai',
            userId: auth.currentUser.uid,
            timestamp: serverTimestamp(),
            suggestions
          });
        } else if (errorStr.includes('500') || errorStr.includes('internal')) {
          errorMessage = "⚠️ **Lỗi máy chủ AI (500):** Dịch vụ AI đang gặp sự cố tạm thời. Vui lòng thử lại sau vài phút.";
          await addDoc(collection(db, 'chats'), {
            text: errorMessage,
            sender: 'ai',
            userId: auth.currentUser.uid,
            timestamp: serverTimestamp(),
            suggestions: [
              { label: "🔄 Thử lại", action: "retry" },
              { label: "⚙️ Cài đặt", action: "open_settings" }
            ]
          });
        } else {
          // Try to extract a cleaner message if it's a complex error object
          let detail = aiError.message || String(aiError);
          
          // Look for JSON-like structure in the error message
          const jsonMatch = detail.match(/\{.*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              detail = parsed.error?.message || parsed.message || detail;
            } catch (e) {}
          }
          
          errorMessage = `⚠️ **Lỗi hệ thống:** ${detail}`;
          await addDoc(collection(db, 'chats'), {
            text: errorMessage,
            sender: 'ai',
            userId: auth.currentUser.uid,
            timestamp: serverTimestamp(),
            suggestions: [
              { label: "🔄 Thử lại", action: "retry" },
              { label: "⚙️ Cài đặt", action: "open_settings" }
            ]
          });
        }
      } finally {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
  };

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || inputText;
    if ((!textToSend.trim() && selectedFiles.length === 0) || !auth.currentUser) return;

    // Prevent sending if selected model is in error state
    // (Removed apiStatus check from chat, handled in Profile)

    let convId = activeConversationId;
    
    // Create new conversation if none active
    if (!convId) {
      try {
        const convRef = await addDoc(collection(db, 'conversations'), {
          title: textToSend.slice(0, 30) + (textToSend.length > 30 ? '...' : ''),
          userId: auth.currentUser.uid,
          lastMessage: textToSend,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        convId = convRef.id;
        setActiveConversationId(convId);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'conversations');
        return;
      }
    }

    const userMessage = {
      text: textToSend,
      sender: 'user',
      userId: auth.currentUser.uid,
      conversationId: convId,
      timestamp: serverTimestamp(),
      hasFiles: selectedFiles.length > 0,
      fileNames: selectedFiles.map(f => f.name),
      files: selectedFiles, // Store small files directly for processing
      status: 'pending'
    };

    setInputText('');
    setSelectedFiles([]);
    // We don't call AI here anymore, the useEffect will pick up the 'pending' message
    try {
      await addDoc(collection(db, 'chats'), userMessage);
      // Update conversation last message
      await updateDoc(doc(db, 'conversations', convId), {
        lastMessage: textToSend,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const handleSuggestionClick = (suggestion: {label: string, action: string}) => {
    if (suggestion.action === 'open_settings') {
      // Inform user settings moved to Profile
      return;
    }
    if (suggestion.action === 'retry') {
      const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user');
      if (lastUserMsg) {
        handleSend(lastUserMsg.text);
      }
      return;
    }
    if (suggestion.action === 'switch_to_gemini') {
      updatePreference('selectedModelId', 'gemini-flash-latest');
      // After switching, trigger a retry automatically
      const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user');
      if (lastUserMsg) {
        handleSend(lastUserMsg.text);
      }
      return;
    }
    if (suggestion.action === 'switch_to_deepseek') {
      updatePreference('selectedModelId', 'openrouter/deepseek/deepseek-chat');
      const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user');
      if (lastUserMsg) {
        handleSend(lastUserMsg.text);
      }
      return;
    }
    if (suggestion.action === 'save_recipe') {
      const lastAiMsg = [...messages].reverse().find(m => m.sender === 'ai' && m.recipe);
      if (lastAiMsg) {
        saveRecipeFromChat(lastAiMsg);
      }
      return;
    }
    handleSend(suggestion.label);
  };

  const saveRecipeFromChat = async (msg: ChatMessageData) => {
    if (!auth.currentUser) return;
    setSavingRecipeId(msg.id);
    try {
      let recipeData;

      if (msg.recipe) {
        recipeData = {
          ...msg.recipe,
          authorId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          theme: "Được lưu từ chat (Cấu trúc)"
        };
      } else {
        const titleMatch = msg.text.match(/^# (.*)$/m) || msg.text.match(/^\*\*(.*)\*\*$/m) || [null, "Công thức từ Chat"];
        const title = titleMatch[1];

        recipeData = {
          title: title,
          instructions: msg.text,
          ingredients: [],
          authorId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          theme: "Được lưu từ chat (Văn bản)"
        };
      }

      const error = validateRecipe(recipeData);
      if (error) {
        console.error("Validation failed for chat recipe", error);
        setSavingRecipeId(null);
        return;
      }

      await addDoc(collection(db, 'recipes'), recipeData);
      setTimeout(() => setSavingRecipeId(null), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'recipes');
      setSavingRecipeId(null);
    }
  };

  const colorOptions = {
    user: [
      { name: 'Đen Đá', class: 'bg-stone-900' },
      { name: 'Cam Cháy', class: 'bg-orange-600' },
      { name: 'Xanh Rêu', class: 'bg-emerald-800' },
      { name: 'Xanh Biển', class: 'bg-blue-700' },
    ],
    ai: [
      { name: 'Trắng Sữa', class: 'bg-white' },
      { name: 'Xám Nhạt', class: 'bg-stone-100' },
      { name: 'Vàng Kem', class: 'bg-amber-50' },
      { name: 'Xanh Bạc Hà', class: 'bg-emerald-50' },
    ],
    bg: [
      { name: 'Mặc định', class: 'bg-stone-50' },
      { name: 'Trắng Tinh', class: 'bg-white' },
      { name: 'Gỗ Nhạt', class: 'bg-orange-50/30' },
      { name: 'Xám Xi Măng', class: 'bg-stone-200/50' },
    ]
  };
  
  const filteredMessages = messages.filter(m => 
    m.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.recipe?.title && m.recipe.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const isActuallyTyping = messages.some(m => m.sender === 'user' && (m.status === 'pending' || m.status === 'processing'));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn("flex flex-col h-[calc(100vh-80px)] transition-colors duration-500", preferences.chatBackground)}
    >
      <header className="p-3 md:p-4 bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center shadow-inner">
              <ChefHat className="w-5 h-5 text-orange-600" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-stone-900 text-sm md:text-base">Cố vấn Đầu bếp</h1>
              <div className="flex items-center gap-1 text-[9px] text-green-600 font-bold uppercase tracking-widest">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Trực tuyến
              </div>
            </div>
          </div>

          <div className={cn(
            "flex-1 max-w-md relative transition-all duration-300",
            showMobileSearch ? "flex" : "hidden md:flex"
          )}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Tìm kiếm tin nhắn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl py-1.5 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={() => setShowMobileSearch(!showMobileSearch)}
              className="p-2 md:hidden hover:bg-stone-100 rounded-lg text-stone-500 transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold",
                showHistory ? "bg-orange-100 text-orange-600" : "hover:bg-stone-100 text-stone-500"
              )}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="hidden lg:inline">Lịch sử</span>
            </button>
            <button
              onClick={() => setIsRecipeCrawActive(!isRecipeCrawActive)}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold",
                isRecipeCrawActive ? "bg-orange-100 text-orange-600" : "hover:bg-stone-100 text-stone-500"
              )}
              title="RecipeCraw"
            >
              <Sparkles className={cn("w-5 h-5", isRecipeCrawActive && "animate-pulse")} />
              <span className="hidden lg:inline">RecipeCraw</span>
            </button>
            <button 
              onClick={connectGoogle}
              disabled={isConnectingGoogle}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold",
                googleToken ? "bg-blue-50 text-blue-600" : "hover:bg-stone-100 text-stone-500"
              )}
            >
              {isConnectingGoogle ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5" />}
              {googleToken && <span className="hidden lg:inline">Google</span>}
            </button>
            <button 
              onClick={() => {}} // Settings moved to Profile
              className={cn(
                "p-2 rounded-lg transition-colors hover:bg-stone-100 text-stone-500"
              )}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isRecipeCrawActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-orange-50 border-b border-orange-100 overflow-hidden"
          >
            <div className="max-w-4xl mx-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Sparkles className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-orange-900">RecipeCraw Status</h3>
                    <p className="text-[10px] text-orange-700/70">Công cụ truy xuất dữ liệu đa nền tảng</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsRecipeCrawActive(false)}
                  className="text-orange-400 hover:text-orange-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-white rounded-xl border border-orange-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-3 h-3 text-blue-500" />
                      <span className="text-[10px] font-bold uppercase text-stone-500">Google Drive</span>
                    </div>
                    <div className={cn("w-2 h-2 rounded-full", googleToken ? "bg-green-500" : "bg-stone-300")} />
                  </div>
                  <p className="text-[10px] text-stone-600">
                    {googleToken ? "Đã kết nối. Có thể tìm kiếm công thức trong Drive." : "Chưa kết nối. Nhấn nút Google ở trên để cấp quyền."}
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-orange-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-3 h-3 text-purple-500" />
                      <span className="text-[10px] font-bold uppercase text-stone-500">Google Photos</span>
                    </div>
                    <div className={cn("w-2 h-2 rounded-full", googleToken ? "bg-green-500" : "bg-stone-300")} />
                  </div>
                  <p className="text-[10px] text-stone-600">
                    {googleToken ? "Đã kết nối. Có thể tìm kiếm hình ảnh món ăn." : "Chưa kết nối. Cần quyền Photos Library."}
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-orange-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3 h-3 text-yellow-500" />
                      <span className="text-[10px] font-bold uppercase text-stone-500">Google Keep</span>
                    </div>
                    <div className={cn("w-2 h-2 rounded-full", googleToken ? "bg-green-500" : "bg-stone-300")} />
                  </div>
                  <p className="text-[10px] text-stone-600">
                    {googleToken ? "Đã kết nối. Có thể đọc ghi chú công thức." : "Chưa kết nối. Cần quyền Keep API."}
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-orange-100/50 rounded-xl border border-orange-200/50">
                <h4 className="text-[10px] font-bold uppercase text-orange-800 mb-1">Cấu hình nâng cao</h4>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={true} readOnly className="rounded border-orange-300 text-orange-600 focus:ring-orange-500" />
                    <span className="text-[10px] text-orange-700">Tự động đối chiếu giá thị trường</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={true} readOnly className="rounded border-orange-300 text-orange-600 focus:ring-orange-500" />
                    <span className="text-[10px] text-orange-700">Ưu tiên dữ liệu cá nhân</span>
                  </label>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

        {/* Settings modal removed and moved to Profile */}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar for History */}
        <AnimatePresence>
          {showHistory && (
            <motion.aside
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              className="absolute md:relative z-40 w-[280px] h-full bg-white border-r border-stone-200 flex flex-col shadow-xl md:shadow-none"
            >
              <div className="p-4 border-b border-stone-100 flex items-center justify-between">
                <h2 className="font-bold text-stone-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-orange-500" />
                  Lịch sử Chat
                </h2>
                <button 
                  onClick={() => {
                    setActiveConversationId(null);
                    setMessages([]);
                  }}
                  className="p-1.5 hover:bg-orange-50 text-orange-600 rounded-lg transition-colors"
                  title="Chat mới"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <MessageSquare className="w-8 h-8 text-stone-200 mx-auto" />
                    <p className="text-xs text-stone-400">Chưa có lịch sử trò chuyện</p>
                  </div>
                ) : (
                  conversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => {
                        setActiveConversationId(conv.id);
                        if (window.innerWidth < 768) setShowHistory(false);
                      }}
                      className={cn(
                        "w-full text-left p-3 rounded-xl transition-all group relative",
                        activeConversationId === conv.id 
                          ? "bg-orange-50 border-orange-100 ring-1 ring-orange-200" 
                          : "hover:bg-stone-50 border-transparent"
                      )}
                    >
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "text-xs font-bold truncate pr-6",
                          activeConversationId === conv.id ? "text-orange-900" : "text-stone-700"
                        )}>
                          {conv.title}
                        </span>
                        <span className="text-[10px] text-stone-400 truncate">
                          {conv.lastMessage || "Chưa có tin nhắn"}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id);
                        }}
                        className="absolute top-3 right-2 p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </button>
                  ))
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {filteredMessages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6 animate-in fade-in zoom-in duration-700">
            <div className="relative">
              <div className="w-24 h-24 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto shadow-inner rotate-3">
                <ChefHat className="w-12 h-12 text-orange-600 -rotate-3" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
              </div>
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className="font-bold text-stone-900 text-lg">Chào mừng bạn đến với Bếp Trưởng AI</h3>
              <p className="text-stone-500 text-sm leading-relaxed">
                {searchQuery 
                  ? `Không tìm thấy kết quả nào cho "${searchQuery}". Hãy thử từ khóa khác.` 
                  : "Tôi có thể giúp bạn lên thực đơn, tính toán Food Cost, tối ưu hóa Yield hoặc tìm kiếm công thức từ Google Drive/Photos."}
              </p>
            </div>
            {!searchQuery && (
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                {['Tính Food Cost', 'Lên thực đơn', 'Tìm công thức', 'Tối ưu Yield'].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => setInputText(hint)}
                    className="px-3 py-2 bg-white border border-stone-100 rounded-xl text-[10px] font-bold uppercase tracking-wider text-stone-500 hover:border-orange-300 hover:text-orange-600 transition-all shadow-sm"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {filteredMessages.map((msg, idx) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={cn(
              "flex gap-3 max-w-[90%] md:max-w-[80%]",
              msg.sender === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
              msg.sender === 'user' ? "bg-stone-800" : "bg-white border border-stone-100"
            )}>
              {msg.sender === 'user' ? <User className="w-5 h-5 text-stone-300" /> : <ChefHat className="w-5 h-5 text-orange-600" />}
            </div>
            <div className={cn(
              "space-y-2 flex flex-col",
              msg.sender === 'user' ? "items-end" : "items-start"
            )}>
              <div className={cn(
                "p-4 rounded-2xl text-sm leading-relaxed shadow-sm transition-all",
                msg.sender === 'user' 
                  ? cn(preferences.chatUserBubbleColor, "text-white rounded-tr-none", (msg.status === 'pending' || msg.status === 'processing') && "animate-pulse opacity-80") 
                  : cn(preferences.chatAiBubbleColor, "border border-stone-100 text-stone-800 rounded-tl-none")
              )}>
                {msg.hasFiles && msg.files && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {msg.files.map((file, i) => (
                      <div key={i} className="relative group">
                        {file.mimeType.startsWith('image/') ? (
                          <img 
                            src={`data:${file.mimeType};base64,${file.data}`} 
                            alt={file.name}
                            className="w-32 h-32 object-cover rounded-xl border border-white/20 shadow-sm hover:scale-105 transition-transform cursor-pointer"
                            referrerPolicy="no-referrer"
                            onClick={() => window.open(`data:${file.mimeType};base64,${file.data}`, '_blank')}
                          />
                        ) : (
                          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-xl text-[10px] font-medium border border-white/10">
                            <FileText className="w-4 h-4" />
                            <span className="truncate max-w-[100px]">{file.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {msg.recipe && (
                  <div className="flex items-center gap-2 mb-2 bg-orange-50 text-orange-600 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest w-fit border border-orange-100">
                    <Sparkles className="w-3 h-3" />
                    Công thức có cấu trúc
                  </div>
                )}
                <div className="markdown-body">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>

                {msg.sender === 'user' && (msg.status === 'pending' || msg.status === 'processing') && (
                  <div className="flex items-center gap-1.5 mt-2 text-[10px] text-white/60 font-medium italic">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Bếp trưởng đang xem xét...</span>
                  </div>
                )}

                {msg.recipe && (
                  <RecipeCard 
                    recipe={msg.recipe} 
                    onSave={() => saveRecipeFromChat(msg)}
                    isSaving={savingRecipeId === msg.id}
                  />
                )}

                {msg.photos && msg.photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                    {msg.photos.map((photo, i) => (
                      <motion.div 
                        key={i}
                        whileHover={{ scale: 1.05 }}
                        className="relative aspect-square rounded-xl overflow-hidden border border-stone-200 shadow-sm cursor-pointer group"
                        onClick={() => window.open(photo.url, '_blank')}
                      >
                        <img 
                          src={photo.url} 
                          alt={photo.filename}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
              
              {msg.sender === 'ai' && (
                <div className="flex flex-col gap-2">
                  {!msg.recipe && (
                    <button
                      onClick={() => saveRecipeFromChat(msg)}
                      className="self-start flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-orange-600 transition-colors px-2 py-1"
                    >
                      {savingRecipeId === msg.id ? (
                        <>
                          <Check className="w-3 h-3" />
                          Đã lưu vào kho
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3" />
                          Lưu công thức này
                        </>
                      )}
                    </button>
                  )}
                  
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {msg.suggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="flex items-center gap-1.5 bg-white border border-stone-200 px-3 py-1.5 rounded-full text-[10px] font-bold text-stone-600 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 transition-all shadow-sm"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-orange-400" />
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}
        
        {isActuallyTyping && (
          <div className="flex gap-3 mr-auto">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <ChefHat className="w-4 h-4 text-orange-600" />
            </div>
            <div className={cn("border border-stone-100 shadow-sm p-4 rounded-2xl rounded-tl-none flex gap-1", preferences.chatAiBubbleColor)}>
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-stone-300 rounded-full" />
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-stone-300 rounded-full" />
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-stone-300 rounded-full" />
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      <div className="p-3 md:p-4 bg-white/80 backdrop-blur-md border-t border-stone-200 sticky bottom-0 z-30">
        <div className="max-w-4xl mx-auto space-y-3">
          <AnimatePresence>
            {fileError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-xl text-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{fileError}</span>
                </div>
                <button onClick={() => setFileError(null)}>
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Tệp đính kèm ({selectedFiles.length})</span>
                  <button 
                    onClick={() => setSelectedFiles([])}
                    className="text-[10px] font-bold text-orange-600 hover:text-orange-700 transition-colors"
                  >
                    Xóa tất cả
                  </button>
                </div>
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex flex-wrap gap-2"
                >
                  {selectedFiles.map((file, i) => (
                    <div key={i} className="relative group">
                      <div className="bg-white p-1 rounded-xl flex items-center gap-2 pr-8 border border-stone-200 shadow-sm">
                        {file.mimeType.startsWith('image/') ? (
                          <img 
                            src={`data:${file.mimeType};base64,${file.data}`} 
                            alt={file.name}
                            className="w-10 h-10 object-cover rounded-lg"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-stone-50 rounded-lg flex items-center justify-center">
                            {file.mimeType.startsWith('video/') ? <Video className="w-5 h-5 text-red-500" /> : <FileText className="w-5 h-5 text-blue-500" />}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold truncate max-w-[80px] text-stone-700">{file.name}</span>
                          <span className="text-[8px] text-stone-400 uppercase">{file.mimeType.split('/')[1]}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -right-1 bg-stone-800 text-white rounded-full p-1 shadow-lg hover:bg-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* API Status check removed from chat */}

          <div className="relative flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              className="hidden"
              accept="image/*,video/*,application/pdf,text/*"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isActuallyTyping}
              className="p-3 bg-stone-100 hover:bg-stone-200 rounded-2xl text-stone-500 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              title="Đính kèm"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <div className="relative flex-1 group">
              <input
                type="text"
                placeholder={isRecipeCrawActive ? "RecipeCraw đang hoạt động..." : "Hỏi Bếp Trưởng AI..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                className={cn(
                  "w-full bg-stone-50 border border-stone-200 rounded-2xl py-3.5 pl-5 pr-14 focus:outline-none focus:ring-2 transition-all shadow-inner",
                  isRecipeCrawActive ? "focus:ring-orange-500 border-orange-200" : "focus:ring-orange-500"
                )}
              />
              <button
                onClick={() => handleSend()}
                disabled={(!inputText.trim() && selectedFiles.length === 0) || isActuallyTyping}
                className="absolute right-1.5 top-1.5 bottom-1.5 w-11 bg-orange-600 rounded-xl flex items-center justify-center text-white hover:bg-orange-700 disabled:opacity-50 transition-all hover:scale-105 active:scale-95 shadow-md"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</motion.div>
  );
}
