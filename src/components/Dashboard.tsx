import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Camera,
  DollarSign,
  ShoppingBag,
  ChefHat,
  ChevronRight,
  Calendar,
  Bot,
  LayoutDashboard,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { generateRecipe, analyzeMenuImage } from "../lib/gemini";
import { generateProactiveInsights, AVAILABLE_MODELS } from "../lib/ai";
import {
  db,
  collection,
  addDoc,
  serverTimestamp,
  auth,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
} from "../lib/firebase";
import { seedProfessionalData } from "../lib/sampleData";
import { RecipeDetail } from "./RecipeDetail";
import { OrderAnalysis } from "./OrderAnalysis";
import { validateRecipe, cn } from "../lib/utils";
import {
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { Logo } from "./Logo";

interface DashboardProps {
  setActiveTab: (tab: any) => void;
  preferences?: any;
  updatePreference?: (key: string, value: string) => void;
}

export function Dashboard({
  setActiveTab,
  preferences,
  updatePreference,
}: DashboardProps) {
  const [theme, setTheme] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<any>(null);
  const [showOrderAnalysis, setShowOrderAnalysis] = useState(false);

  const [recipes, setRecipes] = useState<any[]>([]);
  const [dbProvider, setDbProvider] = useState<string>("firebase");
  const [dbStatus, setDbStatus] = useState<"connected" | "error" | "seeking">(
    "seeking"
  );
  const [aiProvider, setAiProvider] = useState<string>("checking");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [hasAttemptedInsights, setHasAttemptedInsights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackNotif, setFallbackNotif] = useState<string | null>(null);

  useEffect(() => {
    const handleModelFallback = (e: any) => {
      const { originalModel, fallbackModel } = e.detail;
      setFallbackNotif(
        `Nhận diện hình ảnh không khả dụng trên ${originalModel}. Tự động chuyển sang model dự phòng ${
          fallbackModel || ""
        } để phân tích.`
      );
      setTimeout(() => setFallbackNotif(null), 8000);
    };
    window.addEventListener("ai-model-fallback", handleModelFallback);
    return () =>
      window.removeEventListener("ai-model-fallback", handleModelFallback);
  }, []);

  // Auto-Modernize selected model to Gemini 3.1 if invalid
  useEffect(() => {
    if (preferences && updatePreference) {
      const currentModelId = preferences.selectedModelId;
      const isValidModel = AVAILABLE_MODELS.some(
        (m) => m.id === currentModelId
      );

      // Target model for modernization - Use the new 2.5 Flash default
      const targetModelId = "gemini-2.0-flash";

      if (
        (!currentModelId || !isValidModel) &&
        currentModelId !== targetModelId
      ) {
        console.log("Modernizing model to Gemini 2.5 Flash...");
        updatePreference("selectedModelId", targetModelId);
      }
    }
  }, [preferences?.selectedModelId, updatePreference]);

  useEffect(() => {
    const fetchInsights = async () => {
      if (!auth.currentUser || recipes.length === 0 || hasAttemptedInsights)
        return;
      setIsLoadingInsights(true);
      setHasAttemptedInsights(true);
      try {
        const q = query(
          collection(db, "inventory"),
          where("authorId", "==", auth.currentUser.uid)
        );
        const inventorySnap = await getDocs(q);
        const inventory = inventorySnap.docs.map((d) => d.data());

        const aiConfig = preferences
          ? {
              openaiKey: preferences.openaiKey,
              anthropicKey: preferences.anthropicKey,
              googleKey: preferences.googleKey,
              openrouterKey: preferences.openrouterKey,
              nvidiaKey: preferences.nvidiaKey,
              groqKey: preferences.groqKey,
            }
          : undefined;

        const result = await generateProactiveInsights(
          preferences?.selectedModelId || "gemini-2.0-flash",
          inventory,
          recipes,
          aiConfig
        );

        if (result && Array.isArray(result.insights)) {
          setInsights(result.insights);
          setError(null);
        } else {
          console.warn("Unexpected insights format:", result);
          setInsights([]);
        }
      } catch (error: any) {
        const errMsg = error.message?.toLowerCase() || "";
        if (
          !errMsg.includes("hạn mức") &&
          !errMsg.includes("quota") &&
          !errMsg.includes("limit") &&
          !errMsg.includes("429") &&
          !errMsg.includes("api key not valid")
        ) {
          console.error("Failed to fetch insights", error);
        }
        // Do not set global error for background insight task to prevent annoying popups on startup
        // We just leave insights empty or old.
      } finally {
        setIsLoadingInsights(false);
      }
    };

    if (recipes.length > 0 && !hasAttemptedInsights) {
      fetchInsights();
    }
  }, [recipes, auth.currentUser, hasAttemptedInsights]);

  useEffect(() => {
    const handleFindSimilar = (e: any) => {
      const theme = e.detail;
      setActiveTab("dashboard");
      handleGenerate(theme);
    };
    window.addEventListener("findSimilar", handleFindSimilar);
    return () => window.removeEventListener("findSimilar", handleFindSimilar);
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, "recipes"),
      where("authorId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setRecipes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setError(null); // Xóa lỗi khi dữ liệu được nạp thành công
      },
      (err: any) => {
        console.error("Dashboard onSnapshot error:", err);
      }
    );
    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/health/check");
        const data = await res.json();
        if (data.dbProvider) setDbProvider(data.dbProvider);
        if (data.db === "connected") setDbStatus("connected");
        else setDbStatus("error");
        if (data.aiProvider) setAiProvider(data.aiProvider);
      } catch (e) {
        setDbStatus("error");
        setAiProvider("offline");
      }
    };
    checkStatus();
  }, []);

  const [isSeeding, setIsSeeding] = useState(false);

  const SAMPLE_RECIPES = [
    {
      id: "sample-1",
      title: "Thăn Bò Wagyu A5 Áp Chảo (Sample)",
      description:
        "Thăn bò Wagyu cực phẩm với vân mỡ đều, áp chảo cùng tỏi đen và muối Truffle.",
      theme: "Fine Dining",
      difficulty: "hard",
      ingredients: [
        { name: "Thịt bò Wagyu A5", amount: 200, unit: "g", cost: 1200000 },
        { name: "Tỏi đen Ly Sơn", amount: 3, unit: "tép", cost: 20000 },
        { name: "Muối Truffle", amount: 5, unit: "g", cost: 15000 },
      ],
      totalCost: 1235000,
      isSample: true,
    },
    {
      id: "sample-2",
      title: "Gà Đông Tảo Hầm Thuốc Bắc (Sample)",
      description:
        "Món ăn đại bổ với gà Đông Tảo tuyển chọn, hầm cùng sâm và kỷ tử hảo hạng.",
      theme: "Dân dã cao cấp",
      difficulty: "medium",
      ingredients: [
        { name: "Đùi gà Đông Tảo", amount: 500, unit: "g", cost: 350000 },
        { name: "Set thuốc bắc", amount: 1, unit: "gói", cost: 50000 },
      ],
      totalCost: 400000,
      isSample: true,
    },
  ];

  const displayedRecipes = recipes.length > 0 ? recipes : SAMPLE_RECIPES;

  const seedDummyData = async () => {
    setIsSeeding(true);
    try {
      await seedProfessionalData();
      setError(null);
      alert(
        "Nạp dữ liệu chuyên nghiệp thành công! Toàn bộ hệ thống kho, thực đơn và lịch sử đã sẵn sàng."
      );
    } catch (err: any) {
      console.error("Seed error:", err);
      alert(
        `Lỗi khi tạo dữ liệu: ${
          err.message || "Xem console để biết thêm chi tiết"
        }`
      );
    } finally {
      setIsSeeding(false);
    }
  };

  const filteredRecipes = displayedRecipes.filter((r) => {
    if (!r) return false;
    const searchLower = searchFilter.toLowerCase();
    const titleMatch =
      r.title && typeof r.title === "string"
        ? r.title.toLowerCase().includes(searchLower)
        : false;
    const themeMatch =
      r.theme && typeof r.theme === "string"
        ? r.theme.toLowerCase().includes(searchLower)
        : false;
    const ingredientMatch = r.ingredients?.some((ing: any) =>
      ing && ing.name && typeof ing.name === "string"
        ? ing.name.toLowerCase().includes(searchLower)
        : false
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
      const aiConfig = preferences
        ? {
            openaiKey: preferences.openaiKey,
            anthropicKey: preferences.anthropicKey,
            googleKey: preferences.googleKey,
            openrouterKey: preferences.openrouterKey,
            nvidiaKey: preferences.nvidiaKey,
            groqKey: preferences.groqKey,
          }
        : undefined;
      const recipe = await generateRecipe(
        themeToUse,
        aiConfig,
        preferences?.selectedModelId
      );
      setGeneratedRecipe(recipe);
      setTheme(themeToUse);
    } catch (error: any) {
      console.warn("Generation failed:", error);
      alert(
        error.message ||
          "Quá trình tạo Menu/Công thức thất bại. Vui lòng thử lại!"
      );
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
      await addDoc(collection(db, "recipes"), {
        ...generatedRecipe,
        theme,
        authorId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
      setGeneratedRecipe(null);
      setTheme("");
      setActiveTab("recipes");
    } catch (error) {
      console.error("Save failed", error);
    }
  };

  const [shoppingList, setShoppingList] = useState<any[]>([]);

  useEffect(() => {
    if (recipes.length > 0) {
      const ingredients = recipes
        .slice(0, 3)
        .flatMap((r) => r.ingredients || [])
        .slice(0, 8);
      setShoppingList(
        ingredients.map((ing, i) => ({ ...ing, id: i, completed: false }))
      );
    }
  }, [recipes]);

  const toggleIngredient = (id: number) => {
    setShoppingList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-10 pb-10"
    >
      <AnimatePresence>
        <section className="px-2">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "bg-white border rounded-[2rem] p-6 shadow-sm overflow-hidden relative",
              dbStatus === "connected"
                ? "border-stone-100"
                : "border-orange-200 bg-orange-50/30"
            )}
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "p-3 rounded-2xl shadow-inner",
                    dbStatus === "connected"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-orange-100 text-orange-600"
                  )}
                >
                  {dbStatus === "connected" ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <AlertCircle className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-stone-900 text-base">
                      Hệ thống Kitchen OS
                    </h3>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                        dbStatus === "connected"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-orange-200 text-orange-800"
                      )}
                    >
                      {dbStatus === "connected"
                        ? "Online"
                        : "Offline / Warning"}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1 font-medium">
                    {dbStatus === "connected"
                      ? `Kết nối ổn định với ${dbProvider.toUpperCase()}. Dữ liệu thực đơn và kho đang được đồng bộ.`
                      : "Mất kết nối hoặc Database chưa có dữ liệu. Vui lòng kiểm tra lại cấu hình hoặc nạp dữ liệu mẫu."}
                  </p>
                  {error && (
                    <div className="mt-2 flex items-center gap-1.5 text-orange-700 bg-orange-100/50 px-2 py-1 rounded-lg w-fit">
                      <AlertTriangle className="w-3 h-3" />
                      <span className="text-[10px] font-bold">{error}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                {recipes.length === 0 && (
                  <button
                    onClick={seedDummyData}
                    disabled={isSeeding}
                    className="flex-1 md:flex-none px-5 py-3 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-stone-200"
                  >
                    {isSeeding ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Tạo dữ liệu thử
                  </button>
                )}
                {dbStatus !== "connected" && (
                  <button
                    onClick={() => window.location.reload()}
                    className="p-3 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-all text-stone-500"
                    title="Thử lại"
                  >
                    <Bot className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {/* Visual background element */}
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-stone-50 rounded-full blur-3xl opacity-50 pointer-events-none" />
          </motion.div>
        </section>
      </AnimatePresence>
      <header className="flex justify-between items-center px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-stone-200">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div className="space-y-0">
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
              Dashboard
            </h1>
            <p className="text-neutral-400 text-[9px] font-bold uppercase tracking-[0.2em]">
              Hệ thống Quản trị Bếp
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-stone-50 px-2 py-1.5 rounded-xl border border-stone-100 transition-all hover:border-stone-400 group">
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                dbStatus === "connected" ? "bg-emerald-500" : "bg-red-500"
              )}
            />
            <span className="text-[8px] font-bold text-stone-400 capitalize tracking-widest">
              DB: {dbProvider}
            </span>
          </div>
          <div className="relative flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-100 transition-all hover:border-stone-400 group cursor-pointer overflow-hidden max-w-[180px]">
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse shrink-0",
                aiProvider === "none" || aiProvider === "offline"
                  ? "bg-red-500"
                  : "bg-emerald-500"
              )}
            />
            <span className="text-[9px] font-bold text-stone-400 capitalize tracking-widest hidden sm:inline">
              AI
            </span>
            <select
              value={preferences?.selectedModelId || ""}
              onChange={(e) =>
                updatePreference?.("selectedModelId", e.target.value)
              }
              className="appearance-none bg-transparent outline-none border-none p-0 focus:ring-0 text-[10px] font-bold text-stone-600 group-hover:text-stone-900 tracking-wider truncate cursor-pointer z-10 w-full"
              title="Chọn AI Model"
            >
              {AVAILABLE_MODELS.filter(m => m.tags?.includes('light')).map((model) => (
                <option key={model.id} value={model.id} className="text-stone-900 font-sans">
                  {model.name} {model.supportsVision === false ? "(No Vision)" : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={seedDummyData}
            disabled={isSeeding}
            title="Tạo dữ liệu thử nghiệm"
            className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center hover:bg-stone-100 transition-all active:scale-95 border border-stone-100 text-stone-400 hover:text-orange-600"
          >
            {isSeeding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center hover:bg-stone-100 transition-all active:scale-95 border border-stone-100"
          >
            <Logo size={20} variant="stone" />
          </button>
        </div>
      </header>

      {/* Hero Section - Smart Search/Generate */}
      <section className="px-2 space-y-6">
        {/* Proactive Insights */}
        {insights && insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.filter(i => i && (i.title || i.description)).map((insight, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={cn(
                  "p-4 rounded-[2rem] border flex gap-4 items-start shadow-sm",
                  insight.type === "warning"
                    ? "bg-red-50 border-red-100"
                    : insight.type === "tip"
                    ? "bg-amber-50 border-amber-100"
                    : "bg-blue-50 border-blue-100"
                )}
              >
                <div
                  className={cn(
                    "p-2.5 rounded-xl shrink-0",
                    insight.type === "warning"
                      ? "bg-red-100 text-red-600"
                      : insight.type === "tip"
                      ? "bg-amber-100 text-amber-600"
                      : "bg-blue-100 text-blue-600"
                  )}
                >
                  {insight.type === "warning" ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : insight.type === "tip" ? (
                    <Lightbulb className="w-4 h-4" />
                  ) : (
                    <TrendingUp className="w-4 h-4" />
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-neutral-900 leading-tight">
                    {typeof insight.title === "string"
                      ? insight.title
                      : JSON.stringify(insight.title)}
                  </h4>
                  <p className="text-[10px] text-neutral-500 leading-relaxed line-clamp-2">
                    {typeof insight.description === "string"
                      ? insight.description
                      : JSON.stringify(insight.description)}
                  </p>
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
          onClick={() => setActiveTab("generator")}
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
            <p className="text-[11px] text-neutral-400 font-medium mt-1">
              Food Cost trung bình
            </p>
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
              {recipes
                .reduce((acc, r) => acc + (r.totalCost || 0), 0)
                .toLocaleString()}
            </p>
            <p className="text-[11px] text-neutral-400 font-medium mt-1">
              Giá trị kho hiện tại
            </p>
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
            <p className="text-[10px] text-neutral-400 font-medium">
              AI Vision
            </p>
          </div>
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className="bg-neutral-50 p-5 rounded-3xl flex items-center gap-4 hover:bg-neutral-100 transition-all active:scale-95 group"
        >
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-neutral-900 shadow-sm group-hover:bg-neutral-900 group-hover:text-white transition-all">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-neutral-900">
              Thị trường
            </h3>
            <p className="text-[10px] text-neutral-400 font-medium">Giá sỉ</p>
          </div>
        </button>
      </section>

      {/* Empty State / Welcome Guide */}
      {recipes.length === 0 && !error && (
        <section className="px-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-orange-50/50 border border-dashed border-orange-200 rounded-[2.5rem] p-8 text-center space-y-4"
          >
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <Sparkles className="w-8 h-8 text-orange-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-stone-900">
                Môi trường Thử nghiệm
              </h3>
              <p className="text-sm text-stone-500 max-w-xs mx-auto">
                Database của bạn đang trống. Chúng tôi đang hiển thị{" "}
                <b>Dữ liệu mẫu</b> để bạn khám phá các tính năng của hệ thống.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => handleGenerate("Món khai vị đặc sắc")}
                className="w-full sm:w-auto px-6 py-3 bg-stone-900 text-white rounded-2xl text-xs font-bold hover:bg-stone-800 transition-all active:scale-95"
              >
                Thử tạo công thức AI
              </button>
              <button
                onClick={seedDummyData}
                disabled={isSeeding}
                className="w-full sm:w-auto px-6 py-3 bg-white border border-stone-200 text-stone-600 rounded-2xl text-xs font-bold hover:bg-stone-50 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isSeeding && <Loader2 className="w-3 h-3 animate-spin" />}
                Chuyển dữ liệu mẫu sang Database
              </button>
            </div>
          </motion.div>
        </section>
      )}

      {/* Shopping List */}
      {shoppingList.length > 0 && (
        <section className="px-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-semibold text-neutral-900">
              Đi chợ nhanh
            </h3>
            <button
              onClick={() => setActiveTab("recipes")}
              className="text-[11px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors"
            >
              Xem tất cả
            </button>
          </div>
          <div className="bg-white border border-neutral-100 rounded-3xl p-6">
            <div className="space-y-1">
              {shoppingList?.filter(ing => ing && ing.name).map((ing: any) => (
                <motion.div
                  key={ing.id || Math.random()}
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
                    <span
                      className={cn(
                        "text-sm font-medium transition-all duration-300",
                        ing.completed
                          ? "text-neutral-300 line-through"
                          : "text-neutral-700"
                      )}
                    >
                      {ing.name}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-medium transition-colors",
                      ing.completed ? "text-neutral-200" : "text-neutral-400"
                    )}
                  >
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
                      <div className="flex flex-col">
                        <span className="font-semibold text-neutral-900 text-sm truncate">
                          {recipe.title}
                        </span>
                        {recipe.isSample && (
                          <span className="text-[7px] font-black text-amber-600 uppercase tracking-[0.2em]">
                            Dữ liệu mẫu
                          </span>
                        )}
                      </div>
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
        <OrderAnalysis
          onClose={() => setShowOrderAnalysis(false)}
          preferences={preferences}
        />
      )}
    </motion.div>
  );
}
