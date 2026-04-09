import { useState, useEffect, useRef } from 'react';
import { db, collection, query, where, orderBy, onSnapshot, auth, addDoc, serverTimestamp, doc, getDoc, updateDoc, handleFirestoreError, OperationType, googleProvider, signInWithPopup } from '../lib/firebase';
import { chatWithChef, ChatMessage, searchGoogleDriveTool, searchGooglePhotosTool, searchGoogleKeepTool } from '../lib/gemini';
import { chatWithAI, AVAILABLE_MODELS, AIModel } from '../lib/ai';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ChefHat, User, Sparkles, Settings, X, Palette, Save, Check, Paperclip, FileText, Video, Image as ImageIcon, Globe, Loader2, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn, validateRecipe } from '../lib/utils';
import { DollarSign, Clock, ListChecks, Utensils } from 'lucide-react';

interface RecipeData {
  title: string;
  ingredients: { name: string; amount: string; unit: string; price: number }[];
  instructions: string;
  totalCost: number;
  recommendedPrice: number;
}

function RecipeCard({ recipe }: { recipe: RecipeData }) {
  if (!recipe) return null;

  return (
    <div className="mt-4 bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-stone-900 p-4 text-white">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Utensils className="w-5 h-5 text-orange-400" />
          {recipe.title || "Công thức không tên"}
        </h3>
      </div>
      
      <div className="p-4 space-y-4">
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 flex items-center gap-1">
              <ListChecks className="w-3 h-3" />
              Nguyên liệu
            </h4>
            <div className="grid grid-cols-1 gap-1">
              {recipe.ingredients.map((ing, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-stone-50 last:border-0">
                  <span className="text-stone-700 font-medium">{ing.name}</span>
                  <span className="text-stone-500">{ing.amount} {ing.unit} • <span className="text-stone-400">${ing.price}</span></span>
                </div>
              ))}
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
    </div>
  );
}

interface ChatMessageData {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  userId: string;
  timestamp: any;
  suggestions?: { label: string; action: string }[];
  recipe?: {
    title: string;
    ingredients: { name: string; amount: string; unit: string; price: number }[];
    instructions: string;
    totalCost: number;
    recommendedPrice: number;
  };
  hasFiles?: boolean;
  fileNames?: string[];
}

