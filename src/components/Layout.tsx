import React from 'react';
import { LayoutDashboard, BookOpen, MessageSquare, User, Palette, ClipboardList, Image as ImageIcon, Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { LogoText } from './Logo';

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

  const handleDragEnd = (event: any, info: any) => {
    const swipeThreshold = 50;
    const currentIndex = tabs.findIndex(t => t.id === activeTab);
    
    if (info.offset.x > swipeThreshold) {
      // Swipe Right -> Previous Tab
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      setActiveTab(tabs[prevIndex].id);
    } else if (info.offset.x < -swipeThreshold) {
      // Swipe Left -> Next Tab
      const nextIndex = (currentIndex + 1) % tabs.length;
      setActiveTab(tabs[nextIndex].id);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-neutral-100 z-40 flex items-center px-6">
        <div className="w-full max-w-7xl mx-auto flex justify-between items-center">
          <LogoText />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Live</span>
          </div>
        </div>
      </header>

      <motion.main 
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        className="flex-1 w-full max-w-7xl mx-auto relative pb-24 md:pb-32 pt-16 md:pt-20 cursor-grab active:cursor-grabbing"
      >
        <div className="px-2 md:px-6 h-full pointer-events-auto">
          {children}
        </div>
      </motion.main>

      <nav className="fixed bottom-0 left-0 right-0 w-full z-50 md:bottom-8 md:left-1/2 md:-translate-x-1/2 md:max-w-2xl md:px-6">
        <div className="bg-white/90 backdrop-blur-xl border-t border-neutral-100 md:border md:rounded-3xl p-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] md:shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex justify-between items-center px-4 md:px-1.5">
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
