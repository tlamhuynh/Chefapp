import { z } from 'zod';
import { logger } from './logger';
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini in frontend as per skill requirement
const googleAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

// Types
export type AIProvider = 'google' | 'openai' | 'anthropic' | 'nvidia' | 'groq' | 'openrouter';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
}

export const AVAILABLE_MODELS: AIModel[] = [
  { id: 'gemini-flash-latest', name: 'Gemini Flash', provider: 'google', description: 'Model tốc độ cao từ Google, tối ưu cho phân tích nhanh.' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini Pro (3.1)', provider: 'google', description: 'Model mạnh nhất từ Google, hỗ trợ suy luận phức tạp.' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'google', description: 'Model thế hệ mới nhất, cực nhanh và thông minh.' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Model đa phương thức mạnh mẽ từ OpenAI.' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', description: 'Cực nhanh, thông minh và giá thành tối ưu.' },
  { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: 'Thông minh nhất hiện nay. Văn phong cực tốt.' },
  { id: 'groq/llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'groq', description: 'Tốc độ cực nhanh từ Groq. Phản hồi gần như tức thì.' },
  { id: 'nvidia/meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (NVIDIA)', provider: 'nvidia', description: 'Model mạnh mẽ từ NVIDIA NIM, độ trễ thấp.' },
  { id: 'openrouter/liquid/lfm-40b', name: 'Liquid LFM 40B (OpenRouter)', provider: 'openrouter', description: 'Mô hình hiệu suất tốt và linh hoạt.' },
  { id: 'openrouter/anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (OpenRouter)', provider: 'openrouter', description: 'Truy cập qua OpenRouter' },
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
    // Basic conversion logic - this might need to be more robust for complex schemas
    const parameters = definition.parameters;
    // The SDK expects JSON schema format which matches Zod's JSON output roughly
    functionDeclarations.push({
      name,
      description: definition.description,
      parameters: parameters
    });
  });
  
  return [{ functionDeclarations }];
}

// Helper to robustly parse JSON from AI responses
function robustParseJson(jsonStr: string) {
  if (!jsonStr) return {};
  
  let cleaned = jsonStr.trim();
  
  // Remove markdown code blocks if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '');
  }

  // Extract the first block that looks like JSON or Array
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  try {
    return JSON.parse(cleaned);
  } catch (e: any) {
    logger.warn("[robustParseJson] Initial parse failed, attempting cleanup", { error: e.message });
    
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
  const mappedModelId = modelId.includes('flash') ? 'gemini-flash-latest' : 
                       modelId.includes('pro') ? 'gemini-3.1-pro-preview' : 
                       'gemini-flash-latest';

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
  responseSchema?: any
) {
  const formattedMessages = formatMessages(messages);
  logger.info(`[chatWithAI] Request to ${modelId}`, { messages: formattedMessages, type: responseSchema ? 'object' : 'text' });

  // Handle Gemini directly in frontend
  if (modelId.includes('gemini') || modelId.includes('google')) {
    try {
      // Map prohibited or common IDs to recommended aliases for the @google/genai SDK
      let mappedModelId = modelId;
      if (modelId.includes('flash') || modelId === 'gemini-1.5-flash') {
        mappedModelId = 'gemini-flash-latest';
      } else if (modelId.includes('pro') || modelId === 'gemini-1.5-pro') {
        mappedModelId = 'gemini-3.1-pro-preview';
      } else if (modelId === 'gemini-3-flash-preview') {
        mappedModelId = 'gemini-3-flash-preview';
      }

      const geminiMessages = convertToGeminiMessages(formattedMessages);
      
      // Separate history and latest message
      const history = geminiMessages.slice(0, -1);
      const latestMessage = geminiMessages[geminiMessages.length - 1];

      const genConfig: any = {
        systemInstruction: systemInstruction,
        maxOutputTokens: 4096,
        temperature: 0.7,
      };

      if (responseSchema) {
        genConfig.responseMimeType = "application/json";
      }

      if (tools) {
        genConfig.tools = convertToGeminiTools(tools);
      }

      const response = await googleAI.models.generateContent({
        model: mappedModelId,
        contents: geminiMessages,
        config: genConfig
      });

      // The SDK response structure: response.text or response.response.text() 
      const res = response as any;
      const resultText = res.text || (res.response && typeof res.response.text === 'function' ? res.response.text() : '');

      if (responseSchema) {
        return robustParseJson(resultText || '{}');
      }

      return {
        text: resultText,
        functionCalls: response.functionCalls?.map((fc: any) => ({
          name: fc.name,
          args: fc.args
        }))
      };
    } catch (error: any) {
      logger.error(`[chatWithAI] Gemini frontend failed, falling back to server`, error);
    }
  }

  // Call server-side proxy to avoid CORS and keep keys secure (for non-Google or fallback)
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId,
      messages: formattedMessages,
      systemInstruction,
      tools,
      config,
      responseSchema,
      type: responseSchema ? 'object' : 'text'
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    logger.error(`[chatWithAI] Error from ${modelId}`, errorData);
    const msg = errorData.error || `AI call failed`;
    throw new Error(`[${response.status}] ${msg}`);
  }

  const result = await response.json();
  logger.debug(`[chatWithAI] Response from ${modelId}`, result);
  
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
  const formattedMessages = formatMessages(messages);
  logger.info(`[multiAgentChat] Request to ${modelId}`, { messages: formattedMessages, type: 'multi-agent' });

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId,
      messages: formattedMessages,
      systemInstruction,
      config,
      inventoryData,
      recipeData,
      type: 'multi-agent'
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    logger.error(`[multiAgentChat] Error from ${modelId}`, errorData);
    const msg = errorData.error || `Multi-agent call failed`;
    throw new Error(`[${response.status}] ${msg}`);
  }

  const result = await response.json();
  logger.debug(`[multiAgentChat] Response from ${modelId}`, result);
  return result.object;
}

