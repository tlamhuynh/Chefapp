import { generateText, tool, type LanguageModel } from 'ai';
import { z } from 'zod';
import { getAIModel } from '../../../src/server/services/aiProvider';
import { searchMarketPrices } from '../../../src/server/services/market';
import { ParserService } from './parser.service';
import { logger } from '../utils/logger';

export interface ChatParams {
  modelId: string;
  messages: any[];
  systemInstruction?: string;
  type?: 'standard' | 'insights' | 'multi-agent' | 'object';
  config?: any;
}

export class AIService {
  /**
   * Main entry point for AI interactions with built-in server-side fallback
   */
  static async processChat(params: ChatParams) {
    const { modelId, type, config } = params;
    
    // Fallback logic is handled by the client's chatWithAIWithFallback, 
    // so we only need to try the target modelId here.
    const fallbackSequence = [
      modelId
    ];

    // Remove duplicates and keep order
    const modelsToTry = [...new Set(fallbackSequence)];
    let lastError: any = null;
    let skipProviders = new Set<string>();

    for (const currentModelId of modelsToTry) {
      const provider = this.getProviderFromModelId(currentModelId);
      
      if (skipProviders.has(provider)) {
         logger.info(`AIService: Skipping ${currentModelId} because provider ${provider} hit a quota limit recently.`);
         continue;
      }

      try {
        const model = getAIModel(provider, currentModelId, config);

        logger.info(`AIService: Trying ${currentModelId} for ${type} chat`);

        if (type === 'insights') return await this.handleInsights(model, params);
        if (type === 'multi-agent') return await this.handleMultiAgent(model, params);
        
        return await this.handleStandardChat(model, { ...params, modelId: currentModelId });
      } catch (error: any) {
        const errMsg = error.message?.toLowerCase() || '';
        const isQuotaError = errMsg.includes('quota') || errMsg.includes('limit') || errMsg.includes('429') || errMsg.includes('credits') || errMsg.includes('afford');
        const isInvalidKeyError = errMsg.includes('key not valid') || errMsg.includes('api key') || errMsg.includes('không tìm thấy api key') || errMsg.includes('not configured');
        
        logger.warn(`AIService: Model ${currentModelId} failed: ${error.message}`);
        
        // If the key is outright invalid, no point failing over to other models with the same key
        if (isInvalidKeyError) {
          const err: any = new Error("Mã API Key không hợp lệ hoặc chưa được cấu hình. Vui lòng kiểm tra lại 'Trợ lý AI' -> 'Bánh Răng Cài Đặt'.");
          err.statusCode = 401;
          throw err;
        }
        
        // Skip provider on quota error so we don't spam it
        if (isQuotaError) {
           skipProviders.add(provider);
           if (!lastError?.message?.toLowerCase().includes('quota')) {
              lastError = error;
           }
        } else if (!lastError) {
           lastError = error;
        }

        // Try next model...
      }
    }

    if (lastError) {
      const msg = (lastError.message || String(lastError)).toLowerCase();
      if (msg.includes('quota') || msg.includes('429') || msg.includes('limit') || msg.includes('credits') || msg.includes('afford')) {
        const err: any = new Error("Hạn mức API miễn phí (hoặc Credits) của bạn đã hết. Vui lòng vào 'Trợ lý AI' -> 'Bánh Răng Cài Đặt' và nhập thẻ API OpenAI/Anthropic/Groq/OpenRouter của riêng bạn để tiếp tục.");
        err.statusCode = 429;
        throw err;
      }
      if (msg.includes('high demand') || msg.includes('overloaded')) {
        const err: any = new Error("Hệ thống Chef Assistant đang tạm thời có lượng truy cập lớn dẫn đến quá tải. Vui lòng thử lại sau ít phút hoặc sử dụng thẻ API riêng.");
        err.statusCode = 503;
        throw err;
      }
      if (msg.includes('api key') || msg.includes('key not valid')) {
        const err: any = new Error("Mã API Key không hợp lệ. Vui lòng kiểm tra lại cấu hình phím Google/OpenAI.");
        err.statusCode = 401;
        throw err;
      }
      if (msg.includes('500') || msg.includes('status code 500')) {
        const err: any = new Error("Mô hình AI hiện tại đang gặp lỗi từ máy chủ (Error 500) và tất cả hệ thống dự phòng cũng thất bại. Vui lòng thử đổi Mô hình AI khác hoặc thử lại.");
        err.statusCode = 502;
        throw err;
      }
      if (msg.includes('502') || msg.includes('503') || msg.includes('504')) {
        const err: any = new Error("Mô hình AI đang không phản hồi (Lỗi Server/Timeout). Vui lòng thử lại sau.");
        err.statusCode = 504;
        throw err;
      }
      throw lastError;
    }
    throw new Error("Mọi mô hình AI đều thất bại hoặc quá tải.");
  }

