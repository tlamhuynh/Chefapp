import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plus, X, ChefHat, Clock, Utensils, AlertCircle, Save, Check, Loader2, Wand2, Package } from 'lucide-react';
import { generateRecipe } from '../lib/gemini';
import { AVAILABLE_MODELS } from '../lib/ai';
import { db, collection, addDoc, serverTimestamp, auth, getDocs } from '../lib/firebase';
import { validateRecipe, cn } from '../lib/utils';

interface RecipeGeneratorProps {
  preferences: any;
  updatePreference: (key: string, value: string) => void;
  setActiveTab: (tab: any) => void;
}

export function RecipeGenerator({ preferences, updatePreference, setActiveTab }: RecipeGeneratorProps) {
  const [theme, setTheme] = useState('');
  const [ingredientInput, setIngredientInput] = useState('');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isFetchingInventory, setIsFetchingInventory] = useState(false);

  const fetchFromInventory = async () => {
    setIsFetchingInventory(true);
    try {
      const snap = await getDocs(collection(db, 'inventory'));
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
    if (ingredientInput.trim() && !ingredients.includes(ingredientInput.trim())) {
      setIngredients([...ingredients, ingredientInput.trim()]);
      setIngredientInput('');
    }
  };

  const removeIngredient = (ing: string) => {
    setIngredients(ingredients.filter(i => i !== ing));
  };

  const handleGenerate = async () => {
    if (!theme && ingredients.length === 0) return;

    setIsGenerating(true);
    setGeneratedRecipe(null);
    setSaveSuccess(false);

    try {
      const prompt = `Tạo một công thức nấu ăn chuyên nghiệp.
        ${theme ? `Chủ đề: ${theme}.` : ''}
        ${ingredients.length > 0 ? `Nguyên liệu bắt buộc: ${ingredients.join(', ')}.` : ''}
        Độ khó: ${difficulty}.
        Hãy đảm bảo công thức sáng tạo, khả thi và có tính thẩm mỹ cao.`;

      const aiConfig = { 
        openaiKey: preferences.openaiKey, 
        anthropicKey: preferences.anthropicKey, 
        googleKey: preferences.googleKey,
        openrouterKey: preferences.openrouterKey,
        nvidiaKey: preferences.nvidiaKey,
        groqKey: preferences.groqKey
      };

      const recipe = await generateRecipe(prompt, aiConfig, preferences.selectedModelId);
      setGeneratedRecipe(recipe);
    } catch (error) {
      console.error("Generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedRecipe || !auth.currentUser) return;

    const error = validateRecipe(generatedRecipe);
    if (error) {
      alert(error);
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'recipes'), {
        ...generatedRecipe,
        theme: theme || 'Sáng tạo ngẫu hứng',
        ingredientsUsed: ingredients,
        authorId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
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
      <header className="space-y-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 rounded-2xl">
              <Wand2 className="w-6 h-6 text-orange-600" />
            </div>
            <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Sáng tạo Công thức AI</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Mô hình AI</span>
            <select
              value={preferences.selectedModelId}
              onChange={(e) => updatePreference('selectedModelId', e.target.value)}
              className="bg-transparent border-none p-0 font-bold text-orange-600 uppercase tracking-widest cursor-pointer focus:ring-0 text-[10px] appearance-none hover:text-orange-700 transition-colors text-right"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id} className="text-stone-900 bg-white uppercase">
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-stone-500 text-sm">Kết hợp chủ đề và nguyên liệu để tạo ra những món ăn độc bản.</p>
      </header>

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
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">Độ khó</label>
              <div className="grid grid-cols-3 gap-2">
                {(['easy', 'medium', 'hard'] as const).map(level => (
                  <button
                    key={level}
                    onClick={() => setDifficulty(level)}
                    className={cn(
                      "py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all border",
                      difficulty === level 
                        ? "bg-stone-900 text-white border-stone-900 shadow-lg shadow-stone-200" 
                        : "bg-white text-stone-400 border-stone-100 hover:border-stone-200"
                    )}
                  >
                    {level === 'easy' ? 'Dễ' : level === 'medium' ? 'Vừa' : 'Khó'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || (!theme && ingredients.length === 0)}
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
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[2.5rem] border border-stone-100 shadow-xl overflow-hidden flex flex-col h-full"
              >
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-orange-600">
                      <Utensils className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Công thức mới</span>
                    </div>
                    <h2 className="text-2xl font-bold text-stone-900 leading-tight">{generatedRecipe.recipe?.title}</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-stone-50 p-4 rounded-2xl space-y-1">
                      <p className="text-[10px] font-bold text-stone-400 uppercase">Ước tính Cost</p>
                      <p className="text-lg font-bold text-stone-900">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(generatedRecipe.recipe?.totalCost || 0)}
                      </p>
                    </div>
                    <div className="bg-stone-50 p-4 rounded-2xl space-y-1">
                      <p className="text-[10px] font-bold text-stone-400 uppercase">Giá gợi ý</p>
                      <p className="text-lg font-bold text-orange-600">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(generatedRecipe.recipe?.recommendedPrice || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">Nguyên liệu chính</h3>
                    <div className="space-y-2">
                      {generatedRecipe.recipe?.ingredients.slice(0, 5).map((ing: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                          <span className="text-stone-600">{ing.name}</span>
                          <span className="font-medium text-stone-900">{ing.amount} {ing.unit}</span>
                        </div>
                      ))}
                      {generatedRecipe.recipe?.ingredients.length > 5 && (
                        <p className="text-[10px] text-stone-400 italic">... và {generatedRecipe.recipe.ingredients.length - 5} nguyên liệu khác</p>
                      )}
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
