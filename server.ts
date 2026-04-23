import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
import { generateText, tool } from 'ai';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';

// Internal modules
import { isSafeUrl } from "./src/server/utils/security.ts";
import { extractJson } from "./src/server/utils/json.ts";
import { getAIModel, mapModelId } from "./src/server/services/aiProvider.ts";
import { searchMarketPrices } from "./src/server/services/market.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Cache (P1 #6)
const apiCache = new NodeCache({ stdTTL: 300 }); // 5 minutes TTL

// Simple logger for server
const log = (msg: string, data?: any) => {
  console.log(`[Server AI] ${msg}`, data ? JSON.stringify(data).substring(0, 500) + '...' : '');
};

// Helper for fetch with timeout
async function fetchWithTimeout(url: string, options: any = {}, timeout: number = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw error;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: '50mb' }));

  // Rate Limiting (P1 #6)
  const chatRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 requests per windowMs
    message: { error: "Quá tải yêu cầu (Rate limit exceeded). Vui lòng đợi 1 phút." }
  });

  // API Health Check Route
  app.get("/api/health-check", async (req, res) => {
    const { provider, modelId } = req.query;
    
    // Security Fix (P0 #3): Reject client provided keys
    if (req.query.apiKey) {
      log("[Security] Rejected health-check request containing client API key");
      return res.status(403).json({ status: 'error', message: 'API keys must not be provided by the client' });
    }

    if (!provider || !modelId) {
      return res.status(400).json({ status: 'error', message: 'Missing parameters' });
    }

    try {
      const model = getAIModel(provider as string, modelId as string);

      // Simple test call with short timeout
      await generateText({
        model,
        prompt: 'Hi',
      });

      res.json({ status: 'ok' });
    } catch (error: any) {
      console.error(`Health check failed for ${modelId}:`, error);
      res.status(500).json({ 
        status: 'error', 
        message: error.message || 'Connection failed'
      });
    }
  });
  
  // Endpoint to list available Gemini models
  app.get("/api/list-models", async (req, res) => {
    const key = process.env.GEMINI_API_KEY;
    
    // Security Fix (P0 #3)
    if (req.query.apiKey) {
      return res.status(403).json({ error: "API keys must not be provided by the client" });
    }

    if (!key) {
      return res.status(500).json({ error: "Server API Key not configured" });
    }

    // Cache list of models
    const cacheKey = 'gemini-models';
    const cachedData = apiCache.get(cacheKey);
    if (cachedData) return res.json(cachedData);

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      const data = await response.json() as any;
      
      const models = data.models
        .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
        .map((m: any) => ({
          id: m.name.replace("models/", ""),
          displayName: m.displayName,
          description: m.description
        }));

      const result = { models };
      apiCache.set(cacheKey, result, 3600); // Cache for 1 hour
      res.json(result);
    } catch (error: any) {
      console.error("List models error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Chat Proxy Route
  app.post("/api/chat", chatRateLimit, async (req, res) => {
    const { modelId, messages, systemInstruction, type } = req.body;
    
    // Security Fix (P0 #3): Reject client provided keys
    if (req.body.config && (
      req.body.config.openaiKey || 
      req.body.config.googleKey || 
      req.body.config.anthropicKey ||
      req.body.config.nvidiaKey ||
      req.body.config.groqKey
    )) {
      log("[Security] Rejected chat request containing client API keys");
      return res.status(403).json({ error: "API keys must not be provided by the client. Use server environment variables." });
    }

    const maxTokens = 4096;

    try {
      const providerKey = modelId.includes('gemini') ? 'google' : 
                         modelId.includes('gpt') ? 'openai' :
                         modelId.includes('claude') ? 'anthropic' :
                         modelId.includes('groq') ? 'groq' :
                         modelId.includes('openrouter') ? 'openrouter' :
                         modelId.includes('nvidia') ? 'nvidia' : 'google';

      const model = getAIModel(providerKey, modelId);
      log(`Model initialized: ${modelId} (${providerKey})`);

      // Check if model supports vision
      const visionModels = ['gemini', 'gpt-4o', 'claude-3-5', 'claude-3-opus', 'claude-3-sonnet'];
      const supportsVision = visionModels.some(vm => modelId.toLowerCase().includes(vm));

      // Format messages
      const chatMessages = (messages || []).map((m: any) => {
        let role = m.role === 'model' ? 'assistant' : m.role || 'user';
        
        if (typeof m.content === 'string') {
          return { role, content: m.content || '...' };
        }
        
        const filteredContent = (m.content || []).map((c: any) => {
          if (c.type === 'image' || c.type === 'video' || c.type === 'file') {
            if (!supportsVision || role === 'assistant') { 
              return { type: 'text', text: `[${c.type === 'image' ? 'Hình ảnh' : c.type === 'video' ? 'Video' : 'Tệp'} đính kèm]` };
            }
            let data = c.image || c.video || c.data;
            if (typeof data !== 'string' && data?.data) data = data.data;
            
            try {
              return { 
                type: c.type, 
                [c.type]: new Uint8Array(Buffer.from(data, 'base64')), 
                mimeType: c.mimeType || (c.type === 'video' ? 'video/mp4' : 'image/jpeg')
              };
            } catch (e) {
              return { type: 'text', text: '[Lỗi dữ liệu đính kèm]' };
            }
          }
          return c;
        }).filter((c: any) => {
           if (c.type === 'text') return !!c.text && c.text.trim().length > 0;
           return !!c.image || !!c.video || !!c.data;
        });

        if (filteredContent.length === 0) return { role, content: '...' };

        if (role === 'assistant') {
          const textContent = filteredContent.filter(c => c.type === 'text').map(c => c.text).join('\n');
          return { role, content: textContent || '...' };
        }

        return { role, content: filteredContent };
      }).filter(Boolean);

      const formattedMessages = chatMessages.length > 0 ? chatMessages : [{ role: 'user', content: 'Tiếp tục.' }];

      // Handle specific request types
      if (type === 'insights') {
        const { inventory, recipes } = req.body;
        const systemPrompt = `
          BẠN LÀ KITCHEN INTELLIGENCE AGENT.
          Phân tích dữ liệu kho (${inventory.length} mục) và công thức (${recipes.length} mục).
          TRẢ VỀ JSON: { "insights": [{ "title": "string", "description": "string", "type": "warning|tip|alert", "priority": "high|medium|low" }] }
        `;

        const { text } = await generateText({
          model,
          system: systemPrompt + "\nChỉ trả về JSON. Không giải thích.",
          messages: [{ role: 'user', content: 'Phân tích ngay.' }],
        });

        return res.json({ object: extractJson(text) || { insights: [] } });
      }

      if (type === 'multi-agent') {
        const { inventoryData, recipeData } = req.body;
        
        // Step 1: Creative Proposal
        const { text: proposal } = await generateText({
          model,
          system: `${systemInstruction}\nBẠN LÀ CREATIVE CHEF.`,
          messages: formattedMessages,
        });

        // Step 2: Market Data extraction and simulation
        const { text: ingredientsJson } = await generateText({
          model,
          system: "Trích xuất danh sách nguyên liệu từ đề xuất dưới dạng JSON array: [\"tên\", ...]",
          prompt: proposal,
        });
        const ingredients = extractJson<string[]>(ingredientsJson) || [];
        const marketPrices = await searchMarketPrices(ingredients);

        // Step 3: Financial Review
        const { text: review } = await generateText({
          model,
          system: `BẠN LÀ FINANCIAL EXPERT. Dữ liệu giá: ${JSON.stringify(marketPrices)}. Phân tích đề xuất chi phí.`,
          prompt: proposal,
        });

        // Step 4: Final Orchestration
        const { text: finalOutputText } = await generateText({
          model,
          system: `BẠN LÀ BẾP TRƯỞNG ĐIỀU PHỐI.
          Dưới đây là kết quả thảo luận giữa các chuyên gia:
          - Đề xuất sáng tạo: ${proposal}
          - Phân tích tài chính: ${review}
          - Giá thị trường cập nhật: ${JSON.stringify(marketPrices)}
          
          Nhiệm vụ: Tổng hợp thành câu trả lời cuối cùng cho người dùng. 
          BẮT BUỘC TRẢ VỀ JSON: 
          { 
            "text": "Markdown tóm tắt (sử dụng bảng cho nguyên liệu)", 
            "internalMonologue": "Tóm tắt ngắn gọn quy trình tư duy",
            "recipe": { 
              "title": "...", 
              "ingredients": [{"name": "...", "amount": "...", "unit": "...", "price": 0}], 
              "instructions": ["bước 1", "bước 2"],
              "totalCost": 0,
              "recommendedPrice": 0
            }, 
            "proposedActions": [], 
            "suggestions": [] 
          }`,
          messages: [{ role: 'user', content: "Tổng hợp kết quả cuối cùng." }],
        } as any);

        return res.json({ object: extractJson(finalOutputText) || { text: finalOutputText } });
      }

      // Default: Standard chat
      const { text, toolCalls } = await generateText({
        model,
        system: systemInstruction,
        messages: formattedMessages,
        tools: {
          search_market_price: {
            description: "Tìm kiếm giá thị trường hiện tại của các nguyên liệu tại Việt Nam.",
            parameters: z.object({ ingredients: z.array(z.string()) }),
            execute: async ({ ingredients }: { ingredients: string[] }) => JSON.stringify(await searchMarketPrices(ingredients))
          }
        } as any,
        maxSteps: 3,
        maxTokens: type === 'object' ? 4096 : 2048,
      } as any);

      if (type === 'object') {
        return res.json({ object: extractJson(text) || { text } });
      }

      return res.json({ text, toolCalls });

    } catch (error: any) {
      log("AI Proxy Error:", error.message);
      res.status(error.statusCode || 500).json({ 
        error: error.message || "Đã xảy ra lỗi khi gọi AI.",
        type: error.name
      });
    }
  });

  // API Route for crawling recipes
  app.post("/api/crawl", async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // SSRF Protection (P0 #2)
    if (!isSafeUrl(url)) {
      log(`[Security] Blocked SSRF attempt: ${url}`);
      return res.status(400).json({ error: "URL không hợp lệ hoặc bị chặn vì lý do bảo mật." });
    }

    try {
      const response = await fetchWithTimeout(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      }, 15000);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const title = $("h1").first().text().trim() || $("title").text().trim();
      let ingredients: string[] = [];
      $("li").each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 0 && text.length < 200 && (/\d/.test(text) || /gram|ml|muỗng|thìa|củ|quả|kg/i.test(text))) {
          ingredients.push(text);
        }
      });

      let instructions: string[] = [];
      $("p, li").each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 50 && !ingredients.includes(text)) {
          instructions.push(text);
        }
      });

      res.json({
        title,
        ingredients: [...new Set(ingredients)].slice(0, 30),
        instructions: [...new Set(instructions)].slice(0, 20),
        rawText: $("body").text().slice(0, 5000)
      });
    } catch (error: any) {
      console.error("Crawl error:", error);
      res.status(500).json({ error: `Không thể lấy dữ liệu từ URL này: ${error.message}` });
    }
  });

  // Vite/Static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer();
