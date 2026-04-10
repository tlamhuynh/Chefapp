import { signOut, auth, User } from '../lib/firebase';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, User as UserIcon, Settings, Shield, HelpCircle, ChevronRight, Database, Download, Cloud, Check, AlertCircle, Loader2 } from 'lucide-react';
import { LocalDb } from '../lib/localDb';
import { cn } from '../lib/utils';

interface ProfileProps {
  user: User;
}

export function Profile({ user }: ProfileProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showBackupSuccess, setShowBackupSuccess] = useState(false);

  const handleLogout = () => signOut(auth);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await LocalDb.exportAllData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `souschef_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCloudBackup = async () => {
    setIsExporting(true);
    // Simulate cloud backup to Drive
    setTimeout(() => {
      setIsExporting(false);
      setShowBackupSuccess(true);
      setTimeout(() => setShowBackupSuccess(false), 3000);
    }, 2000);
  };

  const menuItems = [
    { icon: Settings, label: 'Cài đặt bếp', color: 'text-stone-600' },
    { icon: Shield, label: 'Quyền riêng tư & Bảo mật', color: 'text-stone-600' },
    { icon: HelpCircle, label: 'Trung tâm hỗ trợ', color: 'text-stone-600' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-6 space-y-8 pb-12"
    >
      <header className="text-center space-y-4">
        <div className="relative inline-block">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || ''} className="w-24 h-24 rounded-[2rem] border-4 border-white shadow-xl mx-auto" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-24 h-24 bg-orange-100 rounded-[2rem] flex items-center justify-center mx-auto border-4 border-white shadow-xl">
              <UserIcon className="w-10 h-10 text-orange-600" />
            </div>
          )}
          <div className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 rounded-full border-4 border-white shadow-sm" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-stone-900">{user.displayName}</h2>
          <p className="text-stone-500 text-sm">{user.email}</p>
        </div>
        <div className="inline-block bg-stone-900 text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
          Bếp trưởng điều hành
        </div>
      </header>

      {/* Backup & Data Knowledge Section */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 px-2">Dữ liệu & NotebookLM</h3>
        <div className="bg-white rounded-[2rem] border border-stone-100 shadow-sm overflow-hidden">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full p-5 flex items-center justify-between hover:bg-stone-50 transition-colors border-b border-stone-50 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors">
                <Download className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <span className="font-semibold text-stone-800 block">Xuất dữ liệu Knowledge</span>
                <span className="text-[10px] text-stone-400">Dùng cho NotebookLM (JSON/Markdown)</span>
              </div>
            </div>
            {isExporting ? <Loader2 className="w-5 h-5 text-stone-300 animate-spin" /> : <ChevronRight className="w-5 h-5 text-stone-300" />}
          </button>

          <button
            onClick={handleCloudBackup}
            disabled={isExporting}
            className="w-full p-5 flex items-center justify-between hover:bg-stone-50 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors">
                <Cloud className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <span className="font-semibold text-stone-800 block">Sao lưu Google Drive</span>
                <span className="text-[10px] text-stone-400">Tự động push định kỳ 24h</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AnimatePresence>
                {showBackupSuccess && (
                  <motion.span
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="text-[10px] text-green-600 font-bold"
                  >
                    Thành công!
                  </motion.span>
                )}
              </AnimatePresence>
              <ChevronRight className="w-5 h-5 text-stone-300" />
            </div>
          </button>
        </div>
      </section>

      <div className="bg-white rounded-[2rem] border border-stone-100 shadow-sm overflow-hidden">
        {menuItems.map((item, i) => (
          <button
            key={i}
            className="w-full p-5 flex items-center justify-between hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors">
                <item.icon className={cn("w-5 h-5", item.color)} />
              </div>
              <span className="font-semibold text-stone-800">{item.label}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-stone-300" />
          </button>
        ))}
      </div>

      <button
        onClick={handleLogout}
        className="w-full bg-red-50 text-red-600 font-bold py-5 rounded-[2rem] flex items-center justify-center gap-3 hover:bg-red-100 transition-all active:scale-95"
      >
        <LogOut className="w-5 h-5" />
        Đăng xuất
      </button>

      <footer className="text-center pt-8">
        <p className="text-[10px] text-stone-400 uppercase tracking-widest">SousChef AI v1.0.0</p>
      </footer>
    </motion.div>
  );
}
