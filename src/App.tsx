import { useState, useEffect, Suspense, lazy } from "react";
import {
  auth,
  onAuthStateChanged,
  User,
  signInWithPopup,
  googleProvider,
  db,
  doc,
  getDoc,
  setDoc,
  testConnection,
  handleFirestoreError,
  OperationType,
  updateDoc,
  serverTimestamp,
} from "./lib/firebase";
import { Layout } from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import {
  LogIn,
  ChefHat,
  Sparkles,
  Key,
  ArrowRight,
  Loader2,
  AlertTriangle,
  RefreshCcw,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo, LogoText } from "./components/Logo";
import { performAutoBackup } from "./hooks/useDriveBackup";
import { cn } from "./lib/utils";

// Lazy load feature components to reduce initial bundle size for production
const Dashboard = lazy(() =>
  import("./components/Dashboard").then((m) => ({ default: m.Dashboard }))
);
const RecipeList = lazy(() =>
  import("./components/RecipeList").then((m) => ({ default: m.RecipeList }))
);
const MenuManagement = lazy(() =>
  import("./components/MenuManagement").then((m) => ({
    default: m.MenuManagement,
  }))
);
const ChefChat = lazy(() =>
  import("./components/ChefChat").then((m) => ({ default: m.ChefChat }))
);
const RecipeGenerator = lazy(() =>
  import("./components/RecipeGenerator").then((m) => ({
    default: m.RecipeGenerator,
  }))
);
const CreativeAgent = lazy(() =>
  import("./components/CreativeAgent").then((m) => ({
    default: m.CreativeAgent,
  }))
);
const Profile = lazy(() =>
  import("./components/Profile").then((m) => ({ default: m.Profile }))
);
const Gallery = lazy(() =>
  import("./components/Gallery").then((m) => ({ default: m.Gallery }))
);
const DebugLog = lazy(() =>
  import("./components/DebugLog").then((m) => ({ default: m.DebugLog }))
);

const LoadingSpinner = () => (
  <div className="w-full h-[60vh] flex flex-col items-center justify-center gap-4 text-stone-400">
    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
    <span className="text-sm font-medium animate-pulse">
      Đang nạp dữ liệu phân hệ...
    </span>
  </div>
);

