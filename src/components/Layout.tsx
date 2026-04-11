import React from 'react';
import { LayoutDashboard, BookOpen, MessageSquare, User, Palette } from 'lucide-react';
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
    { id: 'recipes', icon: BookOpen, label: 'Công thức' },
    { id: 'creative', icon: Palette, label: 'GemAgent' },
    { id: 'chat', icon: MessageSquare, label: 'Đầu bếp' },
    { id: 'profile', icon: User, label: 'Cá nhân' },
  ];

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col pt-[env(safe-area-inset-top)]">
      <main className="flex-1 w-full max-w-lg mx-auto relative pb-24 md:pb-8 md:pt-6">
        <div className="px-4 sm:px-6">
          {children}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-stone-200/50 px-6 py-4 z-50 md:sticky md:top-[calc(100vh-80px)] md:bg-white/90 md:rounded-full md:max-w-md md:mx-auto md:mb-6 md:shadow-xl md:border md:border-stone-100">
        <div className="flex justify-between items-center max-w-md mx-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 transition-all duration-300 relative group",
                activeTab === tab.id ? "text-stone-900 scale-110" : "text-stone-400 hover:text-stone-600"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl transition-all duration-300",
                activeTab === tab.id ? "bg-stone-100" : "bg-transparent group-hover:bg-stone-50"
              )}>
                <tab.icon className={cn("w-5 h-5 transition-transform", activeTab === tab.id && "scale-110")} />
              </div>
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-[0.1em] transition-opacity",
                activeTab === tab.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}>
                {tab.label}
              </span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute -bottom-1 w-1 h-1 bg-stone-900 rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
