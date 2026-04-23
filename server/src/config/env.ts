import { z } from 'zod';
import { config } from 'dotenv';
import path from 'path';

// Load variables from .env if present
config({ override: true });

const envSchema = z.object({
  // Infrastructure
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  
  // Database Provider Selection
  DB_PROVIDER: z.enum(['firebase', 'supabase']).default('firebase'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),

  // AI Providers Keys
  GEMINI_API_KEY: z.string().optional(), 
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  NVIDIA_API_KEY: z.string().optional(),

  // Security & Rates
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 mins
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ VALIDATION ERROR (Environment Variables):');
  console.error(JSON.stringify(_env.error.format(), null, 2));
  // In development, we might want to proceed with warnings instead of exit(1) 
  // but for production directivity, we stick to strict.
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

export const env = _env.success ? _env.data : envSchema.parse({ NODE_ENV: 'development' });

/**
 * Helper to check AI availability
 */
export const isAIProviderReady = (provider: string): boolean => {
  const p = provider.toLowerCase();
  if (p === 'google') return !!(env.GEMINI_API_KEY);
  if (p === 'openai') return !!(env.OPENAI_API_KEY);
  if (p === 'anthropic') return !!(env.ANTHROPIC_API_KEY);
  if (p === 'groq') return !!(env.GROQ_API_KEY);
  if (p === 'openrouter') return !!(env.OPENROUTER_API_KEY);
  if (p === 'nvidia') return !!(env.NVIDIA_API_KEY);
  return false;
};
