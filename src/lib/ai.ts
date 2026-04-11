import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// Types
export type AIProvider = 'google' | 'openai' | 'anthropic' | 'openrouter' | 'nvidia' | 'groq';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
}

export const AVAILABLE_MODELS: AIModel[] = [
  { id: 'gemini-flash-latest', name: 'Gemini 3 Flash', provider: 'google', description: 'Mặc định & Miễn phí. Tốc độ cực nhanh, hỗ trợ RecipeCraw tốt nhất.' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'google', description: 'Mạnh mẽ nhất. Phân tích chi phí và chiến lược kinh doanh chuyên sâu.' },
  { id: 'openrouter/google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash (OpenRouter)', provider: 'openrouter', description: 'Model mới nhất từ Google qua OpenRouter. Miễn phí/Giá rẻ.' },
  { id: 'openrouter/deepseek/deepseek-chat', name: 'DeepSeek V3 (OpenRouter)', provider: 'openrouter', description: 'Model mã nguồn mở mạnh mẽ, chi phí cực thấp, văn phong tốt.' },
  { id: 'nvidia/llama-3.1-405b-instruct', name: 'Llama 3.1 405B (NVIDIA)', provider: 'nvidia', description: 'Model khổng lồ từ NVIDIA. Miễn phí cho nhà phát triển.' },
  { id: 'groq/llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'groq', description: 'Tốc độ cực nhanh từ Groq. Phản hồi gần như tức thì.' },
  { id: 'groq/mixtral-8x7b-32768', name: 'Mixtral 8x7B (Groq)', provider: 'groq', description: 'Model MoE mạnh mẽ, xử lý ngữ cảnh tốt.' },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai', description: 'Siêu tiết kiệm. Phản hồi cực nhanh, thông minh vượt trội trong tầm giá.' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Cao cấp. Model đa năng nhất của OpenAI cho mọi tác vụ.' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic', description: 'Nhanh & Mượt. Văn phong tiếng Việt tự nhiên, phù hợp viết nội dung menu.' },
  { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: 'Đỉnh cao tư duy. Khả năng lập luận và giải quyết vấn đề phức tạp nhất.' },
];

// Clients (Lazy initialization)
let googleAI: GoogleGenerativeAI | null = null;
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

export interface AIConfig {
  openaiKey?: string;
  anthropicKey?: string;
  googleKey?: string;
  openrouterKey?: string;
  nvidiaKey?: string;
  groqKey?: string;
}

function getGoogleAI(customKey?: string) {
  const key = customKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is missing. Vui lòng cấu hình trong Settings.");
  return new GoogleGenerativeAI(key);
}

function getOpenAI(customKey?: string) {
  const key = customKey || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is missing. Vui lòng cấu hình trong Settings.");
  
  return new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
}

function getAnthropic(customKey?: string) {
  const key = customKey || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is missing. Vui lòng cấu hình trong Settings.");
  
  return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
}

function getOpenRouter(customKey?: string) {
  const key = customKey || process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is missing. Vui lòng cấu hình trong Settings.");
  
  return new OpenAI({ 
    apiKey: key, 
    baseURL: "https://openrouter.ai/api/v1",
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      "HTTP-Referer": window.location.origin,
      "X-Title": "Chef AI App",
    }
  });
}

function getNvidia(customKey?: string) {
  const key = customKey || process.env.NVIDIA_API_KEY;
  if (!key) throw new Error("NVIDIA_API_KEY is missing. Vui lòng cấu hình trong Settings.");
  
  return new OpenAI({ 
    apiKey: key, 
    baseURL: "https://integrate.api.nvidia.com/v1",
    dangerouslyAllowBrowser: true 
  });
}

function getGroq(customKey?: string) {
  const key = customKey || process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is missing. Vui lòng cấu hình trong Settings.");
  
  return new OpenAI({ 
    apiKey: key, 
    baseURL: "https://api.groq.com/openai/v1",
    dangerouslyAllowBrowser: true 
  });
}

