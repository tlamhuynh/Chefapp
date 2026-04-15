import { useState, useEffect, useRef } from 'react';
import { db, collection, query, where, orderBy, onSnapshot, auth, addDoc, serverTimestamp, doc, getDoc, getDocs, updateDoc, deleteDoc, setDoc, handleFirestoreError, OperationType, googleProvider, signInWithPopup } from '../lib/firebase';
import { chatWithChef, ChatMessage, searchGoogleDriveTool, searchGooglePhotosTool, searchGoogleKeepTool, crawlRecipeTool, recipeResponseSchema } from '../lib/gemini';
import { chatWithAI, chatWithAIWithFallback, AVAILABLE_MODELS, AIModel, multiAgentChat } from '../lib/ai';
import { getMemories, formatMemoriesForPrompt, extractMemoriesFromChat, Memory } from '../lib/memory';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ChefHat, User, Sparkles, Settings, X, Palette, Save, Check, Paperclip, FileText, Video, Image as ImageIcon, Globe, Loader2, Search, Trash2, MessageSquare, AlertCircle, Pencil, ListChecks, ChevronDown, ChevronUp, Zap, Cpu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn, validateRecipe } from '../lib/utils';
import { DollarSign, Clock, Utensils } from 'lucide-react';
import { Logo } from './Logo';

interface RecipeData {
  title: string;
  ingredients: { name: string; amount: string; unit: string; purchasePrice: number; costPerAmount: number }[];
  instructions: string;
  totalCost: number;
  recommendedPrice: number;
  image?: string;
}

