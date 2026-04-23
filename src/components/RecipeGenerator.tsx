import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plus, X, ChefHat, Clock, Utensils, AlertCircle, Save, Check, Loader2, Wand2, Package, Bot, Send, MessageSquare, History, Trash2, RefreshCw, Image as ImageIcon, Upload } from 'lucide-react';
import { generateRecipe, refineRecipe, ChatMessage } from '../lib/gemini';
import { AVAILABLE_MODELS } from '../lib/ai';
import { db, collection, addDoc, serverTimestamp, auth, getDocs, onSnapshot, query, where, orderBy, deleteDoc, doc, writeBatch } from '../lib/firebase';
import { validateRecipe, cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { ConfirmModal } from './ConfirmModal';

interface RecipeGeneratorProps {
  preferences: any;
  updatePreference: (key: string, value: string) => void;
  setActiveTab: (tab: any) => void;
  persistedState?: any;
  setPersistedState?: (state: any) => void;
}

export function RecipeGenerator({ preferences, updatePreference, setActiveTab, persistedState, setPersistedState }: RecipeGeneratorProps) {
  const [theme, setTheme] = useState(persistedState?.theme || '');
  const [ingredientInput, setIngredientInput] = useState('');
  const [ingredients, setIngredients] = useState<string[]>(persistedState?.ingredients || []);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(persistedState?.difficulty || 'medium');
  const [sourceImage, setSourceImage] = useState<string | null>(persistedState?.sourceImage || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<any>(persistedState?.generatedRecipe || null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isFetchingInventory, setIsFetchingInventory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monologue, setMonologue] = useState<string[]>(persistedState?.monologue || []);
  const [creationHistory, setCreationHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Chat Refinement State
  const [chatInput, setChatInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(persistedState?.chatHistory || []);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message?: string, onConfirm: () => void } | null>(null);

  // Persistence logic: Sync local state to App state on unmount
  const stateRef = useRef({
    theme,
    ingredients,
    difficulty,
    sourceImage,
    generatedRecipe,
    chatHistory,
    monologue
  });

  useEffect(() => {
    stateRef.current = {
      theme,
      ingredients,
      difficulty,
      sourceImage,
      generatedRecipe,
      chatHistory,
      monologue
    };
  }, [theme, ingredients, difficulty, sourceImage, generatedRecipe, chatHistory, monologue]);

  useEffect(() => {
    return () => {
      if (setPersistedState) {
        setPersistedState(stateRef.current);
      }
    };
  }, []);

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

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  const fetchFromInventory = async () => {
    if (!auth.currentUser) return;
    setIsFetchingInventory(true);
    try {
      const q = query(collection(db, 'inventory'), where('authorId', '==', auth.currentUser.uid));
      const snap = await getDocs(q);
      const items = snap.docs
        .map(d => d.data())
        .filter(item => item.currentStock > 0)
        .map(item => item.name);
      
      if (items.length > 0) {
        // Pick up to 5 random items if there are many
        const shuffled = items.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 5);
        setIngredients(prev => Array.from(new Set([...prev, ...selected])));
      }
    } catch (error) {
      console.error("Failed to fetch inventory", error);
    } finally {
      setIsFetchingInventory(false);
    }
  };

  const addIngredient = () => {
    const input = ingredientInput.trim();
    if (input) {
      const isDuplicate = ingredients.some(ing => ing.toLowerCase() === input.toLowerCase());
      if (!isDuplicate) {
        setIngredients([...ingredients, input]);
        setIngredientInput('');
      } else {
        setIngredientInput(''); // Clear input if duplicate
      }
    }
  };

  const removeIngredient = (ing: string) => {
    setIngredients(ingredients.filter(i => i !== ing));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert("Vui lòng tải lên tệp hình ảnh hợp lệ (JPG, PNG).");
      return;
    }
    
    // Scale down image to avoid overloading limits
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIMENSION = 1200;
        
        if (width > height && width > MAX_DIMENSION) {
          height *= MAX_DIMENSION / width;
          width = MAX_DIMENSION;
        } else if (height > MAX_DIMENSION) {
          width *= MAX_DIMENSION / height;
          height = MAX_DIMENSION;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setSourceImage(canvas.toDataURL('image/jpeg', 0.8));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLButtonElement | HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement | HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleRemoveImage = () => {
    setSourceImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteFromHistory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'creation_history', id));
    } catch (err) {
      console.error("Error deleting history:", err);
    }
  };

  const handleSelectFromHistory = (h: any) => {
    setGeneratedRecipe(h);
    if (h.chatHistory) {
      setChatHistory(h.chatHistory);
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

  const handleRetryGeneration = () => {
    if (generatedRecipe) {
      const retryTheme = theme || generatedRecipe.recipe?.title || '';
      const retryIngredients = ingredients.length > 0 ? ingredients : (generatedRecipe.recipe?.ingredients?.map((i: any) => i.name) || []);
      const retryDiff = difficulty;
      handleGenerate({ theme: retryTheme, ingredients: retryIngredients, difficulty: retryDiff });
    } else {
      handleGenerate();
    }
  };

  const handleGenerate = async (retryConfig?: { theme: string, ingredients: string[], difficulty: string } | React.MouseEvent) => {
    // Check if retryConfig is an actual config or just a mouse event from onClick
    const isConfig = retryConfig && !('nativeEvent' in retryConfig);
    const config = isConfig ? retryConfig as { theme: string, ingredients: string[], difficulty: string } : undefined;
    
    const currentTheme = config ? config.theme : theme;
    const currentIngredients = config ? config.ingredients : ingredients;
    const currentDiff = config ? config.difficulty : difficulty;

    if (!currentTheme && currentIngredients.length === 0 && !sourceImage) return;

    setIsGenerating(true);
    setGeneratedRecipe(null);
    setSaveSuccess(false);
    setError(null);
    setChatHistory([]); // Reset chat history for new recipe
    setMonologue(["Đang khởi tạo Creative Chef...", "Phân tích yêu cầu ẩm thực..."]);

    try {
      const prompt = `Tạo một công thức nấu ăn chuyên nghiệp.
        ${currentTheme ? `Chủ đề: ${currentTheme}.` : ''}
        ${currentIngredients.length > 0 ? `Nguyên liệu bắt buộc: ${currentIngredients.join(', ')}.` : ''}
        Độ khó: ${currentDiff}.
        Hãy đảm bảo công thức sáng tạo, khả thi và có tính thẩm mỹ cao.`;

      const aiConfig = { 
        openaiKey: preferences.openaiKey, 
        anthropicKey: preferences.anthropicKey, 
        googleKey: preferences.googleKey,
        openrouterKey: preferences.openrouterKey,
        nvidiaKey: preferences.nvidiaKey,
        groqKey: preferences.groqKey
      };

      // Mocking sub-agent background steps for better UX
      const monologues = [
        "Đang khởi tạo Creative Chef...",
        "Phân tích yêu cầu ẩm thực...",
        "Triệu hồi Market Research Agent...",
        "Đang tra cứu giá nguyên liệu tại Market Hub VN...",
        "Financial Expert đang cân đối định lượng...",
        "Orchestrator đang tổng hợp công thức cuối cùng..."
      ];

      let monologueIdx = 0;
      const monologueInterval = setInterval(() => {
        if (monologueIdx < monologues.length) {
          setMonologue(prev => [...prev.slice(-4), monologues[monologueIdx]]);
          monologueIdx++;
        } else {
          clearInterval(monologueInterval);
        }
      }, 1500);

      const result = await generateRecipe(prompt, aiConfig, preferences.selectedModelId, sourceImage || undefined);
      
      clearInterval(monologueInterval);
      setMonologue(["Hoàn tất! Công thức đã sẵn sàng."]);
      
      // Ensure version is set
      if (result.recipe) {
        result.recipe.version = 1.0;
        setGeneratedRecipe(result);

        // Auto-save to creation_history if user is logged in
        if (auth.currentUser) {
          try {
            const docRef = await addDoc(collection(db, 'creation_history'), {
              recipe: result.recipe,
              text: result.text,
              chatHistory: [{ role: 'model', parts: [{ text: result.text }] }],
              userId: auth.currentUser.uid,
              createdAt: serverTimestamp(),
              source: 'generator'
            });
            // Update the recipe with its database ID so the delete button works
            setGeneratedRecipe(prev => prev ? { ...prev, id: docRef.id } : null);
          } catch (err) {
            console.error("Auto-save failed", err);
          }
        }
      } else if (result.text) {
        // AI returned text but no structured recipe object (rare but possible)
        setGeneratedRecipe(result);
        setError("AI đã tạo nội dung nhưng thiếu cấu trúc công thức chi tiết. Bạn có thể xem nội dung trong phần chat bên dưới hoặc nhấn 'Sáng tạo lại'.");
      } else {
        throw new Error("AI không trả về kết quả hợp lệ (Kết quả trống). Vui lòng thử lại hoặc đổi Model trong Cài đặt.");
      }
      
      // Initialize chat history with the creation result
      if (result.text) {
        setChatHistory([{ role: 'model', parts: [{ text: result.text }] }]);
      }
    } catch (error: any) {
      console.error("Generation failed", error);
      let errorMsg = error.message || "Không thể tạo công thức. Vui lòng kiểm tra API Key.";
      if (errorMsg.toLowerCase().includes('high demand') || errorMsg.includes('429')) {
        errorMsg = "Hệ thống AI hiện đang quá tải (High Demand). Hệ thống đã thử các model dự phòng nhưng đều bận. Vui lòng thử lại sau ít phút hoặc đổi sang model khác trong Cài đặt.";
      }
      setError(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async () => {
    if (!chatInput.trim() || !generatedRecipe || isRefining) return;

    const currentFeedback = chatInput;
    setChatInput('');
    setIsRefining(true);
    setError(null);

    // Add user message to history
    const updatedHistory: ChatMessage[] = [
      ...chatHistory,
      { role: 'user', parts: [{ text: currentFeedback }] }
    ];
    setChatHistory(updatedHistory);

    try {
      const aiConfig = { 
        openaiKey: preferences.openaiKey, 
        anthropicKey: preferences.anthropicKey, 
        googleKey: preferences.googleKey,
        openrouterKey: preferences.openrouterKey,
        nvidiaKey: preferences.nvidiaKey,
        groqKey: preferences.groqKey
      };

      const result = await refineRecipe(generatedRecipe.recipe, currentFeedback, chatHistory, aiConfig, preferences.selectedModelId);
      
      if (result.recipe) {
        setGeneratedRecipe(result);
      }
      
      // Add model response to history
      if (result.text) {
        setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: result.text }] }]);
      }
    } catch (error: any) {
      console.error("Refinement failed", error);
      setError("Không thể điều chỉnh công thức: " + (error.message || "Lỗi không xác định"));
    } finally {
      setIsRefining(false);
    }
  };

  const handleSave = async () => {
    if (!generatedRecipe || !auth.currentUser) return;

    const error = validateRecipe(generatedRecipe.recipe);
    if (error) {
      alert(error);
      return;
    }

    setIsSaving(true);
    try {
      const recipeToSave = {
        ...(generatedRecipe.recipe || {}),
        theme: theme || 'Sáng tạo ngẫu hứng',
        ingredientsUsed: ingredients,
        authorId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        aiResponseText: generatedRecipe.text // Keep the full AI text just in case
      };

      await addDoc(collection(db, 'recipes'), recipeToSave);
      setSaveSuccess(true);
      setTimeout(() => {
        setActiveTab('recipes');
      }, 1500);
    } catch (error) {
      console.error("Save failed", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 px-4">
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs flex items-center justify-between border border-red-100"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)}>
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <header className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-100">
              <ChefHat className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-stone-900 tracking-tight leading-none">AI Lab</h1>
              <p className="text-[8px] text-stone-400 font-bold uppercase tracking-widest mt-0.5">Sáng tác công thức</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 font-sans">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all border flex items-center gap-1.5",
                showHistory ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-500 border-stone-100 hover:border-orange-200"
              )}
            >
              <Clock className="w-3 h-3" />
              Lịch sử {creationHistory.length > 0 ? `(${creationHistory.length})` : ""}
            </button>
            <div className="flex items-center gap-1.5 bg-stone-50 px-2 py-1.5 rounded-lg border border-stone-100 group hover:border-orange-200 transition-all">
              <Bot className="w-3 h-3 text-stone-400 group-hover:text-orange-600 transition-colors" />
              <select
                value={preferences.selectedModelId}
                onChange={(e) => updatePreference('selectedModelId', e.target.value)}
                className="bg-transparent border-none p-0 font-bold text-stone-500 group-hover:text-stone-900 uppercase tracking-widest cursor-pointer focus:ring-0 text-[8px] appearance-none transition-colors"
              >
                {AVAILABLE_MODELS.map(m => (
                  <option key={m.id} value={m.id} className="text-stone-900 bg-white">
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-[2rem] border border-stone-100 p-5 space-y-4 shadow-sm mb-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <History className="w-3 h-3 text-stone-400" />
                  <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Bản thảo từ database</p>
                </div>
                <div className="flex items-center gap-3">
                  {creationHistory.length > 0 && (
                    <button 
                      onClick={handleClearAllHistory}
                      className="text-[9px] font-bold text-red-400 hover:text-red-600 transition-colors flex items-center gap-1 group/clear"
                    >
                      <Trash2 className="w-3 h-3 group-hover/clear:scale-110 transition-transform" />
                      Xoá hết
                    </button>
                  )}
                  <p className="text-[8px] text-stone-300 font-bold italic uppercase tracking-wider underline">Tự động sao lưu</p>
                </div>
              </div>
              {creationHistory.length > 0 ? (
                <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto no-scrollbar px-1 py-1">
                  {creationHistory.map((h, i) => (
                    <div key={h.id || i} className="relative group">
                      <button
                        onClick={() => handleSelectFromHistory(h)}
                        className={cn(
                          "w-full p-3.5 rounded-2xl border transition-all text-left flex flex-col justify-center",
                          generatedRecipe?.id === h.id ? "bg-orange-50 border-orange-200 shadow-sm" : "bg-stone-50 border-stone-100 hover:border-stone-300"
                        )}
                      >
                        <div className="pr-8 space-y-1.5 w-full">
                          <h4 className="text-xs font-bold text-stone-900 truncate">{h.recipe?.title || 'Công thức chưa đặt tên'}</h4>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-orange-600 font-bold">
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(h.recipe?.totalCost || 0)}
                            </p>
                            <span className="w-1 h-1 bg-stone-300 rounded-full"></span>
                            <p className="text-[9px] text-stone-400 uppercase font-bold tracking-tighter">
                              {h.createdAt?.toDate ? h.createdAt.toDate().toLocaleDateString() : 'Vừa xong'}
                            </p>
                          </div>
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
                        className="absolute top-1/2 -translate-y-1/2 right-3 w-7 h-7 bg-white border border-red-100 text-red-500 rounded-lg flex items-center justify-center transition-all hover:scale-105 hover:bg-red-50 shadow-sm active:scale-95 z-50 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                  <Clock className="w-8 h-8 text-stone-200 mx-auto mb-2" />
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Chưa có lịch sử trong database</p>
                  <p className="text-[9px] text-stone-300 mt-1">Các món bạn vừa tạo sẽ tự động lưu tại đây.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">Chủ đề hoặc Tên món</label>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Ví dụ: Món Ý lãng mạn, Bữa sáng nhanh..."
                className="w-full bg-stone-50 border-none rounded-2xl py-4 px-5 focus:ring-2 focus:ring-orange-500/20 transition-all placeholder:text-stone-300 text-stone-800"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end ml-1">
                <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Nguyên liệu sẵn có</label>
                <button
                  onClick={fetchFromInventory}
                  disabled={isFetchingInventory}
                  className="text-[10px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 uppercase tracking-wider"
                >
                  {isFetchingInventory ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
                  Lấy từ kho
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ingredientInput}
                  onChange={(e) => setIngredientInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addIngredient()}
                  placeholder="Thêm nguyên liệu..."
                  className="flex-1 bg-stone-50 border-none rounded-2xl py-4 px-5 focus:ring-2 focus:ring-orange-500/20 transition-all placeholder:text-stone-300 text-stone-800"
                />
                <button
                  onClick={addIngredient}
                  className="p-4 bg-stone-900 text-white rounded-2xl hover:bg-stone-800 transition-all active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-3">
                <AnimatePresence>
                  {ingredients.map(ing => (
                    <motion.span
                      key={ing}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full text-xs font-medium border border-orange-100"
                    >
                      {ing}
                      <button onClick={() => removeIngredient(ing)} className="hover:text-orange-900">
                        <X className="w-3 h-3" />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Hình ảnh gợi ý (Tùy chọn)</label>
              {sourceImage ? (
                <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-stone-200 group">
                  <img src={sourceImage} alt="Gợi ý món ăn" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={handleRemoveImage} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg" title="Xóa hình">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="w-full py-4 border-2 border-dashed border-stone-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-orange-400 hover:bg-orange-50/50 transition-colors group"
                >
                  <div className="p-2 bg-stone-50 rounded-full group-hover:bg-orange-100 transition-colors pointer-events-none">
                    <ImageIcon className="w-5 h-5 text-stone-400 group-hover:text-orange-500 transition-colors" />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400 group-hover:text-orange-600 transition-colors pointer-events-none">
                    Tải lên hoặc Kéo thả hình
                  </span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Độ khó & Kỹ năng</label>
              <div className="grid grid-cols-3 gap-2">
                {(['easy', 'medium', 'hard'] as const).map(level => (
                  <button
                    key={level}
                    onClick={() => setDifficulty(level)}
                    className={cn(
                      "py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border flex flex-col items-center gap-1",
                      difficulty === level 
                        ? "bg-stone-900 text-white border-stone-900 shadow-md shadow-stone-200" 
                        : "bg-white text-stone-400 border-stone-100 hover:border-stone-200"
                    )}
                  >
                    <span className="text-base">
                      {level === 'easy' ? '👌' : level === 'medium' ? '👍' : '💪'}
                    </span>
                    {level === 'easy' ? 'Dễ' : level === 'medium' ? 'Vừa' : 'Khó'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || (!theme && ingredients.length === 0 && !sourceImage)}
              className="w-full bg-orange-600 text-white py-5 rounded-3xl font-bold text-sm uppercase tracking-[0.2em] shadow-xl shadow-orange-200 hover:bg-orange-700 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-3 mt-4"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang sáng tạo...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Bắt đầu Sáng tạo
                </>
              )}
            </button>
          </section>

          {/* Subagent Monologue (Background) */}
          <AnimatePresence>
            {(isGenerating || monologue.length > 0) && (
              <motion.section
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-stone-900 rounded-[2rem] p-5 space-y-4 border border-stone-800 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4">
                   <div className="flex gap-1">
                     <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse" />
                     <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse delay-75" />
                     <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse delay-150" />
                   </div>
                </div>
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-orange-400" />
                  <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Sub-Agent Monologue</h3>
                </div>
                <div className="space-y-2.5">
                  {monologue.map((text, i) => (
                    <motion.div
                      key={text + i}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-2"
                    >
                      <div className="mt-1.5 w-1 h-1 bg-stone-700 rounded-full shrink-0" />
                      <p className="text-[11px] text-stone-500 font-medium leading-relaxed italic">{text}</p>
                    </motion.div>
                  ))}
                  {isGenerating && (
                    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-stone-800/50 rounded-xl w-fit">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Hệ thống đang hoạt động ngầm</span>
                    </div>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Result Section */}
        <div className="relative min-h-[400px]">
          <AnimatePresence mode="wait">
            {!generatedRecipe && !isGenerating ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 border-2 border-dashed border-stone-100 rounded-[2.5rem]"
              >
                <div className="p-4 bg-stone-50 rounded-full">
                  <ChefHat className="w-12 h-12 text-stone-200" />
                </div>
                <div className="space-y-1">
                  <p className="text-stone-400 font-medium">Sẵn sàng phục vụ</p>
                  <p className="text-stone-300 text-xs px-4">Nhập ý tưởng của bạn và để AI biến chúng thành công thức hoàn hảo.</p>
                </div>
              </motion.div>
            ) : isGenerating ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center space-y-6 p-8"
              >
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-orange-100 rounded-full animate-spin border-t-orange-600" />
                  <Sparkles className="w-8 h-8 text-orange-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-stone-900 font-bold">Chef AI đang nghiên cứu...</p>
                  <p className="text-stone-400 text-xs animate-bounce">Đang cân bằng hương vị & tính toán chi phí</p>
                </div>
              </motion.div>
            ) : generatedRecipe && !generatedRecipe.recipe ? (
              <motion.div
                key="no-data"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-[400px] flex flex-col items-center justify-center text-center p-8 space-y-6 border border-stone-100 rounded-[2.5rem] bg-white"
              >
                <div className="p-4 bg-orange-50 rounded-full">
                  <AlertCircle className="w-12 h-12 text-orange-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-stone-900">Không tìm thấy cấu trúc công thức</h3>
                  <p className="text-stone-400 text-[10px] leading-relaxed px-4">
                    AI đã tạo ra phản hồi nhưng không cung cấp được bảng nguyên liệu và cost chi tiết. 
                    Bạn có thể xem phản hồi này trong phần **"Trao đổi với Chef"** bên dưới hoặc thử lại với yêu cầu rõ ràng hơn.
                  </p>
                </div>
                <button
                  onClick={handleRetryGeneration}
                  className="px-6 py-3 bg-stone-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-all active:scale-95 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Thử sáng tạo lại
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[2.5rem] border border-stone-100 shadow-xl overflow-hidden flex flex-col h-full"
              >
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-orange-600">
                          <Utensils className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">Kiệt tác mới</span>
                        </div>
                        <h2 className="text-xl font-bold text-stone-900 leading-tight break-words">{generatedRecipe.recipe?.title}</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handleRetryGeneration}
                          className="p-2 hover:bg-orange-50 text-stone-300 hover:text-orange-500 transition-all rounded-xl border border-stone-50"
                          title="Thử sáng tạo lại"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        {generatedRecipe.id && (
                          <button 
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                title: "Xóa bản thảo này?",
                                message: "Hành động này không thể hoàn tác.",
                                onConfirm: () => {
                                  handleDeleteFromHistory(generatedRecipe.id);
                                  setGeneratedRecipe(null);
                                }
                              });
                            }}
                            className="p-2 hover:bg-red-50 text-stone-300 hover:text-red-500 transition-all rounded-xl border border-stone-50"
                            title="Xoá bản thảo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {generatedRecipe.text && (
                      <div className="prose prose-stone prose-sm max-w-none">
                        <div className="text-[11px] text-stone-600 leading-relaxed font-medium">
                          <ReactMarkdown>{generatedRecipe.text}</ReactMarkdown>
                        </div>
                      </div>
                    )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-stone-50 p-4 rounded-2xl space-y-1 min-w-0">
                      <p className="text-[10px] font-bold text-stone-400 uppercase">Ước tính Cost</p>
                      <p className="text-lg font-bold text-stone-900 truncate">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(generatedRecipe.recipe?.totalCost || 0)}
                      </p>
                    </div>
                    <div className="bg-stone-50 p-4 rounded-2xl space-y-1 min-w-0">
                      <p className="text-[10px] font-bold text-stone-400 uppercase">Giá gợi ý</p>
                      <p className="text-lg font-bold text-orange-600 truncate">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(generatedRecipe.recipe?.recommendedPrice || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">Nguyên liệu chính</h3>
                    <div className="space-y-2">
                       {generatedRecipe.recipe?.ingredients ? (
                         generatedRecipe.recipe.ingredients.slice(0, 15).map((ing: any, i: number) => (
                           <div key={i} className="flex justify-between items-center text-sm border-b border-stone-50 pb-2 last:border-0">
                             <div className="flex flex-col flex-1 min-w-0">
                               <span className="text-stone-900 font-bold truncate">
                                 {ing.name && ing.name.trim().length > 0 ? ing.name : (ing.label || 'Tên nguyên liệu')}
                               </span>
                               <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest truncate">
                                 {ing.amount && ing.unit ? `${ing.amount} ${ing.unit}` : (ing.amount || ing.unit || 'Định lượng theo Chef')}
                               </span>
                             </div>
                             <div className="text-right">
                               <p className="text-[10px] font-bold text-stone-900">
                                 {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(ing.costPerAmount || 0)}
                               </p>
                             </div>
                           </div>
                         ))
                       ) : (
                         <p className="text-[10px] text-stone-400 italic">Đang tải danh sách nguyên liệu...</p>
                       )}
                       {(generatedRecipe.recipe?.ingredients?.length || 0) > 15 && (
                         <p className="text-[10px] text-stone-400 italic">... và {(generatedRecipe.recipe?.ingredients?.length || 0) - 15} nguyên liệu khác</p>
                       )}
                    </div>
                  </div>

                  {/* Smart Chat Refinement Area */}
                  <div className="pt-4 border-t border-stone-100 flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-stone-900">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Trao đổi thông minh với Chef AI</span>
                    </div>
                    
                    <div className="max-h-[400px] overflow-y-auto no-scrollbar space-y-3 p-1 bg-stone-50/30 rounded-2xl">
                      {chatHistory.map((msg, idx) => (
                        <div key={idx} className={cn(
                          "flex flex-col gap-1 max-w-[90%]",
                          msg.role === 'user' ? "ml-auto items-end" : "items-start"
                        )}>
                          <div className={cn(
                            "px-3 py-2 rounded-2xl text-[11px] font-medium leading-relaxed",
                            msg.role === 'user' ? "bg-stone-900 text-white" : "bg-stone-50 text-stone-700"
                          )}>
                             <div className={cn("prose prose-stone prose-xs max-w-none", msg.role === 'user' && "prose-invert")}>
                                <ReactMarkdown>{msg.parts[0].text}</ReactMarkdown>
                             </div>
                          </div>
                        </div>
                      ))}
                      {isRefining && (
                         <div className="flex items-center gap-2 text-stone-300">
                           <Loader2 className="w-3 h-3 animate-spin" />
                           <span className="text-[10px] font-medium animate-pulse">Bếp trưởng đang điều chỉnh...</span>
                         </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="relative group/chat">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleRefine()}
                        placeholder="Yêu cầu Chef điều chỉnh (ví dụ: 'Cho ít muối hơn', 'Thay thịt bằng đậu hũ')..."
                        disabled={isRefining}
                        className="w-full bg-stone-50 border-none rounded-xl py-3 pl-4 pr-10 text-xs focus:ring-1 focus:ring-stone-200 transition-all font-medium placeholder:text-stone-300"
                      />
                      <button
                        onClick={handleRefine}
                        disabled={!chatInput.trim() || isRefining}
                        className="absolute right-2 top-1.5 bottom-1.5 w-8 bg-stone-900 text-white rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-stone-800 transition-all active:scale-95 shadow-sm"
                      >
                         {isRefining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-stone-50 border-t border-stone-100 flex gap-3">
                  <button
                    onClick={() => setGeneratedRecipe(null)}
                    className="flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    Bỏ qua
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || saveSuccess}
                    className={cn(
                      "flex-[2] py-4 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg",
                      saveSuccess 
                        ? "bg-green-500 text-white shadow-green-100" 
                        : "bg-stone-900 text-white shadow-stone-200 hover:bg-stone-800"
                    )}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saveSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        Đã lưu thành công
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Lưu vào Thực đơn
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