function AppContent() {
  // states for app state
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [initializationError, setInitializationError] = useState<Error | null>(
    null
  );
  const [creativeActiveId, setCreativeActiveId] = useState<string | null>(
    localStorage.getItem("last_creative_conv_id")
  );
  const [generatorState, setGeneratorState] = useState<any>({
    theme: "",
    ingredients: [],
    difficulty: "medium",
    generatedRecipe: null,
    chatHistory: [],
    monologue: [],
  });
  const [backgroundAnalysisResult, setBackgroundAnalysisResult] = useState<{
    result: any;
    isInvoice: boolean;
  } | null>(null);

  // states for tabs and preferences
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "menu"
    | "recipes"
    | "chat"
    | "profile"
    | "creative"
    | "gallery"
    | "generator"
    | "debug"
  >("dashboard");

  // Handle cross-reload triggers
  useEffect(() => {
    try {
      const trigger = sessionStorage.getItem('trigger_open_settings');
      if (trigger === 'true') {
        setActiveTab('profile');
        // Do NOT remove yet, let Profile.tsx handle the sub-modal
      }
    } catch (e) {}
  }, []);

  const [preferences, setPreferences] = useState({
    chatUserBubbleColor: "bg-stone-900",
    chatAiBubbleColor: "bg-white",
    chatBackground: "bg-stone-50",
    selectedModelId: "groq/llama-3.1-8b-instant",
    showInternalThoughts: true,
    darkMode: false,
    openaiKey: "",
    anthropicKey: "",
    googleKey: "",
    openrouterKey: "",
    nvidiaKey: "",
    GroqKey: "",
    autoBackup: false,
  });

  // Effects
  useEffect(() => {
    if (creativeActiveId) {
      localStorage.setItem("last_creative_conv_id", creativeActiveId);
    } else {
      localStorage.removeItem("last_creative_conv_id");
    }
  }, [creativeActiveId]);

  // Auto Backup functionality disabled as it relied on Supabase real-time

  // Initialize preferences with autoBackup
  useEffect(() => {
    setPreferences((prev) => ({
      ...prev,
      autoBackup: localStorage.getItem("auto_backup_enabled") === "true",
    }));
  }, []);

  useEffect(() => {
    const initApp = async () => {
      const startTime = Date.now();
      try {
        // Đợi database phản hồi thực sự
        const connected = await testConnection();
        setIsDatabaseReady(connected);
        if (!connected) {
          console.warn("Could not connect to database at startup, but proceeding to auth anyway");
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          try {
            if (user) {
              const userRef = doc(db, "users", user.uid);
              const userSnap = await getDoc(userRef);
              if (!userSnap.exists()) {
                await setDoc(userRef, {
                  uid: user.uid,
                  email: user.email,
                  displayName: user.displayName,
                  photoURL: user.photoURL,
                  role: "chef",
                  preferences: preferences,
                  createdAt: serverTimestamp(),
                });
              } else {
                const data = userSnap.data();
                if (data?.preferences) {
                  let userPrefs = data.preferences;

                  // MIGRATION: Switch users off gemini to groq if they use the default
                  if (
                    userPrefs.selectedModelId &&
                    userPrefs.selectedModelId.startsWith("gemini")
                  ) {
                    userPrefs.selectedModelId = "groq/llama-3.1-8b-instant";
                    try {
                      updateDoc(userRef, {
                        "preferences.selectedModelId":
                          "groq/llama-3.1-8b-instant",
                      });
                    } catch (e) {}
                  }

                  setPreferences((prev) => ({ ...prev, ...userPrefs }));
                  if (
                    !userPrefs.googleKey &&
                    !userPrefs.groqKey &&
                    !userPrefs.openrouterKey &&
                    !userPrefs.nvidiaKey
                  ) {
                    setShowSetup(true);
                  }
                } else {
                  setShowSetup(true);
                }
              }
              setUser(user);
            } else {
              setUser(null);
            }
          } catch (error: any) {
            handleFirestoreError(
              error,
              OperationType.GET,
              `users/${user?.uid || "unknown"}`
            );
            // Ignore error and still set user to allow app entry
            if (auth.currentUser) setUser(auth.currentUser);
          } finally {
            // Đảm bảo splascreen hiện ít nhất 1.2s để tránh flicker
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 1200 - elapsed);
            setTimeout(() => {
              setLoading(false);
            }, remaining);
          }
        });
        return unsubscribe;
      } catch (err: any) {
        console.error("Initialization error:", err);
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 1200 - elapsed);
        setTimeout(() => {
          setLoading(false);
        }, remaining);
        return () => {};
      }
    };

    let unsubscribeFn: (() => void) | undefined;
    initApp().then((unsub) => {
      if (unsub) unsubscribeFn = unsub;
    });

    return () => {
      if (unsubscribeFn) unsubscribeFn();
    };
  }, []);

  const [globalNotif, setGlobalNotif] = useState<string | null>(null);

  useEffect(() => {
    const handleModelFallback = (e: any) => {
      const { originalModel, fallbackModel } = e.detail;
      setGlobalNotif(
        `Nhận diện hình ảnh không khả dụng trên ${originalModel}. Tự động chuyển sang model dự phòng ${
          fallbackModel || ""
        } để hoàn thành tác vụ.`
      );
      setTimeout(() => setGlobalNotif(null), 8000);
    };
    window.addEventListener("ai-model-fallback", handleModelFallback);
    return () =>
      window.removeEventListener("ai-model-fallback", handleModelFallback);
  }, []);

  const updatePreference = async (key: string, value: any) => {
    if (!user) return;
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        preferences: newPrefs,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleLogin = async () => {
    try {
      const { signInWithGoogleDeviceAware } = await import("./lib/auth-native");
      await signInWithGoogleDeviceAware();
    } catch (error: any) {
      console.error("Login failed", error);
      let msg = "Đăng nhập thất bại. Vui lòng thử lại.";
      if (error.code === "auth/operation-not-allowed") {
        msg = "Phương thức đăng nhập này chưa được bật trong Firebase Console.";
      } else if (error.code === "auth/unauthorized-domain") {
        msg = "Tên miền này chưa được cấp phép trong Firebase Console.";
      } else if (error.message?.includes("requested action is invalid")) {
        msg =
          "Lỗi cấu hình Firebase. Vui lòng kiểm tra SHA-1 (cho APK) hoặc Authorized Domains.";
      } else if (error.message?.includes("DEVELOPER_WARNING")) {
        msg =
          "Lỗi cấu hình API Google (Developer Warning). Vui lòng kiểm tra SHA-1 trên Firebase đã đúng với file APK chứa trong debug.keystore chưa.";
      }
      alert(msg);
    }
  };

  useEffect(() => {
    if (preferences.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [preferences.darkMode]);

  if (loading || !isDatabaseReady) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="p-4 rounded-3xl bg-orange-50"
          >
            <Logo size={48} />
          </motion.div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-stone-900">SousChef AI</h2>
            <p className="text-sm text-stone-500 leading-relaxed animate-pulse">
              Đang nạp dữ liệu và kiểm tra kết nối an toàn...
            </p>
          </div>

          <div className="flex items-center gap-2 mt-4 px-3 py-1 bg-white border border-stone-200 rounded-full shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-emerald-500" />
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
              Connecting to Core...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-stone-100"
        >
          <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Logo size={48} />
          </div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2">
            SousChef AI
          </h1>
          <p className="text-stone-600 mb-8">
            Trợ lý bếp chuyên nghiệp của bạn. Tạo công thức, tính giá cost và tư
            vấn chuyên gia.
          </p>
          <button
            onClick={handleLogin}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-orange-200"
          >
            <Logo size={20} variant="white" />
            Bắt đầu ngay
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showSetup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl space-y-6"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto">
                <Key className="w-8 h-8 text-blue-600" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-stone-900">
                  Cấu hình API Key
                </h2>
                <p className="text-stone-500 text-sm">
                  Chào mừng Chef! Để bắt đầu sử dụng AI, vui lòng nhập Google
                  Gemini API Key của bạn.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">
                    Google Gemini API Key
                  </label>
                  <input
                    type="password"
                    placeholder="AIza..."
                    value={preferences.googleKey}
                    onChange={(e) =>
                      updatePreference("googleKey", e.target.value)
                    }
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  />
                </div>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 justify-center"
                >
                  Lấy API Key miễn phí tại đây{" "}
                  <ArrowRight className="w-3 h-3" />
                </a>
              </div>

              <button
                onClick={() => {
                  if (preferences.googleKey) setShowSetup(false);
                }}
                disabled={!preferences.googleKey}
                className="w-full bg-stone-900 text-white font-bold py-4 rounded-2xl hover:bg-stone-800 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
              >
                Tiếp tục vào bếp
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Layout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        preferences={preferences}
        updatePreference={updatePreference}
        onAnalysisComplete={(result, isInvoice) => {
          setBackgroundAnalysisResult({ result, isInvoice });
          // Tự động chuyển sang tab vận hành nếu đang ở tab khác
          if (activeTab !== "menu") setActiveTab("menu");
        }}
      >
        <AnimatePresence>
          {globalNotif && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-6 left-0 right-0 z-[200] flex justify-center px-4 pointer-events-none"
            >
              <div className="bg-blue-900 border border-blue-700 text-white max-w-lg w-full px-5 py-4 rounded-3xl flex items-start gap-3 shadow-2xl shadow-blue-900/20 pointer-events-auto">
                <Sparkles className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium leading-relaxed">
                    {globalNotif}
                  </p>
                </div>
                <button
                  onClick={() => setGlobalNotif(null)}
                  className="p-1.5 hover:bg-white/10 rounded-full text-blue-200 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <ErrorBoundary 
              name={activeTab} 
              fallback={
                <div className="flex flex-col items-center justify-center h-full p-10 text-center space-y-4">
                  <div className="p-4 bg-orange-50 rounded-2xl text-orange-600">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-stone-900 capitalize">Phân hệ {activeTab} tạm lỗi</h3>
                  <p className="text-stone-500 text-sm max-w-xs">Có vẻ như dữ liệu mô hình AI phản hồi không đúng định dạng. Hãy thử chuyển sang phân hệ khác hoặc làm mới trang.</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-stone-900 text-white rounded-xl text-xs font-bold"
                  >
                    Làm mới trang
                  </button>
                </div>
              }
            >
              <Suspense fallback={<LoadingSpinner />}>
                {activeTab === "dashboard" && (
                  <Dashboard
                    setActiveTab={setActiveTab}
                    preferences={preferences}
                    updatePreference={updatePreference}
                  />
                )}
                {activeTab === "menu" && (
                  <MenuManagement
                    setActiveTab={setActiveTab}
                    preferences={preferences}
                    updatePreference={updatePreference}
                    backgroundAnalysisResult={backgroundAnalysisResult}
                    onBackgroundResultProcessed={() =>
                      setBackgroundAnalysisResult(null)
                    }
                  />
                )}
                {activeTab === "recipes" && <RecipeList />}
                {activeTab === "generator" && (
                  <RecipeGenerator
                    preferences={preferences}
                    updatePreference={updatePreference}
                    setActiveTab={setActiveTab}
                    persistedState={generatorState}
                    setPersistedState={setGeneratorState}
                  />
                )}
                {activeTab === "creative" && (
                  <CreativeAgent
                    preferences={preferences}
                    updatePreference={updatePreference}
                    setActiveTab={setActiveTab}
                    activeConversationId={creativeActiveId}
                    setActiveConversationId={(id: string | null) => {
                      setCreativeActiveId(id);
                      if (id) localStorage.setItem("last_creative_conv_id", id);
                      else localStorage.removeItem("last_creative_conv_id");
                    }}
                  />
                )}
                {activeTab === "chat" && (
                  <ChefChat
                    preferences={preferences}
                    updatePreference={updatePreference}
                    setActiveTab={setActiveTab}
                  />
                )}
                {activeTab === "gallery" && <Gallery />}
                {activeTab === "debug" && <DebugLog />}
                {activeTab === "profile" && (
                  <Profile
                    user={user}
                    preferences={preferences}
                    updatePreference={updatePreference}
                  />
                )}
              </Suspense>
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </Layout>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
