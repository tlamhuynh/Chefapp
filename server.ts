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

// Simple logger for server
const log = (msg: string, data?: any) => {
  console.log(`[Server AI] ${msg}`, data ? JSON.stringify(data).substring(0, 500) + '...' : '');
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for model ID mapping
const mapModelId = (provider: string, mId: string) => {
  let finalId = mId;
  if (provider === 'google') {
    // Follow skill guidelines for Gemini aliases
    if (mId.includes('flash') || mId === 'gemini-1.5-flash') {
      finalId = 'gemini-flash-latest';
    } else if (mId.includes('pro') || mId === 'gemini-1.5-pro') {
      finalId = 'gemini-3.1-pro-preview';
    } else if (mId === 'gemini-3-flash-preview') {
      finalId = 'gemini-3-flash-preview';
    }
  } else if (provider === 'nvidia') {
    // Standardize to llama-3.3 if llama-3.1 is requested
    if (mId.includes('llama-3.1')) {
      finalId = mId.replace('llama-3.1', 'llama-3.3');
    }
  }
  return finalId;
};

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
      const finalId = mapModelId(provider as string, modelId as string);

      if (provider === 'google') {
        model = createGoogleGenerativeAI({ 
          apiKey: key
        })(finalId);
      } else if (provider === 'groq') {
        const groqModelId = finalId.startsWith('groq/') ? finalId.slice(5) : finalId;
        model = createOpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1' })(groqModelId);
      } else if (provider === 'nvidia') {
        const nvidiaModelId = finalId.startsWith('nvidia/') ? finalId.slice(7) : finalId;
        model = createOpenAI({ apiKey: key, baseURL: 'https://integrate.api.nvidia.com/v1' })(nvidiaModelId);
      } else {
        model = createOpenAI({ apiKey: key })(finalId);
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
  
  // Endpoint to list available Gemini models
  app.get("/api/list-models", async (req, res) => {
    const key = req.query.apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(400).json({ error: "API Key is required" });
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      const data = await response.json() as any;
      
      // Extract only the model names/ids that support generateContent
      const models = data.models
        .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
        .map((m: any) => ({
          id: m.name.replace("models/", ""),
          displayName: m.displayName,
          description: m.description
        }));

      res.json({ models });
    } catch (error: any) {
      console.error("List models error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Chat Proxy Route
  app.post("/api/chat", async (req, res) => {
    const { modelId, messages, systemInstruction, tools, config, responseSchema, type } = req.body;
    const maxTokens = 4096; // Increased from default to prevent truncation

    try {
      // Helper to get provider
      const getProvider = (mId: string, cfg: any) => {
        const providerKey = mId.includes('gemini') ? 'google' : 
                           mId.includes('gpt') ? 'openai' :
                           mId.includes('claude') ? 'anthropic' :
                           mId.includes('groq') ? 'groq' :
                           mId.includes('openrouter') ? 'openrouter' :
                           mId.includes('nvidia') ? 'nvidia' : 'google';
        
        const finalId = mapModelId(providerKey, mId);

        const providers: any = {
          google: () => {
            const google = createGoogleGenerativeAI({ 
              apiKey: cfg.googleKey || process.env.GEMINI_API_KEY
            });
            // Try wrapping ID to ensure it's correct for the SDK if needed
            return google(finalId);
          },
          openai: () => createOpenAI({ apiKey: cfg.openaiKey || process.env.OPENAI_API_KEY })(finalId),
          anthropic: () => createAnthropic({ apiKey: cfg.anthropicKey || process.env.ANTHROPIC_API_KEY })(finalId),
          groq: () => {
            const groqModelId = finalId.startsWith('groq/') ? finalId.slice(5) : finalId;
            return createOpenAI({ 
              apiKey: cfg.groqKey || process.env.GROQ_API_KEY,
              baseURL: 'https://api.groq.com/openai/v1'
            })(groqModelId);
          },
          openrouter: () => {
            const orModelId = finalId.startsWith('openrouter/') ? finalId.slice(11) : finalId;
            return createOpenAI({
              apiKey: cfg.openrouterKey || process.env.OPENROUTER_API_KEY,
              baseURL: 'https://openrouter.ai/api/v1',
            })(orModelId);
          },
          nvidia: () => {
            const nvidiaModelId = finalId.startsWith('nvidia/') ? finalId.slice(7) : finalId;
            return createOpenAI({
              apiKey: cfg.nvidiaKey || process.env.NVIDIA_API_KEY,
              baseURL: 'https://integrate.api.nvidia.com/v1'
            })(nvidiaModelId);
          }
        };
        
        return providers[providerKey]();
      };

      const model = getProvider(modelId, config || {});
      log(`Provider initialized for ${modelId}`);

      // Check if model supports vision
      const visionModels = ['gemini', 'gpt-4o', 'claude-3-5', 'claude-3-opus', 'claude-3-sonnet'];
      const supportsVision = visionModels.some(vm => modelId.toLowerCase().includes(vm));

        // Format messages (handle images and nested content)
        const chatMessages = (messages || []).map((m: any) => {
          let role = m.role || 'user';
          if (role === 'model') role = 'assistant';
          
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

          if (filteredContent.length === 0) {
            return { role, content: '...' };
          }

          if (role === 'assistant') {
            const textContent = filteredContent.filter(c => c.type === 'text').map(c => c.text).join('\n');
            return { role, content: textContent || '...' };
          }

          return { role, content: filteredContent };
        }).filter(Boolean);

        const formattedMessages = chatMessages.length > 0 ? chatMessages : [{ role: 'user', content: 'Tiếp tục.' }];

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
        try {
          if (modelId.includes('groq')) {
            log(`[insights] Calling Groq`);
            const { text } = await generateText({
              model,
              system: systemPrompt,
              messages: [{ role: 'user', content: 'Phân tích dữ liệu ngay.' }],
              max_tokens: 2048,
              maxRetries: 1,
            } as any);
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            resultObject = jsonMatch ? JSON.parse(jsonMatch[0]) : { insights: [] };
          } else {
            // Use generateText instead of generateObject to avoid schema proxy issues with Gemini
            log(`[insights] Calling Gemini/Standard via generateText`);
            const { text } = await generateText({
              model,
              system: systemPrompt + "\nHãy luôn trả về kết quả dưới dạng JSON hợp lệ theo cấu trúc yêu cầu. Đừng bao gồm văn bản giải thích.",
              messages: [{ role: 'user', content: 'Phân tích dữ liệu ngay.' }],
              maxTokens: 2048,
              maxRetries: 1,
            } as any);
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            resultObject = jsonMatch ? JSON.parse(jsonMatch[0]) : { insights: [] };
          }
        } catch (e: any) {
          log(`[insights] Initial call failed (${modelId}):`, e.message);
          
          // Universal fallback to Gemini for insights if any provider fails
          const fallbacks = [
            { id: 'gemini-flash-latest' },
            { id: 'gemini-3-flash-preview' },
            { id: 'gemini-1.5-flash' }
          ];

          for (const fallback of fallbacks) {
            try {
              log(`[insights] Trying fallback to ${fallback.id}...`);
              const fallbackModel = createGoogleGenerativeAI({ 
                apiKey: req.body.config?.googleKey || process.env.GEMINI_API_KEY
              })(fallback.id); 
              
              const { text } = await generateText({
                model: fallbackModel,
                system: systemPrompt + "\nQUAN TRỌNG: Trả về JSON hợp lệ.",
                messages: [{ role: 'user', content: 'Phân tích dữ liệu ngay.' }],
                maxTokens: 2048,
              } as any);
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                resultObject = JSON.parse(jsonMatch[0]);
                log(`[insights] Fallback to ${fallback.id} succeeded`);
                return res.json({ object: resultObject });
              }
            } catch (fallbackError: any) {
              log(`[insights] Fallback to ${fallback.id} failed:`, fallbackError.message);
            }
          }
          throw e; // Throw original error if all fallbacks fail
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
          maxTokens: maxTokens,
          maxRetries: 1,
        } as any);

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
          maxTokens: 2048,
          maxRetries: 1,
        } as any);

        // Agent 3: Orchestrator
        const orchestratorPrompt = `
          BẠN LÀ BẾP TRƯỞNG ĐIỀU PHỐI (ORCHESTRATOR).
          Dưới đây là cuộc thảo luận nội bộ giữa Creative Chef và Financial Expert:
          - Sáng tạo: ${proposal}
          - Phản biện tài chính: ${review}
          
          Nhiệm vụ: Tổng hợp câu trả lời cuối cùng cho người dùng và ĐỀ XUẤT CÁC HÀNH ĐỘNG THỰC THI (proposedActions).
          
          QUY TẮC TRẢ LỜI:
          1. TRONG TRƯỜNG 'text': Trình bày câu trả lời dưới dạng Markdown đẹp. KHÔNG ĐƯỢC trả về nguyên khối JSON trong phần này. Nếu có danh sách nguyên liệu, hãy dùng định dạng BẢNG (Table) Markdown để người dùng dễ theo dõi.
          2. TRONG TRƯỜNG 'proposedActions': Đây là nơi chứa dữ liệu máy tính đọc được để thực thi hành động. PHẢI TRẢ VỀ mảng này nếu có hành động cần thực hiện (thêm công thức, cập nhật kho).
          
          CÁC LOẠI HÀNH ĐỘNG HỖ TRỢ:
          1. 'add_recipe': Thêm một công thức mới. Data: { title, ingredients: [{name, amount, unit}], instructions }.
          2. 'update_inventory': Cập nhật số lượng tồn kho. Data: { name, amount }.
          
          Nếu người dùng yêu cầu tạo món, hãy dùng 'add_recipe'. Nếu nhắc đến nguyên liệu, hãy dùng 'update_inventory'.
        `;
        let resultObject;
        if (modelId.includes('groq')) {
          log(`[multi-agent] Calling Groq orchestrator`);
          const { text } = await generateText({
            model,
            system: orchestratorPrompt,
            messages: [{ role: 'user', content: "Hãy đưa ra kết quả cuối cùng dưới dạng JSON. Đảm bảo có các trường: text (Markdown), internalMonologue (Chuỗi), proposedActions (Mảng các đối tượng)." }],
            maxTokens: maxTokens,
            maxRetries: 1,
          } as any);
          log(`[multi-agent] Groq orchestrator response:`, text);
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          let parsed: any = { text: text, internalMonologue: "" };
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
              if (!parsed.text) {
                // If the AI returned JSON but used a different key
                parsed.text = parsed.response || parsed.message || parsed.content || parsed.ket_qua || parsed.result;
              }
              // If still no text, look for any string field that looks like content (>50 chars)
              if (!parsed.text) {
                const stringFields = Object.values(parsed).filter(v => typeof v === 'string' && v.length > 50);
                if (stringFields.length > 0) parsed.text = stringFields[0];
              }
            } catch (e) {
              log(`[multi-agent] JSON parse error:`, e);
              parsed.text = text;
            }
          }
          resultObject = parsed;
        } else {
          log(`[multi-agent] Calling standard orchestrator via generateText`);
          const { text } = await generateText({
            model,
            system: orchestratorPrompt + "\nHãy luôn trả về kết quả dưới dạng JSON hợp lệ theo cấu trúc yêu cầu. Đừng bao gồm văn bản giải thích. Cấu trúc JSON: { \"text\": \"string\", \"internalMonologue\": \"string\", \"proposedActions\": [{ \"type\": \"string\", \"data\": {}, \"reason\": \"string\" }] }",
            messages: [{ role: 'user', content: "Hãy đưa ra kết quả cuối cùng." }],
            maxTokens: maxTokens,
            maxRetries: 1,
          } as any);
          
          log(`[multi-agent] Response received, length: ${text.length}`);
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          let parsed: any = { text: text, internalMonologue: "Phân tích kết quả..." };
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
              if (!parsed.text && (parsed.response || parsed.message || parsed.content)) {
                parsed.text = parsed.response || parsed.message || parsed.content;
              }
            } catch (e) {
              log(`[multi-agent] JSON parse error:`, e);
              parsed.text = text;
            }
          }
          resultObject = parsed;
        }
        return res.json({ object: resultObject });
      }

      if (type === 'object') {
        let resultObject;
        if (modelId.includes('groq')) {
          log(`[object] Calling Groq`);
          const promptSuffix = responseSchema ? `\nPHẢI TRẢ VỀ JSON KHÔNG CÓ TEXT GIẢI THÍCH BAO QUANH. Cấu trúc yêu cầu có các khóa: ${Object.keys(responseSchema).join(', ')}.` : "\nTRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON.";
          
          const { text } = await generateText({
            model,
            system: systemInstruction + promptSuffix,
            messages: formattedMessages,
            maxTokens: maxTokens,
            maxRetries: 1,
          } as any);
          log(`[object] Groq response snippet:`, text.substring(0, 100));
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          let parsed: any = { text: text };
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
              if (!parsed.text && (parsed.response || parsed.message || parsed.content)) {
                parsed.text = parsed.response || parsed.message || parsed.content;
              }
              // If still no text, look for any string field that looks like content
              if (!parsed.text) {
                const stringFields = Object.values(parsed).filter(v => typeof v === 'string' && v.length > 50);
                if (stringFields.length > 0) parsed.text = stringFields[0];
              }
            } catch (e) {
              log(`[object] JSON parse error:`, e);
              // Try to rescue truncated JSON if possible (very basic)
              if (text.endsWith('..') || text.length > maxTokens - 10) {
                 log(`[object] Truncation suspected`);
              }
              parsed.text = text;
            }
          }
          resultObject = parsed;
        } else {
          // Robust schema mapping for generateObject
          let zodSchema: any = z.object({ 
            text: z.string().describe("Nội dung chính"),
            suggestions: z.array(z.object({
              label: z.string(),
              action: z.string()
            })).optional()
          });
          
          const { text } = await generateText({
            model,
            system: systemInstruction + (responseSchema ? `\nHãy luôn trả về kết quả dưới dạng JSON hợp lệ với các khóa: ${Object.keys(responseSchema).join(', ')}. Đừng bao gồm bất kỳ văn bản giải thích nào ngoài khối JSON.` : "\nHãy luôn trả về kết quả dưới dạng JSON hợp lệ. Đừng bao gồm bất kỳ văn bản giải thích nào ngoài khối JSON."),
            messages: formattedMessages,
            maxTokens: maxTokens,
            maxRetries: 1,
          } as any);

          log(`[object] response snippet:`, text.substring(0, 100));
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          let parsed: any = { text: text };
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
              if (!parsed.text && (parsed.response || parsed.message || parsed.content)) {
                parsed.text = parsed.response || parsed.message || parsed.content;
              }
              if (!parsed.text) {
                const stringFields = Object.values(parsed).filter(v => typeof v === 'string' && v.length > 50);
                if (stringFields.length > 0) parsed.text = stringFields[0];
              }
            } catch (e) {
              log(`[object] JSON parse error, returning raw text in text field`);
              parsed.text = text;
            }
          }
          resultObject = parsed;
        }
        return res.json({ object: resultObject });
      } else {
        log(`[text] Calling generateText`);
        const { text, toolCalls } = await generateText({
          model,
          system: systemInstruction,
          messages: formattedMessages,
          tools: tools,
          maxTokens: 2048,
          maxRetries: 1,
        } as any);
        log(`[text] Response received, text length: ${text?.length || 0}`);
        
        if (!text && (!toolCalls || toolCalls.length === 0)) {
          throw new Error("AI trả về kết quả rỗng. Vui lòng thử lại hoặc chọn model khác.");
        }
        
        return res.json({ text, toolCalls });
      }
    } catch (error: any) {
      console.error("AI Proxy Error:", error);
      
      // Extract the actual error message if it's deeply nested in AI SDK error objects
      let rawErrorMessage = error.message || String(error);
      if (error.data && error.data.error) {
         rawErrorMessage = error.data.error.message || rawErrorMessage;
      } else if (error.cause && error.cause.message) {
         rawErrorMessage = error.cause.message;
      }

      let errorMessage = rawErrorMessage || "Đã xảy ra lỗi khi gọi AI.";
      let statusCode = 500;

      if (errorMessage.toLowerCase().includes("high demand") || errorMessage.includes("429")) {
        errorMessage = "Hệ thống AI hiện đang quá tải (High Demand). Hệ thống đã thử các model dự phòng nhưng đều bận. Vui lòng thử lại sau ít phút hoặc đổi sang model khác trong Cài đặt.";
        statusCode = 429;
      } else if (errorMessage.includes("quota") || errorMessage.includes("limit")) {
        errorMessage = "Bạn đã hết hạn mức sử dụng (Quota) cho model này. Vui lòng thử lại sau hoặc chuyển sang model khác (như Groq hoặc NVIDIA).";
        statusCode = 429;
      } else if (errorMessage.includes("not found")) {
        errorMessage = `Model "${modelId}" không tìm thấy hoặc chưa được hỗ trợ với API Key này.`;
        statusCode = 404;
      } else if (errorMessage.includes("API key")) {
        errorMessage = "API Key không hợp lệ hoặc chưa được cấu hình đúng.";
        statusCode = 401;
      }

      res.status(statusCode).json({ error: errorMessage, rawError: rawErrorMessage });
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
