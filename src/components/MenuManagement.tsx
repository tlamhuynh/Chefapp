import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardList, 
  Package, 
  TrendingDown, 
  AlertTriangle, 
  Plus, 
  ChevronRight, 
  DollarSign, 
  History, 
  RefreshCw,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ChefHat,
  Save,
  Trash2,
  Edit3,
  Camera,
  Upload,
  Loader2,
  CheckCircle2,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { db, collection, query, where, orderBy, onSnapshot, auth, addDoc, updateDoc, doc, serverTimestamp } from '../lib/firebase';
import { analyzeMenuImage } from '../lib/gemini';
import { AVAILABLE_MODELS } from '../lib/ai';
import { cn } from '../lib/utils';
import { Logo } from './Logo';

interface InventoryItem {
  id: string;
  name: string;
  currentStock: number;
  minStock: number;
  unit: string;
  lastPurchasePrice: number;
  category: string;
}

interface Recipe {
  id: string;
  title: string;
  ingredients: any[];
  totalCost: number;
  sellingPrice: number;
  status: 'draft' | 'active' | 'archived';
  version: number;
  notes?: string;
}

export function MenuManagement({ setActiveTab, preferences, updatePreference }: { setActiveTab: (tab: any) => void, preferences?: any, updatePreference: (key: string, value: string) => void }) {
  const [activeSubTab, setActiveSubTab] = useState<'menu' | 'inventory' | 'insights'>('menu');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [newItem, setNewItem] = useState({ name: '', currentStock: 0, minStock: 0, unit: 'kg', category: 'Thực phẩm' });
  const [searchQuery, setSearchQuery] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    dishes: any[];
    clarifyingQuestions: string[];
    summary: string;
  } | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const aiConfig = preferences ? { 
          openaiKey: preferences.openaiKey, 
          anthropicKey: preferences.anthropicKey, 
          googleKey: preferences.googleKey,
          openrouterKey: preferences.openrouterKey,
          nvidiaKey: preferences.nvidiaKey,
          groqKey: preferences.groqKey
        } : undefined;
        const result = await analyzeMenuImage(base64, aiConfig, preferences?.selectedModelId);
        setAnalysisResult(result);
        setIsAnalyzing(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error analyzing menu:", error);
      setIsAnalyzing(false);
    }
  };

  const handleSaveAnalyzedMenu = async () => {
    if (!auth.currentUser || !analysisResult) return;
    
    try {
      for (const dish of analysisResult.dishes) {
        await addDoc(collection(db, 'recipes'), {
          title: dish.title,
          description: dish.description || '',
          sellingPrice: dish.price,
          ingredients: dish.potentialIngredients?.map((name: string) => ({ name, amount: '?', unit: '?' })) || [],
          status: 'draft',
          version: 1.0,
          authorId: auth.currentUser.uid,
          createdAt: serverTimestamp()
        });
      }
      setIsCapturing(false);
      setAnalysisResult(null);
      setNotification({ message: `Đã lưu ${analysisResult.dishes.length} món vào danh sách công thức nháp!`, type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("Error saving menu:", error);
      setNotification({ message: 'Có lỗi xảy ra khi lưu menu.', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const filteredRecipes = recipes.filter(recipe => {
    const query = searchQuery.toLowerCase();
    const matchesTitle = recipe.title.toLowerCase().includes(query);
    const matchesIngredients = recipe.ingredients?.some(ing => 
      ing.name.toLowerCase().includes(query)
    );
    const matchesTheme = (recipe as any).theme?.toLowerCase().includes(query);
    
    return matchesTitle || matchesIngredients || matchesTheme;
  });

  const handleAddItem = async () => {
    if (!auth.currentUser || !newItem.name) return;
    try {
      await addDoc(collection(db, 'inventory'), {
        ...newItem,
        authorId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
      setIsAddingItem(false);
      setNewItem({ name: '', currentStock: 0, minStock: 0, unit: 'kg', category: 'Thực phẩm' });
      setNotification({ message: `Đã thêm "${newItem.name}" vào kho thành công!`, type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("Error adding item:", error);
      setNotification({ message: 'Có lỗi xảy ra khi thêm nguyên liệu.', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    const recipesQuery = query(
      collection(db, 'recipes'),
      where('authorId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const inventoryQuery = query(
      collection(db, 'inventory'),
      where('authorId', '==', auth.currentUser.uid)
    );

    const unsubRecipes = onSnapshot(recipesQuery, (snapshot) => {
      setRecipes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe)));
    });

    const unsubInventory = onSnapshot(inventoryQuery, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    });

    return () => {
      unsubRecipes();
      unsubInventory();
    };
  }, []);

  const calculateMargin = (recipe: Recipe) => {
    if (!recipe.sellingPrice || !recipe.totalCost) return 0;
    return ((recipe.sellingPrice - recipe.totalCost) / recipe.sellingPrice) * 100;
  };

  const getLowStockItems = () => {
    return inventory.filter(item => item.currentStock <= item.minStock);
  };

  const getLowMarginRecipes = () => {
    return recipes.filter(r => r.status === 'active' && calculateMargin(r) < 30);
  };

  return (
    <div className="space-y-8 pb-10 relative">
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={cn(
              "fixed top-24 left-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md",
              notification.type === 'success' 
                ? "bg-green-50/90 border-green-100 text-green-800" 
                : "bg-red-50/90 border-red-100 text-red-800"
            )}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            )}
            <span className="text-sm font-bold">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <header className="px-2 space-y-8">
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <h1 className="text-3xl font-display font-bold text-neutral-900 tracking-tight">Vận hành</h1>
            <p className="text-neutral-400 text-[10px] font-bold uppercase tracking-[0.2em]">Menu • Kho • Lợi nhuận</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex bg-neutral-100 p-1 rounded-2xl">
              <button 
                onClick={() => setActiveSubTab('menu')}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                  activeSubTab === 'menu' ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                )}
              >
                Menu
              </button>
              <button 
                onClick={() => setActiveSubTab('inventory')}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                  activeSubTab === 'inventory' ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                )}
              >
                Kho
              </button>
              <button 
                onClick={() => setActiveSubTab('insights')}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                  activeSubTab === 'insights' ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                )}
              >
                Phân tích
              </button>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[8px] font-bold text-stone-400 uppercase tracking-widest">Model</span>
              <select
                value={preferences?.selectedModelId}
                onChange={(e) => updatePreference('selectedModelId', e.target.value)}
                className="bg-transparent border-none p-0 font-bold text-orange-600 uppercase tracking-widest cursor-pointer focus:ring-0 text-[9px] appearance-none hover:text-orange-700 transition-colors text-right"
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

        {activeSubTab === 'menu' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 rounded-[2rem] p-8 text-white shadow-2xl shadow-neutral-200 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl group-hover:bg-white/10 transition-all duration-700" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 bg-white/10 rounded-lg text-[8px] font-black uppercase tracking-widest">AI Powered</div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Menu Digitizer</span>
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-display font-bold leading-tight">Số hóa Menu<br/>bằng AI</h2>
                <p className="text-neutral-400 text-xs max-w-[200px] leading-relaxed">
                  Chụp ảnh menu giấy, AI sẽ tự động tạo danh sách món và tính cost.
                </p>
              </div>
              <button 
                onClick={() => setIsCapturing(true)}
                className="bg-white text-neutral-900 px-8 py-4 rounded-xl font-bold text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2"
              >
                <Camera className="w-4 h-4" /> Bắt đầu ngay
              </button>
            </div>
            <div className="absolute right-4 bottom-4 opacity-5 group-hover:scale-110 group-hover:rotate-12 transition-all duration-700">
              <Camera className="w-32 h-32" />
            </div>
          </motion.div>
        )}
      </header>

      <AnimatePresence mode="wait">
        {activeSubTab === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="px-2">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-neutral-900 transition-colors" />
                <input
                  type="text"
                  placeholder="Tìm kiếm món ăn, nguyên liệu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl py-4 pl-11 pr-4 text-sm focus:outline-none focus:bg-white focus:border-neutral-900 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {recipes.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-[2rem] border border-neutral-100 border-dashed px-6">
                  <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Logo size={32} variant="stone" className="opacity-40" />
                  </div>
                  <h3 className="text-lg font-display font-bold text-neutral-900 mb-2">Chưa có món ăn nào</h3>
                  <p className="text-neutral-400 text-sm mb-8 max-w-[240px] mx-auto">
                    Hãy bắt đầu xây dựng menu của bạn bằng cách số hóa menu cũ hoặc tạo mới cùng AI.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => setIsCapturing(true)}
                      className="bg-neutral-900 text-white px-8 py-4 rounded-xl font-bold text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4" /> Số hóa Menu cũ
                    </button>
                    <button 
                      onClick={() => setActiveTab('chat')}
                      className="bg-neutral-100 text-neutral-900 px-8 py-4 rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Tạo công thức mới
                    </button>
                  </div>
                </div>
              ) : filteredRecipes.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl border border-neutral-100 border-dashed">
                  <Search className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
                  <p className="text-neutral-400 text-sm italic">Không tìm thấy món ăn nào phù hợp.</p>
                </div>
              ) : (
                filteredRecipes.map((recipe) => (
                  <div 
                    key={recipe.id}
                    className="bg-white p-5 rounded-2xl border border-neutral-100 hover:border-neutral-200 transition-all group"
                  >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-neutral-900">{recipe.title}</h3>
                        <span className={cn(
                          "text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter",
                          recipe.status === 'active' ? "bg-green-50 text-green-600" : "bg-neutral-50 text-neutral-400"
                        )}>
                          {recipe.status || 'draft'}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400">Phiên bản v{recipe.version || 1.0}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-neutral-900">
                        {recipe.sellingPrice?.toLocaleString() || 0}đ
                      </p>
                      <p className="text-[10px] text-neutral-400">Giá bán</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 py-4 border-y border-neutral-50">
                    <div className="text-center">
                      <p className="text-xs font-bold text-neutral-900">{recipe.totalCost?.toLocaleString() || 0}đ</p>
                      <p className="text-[9px] text-neutral-400 uppercase font-bold">Cost</p>
                    </div>
                    <div className="text-center">
                      <p className={cn(
                        "text-xs font-bold",
                        calculateMargin(recipe) < 30 ? "text-red-500" : "text-green-600"
                      )}>
                        {calculateMargin(recipe).toFixed(1)}%
                      </p>
                      <p className="text-[9px] text-neutral-400 uppercase font-bold">Margin</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-neutral-900">{recipe.ingredients?.length || 0}</p>
                      <p className="text-[9px] text-neutral-400 uppercase font-bold">Items</p>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-between items-center">
                    <div className="flex -space-x-2">
                      {recipe.ingredients?.slice(0, 3).map((ing, i) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-neutral-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-neutral-500">
                          {ing.name[0]}
                        </div>
                      ))}
                      {recipe.ingredients?.length > 3 && (
                        <div className="w-6 h-6 rounded-full bg-neutral-50 border-2 border-white flex items-center justify-center text-[8px] font-bold text-neutral-400">
                          +{recipe.ingredients.length - 3}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => setSelectedRecipe(recipe)}
                      className="text-[10px] font-bold text-neutral-900 flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      Chi tiết <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
            </div>
          </motion.div>
        )}

        {activeSubTab === 'inventory' && (
          <motion.div
            key="inventory"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {['Tất cả', 'Thực phẩm', 'Gia vị', 'Đồ uống', 'Khác'].map((cat) => (
                <button key={cat} className="px-4 py-2 bg-white border border-neutral-100 rounded-xl text-xs font-bold text-neutral-500 whitespace-nowrap hover:bg-neutral-50 transition-colors">
                  {cat}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl overflow-hidden border border-neutral-100">
              <table className="w-full text-left">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold text-neutral-400 uppercase">Nguyên liệu</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-neutral-400 uppercase">Tồn kho</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-neutral-400 uppercase">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {inventory.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-neutral-400 text-sm italic">
                        Chưa có dữ liệu kho. Hãy thêm nguyên liệu mới.
                      </td>
                    </tr>
                  ) : (
                    inventory.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-4 py-4">
                          <p className="text-sm font-bold text-neutral-900">{item.name}</p>
                          <p className="text-[10px] text-neutral-400">{item.category}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-bold text-neutral-900">{item.currentStock} {item.unit}</p>
                          <p className="text-[10px] text-neutral-400">Min: {item.minStock}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn(
                            "text-[8px] px-2 py-1 rounded-full font-bold uppercase",
                            item.currentStock <= item.minStock ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                          )}>
                            {item.currentStock <= item.minStock ? 'Sắp hết' : 'Ổn định'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <button 
              onClick={() => setIsAddingItem(true)}
              className="w-full py-4 bg-neutral-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> Thêm nguyên liệu
            </button>
          </motion.div>
        )}

        {activeSubTab === 'insights' && (
          <motion.div
            key="insights"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Critical Alerts */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-neutral-900 px-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" /> Cảnh báo quan trọng
              </h3>
              
              {getLowStockItems().map(item => (
                <div key={item.id} className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <Package className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-neutral-900">{item.name} sắp hết</p>
                      <p className="text-[10px] text-red-600 font-medium">Chỉ còn {item.currentStock} {item.unit} (Min: {item.minStock})</p>
                    </div>
                  </div>
                  <button className="p-2 bg-white rounded-lg shadow-sm text-red-500 hover:bg-red-500 hover:text-white transition-all">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {getLowMarginRecipes().map(recipe => (
                <div key={recipe.id} className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <TrendingDown className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-neutral-900">{recipe.title}</p>
                      <p className="text-[10px] text-orange-600 font-medium">Biên lợi nhuận thấp: {calculateMargin(recipe).toFixed(1)}%</p>
                    </div>
                  </div>
                  <button className="p-2 bg-white rounded-lg shadow-sm text-orange-500 hover:bg-orange-500 hover:text-white transition-all">
                    <DollarSign className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {getLowStockItems().length === 0 && getLowMarginRecipes().length === 0 && (
                <div className="text-center py-10 space-y-4">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                    <Logo size={32} />
                  </div>
                  <p className="text-neutral-400 text-sm italic">Mọi thứ đang vận hành hoàn hảo!</p>
                </div>
              )}
            </div>

            {/* AI Suggestions Section */}
            <div className="bg-neutral-900 rounded-[2rem] p-8 text-white space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">AI Chef Insights</h3>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-xs leading-relaxed text-neutral-300">
                    <span className="text-purple-400 font-bold">Gợi ý thay thế:</span> Do <span className="text-white font-bold">Hành tây</span> đang sắp hết, bạn có thể sử dụng <span className="text-white font-bold">Hành baro</span> để thay thế trong các món hầm mà không làm thay đổi quá nhiều hương vị.
                  </p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-xs leading-relaxed text-neutral-300">
                    <span className="text-purple-400 font-bold">Tối ưu lợi nhuận:</span> Món <span className="text-white font-bold">Bò sốt vang</span> đang có giá vốn tăng 12% do giá thịt bò biến động. Hãy cân nhắc điều chỉnh định lượng hoặc tăng giá bán thêm 15,000đ.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recipe Detail Modal */}
      <AnimatePresence>
        {selectedRecipe && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                <h2 className="text-xl font-display font-bold text-neutral-900">{selectedRecipe.title}</h2>
                <button onClick={() => setSelectedRecipe(null)} className="p-2 bg-neutral-100 rounded-full">
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <section className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Định lượng & Costing</h3>
                  <div className="space-y-2">
                    {selectedRecipe.ingredients?.map((ing, i) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-neutral-50 last:border-0">
                        <span className="text-sm text-neutral-700">{ing.name}</span>
                        <div className="text-right">
                          <p className="text-sm font-bold text-neutral-900">{ing.amount} {ing.unit}</p>
                          <p className="text-[10px] text-neutral-400">{ing.costPerAmount?.toLocaleString() || 0}đ</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-neutral-50 p-6 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-neutral-500 uppercase">Tổng giá vốn</span>
                    <span className="text-lg font-bold text-neutral-900">{selectedRecipe.totalCost?.toLocaleString() || 0}đ</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-neutral-500 uppercase">Giá bán hiện tại</span>
                    <span className="text-lg font-bold text-neutral-900">{selectedRecipe.sellingPrice?.toLocaleString() || 0}đ</span>
                  </div>
                  <div className="pt-4 border-t border-neutral-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-neutral-500 uppercase">Biên lợi nhuận</span>
                    <span className={cn(
                      "text-xl font-bold",
                      calculateMargin(selectedRecipe) < 30 ? "text-red-500" : "text-green-600"
                    )}>
                      {calculateMargin(selectedRecipe).toFixed(1)}%
                    </span>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Nhật ký thử nghiệm (v{selectedRecipe.version})</h3>
                    <button className="text-[10px] font-bold text-neutral-900 flex items-center gap-1">
                      <History className="w-3 h-3" /> Lịch sử
                    </button>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100 italic text-neutral-600 text-sm">
                    "{selectedRecipe.notes || 'Chưa có ghi chú cho phiên bản này.'}"
                  </div>
                </section>
              </div>

              <div className="p-6 bg-white border-t border-neutral-100 flex gap-3">
                <button className="flex-1 py-4 bg-neutral-100 text-neutral-900 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                  <Edit3 className="w-4 h-4" /> Chỉnh sửa
                </button>
                <button className="flex-1 py-4 bg-neutral-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> Lưu Menu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu Capture & Analysis Modal */}
      <AnimatePresence>
        {isCapturing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white w-full max-w-2xl rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
                <div>
                  <h2 className="text-xl font-display font-bold text-neutral-900">Số hóa Menu</h2>
                  <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">AI Menu Digitizer</p>
                </div>
                <button onClick={() => { setIsCapturing(false); setAnalysisResult(null); }} className="p-2 bg-white rounded-full shadow-sm">
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                {!analysisResult && !isAnalyzing ? (
                  <div className="text-center space-y-8 py-12">
                    <div className="w-24 h-24 bg-neutral-50 rounded-full flex items-center justify-center mx-auto border-2 border-dashed border-neutral-200">
                      <Camera className="w-10 h-10 text-neutral-500" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-neutral-900">Chụp hoặc tải ảnh Menu</h3>
                      <p className="text-sm text-neutral-500 max-w-xs mx-auto">AI sẽ tự động nhận diện món ăn, giá cả và gợi ý định lượng cho bạn.</p>
                    </div>
                    <label className="inline-flex items-center gap-2 px-8 py-4 bg-neutral-900 text-white rounded-xl font-bold text-sm cursor-pointer hover:bg-neutral-800 transition-all shadow-xl">
                      <Upload className="w-4 h-4" /> Chọn ảnh Menu
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                ) : isAnalyzing ? (
                  <div className="text-center space-y-6 py-20">
                    <div className="relative w-20 h-20 mx-auto">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 border-4 border-neutral-100 border-t-neutral-900 rounded-full"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-neutral-900 animate-pulse" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-neutral-900">Đang phân tích Menu...</h3>
                      <p className="text-sm text-neutral-400">Đầu bếp AI đang đọc danh sách món ăn của bạn.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <section className="bg-green-50 p-6 rounded-2xl border border-green-100">
                      <div className="flex items-center gap-3 mb-4">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <h3 className="font-bold text-green-900">Kết quả phân tích</h3>
                      </div>
                      <p className="text-sm text-green-800 leading-relaxed">{analysisResult?.summary}</p>
                    </section>

                    <section className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Danh sách món ăn nhận diện ({analysisResult?.dishes.length})</h3>
                      <div className="grid grid-cols-1 gap-3">
                        {analysisResult?.dishes.map((dish, i) => (
                          <div key={i} className="p-4 bg-white border border-neutral-100 rounded-xl flex justify-between items-center shadow-sm">
                            <div>
                              <p className="font-bold text-neutral-900">{dish.title}</p>
                              <p className="text-[10px] text-neutral-400">{dish.description || 'Không có mô tả'}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-neutral-900">{dish.price?.toLocaleString()}đ</p>
                              <p className="text-[9px] text-neutral-400 uppercase font-bold">Giá bán</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    {analysisResult?.clarifyingQuestions && analysisResult.clarifyingQuestions.length > 0 && (
                      <section className="bg-orange-50 p-6 rounded-2xl border border-orange-100">
                        <div className="flex items-center gap-3 mb-4">
                          <HelpCircle className="w-5 h-5 text-orange-600" />
                          <h3 className="font-bold text-orange-900">Câu hỏi từ Bếp Trưởng</h3>
                        </div>
                        <ul className="space-y-3">
                          {analysisResult.clarifyingQuestions.map((q, i) => (
                            <li key={i} className="text-sm text-orange-800 flex gap-2">
                              <span className="font-bold">•</span> {q}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-4 text-[10px] text-orange-600 font-medium italic">* Bạn có thể trả lời các câu hỏi này sau khi lưu vào Menu Manager.</p>
                      </section>
                    )}
                  </div>
                )}
              </div>

              {analysisResult && (
                <div className="p-6 bg-white border-t border-neutral-100 flex gap-3">
                  <button 
                    onClick={() => { setAnalysisResult(null); }}
                    className="flex-1 py-4 bg-neutral-100 text-neutral-900 rounded-xl font-bold text-sm"
                  >
                    Chụp lại
                  </button>
                  <button 
                    onClick={handleSaveAnalyzedMenu}
                    className="flex-1 py-4 bg-neutral-900 text-white rounded-xl font-bold text-sm shadow-xl"
                  >
                    Lưu vào Menu Manager
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Inventory Item Modal */}
      <AnimatePresence>
        {isAddingItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-serif font-bold text-stone-900">Thêm nguyên liệu</h2>
                <button onClick={() => setIsAddingItem(false)} className="p-2 bg-stone-100 rounded-full">
                  <X className="w-5 h-5 text-stone-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">Tên nguyên liệu</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: Hành tây"
                    value={newItem.name}
                    onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                    className="w-full bg-stone-50 border border-stone-100 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-stone-900 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">Tồn kho hiện tại</label>
                    <input 
                      type="number" 
                      value={newItem.currentStock}
                      onChange={(e) => setNewItem({...newItem, currentStock: Number(e.target.value)})}
                      className="w-full bg-stone-50 border border-stone-100 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-stone-900 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">Tồn kho tối thiểu</label>
                    <input 
                      type="number" 
                      value={newItem.minStock}
                      onChange={(e) => setNewItem({...newItem, minStock: Number(e.target.value)})}
                      className="w-full bg-stone-50 border border-stone-100 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-stone-900 transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">Đơn vị</label>
                    <select 
                      value={newItem.unit}
                      onChange={(e) => setNewItem({...newItem, unit: e.target.value})}
                      className="w-full bg-stone-50 border border-stone-100 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-stone-900 transition-all"
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="l">l</option>
                      <option value="ml">ml</option>
                      <option value="cái">cái</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">Danh mục</label>
                    <select 
                      value={newItem.category}
                      onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                      className="w-full bg-stone-50 border border-stone-100 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-stone-900 transition-all"
                    >
                      <option value="Thực phẩm">Thực phẩm</option>
                      <option value="Gia vị">Gia vị</option>
                      <option value="Đồ uống">Đồ uống</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleAddItem}
                className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold text-sm shadow-xl shadow-stone-200 active:scale-95 transition-all"
              >
                Lưu nguyên liệu
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
