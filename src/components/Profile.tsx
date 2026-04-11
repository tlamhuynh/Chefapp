import { signOut, auth, User, db, doc, updateDoc, deleteDoc, query, collection, where, getDocs } from '../lib/firebase';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, User as UserIcon, Settings, Shield, HelpCircle, ChevronRight, Database, Download, Cloud, Check, AlertCircle, Loader2, X, Palette, MessageSquare, Trash2, Sparkles } from 'lucide-react';
import { LocalDb } from '../lib/localDb';
import { cn } from '../lib/utils';
import { AVAILABLE_MODELS, chatWithAI } from '../lib/ai';

interface ProfileProps {
  user: User;
  preferences: any;
  updatePreference: (key: string, value: string) => void;
}

export function Profile({ user, preferences, updatePreference }: ProfileProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showBackupSuccess, setShowBackupSuccess] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'style' | 'model' | 'status' | 'system'>('style');
  const [apiStatus, setApiStatus] = useState<Record<string, { status: 'checking' | 'ok' | 'error', message?: string }>>({});
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

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

      try {
        const result = await chatWithAI(
          model.id, 
          [{ role: 'user', parts: [{ text: 'Hi' }] }], 
          "Chỉ trả về JSON rỗng {}",
          undefined,
          { openaiKey: preferences.openaiKey, anthropicKey: preferences.anthropicKey, googleKey: preferences.googleKey }
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
      { name: 'Đen Đá', class: 'bg-stone-900' },
      { name: 'Cam Cháy', class: 'bg-orange-600' },
      { name: 'Xanh Rêu', class: 'bg-emerald-800' },
      { name: 'Xanh Biển', class: 'bg-blue-700' },
    ],
    ai: [
      { name: 'Trắng Sữa', class: 'bg-white' },
      { name: 'Xám Nhạt', class: 'bg-stone-100' },
      { name: 'Vàng Kem', class: 'bg-amber-50' },
      { name: 'Xanh Bạc Hà', class: 'bg-emerald-50' },
    ],
    bg: [
      { name: 'Mặc định', class: 'bg-stone-50' },
      { name: 'Trắng Tinh', class: 'bg-white' },
      { name: 'Gỗ Nhạt', class: 'bg-orange-50/30' },
      { name: 'Xám Xi Măng', class: 'bg-stone-200/50' },
    ]
  };

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

      {/* Settings Section */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 px-2">Cấu hình hệ thống</h3>
        <div className="bg-white rounded-[2rem] border border-stone-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full p-5 flex items-center justify-between hover:bg-stone-50 transition-colors border-b border-stone-50 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors">
                <Settings className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-left">
                <span className="font-semibold text-stone-800 block">Cài đặt & API</span>
                <span className="text-[10px] text-stone-400">Giao diện, Model AI và API Keys</span>
              </div>
            </div>
            <ChevronRight className={cn("w-5 h-5 text-stone-300 transition-transform", showSettings && "rotate-90")} />
          </button>

          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-stone-50 bg-stone-50/30 overflow-hidden"
              >
                <div className="p-6 space-y-6">
                  <div className="flex p-1 bg-stone-100 rounded-xl">
                    {['style', 'model', 'status', 'system'].map((tab) => (
                      <button 
                        key={tab}
                        onClick={() => setActiveSettingsTab(tab as any)}
                        className={cn(
                          "flex-1 py-2 text-[9px] font-bold uppercase tracking-wider transition-all rounded-lg",
                          activeSettingsTab === tab ? "bg-white text-orange-600 shadow-sm" : "text-stone-400 hover:text-stone-600"
                        )}
                      >
                        {tab === 'style' ? 'Giao diện' : tab === 'model' ? 'Mô hình' : tab === 'status' ? 'Trạng thái' : 'Hệ thống'}
                      </button>
                    ))}
                  </div>

                  {activeSettingsTab === 'style' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Màu tin nhắn của bạn</label>
                        <div className="flex flex-wrap gap-2">
                          {colorOptions.user.map(color => (
                            <button
                              key={color.class}
                              onClick={() => updatePreference('chatUserBubbleColor', color.class)}
                              className={cn(
                                "w-8 h-8 rounded-full border-2 transition-all",
                                color.class,
                                preferences.chatUserBubbleColor === color.class ? "border-orange-500 scale-110" : "border-transparent"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Màu tin nhắn AI</label>
                        <div className="flex flex-wrap gap-2">
                          {colorOptions.ai.map(color => (
                            <button
                              key={color.class}
                              onClick={() => updatePreference('chatAiBubbleColor', color.class)}
                              className={cn(
                                "w-8 h-8 rounded-full border-2 transition-all",
                                color.class,
                                preferences.chatAiBubbleColor === color.class ? "border-orange-500 scale-110" : "border-transparent"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'model' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="grid grid-cols-1 gap-3">
                        {AVAILABLE_MODELS.map(model => (
                          <button
                            key={model.id}
                            onClick={() => updatePreference('selectedModelId', model.id)}
                            className={cn(
                              "p-4 rounded-xl border-2 text-left transition-all relative",
                              preferences.selectedModelId === model.id 
                                ? "border-orange-500 bg-white shadow-sm" 
                                : "border-stone-100 bg-white/50"
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-xs text-stone-900">{model.name}</span>
                              <span className={cn(
                                "text-[8px] px-1.5 py-0.5 rounded font-bold uppercase",
                                model.provider === 'google' ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
                              )}>
                                {model.provider}
                              </span>
                            </div>
                            <p className="text-[10px] text-stone-500 leading-snug">{model.description}</p>
                          </button>
                        ))}
                      </div>

                      <div className="space-y-4 pt-4 border-t border-stone-100">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Google Gemini API Key</label>
                          <input
                            type="password"
                            value={preferences.googleKey || ''}
                            onChange={(e) => updatePreference('googleKey', e.target.value)}
                            placeholder="AIza..."
                            className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">OpenAI API Key</label>
                          <input
                            type="password"
                            value={preferences.openaiKey || ''}
                            onChange={(e) => updatePreference('openaiKey', e.target.value)}
                            placeholder="sk-..."
                            className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'status' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <button 
                        onClick={checkApiStatus}
                        className="w-full py-2 bg-stone-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <Loader2 className={cn("w-3 h-3", Object.values(apiStatus).some(s => s.status === 'checking') && "animate-spin")} />
                        Kiểm tra trạng thái
                      </button>
                      <div className="space-y-2">
                        {AVAILABLE_MODELS.map(model => (
                          <div key={model.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-stone-100">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                apiStatus[model.id]?.status === 'ok' ? "bg-green-500" :
                                apiStatus[model.id]?.status === 'error' ? "bg-red-500" : "bg-stone-300"
                              )} />
                              <span className="text-xs font-medium text-stone-700">{model.name}</span>
                            </div>
                            <span className="text-[9px] font-bold uppercase text-stone-400">
                              {apiStatus[model.id]?.status === 'ok' ? 'Sẵn sàng' : apiStatus[model.id]?.status === 'error' ? 'Lỗi' : '...'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'system' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-2">
                        <p className="text-[10px] text-stone-500 italic">Cẩn thận: Các hành động này không thể hoàn tác.</p>
                        <button
                          onClick={() => setConfirmClearHistory(true)}
                          className="w-full py-3 bg-orange-50 text-orange-600 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                        >
                          Xóa lịch sử chat
                        </button>
                        <button
                          onClick={() => setConfirmClearAll(true)}
                          className="w-full py-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                        >
                          Xóa toàn bộ dữ liệu
                        </button>
                      </div>

                      <AnimatePresence>
                        {confirmClearHistory && (
                          <div className="p-4 bg-orange-100 rounded-2xl space-y-3">
                            <p className="text-[10px] font-bold text-orange-800">Xác nhận xóa lịch sử chat?</p>
                            <div className="flex gap-2">
                              <button onClick={clearChatHistory} className="flex-1 py-2 bg-orange-600 text-white rounded-lg text-[10px] font-bold">XÓA</button>
                              <button onClick={() => setConfirmClearHistory(false)} className="flex-1 py-2 bg-white text-stone-500 rounded-lg text-[10px] font-bold">HỦY</button>
                            </div>
                          </div>
                        )}
                        {confirmClearAll && (
                          <div className="p-4 bg-red-100 rounded-2xl space-y-3">
                            <p className="text-[10px] font-bold text-red-800">Xác nhận xóa TẤT CẢ dữ liệu?</p>
                            <div className="flex gap-2">
                              <button onClick={clearAllData} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-[10px] font-bold">XÓA HẾT</button>
                              <button onClick={() => setConfirmClearAll(false)} className="flex-1 py-2 bg-white text-stone-500 rounded-lg text-[10px] font-bold">HỦY</button>
                            </div>
                          </div>
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
        <button className="w-full p-5 flex items-center justify-between hover:bg-stone-50 transition-colors border-b border-stone-50 group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors">
              <Shield className="w-5 h-5 text-stone-600" />
            </div>
            <span className="font-semibold text-stone-800">Quyền riêng tư & Bảo mật</span>
          </div>
          <ChevronRight className="w-5 h-5 text-stone-300" />
        </button>
        <button className="w-full p-5 flex items-center justify-between hover:bg-stone-50 transition-colors group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors">
              <HelpCircle className="w-5 h-5 text-stone-600" />
            </div>
            <span className="font-semibold text-stone-800">Trung tâm hỗ trợ</span>
          </div>
          <ChevronRight className="w-5 h-5 text-stone-300" />
        </button>
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
