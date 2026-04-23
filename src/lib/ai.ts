import { z } from 'zod';
import { logger } from './logger';
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini in frontend as per skill requirement. Provide a fallback string to prevent immediate crashes if env var is missing during initial load.
const googleAI = new GoogleGenAI({ apiKey: (process.env.GEMINI_API_KEY || "dummy_key_to_prevent_crash_on_load") as string });

// Types
export type AIProvider = 'google' | 'openai' | 'anthropic' | 'nvidia' | 'groq' | 'openrouter';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
}

export const AVAILABLE_MODELS: AIModel[] = [
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', provider: 'google', description: 'Model mạnh mẽ nhất thế hệ mới (Preview).' },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', provider: 'google', description: 'Model tốc độ cao thế hệ mới (Preview).' },
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', provider: 'google', description: 'Phiên bản tốc độ mạnh mẽ và ổn định.' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', description: 'Giao diện và phản hồi siêu nhanh thế hệ 2.0.' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Model đa phương thức mạnh mẽ từ OpenAI.' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', description: 'Cực nhanh, thông minh và giá thành tối ưu.' },
  { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: 'Thông minh nhất hiện nay. Văn phong cực tốt.' },
  { id: 'groq/llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'groq', description: 'Tốc độ cực nhanh từ Groq. Phản hồi gần như tức thì.' },
  { id: 'groq/llama-3.1-8b-instant', name: 'Llama 3.1 8B (Groq)', provider: 'groq', description: 'Model tốc độ siêu nhanh và miễn phí từ Groq.' },
  { id: 'nvidia/meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (NVIDIA)', provider: 'nvidia', description: 'Model mạnh mẽ từ NVIDIA NIM, độ trễ thấp.' },
  { id: 'openrouter/google/gemini-2.0-flash-lite-preview-02-05:free', name: 'Gemini 2.0 Flash Lite (Free)', provider: 'openrouter', description: 'Model miễn phí qua OpenRouter.' },
  { id: 'openrouter/meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', provider: 'openrouter', description: 'Llama 70B miễn phí từ OpenRouter.' },
  { id: 'openrouter/liquid/lfm-40b', name: 'Liquid LFM 40B (OpenRouter)', provider: 'openrouter', description: 'Mô hình hiệu suất tốt và linh hoạt.' },
  { id: 'openrouter/anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (OpenRouter)', provider: 'openrouter', description: 'Truy cập qua OpenRouter' },
  { id: 'nvidia/moonshotai/kimi-k2.5', name: 'Kimi 2.5 (NVIDIA)', provider: 'nvidia', description: 'Model Kimi thế hệ 2.5 mạnh mẽ từ Moonshot AI qua NVIDIA NIM.' },
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
  const aiMessages = messages.map(m => {
    // Standardize roles for AI SDK: 'user' or 'assistant'
    const role = (m.role === 'model' || m.role === 'assistant') ? 'assistant' : 'user';
    
    const partsToProcess = m.parts || (Array.isArray(m.content) ? m.content : [{ text: m.text || m.content || "" }]);
    
    const contentParts = partsToProcess.map((p: any) => {
      if (p.inlineData) {
        let base64Data = p.inlineData.data;
        if (base64Data.includes('base64,')) {
          base64Data = base64Data.split('base64,')[1];
        }
        let type = 'image';
        if (p.inlineData.mimeType?.startsWith('video/')) type = 'video';
        else if (!p.inlineData.mimeType?.startsWith('image/')) type = 'file';
        
        return { type, [type === 'image' ? 'image' : type === 'video' ? 'video' : 'data']: base64Data, mimeType: p.inlineData.mimeType };
      }
      
      // Support my internal format directly if it's already structured
      if (p.type === 'image' || p.type === 'video' || p.type === 'file') {
        let base64Data = p.image || p.video || p.data || p.inlineData?.data;
        if (base64Data && typeof base64Data === 'string' && base64Data.includes('base64,')) {
          base64Data = base64Data.split('base64,')[1];
        }
        return { 
          type: p.type, 
          [p.type === 'image' ? 'image' : p.type === 'video' ? 'video' : 'data']: base64Data, 
          mimeType: p.mimeType || p.inlineData?.mimeType 
        };
      }

      return { type: 'text', text: p.text || "" };
    }).filter((p: any) => {
      if (p.type === 'image') return !!p.image;
      if (p.type === 'video') return !!p.video;
      if (p.type === 'file') return !!p.data;
      if (p.type === 'text') return p.text.trim().length > 0;
      return false;
    });

    // Handle empty messages - Gemini rejects these
    if (contentParts.length === 0) {
      return { role, content: "..." };
    }

    // If only one text part, simplify to string for broader compatibility
    if (contentParts.length === 1 && contentParts[0].type === 'text') {
      return { role, content: contentParts[0].text };
    }

    return { role, content: contentParts };
  }).filter(m => {
    // Ensure we don't send messages with invalid content
    if (typeof m.content === 'string') return m.content.trim().length > 0;
    if (Array.isArray(m.content)) return m.content.length > 0;
    return false;
  });

  // Ensure conversation starts with user if not empty
  if (aiMessages.length > 0 && aiMessages[0].role === 'assistant') {
    aiMessages.unshift({ role: 'user', content: 'Tiếp tục phân tích.' });
  }

  // Fallback for empty message list
  if (aiMessages.length === 0) {
    aiMessages.push({ role: 'user', content: 'Xin chào.' });
  }

  return aiMessages;
}

