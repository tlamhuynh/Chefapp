import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, streamText, tool, generateObject } from 'ai';
import { z } from 'zod';

// Types
export type AIProvider = 'google' | 'openai' | 'anthropic' | 'openrouter' | 'nvidia' | 'groq';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
}

export const AVAILABLE_MODELS: AIModel[] = [
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', provider: 'google', description: 'Rẻ nhất & Nhanh nhất. Phù hợp cho các tác vụ đơn giản.' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'google', description: 'Mặc định & Cân bằng. Tốc độ nhanh, thông minh.' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'google', description: 'Mạnh mẽ nhất. Phân tích chi phí và chiến lược kinh doanh chuyên sâu.' },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai', description: 'Siêu tiết kiệm. Phản hồi cực nhanh, thông minh vượt trội.' },
  { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: 'Thông minh nhất hiện nay. Văn phong cực tốt.' },
  { id: 'openrouter/deepseek/deepseek-chat', name: 'DeepSeek V3 (OpenRouter)', provider: 'openrouter', description: 'Model mã nguồn mở mạnh mẽ nhất từ Trung Quốc.' },
  { id: 'groq/llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'groq', description: 'Tốc độ cực nhanh từ Groq. Phản hồi gần như tức thì.' },
];

export interface AIConfig {
  openaiKey?: string;
  anthropicKey?: string;
  googleKey?: string;
  openrouterKey?: string;
  nvidiaKey?: string;
  groqKey?: string;
}

