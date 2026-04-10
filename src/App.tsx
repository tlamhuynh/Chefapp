import { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, User, signInWithPopup, googleProvider, db, doc, getDoc, setDoc, testConnection, handleFirestoreError, OperationType } from './lib/firebase';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { RecipeList } from './components/RecipeList';
import { ChefChat } from './components/ChefChat';
import { Profile } from './components/Profile';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LogIn, ChefHat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'recipes' | 'chat' | 'profile'>('dashboard');

  useEffect(() => {
    testConnection();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Check if user exists in Firestore, if not create
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              role: 'chef'
            });
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
        <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && <Dashboard key="dashboard" setActiveTab={setActiveTab} />}
            {activeTab === 'recipes' && <RecipeList key="recipes" />}
            {activeTab === 'chat' && <ChefChat key="chat" />}
            {activeTab === 'profile' && <Profile key="profile" user={user} />}
          </AnimatePresence>
        </Layout>
      )}
    </ErrorBoundary>
  );
}
