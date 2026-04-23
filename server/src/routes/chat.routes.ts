import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import fetch from 'node-fetch';
import { logger } from '../utils/logger';
import { AIService } from '../services/ai.service';

const router = Router();
const apiCache = new NodeCache({ stdTTL: 300 });

// Rate Limiting
const chatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Quá tải yêu cầu (Rate limit exceeded). Vui lòng đợi 1 phút." }
});

router.get('/models', async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  // if (req.query.apiKey) return res.status(403).json({ error: "API keys must not be provided by the client" });
  if (!key) return res.status(500).json({ error: "Server API Key not configured" });

  const cacheKey = 'gemini-models';
  const cachedData = apiCache.get(cacheKey);
  if (cachedData) return res.json(cachedData);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await response.json() as any;
    const models = data.models
      .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
      .map((m: any) => ({
        id: m.name.replace("models/", ""),
        displayName: m.displayName,
        description: m.description
      }));
    const result = { models };
    apiCache.set(cacheKey, result, 3600);
    res.json(result);
  } catch (error: any) {
    logger.error("List models error: %o", error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/', chatRateLimit, async (req, res) => {
  const { modelId, messages, systemInstruction, type } = req.body;
  
  /*
  if (req.body.config && (
    req.body.config.openaiKey || req.body.config.googleKey || 
    req.body.config.anthropicKey || req.body.config.nvidiaKey || req.body.config.groqKey
  )) {
    return res.status(403).json({ error: "API keys must not be provided by the client." });
  }
  */

  try {
    const result = await AIService.processChat({
      modelId,
      messages,
      systemInstruction,
      type,
      config: req.body.config, // Explicitly pass config
      ...req.body // Pass extra params for insights etc.
    });

    return res.json(result);
  } catch (error: any) {
    logger.error("Chat API Error: %s", error.message);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export default router;
