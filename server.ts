import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Health Check Route
  app.get("/api/health-check", async (req, res) => {
    const { provider, modelId, apiKey } = req.query;
    
    if (!provider || !modelId || !apiKey) {
      return res.status(400).json({ status: 'error', message: 'Missing parameters' });
    }

    try {
      let model;
      const key = apiKey as string;
      const mId = modelId as string;

      if (provider === 'google') {
        model = createGoogleGenerativeAI({ apiKey: key })(mId);
      } else if (provider === 'groq') {
        const groqModelId = mId.startsWith('groq/') ? mId.slice(5) : mId;
        model = createOpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1' })(groqModelId);
      } else if (provider === 'nvidia') {
        const nvidiaModelId = mId.startsWith('nvidia/') ? mId.slice(7) : mId;
        model = createOpenAI({ apiKey: key, baseURL: 'https://integrate.api.nvidia.com/v1' })(nvidiaModelId);
      } else {
        model = createOpenAI({ apiKey: key })(mId);
      }

      // Simple test call
      await generateText({
        model,
        prompt: 'Hi'
      });

      res.json({ status: 'ok' });
    } catch (error: any) {
      console.error(`Health check failed for ${modelId}:`, error);
      res.status(500).json({ 
        status: 'error', 
        message: error.message || 'Connection failed',
        raw: error.toString()
      });
    }
  });

  // AI Chat Proxy Route
  app.post("/api/chat", async (req, res) => {
    const { modelId, messages, systemInstruction, tools, config, responseSchema, type } = req.body;

    try {
      // Helper to get provider
      const getProvider = (mId: string, cfg: any) => {
        const providers: any = {
          google: () => {
            const google = createGoogleGenerativeAI({ 
              apiKey: cfg.googleKey || process.env.GEMINI_API_KEY
            });
            // Handle specific versioning if needed, but usually the SDK handles mId
            return google(mId);
          },
          openai: () => createOpenAI({ apiKey: cfg.openaiKey || process.env.OPENAI_API_KEY })(mId),
          anthropic: () => createAnthropic({ apiKey: cfg.anthropicKey || process.env.ANTHROPIC_API_KEY })(mId),
          groq: () => {
            const groqModelId = mId.startsWith('groq/') ? mId.slice(5) : mId;
            return createOpenAI({ 
              apiKey: cfg.groqKey || process.env.GROQ_API_KEY,
              baseURL: 'https://api.groq.com/openai/v1'
            })(groqModelId);
          },
          nvidia: () => {
            const nvidiaModelId = mId.startsWith('nvidia/') ? mId.slice(7) : mId;
            return createOpenAI({
              apiKey: cfg.nvidiaKey || process.env.NVIDIA_API_KEY,
              baseURL: 'https://integrate.api.nvidia.com/v1'
            })(nvidiaModelId);
          }
        };

        const providerKey = mId.includes('gemini') ? 'google' : 
                           mId.includes('gpt') ? 'openai' :
                           mId.includes('claude') ? 'anthropic' :
                           mId.includes('groq') ? 'groq' :
                           mId.includes('nvidia') ? 'nvidia' : 'google';
        
        return providers[providerKey]();
      };

      const model = getProvider(modelId, config || {});

      // Format messages (handle images)
      const formattedMessages = messages.map((m: any) => ({
        role: m.role,
        content: m.content.map((c: any) => {
          if (c.type === 'image') {
            return { 
              type: 'image', 
              image: Buffer.from(c.image, 'base64'), 
              mimeType: c.mimeType 
            };
          }
          return c;
        })
      }));

      if (type === 'insights') {
        const { inventory, recipes } = req.body;
        const systemPrompt = `
          BẠN LÀ KITCHEN INTELLIGENCE AGENT.
          Nhiệm vụ: Phân tích dữ liệu kho và công thức để tìm ra các cơ hội tối ưu hóa.
          Dữ liệu kho: ${JSON.stringify(inventory.slice(0, 30))}
          Dữ liệu công thức: ${JSON.stringify(recipes.slice(0, 20))}
          
          TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON SAU:
          {
            "insights": [
              { "title": "string", "description": "string", "type": "warning|tip|alert", "priority": "high|medium|low" }
            ]
          }
        `;

        let resultObject;
        if (modelId.includes('groq')) {
          const { text } = await generateText({
            model,
            system: systemPrompt,
            messages: [],
          });
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          resultObject = jsonMatch ? JSON.parse(jsonMatch[0]) : { insights: [] };
        } else {
          const { object } = await generateObject({
            model,
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
          resultObject = object;
        }
        return res.json({ object: resultObject });
      }

      if (type === 'multi-agent') {
        const { inventoryData, recipeData } = req.body;
        
        // Agent 1: Creative Chef
        const creativePrompt = `
          ${systemInstruction}
          BẠN LÀ CREATIVE CHEF AGENT.
          Nhiệm vụ: Đề xuất các món ăn, thực đơn hoặc giải pháp sáng tạo.
          Hãy tập trung vào hương vị, trải nghiệm khách hàng và sự độc đáo.
        `;
        const { text: proposal } = await generateText({
          model,
          system: creativePrompt,
          messages: formattedMessages,
        });

        // Agent 2: Financial
        const financialPrompt = `
          BẠN LÀ FINANCIAL & INVENTORY EXPERT.
          Dữ liệu kho hiện tại: ${JSON.stringify(inventoryData?.slice(0, 20))}
          Dữ liệu công thức hiện tại: ${JSON.stringify(recipeData?.slice(0, 10))}
          Nhiệm vụ: Phân tích đề xuất của Creative Chef dưới góc độ chi phí và khả năng thực thi.
          Đề xuất của Creative Chef: "${proposal}"
        `;
        const { text: review } = await generateText({
          model,
          system: financialPrompt,
          messages: [{ role: 'user', content: "Hãy phân tích đề xuất trên." }],
        });

        // Agent 3: Orchestrator
        const orchestratorPrompt = `
          BẠN LÀ BẾP TRƯỞNG ĐIỀU PHỐI (ORCHESTRATOR).
          Dưới đây là cuộc thảo luận nội bộ:
          - Sáng tạo: ${proposal}
          - Phản biện tài chính: ${review}
          Nhiệm vụ: Tổng hợp câu trả lời cuối cùng và đề xuất hành động.
        `;
        let resultObject;
        if (modelId.includes('groq')) {
          const { text } = await generateText({
            model,
            system: orchestratorPrompt,
            messages: [{ role: 'user', content: "Hãy đưa ra kết quả cuối cùng dưới dạng JSON." }],
          });
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          resultObject = jsonMatch ? JSON.parse(jsonMatch[0]) : { text: "Lỗi xử lý kết quả", internalMonologue: "" };
        } else {
          const { object } = await generateObject({
            model,
            system: orchestratorPrompt,
            messages: [{ role: 'user', content: "Hãy đưa ra kết quả cuối cùng." }],
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
          resultObject = object;
        }
        return res.json({ object: resultObject });
      }

      if (type === 'object') {
        let resultObject;
        if (modelId.includes('groq')) {
          const { text } = await generateText({
            model,
            system: systemInstruction + "\nTRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON.",
            messages: formattedMessages,
          });
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          resultObject = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        } else {
          const { object } = await generateObject({
            model,
            system: systemInstruction,
            messages: formattedMessages,
            schema: responseSchema ? z.object(Object.fromEntries(
              Object.entries(responseSchema).map(([k, v]: any) => [k, z.any()])
            )) : z.any(),
          });
          resultObject = object;
        }
        return res.json({ object: resultObject });
      } else {
        const { text, toolCalls } = await generateText({
          model,
          system: systemInstruction,
          messages: formattedMessages,
          tools: tools,
        });
        return res.json({ text, toolCalls });
      }
    } catch (error: any) {
      console.error("AI Proxy Error:", error);
      
      let errorMessage = error.message || "Đã xảy ra lỗi khi gọi AI.";
      let statusCode = 500;

      if (errorMessage.includes("quota") || errorMessage.includes("limit")) {
        errorMessage = "Bạn đã hết hạn mức sử dụng (Quota) cho model này. Vui lòng thử lại sau hoặc chuyển sang model khác (như Groq hoặc NVIDIA).";
        statusCode = 429;
      } else if (errorMessage.includes("not found")) {
        errorMessage = `Model "${modelId}" không tìm thấy hoặc chưa được hỗ trợ với API Key này.`;
        statusCode = 404;
      } else if (errorMessage.includes("API key")) {
        errorMessage = "API Key không hợp lệ hoặc chưa được cấu hình đúng.";
        statusCode = 401;
      }

      res.status(statusCode).json({ error: errorMessage, rawError: error.message });
    }
  });

  // API Route for crawling recipes
  app.post("/api/crawl", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Basic extraction logic
      const title = $("h1").first().text().trim() || $("title").text().trim();
      
      // Try to find ingredients
      let ingredients: string[] = [];
      $("li").each((i, el) => {
        const text = $(el).text().trim();
        // Simple heuristic for ingredients: contains numbers or common units
        if (text.length > 0 && text.length < 200 && (/\d/.test(text) || /gram|ml|muỗng|thìa|củ|quả|kg/i.test(text))) {
          ingredients.push(text);
        }
      });

      // Try to find instructions
      let instructions: string[] = [];
      $("p, li").each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 50 && !ingredients.includes(text)) {
          instructions.push(text);
        }
      });

      // Limit results
      ingredients = [...new Set(ingredients)].slice(0, 30);
      instructions = [...new Set(instructions)].slice(0, 20);

      res.json({
        title,
        ingredients,
        instructions,
        rawText: $("body").text().slice(0, 5000) // Fallback for AI to parse
      });
    } catch (error: any) {
      console.error("Crawl error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
