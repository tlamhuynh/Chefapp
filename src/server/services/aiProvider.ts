import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { LanguageModel } from 'ai';

export interface AIProviderConfig {
  provider: string;
  modelId: string;
}

/**
 * Standardizes model IDs across different providers.
 */
export function mapModelId(provider: string, mId: string): string {
  let finalId = mId;
  
  // Clean prefixes if they exist
  if (finalId.startsWith('groq/')) finalId = finalId.slice(5);
  if (finalId.startsWith('nvidia/')) finalId = finalId.slice(7);
  if (finalId.startsWith('openrouter/')) finalId = finalId.slice(11);
  if (finalId.startsWith('models/')) finalId = finalId.slice(7);

  // Provider specific remapping
  if (provider === 'groq') {
    if (mId.includes('deepseek-r1-distill-llama-70b')) return 'llama-3.3-70b-versatile';
    return finalId;
  }
  
  if (provider === 'google') {
    // If it's already a specific gemini ID, keep it
    if (mId.startsWith('gemini-')) {
      // Map hallucinated 2.5 back to 2.0
      if (mId.includes('gemini-2.5')) return mId.replace('gemini-2.5', 'gemini-2.0');
      return mId;
    }

    // Default fallback
    return 'gemini-2.0-flash';
  }

  return finalId;
}

/**
 * Initializes the appropriate AI provider and model using Vercel AI SDK.
 * Strictly uses environment variables for API keys.
 */
export function getAIModel(provider: string, modelId: string, config?: any): LanguageModel {
  let finalId = mapModelId(provider, modelId);
  
  const getSafeKey = (key: any) => {
    if (typeof key !== 'string') return undefined;
    const k = key.trim();
    if (!k || k === 'undefined' || k === 'null' || k === 'null_key' || k === '[object Object]') return undefined;
    return k;
  };

  const geminiKey = getSafeKey(process.env.GEMINI_API_KEY) || 
                   getSafeKey(process.env.GOOGLE_GENERATIVE_AI_API_KEY) || 
                   getSafeKey(process.env.GOOGLE_API_KEY);

  if (provider === 'google' || (!provider && finalId.includes('gemini'))) {
    // User key from settings often becomes invalid or stale.
    // In AI Studio environment, we MUST prioritize the platform's GEMINI_API_KEY 
    // unless the user provided something that definitely looks like their own key (not a proxy/placeholder).
    const userKey = getSafeKey(config?.googleKey);
    const finalKey = userKey || geminiKey;
    
    if (!finalKey || finalKey.length < 5) {
      console.error(`[AIProvider] MISSING GOOGLE KEY. Model: ${finalId}. Keys: G_API_KEY=${!!geminiKey}, userKey=${!!userKey}`);
      throw new Error("Không tìm thấy API Key cho Gemini. Vui lòng thiết lập API Key trong cấu hình (Bánh răng cài đặt).");
    }

    // Ensure we use a valid model name for Google
    let googleModelId = finalId;
    if (googleModelId === 'gemini-flash-latest') googleModelId = 'gemini-1.5-flash';
    if (googleModelId === 'gemini-pro-latest') googleModelId = 'gemini-1.5-pro';

    return createGoogleGenerativeAI({ 
      apiKey: finalKey
    })(googleModelId);
  }
  
  switch (provider) {
    case 'openai':
      return createOpenAI({ 
        apiKey: getSafeKey(config?.openaiKey) || getSafeKey(process.env.OPENAI_API_KEY) 
      }).chat(finalId);
      
    case 'anthropic':
      return createAnthropic({ 
        apiKey: getSafeKey(config?.anthropicKey) || getSafeKey(process.env.ANTHROPIC_API_KEY) 
      })(finalId);
      
    case 'groq':
      return createOpenAI({ 
        apiKey: getSafeKey(config?.groqKey) || getSafeKey(process.env.GROQ_API_KEY),
        baseURL: 'https://api.groq.com/openai/v1'
      }).chat(finalId);
      
    case 'openrouter':
      return createOpenRouter({
        apiKey: getSafeKey(config?.openrouterKey) || getSafeKey(process.env.OPENROUTER_API_KEY)
      })(finalId);
      
    case 'nvidia':
      return createOpenAI({
        apiKey: getSafeKey(config?.nvidiaKey) || getSafeKey(process.env.NVIDIA_API_KEY),
        baseURL: 'https://integrate.api.nvidia.com/v1'
      }).chat(finalId);
      
    case 'cerebras':
      return createOpenAI({
        apiKey: getSafeKey(config?.cerebrasKey) || getSafeKey(process.env.CEREBRAS_API_KEY),
        baseURL: 'https://api.cerebras.ai/v1'
      }).chat(finalId);
      
    case 'sambanova':
      return createOpenAI({
        apiKey: getSafeKey(config?.sambanovaKey) || getSafeKey(process.env.SAMBANOVA_API_KEY),
        baseURL: 'https://api.sambanova.ai/v1'
      }).chat(finalId);

    case 'mistral':
      return createOpenAI({
        apiKey: getSafeKey(config?.mistralKey) || getSafeKey(process.env.MISTRAL_API_KEY),
        baseURL: 'https://api.mistral.ai/v1'
      }).chat(finalId);

    case 'deepseek':
      return createOpenAI({
        apiKey: getSafeKey(config?.deepseekKey) || getSafeKey(process.env.DEEPSEEK_API_KEY),
        baseURL: 'https://api.deepseek.com/v1'
      }).chat(finalId);

    case 'ai21':
      return createOpenAI({
        apiKey: getSafeKey(config?.ai21Key) || getSafeKey(process.env.AI21_API_KEY),
        baseURL: 'https://api.ai21.com/studio/v1'
      }).chat(finalId);

    case 'cohere':
      return createOpenAI({
        apiKey: getSafeKey(config?.cohereKey) || getSafeKey(process.env.COHERE_API_KEY),
        baseURL: 'https://api.cohere.com/v1'
      }).chat(finalId);

    case 'cloudflare':
      // Cloudflare requires account ID in URL usually, but if standard baseURL is provided via env we can use it
      return createOpenAI({
        apiKey: getSafeKey(config?.cloudflareKey) || getSafeKey(process.env.CLOUDFLARE_API_KEY),
        baseURL: process.env.CLOUDFLARE_BASE_URL || 'https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/v1'
      }).chat(finalId);

    default:
      // Fallback to Gemini Latest
      return createGoogleGenerativeAI({ 
        apiKey: geminiKey
      })(finalId.includes('gemini') ? finalId : 'gemini-flash-latest');
  }
}