/**
 * Proactive Insight Agent (Feature #4)
 * Runs in background to find optimizations
 * Now calls Gemini directly from frontend to avoid server-side proxy limits
 */
export async function generateProactiveInsights(
  modelId: string,
  inventory: any[],
  recipes: any[],
  config?: AIConfig
) {
  logger.info(`[generateProactiveInsights] Request to ${modelId}`, { type: 'insights' });
  
  // Use Gemini SDK directly in frontend if it's a Google model
  if (modelId.includes('gemini') || modelId.includes('google')) {
    try {
      // Map prohibited or common IDs to recommended aliases for the @google/genai SDK
      let mappedModelId = modelId;
      if (modelId.includes('flash') || modelId === 'gemini-1.5-flash') {
        mappedModelId = 'gemini-flash-latest';
      } else if (modelId.includes('pro') || modelId === 'gemini-1.5-pro') {
        mappedModelId = 'gemini-3.1-pro-preview';
      } else if (modelId === 'gemini-3-flash-preview') {
        mappedModelId = 'gemini-3-flash-preview';
      }

      const systemPrompt = `
        BẠN LÀ KITCHEN INTELLIGENCE AGENT.
        Nhiệm vụ: Phân tích dữ liệu kho và công thức để tìm ra các cơ hội tối ưu hóa.
        Dữ liệu kho: ${JSON.stringify(inventory.slice(0, 30))}
        Dữ liệu công thức: ${JSON.stringify(recipes.slice(0, 20))}
        
        TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON SAU:
        {
          "insights": [
            { "title": "string", "description": "string", "type": "warning|tip|alert", "priority": "high|medium|low" }
          ]
        }
      `;

      const response = await googleAI.models.generateContent({
        model: mappedModelId,
        contents: "Phân tích dữ liệu ngay và trả về JSON.",
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              insights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    type: { type: Type.STRING },
                    priority: { type: Type.STRING }
                  },
                  required: ["title", "description", "type", "priority"]
                }
              }
            },
            required: ["insights"]
          }
        }
      });

      if (!response.text) {
        throw new Error("Gemini returned empty text");
      }

      return robustParseJson(response.text);
    } catch (error: any) {
      logger.error(`[generateProactiveInsights] Gemini frontend call failed`, error);
      // Fallback to server proxy if frontend fails (maybe for non-Google models anyway)
    }
  }

  // Fallback to existing server proxy (for Groq/OpenAI or if frontend fails)
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
    logger.error(`[generateProactiveInsights] Error from ${modelId}`, errorData);
    const msg = errorData.error || `Insights call failed`;
    throw new Error(`[${response.status}] ${msg}`);
  }

  const result = await response.json();
  logger.debug(`[generateProactiveInsights] Response from ${modelId}`, result);
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
      logger.info(`[chatWithAIWithFallback] Trying model: ${currentModelId}`);
      return await chatWithAI(currentModelId, messages, systemInstruction, tools, config, responseSchema);
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
      lastError = error;

      // If it's a rate limit, high demand, or quota issue, wait a bit before trying fallback
      const errorMsg = error.message.toLowerCase();
      if (error.message.includes('[429]') || 
          errorMsg.includes('high demand') || 
          errorMsg.includes('quota') || 
          errorMsg.includes('limit')) {
        logger.info(`[multiAgentChatWithFallback] Temporary error or limit reached, waiting 2s before fallback...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  logger.error(`[multiAgentChatWithFallback] All models failed`, lastError);
  throw lastError || new Error("All AI models failed.");
}