  private static async handleStandardChat(model: LanguageModel, params: ChatParams) {
    const { systemInstruction, messages, type, modelId } = params;
    
    // @ts-ignore - Some LanguageModel types don't expose modelId but generateText needs it for specific logic here
    const formattedMessages = this.formatMessages(messages, modelId);

    const result = await (generateText as any)({
      model,
      system: systemInstruction,
      messages: formattedMessages,
      maxRetries: 0, // Fail fast on server to use sequential fallback
      tools: {
        //@ts-ignore
        search_market_price: tool({
          description: "Tìm kiếm giá thị trường hiện tại của các nguyên liệu tại Việt Nam.",
          parameters: z.object({
            ingredients: z.array(z.string().describe("Tên nguyên liệu")).describe("Mảng các nguyên liệu cần tra cứu")
          }),
          //@ts-ignore
          execute: async ({ ingredients }: { ingredients: string[] }) => {
            const data = await searchMarketPrices(ingredients);
            return JSON.stringify(data);
          }
        })
      } as any,
      maxSteps: 3,
    });

    if (type === 'object') {
      let parsed = ParserService.extractJsonFromText(result.text);
      if (parsed === null) {
         parsed = { error: "Failed to parse JSON" };
      } else if (typeof parsed === 'object') {
         // Keep parsed as is
      } else {
         parsed = { value: parsed };
      }
      return { object: { ...(parsed as any), _rawResponse: result.text } };
    }

    return { text: result.text, toolCalls: result.toolCalls };
  }

  private static async handleInsights(model: LanguageModel, params: any) {
    const { inventory, recipes } = params;
    const systemPrompt = `BẠN LÀ KITCHEN INTELLIGENCE AGENT (Chuyên gia phân tích bếp).
Nhiệm vụ của bạn là phân tích dữ liệu nguyên liệu (inventory) và thực đơn (recipes) để đưa ra các insights.
Dữ liệu:
- Inventory: ${JSON.stringify(inventory)}
- Recipes: ${JSON.stringify(recipes)}

TRẢ VỀ JSON CHÍNH XÁC VỚI CÚ PHÁP SAU, KHÔNG CÓ BẤT KỲ VĂN BẢN NÀO KHÁC BÊN NGOÀI:
{
  "insights": [
    { "type": "warning" | "tip" | "info", "title": "Tiêu đề ngắn gọn gọn", "description": "Mô tả chi tiết insight (Ví dụ: sắp hết nguyên liệu x, gợi ý làm món y...)" }
  ]
}`;
    const { text } = await generateText({
      model,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Hãy phân tích và đưa ra 3 insights quan trọng nhất cho tôi.' }],
      maxRetries: 0,
    });
    return { object: ParserService.extractJsonFromText(text) || { insights: [] } };
  }

  private static async handleMultiAgent(model: LanguageModel, params: ChatParams) {
    const { systemInstruction, messages, modelId } = params;
    const formattedMessages = this.formatMessages(messages, modelId);

    const { text: proposal } = await generateText({ model, system: `${systemInstruction}\nBẠN LÀ CREATIVE CHEF.`, messages: formattedMessages, maxRetries: 0 });
    const { text: ingredientsJson } = await generateText({ model, system: "JSON list trích xuất", prompt: proposal, maxRetries: 0 });
    const ingredients = ParserService.extractJsonFromText<string[]>(ingredientsJson) || [];
    const marketPrices = await searchMarketPrices(ingredients);
    const { text: review } = await generateText({ model, system: `FINANCIAL REVIEW. Giá: ${JSON.stringify(marketPrices)}`, prompt: proposal, maxRetries: 0 });
    
    const { text: finalOutputText } = await generateText({
      model,
      system: `ORCHESTRATOR. Creative: ${proposal}. Financial: ${review}. TRẢ VỀ JSON.`,
      messages: [{ role: 'user', content: "Tổng hợp." }],
      maxRetries: 0,
    });

    return { object: ParserService.extractJsonFromText(finalOutputText) || { text: finalOutputText } };
  }

  private static getProviderFromModelId(modelId: string): string {
    if (modelId.startsWith('openrouter/')) return 'openrouter';
    if (modelId.startsWith('groq/')) return 'groq';
    if (modelId.startsWith('nvidia/')) return 'nvidia';
    if (modelId.includes('gemini')) return 'google';
    if (modelId.includes('gpt')) return 'openai';
    if (modelId.includes('claude')) return 'anthropic';
    return 'google';
  }

  private static formatMessages(messages: any[], modelId: string) {
    const visionModels = ['gemini', 'gpt-4o', 'claude-3-5', 'claude-3-opus', 'claude-3-sonnet'];
    const supportsVision = visionModels.some(vm => modelId.toLowerCase().includes(vm));

    return (messages || []).map((m: any) => {
      let role = m.role === 'model' ? 'assistant' : m.role || 'user';
      if (typeof m.content === 'string') return { role, content: m.content || '...' };
      
      const filteredContent = (m.content || []).map((c: any) => {
        if (c.type === 'image' || c.type === 'video' || c.type === 'file') {
          if (!supportsVision || role === 'assistant') return { type: 'text', text: `[Tài liệu đính kèm]` };
          let data = c.image || c.video || c.data;
          if (typeof data !== 'string' && data?.data) data = data.data;
          return { 
            type: c.type, 
            [c.type]: new Uint8Array(Buffer.from(data, 'base64')), 
            mimeType: c.mimeType || (c.type === 'video' ? 'video/mp4' : 'image/jpeg')
          };
        }
        return c;
      });
      return { role, content: filteredContent };
    });
  }
}