// Model Provider Factory
function getModelProvider(modelId: string, config?: AIConfig) {
  const model = AVAILABLE_MODELS.find(m => m.id === modelId) || AVAILABLE_MODELS[0];
  
  if (model.provider === 'google') {
    const google = createGoogleGenerativeAI({
      apiKey: config?.googleKey || process.env.GEMINI_API_KEY,
    });
    return google(model.id);
  }

  if (model.provider === 'openai') {
    const openai = createOpenAI({
      apiKey: config?.openaiKey || process.env.OPENAI_API_KEY,
    });
    return openai(model.id);
  }

  if (model.provider === 'anthropic') {
    const anthropic = createAnthropic({
      apiKey: config?.anthropicKey || process.env.ANTHROPIC_API_KEY,
    });
    return anthropic(model.id);
  }

  if (model.provider === 'groq') {
    const groq = createOpenAI({
      apiKey: config?.groqKey || process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    return groq(model.id.split('/').pop() || model.id);
  }

  if (model.provider === 'openrouter') {
    const openrouter = createOpenAI({
      apiKey: config?.openrouterKey || process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });
    return openrouter(model.id);
  }

  throw new Error(`Provider ${model.provider} not supported yet in AI SDK refactor`);
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
  const modelProvider = getModelProvider(modelId, config);

  // Convert messages to AI SDK format
  const aiMessages = messages.map(m => ({
    role: m.role === 'model' ? 'assistant' : 'user',
    content: m.parts.map((p: any) => {
      if (p.inlineData) {
        return { type: 'image', image: p.inlineData.data, mimeType: p.inlineData.mimeType };
      }
      return { type: 'text', text: p.text || "" };
    })
  }));

  // If we have a schema, we use generateObject for structured output
  if (responseSchema && !tools) {
    const { object } = await generateObject({
      model: modelProvider,
      system: systemInstruction,
      messages: aiMessages as any,
      schema: responseSchema || z.any(),
      output: 'object',
    });
    return object;
  }

  // Standard text generation with tools
  const { text, toolCalls } = await generateText({
    model: modelProvider,
    system: systemInstruction,
    messages: aiMessages as any,
    tools: tools,
  });

  // Handle tool calls for backward compatibility with existing code
  if (toolCalls && toolCalls.length > 0) {
    return { 
      text, 
      functionCalls: toolCalls.map(tc => ({
        name: tc.toolName,
        args: (tc as any).args || (tc as any).arguments
      }))
    };
  }

  // Try to parse JSON if expected
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {}

  return { text, suggestions: [] };
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
  const modelProvider = getModelProvider(modelId, config);

  // Agent 1: Creative Chef (Proposal)
  const creativePrompt = `
    ${systemInstruction}
    BẠN LÀ CREATIVE CHEF AGENT.
    Nhiệm vụ: Đề xuất các món ăn, thực đơn hoặc giải pháp sáng tạo.
    Hãy tập trung vào hương vị, trải nghiệm khách hàng và sự độc đáo.
  `;

  const { text: proposal } = await generateText({
    model: modelProvider,
    system: creativePrompt,
    messages: messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.parts[0].text })) as any,
  });

  // Agent 2: Financial & Inventory Expert (Reviewer)
  const financialPrompt = `
    BẠN LÀ FINANCIAL & INVENTORY EXPERT.
    Dữ liệu kho hiện tại: ${JSON.stringify(inventoryData?.slice(0, 20))}
    Dữ liệu công thức hiện tại: ${JSON.stringify(recipeData?.slice(0, 10))}

    Nhiệm vụ: Phân tích đề xuất của Creative Chef dưới góc độ chi phí và khả năng thực thi.
    Đề xuất của Creative Chef: "${proposal}"

    Hãy đưa ra các phản biện hoặc góp ý để tối ưu hóa lợi nhuận và sử dụng kho hiệu quả.
    Nếu đề xuất tốt, hãy xác nhận. Nếu không, hãy chỉ ra điểm yếu (ví dụ: nguyên liệu đắt, thiếu hàng).
  `;

  const { text: review } = await generateText({
    model: modelProvider,
    system: financialPrompt,
    messages: [{ role: 'user', content: "Hãy phân tích đề xuất trên." }] as any,
  });

  // Agent 3: Orchestrator (Final Response + HITL Actions)
  const orchestratorPrompt = `
    BẠN LÀ BẾP TRƯỞNG ĐIỀU PHỐI (ORCHESTRATOR).
    Dưới đây là cuộc thảo luận nội bộ:
    - Sáng tạo: ${proposal}
    - Phản biện tài chính: ${review}

    Nhiệm vụ:
    1. Tổng hợp câu trả lời cuối cùng cho người dùng, thể hiện sự chuyên nghiệp và đã qua phân tích kỹ lưỡng.
    2. Nếu cần thực hiện các hành động cụ thể (thêm món, cập nhật kho), hãy liệt kê chúng dưới dạng "Proposed Actions" để người dùng phê duyệt (HITL).

    Định dạng trả về JSON:
    {
      "text": "Câu trả lời cuối cùng cho người dùng",
      "internalMonologue": "Tóm tắt ngắn gọn quá trình thảo luận giữa các agent",
      "proposedActions": [
        { "type": "add_recipe", "data": { "title": "...", "ingredients": [...] }, "reason": "..." },
        { "type": "update_inventory", "data": { "name": "...", "amount": 0 }, "reason": "..." }
      ]
    }
  `;

  const { object } = await generateObject({
    model: modelProvider,
    system: orchestratorPrompt,
    messages: [{ role: 'user', content: "Hãy đưa ra kết quả cuối cùng." }] as any,
    schema: z.object({
      text: z.string(),
      internalMonologue: z.string(),
      proposedActions: z.array(z.object({
        type: z.string(),
        data: z.any(),
        reason: z.string()
      })).optional()
    })
  });

  return object;
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
  const modelProvider = getModelProvider(modelId, config);

  const systemPrompt = `
    BẠN LÀ KITCHEN INTELLIGENCE AGENT.
    Nhiệm vụ: Phân tích dữ liệu kho và công thức để tìm ra các cơ hội tối ưu hóa.
    
    Dữ liệu kho: ${JSON.stringify(inventory.slice(0, 30))}
    Dữ liệu công thức: ${JSON.stringify(recipes.slice(0, 20))}

    Hãy đưa ra 3 insight quan trọng nhất. Ví dụ:
    - Cảnh báo hết hàng cho nguyên liệu quan trọng.
    - Gợi ý món ăn để giải phóng hàng tồn kho sắp hết hạn.
    - Cảnh báo món ăn có lợi nhuận thấp do giá nguyên liệu tăng.

    Trả về JSON:
    {
      "insights": [
        { "title": "...", "description": "...", "type": "warning|tip|alert", "priority": "high|medium|low" }
      ]
    }
  `;

  const { object } = await generateObject({
    model: modelProvider,
    system: systemPrompt,
    messages: [],
    schema: z.object({
      insights: z.array(z.object({
        title: z.string(),
        description: z.string(),
        type: z.enum(['warning', 'tip', 'alert']),
        priority: z.enum(['high', 'medium', 'low'])
      }))
    })
  });

  return object;
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
