import { signOut, auth, User } from '../lib/firebase';
import { motion } from 'framer-motion';
import { LogOut, User as UserIcon, Settings, Shield, HelpCircle, ChevronRight, Key } from 'lucide-react';
import { cn } from '../lib/utils';

interface ProfileProps {
  user: User;
}

export function Profile({ user }: ProfileProps) {
  const handleLogout = () => signOut(auth);

  const apiKeys = [
    { name: 'Gemini', status: !!process.env.GEMINI_API_KEY },
    { name: 'OpenAI', status: !!process.env.OPENAI_API_KEY },
    { name: 'Anthropic', status: !!process.env.ANTHROPIC_API_KEY },
  ];

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
      className="p-6 space-y-8"
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

      <div className="bg-white rounded-[2rem] border border-stone-100 shadow-sm p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 flex items-center gap-2">
          <Key className="w-3 h-3" />
          Trạng thái AI
        </h3>
        <div className="flex gap-2">
          {apiKeys.map(key => (
            <div
              key={key.name}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border",
                key.status ? "bg-green-50 border-green-100 text-green-600" : "bg-red-50 border-red-100 text-red-600"
              )}
            >
              {key.name}: {key.status ? 'OK' : 'Thiếu'}
            </div>
          ))}
        </div>
      </div>

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