// Convert AI SDK message format to @google/genai format
function convertToGeminiMessages(messages: any[]) {
  return messages.map(m => {
    let role = m.role;
    if (role === 'assistant') role = 'model';
    
    let parts: any[] = [];
    if (typeof m.content === 'string') {
      parts.push({ text: m.content });
    } else if (Array.isArray(m.content)) {
      parts = m.content.map(c => {
        if (c.type === 'image' || c.type === 'video' || c.type === 'file') {
          return { 
            inlineData: { 
              data: c.image || c.video || c.data, 
              mimeType: c.mimeType || (c.type === 'video' ? 'video/mp4' : 'image/jpeg') 
            } 
          };
        }
        return { text: c.text };
      });
    }
    
    return { role, parts };
  });
}

// Convert tools to Gemini function declarations
function convertToGeminiTools(tools?: any) {
  if (!tools) return undefined;
  
  const functionDeclarations: any[] = [];
  
  Object.entries(tools).forEach(([name, definition]: [string, any]) => {
    // We cannot easily convert Zod schemas to Gemini API schemas manually here without zod-to-json-schema
    // Instead of doing a half-baked conversion that crashes Gemini (like 'type: None'),
    // we'll just omit tools from direct Gemini SDK calls entirely on the client,
    // since we prefer the server proxy (which uses Vercel AI SDK that handles tool schemas natively) anyway.
    logger.warn(`[convertToGeminiTools] Tool '${name}' ignored in client SDK fallback to prevent schema crash.`);
  });
  
  return functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined;
}

