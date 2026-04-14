import { useState, useEffect } from 'react';
import { db, collection, query, where, orderBy, onSnapshot, auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Search, Calendar, DollarSign, ChevronRight } from 'lucide-react';
import { RecipeDetail } from './RecipeDetail';
import { useDebounce } from '../lib/useDebounce';

export function RecipeList() {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'recipes'),
      where('authorId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecipes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredRecipes = recipes.filter(r => 
    r.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
    r.theme?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-6 space-y-6"
    >
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Kho kiến thức</h1>
        <p className="text-stone-500 text-sm">Bộ sưu tập công thức cá nhân của bạn</p>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
        <input
          type="text"
          placeholder="Tìm công thức..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-stone-200 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all shadow-sm"
        />
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <ChefHat className="w-8 h-8 text-stone-300" />
            </motion.div>
          </div>
        ) : filteredRecipes.length > 0 ? (
          filteredRecipes.map((recipe) => (
            <motion.button
              key={recipe.id}
              onClick={() => setSelectedRecipe(recipe)}
              className="w-full bg-white p-5 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4 group"
            >
              <div className="w-14 h-14 bg-stone-50 rounded-2xl flex items-center justify-center group-hover:bg-orange-50 transition-colors">
                <ChefHat className="w-7 h-7 text-stone-400 group-hover:text-orange-500 transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-stone-900 truncate">{recipe.title}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1 text-[10px] text-stone-400 uppercase tracking-wider">
                    <Calendar className="w-3 h-3" />
                    {recipe.createdAt?.toDate().toLocaleDateString('vi-VN')}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-orange-600 font-bold uppercase tracking-wider">
                    <DollarSign className="w-3 h-3" />
                    {recipe.recommendedPrice?.toLocaleString()}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-500 transition-colors" />
            </motion.button>
          ))
        ) : (
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto">
              <BookOpen className="w-8 h-8 text-stone-300" />
            </div>
            <p className="text-stone-500">Không tìm thấy công thức nào. Hãy bắt đầu tạo mới!</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedRecipe && (
          <RecipeDetail
            recipe={selectedRecipe}
            onClose={() => setSelectedRecipe(null)}
            onFindSimilar={(theme) => {
              // For simplicity, we just set the theme and switch to dashboard
              // In a real app, we might pass this state up
              window.dispatchEvent(new CustomEvent('findSimilar', { detail: theme }));
              setSelectedRecipe(null);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

import { BookOpen } from 'lucide-react';
