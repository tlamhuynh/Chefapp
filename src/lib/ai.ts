import { GoogleGenAI, Type } from "@google/genai";
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
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'google', description: 'Nhanh, hiệu quả cho các tác vụ hàng ngày.' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'google', description: 'Mạnh mẽ, thông minh vượt trội cho các bài toán phức tạp.' },
  { id: 'gemma-4-it', name: 'Gemma 4', provider: 'google', description: 'Model mã nguồn mở mới nhất từ Google, tối ưu cho hội thoại.' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Model hàng đầu từ OpenAI, đa năng và chính xác.' },
  { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: 'Model thông minh nhất từ Anthropic, viết lách và tư duy tốt.' },
];

// Clients (Lazy initialization)
let googleAI: GoogleGenAI | null = null;
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

function getGoogleAI() {
  if (!googleAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is missing");
    googleAI = new GoogleGenAI({ apiKey: key });
  }
  return googleAI;
}

function getOpenAI() {
  if (!openaiClient) {
    const key = (import.meta as any).env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is missing. Vui lòng cấu hình trong Settings.");
    openaiClient = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
  }
  return openaiClient;
}

function getAnthropic() {
  if (!anthropicClient) {
    const key = (import.meta as any).env.VITE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is missing. Vui lòng cấu hình trong Settings.");
    anthropicClient = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  }
  return anthropicClient;
}

export async function chatWithAI(
  modelId: string,
  messages: any[],
  systemInstruction: string,
  tools?: any[]
) {
  const model = AVAILABLE_MODELS.find(m => m.id === modelId) || AVAILABLE_MODELS[0];

  if (model.provider === 'google') {
    const ai = getGoogleAI();
    const response = await ai.models.generateContent({
      model: model.id,
      contents: messages.map(m => ({
        role: m.role,
        parts: m.parts.map((p: any) => {
          if (p.inlineData) return { inlineData: p.inlineData };
          return { text: p.text || "" };
        })
      })),
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      }
    });

    try {
      return JSON.parse(response.text);
    } catch (e) {
      return { text: response.text, suggestions: [] };
    }
  }

  if (model.provider === 'openai') {
    const openai = getOpenAI();
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
    const anthropic = getAnthropic();
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