// Helper to robustly parse JSON from AI responses
function robustParseJson(jsonStr: string) {
  if (!jsonStr) return {};
  
  let cleaned = jsonStr.trim();
  
  // Remove markdown code blocks if present
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    if (lines[0].startsWith('```')) lines.shift();
    if (lines[lines.length - 1].trim().startsWith('```')) lines.pop();
    cleaned = lines.join('\n').trim();
  }

  // Attempt standard parse first
  try {
    return JSON.parse(cleaned);
  } catch (e: any) {
    logger.warn("[robustParseJson] Initial parse failed, attempting cleanup", { error: e.message });
  }

  // Find the first '{' or '['
  const startIndex = cleaned.search(/[\{\[]/);
  if (startIndex === -1) {
    throw new Error("No JSON object or array found in response");
  }

  let openBraces = 0;
  let endIndex = -1;
  let inString = false;
  let escapeNext = false;
  
  for (let i = startIndex; i < cleaned.length; i++) {
    const char = cleaned[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{' || char === '[') {
        openBraces++;
      } else if (char === '}' || char === ']') {
        openBraces--;
        if (openBraces === 0) {
          endIndex = i;
          break;
        }
      }
    }
  }

  if (endIndex !== -1) {
    cleaned = cleaned.substring(startIndex, endIndex + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (e: any) {
    try {
      // Common AI mistakes: trailing commas, single quotes on keys
      const fixed = cleaned
        .replace(/,\s*([\}\]])/g, '$1') // Trailing commas
        .replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":'); // Single quoted keys
      
      return JSON.parse(fixed);
    } catch (e2: any) {
      logger.error("[robustParseJson] All parse attempts failed", { error: e2.message, snippet: cleaned.slice(0, 100) + '...' });
      throw e2;
    }
  }
}

/**
 * Streaming Chat Agent for Gemini Frontend
 */
export async function* chatWithAIStream(
  modelId: string,
  messages: any[],
  systemInstruction: string,
  config?: AIConfig
) {
  const mappedModelId = modelId.startsWith('gemini') ? modelId : 'gemini-2.0-flash';

  const formattedMessages = formatMessages(messages);
  const geminiMessages = convertToGeminiMessages(formattedMessages);

  try {
    const stream = await googleAI.models.generateContentStream({
      model: mappedModelId,
      contents: geminiMessages,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error: any) {
    logger.captureApiError(`chatWithAIStream [${mappedModelId}]`, error);
    throw error;
  }
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
  responseSchema?: any,
  type?: 'text' | 'object' | 'multi-agent' | 'insights'
) {
  const formattedMessages = formatMessages(messages);
  logger.info(`[chatWithAI] Request to ${modelId}`, { type: type || (responseSchema ? 'object' : 'text') });

  // Multi-provider routing setup
  let apiKey = '';
  let baseURL = '';
  let actualModelId = modelId;

  if (modelId.startsWith('openrouter/')) {
    apiKey = config?.openrouterKey || '';
    baseURL = 'https://openrouter.ai/api/v1/chat/completions';
  } else if (modelId.startsWith('groq/')) {
    apiKey = config?.groqKey || '';
    baseURL = 'https://api.groq.com/openai/v1/chat/completions';
    actualModelId = modelId.replace('groq/', '');
    if (actualModelId.includes('deepseek-r1-distill-llama-70b')) {
      actualModelId = 'llama-3.3-70b-versatile';
    }
  } else if (modelId.startsWith('nvidia/')) {
    apiKey = config?.nvidiaKey || '';
    baseURL = 'https://integrate.api.nvidia.com/v1/chat/completions';
    actualModelId = modelId.replace('nvidia/', '');
    // NVIDIA NIM does not currently support deepseek-r1 as a standard api model, fallback
    if (actualModelId.includes('deepseek-r1') || actualModelId.includes('deepseek-ai')) {
      actualModelId = 'meta/llama-3.3-70b-instruct';
    } else if (actualModelId.includes('kimi-2.5')) {
      actualModelId = 'moonshotai/kimi-k2.5';
    }
  } else if (modelId.startsWith('gpt')) {
    apiKey = config?.openaiKey || '';
    baseURL = 'https://api.openai.com/v1/chat/completions';
  } else if (modelId.startsWith('claude')) {
    apiKey = config?.anthropicKey || '';
    baseURL = 'https://api.anthropic.com/v1/messages';
  }

  // Disable Direct Client FETCH in standard web environments to avoid CORS issues.
  // We will prefer the server-side proxy which is more reliable.
  const isCapacitor = (window as any).Capacitor !== undefined;

  // Handle Anthropic specifically since its API structure is completely different
  if (isCapacitor && modelId.startsWith('claude') && apiKey && baseURL) {
    logger.info(`[chatWithAI] Using Direct Client FETCH for Anthropic ${modelId}`);
    try {
      const fetchPayload: any = {
        model: modelId,
        max_tokens: 4096,
        system: systemInstruction || "",
        messages: formattedMessages.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: typeof msg.content === 'string' ? msg.content : msg.content.map((c: any) => c.text || JSON.stringify(c)).join(' ')
        })),
        temperature: 0.7
      };

      const response = await fetch(baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerously-allow-browser': 'true' // Capacitor runs as native, but this is required for Webpack/Browser environments
        },
        body: JSON.stringify(fetchPayload)
      });
      
      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        const errMsg = errJson?.error?.message || await response.text() || 'Unknown error';
        throw new Error(`[${response.status}] ${errMsg}`);
      }
      
      const payload = await response.json();
      const contentStr = payload.content?.[0]?.text || '{}';
      
      if (responseSchema) {
        return robustParseJson(contentStr);
      }
      
      return { text: contentStr };
    } catch (e: any) {
      logger.error(`[chatWithAI] Direct fetch failed for ${modelId}`, e);
      throw e;
    }
  }

  // Handle OpenAI-compatible endpoints
  if (isCapacitor && apiKey && baseURL && !modelId.startsWith('claude')) {
    logger.info(`[chatWithAI] Using Direct Client FETCH (CORS Safe in Capacitor) for ${modelId}`);
    try {
      const fetchPayload: any = {
        model: actualModelId,
        messages: [
          ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
          ...formattedMessages.map(msg => ({
            role: msg.role,
            content: typeof msg.content === 'string' ? msg.content : msg.content.map((c: any) => c.text || JSON.stringify(c)).join(' ')
          }))
        ],
        temperature: 0.7
      };

      if (responseSchema) {
        // Since responseSchema is a Zod object, it cannot be passed directly into OpenAI's json_schema object
        // Use standard json_object format instead
        fetchPayload.response_format = { type: 'json_object' };
      }

      const response = await fetch(baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://souschef.app',
          'X-Title': 'SousChef AI'
        },
        body: JSON.stringify(fetchPayload)
      });
      
      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        const errMsg = errJson?.error?.message || await response.text() || 'Unknown error';
        throw new Error(`[${response.status}] ${errMsg}`);
      }
      
      const payload = await response.json();
      const contentStr = payload.choices?.[0]?.message?.content || '{}';
      
      if (responseSchema) {
        return robustParseJson(contentStr);
      }
      
      return { text: contentStr };
    } catch (e: any) {
      logger.error(`[chatWithAI] Direct fetch failed for ${modelId}`, e);
      throw e; // Fail directly in Capacitor apps
    }
  }

  // If not Gemini or if multi-agent/insights/object is requested, prefer server proxy
  if (!modelId.startsWith("gemini") || type || responseSchema) {
    logger.info(`[chatWithAI] Calling server proxy for ${modelId}${type ? ` (type: ${type})` : ''}`);
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId,
        messages: formattedMessages,
        systemInstruction,
        type: type || (responseSchema ? 'object' : 'text'),
        // No longer sending config/keys to server for security (P0 #3)
        ...(type === 'multi-agent' ? { inventoryData: tools?.inventory, recipeData: tools?.recipes } : {}),
        ...(type === 'insights' ? { inventory: tools?.inventory, recipes: tools?.recipes } : {})
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `AI request failed: ${response.status}`);
    }

    const result = await response.json();
    if (type === 'multi-agent' || type === 'insights' || responseSchema) {
      return result.object;
    }
    return { text: result.text, functionCalls: result.toolCalls };
  }

  // Handle Gemini directly via SDK (only for simple text chat when direct access is preferred)
  logger.info(`[chatWithAI] Using Direct Client SDK for Gemini: ${modelId}`);
  try {
    const geminiMessages = convertToGeminiMessages(formattedMessages);
    const res = await googleAI.models.generateContent({
      model: modelId,
      contents: geminiMessages,
      config: {
        systemInstruction: systemInstruction || undefined,
        temperature: 0.7,
      }
    });
    
    return { text: res.text || "" };
  } catch (e: any) {
    logger.error(`[chatWithAI] Direct Gemini SDK fetch failed`, { error: e.message, raw: e });
    
    // As a last resort, if direct SDK fails, try the server proxy if not Capacitor
    if (!isCapacitor) {
      logger.info(`[chatWithAI] Retrying via server proxy after direct SDK failure...`);
      return chatWithAI(modelId, messages, systemInstruction, tools, config, responseSchema, type || 'text');
    }
    
    throw e;
  }
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
  return chatWithAI(
    modelId,
    messages,
    systemInstruction,
    { inventory: inventoryData, recipes: recipeData },
    config,
    undefined,
    'multi-agent'
  );
}

