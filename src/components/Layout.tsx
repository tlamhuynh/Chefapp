import React from 'react';
import { LayoutDashboard, BookOpen, MessageSquare, User, Sparkles, ClipboardList, Image as ImageIcon, Wand2, Terminal, Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { LogoText } from './Logo';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  preferences: any;
  updatePreference: (key: string, value: any) => void;
}

export function Layout({ children, activeTab, setActiveTab, preferences, updatePreference }: LayoutProps) {
  const isActiveProfile = activeTab === 'profile';
  const tabs = [
    // ...
    { id: 'dashboard', icon: LayoutDashboard, label: 'Trang chủ' },
    { id: 'menu', icon: ClipboardList, label: 'Vận hành' },
    { id: 'recipes', icon: BookOpen, label: 'Công thức' },
    { id: 'generator', icon: Wand2, label: 'Sáng tạo' },
    { id: 'creative', icon: Sparkles, label: 'GemAgent' },
    { id: 'chat', icon: MessageSquare, label: 'Đầu bếp' },
    { id: 'gallery', icon: ImageIcon, label: 'Bộ sưu tập' },
    { id: 'debug', icon: Terminal, label: 'Debug' },
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
    <div className={cn(
      "bg-neutral-50/50 dark:bg-neutral-950 flex flex-col overflow-x-hidden transition-colors duration-300", 
      activeTab === 'chat' ? "h-screen overflow-hidden" : "min-h-screen"
    )}>
      <header className="fixed top-0 left-0 right-0 h-20 bg-white/40 dark:bg-neutral-950/40 backdrop-blur-xl z-40 flex items-center px-8 border-b border-transparent dark:border-white/5 transition-all">
        <div className="w-full max-w-7xl mx-auto flex justify-between items-center">
          <LogoText />
          <div className="flex items-center gap-4">
            <button
               onClick={() => updatePreference('darkMode', !preferences.darkMode)}
               className="w-10 h-10 rounded-full border border-neutral-200 dark:border-white/10 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-white/5 transition-all"
            >
               {preferences.darkMode ? <Sun className="w-4 h-4 text-emerald-400" /> : <Moon className="w-4 h-4 text-neutral-400" />}
            </button>

            <div className="flex items-center gap-2 px-3 py-1 bg-neutral-100 dark:bg-white/5 rounded-full">
              <div className="w-1.5 h-1.5 bg-neutral-900 dark:bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Active</span>
            </div>
            <button 
              onClick={() => setActiveTab('profile')}
              className={cn(
                "w-10 h-10 rounded-full border transition-all flex items-center justify-center",
                isActiveProfile ? "bg-neutral-900 dark:bg-white border-neutral-900 dark:border-white text-white dark:text-neutral-900" : "border-neutral-200 dark:border-white/10 hover:bg-neutral-900 dark:hover:bg-white hover:text-white dark:hover:text-neutral-900"
              )}
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main 
        className={cn(
          "flex-1 w-full max-w-7xl mx-auto relative pt-20",
          activeTab === 'chat' ? "pb-16 h-full flex flex-col" : "pb-24"
        )}
      >
        <div className={cn("px-4 md:px-12", activeTab === 'chat' ? "flex-1 h-full min-h-0" : "h-full")}>
          {children}
        </div>
      </main>

      <nav className="fixed bottom-2 md:bottom-4 left-0 right-0 md:left-1/2 md:-translate-x-1/2 w-full md:max-w-xl px-4 md:px-0 z-50">
        <div className="bg-neutral-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl md:rounded-[2rem] p-1 luxury-shadow flex justify-between items-center">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            // Hide debug and profile in main nav for cleaner look
            if (tab.id === 'debug' || tab.id === 'profile') return null;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center justify-center py-2 md:py-2.5 px-1 rounded-full transition-all duration-500 flex-1 group",
                  isActive ? "text-white" : "text-neutral-500 hover:text-neutral-300"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="navIndicator"
                    className="absolute inset-0 bg-white/10 rounded-full"
                    transition={{ type: "spring", bounce: 0.1, duration: 0.6 }}
                  />
                )}
                <div className="flex flex-col items-center gap-0.5 relative z-10">
                  <tab.icon className={cn(
                    "w-4 h-4 md:w-4.5 md:h-4.5 transition-all duration-500",
                    isActive ? "scale-110" : "group-hover:scale-105"
                  )} />
                  <span className={cn(
                    "text-[7px] md:text-[8px] font-bold uppercase tracking-widest transition-all duration-500",
                    isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                  )}>
                    {tab.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </nav>
      <div className="fixed inset-0 pointer-events-none border-[12px] border-white dark:border-neutral-950 z-30 transition-colors duration-300" />
    </div>
  );
}
