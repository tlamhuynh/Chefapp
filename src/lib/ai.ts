import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// Types
export type AIProvider = 'google' | 'openai' | 'anthropic';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
}

export const AVAILABLE_MODELS: AIModel[] = [
  { id: 'gemini-flash-latest', name: 'Gemini 3 Flash', provider: 'google', description: 'Mặc định & Miễn phí. Tốc độ cực nhanh, hỗ trợ RecipeCraw tốt nhất.' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'google', description: 'Mạnh mẽ nhất. Phân tích chi phí và chiến lược kinh doanh chuyên sâu.' },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai', description: 'Siêu tiết kiệm. Phản hồi cực nhanh, thông minh vượt trội trong tầm giá.' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic', description: 'Nhanh & Mượt. Văn phong tiếng Việt tự nhiên, phù hợp viết nội dung menu.' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Cao cấp. Model đa năng nhất của OpenAI cho mọi tác vụ.' },
  { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: 'Đỉnh cao tư duy. Khả năng lập luận và giải quyết vấn đề phức tạp nhất.' },
];

// Clients (Lazy initialization)
let googleAI: GoogleGenAI | null = null;
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

export interface AIConfig {
  openaiKey?: string;
  anthropicKey?: string;
}

function getGoogleAI() {
  if (!googleAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is missing");
    googleAI = new GoogleGenAI({ apiKey: key });
  }
  return googleAI;
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

export async function chatWithAI(
  modelId: string,
  messages: any[],
  systemInstruction: string,
  tools?: any[],
  config?: AIConfig
) {
  const model = AVAILABLE_MODELS.find(m => m.id === modelId) || AVAILABLE_MODELS[0];

  if (model.provider === 'google') {
    const ai = getGoogleAI();
    const response = await ai.models.generateContent({
      model: model.id,
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
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "";
    
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

  throw new Error("Provider không hỗ trợ");
}
