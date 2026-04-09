import { useState, useEffect } from 'react';
import { Search, Plus, Camera, TrendingUp, DollarSign, ShoppingBag, ChefHat, ChevronRight, Calendar } from 'lucide-react';
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
      setRecipes(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          ingredientsStr: data.ingredients?.map((i: any) => i.name).join(', ') || ''
        };
      }));
    });
    return () => unsubscribe();
  }, []);

  const filteredRecipes = recipes.filter(r => {
    const searchLower = searchFilter.toLowerCase();
    const titleMatch = r.title.toLowerCase().includes(searchLower);
    const themeMatch = r.theme?.toLowerCase().includes(searchLower);
    const ingredientMatch = r.ingredientsStr?.toLowerCase().includes(searchLower);
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-6 space-y-8"
    >
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Chào Chef,</h1>
          <p className="text-stone-500 text-sm">Hôm nay chúng ta nấu gì?</p>
        </div>
        <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
          <ChefHat className="w-6 h-6 text-orange-600" />
        </div>
      </header>

      {/* Recipe Search/Generate */}
      <section className="space-y-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Nhập chủ đề (vd: Hải sản mùa hè)"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full bg-white border border-stone-200 rounded-2xl py-4 px-6 pr-14 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all shadow-sm"
          />
          <button
            onClick={() => handleGenerate()}
            disabled={isGenerating || !theme}
            className="absolute right-2 top-2 bottom-2 w-10 bg-orange-600 rounded-xl flex items-center justify-center text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {isGenerating ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Plus className="w-5 h-5" />
              </motion.div>
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </div>
      </section>

      {/* Filter Recipes Search Bar */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-stone-900">Bộ lọc nhanh</h3>
          <span className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">{filteredRecipes.length} Công thức</span>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Tìm theo chủ đề hoặc nguyên liệu..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-stone-100 border-none rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
          />
        </div>

        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {searchFilter && filteredRecipes.length > 0 ? (
            filteredRecipes.map((recipe) => (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={recipe.id}
                onClick={() => setSelectedRecipe(recipe)}
                className="w-full bg-white p-4 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-all text-left flex items-center gap-3 group"
              >
                <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center group-hover:bg-orange-50 transition-colors">
                  <ChefHat className="w-5 h-5 text-stone-400 group-hover:text-orange-500 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-stone-900 text-sm truncate">{recipe.title}</h4>
                  <p className="text-[10px] text-stone-400 truncate">
                    {recipe.ingredientsStr}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-300" />
              </motion.button>
            ))
          ) : searchFilter ? (
            <p className="text-center text-xs text-stone-400 py-4">Không tìm thấy công thức phù hợp.</p>
          ) : null}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setShowOrderAnalysis(true)}
          className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-all text-left space-y-3 group"
        >
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
            <Camera className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900">Phân tích đơn</h3>
            <p className="text-xs text-stone-500">Quét đơn hàng từ ảnh</p>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-all text-left space-y-3 group"
        >
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center group-hover:bg-purple-100 transition-colors">
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900">Xu hướng</h3>
            <p className="text-xs text-stone-500">Hỏi về giá thị trường</p>
          </div>
        </button>
      </section>

      {/* Sub-agent Stats (Mock/Placeholder for now) */}
      <section className="bg-stone-900 rounded-[2rem] p-6 text-white space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">Sub-agent Insights</h3>
          <span className="text-[10px] bg-stone-800 px-2 py-1 rounded-full uppercase tracking-widest text-stone-400">Live</span>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-stone-400">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Food Cost TB</span>
            </div>
            <p className="text-2xl font-bold">28.4%</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-stone-400">
              <ShoppingBag className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Giá trị kho</span>
            </div>
            <p className="text-2xl font-bold">$4,250</p>
          </div>
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