/**
 * Proactive Insight Agent (Feature #4)
 */
export async function generateProactiveInsights(
  modelId: string,
  inventory: any[],
  recipes: any[],
  config?: AIConfig
) {
  return chatWithAI(
    modelId,
    [],
    "",
    { inventory, recipes },
    config,
    undefined,
    'insights'
  );
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
      logger.info(`[chatWithAIWithFallback] Trying model: ${currentModelId}`);
      
      // 45s Timeout wrapper
      const aiCallPromise = chatWithAI(currentModelId, messages, systemInstruction, tools, config, responseSchema);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("AI Request Timeout - Quá thời gian phản hồi (45s)")), 45000);
      });
      
      return await Promise.race([aiCallPromise, timeoutPromise]);
    } catch (error: any) {
      logger.warn(`[chatWithAIWithFallback] Error with ${currentModelId}: ${error.message}`);
      lastError = error;
      
      // If it's a rate limit, high demand, or quota issue, wait a bit before trying fallback
      const errorMsg = error.message.toLowerCase();
      if (error.message.includes('[429]') || 
          errorMsg.includes('high demand') || 
          errorMsg.includes('quota') || 
          errorMsg.includes('limit')) {
        logger.info(`[chatWithAIWithFallback] Temporary error or limit reached, waiting 2s before fallback...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  logger.error(`[chatWithAIWithFallback] All models failed`, lastError);
  throw lastError || new Error("All AI models failed.");
}

/**
 * Fallback mechanism for Multi-Agent Chat
 */
export async function multiAgentChatWithFallback(
  modelId: string,
  messages: any[],
  systemInstruction: string,
  config?: AIConfig,
  inventoryData?: any[],
  recipeData?: any[],
  fallbackModelIds: string[] = []
) {
  const modelsToTry = [modelId, ...fallbackModelIds];
  let lastError: any = null;

  for (const currentModelId of modelsToTry) {
    try {
      logger.info(`[multiAgentChatWithFallback] Trying model: ${currentModelId}`);
      return await multiAgentChat(currentModelId, messages, systemInstruction, config, inventoryData, recipeData);
    } catch (error: any) {
      logger.warn(`[multiAgentChatWithFallback] Error with ${currentModelId}: ${error.message}`);
      
      // Enhance error message with model info
      const errMsg = error.message || String(error);
      lastError = new Error(`[${currentModelId.split('/').pop()}] ${errMsg}`);

      // If it's a rate limit, high demand, or quota issue, wait a bit before trying fallback
      const errorStr = errMsg.toLowerCase();
      if (errorStr.includes('[429]') || 
          errorStr.includes('high demand') || 
          errorStr.includes('quota') || 
          errorStr.includes('limit')) {
        logger.info(`[multiAgentChatWithFallback] Temporary error or limit reached, waiting 2s before fallback...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  logger.error(`[multiAgentChatWithFallback] All models failed`, lastError);
  throw lastError || new Error("All AI models failed.");
}
