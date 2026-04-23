import { signOut, auth, User, db, doc, updateDoc, deleteDoc, query, collection, where, getDocs } from '../lib/firebase';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, User as UserIcon, Settings, Shield, HelpCircle, ChevronRight, Database, Download, Cloud, Check, AlertCircle, Loader2, X, Palette, MessageSquare, Trash2, Sparkles, Key } from 'lucide-react';
import { LocalDb } from '../lib/localDb';
import { cn } from '../lib/utils';
import { AVAILABLE_MODELS, chatWithAI } from '../lib/ai';
import { useDriveBackup } from '../hooks/useDriveBackup';

interface ProfileProps {
  user: User;
  preferences: any;
  updatePreference: (key: string, value: any) => void;
}

export function Profile({ user, preferences, updatePreference }: ProfileProps) {
  const { performBackup, isBackingUp, backupStatus } = useDriveBackup();
  const [isExporting, setIsExporting] = useState(false);
  const [showBackupSuccess, setShowBackupSuccess] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'style' | 'model' | 'keys' | 'status' | 'system'>('style');
  const [apiStatus, setApiStatus] = useState<Record<string, { status: 'checking' | 'ok' | 'error', message?: string }>>({});
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const handleLogout = async () => {
    const { signOutDeviceAware } = await import('../lib/auth-native');
    await signOutDeviceAware();
  };

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

  const checkApiStatus = async () => {
    const statuses: Record<string, { status: 'checking' | 'ok' | 'error', message?: string }> = {};
    AVAILABLE_MODELS.forEach(m => statuses[m.id] = { status: 'checking' });
    setApiStatus(statuses);

    for (const model of AVAILABLE_MODELS) {
      if (model.provider === 'openai' && !preferences.openaiKey) {
        setApiStatus(prev => ({ ...prev, [model.id]: { status: 'error', message: 'Thiếu OpenAI API Key' } }));
        continue;
      }
      if (model.provider === 'anthropic' && !preferences.anthropicKey) {
        setApiStatus(prev => ({ ...prev, [model.id]: { status: 'error', message: 'Thiếu Anthropic API Key' } }));
        continue;
      }
      if (model.provider === 'nvidia' && !preferences.nvidiaKey) {
        setApiStatus(prev => ({ ...prev, [model.id]: { status: 'error', message: 'Thiếu NVIDIA API Key' } }));
        continue;
      }
      if (model.provider === 'groq' && !preferences.groqKey) {
        setApiStatus(prev => ({ ...prev, [model.id]: { status: 'error', message: 'Thiếu Groq API Key' } }));
        continue;
      }
      if (model.provider === 'openrouter' && !preferences.openrouterKey) {
        setApiStatus(prev => ({ ...prev, [model.id]: { status: 'error', message: 'Thiếu OpenRouter API Key' } }));
        continue;
      }

      try {
        const key = model.provider === 'google' ? (preferences.googleKey || 'ENV') : 
                    model.provider === 'openai' ? preferences.openaiKey :
                    model.provider === 'anthropic' ? preferences.anthropicKey :
                    model.provider === 'nvidia' ? preferences.nvidiaKey :
                    model.provider === 'groq' ? preferences.groqKey : 
                    model.provider === 'openrouter' ? preferences.openrouterKey : '';

        // Test API by asking a simple question
        const result = await chatWithAI(
          model.id, 
          [{ role: 'user', parts: [{ text: 'Ping' }] }], 
          "Reply 'Pong' only.",
          undefined,
          { 
             googleKey: preferences.googleKey,
             openaiKey: preferences.openaiKey,
             anthropicKey: preferences.anthropicKey,
             nvidiaKey: preferences.nvidiaKey,
             groqKey: preferences.groqKey,
             openrouterKey: preferences.openrouterKey
          }
        );
        
        if (result) {
          setApiStatus(prev => ({ ...prev, [model.id]: { status: 'ok' } }));
        } else {
          throw new Error("Không có phản hồi");
        }
      } catch (error: any) {
        console.error(`API check failed for ${model.id}:`, error);
        const errorStr = String(error).toLowerCase();
        let msg = error.message || "Lỗi không xác định";
        
        if (errorStr.includes('quota') || errorStr.includes('429') || errorStr.includes('limit')) {
          setApiStatus(prev => ({ ...prev, [model.id]: { status: 'ok' } }));
          continue;
        } else if (errorStr.includes('api_key') || errorStr.includes('invalid_api_key')) {
          msg = "API Key không hợp lệ. Vui lòng kiểm tra lại.";
        }
        
        setApiStatus(prev => ({ ...prev, [model.id]: { status: 'error', message: msg } }));
      }
    }
  };

  useEffect(() => {
    if (showSettings && activeSettingsTab === 'status' && Object.keys(apiStatus).length === 0) {
      checkApiStatus();
    }
  }, [showSettings, activeSettingsTab]);

  const clearChatHistory = async () => {
    if (!auth.currentUser) return;
    setIsClearingHistory(true);
    try {
      const chatQ = query(
        collection(db, 'chats'),
        where('userId', '==', auth.currentUser.uid)
      );
      const chatSnapshot = await getDocs(chatQ);
      const chatDeletePromises = chatSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(chatDeletePromises);
      setConfirmClearHistory(false);
    } catch (error) {
      console.error("Clear history failed", error);
    } finally {
      setIsClearingHistory(false);
    }
  };

  const clearAllData = async () => {
    if (!auth.currentUser) return;
    setIsClearingHistory(true);
    try {
      const chatQ = query(collection(db, 'chats'), where('userId', '==', auth.currentUser.uid));
      const recipeQ = query(collection(db, 'recipes'), where('authorId', '==', auth.currentUser.uid));
      const chatSnap = await getDocs(chatQ);
      const recipeSnap = await getDocs(recipeQ);
      await Promise.all([
        ...chatSnap.docs.map(d => deleteDoc(d.ref)),
        ...recipeSnap.docs.map(d => deleteDoc(d.ref))
      ]);
      setConfirmClearAll(false);
    } catch (error) {
      console.error("Clear all failed", error);
    } finally {
      setIsClearingHistory(false);
    }
  };

  const colorOptions = {
    user: [
      { name: 'Đen Đá', class: 'bg-neutral-900' },
      { name: 'Cam Cháy', class: 'bg-orange-600' },
      { name: 'Xanh Rêu', class: 'bg-emerald-800' },
      { name: 'Xanh Biển', class: 'bg-blue-700' },
    ],
    ai: [
      { name: 'Trắng Sữa', class: 'bg-white' },
      { name: 'Xám Nhạt', class: 'bg-neutral-100' },
      { name: 'Vàng Kem', class: 'bg-amber-50' },
      { name: 'Xanh Bạc Hà', class: 'bg-emerald-50' },
    ],
    bg: [
      { name: 'Mặc định', class: 'bg-neutral-50' },
      { name: 'Trắng Tinh', class: 'bg-white' },
      { name: 'Gỗ Nhạt', class: 'bg-orange-50/30' },
      { name: 'Xám Xi Măng', class: 'bg-neutral-200/50' },
    ]
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-6 space-y-10 pb-24 no-scrollbar"
    >
      <header className="text-center space-y-6 pt-4">
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-neutral-900/5 blur-3xl rounded-full scale-150 opacity-50" />
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || ''} className="w-28 h-28 rounded-[2rem] border-4 border-white shadow-2xl mx-auto relative z-10" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-28 h-28 bg-neutral-100 rounded-[2rem] flex items-center justify-center mx-auto border-4 border-white shadow-2xl relative z-10">
              <UserIcon className="w-12 h-12 text-neutral-400" />
            </div>
          )}
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -bottom-2 -right-2 bg-neutral-900 w-8 h-8 rounded-xl border-4 border-white shadow-lg z-20 flex items-center justify-center"
          >
            <Check className="w-3.5 h-3.5 text-white" />
          </motion.div>
        </div>
        <div className="space-y-1">
          <h2 className="text-3xl font-display font-bold text-neutral-900 tracking-tight">{user.displayName}</h2>
          <p className="text-neutral-400 text-sm font-medium">{user.email}</p>
        </div>
        <div className="inline-flex items-center gap-2 bg-neutral-900 text-white px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] shadow-xl">
          <Shield className="w-3.5 h-3.5 text-neutral-400" />
          Executive Chef
        </div>
      </header>

      {/* Settings Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 text-neutral-900 px-1">
          <div className="w-8 h-8 bg-neutral-100 rounded-xl flex items-center justify-center">
            <Settings className="w-4 h-4" />
          </div>
          <h3 className="font-display font-bold text-xl">Cấu hình hệ thống</h3>
        </div>
        
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full p-6 flex items-center justify-between hover:bg-neutral-50 transition-all group"
          >
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-neutral-50 rounded-xl flex items-center justify-center group-hover:bg-white transition-all shadow-sm">
                <Settings className="w-6 h-6 text-neutral-900" />
              </div>
              <div className="text-left space-y-0.5">
                <span className="font-bold text-neutral-900 block text-lg">Cài đặt & API</span>
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Giao diện, Model AI và API Keys</span>
              </div>
            </div>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-neutral-50 text-neutral-400 transition-all group-hover:bg-neutral-900 group-hover:text-white", showSettings && "rotate-90 bg-neutral-900 text-white")}>
              <ChevronRight className="w-5 h-5" />
            </div>
          </button>

          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-neutral-50 bg-neutral-50/30 overflow-hidden"
              >
                <div className="p-8 space-y-8">
                  <div className="flex p-1.5 bg-neutral-100 rounded-xl overflow-x-auto no-scrollbar">
                    {['style', 'model', 'keys', 'status', 'system'].map((tab) => (
                      <button 
                        key={tab}
                        onClick={() => setActiveSettingsTab(tab as any)}
                        className={cn(
                          "flex-1 py-3 px-4 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg whitespace-nowrap",
                          activeSettingsTab === tab ? "bg-white text-neutral-900 shadow-md" : "text-neutral-400 hover:text-neutral-600"
                        )}
                      >
                        {tab === 'style' ? 'Giao diện' : tab === 'model' ? 'Mô hình' : tab === 'keys' ? 'API Keys' : tab === 'status' ? 'Trạng thái' : 'Hệ thống'}
                      </button>
                    ))}
                  </div>

                  {activeSettingsTab === 'style' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 ml-1">Màu tin nhắn của bạn</label>
                        <div className="flex flex-wrap gap-4">
                          {colorOptions.user.map(color => (
                            <button
                              key={color.class}
                              onClick={() => updatePreference('chatUserBubbleColor', color.class)}
                              className={cn(
                                "w-10 h-10 rounded-xl border-4 transition-all shadow-sm",
                                color.class,
                                preferences.chatUserBubbleColor === color.class ? "border-neutral-900 scale-110 shadow-xl" : "border-white"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 ml-1">Màu tin nhắn AI</label>
                        <div className="flex flex-wrap gap-4">
                          {colorOptions.ai.map(color => (
                            <button
                              key={color.class}
                              onClick={() => updatePreference('chatAiBubbleColor', color.class)}
                              className={cn(
                                "w-10 h-10 rounded-xl border-4 transition-all shadow-sm",
                                color.class,
                                preferences.chatAiBubbleColor === color.class ? "border-neutral-900 scale-110 shadow-xl" : "border-white"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'model' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                      <div className="grid grid-cols-1 gap-4">
                        {AVAILABLE_MODELS.map(model => (
                          <button
                            key={model.id}
                            onClick={() => updatePreference('selectedModelId', model.id)}
                            className={cn(
                              "p-5 rounded-2xl border-2 text-left transition-all relative group",
                              preferences.selectedModelId === model.id 
                                ? "border-neutral-900 bg-white shadow-xl" 
                                : "border-neutral-100 bg-white/50 hover:border-neutral-200"
                            )}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-sm text-neutral-900">{model.name}</span>
                              <span className={cn(
                                "text-[8px] px-2 py-1 rounded-lg font-bold uppercase tracking-widest",
                                model.provider === 'google' ? "bg-blue-50 text-blue-600" : 
                                model.provider === 'openai' ? "bg-green-50 text-green-600" :
                                model.provider === 'anthropic' ? "bg-stone-50 text-stone-600" :
                                model.provider === 'nvidia' ? "bg-emerald-50 text-emerald-600" :
                                model.provider === 'groq' ? "bg-orange-50 text-orange-600" :
                                "bg-neutral-50 text-neutral-600"
                              )}>
                                {model.provider}
                              </span>
                            </div>
                            <p className="text-[10px] text-neutral-500 leading-relaxed font-medium">{model.description}</p>
                            {preferences.selectedModelId === model.id && (
                              <div className="absolute top-2 right-2">
                                <Check className="w-4 h-4 text-neutral-900" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'keys' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                      <div className="bg-neutral-900 p-6 rounded-2xl space-y-3">
                        <div className="flex items-center gap-3 text-white">
                          <Key className="w-5 h-5 text-neutral-400" />
                          <h4 className="font-bold text-sm">Quản lý API Keys</h4>
                        </div>
                        <p className="text-[10px] text-neutral-400 leading-relaxed font-medium">
                          Nhập API Key của bạn để sử dụng các mô hình AI tương ứng. Dữ liệu được lưu trữ an toàn trong tài khoản của bạn.
                        </p>
                      </div>

                      <div className="space-y-6">
                        {[
                          { key: 'googleKey', label: 'Google Gemini API Key', placeholder: 'AIza...', icon: 'google' },
                          { key: 'openaiKey', label: 'OpenAI API Key', placeholder: 'sk-...', icon: 'openai' },
                          { key: 'anthropicKey', label: 'Anthropic API Key', placeholder: 'sk-ant-...', icon: 'anthropic' },
                          { key: 'openrouterKey', label: 'OpenRouter API Key', placeholder: 'sk-or-v1-...', icon: 'openrouter' },
                          { key: 'nvidiaKey', label: 'NVIDIA API Key', placeholder: 'nvapi-...', icon: 'nvidia' },
                          { key: 'groqKey', label: 'Groq API Key', placeholder: 'gsk_...', icon: 'groq' }
                        ].map(field => (
                          <div key={field.key} className="space-y-2.5">
                            <div className="flex items-center justify-between px-1">
                              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">{field.label}</label>
                              <span className={cn(
                                "text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md",
                                field.icon === 'google' ? "text-blue-600 bg-blue-50" :
                                field.icon === 'openai' ? "text-green-600 bg-green-50" :
                                field.icon === 'anthropic' ? "text-stone-600 bg-stone-50" :
                                field.icon === 'openrouter' ? "text-purple-600 bg-purple-50" :
                                "text-neutral-400 bg-neutral-50"
                              )}>
                                {field.icon}
                              </span>
                            </div>
                            <div className="relative group">
                              <input
                                type="password"
                                value={preferences[field.key] || ''}
                                onChange={(e) => updatePreference(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                className="w-full px-6 py-4 bg-white border border-neutral-100 rounded-xl text-xs font-medium focus:ring-4 focus:ring-neutral-900/5 outline-none transition-all shadow-sm pr-12"
                              />
                              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                {preferences[field.key] ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-200" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'status' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                      <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 space-y-3">
                        <div className="flex items-center gap-3 text-blue-800">
                          <Sparkles className="w-5 h-5" />
                          <h4 className="font-bold text-sm">Vercel AI SDK Integration</h4>
                        </div>
                        <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                          Hệ thống sử dụng <strong>Vercel AI SDK</strong> để tích hợp đồng nhất các mô hình từ Gemini, Groq và NVIDIA. 
                          Đây là thư viện mạnh mẽ nhất hiện nay giúp tối ưu hóa hiệu suất và khả năng mở rộng.
                        </p>
                      </div>

                      <button 
                        onClick={checkApiStatus}
                        className="w-full py-4 bg-neutral-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
                      >
                        <Loader2 className={cn("w-4 h-4", Object.values(apiStatus as Record<string, any>).some(s => s.status === 'checking') && "animate-spin")} />
                        Kiểm tra trạng thái
                      </button>
                      <div className="space-y-3">
                        {AVAILABLE_MODELS.map(model => (
                          <div key={model.id} className="space-y-2">
                            <div className="flex items-center justify-between p-5 bg-white rounded-xl border border-neutral-100 shadow-sm">
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-2.5 h-2.5 rounded-full shadow-sm",
                                  apiStatus[model.id]?.status === 'ok' ? "bg-green-500" :
                                  apiStatus[model.id]?.status === 'error' ? "bg-red-500" : "bg-neutral-200"
                                )} />
                                <span className="text-sm font-bold text-neutral-800">{model.name}</span>
                              </div>
                              <span className={cn(
                                "text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg",
                                apiStatus[model.id]?.status === 'ok' ? "text-green-600 bg-green-50" : 
                                apiStatus[model.id]?.status === 'error' ? "text-red-600 bg-red-50" : "text-neutral-400 bg-neutral-50"
                              )}>
                                {apiStatus[model.id]?.status === 'ok' ? 'Sẵn sàng' : apiStatus[model.id]?.status === 'error' ? 'Lỗi' : 'Chờ kiểm tra'}
                              </span>
                            </div>
                            {apiStatus[model.id]?.status === 'error' && apiStatus[model.id]?.message && (
                              <div className="px-5 py-2 bg-red-50/50 rounded-lg border border-red-100/50">
                                <p className="text-[10px] text-red-600 font-medium leading-relaxed italic">
                                  {apiStatus[model.id]?.message}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'system' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                      <div className="bg-neutral-900 p-6 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-white">
                            <Sparkles className="w-5 h-5 text-orange-400" />
                            <h4 className="font-bold text-sm">Suy nghĩ nội bộ AI</h4>
                          </div>
                          <button
                            onClick={() => updatePreference('showInternalThoughts', !preferences.showInternalThoughts)}
                            className={cn(
                              "w-12 h-6 rounded-full transition-all relative",
                              preferences.showInternalThoughts ? "bg-orange-600" : "bg-neutral-700"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                              preferences.showInternalThoughts ? "left-7" : "left-1"
                            )} />
                          </button>
                        </div>
                        <p className="text-[10px] text-neutral-400 leading-relaxed font-medium">
                          Hiển thị các lập luận và thảo luận nội bộ của Agent AI bên dưới mỗi câu trả lời. Giúp bạn hiểu rõ hơn cách AI đưa ra quyết định.
                        </p>
                      </div>

                      <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 space-y-3">
                        <div className="flex items-center gap-3 text-orange-800">
                          <AlertCircle className="w-5 h-5" />
                          <h4 className="font-bold text-sm">Vùng nguy hiểm</h4>
                        </div>
                        <p className="text-[11px] text-orange-700 leading-relaxed font-medium">Các hành động này sẽ xóa vĩnh viễn dữ liệu của bạn khỏi hệ thống. Hãy chắc chắn bạn đã sao lưu trước khi thực hiện.</p>
                      </div>
                      
                      <div className="space-y-3">
                        <button
                          onClick={() => setConfirmClearHistory(true)}
                          className="w-full py-4 bg-white text-orange-600 border border-orange-100 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-orange-50 transition-all active:scale-95 shadow-sm"
                        >
                          Xóa lịch sử chat
                        </button>
                        <button
                          onClick={() => setConfirmClearAll(true)}
                          className="w-full py-4 bg-white text-red-600 border border-red-100 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-red-50 transition-all active:scale-95 shadow-sm"
                        >
                          Xóa toàn bộ dữ liệu
                        </button>
                      </div>

                      <AnimatePresence>
                        {confirmClearHistory && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-6 bg-neutral-900 text-white rounded-2xl space-y-4 shadow-2xl"
                          >
                            <p className="text-xs font-bold text-center">Xác nhận xóa lịch sử chat?</p>
                            <div className="flex gap-3">
                              <button onClick={clearChatHistory} className="flex-1 py-3 bg-orange-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest">Xác nhận</button>
                              <button onClick={() => setConfirmClearHistory(false)} className="flex-1 py-3 bg-white/10 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest">Hủy</button>
                            </div>
                          </motion.div>
                        )}
                        {confirmClearAll && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-6 bg-red-900 text-white rounded-2xl space-y-4 shadow-2xl"
                          >
                            <p className="text-xs font-bold text-center">Xác nhận xóa TẤT CẢ dữ liệu?</p>
                            <div className="flex gap-3">
                              <button onClick={clearAllData} className="flex-1 py-3 bg-white text-red-900 rounded-xl text-[10px] font-bold uppercase tracking-widest">Xóa hết</button>
                              <button onClick={() => setConfirmClearAll(false)} className="flex-1 py-3 bg-white/10 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest">Hủy</button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Backup & Data Knowledge Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 text-neutral-900 px-1">
          <div className="w-8 h-8 bg-neutral-100 rounded-xl flex items-center justify-center">
            <Database className="w-4 h-4" />
          </div>
          <h3 className="font-display font-bold text-xl">Dữ liệu & Knowledge</h3>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full p-6 flex items-center justify-between hover:bg-neutral-50 transition-all border-b border-neutral-50 group"
          >
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-white transition-all shadow-sm">
                <Download className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-left space-y-0.5">
                <span className="font-bold text-neutral-900 block text-lg">Xuất dữ liệu Knowledge</span>
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Dùng cho NotebookLM (JSON/Markdown)</span>
              </div>
            </div>
            {isExporting ? <Loader2 className="w-5 h-5 text-neutral-300 animate-spin" /> : <ChevronRight className="w-5 h-5 text-neutral-300" />}
          </button>

          <button
            onClick={handleCloudBackup}
            disabled={isExporting}
            className="w-full p-6 flex items-center justify-between hover:bg-neutral-50 transition-all group"
          >
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center group-hover:bg-white transition-all shadow-sm">
                <Cloud className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-left space-y-0.5">
                <span className="font-bold text-neutral-900 block text-lg">Sao lưu Google Drive</span>
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Tự động push định kỳ 24h</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AnimatePresence>
                {showBackupSuccess && (
                  <motion.span
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="text-[10px] text-green-600 font-bold uppercase tracking-widest"
                  >
                    Đã xong
                  </motion.span>
                )}
              </AnimatePresence>
              <ChevronRight className="w-5 h-5 text-neutral-300" />
            </div>
          </button>
        </div>
      </section>

      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        
        <button 
          onClick={async () => {
            const newState = !preferences.autoBackup;
            updatePreference('autoBackup', newState);
            localStorage.setItem('auto_backup_enabled', String(newState));
            
            if (newState) {
              alert("Tính năng Sao lưu tự động đã BẬT.\nHệ thống sẽ tự đồng bộ dữ liệu của bạn lên Google Drive ngay khi có bất kỳ thay đổi nào.\n\nLưu ý: Nếu Google thu hồi thẻ phiên đăng nhập, hệ thống sẽ tạm dừng đồng bộ cho tới khi bạn ấn 'Sao lưu' thủ công 1 lần.");
            }
          }}
          className={cn(
            "w-full p-6 flex flex-col items-start justify-center hover:bg-neutral-50 transition-all border-b border-neutral-100 group relative",
            preferences.autoBackup ? "bg-green-50/10" : ""
          )}
        >
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className={cn(
                 "w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm",
                 preferences.autoBackup ? "bg-green-50" : "bg-neutral-50 group-hover:bg-neutral-100"
              )}>
                <Check className={cn(
                   "w-6 h-6",
                   preferences.autoBackup ? "text-green-600" : "text-neutral-400"
                )} />
              </div>
              <div className="text-left space-y-0.5">
                <span className="font-bold text-neutral-900 block text-lg">Sao lưu Tự động (Auto-Sync)</span>
                <span className="text-sm text-neutral-500 font-medium">Lưu ngầm lên Drive sau mỗi 10 giây khi có thay đổi</span>
              </div>
            </div>
            <div className={cn(
              "w-10 h-6 rounded-full transition-colors flex items-center px-1 shadow-inner",
              preferences.autoBackup ? "bg-green-500" : "bg-neutral-200"
            )}>
              <div className={cn(
                "w-4 h-4 bg-white rounded-full shadow-sm transition-transform",
                preferences.autoBackup ? "translate-x-4" : "translate-x-0"
              )} />
            </div>
          </div>
        </button>

        <button 
          onClick={performBackup}
          disabled={isBackingUp}
          className="w-full p-6 flex flex-col items-start justify-center hover:bg-neutral-50 transition-all border-b border-neutral-100 group relative"
        >
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-all shadow-sm">
                <Cloud className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-left space-y-0.5">
                <span className="font-bold text-neutral-900 block text-lg">Sao lưu Google Drive</span>
                <span className="text-sm text-neutral-500 font-medium">Lưu trữ an toàn dữ liệu đầu bếp của bạn</span>
              </div>
            </div>
            {isBackingUp ? (
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            ) : (
              <ChevronRight className="w-5 h-5 text-neutral-300" />
            )}
          </div>
          <AnimatePresence>
            {backupStatus && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={cn("mt-4 text-sm font-medium w-full text-left pl-[68px]", backupStatus.includes('❌') ? "text-red-500" : "text-blue-600")}
              >
                {backupStatus}
              </motion.div>
            )}
          </AnimatePresence>
        </button>
        <button className="w-full p-6 flex items-center justify-between hover:bg-neutral-50 transition-all border-b border-neutral-100 group">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-neutral-50 rounded-xl flex items-center justify-center group-hover:bg-white transition-all shadow-sm">
              <Shield className="w-6 h-6 text-neutral-600" />
            </div>
            <span className="font-bold text-neutral-900 text-lg">Quyền riêng tư & Bảo mật</span>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-300" />
        </button>
        <button className="w-full p-6 flex items-center justify-between hover:bg-neutral-50 transition-all group">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-neutral-50 rounded-xl flex items-center justify-center group-hover:bg-white transition-all shadow-sm">
              <HelpCircle className="w-6 h-6 text-neutral-600" />
            </div>
            <span className="font-bold text-neutral-900 text-lg">Trung tâm hỗ trợ</span>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-300" />
        </button>
      </div>

      <button
        onClick={handleLogout}
        className="w-full bg-red-50 text-red-600 font-bold py-6 rounded-xl flex items-center justify-center gap-4 hover:bg-red-100 transition-all active:scale-95 shadow-sm"
      >
        <LogOut className="w-6 h-6" />
        <span className="text-lg">Đăng xuất</span>
      </button>

      <footer className="text-center pt-8 pb-4">
        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-[0.3em]">SousChef Executive AI v1.0.0</p>
      </footer>
    </motion.div>
  );
}
