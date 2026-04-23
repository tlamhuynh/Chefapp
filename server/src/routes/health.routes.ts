import { Router } from 'express';
import { getAIModel } from '../../../src/server/services/aiProvider';
import { generateText } from 'ai';
import { logger } from '../utils/logger';
import { getDatabase } from '../database/factory';

const router = Router();
const db = getDatabase();

router.get('/check', async (req, res) => {
  const { provider, modelId } = req.query;
  
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
    return res.json({ status: 'ok', db: dbStatus, message: 'Provide modelId for AI check' });
  }

  // 3. AI Provider Check
  try {
    const model = getAIModel(provider as string, modelId as string);
    await generateText({
      model,
      prompt: 'Hi',
    });
    res.json({ status: 'ok', db: dbStatus, ai: 'ready' });
  } catch (error: any) {
    logger.error(`AI check failed for ${modelId}: %o`, error);
    res.status(500).json({ 
      status: 'error', 
      db: dbStatus,
      ai: 'failed',
      message: error.message || 'Connection failed'
    });
  }
});

export default router;
