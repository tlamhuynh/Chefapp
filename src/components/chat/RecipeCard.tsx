import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Utensils, ImageIcon, Check, Save, TrendingUp, DollarSign, Printer } from 'lucide-react';
import { cn } from '../../lib/utils';
import { RecipeData } from '../../types/chat';

interface RecipeCardProps {
  recipe: RecipeData;
  onSave?: () => void;
  isSaving?: boolean;
  onSaveImage?: (e: React.MouseEvent) => void;
  isSavingImage?: boolean;
}

export function RecipeCard({
  recipe,
  onSave,
  isSaving,
  onSaveImage,
  isSavingImage
}: RecipeCardProps) {
  if (!recipe) return null;

  const foodCost = recipe.totalCost || 0;
  const retailPrice = recipe.recommendedPrice || 0;
  const margin = retailPrice > 0 ? ((retailPrice - foodCost) / retailPrice) * 100 : 0;
  const marginColor = margin > 60 ? "text-emerald-500" : margin > 30 ? "text-amber-500" : "text-red-500";

  const handlePrint = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Create a printable frame
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Kitchen Ticket - ${recipe.title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&display=swap');
            body {
              font-family: 'JetBrains Mono', monospace;
              padding: 20px;
              max-width: 80mm;
              margin: 0 auto;
              background: #fff;
              color: #000;
            }
            .header {
              text-align: center;
              border-bottom: 2px dashed #000;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .title {
              font-size: 1.5rem;
              font-weight: bold;
              margin: 10px 0;
              text-transform: uppercase;
            }
            .subtitle {
              font-size: 0.8rem;
            }
            .item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              font-size: 0.9rem;
            }
            .item-name {
              flex: 1;
              padding-right: 10px;
            }
            .item-qty {
              font-weight: bold;
            }
            .footer {
              border-top: 2px dashed #000;
              margin-top: 20px;
              padding-top: 10px;
              font-size: 0.8rem;
              text-align: center;
            }
            .instructions {
              margin-top: 20px;
              font-size: 0.85rem;
              white-space: pre-wrap;
              border-top: 1px dotted #000;
              padding-top: 10px;
            }
            @media print {
              body { width: 100%; margin: 0; padding: 0;}
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${recipe.title}</div>
            <div class="subtitle">CHEF AI - KITCHEN TICKET</div>
          </div>
          <div class="ingredients">
            ${recipe.ingredients?.map(ing => `
              <div class="item">
                <div class="item-name">${ing.name}</div>
                <div class="item-qty">${ing.amount} ${ing.unit}</div>
              </div>
            `).join('')}
          </div>
          ${recipe.instructions ? `
          <div class="instructions">
            <strong>GUIDE:</strong><br/>
            ${recipe.instructions}
          </div>
          ` : ''}
          <div class="footer">
            Printed: ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    // setTimeout to allow fonts to load
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      onClick={onSave}
      className={cn(
        "mt-6 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-white/5 rounded-[2rem] overflow-hidden transition-all group luxury-shadow w-full max-w-md",
        isSaving ? "ring-2 ring-neutral-900 dark:ring-white" : "hover:border-neutral-200 dark:hover:border-white/10"
      )}
    >
      {/* ... image section ... */}
      {recipe.image && (
        <div className="aspect-[16/10] w-full overflow-hidden relative border-b border-neutral-100 dark:border-white/5">
          <img 
            src={recipe.image} 
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1.5s] ease-out"
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-4 right-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSaveImage?.(e);
              }}
              className={cn(
                "w-10 h-10 rounded-full backdrop-blur-xl flex items-center justify-center transition-all",
                isSavingImage 
                  ? "bg-neutral-900 text-white" 
                  : "bg-white/90 text-neutral-900 opacity-0 group-hover:opacity-100 hover:bg-white"
              )}
            >
              {isSavingImage ? <Check className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
      
      <div className="p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="flex justify-center mb-2">
             <Utensils className="w-4 h-4 text-neutral-300 dark:text-neutral-700" />
          </div>
          <h3 className="font-display font-semibold text-2xl text-neutral-900 dark:text-white leading-tight">
            {recipe.title || "Công thức chưa đặt tên"}
          </h3>
        </div>

        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-[1px] flex-1 bg-neutral-100 dark:bg-white/5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Nguyên liệu</span>
              <div className="h-[1px] flex-1 bg-neutral-100 dark:bg-white/5" />
            </div>
            <div className="grid grid-cols-1 gap-y-2">
              {recipe.ingredients.map((ing, i) => (
                <div key={i} className="flex justify-between items-center group/ing">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 group-hover/ing:text-neutral-900 dark:group-hover/ing:text-white font-medium transition-colors">{ing.name}</span>
                  <div className="h-[1px] flex-1 border-b border-dotted border-neutral-200 dark:border-white/5 mx-3 opacity-50" />
                  <span className="text-xs text-neutral-900 dark:text-white font-bold">{ing.amount} <span className="font-normal opacity-50 underline underline-offset-4 decoration-neutral-100 dark:decoration-white/10">{ing.unit}</span></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recipe.instructions && (recipe.instructions.length > 0) && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-[1px] flex-1 bg-neutral-100 dark:bg-white/5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Hướng dẫn</span>
              <div className="h-[1px] flex-1 bg-neutral-100 dark:bg-white/5" />
            </div>
            <div className="space-y-3">
              {(Array.isArray(recipe.instructions) ? recipe.instructions : [recipe.instructions]).map((step, i) => (
                <div key={i} className="flex gap-4">
                  <span className="text-[10px] font-bold text-neutral-300 dark:text-neutral-700 mt-1">{i + 1}</span>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-neutral-50 dark:border-white/5">
           <div className="space-y-1">
              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                 <DollarSign className="w-2.5 h-2.5" /> Food Cost
              </span>
              <p className="text-sm font-display text-neutral-900 dark:text-white font-bold truncate">{formatCurrency(foodCost)}</p>
           </div>
           <div className="space-y-1">
              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                 <TrendingUp className="w-2.5 h-2.5" /> Lợi nhuận
              </span>
              <p className={cn("text-lg font-display font-black", marginColor)}>
                 {margin.toFixed(0)}%
              </p>
           </div>
           <div className="space-y-1 text-right">
              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block">Giá Đề Xuất</span>
              <p className="text-sm font-display text-neutral-900 dark:text-white font-bold truncate">{formatCurrency(retailPrice)}</p>
           </div>
        </div>

        <div className="flex gap-3 mt-4">
           <button 
             onClick={handlePrint}
             className="px-4 py-4 rounded-2xl bg-neutral-100 dark:bg-white/10 text-neutral-900 dark:text-white hover:bg-neutral-200 dark:hover:bg-white/20 transition-all flex items-center justify-center group/btn"
           >
             <Printer className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
           </button>
           <button 
             onClick={(e) => { e.stopPropagation(); onSave?.(); }}
             className={cn(
               "flex-1 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
               isSaving ? "bg-emerald-500 text-white" : "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100"
             )}
           >
              {isSaving ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {isSaving ? "Đã lưu" : "Lưu Công Thức"}
           </button>
        </div>
      </div>
    </motion.div>
  );
}
