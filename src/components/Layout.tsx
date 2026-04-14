import React from 'react';
import { LayoutDashboard, BookOpen, MessageSquare, User, Palette, ClipboardList, Image as ImageIcon, Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const tabs = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Trang chủ' },
    { id: 'menu', icon: ClipboardList, label: 'Vận hành' },
    { id: 'recipes', icon: BookOpen, label: 'Công thức' },
    { id: 'generator', icon: Wand2, label: 'Sáng tạo' },
    { id: 'creative', icon: Palette, label: 'GemAgent' },
    { id: 'chat', icon: MessageSquare, label: 'Đầu bếp' },
    { id: 'gallery', icon: ImageIcon, label: 'Bộ sưu tập' },
    { id: 'profile', icon: User, label: 'Cá nhân' },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 w-full max-w-lg mx-auto relative pb-32 pt-8">
        <div className="px-4">
          {children}
        </div>
      </main>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md px-6 z-50">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-neutral-100 flex justify-between items-center">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex flex-col items-center justify-center py-3 px-1 rounded-2xl transition-all duration-300 flex-1",
                  isActive ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-600"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="navIndicator"
                    className="absolute inset-0 bg-neutral-50 rounded-2xl"
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                  />
                )}
                <tab.icon className={cn(
                  "w-5 h-5 relative z-10 transition-all duration-300",
                  isActive ? "scale-100" : "scale-90 opacity-70"
                )} />
                <span className={cn(
                  "text-[9px] font-medium tracking-tight relative z-10 transition-all duration-300 mt-1",
                  isActive ? "opacity-100" : "opacity-0 scale-90"
                )}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
