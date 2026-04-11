import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
  purchasePrice: number;
  costPerAmount: number;
}

export interface Recipe {
  title: string;
  ingredients: Ingredient[];
  instructions: string;
  [key: string]: any;
}

export function validateRecipe(recipe: Partial<Recipe>): string | null {
  if (!recipe.title || typeof recipe.title !== 'string' || recipe.title.trim().length === 0) {
    return "Tiêu đề công thức không được để trống.";
  }
  if (!Array.isArray(recipe.ingredients)) {
    return "Danh sách nguyên liệu không hợp lệ.";
  }
  for (const ing of recipe.ingredients) {
    if (!ing.name || typeof ing.name !== 'string' || ing.name.trim().length === 0) {
      return "Tên nguyên liệu không được để trống.";
    }
    if (typeof ing.amount !== 'string') {
      return "Số lượng nguyên liệu phải là chuỗi.";
    }
    if (typeof ing.unit !== 'string') {
      return "Đơn vị nguyên liệu phải là chuỗi.";
    }
    if (typeof ing.purchasePrice !== 'number' || isNaN(ing.purchasePrice)) {
      return "Giá nhập nguyên liệu phải là một số.";
    }
    if (typeof ing.costPerAmount !== 'number' || isNaN(ing.costPerAmount)) {
      return "Cost nguyên liệu phải là một số.";
    }
  }
  if (!recipe.instructions || typeof recipe.instructions !== 'string' || recipe.instructions.trim().length === 0) {
    return "Hướng dẫn thực hiện không được để trống.";
  }
  return null;
}
