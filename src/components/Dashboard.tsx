import { useState, useEffect } from 'react';
import { Search, Plus, Camera, TrendingUp, DollarSign, ShoppingBag, ChefHat, ChevronRight, Calendar, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateRecipe } from '../lib/gemini';
import { db, collection, addDoc, serverTimestamp, auth, query, where, orderBy, onSnapshot } from '../lib/firebase';
import { RecipeDetail } from './RecipeDetail';
import { OrderAnalysis } from './OrderAnalysis';
import { validateRecipe } from '../lib/utils';

interface DashboardProps {
  setActiveTab: (tab: any) => void;
}

export function Dashboard({ setActiveTab }: DashboardProps) {
  const [theme, setTheme] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<any>(null);
  const [showOrderAnalysis, setShowOrderAnalysis] = useState(false);
  
  const [recipes, setRecipes] = useState<any[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);

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
      const recipe = await generateRecipe(themeToUse);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-10 py-4"
    >
      <header className="flex justify-between items-end px-2">
        <div className="space-y-1">
          <h1 className="text-3xl font-serif font-bold text-stone-900 tracking-tight">SousChef</h1>
          <p className="text-stone-400 text-xs font-medium uppercase tracking-[0.2em]">Executive Assistant</p>
        </div>
        <div className="w-12 h-12 bg-stone-900 rounded-2xl flex items-center justify-center shadow-lg shadow-stone-200">
          <ChefHat className="w-6 h-6 text-white" />
        </div>
      </header>

      {/* Recipe Search/Generate */}
      <section className="space-y-4">
        <div className="relative group">
          <input
            type="text"
            placeholder="Hôm nay chúng ta nấu gì?"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="input-base pr-16"
          />
          <button
            onClick={() => handleGenerate()}
            disabled={isGenerating || !theme}
            className="absolute right-2 top-2 bottom-2 px-4 bg-stone-900 rounded-xl flex items-center justify-center text-white hover:bg-stone-800 disabled:opacity-30 transition-all active:scale-95"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </div>
      </section>

      {/* Quick Actions - Bento Grid Style */}
      <section className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setShowOrderAnalysis(true)}
          className="glass-card p-6 rounded-3xl hover:bg-white transition-all text-left space-y-4 group active:scale-[0.98]"
        >
          <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center group-hover:bg-stone-900 group-hover:text-white transition-all duration-300">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900">Quét đơn</h3>
            <p className="text-[10px] text-stone-400 uppercase tracking-wider font-bold">Phân tích ảnh</p>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className="glass-card p-6 rounded-3xl hover:bg-white transition-all text-left space-y-4 group active:scale-[0.98]"
        >
          <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center group-hover:bg-stone-900 group-hover:text-white transition-all duration-300">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900">Xu hướng</h3>
            <p className="text-[10px] text-stone-400 uppercase tracking-wider font-bold">Giá thị trường</p>
          </div>
        </button>
      </section>

      {/* Stats Section - Minimalist */}
      <section className="bg-stone-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-stone-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
        <div className="relative z-10 space-y-8">
          <div className="flex justify-between items-center">
            <h3 className="font-serif italic text-xl">Kitchen Insights</h3>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Live Data</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Food Cost TB</span>
              <p className="text-3xl font-bold tracking-tighter">28.4<span className="text-lg text-stone-500 ml-1">%</span></p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Giá trị kho</span>
              <p className="text-3xl font-bold tracking-tighter">
                <span className="text-lg text-stone-500 mr-1">$</span>
                {recipes.reduce((acc, r) => acc + (r.totalCost || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Shopping List - Clean Table */}
      {recipes.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-serif text-xl font-bold text-stone-900">Đi chợ nhanh</h3>
            <button 
              onClick={() => setActiveTab('recipes')}
              className="text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors"
            >
              Tất cả
            </button>
          </div>
          <div className="glass-card rounded-[2rem] p-6 space-y-4">
            <div className="space-y-1">
              {recipes.slice(0, 3).flatMap(r => r.ingredients || []).slice(0, 5).map((ing: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0 group">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-1 rounded-full bg-stone-300 group-hover:bg-stone-900 transition-colors" />
                    <span className="text-sm font-medium text-stone-700">{ing.name}</span>
                  </div>
                  <span className="text-xs font-bold text-stone-400">{ing.amount} {ing.unit}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Filter/Search - Secondary */}
      <section className="space-y-4 px-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Tìm công thức cũ..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-stone-200/50 border-none rounded-2xl py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-stone-900/10 transition-all"
          />
        </div>

        <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
          {searchFilter && filteredRecipes.length > 0 && filteredRecipes.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => setSelectedRecipe(recipe)}
              className="w-full p-4 rounded-2xl hover:bg-white transition-all text-left flex items-center justify-between group"
            >
              <span className="font-bold text-stone-900 text-sm truncate">{recipe.title}</span>
              <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-stone-900 transition-colors" />
            </button>
          ))}
        </div>
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
        <OrderAnalysis onClose={() => setShowOrderAnalysis(false)} />
      )}
    </motion.div>
  );
}
