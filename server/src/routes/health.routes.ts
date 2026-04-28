import { Router } from 'express';
import { getAIModel } from '../../../src/server/services/aiProvider';
import { generateText } from 'ai';
import { logger } from '../utils/logger';
import { getDatabase } from '../database/factory';

const router = Router();
const db = getDatabase();

router.get('/check', async (req, res) => {
  const { provider, modelId } = req.query;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
  const keyStatus = geminiKey ? 
    (geminiKey.length > 5 ? `Present (${geminiKey.length} chars, starts with ${geminiKey.substring(0, 4)})` : 'Invalid Length') : 
    'Missing';
  
  // 1. Basic Auth Validation
  if (req.query.apiKey) {
    logger.warn("[Security] Health-check request containing client API key rejected");
    return res.status(403).json({ status: 'error', message: 'API keys must not be provided by the client' });
  }

  // 2. DB Health Check
  let dbStatus = 'unknown';
  try {
    // Try to list a common collection to verify connection
    await db.list('health_check', []); 
    dbStatus = 'connected';
  } catch (e) {
    logger.error('Database health check failed: %o', e);
    dbStatus = 'error';
  }

  if (!provider || !modelId) {
    return res.json({ 
      status: 'ok', 
      db: dbStatus, 
      aiKey: keyStatus,
      aiProvider: process.env.GEMINI_API_KEY ? 'gemini-key' : 
                   process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'google-ai-key' : 
                   process.env.GOOGLE_API_KEY ? 'google-api-key' : 'none',
      dbProvider: process.env.DB_PROVIDER || 'firebase',
      message: 'Hệ thống sẵn sàng. Vui lòng cung cấp modelId để kiểm tra chi tiết AI.' 
    });
  }

  // 3. AI Provider Check
  try {
    const model = getAIModel(provider as string, modelId as string);
    await generateText({
      model,
      prompt: 'Hi',
    });
    res.json({ status: 'ok', db: dbStatus, dbProvider: process.env.DB_PROVIDER || 'firebase', ai: 'ready' });
  } catch (error: any) {
    logger.error(`AI check failed for ${modelId}: %o`, error);
    res.status(500).json({ 
      status: 'error', 
      db: dbStatus,
      dbProvider: process.env.DB_PROVIDER || 'firebase',
      ai: 'failed',
      message: error.message || 'Connection failed'
    });
  }
});

export default router;
