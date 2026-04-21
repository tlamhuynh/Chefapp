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
  responseSchema?: any
) {
  const formattedMessages = formatMessages(messages);
  logger.info(`[chatWithAI] Request to ${modelId}`, { messages: formattedMessages, type: responseSchema ? 'object' : 'text' });

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

  // Handle Gemini directly via SDK instead of hitting the server API proxy
  // This ensures it works purely client-side when exported as an APK or Static Website
  if (modelId.startsWith("gemini")) {
    let mappedModelId = modelId;
    // Remove aggressive suffixing that caused 404s for some users
    // The bare IDs like gemini-1.5-flash are usually sufficient and more compatible
    if (modelId === 'gemini-3.1-flash-lite-preview' || modelId === 'gemini-3.1-pro-preview' || modelId === 'gemini-2.0-flash') {
      mappedModelId = modelId;
    }

    logger.info(`[chatWithAI] Using Direct Client SDK for Gemini: ${mappedModelId}`);
    try {
      const gApiKey = config?.googleKey || process.env.GEMINI_API_KEY || "";
      if (!gApiKey) throw new Error("Missing Gemini API Key");
      
      const genAIClient = new GoogleGenAI({ apiKey: gApiKey });
      const geminiMessages = convertToGeminiMessages(formattedMessages);
      
      const res = await genAIClient.models.generateContent({
        model: mappedModelId,
        contents: geminiMessages,
        config: {
          systemInstruction: systemInstruction || undefined,
          temperature: 0.7,
          responseMimeType: responseSchema ? "application/json" : undefined,
          responseSchema: responseSchema
        }
      });
      
      const contentStr = res.text || '{}';
      
      if (responseSchema) {
        return robustParseJson(contentStr);
      }
      
      return { text: contentStr };
    } catch (e: any) {
      logger.error(`[chatWithAI] Direct Gemini fetch failed`, { error: e.message, raw: e });
      let errorMessage = e.message || String(e);
      if (errorMessage.toLowerCase().includes("high demand") || errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        errorMessage = "Hệ thống AI hiện đang quá tải (High Demand). Vui lòng thử lại sau ít phút hoặc đổi sang model khác trong Cài đặt.";
      } else if (errorMessage.includes("404") || errorMessage.includes("NOT_FOUND")) {
        errorMessage = `Model "${mappedModelId}" không tìm thấy hoặc chưa được hỗ trợ với cấu hình API Key này.`;
      }
      throw new Error(errorMessage);
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
    let errorData;
    const text = await response.text();
    try {
      errorData = JSON.parse(text);
    } catch {
      errorData = { error: text.substring(0, 100) };
    }
    logger.error(`[chatWithAI] Error from ${modelId}`, errorData);
    const msg = errorData.error || errorData.rawError || `AI call failed (HTTP ${response.status})`;
    
    // Auto-fallback mechanism
    if (response.status === 429 || response.status === 504) {
      const fallbackModel = 'gemini-2.0-flash';
      if (!modelId.includes('flash') && modelId !== fallbackModel) {
        logger.warn(`[chatWithAI] Model ${modelId} failed with ${response.status}, auto-falling back to ${fallbackModel}...`);
        return chatWithAI(fallbackModel, messages, systemInstruction, tools, config, responseSchema);
      }
    }

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
  logger.info(`[multiAgentChat] Request to ${modelId} from Frontend`, { type: 'multi-agent' });

  // Agent 1: Creative Chef
  const creativePrompt = `
    ${systemInstruction}
    BẠN LÀ CREATIVE CHEF AGENT.
    Nhiệm vụ: Đề xuất các món ăn, thực đơn hoặc giải pháp sáng tạo.
    Hãy tập trung vào hương vị, trải nghiệm khách hàng và sự độc đáo.
  `;
  
  logger.info(`[multiAgentChat] Calling Creative Agent`);
  let proposal = "";
  try {
    const res1 = await chatWithAI(modelId, formattedMessages, creativePrompt, undefined, config);
    proposal = res1.text || "";
  } catch(e) {
    logger.error("Creative Agent failed", e);
    throw e;
  }

  // Agent 2: Financial
  const financialPrompt = `
    BẠN LÀ FINANCIAL & INVENTORY EXPERT.
    Dữ liệu kho hiện tại: ${JSON.stringify(inventoryData?.slice(0, 20) || [])}
    Dữ liệu công thức hiện tại: ${JSON.stringify(recipeData?.slice(0, 10) || [])}
    Nhiệm vụ: Phân tích đề xuất của Creative Chef dưới góc độ chi phí và khả năng thực thi.
    Đề xuất của Creative Chef: "${proposal}"
  `;
  
  logger.info(`[multiAgentChat] Calling Financial Agent`);
  let review = "";
  try {
    const res2 = await chatWithAI(modelId, [{ role: 'user', content: "Hãy phân tích đề xuất trên." }], financialPrompt, undefined, config);
    review = res2.text || "";
  } catch(e) {
    logger.error("Financial Agent failed", e);
    // If it fails, we fall through orchestrator with empty review
    review = "Khả năng phân tích tài chính tạm thời không khả dụng.";
  }

  // Agent 3: Orchestrator
  const orchestratorPrompt = `
    BẠN LÀ BẾP TRƯỞNG ĐIỀU PHỐI (ORCHESTRATOR).
    Dưới đây là cuộc thảo luận nội bộ giữa Creative Chef và Financial Expert:
    - Sáng tạo: ${proposal}
    - Phản biện tài chính: ${review}
    
    Nhiệm vụ: Tổng hợp câu trả lời cuối cùng cho người dùng và ĐỀ XUẤT CÁC HÀNH ĐỘNG THỰC THI (proposedActions), kèm theo cấu trúc công thức (recipe) và gợi ý (suggestions) nếu phù hợp.
    
    QUY TẮC TRẢ LỜI:
    1. TRONG TRƯỜNG 'text': Trình bày câu trả lời dưới dạng Markdown đẹp. KHÔNG ĐƯỢC trả về nguyên khối JSON trong phần này. Nếu có danh sách nguyên liệu, hãy dùng định dạng BẢNG (Table) Markdown để người dùng dễ theo dõi.
    2. TRONG TRƯỜNG 'proposedActions': Đây là nơi chứa dữ liệu máy tính đọc được để thực thi hành động. PHẢI TRẢ VỀ mảng này nếu có hành động cần thiết (ví dụ: tạo công thức mới theo sáng tạo).
    3. TRONG TRƯỜNG 'recipe': Gửi kèm thông tin công thức theo cấu trúc chi tiết (mảng nguyên liệu, hướng dẫn) ĐỂ HIỂN THỊ LƯU NHANH TRÊN MÀN HÌNH CHAT.
    4. TRONG TRƯỜNG 'suggestions': Các hành động gợi ý tiếp theo giúp người dùng lựa chọn.
    
    CÁC LOẠI HÀNH ĐỘNG HỖ TRỢ:
    1. 'add_recipe': Thêm một công thức mới. Data CẦN THIẾT: { title, ingredients: [{name, amount, unit}], instructions }.
    2. 'update_inventory': Cập nhật số lượng tồn kho. Data CẦN THIẾT: { name, amount }.
    
    Nếu thảo luận có nhắc việc tạo món mới, HÃY CUNG CẤP CẢ 'recipe' VÀ hành động 'add_recipe' để hệ thống gợi ý lưu cho người dùng.
    
    Hãy luôn trả về kết quả KHÔNG CÓ BẤT KỲ ĐOẠN TEXT GÌ BÊN NGOÀI, CHỈ TRẢ VỀ JSON HỢP LỆ THEO ĐÚNG CẤU TRÚC SAU:
    { "text": "Câu trả lời cuối...", "internalMonologue": "Tóm tắt 1 câu", "recipe": { "title": "Tên món", "time": "30p", "ingredients": [{ "name": "...", "amount": "...", "unit": "..." }], "instructions": ["b1", "b2"], "notes": "" }, "suggestions": [{ "label": "Lưu công thức", "action": "save_recipe" }, { "label": "Gợi ý nguyên liệu mua thêm", "action": "suggest_buy" }] }
  `;

  logger.info(`[multiAgentChat] Calling Orchestrator`);
  const responseSchema = z.object({
    text: z.string(),
    internalMonologue: z.string().optional(),
    proposedActions: z.array(z.object({
      type: z.string(),
      data: z.any(),
      reason: z.string().optional()
    })).optional(),
    recipe: z.object({
      title: z.string(),
      description: z.string().optional(),
      time: z.string().optional(),
      difficulty: z.string().optional(),
      ingredients: z.array(z.object({ name: z.string(), amount: z.union([z.string(), z.number()]).optional(), unit: z.string().optional() })).optional(),
      instructions: z.array(z.string()).optional(),
      notes: z.string().optional()
    }).optional(),
    suggestions: z.array(z.object({ label: z.string(), action: z.string() })).optional()
  });

  return await chatWithAI(
    modelId,
    [{ role: 'user', content: "Hãy đưa ra kết quả cuối cùng dưới dạng JSON chứa các trường: text, internalMonologue, proposedActions, recipe, suggestions." }],
    orchestratorPrompt,
    undefined,
    config,
    responseSchema
  );
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
      // Map to most stable IDs only if necessary, otherwise use original
      let mappedModelId = modelId.startsWith('gemini') ? modelId : 'gemini-2.0-flash';

      const systemPrompt = `
        BẠN LÀ KITCHEN INTELLIGENCE AGENT (TRUY XUẤT TỪ GEMINI ${modelId}).
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

      const gApiKey = config?.googleKey || process.env.GEMINI_API_KEY || "";
      const tempGenAI = new GoogleGenAI({ apiKey: gApiKey });
      
      const response = await tempGenAI.models.generateContent({
        model: mappedModelId,
        contents: [{ role: 'user', parts: [{ text: "Phân tích dữ liệu ngay và trả về JSON." }] }],
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

      const responseText = response.text;
      
      if (!responseText) {
        throw new Error("Gemini returned empty text");
      }

      return robustParseJson(responseText);
    } catch (error: any) {
      logger.error(`[generateProactiveInsights] Gemini frontend call failed`, { error: error.message, raw: error });
      let errorMessage = error.message || String(error);
      if (errorMessage.toLowerCase().includes("high demand") || errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        errorMessage = "Hệ thống AI hiện đang quá tải (High Demand). Vui lòng thử lại sau ít phút.";
      } else if (errorMessage.includes("404") || errorMessage.includes("NOT_FOUND")) {
        errorMessage = `Model "${modelId}" không tìm thấy hoặc chưa được hỗ trợ với cấu hình API Key này.`;
      }
      throw new Error(errorMessage);
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
