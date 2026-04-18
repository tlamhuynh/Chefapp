import { useState, useEffect } from 'react';
import { db, collection, query, where, orderBy, onSnapshot, auth, deleteDoc, doc } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageIcon, Trash2, Download, ExternalLink, Search, Calendar, ChefHat } from 'lucide-react';
import { cn } from '../lib/utils';

export function Gallery() {
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<any>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'saved_images'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setImages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bạn có chắc muốn xóa hình ảnh này khỏi bộ sưu tập?')) return;
    try {
      await deleteDoc(doc(db, 'saved_images', id));
      if (selectedImage?.id === id) setSelectedImage(null);
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  const filteredImages = images.filter(img => 
    img.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    img.source?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-display font-bold text-neutral-900 tracking-tight">Bộ sưu tập món ăn</h2>
          <p className="text-neutral-500 text-sm font-medium">Lưu giữ những nguồn cảm hứng ẩm thực của bạn</p>
        </div>

        <div className="relative group max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-neutral-900 transition-colors" />
          <input
            type="text"
            placeholder="Tìm kiếm hình ảnh..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-neutral-100 rounded-2xl text-sm focus:ring-4 focus:ring-neutral-900/5 outline-none transition-all shadow-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-12 h-12 border-4 border-neutral-100 border-t-neutral-900 rounded-full animate-spin" />
          <p className="text-neutral-400 font-bold uppercase tracking-widest text-[10px]">Đang tải bộ sưu tập...</p>
        </div>
      ) : filteredImages.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredImages.map((img) => (
              <motion.div
                key={img.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ y: -4 }}
                onClick={() => setSelectedImage(img)}
                className="group relative aspect-square bg-white rounded-3xl overflow-hidden border border-neutral-100 shadow-sm cursor-pointer transition-all hover:shadow-xl"
              >
                <img
                  src={img.url}
                  alt={img.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                  <p className="text-white text-xs font-bold truncate">{img.title}</p>
                  <p className="text-white/70 text-[10px] uppercase tracking-widest mt-1">
                    {img.createdAt ? (
                      typeof img.createdAt.toDate === 'function' 
                        ? img.createdAt.toDate().toLocaleDateString('vi-VN')
                        : new Date(img.createdAt).toLocaleDateString('vi-VN')
                    ) : '---'}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(img.id, e)}
                  className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-md text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white shadow-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-neutral-100 p-20 text-center space-y-6 shadow-sm">
          <div className="w-24 h-24 bg-neutral-50 rounded-[2rem] flex items-center justify-center mx-auto">
            <ImageIcon className="w-10 h-10 text-neutral-200" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-neutral-900">Chưa có hình ảnh nào</h3>
            <p className="text-neutral-400 max-w-xs mx-auto text-sm">Hãy lưu lại những món ăn hấp dẫn từ Chef Chat để xây dựng bộ sưu tập của riêng bạn.</p>
          </div>
        </div>
      )}

      {/* Image Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-10"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-5xl w-full bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row"
            >
              <div className="flex-1 bg-neutral-100 flex items-center justify-center min-h-[300px]">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.title}
                  className="max-w-full max-h-[70vh] object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="w-full md:w-80 p-8 space-y-8 flex flex-col justify-between">
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center">
                      <ChefHat className="w-5 h-5 text-neutral-900" />
                    </div>
                    <button 
                      onClick={() => setSelectedImage(null)}
                      className="p-2 hover:bg-neutral-100 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-5 h-5 text-neutral-400" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-2xl font-display font-bold text-neutral-900 leading-tight">
                      {selectedImage.title}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-neutral-500">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs font-medium">
                          {selectedImage.createdAt ? (
                            typeof selectedImage.createdAt.toDate === 'function' 
                              ? selectedImage.createdAt.toDate().toLocaleDateString('vi-VN')
                              : new Date(selectedImage.createdAt).toLocaleDateString('vi-VN')
                          ) : '---'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-neutral-500">
                        <ExternalLink className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase tracking-widest">
                          Nguồn: {selectedImage.source || 'Chef Chat'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <a
                    href={selectedImage.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-3 w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-neutral-800 transition-all active:scale-95 shadow-xl"
                  >
                    <Download className="w-4 h-4" />
                    Tải hình ảnh
                  </a>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="w-full py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-neutral-200 transition-all"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
