import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
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

  // Provider specific remapping
  if (provider === 'groq' || mId.includes('deepseek-r1-distill-llama-70b')) {
    if (mId.includes('deepseek-r1-distill-llama-70b')) {
      return 'llama-3.3-70b-versatile';
    }
  }
  
  if (provider === 'google') {
    // Standardize Gemini IDs
    if (mId.includes('gemini-2.0-flash')) return 'gemini-2.0-flash';
    if (mId.includes('gemini-1.5-pro')) return 'gemini-1.5-pro';
    if (mId.includes('gemini-1.5-flash')) return 'gemini-1.5-flash';
    
    // Mapping for likely experimental or typo IDs from user (e.g., gemini-3.1 flash failures)
    if (mId === 'gemini-3-flash-preview' || mId.includes('gemini-3.1-flash')) return 'gemini-1.5-flash';
    if (mId.includes('gemini-3.1-pro')) return 'gemini-1.5-pro';
  }
  
  if (provider === 'nvidia') {
    if (mId.includes('llama-3.1')) return mId.replace('llama-3.1', 'llama-3.3');
    if (mId.includes('deepseek-r1') || mId.includes('deepseek-ai')) return 'meta/llama-3.3-70b-instruct';
  }

  return finalId;
}

/**
 * Initializes the appropriate AI provider and model using Vercel AI SDK.
 * Strictly uses environment variables for API keys.
 */
export function getAIModel(provider: string, modelId: string): LanguageModel {
  const finalId = mapModelId(provider, modelId);
  
  switch (provider) {
    case 'google':
      return createGoogleGenerativeAI({ 
        apiKey: process.env.GEMINI_API_KEY 
      })(finalId);
      
    case 'openai':
      return createOpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      })(finalId);
      
    case 'anthropic':
      return createAnthropic({ 
        apiKey: process.env.ANTHROPIC_API_KEY 
      })(finalId);
      
    case 'groq':
      return createOpenAI({ 
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1'
      })(finalId);
      
    case 'openrouter':
      return createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1'
      })(finalId);
      
    case 'nvidia':
      return createOpenAI({
        apiKey: process.env.NVIDIA_API_KEY,
        baseURL: 'https://integrate.api.nvidia.com/v1'
      })(finalId);
      
    default:
      // Default to Google Gemini if unknown
      return createGoogleGenerativeAI({ 
        apiKey: process.env.GEMINI_API_KEY 
      })(finalId.includes('gemini') ? finalId : 'gemini-1.5-flash');
  }
}
