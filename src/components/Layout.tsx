import React from 'react';
import { LayoutDashboard, BookOpen, MessageSquare, User } from 'lucide-react';
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
    { id: 'chat', icon: MessageSquare, label: 'Đầu bếp' },
    { id: 'profile', icon: User, label: 'Cá nhân' },
  ];

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <main className="max-w-md mx-auto min-h-screen relative overflow-hidden">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-stone-200 px-6 py-3 z-50">
        <div className="max-w-md mx-auto flex justify-between items-center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 transition-colors relative",
                activeTab === tab.id ? "text-orange-600" : "text-stone-400"
              )}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -top-3 w-12 h-1 bg-orange-600 rounded-full"
                />
              )}
              <tab.icon className="w-6 h-6" />
              <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