export function ChefChat() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    chatUserBubbleColor: 'bg-stone-900',
    chatAiBubbleColor: 'bg-white',
    chatBackground: 'bg-stone-50',
    selectedModelId: 'gemini-3-flash-preview'
  });
  const [savingRecipeId, setSavingRecipeId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<{data: string, mimeType: string, name: string}[]>([]);
  const [suggestions, setSuggestions] = useState<{label: string, action: string}[]>([]);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isRecipeCrawActive, setIsRecipeCrawActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Load user preferences
    const loadPrefs = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser!.uid));
        if (userDoc.exists() && userDoc.data().preferences) {
          setPreferences(prev => ({ ...prev, ...userDoc.data().preferences }));
        }
      } catch (error) {
        console.error("Failed to load preferences", error);
      }
    };
    loadPrefs();

    const q = query(
      collection(db, 'chats'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessageData[];
      setMessages(msgs);
      
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.sender === 'ai' && lastMsg.suggestions) {
        setSuggestions(lastMsg.suggestions);
      } else {
        setSuggestions([]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      // Note: This is a simplified search. Real Photos API requires more complex search body.
      const response = await fetch(`https://photoslibrary.googleapis.com/v1/mediaItems:search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pageSize: 5,
          filters: {
            contentFilter: {
              includedContentCategories: ['FOOD']
            }
          }
        })
      });
      const data = await response.json();
      if (data.mediaItems && data.mediaItems.length > 0) {
        return `Tôi tìm thấy một số hình ảnh liên quan đến ẩm thực trong Photos của bạn:\n` + 
          data.mediaItems.map((m: any) => `![${m.filename}](${m.baseUrl}=w200-h200)`).join('\n');
      }
      return "Không tìm thấy hình ảnh món ăn nào liên quan trong Photos của bạn.";
    } catch (error) {
      console.error("Photos search failed", error);
      return "Có lỗi xảy ra khi tìm kiếm trong Photos.";
    }
  };

  const searchKeep = async (searchQuery: string) => {
    // Keep API is restricted for consumer accounts. We'll simulate or provide a link.
    return `Tính năng tìm kiếm Google Keep đang được đồng bộ. Bạn có thể kiểm tra trực tiếp tại [Google Keep](https://keep.google.com/) với từ khóa: "${searchQuery}".`;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = await Promise.all(Array.from(files).map(async file => {
      return new Promise<{data: string, mimeType: string, name: string}>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({ data: base64, mimeType: file.type, name: file.name });
        };
        reader.readAsDataURL(file);
      });
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || inputText;
    if ((!textToSend.trim() && selectedFiles.length === 0) || !auth.currentUser) return;

    const userMessage = {
      text: textToSend,
      sender: 'user',
      userId: auth.currentUser.uid,
      timestamp: serverTimestamp(),
      hasFiles: selectedFiles.length > 0,
      fileNames: selectedFiles.map(f => f.name)
    };

    setInputText('');
    const currentFiles = [...selectedFiles];
    setSelectedFiles([]);
    setIsTyping(true);
    setSuggestions([]);

    try {
      await addDoc(collection(db, 'chats'), userMessage);
      
      let history: ChatMessage[] = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const currentParts: any[] = [{ text: textToSend }];
      currentFiles.forEach(f => {
        currentParts.push({ inlineData: { data: f.data, mimeType: f.mimeType } });
      });
      history.push({ role: 'user', parts: currentParts });

      const tools = googleToken ? [searchGoogleDriveTool, searchGooglePhotosTool, searchGoogleKeepTool] : undefined;
      
      let aiResult;
      // If using non-google provider, we skip tools for now as they require different handling
      const currentModel = AVAILABLE_MODELS.find(m => m.id === preferences.selectedModelId);
      
      if (currentModel?.provider === 'google') {
        aiResult = await chatWithChef(history, tools);
        
        // Handle tool calls
        if (aiResult.functionCalls && aiResult.functionCalls.length > 0) {
          const toolPromises = aiResult.functionCalls.map(async (call) => {
            let toolResult = "";
            if (call.name === 'search_google_drive') {
              toolResult = await searchDrive(call.args.query);
            } else if (call.name === 'search_google_photos') {
              toolResult = await searchPhotos(call.args.query);
            } else if (call.name === 'search_google_keep') {
              toolResult = await searchKeep(call.args.query);
            }
            return { call, toolResult };
          });

          const results = await Promise.all(toolPromises);

          for (const { call, toolResult } of results) {
            history.push({ 
              role: 'model', 
              parts: [{ text: `Đang sử dụng RecipeCraw để tìm kiếm: ${call.args.query}` }] 
            });
            history.push({ 
              role: 'user', 
              parts: [{ text: toolResult || "Không tìm thấy kết quả nào từ công cụ này." }] 
            });
          }

          aiResult = await chatWithChef(history, tools);
        }
      } else {
        // Use unified chat for other providers
        const { systemInstruction } = await import('../lib/gemini');
        aiResult = await chatWithAI(preferences.selectedModelId, history, systemInstruction);
      }

      if (!aiResult.text) {
        aiResult.text = "Xin lỗi, tôi gặp chút trục trặc khi xử lý yêu cầu này. Bạn có thể thử lại hoặc hỏi câu khác nhé!";
      }

      await addDoc(collection(db, 'chats'), {
        text: aiResult.text,
        suggestions: aiResult.suggestions || [],
        recipe: aiResult.recipe || null,
        sender: 'ai',
        userId: auth.currentUser.uid,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion: {label: string, action: string}) => {
    handleSend(suggestion.label);
  };

  const updatePreference = async (key: string, value: string) => {
    if (!auth.currentUser) return;
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        preferences: newPrefs
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn("flex flex-col h-[calc(100vh-80px)] transition-colors duration-500", preferences.chatBackground)}
    >
      <header className="p-6 bg-white border-b border-stone-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
            <ChefHat className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="font-bold text-stone-900">Cố vấn Đầu bếp</h1>
            <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold uppercase tracking-widest">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Trực tuyến
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRecipeCrawActive(!isRecipeCrawActive)}
            className={cn(
              "p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold",
              isRecipeCrawActive ? "bg-orange-100 text-orange-600" : "hover:bg-stone-100 text-stone-500"
            )}
            title="Kích hoạt RecipeCraw Subagent"
          >
            <Search className="w-5 h-5" />
            <span className="hidden md:inline">RecipeCraw</span>
          </button>
          <button 
            onClick={connectGoogle}
            disabled={isConnectingGoogle}
            className={cn(
              "p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold",
              googleToken ? "bg-blue-50 text-blue-600" : "hover:bg-stone-100 text-stone-500"
            )}
            title={googleToken ? "Đã kết nối Google" : "Kết nối Google Services"}
          >
            {isConnectingGoogle ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5" />}
            {googleToken && <span className="hidden md:inline">Đã kết nối</span>}
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-500"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white border-b border-stone-200 overflow-hidden"
          >
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-stone-900 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-orange-500" />
                  Tùy chỉnh giao diện
                </h2>
                <button onClick={() => setShowSettings(false)} className="text-stone-400 hover:text-stone-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Màu tin nhắn của bạn</label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.user.map(color => (
                      <button
                        key={color.class}
                        onClick={() => updatePreference('chatUserBubbleColor', color.class)}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all",
                          color.class,
                          preferences.chatUserBubbleColor === color.class ? "border-orange-500 scale-110" : "border-transparent"
                        )}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Màu tin nhắn AI</label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.ai.map(color => (
                      <button
                        key={color.class}
                        onClick={() => updatePreference('chatAiBubbleColor', color.class)}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all",
                          color.class,
                          preferences.chatAiBubbleColor === color.class ? "border-orange-500 scale-110" : "border-transparent"
                        )}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Màu nền chat</label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.bg.map(color => (
                      <button
                        key={color.class}
                        onClick={() => updatePreference('chatBackground', color.class)}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all",
                          color.class,
                          preferences.chatBackground === color.class ? "border-orange-500 scale-110" : "border-transparent"
                        )}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="col-span-full space-y-3 pt-4 border-t border-stone-100">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Chọn Mô hình AI</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {AVAILABLE_MODELS.map(model => (
                      <button
                        key={model.id}
                        onClick={() => updatePreference('selectedModelId', model.id)}
                        className={cn(
                          "p-4 rounded-xl border-2 text-left transition-all group",
                          preferences.selectedModelId === model.id 
                            ? "border-orange-500 bg-orange-50" 
                            : "border-stone-100 hover:border-stone-200"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-stone-900">{model.name}</span>
                          <span className={cn(
                            "text-[8px] px-1.5 py-0.5 rounded font-bold uppercase",
                            model.provider === 'google' ? "bg-blue-100 text-blue-600" :
                            model.provider === 'openai' ? "bg-green-100 text-green-600" :
                            "bg-purple-100 text-purple-600"
                          )}>
                            {model.provider}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-500 leading-tight">{model.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 text-orange-400" />
            </div>
            <p className="text-stone-500 text-sm px-12">Hỏi tôi bất cứ điều gì về công thức, chi phí hoặc quản lý bếp.</p>
            {isRecipeCrawActive && (
              <p className="text-orange-600 text-[10px] font-bold uppercase tracking-widest">RecipeCraw Subagent đang sẵn sàng tìm kiếm trên Web & Google Services</p>
            )}
          </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 max-w-[85%]",
              msg.sender === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              msg.sender === 'user' ? "bg-stone-200" : "bg-orange-100"
            )}>
              {msg.sender === 'user' ? <User className="w-4 h-4 text-stone-600" /> : <ChefHat className="w-4 h-4 text-orange-600" />}
            </div>
            <div className="space-y-2 flex flex-col">
              <div className={cn(
                "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                msg.sender === 'user' 
                  ? cn(preferences.chatUserBubbleColor, "text-white rounded-tr-none") 
                  : cn(preferences.chatAiBubbleColor, "border border-stone-100 text-stone-800 rounded-tl-none")
              )}>
                {msg.hasFiles && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {msg.fileNames?.map((name: string, i: number) => (
                      <div key={i} className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg text-[10px] font-medium">
                        <FileText className="w-3 h-3" />
                        {name}
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

                {msg.recipe && <RecipeCard recipe={msg.recipe} />}
              </div>
              
              {msg.sender === 'ai' && (
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
            </div>
          </div>
        ))}
        
        {isTyping && (
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

        <AnimatePresence>
          {suggestions.length > 0 && !isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex flex-wrap gap-2 pt-2"
            >
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="flex items-center gap-2 bg-white border border-stone-200 px-4 py-2 rounded-full text-xs font-bold text-stone-600 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 transition-all shadow-sm"
                >
                  <Sparkles className="w-3 h-3 text-orange-400" />
                  {suggestion.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={scrollRef} />
      </div>

      <div className="p-4 bg-white border-t border-stone-200 space-y-4">
        <AnimatePresence>
          {selectedFiles.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-wrap gap-2"
            >
              {selectedFiles.map((file, i) => (
                <div key={i} className="relative group">
                  <div className="bg-stone-100 p-2 rounded-xl flex items-center gap-2 pr-8">
                    {file.mimeType.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-blue-500" /> : 
                     file.mimeType.startsWith('video/') ? <Video className="w-4 h-4 text-red-500" /> : 
                     <FileText className="w-4 h-4 text-stone-500" />}
                    <span className="text-[10px] font-medium truncate max-w-[100px]">{file.name}</span>
                  </div>
                  <button
                    onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 bg-stone-800 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

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
            className="p-3 bg-stone-100 hover:bg-stone-200 rounded-2xl text-stone-500 transition-colors"
            title="Đính kèm file/video"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={isRecipeCrawActive ? "RecipeCraw đang hoạt động..." : "Nhập tin nhắn..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              className={cn(
                "w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 transition-all",
                isRecipeCrawActive ? "focus:ring-orange-500 border-orange-200" : "focus:ring-orange-500"
              )}
            />
            <button
              onClick={() => handleSend()}
              disabled={(!inputText.trim() && selectedFiles.length === 0) || isTyping}
              className="absolute right-2 top-2 bottom-2 w-10 bg-orange-600 rounded-xl flex items-center justify-center text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
