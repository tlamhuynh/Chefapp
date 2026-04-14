import { z } from 'zod';

// Types
export type AIProvider = 'google' | 'openai' | 'anthropic' | 'nvidia' | 'groq' | 'openrouter';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
}

export const AVAILABLE_MODELS: AIModel[] = [
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', description: 'Nhanh và tối ưu chi phí.' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', description: 'Model mạnh mẽ nhất từ Google cho các tác vụ phức tạp.' },
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp', provider: 'google', description: 'Thế hệ 2.0 mới nhất đang thử nghiệm.' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Model đa phương thức mạnh mẽ từ OpenAI.' },
  { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: 'Thông minh nhất hiện nay. Văn phong cực tốt.' },
  { id: 'groq/llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'groq', description: 'Tốc độ cực nhanh từ Groq. Phản hồi gần như tức thì.' },
  { id: 'groq/llama-3.1-8b-instant', name: 'Llama 3.1 8B (Groq)', provider: 'groq', description: 'Tốc độ phản hồi tức thì cho các tác vụ nhanh.' },
  { id: 'groq/mixtral-8x7b-32768', name: 'Mixtral 8x7B (Groq)', provider: 'groq', description: 'MoE model mã nguồn mở hiệu năng cao.' },
  { id: 'nvidia/meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B (NVIDIA)', provider: 'nvidia', description: 'Model mạnh mẽ từ NVIDIA NIM, độ trễ thấp.' },
  { id: 'openrouter/anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (OpenRouter)', provider: 'openrouter', description: 'Sử dụng Claude 3.5 qua OpenRouter.' },
  { id: 'openrouter/google/gemini-1.5-pro', name: 'Gemini 1.5 Pro (OpenRouter)', provider: 'openrouter', description: 'Sử dụng Gemini 1.5 Pro qua OpenRouter.' },
  { id: 'openrouter/meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B (OpenRouter)', provider: 'openrouter', description: 'Model mã nguồn mở siêu lớn qua OpenRouter.' }
];

export interface AIConfig {
  openaiKey?: string;
  anthropicKey?: string;
  googleKey?: string;
  nvidiaKey?: string;
  groqKey?: string;
  openrouterKey?: string;
}

// AI Interaction Functions
function formatMessages(messages: any[]) {
  const aiMessages = messages.map(m => ({
    role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
    content: m.parts.map((p: any) => {
      if (p.inlineData) {
        // Strip data URL prefix if present
        let base64Data = p.inlineData.data;
        if (base64Data.includes('base64,')) {
          base64Data = base64Data.split('base64,')[1];
        }
        return { type: 'image', image: base64Data, mimeType: p.inlineData.mimeType };
      }
      return { type: 'text', text: p.text || "" };
    }).filter((p: any) => p.type === 'image' || (p.type === 'text' && p.text.trim().length > 0))
  })).filter(m => m.content.length > 0);

  if (aiMessages.length === 0) {
    aiMessages.push({ role: 'user', content: [{ type: 'text', text: '...' }] });
  }

  return aiMessages;
}

/**
 * Smart Agent with Multi-step Tool Calling and Self-Correction
 */
export async function chatWithAI(
  modelId: string,
  messages: any[],
  systemInstruction: string,
  tools?: any,
  config?: AIConfig,
  responseSchema?: any
) {
  // Call server-side proxy to avoid CORS and keep keys secure
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId,
      messages: formatMessages(messages),
      systemInstruction,
      tools,
      config,
      responseSchema,
      type: responseSchema ? 'object' : 'text'
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `AI call failed with status ${response.status}`);
  }

  const result = await response.json();
  
  if (responseSchema) {
    return result.object;
  }

  return {
    text: result.text,
    functionCalls: result.toolCalls?.map((tc: any) => ({
      name: tc.toolName,
      args: tc.args
    }))
  };
}

/**
 * Multi-Agent Orchestration (Feature #3 & #6)
 * Coordinates between Creative and Financial agents
 */
export async function multiAgentChat(
  modelId: string,
  messages: any[],
  systemInstruction: string,
  config?: AIConfig,
  inventoryData?: any[],
  recipeData?: any[]
) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId,
      messages: formatMessages(messages),
      systemInstruction,
      config,
      inventoryData,
      recipeData,
      type: 'multi-agent'
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Multi-agent call failed with status ${response.status}`);
  }

  const result = await response.json();
  return result.object;
}

/**
 * Proactive Insight Agent (Feature #4)
 * Runs in background to find optimizations
 */
export async function generateProactiveInsights(
  modelId: string,
  inventory: any[],
  recipes: any[],
  config?: AIConfig
) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId,
      messages: [],
      systemInstruction: "", // Handled server-side for this type
      config,
      inventory,
      recipes,
      type: 'insights'
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Insights call failed with status ${response.status}`);
  }

  const result = await response.json();
  return result.object;
}

/**
 * Fallback mechanism using AI SDK
 */
export async function chatWithAIWithFallback(
  modelId: string,
  messages: any[],
  systemInstruction: string,
  tools?: any,
  config?: AIConfig,
  fallbackModelIds: string[] = [],
  responseSchema?: any
) {
  const modelsToTry = [modelId, ...fallbackModelIds];
  let lastError: any = null;

  for (const currentModelId of modelsToTry) {
    try {
      console.log(`[AI SDK] Trying model: ${currentModelId}`);
      return await chatWithAI(currentModelId, messages, systemInstruction, tools, config, responseSchema);
    } catch (error: any) {
      console.error(`[AI SDK] Error with ${currentModelId}:`, error);
      lastError = error;
    }
  }

  throw lastError || new Error("All AI models failed.");
}