function RecipeCard({ 
  recipe, 
  onSave, 
  isSaving,
  onSaveImage,
  isSavingImage
}: { 
  recipe: RecipeData, 
  onSave?: () => void, 
  isSaving?: boolean,
  onSaveImage?: (e: React.MouseEvent) => void,
  isSavingImage?: boolean
}) {
  if (!recipe) return null;

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSave}
      className={cn(
        "mt-4 bg-white border rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.02)] cursor-pointer transition-all group",
        isSaving ? "border-neutral-900 ring-1 ring-neutral-900/5" : "border-neutral-100 hover:border-neutral-200"
      )}
    >
      {recipe.image && (
        <div className="aspect-video w-full overflow-hidden relative">
          <img 
            src={recipe.image} 
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-3 right-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSaveImage?.(e);
              }}
              className={cn(
                "p-2 rounded-xl backdrop-blur-md transition-all shadow-lg",
                isSavingImage 
                  ? "bg-green-500 text-white" 
                  : "bg-white/80 text-neutral-900 opacity-0 group-hover:opacity-100 hover:bg-white"
              )}
            >
              {isSavingImage ? <Check className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
      
      <div className="p-5 space-y-5">
        <div className="flex justify-between items-start">
          <h3 className="font-semibold text-lg text-neutral-900 leading-tight">
            {recipe.title || "Công thức không tên"}
          </h3>
          {!recipe.image && (
            <div className="p-2 bg-neutral-50 rounded-lg">
              <Utensils className="w-4 h-4 text-neutral-400" />
            </div>
          )}
        </div>

        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Nguyên liệu
            </h4>
            <div className="bg-neutral-50 rounded-xl p-3.5 space-y-1.5">
              {recipe.ingredients.map((ing, i) => (
                <div key={i} className="flex justify-between items-center text-[11px]">
                  <span className="text-neutral-600">{ing.name}</span>
                  <span className="text-neutral-900 font-medium">{ing.amount} {ing.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-neutral-50">
          <div className="flex gap-5">
            <div className="flex flex-col">
              <span className="text-[9px] font-medium text-neutral-400 uppercase">Cost</span>
              <span className="text-sm font-semibold text-neutral-900">${recipe.totalCost?.toLocaleString()}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-medium text-neutral-400 uppercase">Giá bán</span>
              <span className="text-sm font-semibold text-neutral-900">${recipe.recommendedPrice?.toLocaleString()}</span>
            </div>
          </div>
          <button className={cn(
            "p-2.5 rounded-lg transition-all",
            isSaving ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-400 group-hover:bg-neutral-900 group-hover:text-white"
          )}>
            {isSaving ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          </button>
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
  internalMonologue?: string;
  proposedActions?: { type: string; data: any; reason: string; approved?: boolean }[];
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
  updatePreference: (key: string, value: any) => void;
  setActiveTab?: (tab: any) => void;
}

export function ChefChat({ preferences, updatePreference, setActiveTab }: ChefChatProps) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showMonologue, setShowMonologue] = useState<Record<string, boolean>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | 'all' | null>(null);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [savingRecipeId, setSavingRecipeId] = useState<string | null>(null);
  const [savingImageUrls, setSavingImageUrls] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<{data: string, mimeType: string, name: string}[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isRecipeCrawActive, setIsRecipeCrawActive] = useState(false);
  const [crawlUrl, setCrawlUrl] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isProcessingRef = useRef(false);

  const isActuallyTyping = messages.some(m => m.sender === 'user' && (m.status === 'pending' || m.status === 'processing'));

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
    if (!auth.currentUser) return;
    
    getMemories(auth.currentUser.uid).then(setMemories);
  }, [activeConversationId]);

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
  }, [messages, isActuallyTyping]);

  const cleanupInactiveChats = async () => {
    if (!auth.currentUser) return;
    try {
      setIsProcessing(true);
      // 1. Delete all messages with status 'error'
      const errorMsgQ = query(collection(db, 'chats'), where('userId', '==', auth.currentUser.uid), where('status', '==', 'error'));
      const errorMsgSnapshot = await getDocs(errorMsgQ);
      const deleteMsgPromises = errorMsgSnapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deleteMsgPromises);

      // 2. Find and delete conversations with no messages
      const convSnapshot = await getDocs(query(collection(db, 'conversations'), where('userId', '==', auth.currentUser.uid)));
      for (const convDoc of convSnapshot.docs) {
        const msgCheckQ = query(collection(db, 'chats'), where('conversationId', '==', convDoc.id));
        const msgCheckSnapshot = await getDocs(msgCheckQ);
        if (msgCheckSnapshot.empty) {
          await deleteDoc(convDoc.ref);
          if (activeConversationId === convDoc.id) {
            setActiveConversationId(null);
            setMessages([]);
          }
        }
      }
      setError("Đã dọn dẹp dữ liệu chat không hoạt động.");
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      console.error("Cleanup failed:", err);
      setError("Không thể dọn dẹp dữ liệu.");
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteConversation = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      setIsProcessing(true);
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
      setShowDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'conversations');
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteAllHistory = async () => {
    if (!auth.currentUser) return;
    try {
      setIsProcessing(true);
      const convQ = query(collection(db, 'conversations'), where('userId', '==', auth.currentUser.uid));
      const convSnapshot = await getDocs(convQ);
      
      const msgQ = query(collection(db, 'chats'), where('userId', '==', auth.currentUser.uid));
      const msgSnapshot = await getDocs(msgQ);
      
      const deletePromises = [
        ...convSnapshot.docs.map(d => deleteDoc(d.ref)),
        ...msgSnapshot.docs.map(d => deleteDoc(d.ref))
      ];
      
      await Promise.all(deletePromises);
      setActiveConversationId(null);
      setMessages([]);
      setShowDeleteConfirm(null);
      setError("Đã xóa toàn bộ lịch sử chat.");
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      console.error("Delete all failed:", err);
      setError("Không thể xóa toàn bộ lịch sử.");
    } finally {
      setIsProcessing(false);
    }
  };

  const updateConversationTitle = async (id: string, newTitle: string) => {
    if (!auth.currentUser || !newTitle.trim()) {
      setEditingTitle(false);
      return;
    }
    try {
      await updateDoc(doc(db, 'conversations', id), {
        title: newTitle,
        updatedAt: serverTimestamp()
      });
      setEditingTitle(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'conversations');
    }
  };

  const connectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      if (typeof googleProvider.addScope === 'function') {
        googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
        googleProvider.addScope('https://www.googleapis.com/auth/photoslibrary.readonly');
      }
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

  const handleDirectCrawl = async () => {
    if (!crawlUrl || !auth.currentUser) return;
    
    setIsCrawling(true);
    try {
      const crawlResult = await crawlRecipe(crawlUrl);
      
      const prompt = `Tôi vừa lấy được dữ liệu thô từ một trang web nấu ăn:
${crawlResult}

Hãy phân tích và chuyển đổi dữ liệu này thành một công thức nấu ăn chuyên nghiệp. 
Định lượng nguyên liệu nếu thiếu (ước tính hợp lý). 
Tính toán chi phí ước tính (Food Cost) cho mỗi nguyên liệu.
Trả về kết quả theo đúng định dạng JSON chuẩn của bạn.`;

      const aiConfig = { 
        openaiKey: preferences.openaiKey, 
        anthropicKey: preferences.anthropicKey, 
        googleKey: preferences.googleKey,
        openrouterKey: preferences.openrouterKey,
        nvidiaKey: preferences.nvidiaKey,
        groqKey: preferences.groqKey
      };

      const aiResponse = await chatWithChef(
        [{ role: 'user', parts: [{ text: prompt }] }],
        undefined,
        preferences.googleKey,
        preferences.selectedModelId
      );

      if (aiResponse && aiResponse.recipe) {
        let convId = activeConversationId;
        if (!convId) {
          try {
            const convRef = await addDoc(collection(db, 'conversations'), {
              title: aiResponse.recipe.title,
              userId: auth.currentUser.uid,
              lastMessage: `Đã tìm nạp công thức: ${aiResponse.recipe.title}`,
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp()
            });
            convId = convRef.id;
            setActiveConversationId(convId);
          } catch (err) {
            console.error("Failed to create conversation for crawl:", err);
            return;
          }
        }

        // Add to chat
        const aiMsgId = Math.random().toString(36).substring(7);
        await setDoc(doc(db, 'chats', aiMsgId), {
          text: aiResponse.text || `Đã tìm nạp thành công công thức: ${aiResponse.recipe.title}`,
          sender: 'ai',
          userId: auth.currentUser.uid,
          conversationId: convId,
          timestamp: serverTimestamp(),
          recipe: aiResponse.recipe,
          status: 'completed'
        });
        
        await updateDoc(doc(db, 'conversations', convId), {
          updatedAt: serverTimestamp(),
          lastMessage: `Đã tìm nạp công thức: ${aiResponse.recipe.title}`
        });
        
        setCrawlUrl('');
        setIsRecipeCrawActive(false);
      }
    } catch (error) {
      console.error("Direct crawl error:", error);
    } finally {
      setIsCrawling(false);
    }
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
      setError(null);
      
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

      const aiConfig = { 
        openaiKey: preferences.openaiKey, 
        anthropicKey: preferences.anthropicKey, 
        googleKey: preferences.googleKey,
        openrouterKey: preferences.openrouterKey,
        nvidiaKey: preferences.nvidiaKey,
        groqKey: preferences.groqKey
      };

      // Fetch context for agents
      // @ts-ignore
      const inventorySnap = await getDocs(collection(db, 'inventory'));
      const inventory = inventorySnap.docs.map((d: any) => d.data());
      // @ts-ignore
      const recipesSnap = await getDocs(collection(db, 'recipes'));
      const recipes = recipesSnap.docs.map((d: any) => d.data());

      const result = await multiAgentChat(
        preferences.selectedModelId,
        history,
        "Bạn là Bếp trưởng điều phối của một nhà hàng chuyên nghiệp.",
        aiConfig,
        inventory,
        recipes
      );

      const aiMsgId = Math.random().toString(36).substring(7);
      await setDoc(doc(db, 'chats', aiMsgId), {
        text: result.text,
        internalMonologue: result.internalMonologue,
        proposedActions: result.proposedActions || [],
        sender: 'ai',
        userId: auth.currentUser?.uid,
        conversationId: activeConversationId,
        timestamp: serverTimestamp(),
        status: 'completed'
      });

      // Update user message status to completed
      await updateDoc(doc(db, 'chats', userMsg.id), { status: 'completed' });

      // Extract memories in background
      extractMemoriesFromChat(auth.currentUser!.uid, [...allMessages, { text: result.text, sender: 'ai' }], preferences.selectedModelId, aiConfig);

    } catch (aiError: any) {
      console.error("AI Call failed:", aiError);
      setError(aiError.message || "Bếp trưởng đang bận hoặc có lỗi kết nối. Vui lòng thử lại.");
      await updateDoc(doc(db, 'chats', userMsg.id), { status: 'error' });
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  const approveAction = async (msgId: string, actionIndex: number) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg || !msg.proposedActions) return;

    const action = msg.proposedActions[actionIndex];
    if (action.approved) return;

    try {
      if (action.type === 'add_recipe') {
        await addDoc(collection(db, 'recipes'), {
          ...action.data,
          authorId: auth.currentUser?.uid,
          createdAt: serverTimestamp()
        });
      } else if (action.type === 'update_inventory') {
        const q = query(collection(db, 'inventory'), where('name', '==', action.data.name));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(doc(db, 'inventory', snap.docs[0].id), {
            currentStock: action.data.amount,
            updatedAt: serverTimestamp()
          });
        }
      }

      // Mark as approved
      const newActions = [...msg.proposedActions];
      newActions[actionIndex] = { ...action, approved: true };
      await updateDoc(doc(db, 'chats', msgId), { proposedActions: newActions });

    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'chats');
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
      updatePreference('selectedModelId', 'gemini-1.5-flash');
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

  const saveImage = async (url: string, filename: string) => {
    if (!auth.currentUser) return;
    setSavingImageUrls(prev => new Set(prev).add(url));
    try {
      await addDoc(collection(db, 'saved_images'), {
        url,
        filename,
        title: filename || "Hình ảnh từ Chat",
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        source: 'chef_chat'
      });
      setTimeout(() => {
        setSavingImageUrls(prev => {
          const next = new Set(prev);
          next.delete(url);
          return next;
        });
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'saved_images');
      setSavingImageUrls(prev => {
        const next = new Set(prev);
        next.delete(url);
        return next;
      });
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
  
  const filteredMessages = messages.filter(m => {
    const text = m.text || '';
    const query = searchQuery || '';
    return text.toLowerCase().includes(query.toLowerCase()) ||
           (m.recipe?.title && m.recipe.title.toLowerCase().includes(query.toLowerCase()));
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn("flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] transition-colors duration-500", preferences.chatBackground)}
    >
      <header className="p-4 bg-white border-b border-neutral-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className={cn("flex items-center gap-2 md:gap-3", showMobileSearch && "hidden sm:flex")}>
            <Logo size={28} />
            <div className="min-w-0">
              {editingTitle && activeConversationId ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onBlur={() => updateConversationTitle(activeConversationId, tempTitle)}
                    onKeyDown={(e) => e.key === 'Enter' && updateConversationTitle(activeConversationId, tempTitle)}
                    autoFocus
                    className="text-xs md:text-sm font-semibold text-neutral-900 border-b border-neutral-900 focus:outline-none bg-transparent w-24 md:w-auto"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1 md:gap-2 group">
                  <h1 
                    className="font-semibold text-neutral-900 text-[11px] md:text-sm cursor-pointer hover:text-orange-600 transition-colors truncate max-w-[80px] md:max-w-none"
                    onClick={() => {
                      if (activeConversationId) {
                        const currentConv = conversations.find(c => c.id === activeConversationId);
                        setTempTitle(currentConv?.title || '');
                        setEditingTitle(true);
                      }
                    }}
                  >
                    {activeConversationId 
                      ? conversations.find(c => c.id === activeConversationId)?.title || "Cố vấn Đầu bếp"
                      : "Cố vấn Đầu bếp"
                    }
                  </h1>
                  {activeConversationId && (
                    <Pencil className="w-3 h-3 text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block" />
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-medium">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  Trực tuyến
                </div>
                <span className="text-stone-300">•</span>
                <select
                  value={preferences.selectedModelId}
                  onChange={(e) => updatePreference('selectedModelId', e.target.value)}
                  className="bg-transparent border-none p-0 font-bold text-orange-600 uppercase tracking-widest cursor-pointer focus:ring-0 text-[10px] appearance-none hover:text-orange-700 transition-colors"
                >
                  {AVAILABLE_MODELS.map(m => (
                    <option key={m.id} value={m.id} className="text-stone-900 bg-white uppercase">
                      {m.name}
                    </option>
                  ))}
                </select>
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
              onClick={() => updatePreference('showInternalThoughts', !preferences.showInternalThoughts)}
              className={cn(
                "p-2 hover:bg-stone-100 rounded-lg transition-colors group relative",
                preferences.showInternalThoughts ? "text-orange-600" : "text-stone-400"
              )}
              title={preferences.showInternalThoughts ? "Ẩn suy nghĩ AI" : "Hiện suy nghĩ AI"}
            >
              <Sparkles className="w-5 h-5" />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-neutral-900 text-white text-[8px] font-bold uppercase tracking-widest rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {preferences.showInternalThoughts ? "Ẩn suy nghĩ" : "Hiện suy nghĩ"}
              </div>
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
              onClick={() => setActiveTab?.('profile')}
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

              <div className="mt-4 flex gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                  <input
                    type="url"
                    placeholder="Nhập URL công thức (ví dụ: cookpad.com/recipe/...)"
                    value={crawlUrl}
                    onChange={(e) => setCrawlUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleDirectCrawl()}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  />
                </div>
                <button
                  onClick={handleDirectCrawl}
                  disabled={isCrawling || !crawlUrl}
                  className={cn(
                    "px-6 py-2 bg-orange-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-600/20 hover:bg-orange-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:scale-100",
                    isCrawling && "animate-pulse"
                  )}
                >
                  {isCrawling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tìm nạp...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Tìm nạp ngay</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

        {/* Settings modal removed and moved to Profile */}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
              >
                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-bold text-neutral-900">
                    {showDeleteConfirm === 'all' ? "Xóa tất cả lịch sử?" : "Xóa cuộc hội thoại này?"}
                  </h3>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Hành động này không thể hoàn tác. Toàn bộ tin nhắn liên quan sẽ bị xóa vĩnh viễn khỏi hệ thống.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl text-xs font-bold hover:bg-neutral-200 transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      if (showDeleteConfirm === 'all') {
                        deleteAllHistory();
                      } else {
                        deleteConversation(showDeleteConfirm);
                      }
                    }}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all"
                  >
                    Xác nhận xóa
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowHistory(false)}
                    className="p-1.5 md:hidden hover:bg-stone-100 text-stone-500 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <h2 className="font-bold text-stone-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-orange-500" />
                    Lịch sử
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setShowDeleteConfirm('all')}
                    className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                    title="Xóa tất cả"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={cleanupInactiveChats}
                    className="p-1.5 hover:bg-stone-100 text-stone-500 rounded-lg transition-colors"
                    title="Dọn dẹp lỗi"
                  >
                    <AlertCircle className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      setActiveConversationId(null);
                      setMessages([]);
                      setEditingTitle(false);
                      setTempTitle('');
                      if (window.innerWidth < 768) setShowHistory(false);
                    }}
                    className="p-1.5 hover:bg-orange-50 text-orange-600 rounded-lg transition-colors"
                    title="Chat mới"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <MessageSquare className="w-8 h-8 text-stone-200 mx-auto" />
                    <p className="text-xs text-stone-400">Chưa có lịch sử trò chuyện</p>
                  </div>
                ) : (
                  conversations.map(conv => (
                    <div
                      key={conv.id}
                      onClick={() => {
                        setActiveConversationId(conv.id);
                        setEditingTitle(false);
                        setTempTitle('');
                        if (window.innerWidth < 768) setShowHistory(false);
                      }}
                      className={cn(
                        "w-full text-left p-3 rounded-xl transition-all group relative cursor-pointer",
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
                          setShowDeleteConfirm(conv.id);
                        }}
                        className="absolute top-3 right-2 p-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
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
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-8 animate-in fade-in zoom-in duration-1000">
            <div className="relative">
              <div className="w-28 h-28 bg-stone-900 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-stone-200 rotate-6 group hover:rotate-0 transition-all duration-500">
                <ChefHat className="w-14 h-14 text-white -rotate-6 group-hover:rotate-0 transition-all duration-500" />
              </div>
              <div className="absolute -top-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-stone-50">
                <Sparkles className="w-5 h-5 text-orange-400 animate-pulse" />
              </div>
            </div>
            <div className="space-y-3 max-w-sm">
              <h3 className="text-2xl font-display font-bold text-stone-900 tracking-tight">Trợ lý Bếp trưởng</h3>
              <p className="text-stone-400 text-sm leading-relaxed font-medium">
                {searchQuery 
                  ? `Không tìm thấy kết quả nào cho "${searchQuery}".` 
                  : "Tôi có thể giúp bạn lên thực đơn, tính Food Cost, hoặc tìm kiếm công thức từ kho dữ liệu của bạn."}
              </p>
            </div>
            {!searchQuery && (
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                {['Tính Food Cost', 'Lên thực đơn', 'Tìm công thức', 'Tối ưu Yield'].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => setInputText(hint)}
                    className="px-5 py-2.5 bg-white border border-stone-100 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-stone-500 hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all shadow-sm active:scale-95"
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
              "flex gap-4 w-full max-w-2xl",
              msg.sender === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
              msg.sender === 'user' ? "bg-neutral-900" : "bg-neutral-50"
            )}>
              {msg.sender === 'user' ? <User className="w-5 h-5 text-white" /> : <ChefHat className="w-5 h-5 text-neutral-900" />}
            </div>
            <div className={cn(
              "space-y-2 flex flex-col",
              msg.sender === 'user' ? "items-end" : "items-start"
            )}>
              <div className={cn(
                "p-4 rounded-2xl text-sm leading-relaxed transition-all",
                msg.sender === 'user' 
                  ? "bg-neutral-900 text-white rounded-tr-none" 
                  : "bg-neutral-50 text-neutral-800 rounded-tl-none"
              )}>
                {msg.hasFiles && msg.files && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {msg.files.map((file, i) => (
                      <div key={i} className="relative group">
                        {file.mimeType.startsWith('image/') ? (
                          <img 
                            src={`data:${file.mimeType};base64,${file.data}`} 
                            alt={file.name}
                            className="w-32 h-32 object-cover rounded-xl border border-neutral-100 shadow-sm hover:scale-105 transition-transform cursor-pointer"
                            referrerPolicy="no-referrer"
                            onClick={() => window.open(`data:${file.mimeType};base64,${file.data}`, '_blank')}
                          />
                        ) : (
                          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl text-[10px] font-medium border border-neutral-100">
                            <FileText className="w-3.5 h-3.5 text-neutral-400" />
                            <span className="truncate max-w-[100px] text-neutral-600">{file.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="markdown-body prose prose-neutral prose-sm max-w-none">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>

                {preferences.showInternalThoughts && msg.internalMonologue && (
                  <div className="mt-2 overflow-hidden rounded-xl border border-stone-100/50">
                    <button 
                      onClick={() => setShowMonologue(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                      className="w-full flex items-center justify-between p-3 bg-stone-50/50 hover:bg-stone-100/50 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px] text-stone-500">
                        <Sparkles className="w-3 h-3 text-orange-400" />
                        Thảo luận nội bộ Agent
                      </div>
                      {showMonologue[msg.id] ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
                    </button>
                    <AnimatePresence>
                      {showMonologue[msg.id] && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-3 pb-3 pt-1 bg-stone-50/50 italic text-[10px] text-stone-500 border-t border-stone-100/50"
                        >
                          "{msg.internalMonologue}"
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {msg.proposedActions && msg.proposedActions.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 flex items-center gap-2">
                      <ListChecks className="w-3 h-3" />
                      Đề xuất hành động (HITL)
                    </h4>
                    <div className="grid gap-2">
                      {msg.proposedActions.map((action, idx) => (
                        <div key={idx} className="bg-white border border-stone-100 rounded-xl p-3 flex items-center justify-between gap-4 shadow-sm">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-stone-100 rounded text-stone-500">
                                {action.type.replace('_', ' ')}
                              </span>
                              <span className="text-[11px] font-bold text-stone-900 truncate">
                                {action.data.title || action.data.name}
                              </span>
                            </div>
                            <p className="text-[10px] text-stone-400 italic truncate">{action.reason}</p>
                          </div>
                          <button
                            onClick={() => approveAction(msg.id, idx)}
                            disabled={action.approved}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                              action.approved 
                                ? "bg-green-50 text-green-600 border border-green-100" 
                                : "bg-stone-900 text-white hover:bg-stone-800 active:scale-95"
                            )}
                          >
                            {action.approved ? "Đã thực thi" : "Phê duyệt"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {msg.sender === 'user' && (msg.status === 'pending' || msg.status === 'processing') && (
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-white/40 font-medium uppercase tracking-wider">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Đang xử lý...</span>
                  </div>
                )}

                {msg.recipe && (
                  <RecipeCard 
                    recipe={msg.recipe} 
                    onSave={() => saveRecipeFromChat(msg)}
                    isSaving={savingRecipeId === msg.id}
                    onSaveImage={() => msg.recipe?.image && saveImage(msg.recipe.image, msg.recipe.title)}
                    isSavingImage={msg.recipe?.image ? savingImageUrls.has(msg.recipe.image) : false}
                  />
                )}

                {msg.photos && msg.photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                    {msg.photos.map((photo, i) => {
                      const isSaving = savingImageUrls.has(photo.url);
                      return (
                        <motion.div 
                          key={i}
                          whileHover={{ scale: 1.02 }}
                          className="relative aspect-square rounded-xl overflow-hidden border border-stone-200 shadow-sm group"
                        >
                          <img 
                            src={photo.url} 
                            alt={photo.filename}
                            className="w-full h-full object-cover cursor-pointer"
                            referrerPolicy="no-referrer"
                            onClick={() => window.open(photo.url, '_blank')}
                          />
                          <div className="absolute top-2 right-2 flex gap-2">
                            <button 
                              onClick={() => saveImage(photo.url, photo.filename)}
                              disabled={isSaving}
                              className={cn(
                                "p-2 rounded-lg backdrop-blur-md transition-all shadow-lg",
                                isSaving 
                                  ? "bg-green-500 text-white" 
                                  : "bg-white/80 text-neutral-900 opacity-0 group-hover:opacity-100 hover:bg-white"
                              )}
                            >
                              {isSaving ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 pointer-events-none transition-colors" />
                        </motion.div>
                      );
                    })}
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

      <div className="p-4 bg-white border-t border-neutral-100">
        <div className="max-w-4xl mx-auto space-y-4">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-red-50 text-red-600 px-4 py-3 rounded-2xl text-xs space-y-3 border border-red-100 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="font-medium">{error}</span>
                  </div>
                  <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-full transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                {(error.includes("Quota") || error.includes("hạn mức") || error.includes("không tìm thấy")) && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-red-100">
                    <p className="w-full text-[10px] text-red-500 font-bold uppercase tracking-wider mb-1">Thử chuyển sang model khác:</p>
                    <button
                      onClick={() => handleSuggestionClick({ label: 'Groq', action: 'switch_to_gemini' })}
                      className="px-3 py-1.5 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-all flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3 text-orange-500" />
                      <span>Gemini 2.0 (Mặc định)</span>
                    </button>
                    <button
                      onClick={() => {
                        updatePreference('selectedModelId', 'groq/llama-3.3-70b-versatile');
                        setError(null);
                      }}
                      className="px-3 py-1.5 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-all flex items-center gap-1.5"
                    >
                      <Zap className="w-3 h-3 text-blue-500" />
                      <span>Llama 3.3 (Groq - Siêu nhanh)</span>
                    </button>
                    <button
                      onClick={() => {
                        updatePreference('selectedModelId', 'nvidia/meta/llama-3.1-405b-instruct');
                        setError(null);
                      }}
                      className="px-3 py-1.5 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-all flex items-center gap-1.5"
                    >
                      <Cpu className="w-3 h-3 text-green-500" />
                      <span>Llama 405B (NVIDIA - Cực mạnh)</span>
                    </button>
                  </div>
                )}
              </motion.div>
            )}
            {fileError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs flex items-center justify-between"
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
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-wrap gap-2"
              >
                {selectedFiles.map((file, i) => (
                  <div key={i} className="relative group">
                    <div className="bg-neutral-50 p-1 rounded-xl flex items-center gap-2 pr-8 border border-neutral-100">
                      {file.mimeType.startsWith('image/') ? (
                        <img 
                          src={`data:${file.mimeType};base64,${file.data}`} 
                          alt={file.name}
                          className="w-10 h-10 object-cover rounded-lg"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                          <FileText className="w-4 h-4 text-neutral-400" />
                        </div>
                      )}
                      <span className="text-[10px] font-medium truncate max-w-[80px] text-neutral-600">{file.name}</span>
                    </div>
                    <button
                      onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 bg-neutral-900 text-white rounded-full p-1 shadow-sm hover:bg-red-500 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              className="hidden"
              accept="image/*,video/*,application/pdf,text/*"
            />
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Hỏi Bếp Trưởng AI..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl py-4 pl-6 pr-24 text-sm focus:outline-none focus:bg-white focus:border-neutral-900 transition-all"
              />
              <div className="absolute right-2 top-2 bottom-2 flex items-center gap-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isActuallyTyping}
                  className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-all"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleSend()}
                  disabled={(!inputText.trim() && selectedFiles.length === 0) || isActuallyTyping}
                  className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center text-white hover:bg-neutral-800 disabled:opacity-20 transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</motion.div>
  );
}
