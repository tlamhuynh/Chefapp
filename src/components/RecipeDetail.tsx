import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, DollarSign, ListChecks, ChefHat, Sparkles, Edit2, Trash2, Plus, Minus, AlertCircle, Share2, Copy, Check as CheckIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { db, doc, updateDoc, deleteDoc, handleFirestoreError, OperationType } from '../lib/firebase';
import { cn, validateRecipe } from '../lib/utils';

interface RecipeDetailProps {
  recipe: any;
  onClose: () => void;
  onSave?: () => void;
  onFindSimilar?: (theme: string) => void;
  isNew?: boolean;
}

export function RecipeDetail({ recipe, onClose, onSave, onFindSimilar, isNew }: RecipeDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editedRecipe, setEditedRecipe] = useState({ ...recipe });
  const [isSaving, setIsSaving] = useState(false);
  const [showShareTooltip, setShowShareTooltip] = useState(false);

  const handleShare = async () => {
    const shareText = `# ${recipe.title}\n\n## Nguyên liệu\n${recipe.ingredients.map((ing: any) => `- ${ing.name}: ${ing.amount} ${ing.unit}`).join('\n')}\n\n## Hướng dẫn\n${recipe.instructions}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: recipe.title,
          text: shareText,
        });
      } catch (err) {
        console.error("Share failed", err);
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      setShowShareTooltip(true);
      setTimeout(() => setShowShareTooltip(false), 2000);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'recipes', recipe.id));
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `recipes/${recipe.id}`);
    }
  };

  const handleUpdate = async () => {
    const error = validateRecipe(editedRecipe);
    if (error) {
      alert(error);
      return;
    }

    setIsSaving(true);
    try {
      const { id, ...updateData } = editedRecipe;
      await updateDoc(doc(db, 'recipes', recipe.id), updateData);
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `recipes/${recipe.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const addIngredient = () => {
    const newIngredients = [...editedRecipe.ingredients, { name: '', amount: '', unit: '', purchasePrice: 0, costPerAmount: 0 }];
    const totalCost = newIngredients.reduce((sum: number, ing: any) => sum + (ing.costPerAmount || 0), 0);
    const recommendedPrice = totalCost * 3;
    setEditedRecipe({
      ...editedRecipe,
      ingredients: newIngredients,
      totalCost,
      recommendedPrice
    });
  };

  const removeIngredient = (index: number) => {
    const newIngredients = editedRecipe.ingredients.filter((_: any, i: number) => i !== index);
    const totalCost = newIngredients.reduce((sum: number, ing: any) => sum + (ing.costPerAmount || 0), 0);
    const recommendedPrice = totalCost * 3;
    setEditedRecipe({ 
      ...editedRecipe, 
      ingredients: newIngredients,
      totalCost,
      recommendedPrice
    });
  };

  const updateIngredient = (index: number, field: string, value: any) => {
    const newIngredients = editedRecipe.ingredients.map((ing: any, i: number) => {
      if (i === index) {
        return { ...ing, [field]: (field === 'purchasePrice' || field === 'costPerAmount') ? parseFloat(value) || 0 : value };
      }
      return ing;
    });
    const totalCost = newIngredients.reduce((sum: number, ing: any) => sum + (ing.costPerAmount || 0), 0);
    const recommendedPrice = totalCost * 3;
    setEditedRecipe({ 
      ...editedRecipe, 
      ingredients: newIngredients,
      totalCost,
      recommendedPrice
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      className="fixed inset-0 z-[60] bg-stone-50 flex flex-col"
    >
      <header className="px-6 py-8 space-y-1 bg-white border-b border-stone-100">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-600 hover:bg-stone-200 transition-all active:scale-95">
              <X className="w-5 h-5" />
            </button>
            <div className="space-y-0.5">
              <h1 className="text-2xl font-display font-bold text-stone-900 tracking-tight truncate max-w-[200px]">
                {isEditing ? 'Chỉnh sửa' : recipe.title}
              </h1>
              <p className="text-stone-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                {isEditing ? 'Recipe Editor' : 'Chi tiết công thức'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isNew && !isEditing && (
              <>
                <button
                  onClick={handleEdit}
                  className="w-10 h-10 bg-stone-100 text-stone-600 rounded-xl flex items-center justify-center hover:bg-stone-200 transition-all active:scale-95"
                  title="Chỉnh sửa"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center hover:bg-red-100 transition-all active:scale-95"
                  title="Xóa"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            )}
            
            {isEditing && (
              <button
                onClick={handleUpdate}
                disabled={isSaving}
                className="bg-stone-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-stone-800 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-stone-200"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            )}

            {!isEditing && onFindSimilar && (
              <button
                onClick={() => onFindSimilar(recipe.theme || recipe.title)}
                className="w-10 h-10 bg-stone-100 text-stone-600 rounded-xl flex items-center justify-center hover:bg-stone-200 transition-all active:scale-95"
                title="Tìm món tương tự"
              >
                <Sparkles className="w-5 h-5" />
              </button>
            )}

            {!isEditing && (
              <div className="relative">
                <button
                  onClick={handleShare}
                  className="w-10 h-10 bg-stone-900 text-white rounded-xl flex items-center justify-center hover:bg-stone-800 transition-all active:scale-95 shadow-lg shadow-stone-200"
                  title="Chia sẻ"
                >
                  <Share2 className="w-5 h-5" />
                </button>
                <AnimatePresence>
                  {showShareTooltip && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 top-full mt-3 bg-stone-900 text-white text-[10px] font-bold py-2 px-3 rounded-xl whitespace-nowrap z-50 flex items-center gap-2 shadow-xl"
                    >
                      <CheckIcon className="w-3.5 h-3.5 text-green-400" />
                      Đã sao chép!
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            
            {isNew && onSave ? (
              <button
                onClick={onSave}
                className="bg-stone-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-stone-800 transition-all active:scale-95 shadow-lg shadow-stone-200"
              >
                <Save className="w-4 h-4" />
                Lưu
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-10 no-scrollbar">
        {isEditing ? (
          <div className="space-y-8 pb-12">
            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 ml-1">Tiêu đề công thức</label>
              <input
                type="text"
                value={editedRecipe.title}
                onChange={(e) => setEditedRecipe({ ...editedRecipe, title: e.target.value })}
                className="w-full bg-white border border-stone-100 rounded-2xl py-4 px-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-stone-900/5 transition-all shadow-sm"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Nguyên liệu</label>
                <button
                  onClick={addIngredient}
                  className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-900 hover:text-stone-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm mới
                </button>
              </div>
              <div className="space-y-3">
                {editedRecipe.ingredients.map((ing: any, i: number) => (
                  <div key={i} className="flex gap-3 items-start bg-white p-4 rounded-[2rem] border border-stone-100 shadow-sm transition-all hover:shadow-md">
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="space-y-1.5">
                        <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest ml-1">Tên</p>
                        <input
                          type="text"
                          placeholder="Tên"
                          value={ing.name}
                          onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                          className="w-full bg-stone-50 border-none rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-stone-900/5 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest ml-1">Lượng</p>
                        <input
                          type="text"
                          placeholder="Lượng"
                          value={ing.amount}
                          onChange={(e) => updateIngredient(i, 'amount', e.target.value)}
                          className="w-full bg-stone-50 border-none rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-stone-900/5 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest ml-1">Đơn vị</p>
                        <input
                          type="text"
                          placeholder="Đơn vị"
                          value={ing.unit}
                          onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                          className="w-full bg-stone-50 border-none rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-stone-900/5 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest ml-1">Giá nhập</p>
                        <input
                          type="number"
                          placeholder="Giá nhập"
                          value={ing.purchasePrice}
                          onChange={(e) => updateIngredient(i, 'purchasePrice', e.target.value)}
                          className="w-full bg-stone-50 border-none rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-stone-900/5 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest ml-1">Cost</p>
                        <input
                          type="number"
                          placeholder="Cost"
                          value={ing.costPerAmount}
                          onChange={(e) => updateIngredient(i, 'costPerAmount', e.target.value)}
                          className="w-full bg-stone-50 border-none rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-stone-900/5 transition-all"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeIngredient(i)}
                      className="mt-6 p-2 text-stone-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 ml-1">Hướng dẫn thực hiện</label>
              <textarea
                value={editedRecipe.instructions}
                onChange={(e) => setEditedRecipe({ ...editedRecipe, instructions: e.target.value })}
                rows={12}
                className="w-full bg-white border border-stone-100 rounded-[2rem] py-6 px-6 text-sm leading-relaxed focus:outline-none focus:ring-4 focus:ring-stone-900/5 transition-all resize-none shadow-sm"
              />
            </div>
          </div>
        ) : (
          <>
            {/* Costing Card */}
            <section className="bg-stone-900 text-white p-8 rounded-[2.5rem] shadow-2xl shadow-stone-200 space-y-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-orange-500/20 transition-all duration-700" />
              <div className="flex items-center gap-3 text-orange-400">
                <div className="w-8 h-8 bg-orange-400/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <h3 className="font-bold uppercase tracking-[0.2em] text-[10px]">Chi phí & Định giá</h3>
              </div>
              <div className="grid grid-cols-2 gap-8 relative z-10">
                <div className="space-y-1.5">
                  <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">Tổng chi phí</p>
                  <p className="text-3xl font-display font-bold">${recipe.totalCost?.toLocaleString()}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">Giá đề xuất</p>
                  <p className="text-3xl font-display font-bold text-orange-400">${recipe.recommendedPrice?.toLocaleString()}</p>
                </div>
              </div>
              <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                <p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest">SousChef Intelligence</p>
                <Sparkles className="w-4 h-4 text-stone-700" />
              </div>
            </section>

            {/* Ingredients */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 text-stone-900 px-1">
                <div className="w-8 h-8 bg-stone-100 rounded-xl flex items-center justify-center">
                  <ListChecks className="w-4 h-4" />
                </div>
                <h3 className="font-display font-bold text-xl">Nguyên liệu & Chi phí</h3>
              </div>
              <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50/50 border-b border-stone-100">
                        <th className="p-5 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Tên nguyên liệu</th>
                        <th className="p-5 text-[10px] font-bold text-stone-400 uppercase tracking-widest text-right">Định lượng</th>
                        <th className="p-5 text-[10px] font-bold text-stone-400 uppercase tracking-widest text-right">Giá nhập</th>
                        <th className="p-5 text-[10px] font-bold text-stone-400 uppercase tracking-widest text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {recipe.ingredients.map((ing: any, i: number) => (
                        <tr key={i} className="hover:bg-stone-50/50 transition-colors group">
                          <td className="p-5">
                            <p className="font-bold text-stone-900">{ing.name}</p>
                          </td>
                          <td className="p-5 text-right">
                            <p className="text-stone-600 font-medium">{ing.amount} {ing.unit}</p>
                          </td>
                          <td className="p-5 text-right">
                            <p className="text-stone-400 font-medium">${ing.purchasePrice?.toLocaleString()}</p>
                          </td>
                          <td className="p-5 text-right">
                            <p className="font-bold text-stone-900 group-hover:text-orange-600 transition-colors">${ing.costPerAmount?.toLocaleString()}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Instructions */}
            <section className="space-y-6 pb-6">
              <div className="flex items-center gap-3 text-stone-900 px-1">
                <div className="w-8 h-8 bg-stone-100 rounded-xl flex items-center justify-center">
                  <ChefHat className="w-4 h-4" />
                </div>
                <h3 className="font-display font-bold text-xl">Hướng dẫn thực hiện</h3>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm">
                <div className="markdown-body prose prose-stone prose-sm max-w-none text-stone-600 leading-relaxed">
                  <ReactMarkdown>{typeof recipe.instructions === 'string' ? recipe.instructions : Array.isArray(recipe.instructions) ? recipe.instructions.join('\n') : String(recipe.instructions || '')}</ReactMarkdown>
                </div>
              </div>
            </section>

            {/* Find Similar Action at bottom */}
            {onFindSimilar && (
              <section className="pb-12">
                <button
                  onClick={() => onFindSimilar(recipe.theme || recipe.title)}
                  className="w-full py-5 px-8 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-[2rem] flex items-center justify-center gap-4 transition-all active:scale-95 shadow-xl shadow-stone-200 group"
                >
                  <Sparkles className="w-5 h-5 text-orange-400 group-hover:rotate-12 transition-transform" />
                  <span>Tìm món tương tự</span>
                </button>
              </section>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white max-w-sm w-full p-8 rounded-[2.5rem] shadow-2xl text-center space-y-6"
            >
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-stone-900">Xóa công thức?</h3>
                <p className="text-stone-500 text-sm">Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa công thức này?</p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDelete}
                  className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl hover:bg-red-700 transition-colors"
                >
                  Xóa vĩnh viễn
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full bg-stone-100 text-stone-600 font-bold py-4 rounded-2xl hover:bg-stone-200 transition-colors"
                >
                  Hủy bỏ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
