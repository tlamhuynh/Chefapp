import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Camera, Upload, Sparkles, ListChecks, ChevronRight } from 'lucide-react';
import { analyzeOrderImage } from '../lib/gemini';
import { db, collection, addDoc, serverTimestamp, auth } from '../lib/firebase';

interface OrderAnalysisProps {
  onClose: () => void;
}

export function OrderAnalysis({ onClose }: OrderAnalysisProps) {
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
      const analysis = await analyzeOrderImage(base64);
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
      className="fixed inset-0 z-[60] bg-stone-50 flex flex-col"
    >
      <header className="p-6 flex justify-between items-center bg-white border-b border-stone-200">
        <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
          <X className="w-6 h-6 text-stone-600" />
        </button>
        <h2 className="text-lg font-bold text-stone-900">Phân tích đơn hàng</h2>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {!image ? (
          <div className="space-y-6">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square bg-white border-2 border-dashed border-stone-200 rounded-[3rem] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-orange-400 transition-colors group"
            >
              <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                <Camera className="w-8 h-8 text-orange-600" />
              </div>
              <div className="text-center">
                <p className="font-bold text-stone-900">Chụp ảnh đơn</p>
                <p className="text-xs text-stone-500">hoặc nhấn để tải ảnh lên</p>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            
            <div className="bg-stone-900 text-white p-6 rounded-3xl space-y-3">
              <div className="flex items-center gap-2 text-orange-400">
                <Sparkles className="w-4 h-4" />
                <h4 className="text-[10px] font-bold uppercase tracking-widest">Khả năng AI</h4>
              </div>
              <p className="text-sm text-stone-300 leading-relaxed">
                Sub-agent AI của chúng tôi có thể đọc các đơn hàng viết tay, hóa đơn in và màn hình kỹ thuật số để tự động trích xuất các mặt hàng và số lượng.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="relative aspect-video rounded-3xl overflow-hidden shadow-xl border-4 border-white">
              <img src={image} alt="Order" className="w-full h-full object-cover" />
              <button 
                onClick={() => setImage(null)}
                className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white p-2 rounded-full hover:bg-black/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!result ? (
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full bg-orange-600 text-white font-bold py-5 rounded-[2rem] flex items-center justify-center gap-3 shadow-lg shadow-orange-200 active:scale-95 transition-all"
              >
                {isAnalyzing ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Sparkles className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
                {isAnalyzing ? 'Đang phân tích...' : 'Bắt đầu phân tích AI'}
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-stone-900">
                    <ListChecks className="w-5 h-5" />
                    <h3 className="font-bold text-lg">Mặt hàng trích xuất</h3>
                  </div>
                  <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
                    {result.items.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between items-center p-5 border-b border-stone-50 last:border-0 group">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 bg-stone-50 rounded-lg flex items-center justify-center font-bold text-stone-400 text-xs">
                            {item.quantity}
                          </div>
                          <span className="font-semibold text-stone-800">{item.name}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-stone-300" />
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-stone-900 text-white p-6 rounded-3xl space-y-4">
                  <h3 className="font-bold text-lg">Tóm tắt chuẩn bị</h3>
                  <p className="text-stone-400 text-sm leading-relaxed">{result.summary}</p>
                </section>
                
                <button
                  onClick={onClose}
                  className="w-full bg-stone-200 text-stone-600 font-bold py-5 rounded-[2rem] active:scale-95 transition-all"
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
