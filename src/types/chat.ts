import { z } from 'zod';

export const RecipeSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống"),
  ingredients: z.array(z.object({
    name: z.string(),
    amount: z.string(),
    unit: z.string(),
    purchasePrice: z.number().default(0),
    costPerAmount: z.number().default(0)
  })),
  instructions: z.string(),
  totalCost: z.number().default(0),
  recommendedPrice: z.number().default(0),
  image: z.string().optional(),
  margin: z.number().optional()
});

export type RecipeData = z.infer<typeof RecipeSchema>;

export const InventorySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  currentStock: z.number(),
  unit: z.string(),
  minStock: z.number().default(0),
  pricePerUnit: z.number().default(0),
  category: z.string().optional(),
  updatedAt: z.any().optional()
});

export type InventoryData = z.infer<typeof InventorySchema>;

export interface ChatMessageData {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  userId: string;
  conversationId?: string;
  timestamp: any;
  suggestions?: { label: string; action: string }[];
  recipe?: RecipeData;
  status?: 'pending' | 'processing' | 'completed' | 'error';
  hasFiles?: boolean;
  fileNames?: string[];
  files?: {data: string, mimeType: string, name: string}[];
  photos?: { url: string; filename: string }[];
  internalMonologue?: string;
  proposedActions?: { type: string; data: any; reason: string; approved?: boolean }[];
}

export interface ConversationData {
  id: string;
  title: string;
  userId: string;
  lastMessage?: string;
  updatedAt: any;
  createdAt: any;
}

export interface Memory {
  id: string;
  userId: string;
  content: string;
  importance: number;
  lastUsed: any;
  type: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
}
