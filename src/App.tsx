import { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, User, signInWithPopup, googleProvider, db, doc, getDoc, setDoc, testConnection, handleFirestoreError, OperationType, updateDoc, serverTimestamp } from './lib/firebase';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { RecipeList } from './components/RecipeList';
import { ChefChat } from './components/ChefChat';
import { CreativeAgent } from './components/CreativeAgent';
import { Profile } from './components/Profile';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LogIn, ChefHat, Sparkles, Key, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'recipes' | 'chat' | 'profile' | 'creative'>('dashboard');
  const [preferences, setPreferences] = useState({
    chatUserBubbleColor: 'bg-stone-900',
    chatAiBubbleColor: 'bg-white',
    chatBackground: 'bg-stone-50',
    selectedModelId: 'gemini-flash-latest',
    openaiKey: '',
    anthropicKey: '',
    googleKey: ''
  });
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    testConnection();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              role: 'chef',
              preferences: preferences,
              createdAt: serverTimestamp()
            });
          } else {
            const data = userSnap.data();
            if (data.preferences) {
              setPreferences(prev => ({ ...prev, ...data.preferences }));
              // If no google key, show setup
              if (!data.preferences.googleKey) {
                setShowSetup(true);
              }
            } else {
              setShowSetup(true);
            }
          }
          setUser(user);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updatePreference = async (key: string, value: string) => {
    if (!user) return;
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        preferences: newPrefs
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      let msg = "Đăng nhập thất bại. Vui lòng thử lại.";
      if (error.code === 'auth/operation-not-allowed') {
        msg = "Phương thức đăng nhập này chưa được bật trong Firebase Console.";
      } else if (error.code === 'auth/unauthorized-domain') {
        msg = "Tên miền này chưa được cấp phép trong Firebase Console.";
      } else if (error.message?.includes('requested action is invalid')) {
        msg = "Lỗi cấu hình Firebase (Action Invalid). Vui lòng kiểm tra SHA-1 (cho APK) hoặc Authorized Domains.";
      }
      alert(msg);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <ChefHat className="w-12 h-12 text-orange-600" />
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {!user ? (
        <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-stone-100"
          >
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <ChefHat className="w-10 h-10 text-orange-600" />
            </div>
            <h1 className="text-3xl font-bold text-stone-900 mb-2">SousChef AI</h1>
            <p className="text-stone-600 mb-8">Trợ lý bếp chuyên nghiệp của bạn. Tạo công thức, tính giá cost và tư vấn chuyên gia. (Phiên bản Local)</p>
            <button
              onClick={handleLogin}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-orange-200"
            >
              <ChefHat className="w-5 h-5" />
              Bắt đầu ngay
            </button>
          </motion.div>
        </div>
      ) : (
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
                    <h2 className="text-2xl font-bold text-stone-900">Cấu hình API Key</h2>
                    <p className="text-stone-500 text-sm">Chào mừng Chef! Để bắt đầu sử dụng AI, vui lòng nhập Google Gemini API Key của bạn.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">Google Gemini API Key</label>
                      <input
                        type="password"
                        placeholder="AIza..."
                        value={preferences.googleKey}
                        onChange={(e) => updatePreference('googleKey', e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                      />
                    </div>
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 justify-center"
                    >
                      Lấy API Key miễn phí tại đây <ArrowRight className="w-3 h-3" />
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

          <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && <Dashboard key="dashboard" setActiveTab={setActiveTab} />}
              {activeTab === 'recipes' && <RecipeList key="recipes" />}
              {activeTab === 'creative' && <CreativeAgent key="creative" />}
              {activeTab === 'chat' && <ChefChat key="chat" preferences={preferences} updatePreference={updatePreference} />}
              {activeTab === 'profile' && <Profile key="profile" user={user} preferences={preferences} updatePreference={updatePreference} />}
            </AnimatePresence>
          </Layout>
        </>
      )}
    </ErrorBoundary>
  );
}
