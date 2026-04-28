import { useState, useEffect } from 'react';
import { db, collection, query, where, orderBy, onSnapshot, auth, addDoc } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Search, Calendar, DollarSign, ChevronRight, AlertCircle, RefreshCcw, BookOpen, Loader2, Sparkles } from 'lucide-react';
import { RecipeDetail } from './RecipeDetail';
import { Logo } from './Logo';

export function RecipeList() {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const SAMPLE_RECIPES = [
    {
      id: 'sample-1',
      title: "Phở Bò Truyền Thống (Mẫu)",
      description: "Công thức phở bò chuẩn vị Hà Nội với nước dùng trong và ngọt thanh.",
      theme: "vn",
      difficulty: "hard",
      ingredients: [
        { name: "Xương ống bò", amount: 2, unit: "kg", cost: 150000 },
        { name: "Thịt thăn bò", amount: 500, unit: "g", cost: 200000 },
        { name: "Bánh phở", amount: 1, unit: "kg", cost: 20000 }
      ],
      totalCost: 370000,
      recommendedPrice: 65000,
      isSample: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'sample-2',
      title: "Gà Cuộn Phô Mai (Mẫu)",
      description: "Món ăn hiện đại, gà mềm quyện cùng lớp phô mai béo ngậy.",
      theme: "âu",
      difficulty: "medium",
      ingredients: [
        { name: "Ức gà", amount: 300, unit: "g", cost: 45000 },
        { name: "Phô mai Mozzarella", amount: 100, unit: "g", cost: 35000 }
      ],
      totalCost: 80000,
      recommendedPrice: 220000,
      isSample: true,
      createdAt: new Date().toISOString()
    }
  ];

  const displayedRecipes = recipes.length > 0 ? recipes : SAMPLE_RECIPES;

  const seedDummyData = async () => {
    if (!auth.currentUser) return;
    setIsSeeding(true);
    try {
      const dummyRecipe = {
        title: "Bún Bò Huế (Mẫu)",
        description: "Công thức mẫu để kiểm tra hệ thống",
        theme: "vn",
        difficulty: "medium",
        ingredients: [
          { name: "Bắp bò", amount: 500, unit: "g", cost: 150000 },
          { name: "Sả", amount: 3, unit: "củ", cost: 5000 }
        ],
        steps: [
          "Hầm xương bò lấy nước dùng",
          "Nêm nếm mắm ruốc đặc thù",
          "Trình bày kèm rau sống"
        ],
        totalCost: 155000,
        recommendedPrice: 45000,
        version: 1.0,
        authorId: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      };
      
      await addDoc(collection(db, 'recipes'), dummyRecipe);
      setError(null);
    } catch (err: any) {
      console.error("Seed error:", err);
      setError(`Lỗi khi tạo dữ liệu mẫu: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const fetchRecipes = () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'recipes'),
      where('authorId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      setRecipes(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
      setError(null);
    }, (err: any) => {
      console.error("RecipeList onSnapshot error:", err);
      setError("Không thể tải danh sách công thức. Vui lòng kiểm tra kết nối mạng.");
      setLoading(false);
    });

    return unsubscribe;
  };

  useEffect(() => {
    const unsubscribe = fetchRecipes();
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [auth.currentUser?.uid]);

  const filteredRecipes = displayedRecipes.filter(r => 
    (r.title?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (r.theme?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-6 space-y-6"
    >
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Kho kiến thức</h1>
          <p className="text-stone-500 text-sm">
            {recipes.length > 0 ? "Bộ sưu tập công thức cá nhân của bạn" : "Đang hiển thị dữ liệu mẫu từ hệ thống"}
          </p>
        </div>
        {recipes.length === 0 && (
          <div className="bg-amber-50 text-amber-600 px-3 py-1.5 rounded-xl border border-amber-100 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Sample Mode</span>
          </div>
        )}
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
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
              <Logo size={56} variant="stone" className="opacity-10" />
            </motion.div>
            <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest animate-pulse">Đang nạp thư viện...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 p-8 rounded-[2.5rem] text-center space-y-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-stone-900">Kết nối bị gián đoạn</h3>
              <p className="text-sm text-stone-500 px-6">{error}</p>
            </div>
            <button
              onClick={fetchRecipes}
              className="px-6 py-3 bg-stone-900 text-white rounded-2xl text-xs font-bold hover:bg-stone-800 transition-all active:scale-95 flex items-center justify-center gap-2 mx-auto"
            >
              <RefreshCcw className="w-4 h-4" />
              Thử kết nối lại
            </button>
          </div>
        ) : filteredRecipes.length > 0 ? (
          filteredRecipes.map((recipe) => (
            <motion.button
              key={recipe.id}
              onClick={() => setSelectedRecipe(recipe)}
              className="w-full bg-white p-5 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4 group relative overflow-hidden"
            >
              {recipe.isSample && (
                <div className="absolute top-0 right-0 py-1 px-2 bg-amber-100 text-amber-600 text-[8px] font-bold uppercase tracking-wider rounded-bl-xl border-l border-b border-amber-200">
                  Sample
                </div>
              )}
              <div className="w-14 h-14 bg-stone-50 rounded-2xl flex items-center justify-center group-hover:bg-orange-50 transition-colors overflow-hidden border border-stone-50 group-hover:border-orange-100">
                {recipe.image ? (
                  <img src={recipe.image} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                ) : (
                  <Logo size={28} variant="stone" className="opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-stone-900 group-hover:text-orange-600 transition-colors truncate">{recipe.title}</h3>
                  <span className="text-[9px] font-bold text-stone-400 bg-stone-50 px-1 rounded border border-stone-100">
                    v{(recipe.version || 1.0).toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1 text-[10px] text-stone-400 uppercase tracking-widest font-bold">
                    <Calendar className="w-3 h-3" />
                    {recipe.createdAt && (
                      typeof recipe.createdAt.toDate === 'function' 
                        ? recipe.createdAt.toDate().toLocaleDateString('vi-VN')
                        : new Date(recipe.createdAt).toLocaleDateString('vi-VN')
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-orange-600 font-black uppercase tracking-widest">
                    <DollarSign className="w-3 h-3" />
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(recipe.recommendedPrice || 0)}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-500 transition-colors" />
            </motion.button>
          ))
        ) : (
          <div className="bg-stone-50 border border-stone-100 p-12 rounded-[2.5rem] text-center space-y-6">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <BookOpen className="w-10 h-10 text-stone-200" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-stone-900">Thư viện đang trống</h3>
              <p className="text-sm text-stone-500 max-w-[240px] mx-auto text-balance">Hãy bắt đầu hành trình ẩm thực của bạn bằng cách nạp dữ liệu mẫu hoặc tạo công thức đầu tiên.</p>
            </div>
            <div className="flex flex-col gap-3 max-w-[200px] mx-auto pt-2">
              <button
                onClick={seedDummyData}
                disabled={isSeeding}
                className="w-full px-6 py-3.5 bg-stone-900 text-white rounded-2xl text-xs font-bold hover:bg-stone-800 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                Nạp dữ liệu mẫu
              </button>
            </div>
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
