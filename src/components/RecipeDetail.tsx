import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, DollarSign, ListChecks, ChefHat, Sparkles, Edit2, Trash2, Plus, Minus, AlertCircle } from 'lucide-react';
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
    setEditedRecipe({
      ...editedRecipe,
      ingredients: [...editedRecipe.ingredients, { name: '', amount: '', unit: '', price: 0 }]
    });
  };

  const removeIngredient = (index: number) => {
    const newIngredients = editedRecipe.ingredients.filter((_: any, i: number) => i !== index);
    setEditedRecipe({ ...editedRecipe, ingredients: newIngredients });
  };

  const updateIngredient = (index: number, field: string, value: any) => {
    const newIngredients = editedRecipe.ingredients.map((ing: any, i: number) => {
      if (i === index) {
        return { ...ing, [field]: field === 'price' ? parseFloat(value) || 0 : value };
      }
      return ing;
    });
    setEditedRecipe({ ...editedRecipe, ingredients: newIngredients });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      className="fixed inset-0 z-[60] bg-stone-50 flex flex-col"
    >
      <header className="p-6 flex justify-between items-center bg-white border-b border-stone-200">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-stone-600" />
          </button>
          {!isEditing && (
            <h2 className="text-lg font-bold text-stone-900 truncate max-w-[200px]">{recipe.title}</h2>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isNew && !isEditing && (
            <>
              <button
                onClick={handleEdit}
                className="p-2 text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
                title="Chỉnh sửa"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
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
              className="bg-orange-600 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          )}

          {!isEditing && onFindSimilar && (
            <button
              onClick={() => onFindSimilar(recipe.theme || recipe.title)}
              className="p-2 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 transition-colors"
              title="Tìm món tương tự"
            >
              <Sparkles className="w-5 h-5" />
            </button>
          )}
          
          {isNew && onSave ? (
            <button
              onClick={onSave}
              className="bg-orange-600 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-orange-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              Lưu
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {isEditing ? (
          <div className="space-y-6 pb-12">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Tiêu đề công thức</label>
              <input
                type="text"
                value={editedRecipe.title}
                onChange={(e) => setEditedRecipe({ ...editedRecipe, title: e.target.value })}
                className="w-full bg-white border border-stone-200 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Nguyên liệu</label>
                <button
                  onClick={addIngredient}
                  className="flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700"
                >
                  <Plus className="w-3 h-3" /> Thêm nguyên liệu
                </button>
              </div>
              <div className="space-y-3">
                {editedRecipe.ingredients.map((ing: any, i: number) => (
                  <div key={i} className="flex gap-2 items-start bg-white p-3 rounded-2xl border border-stone-100 shadow-sm">
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                      <input
                        type="text"
                        placeholder="Tên"
                        value={ing.name}
                        onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                        className="bg-stone-50 border-none rounded-lg p-2 text-sm focus:ring-1 focus:ring-orange-500"
                      />
                      <input
                        type="text"
                        placeholder="Lượng"
                        value={ing.amount}
                        onChange={(e) => updateIngredient(i, 'amount', e.target.value)}
                        className="bg-stone-50 border-none rounded-lg p-2 text-sm focus:ring-1 focus:ring-orange-500"
                      />
                      <input
                        type="text"
                        placeholder="Đơn vị"
                        value={ing.unit}
                        onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                        className="bg-stone-50 border-none rounded-lg p-2 text-sm focus:ring-1 focus:ring-orange-500"
                      />
                      <input
                        type="number"
                        placeholder="Giá"
                        value={ing.price}
                        onChange={(e) => updateIngredient(i, 'price', e.target.value)}
                        className="bg-stone-50 border-none rounded-lg p-2 text-sm focus:ring-1 focus:ring-orange-500"
                      />
                    </div>
                    <button
                      onClick={() => removeIngredient(i)}
                      className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Hướng dẫn thực hiện</label>
              <textarea
                value={editedRecipe.instructions}
                onChange={(e) => setEditedRecipe({ ...editedRecipe, instructions: e.target.value })}
                rows={10}
                className="w-full bg-white border border-stone-200 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all resize-none"
              />
            </div>
          </div>
        ) : (
          <>
            {/* Costing Card */}
            <section className="bg-stone-900 text-white p-6 rounded-3xl shadow-xl space-y-4">
              <div className="flex items-center gap-2 text-orange-400">
                <DollarSign className="w-5 h-5" />
                <h3 className="font-bold uppercase tracking-widest text-xs">Chi phí & Định giá</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-stone-400 text-[10px] uppercase tracking-wider">Tổng chi phí</p>
                  <p className="text-2xl font-bold">${recipe.totalCost?.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-stone-400 text-[10px] uppercase tracking-wider">Giá đề xuất</p>
                  <p className="text-2xl font-bold text-orange-400">${recipe.recommendedPrice?.toLocaleString()}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-stone-800">
                <p className="text-stone-500 text-[10px] italic">Được tính toán bởi Sub-agent Costing</p>
              </div>
            </section>

            {/* Ingredients */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-stone-900">
                <ListChecks className="w-5 h-5" />
                <h3 className="font-bold text-lg">Nguyên liệu</h3>
              </div>
              <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
                {recipe.ingredients.map((ing: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-4 border-b border-stone-50 last:border-0">
                    <div>
                      <p className="font-medium text-stone-900">{ing.name}</p>
                      <p className="text-xs text-stone-500">{ing.amount} {ing.unit}</p>
                    </div>
                    <p className="text-stone-400 text-sm">${ing.price?.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Instructions */}
            <section className="space-y-4 pb-6">
              <div className="flex items-center gap-2 text-stone-900">
                <ChefHat className="w-5 h-5" />
                <h3 className="font-bold text-lg">Hướng dẫn thực hiện</h3>
              </div>
              <div className="prose prose-stone max-w-none text-stone-600 leading-relaxed">
                <ReactMarkdown>{recipe.instructions}</ReactMarkdown>
              </div>
            </section>

            {/* Find Similar Action at bottom */}
            {onFindSimilar && (
              <section className="pb-12">
                <button
                  onClick={() => onFindSimilar(recipe.theme || recipe.title)}
                  className="w-full py-4 px-6 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 group"
                  title="Tìm các món ăn có phong cách hoặc nguyên liệu tương tự"
                >
                  <Sparkles className="w-5 h-5 text-orange-500 group-hover:animate-pulse" />
                  Tìm món tương tự
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