export async function chatWithAI(
  modelId: string,
  messages: any[],
  systemInstruction: string,
  tools?: any[],
  config?: AIConfig
) {
  const model = AVAILABLE_MODELS.find(m => m.id === modelId) || AVAILABLE_MODELS[0];

  if (model.provider === 'google') {
    const genAI = getGoogleAI(config?.googleKey);
    const modelInstance = genAI.getGenerativeModel({
      model: model.id,
      systemInstruction: systemInstruction,
    });

    const result = await modelInstance.generateContent({
      contents: messages.map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: m.parts.map((p: any) => {
          if (p.inlineData) {
            return {
              inlineData: {
                data: p.inlineData.data,
                mimeType: p.inlineData.mimeType
              }
            };
          }
          return { text: p.text || "" };
        })
      })),
      generationConfig: {
        responseMimeType: "application/json",
      },
      tools: tools ? [{ functionDeclarations: tools }] : undefined,
    } as any);

    const response = result.response;
    
    if (response.functionCalls && response.functionCalls()) {
      return { functionCalls: response.functionCalls() };
    }

    const text = response.text();
    
    try {
      return JSON.parse(text);
    } catch (e) {
      return { text: text, suggestions: [] };
    }
  }

  if (model.provider === 'openai') {
    const openai = getOpenAI(config?.openaiKey);
    const response = await openai.chat.completions.create({
      model: model.id,
      messages: [
        { role: 'system', content: systemInstruction + "\n\nQUAN TRỌNG: Bạn PHẢI trả về kết quả dưới dạng JSON hợp lệ theo cấu trúc đã yêu cầu." } as any,
        ...messages.map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: m.parts.map((p: any) => p.text).join('\n')
        }))
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content || "{}";
    return JSON.parse(content);
  }

  if (model.provider === 'anthropic') {
    const anthropic = getAnthropic(config?.anthropicKey);
    const response = await anthropic.messages.create({
      model: model.id,
      system: systemInstruction + "\n\nQUAN TRỌNG: Bạn PHẢI trả về kết quả dưới dạng JSON hợp lệ theo cấu trúc đã yêu cầu.",
      max_tokens: 4096,
      messages: messages.map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.parts.map((p: any) => p.text).join('\n')
      })) as any
    });

    const content = (response.content[0] as any).text || "{}";
    try {
      // Anthropic doesn't have a strict JSON mode like OpenAI, so we might need to extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (e) {
      return { text: content, suggestions: [] };
    }
  }

  if (model.provider === 'openrouter' || model.provider === 'nvidia' || model.provider === 'groq') {
    const client = model.provider === 'openrouter' 
      ? getOpenRouter(config?.openrouterKey) 
      : model.provider === 'nvidia'
        ? getNvidia(config?.nvidiaKey)
        : getGroq(config?.groqKey);
    
    const response = await client.chat.completions.create({
      model: model.id.includes('/') ? model.id.split('/').slice(1).join('/') : model.id,
      messages: [
        { role: 'system', content: systemInstruction + "\n\nQUAN TRỌNG: Bạn PHẢI trả về kết quả dưới dạng JSON hợp lệ theo cấu trúc đã yêu cầu." } as any,
        ...messages.map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: m.parts.map((p: any) => p.text).join('\n')
        }))
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content || "{}";
    return JSON.parse(content);
  }

  throw new Error("Provider không hỗ trợ");
}

export async function chatWithAIWithFallback(
  modelId: string,
  messages: any[],
  systemInstruction: string,
  tools?: any[],
  config?: AIConfig,
  fallbackModelIds: string[] = []
) {
  const modelsToTry = [modelId, ...fallbackModelIds];
  let lastError: any = null;

  for (const currentModelId of modelsToTry) {
    try {
      console.log(`Đang thử model: ${currentModelId}`);
      const result = await chatWithAI(currentModelId, messages, systemInstruction, tools, config);
      
      // Kiểm tra xem kết quả có hợp lệ không (có text phản hồi hoặc dữ liệu quan trọng)
      if (result && (result.text || result.recipe || result.photos || result.functionCalls)) {
        return result;
      }
      
      throw new Error("AI trả về phản hồi trống hoặc không hợp lệ");
    } catch (error: any) {
      console.error(`Lỗi với model ${currentModelId}:`, error);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error("Tất cả các model đều thất bại");
}
