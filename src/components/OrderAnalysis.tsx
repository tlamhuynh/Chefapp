import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Upload, Sparkles, ListChecks, ChevronRight } from 'lucide-react';
import { analyzeOrderImage } from '../lib/gemini';
import { db, collection, addDoc, serverTimestamp, auth } from '../lib/firebase';

interface OrderAnalysisProps {
  onClose: () => void;
  preferences?: any;
}

export function OrderAnalysis({ onClose, preferences }: OrderAnalysisProps) {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    try {
      const base64 = image.split(',')[1];
      const aiConfig = preferences ? { 
        openaiKey: preferences.openaiKey, 
        anthropicKey: preferences.anthropicKey, 
        googleKey: preferences.googleKey,
        openrouterKey: preferences.openrouterKey,
        nvidiaKey: preferences.nvidiaKey,
        groqKey: preferences.groqKey
      } : undefined;
      const analysis = await analyzeOrderImage(base64, aiConfig, preferences?.selectedModelId);
      setResult(analysis);
      
      if (auth.currentUser) {
        await addDoc(collection(db, 'orders'), {
          imageUrl: image,
          analysis: analysis.summary,
          items: analysis.items.map((i: any) => `${i.quantity}x ${i.name}`),
          authorId: auth.currentUser.uid,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Analysis failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      className="fixed inset-0 z-[60] bg-white flex flex-col"
    >
      <header className="px-6 py-8 space-y-1 bg-white border-b border-neutral-100">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-600 hover:bg-neutral-200 transition-all active:scale-95">
              <X className="w-5 h-5" />
            </button>
            <div className="space-y-0.5">
              <h1 className="text-2xl font-display font-bold text-neutral-900 tracking-tight">Số hóa đơn</h1>
              <p className="text-neutral-400 text-[10px] font-bold uppercase tracking-[0.2em]">AI Order Digitizer</p>
            </div>
          </div>
          <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center shadow-xl shadow-neutral-200">
            <Camera className="w-6 h-6 text-white" />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-10 no-scrollbar">
        {!image ? (
          <div className="space-y-8">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-[2rem] flex flex-col items-center justify-center gap-6 cursor-pointer hover:border-neutral-900 hover:bg-white transition-all group"
            >
              <div className="w-20 h-20 bg-neutral-100 rounded-3xl flex items-center justify-center group-hover:bg-neutral-900 group-hover:scale-110 transition-all duration-500 shadow-xl shadow-neutral-200">
                <Camera className="w-10 h-10 text-neutral-600 group-hover:text-white transition-colors" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-display font-bold text-neutral-900">Chụp ảnh đơn hàng</p>
                <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest">Nhấn để tải ảnh lên</p>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            
            <div className="bg-neutral-900 text-white p-8 rounded-[2rem] space-y-4 shadow-2xl shadow-neutral-200 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/10 transition-all duration-700" />
              <div className="flex items-center gap-3 text-white/60">
                <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">SousChef Intelligence</h4>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed font-medium">
                Hệ thống AI có thể đọc các đơn hàng viết tay, hóa đơn in và màn hình kỹ thuật số để tự động trích xuất các mặt hàng và số lượng, giúp bạn quản lý kho và chuẩn bị món ăn nhanh chóng hơn.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            <div className="relative aspect-video rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white group">
              <img src={image} alt="Order" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-neutral-900/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <button 
                onClick={() => setImage(null)}
                className="absolute top-6 right-6 bg-white/90 backdrop-blur-md text-neutral-900 p-3 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-xl active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!result ? (
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full bg-neutral-900 text-white font-bold py-6 rounded-xl flex items-center justify-center gap-4 shadow-2xl shadow-neutral-200 active:scale-95 transition-all disabled:opacity-50 group"
              >
                {isAnalyzing ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Sparkles className="w-6 h-6" />
                  </motion.div>
                ) : (
                  <Sparkles className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
                )}
                <span className="text-lg">{isAnalyzing ? 'Đang phân tích...' : 'Bắt đầu phân tích AI'}</span>
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-10"
              >
                <section className="space-y-6">
                  <div className="flex items-center gap-3 text-neutral-900 px-1">
                    <div className="w-8 h-8 bg-neutral-100 rounded-xl flex items-center justify-center">
                      <ListChecks className="w-4 h-4" />
                    </div>
                    <h3 className="font-display font-bold text-xl">Mặt hàng trích xuất</h3>
                  </div>
                  <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden divide-y divide-neutral-50">
                    {result.items.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between items-center p-6 hover:bg-neutral-50/50 transition-colors group">
                        <div className="flex items-center gap-5">
                          <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center font-bold text-neutral-900 text-sm shadow-sm group-hover:bg-neutral-900 group-hover:text-white transition-all">
                            {item.quantity}
                          </div>
                          <span className="font-bold text-neutral-800 text-lg">{item.name}</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-neutral-200 group-hover:text-neutral-400 transition-colors" />
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-neutral-900 text-white p-8 rounded-[2rem] space-y-6 shadow-2xl shadow-neutral-200 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/10 transition-all duration-700" />
                  <div className="flex items-center gap-3 text-white/60">
                    <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold uppercase tracking-[0.2em] text-[10px]">Tóm tắt chuẩn bị</h3>
                  </div>
                  <p className="text-neutral-300 text-sm leading-relaxed font-medium relative z-10">{result.summary}</p>
                </section>
                
                <button
                  onClick={onClose}
                  className="w-full bg-neutral-100 text-neutral-600 font-bold py-6 rounded-xl active:scale-95 transition-all hover:bg-neutral-200"
                >
                  Hoàn tất
                </button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
