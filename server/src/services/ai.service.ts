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
   * Main entry point for AI interactions
   */
  static async processChat(params: ChatParams) {
    const { modelId, messages, systemInstruction, type, config } = params;
    const provider = this.getProviderFromModelId(modelId);
    const model = getAIModel(provider, modelId, config);

    logger.debug(`AIService: Processing ${type} chat with ${modelId}`);

    if (type === 'insights') return this.handleInsights(model, params);
    if (type === 'multi-agent') return this.handleMultiAgent(model, params);
    
    return this.handleStandardChat(model, params);
  }

  private static async handleStandardChat(model: LanguageModel, params: ChatParams) {
    const { systemInstruction, messages, type, modelId } = params;
    
    // @ts-ignore - Some LanguageModel types don't expose modelId but generateText needs it for specific logic here
    const formattedMessages = this.formatMessages(messages, modelId);

    const result = await (generateText as any)({
      model,
      system: systemInstruction,
      messages: formattedMessages,
      tools: {
        //@ts-ignore
        search_market_price: tool({
          description: "Tìm kiếm giá thị trường hiện tại của các nguyên liệu tại Việt Nam.",
          parameters: z.object({ ingredients: z.array(z.string()) }),
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
      return { object: ParserService.extractJsonFromText(result.text) || { text: result.text } };
    }

    return { text: result.text, toolCalls: result.toolCalls };
  }

  private static async handleInsights(model: LanguageModel, params: any) {
    const { inventory, recipes } = params;
    const systemPrompt = `BẠN LÀ KITCHEN INTELLIGENCE AGENT. TRẢ VỀ JSON: { "insights": [...] }`;
    const { text } = await generateText({
      model,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Phân tích ngay.' }],
    });
    return { object: ParserService.extractJsonFromText(text) || { insights: [] } };
  }

  private static async handleMultiAgent(model: LanguageModel, params: ChatParams) {
    const { systemInstruction, messages, modelId } = params;
    const formattedMessages = this.formatMessages(messages, modelId);

    const { text: proposal } = await generateText({ model, system: `${systemInstruction}\nBẠN LÀ CREATIVE CHEF.`, messages: formattedMessages });
    const { text: ingredientsJson } = await generateText({ model, system: "JSON list trích xuất", prompt: proposal });
    const ingredients = ParserService.extractJsonFromText<string[]>(ingredientsJson) || [];
    const marketPrices = await searchMarketPrices(ingredients);
    const { text: review } = await generateText({ model, system: `FINANCIAL REVIEW. Giá: ${JSON.stringify(marketPrices)}`, prompt: proposal });
    
    const { text: finalOutputText } = await generateText({
      model,
      system: `ORCHESTRATOR. Creative: ${proposal}. Financial: ${review}. TRẢ VỀ JSON.`,
      messages: [{ role: 'user', content: "Tổng hợp." }],
    });

    return { object: ParserService.extractJsonFromText(finalOutputText) || { text: finalOutputText } };
  }

  private static getProviderFromModelId(modelId: string): string {
    if (modelId.includes('gemini')) return 'google';
    if (modelId.includes('gpt')) return 'openai';
    if (modelId.includes('claude')) return 'anthropic';
    if (modelId.includes('groq')) return 'groq';
    if (modelId.includes('openrouter')) return 'openrouter';
    if (modelId.includes('nvidia')) return 'nvidia';
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
