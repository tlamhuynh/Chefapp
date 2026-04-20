import { useState, useEffect } from 'react';
import { Search, Plus, Camera, DollarSign, ShoppingBag, ChefHat, ChevronRight, Calendar, Bot, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateRecipe, analyzeMenuImage } from '../lib/gemini';
import { generateProactiveInsights, AVAILABLE_MODELS } from '../lib/ai';
import { db, collection, addDoc, serverTimestamp, auth, query, where, orderBy, onSnapshot, getDocs } from '../lib/firebase';
import { RecipeDetail } from './RecipeDetail';
import { OrderAnalysis } from './OrderAnalysis';
import { validateRecipe, cn } from '../lib/utils';
import { Lightbulb, AlertTriangle, TrendingUp, CheckCircle2, Sparkles, ArrowRight, Loader2, AlertCircle, X } from 'lucide-react';
import { Logo } from './Logo';

interface DashboardProps {
  setActiveTab: (tab: any) => void;
  preferences?: any;
  updatePreference?: (key: string, value: string) => void;
}

export function Dashboard({ setActiveTab, preferences, updatePreference }: DashboardProps) {
  const [theme, setTheme] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<any>(null);
  const [showOrderAnalysis, setShowOrderAnalysis] = useState(false);
  
  const [recipes, setRecipes] = useState<any[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      if (!auth.currentUser || recipes.length === 0) return;
      setIsLoadingInsights(true);
      try {
        const inventorySnap = await getDocs(collection(db, 'inventory'));
        const inventory = inventorySnap.docs.map(d => d.data());
        
        const aiConfig = preferences ? { 
          openaiKey: preferences.openaiKey, 
          anthropicKey: preferences.anthropicKey, 
          googleKey: preferences.googleKey,
          openrouterKey: preferences.openrouterKey,
          nvidiaKey: preferences.nvidiaKey,
          groqKey: preferences.groqKey
        } : undefined;

        const result = await generateProactiveInsights(
          preferences?.selectedModelId || 'gemini-flash-latest',
          inventory,
          recipes,
          aiConfig
        );
        setInsights(result.insights);
      } catch (error: any) {
        console.error("Failed to fetch insights", error);
        setError("Không thể tải phân tích thông minh. Vui lòng thử lại sau.");
      } finally {
        setIsLoadingInsights(false);
      }
    };

    if (recipes.length > 0 && insights.length === 0) {
      fetchInsights();
    }
  }, [recipes, auth.currentUser]);

  useEffect(() => {
    const handleFindSimilar = (e: any) => {
      const theme = e.detail;
      setActiveTab('dashboard');
      handleGenerate(theme);
    };
    window.addEventListener('findSimilar', handleFindSimilar);
    return () => window.removeEventListener('findSimilar', handleFindSimilar);
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'recipes'),
      where('authorId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecipes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const filteredRecipes = recipes.filter(r => {
    const searchLower = searchFilter.toLowerCase();
    const titleMatch = r.title.toLowerCase().includes(searchLower);
    const themeMatch = r.theme?.toLowerCase().includes(searchLower);
    const ingredientMatch = r.ingredients?.some((ing: any) => 
      ing.name.toLowerCase().includes(searchLower)
    );
    return titleMatch || themeMatch || ingredientMatch;
  });

  const handleGenerate = async (targetTheme?: string) => {
    const themeToUse = targetTheme || theme;
    if (!themeToUse) return;
    setIsGenerating(true);
    setGeneratedRecipe(null);
    setSelectedRecipe(null);
    try {
      const aiConfig = preferences ? { 
        openaiKey: preferences.openaiKey, 
        anthropicKey: preferences.anthropicKey, 
        googleKey: preferences.googleKey,
        openrouterKey: preferences.openrouterKey,
        nvidiaKey: preferences.nvidiaKey,
        groqKey: preferences.groqKey
      } : undefined;
      const recipe = await generateRecipe(themeToUse, aiConfig, preferences?.selectedModelId);
      setGeneratedRecipe(recipe);
      setTheme(themeToUse);
    } catch (error) {
      console.error("Generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveRecipe = async () => {
    if (!generatedRecipe || !auth.currentUser) return;

    const error = validateRecipe(generatedRecipe);
    if (error) {
      alert(error);
      return;
    }

    try {
      await addDoc(collection(db, 'recipes'), {
        ...generatedRecipe,
        theme,
        authorId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
      setGeneratedRecipe(null);
      setTheme('');
      setActiveTab('recipes');
    } catch (error) {
      console.error("Save failed", error);
    }
  };

  const [shoppingList, setShoppingList] = useState<any[]>([]);

  useEffect(() => {
    if (recipes.length > 0) {
      const ingredients = recipes.slice(0, 3).flatMap(r => r.ingredients || []).slice(0, 8);
      setShoppingList(ingredients.map((ing, i) => ({ ...ing, id: i, completed: false })));
    }
  }, [recipes]);

  const toggleIngredient = (id: number) => {
    setShoppingList(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-10 pb-10"
    >
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-2 bg-red-50 text-red-600 p-4 rounded-2xl text-xs flex items-center justify-between border border-red-100"
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
      <header className="flex justify-between items-center px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-stone-200">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div className="space-y-0">
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Dashboard</h1>
            <p className="text-neutral-400 text-[9px] font-bold uppercase tracking-[0.2em]">Hệ thống Quản trị Bếp</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-stone-50 px-2 py-1.5 rounded-xl border border-stone-100 transition-all hover:border-stone-400 group">
            <Bot className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-900 transition-colors" />
            <select
              value={preferences?.selectedModelId}
              onChange={(e) => updatePreference?.('selectedModelId', e.target.value)}
              className="bg-transparent border-none p-0 font-bold text-stone-500 group-hover:text-stone-900 uppercase tracking-widest cursor-pointer focus:ring-0 text-[8px] sm:text-[9px] max-w-[60px] sm:max-w-none appearance-none transition-colors"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id} className="text-stone-900 bg-white uppercase font-sans">
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <button 
            onClick={() => setActiveTab('profile')}
            className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center hover:bg-stone-100 transition-all active:scale-95 border border-stone-100"
          >
            <Logo size={20} variant="stone" />
          </button>
        </div>
      </header>

      {/* Hero Section - Smart Search/Generate */}
      <section className="px-2 space-y-6">
        {/* Proactive Insights */}
        {insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.map((insight, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={cn(
                  "p-4 rounded-[2rem] border flex gap-4 items-start shadow-sm",
                  insight.type === 'warning' ? "bg-red-50 border-red-100" : 
                  insight.type === 'tip' ? "bg-amber-50 border-amber-100" : 
                  "bg-blue-50 border-blue-100"
                )}
              >
                <div className={cn(
                  "p-2.5 rounded-xl shrink-0",
                  insight.type === 'warning' ? "bg-red-100 text-red-600" : 
                  insight.type === 'tip' ? "bg-amber-100 text-amber-600" : 
                  "bg-blue-100 text-blue-600"
                )}>
                  {insight.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> : 
                   insight.type === 'tip' ? <Lightbulb className="w-4 h-4" /> : 
                   <TrendingUp className="w-4 h-4" />}
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-neutral-900 leading-tight">{insight.title}</h4>
                  <p className="text-[10px] text-neutral-500 leading-relaxed line-clamp-2">{insight.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="relative group">
          <input
            type="text"
            placeholder="Hôm nay chúng ta nấu gì?"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl py-5 pl-7 pr-16 focus:outline-none focus:bg-white focus:border-neutral-900 transition-all placeholder:text-neutral-400 text-base font-medium"
          />
          <button
            onClick={() => handleGenerate()}
            disabled={isGenerating || !theme}
            className="absolute right-3 top-3 bottom-3 w-12 bg-neutral-900 rounded-xl flex items-center justify-center text-white hover:bg-neutral-800 disabled:opacity-30 transition-all active:scale-95"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
          </button>
        </div>

        <button
          onClick={() => setActiveTab('generator')}
          className="w-full py-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-center gap-2 text-orange-600 text-xs font-bold uppercase tracking-widest hover:bg-orange-100 transition-all active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4" />
          Sáng tạo công thức nâng cao
        </button>
      </section>

      {/* Stats Section - Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
        <div className="bg-neutral-900 rounded-3xl p-6 text-white space-y-6 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-white/10 rounded-xl">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-semibold tracking-tight">28.4%</p>
            <p className="text-[11px] text-neutral-400 font-medium mt-1">Food Cost trung bình</p>
          </div>
        </div>

        <div className="bg-white border border-neutral-100 rounded-3xl p-6 space-y-6">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-neutral-50 rounded-xl">
              <DollarSign className="w-4 h-4 text-neutral-900" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-semibold tracking-tight text-neutral-900">
              <span className="text-lg text-neutral-400 mr-0.5">$</span>
              {recipes.reduce((acc, r) => acc + (r.totalCost || 0), 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-neutral-400 font-medium mt-1">Giá trị kho hiện tại</p>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
        <button
          onClick={() => setShowOrderAnalysis(true)}
          className="bg-neutral-50 p-5 rounded-3xl flex items-center gap-4 hover:bg-neutral-100 transition-all active:scale-95 group"
        >
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-neutral-900 shadow-sm group-hover:bg-neutral-900 group-hover:text-white transition-all">
            <Camera className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-neutral-900">Quét đơn</h3>
            <p className="text-[10px] text-neutral-400 font-medium">AI Vision</p>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className="bg-neutral-50 p-5 rounded-3xl flex items-center gap-4 hover:bg-neutral-100 transition-all active:scale-95 group"
        >
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-neutral-900 shadow-sm group-hover:bg-neutral-900 group-hover:text-white transition-all">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-neutral-900">Thị trường</h3>
            <p className="text-[10px] text-neutral-400 font-medium">Giá sỉ</p>
          </div>
        </button>
      </section>

      {/* Shopping List */}
      {shoppingList.length > 0 && (
        <section className="px-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-semibold text-neutral-900">Đi chợ nhanh</h3>
            <button 
              onClick={() => setActiveTab('recipes')}
              className="text-[11px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors"
            >
              Xem tất cả
            </button>
          </div>
          <div className="bg-white border border-neutral-100 rounded-3xl p-6">
            <div className="space-y-1">
              {shoppingList.map((ing: any) => (
                <motion.div 
                  key={ing.id} 
                  layout
                  className="flex items-center justify-between py-4 border-b border-neutral-50 last:border-0 group cursor-pointer"
                  onClick={() => toggleIngredient(ing.id)}
                >
                  <div className="flex items-center gap-4">
                    <motion.div 
                      initial={false}
                      animate={{ 
                        backgroundColor: ing.completed ? "#171717" : "#f5f5f5",
                      }}
                      className="w-5 h-5 rounded-lg flex items-center justify-center transition-colors"
                    >
                      {ing.completed && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          <Plus className="w-3 h-3 text-white rotate-45" />
                        </motion.div>
                      )}
                    </motion.div>
                    <span className={cn(
                      "text-sm font-medium transition-all duration-300",
                      ing.completed ? "text-neutral-300 line-through" : "text-neutral-700"
                    )}>
                      {ing.name}
                    </span>
                  </div>
                  <span className={cn(
                    "text-[11px] font-medium transition-colors",
                    ing.completed ? "text-neutral-200" : "text-neutral-400"
                  )}>
                    {ing.amount} {ing.unit}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Search Filter */}
      <section className="px-2 space-y-4">
        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Tìm công thức cũ..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-neutral-50 border-none rounded-2xl py-4.5 pl-14 pr-6 text-sm focus:bg-white focus:ring-1 focus:ring-neutral-200 transition-all"
          />
        </div>

        <AnimatePresence>
          {searchFilter && filteredRecipes.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white border border-neutral-100 rounded-3xl overflow-hidden shadow-xl shadow-neutral-900/5"
            >
              <div className="max-h-[300px] overflow-y-auto no-scrollbar p-2">
                {filteredRecipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() => setSelectedRecipe(recipe)}
                    className="w-full p-4 rounded-2xl hover:bg-neutral-50 transition-all text-left flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-neutral-50 rounded-lg flex items-center justify-center text-neutral-400 group-hover:bg-neutral-900 group-hover:text-white transition-all">
                        <ChefHat className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-neutral-900 text-sm truncate">{recipe.title}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-900 transition-colors" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {generatedRecipe && (
          <RecipeDetail
            recipe={generatedRecipe}
            onClose={() => setGeneratedRecipe(null)}
            onSave={saveRecipe}
            onFindSimilar={handleGenerate}
            isNew
          />
        )}

        {selectedRecipe && (
          <RecipeDetail
            recipe={selectedRecipe}
            onClose={() => setSelectedRecipe(null)}
            onFindSimilar={handleGenerate}
          />
        )}
      </AnimatePresence>

      {showOrderAnalysis && (
        <OrderAnalysis onClose={() => setShowOrderAnalysis(false)} preferences={preferences} />
      )}
    </motion.div>
  );
}
