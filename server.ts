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
  
  // Intercept decommissioned Groq model
  if (provider === 'groq' || mId.includes('deepseek-r1-distill-llama-70b')) {
    if (mId.includes('deepseek-r1-distill-llama-70b')) {
      finalId = 'llama-3.3-70b-versatile';
    }
  }
  
  if (provider === 'google') {
    // Follow skill guidelines for Gemini aliases
    if (mId === 'gemini-3-flash-preview') {
      finalId = 'gemini-3-flash-preview';
    } else if (mId === 'gemini-3.1-pro-preview') {
      finalId = 'gemini-3.1-pro-preview';
    } else if (mId.includes('flash') || mId === 'gemini-1.5-flash') {
      finalId = 'gemini-flash-latest';
    } else if (mId.includes('pro') || mId === 'gemini-1.5-pro') {
      finalId = 'gemini-3.1-pro-preview';
    }
  } else if (provider === 'nvidia') {
    // Standardize to llama-3.3 if llama-3.1 is requested
    if (mId.includes('llama-3.1')) {
      finalId = mId.replace('llama-3.1', 'llama-3.3');
    } else if (mId.includes('deepseek-r1') || mId.includes('deepseek-ai')) {
      // NVIDIA NIM does not currently support deepseek-r1 as standard api model, fallback
      finalId = 'meta/llama-3.3-70b-instruct';
    } else if (mId.includes('kimi-2.5')) {
      finalId = 'moonshotai/kimi-k2.5';
    }
  }
  return finalId;
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

// Helper to call NVIDIA NIM directly (bypassing AI SDK bugs in this environment)
async function callNvidiaDirect(modelId: string, apiKey: string, messages: any[], systemInstruction?: string, temperature: number = 0.7, jsonMode: boolean = false) {
  const nvidiaModelId = modelId.replace('nvidia/', '');
  log(`[NVIDIA Direct] Calling ${nvidiaModelId}`);
  
  try {
    const response = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: nvidiaModelId,
        messages: [
          ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
          ...messages
        ],
        temperature,
        response_format: jsonMode ? { type: 'json_object' } : undefined
      })
    }, 45000); // 45s timeout for NVIDIA

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`NVIDIA API Error: ${response.status} ${errText}`);
    }

    const data = await response.json() as any;
    const text = data.choices[0].message.content;
    return { text };
  } catch (error: any) {
    log(`[NVIDIA Direct] Error calling ${nvidiaModelId}:`, error.message);
    throw error;
  }
}

// Market Data Simulator
const MARKET_DATA: Record<string, { price: number, unit: string }> = {
  "thịt bò": { price: 250000, unit: "kg" },
  "thịt lợn": { price: 120000, unit: "kg" },
  "thịt gà": { price: 90000, unit: "kg" },
  "cá hồi": { price: 450000, unit: "kg" },
  "tôm": { price: 180000, unit: "kg" },
  "hành tây": { price: 15000, unit: "kg" },
  "tỏi": { price: 40000, unit: "kg" },
  "gừng": { price: 30000, unit: "kg" },
  "trứng": { price: 3500, unit: "quả" },
  "sữa": { price: 35000, unit: "lít" },
  "bơ": { price: 200000, unit: "kg" },
  "kem tươi": { price: 150000, unit: "lít" },
  "bột mì": { price: 25000, unit: "kg" },
  "đường": { price: 20000, unit: "kg" },
  "muối": { price: 10000, unit: "kg" },
  "dầu ăn": { price: 45000, unit: "lít" },
  "gạo": { price: 18000, unit: "kg" },
  "ớt": { price: 50000, unit: "kg" },
  "chanh": { price: 20000, unit: "kg" },
  "rau muống": { price: 10000, unit: "bó" },
  "cà chua": { price: 25000, unit: "kg" }
};

async function searchMarketPrices(ingredients: string[]) {
  log(`[Market Search] Searching prices for: ${ingredients.join(", ")}`);
  
  const results = ingredients.map(ing => {
    const lower = ing.toLowerCase();
    const match = Object.entries(MARKET_DATA).find(([key]) => lower.includes(key));
    
    if (match) {
      return { name: ing, price: match[1].price, unit: match[1].unit, source: "Market Hub VN" };
    }
    
    // Simulate smart search for unknown items
    const randomPrice = Math.floor(Math.random() * 200000) + 20000;
    return { name: ing, price: randomPrice, unit: "kg", source: "AI Estimate (Simulated)" };
  });

  return results;
}

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
      const isNvidia = modelId.includes('nvidia');
      const nvidiaApiKey = config?.nvidiaKey || process.env.NVIDIA_API_KEY;

      // Helper to get provider
      const getProvider = (mId: string, cfg: any) => {
        const providerKey = mId.includes('gemini') ? 'google' : 
                           mId.includes('gpt') ? 'openai' :
                           mId.includes('claude') ? 'anthropic' :
                           mId.includes('groq') ? 'groq' :
                           mId.includes('openrouter') ? 'openrouter' :
                           mId.includes('nvidia') ? 'nvidia' : 'google';
        
        const finalId = mapModelId(providerKey, mId);
        
        // Wrap fetch with a default timeout for all AI SDK calls
        const customFetch = (url: string, options: any) => fetchWithTimeout(url, options, 60000);

        const providers: any = {
          google: () => {
            const google = createGoogleGenerativeAI({ 
              apiKey: cfg.googleKey || process.env.GEMINI_API_KEY,
              fetch: customFetch as any
            });
            // Try wrapping ID to ensure it's correct for the SDK if needed
            return google(finalId);
          },
          openai: () => createOpenAI({ 
            apiKey: cfg.openaiKey || process.env.OPENAI_API_KEY,
            fetch: customFetch as any
          })(finalId),
          anthropic: () => createAnthropic({ 
            apiKey: cfg.anthropicKey || process.env.ANTHROPIC_API_KEY,
            fetch: customFetch as any
          })(finalId),
          groq: () => {
            const groqModelId = finalId.startsWith('groq/') ? finalId.slice(5) : finalId;
            return createOpenAI({ 
              apiKey: cfg.groqKey || process.env.GROQ_API_KEY,
              baseURL: 'https://api.groq.com/openai/v1',
              fetch: customFetch as any
            })(groqModelId);
          },
          openrouter: () => {
            const orModelId = finalId.startsWith('openrouter/') ? finalId.slice(11) : finalId;
            return createOpenAI({
              apiKey: cfg.openrouterKey || process.env.OPENROUTER_API_KEY,
              baseURL: 'https://openrouter.ai/api/v1',
              fetch: customFetch as any
            })(orModelId);
          },
          nvidia: () => {
            const nvidiaModelId = finalId.startsWith('nvidia/') ? finalId.slice(7) : finalId;
            return createOpenAI({
              apiKey: cfg.nvidiaKey || process.env.NVIDIA_API_KEY,
              baseURL: 'https://integrate.api.nvidia.com/v1',
              fetch: customFetch as any
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
          if (modelId.includes('nvidia')) {
            const apiKey = req.body.config?.nvidiaKey || process.env.NVIDIA_API_KEY;
            const { text } = await callNvidiaDirect(modelId, apiKey, [{ role: 'user', content: 'Phân tích dữ liệu ngay.' }], systemPrompt, 0.2);
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            resultObject = jsonMatch ? JSON.parse(jsonMatch[0]) : { insights: [] };
          } else if (modelId.includes('groq')) {
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
          
          // Universal fallback using multiple providers in case the selected one fails
          const fallbacks = [
            'nvidia/moonshotai/kimi-k2.5',
            'groq/llama-3.3-70b-versatile',
            'openrouter/meta-llama/llama-3.3-70b-instruct:free',
            'gemini-flash-latest',
            'gemini-3-flash-preview'
          ];

          let success = false;
          for (const fallbackId of fallbacks) {
            try {
              log(`[insights] Trying fallback to ${fallbackId}...`);
              const fallbackModel = getProvider(fallbackId, req.body.config || {}); 
              
              const { text } = await generateText({
                model: fallbackModel,
                system: systemPrompt + "\nQUAN TRỌNG: Trả về JSON hợp lệ. Đừng bao gồm văn bản giải thích.",
                messages: [{ role: 'user', content: 'Phân tích dữ liệu ngay.' }],
                maxTokens: 2048,
              } as any);
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                resultObject = JSON.parse(jsonMatch[0]);
                log(`[insights] Fallback to ${fallbackId} succeeded`);
                success = true;
                break;
              }
            } catch (fallbackError: any) {
              log(`[insights] Fallback to ${fallbackId} failed:`, fallbackError.message);
            }
          }
          if (!success) throw e; // Throw original error if all fallbacks fail
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
        const { text: proposal } = isNvidia 
          ? await callNvidiaDirect(modelId, nvidiaApiKey, formattedMessages, creativePrompt, 0.7)
          : await generateText({
            model,
            system: creativePrompt,
            messages: formattedMessages,
            maxTokens: maxTokens,
            maxRetries: 1,
          } as any);

        // EXTRA STEP: Market Research Agent
        log(`[multi-agent] Calling Market Research Agent`);
        const { text: marketDataText } = await generateText({
          model,
          system: `Bạn là Market Research Agent. Nhiệm vụ: Trích xuất danh sách các nguyên liệu cần thiết từ đề xuất sau và trả về dưới dạng mảng JSON thô.
          Đề xuất: "${proposal}"
          
          PHẢI TRẢ VỀ DẠNG: ["nguyên liệu 1", "nguyên liệu 2", ...]`,
          messages: [{ role: 'user', content: "Trích xuất nguyên liệu ngay." }],
        } as any);
        
        const ingredientMatch = marketDataText.match(/\[.*\]/s);
        const searchIngredients = ingredientMatch ? JSON.parse(ingredientMatch[0]) : [];
        const marketPrices = await searchMarketPrices(searchIngredients);

        // Agent 2: Financial
        const financialPrompt = `
          BẠN LÀ FINANCIAL & INVENTORY EXPERT.
          Dữ liệu giá thị trường mới nhất: ${JSON.stringify(marketPrices)}
          Dữ liệu kho hiện tại: ${JSON.stringify(inventoryData?.slice(0, 20))}
          Dữ liệu công thức hiện tại: ${JSON.stringify(recipeData?.slice(0, 10))}
          Nhiệm vụ: Phân tích đề xuất của Creative Chef dưới góc độ chi phí và khả năng thực thi.
          Đề xuất của Creative Chef: "${proposal}"
          
          YÊU CẦU: Sử dụng dữ liệu giá thị trường ở trên để ước tính Food Cost thực tế.
        `;
        const { text: review } = isNvidia
          ? await callNvidiaDirect(modelId, nvidiaApiKey, [{ role: 'user', content: "Hãy phân tích đề xuất trên." }], financialPrompt, 0.4)
          : await generateText({
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
          
          Nhiệm vụ: Tổng hợp câu trả lời cuối cùng cho người dùng và ĐỀ XUẤT CÁC HÀNH ĐỘNG THỰC THI (proposedActions), kèm theo cấu trúc công thức (recipe) và gợi ý (suggestions) nếu phù hợp.
          
          QUY TẮC TRẢ LỜI:
          1. TRONG TRƯỜNG 'text': Trình bày câu trả lời dưới dạng Markdown đẹp. KHÔNG ĐƯỢC trả về nguyên khối JSON trong phần này. Nếu có danh sách nguyên liệu, hãy dùng định dạng BẢNG (Table) Markdown để người dùng dễ theo dõi.
          2. TRONG TRƯỜNG 'proposedActions': Đây là nơi chứa dữ liệu máy tính đọc được để thực thi hành động. PHẢI TRẢ VỀ mảng này nếu có hành động cần thực hiện (thêm công thức, cập nhật kho).
          3. TRONG TRƯỜNG 'recipe': Gửi kèm thông tin công thức theo cấu trúc chi tiết (mảng nguyên liệu, hướng dẫn) ĐỂ HIỂN THỊ LƯU NHANH TRÊN MÀN HÌNH CHAT.
          4. TRONG TRƯỜNG 'suggestions': Các hành động gợi ý tiếp theo giúp người dùng lựa chọn.
          
          CÁC LOẠI HÀNH ĐỘNG HỖ TRỢ:
          1. 'add_recipe': Thêm một công thức mới. Data: { title, ingredients: [{name, amount, unit}], instructions }.
          2. 'update_inventory': Cập nhật số lượng tồn kho. Data: { name, amount }.
          
          Nếu người dùng yêu cầu tạo món hoặc thảo luận có món mới, hãy dùng 'add_recipe' VÀ cung cấp trường 'recipe' riêng biệt. Nếu nhắc đến nguyên liệu, hãy dùng 'update_inventory'.
        `;
        let resultObject;
        if (modelId.includes('groq')) {
          log(`[multi-agent] Calling Groq orchestrator`);
          const { text } = await generateText({
            model,
            system: orchestratorPrompt,
            messages: [{ role: 'user', content: "Hãy đưa ra kết quả cuối cùng dưới dạng JSON hợp lệ. Đảm bảo có đầy đủ các trường: text (Markdown), internalMonologue (Chuỗi), proposedActions (Mảng), recipe (Đối tượng chứa title, ingredients, instructions, totalCost, recommendedPrice), suggestions (Mảng)." }],
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
        } else if (isNvidia) {
          log(`[multi-agent] Calling NVIDIA orchestrator directly`);
          const { text } = await callNvidiaDirect(
            modelId, 
            nvidiaApiKey, 
            [{ role: 'user', content: "Hãy đưa ra kết quả cuối cùng." }], 
            orchestratorPrompt + "\nHãy luôn trả về kết quả dưới dạng JSON hợp lệ theo đúng cấu trúc sau: { \"text\": \"Câu trả lời...\", \"internalMonologue\": \"Tóm tắt\", \"recipe\": { \"title\": \"Tên\", \"ingredients\": [{\"name\": \"\", \"amount\": \"\", \"unit\": \"\"}], \"instructions\": [], \"totalCost\": 0, \"recommendedPrice\": 0, \"notes\": \"\" }, \"proposedActions\": [], \"suggestions\": [] }",
            0.1,
            true
          );
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          let parsed: any = { text: text, internalMonologue: "" };
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
            } catch (e) {
              log(`[multi-agent] NVIDIA JSON parse error:`, e);
              parsed.text = text;
            }
          }
          resultObject = parsed;
        } else {
          log(`[multi-agent] Calling standard orchestrator via generateText`);
          const { text } = await generateText({
            model,
            system: orchestratorPrompt + "\nHãy luôn trả về kết quả dưới dạng JSON hợp lệ theo đúng cấu trúc sau: { \"text\": \"Câu trả lời...\", \"internalMonologue\": \"Tóm tắt\", \"recipe\": { \"title\": \"Tên\", \"ingredients\": [{\"name\": \"\", \"amount\": \"\", \"unit\": \"\"}], \"instructions\": [], \"totalCost\": 0, \"recommendedPrice\": 0, \"notes\": \"\" }, \"proposedActions\": [], \"suggestions\": [] }",
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
        } else if (isNvidia) {
          log(`[object] Calling NVIDIA directly`);
          const promptSuffix = responseSchema ? `\nPHẢI TRẢ VỀ JSON KHÔNG CÓ TEXT GIẢI THÍCH BAO QUANH. Cấu trúc yêu cầu có các khóa: ${Object.keys(responseSchema).join(', ')}.` : "\nTRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON.";
          const { text } = await callNvidiaDirect(modelId, nvidiaApiKey, formattedMessages, systemInstruction + promptSuffix, 0.2, true);
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          let parsed: any = { text: text };
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
            } catch (e) {
              log(`[object] NVIDIA JSON parse error:`, e);
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
            tools: {
              search_market_price: {
                description: "Tìm kiếm giá thị trường hiện tại của các nguyên liệu tại Việt Nam.",
                parameters: z.object({
                  ingredients: z.array(z.string())
                }),
                execute: async ({ ingredients }) => {
                  const data = await searchMarketPrices(ingredients);
                  return JSON.stringify(data);
                }
              }
            },
            maxSteps: 3,
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
        let responseText: string;
        let finalToolCalls: any[] | undefined = undefined;

        if (isNvidia) {
          const res = await callNvidiaDirect(modelId, nvidiaApiKey, formattedMessages, systemInstruction);
          responseText = res.text;
        } else {
          // Add tool execution logic for market search
          const res = await generateText({
            model,
            system: systemInstruction,
            messages: formattedMessages,
            tools: {
              search_market_price: {
                description: "Tìm kiếm giá thị trường hiện tại của các nguyên liệu tại Việt Nam.",
                parameters: z.object({
                  ingredients: z.array(z.string())
                }),
                execute: async ({ ingredients }) => {
                  const data = await searchMarketPrices(ingredients);
                  return JSON.stringify(data);
                }
              }
            },
            maxSteps: 3, // Enable tool calling loop
            maxTokens: 2048,
            maxRetries: 1,
            // Automatically execute tools if requested
            onStepFinish: ({ text, toolCalls }) => {
              log(`Step finished. Text length: ${text?.length || 0}. Tools: ${toolCalls?.length || 0}`);
            }
          } as any);
          responseText = res.text;
          finalToolCalls = res.toolCalls;
        }
        log(`[text] Response received, text length: ${responseText?.length || 0}`);
        
        if (!responseText && (!finalToolCalls || finalToolCalls.length === 0)) {
          throw new Error("AI trả về kết quả rỗng. Vui lòng thử lại hoặc chọn model khác.");
        }
        
        return res.json({ text: responseText, toolCalls: finalToolCalls });
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
      } else if (errorMessage.toLowerCase().includes("timeout") || errorMessage.includes("ETIMEDOUT")) {
        errorMessage = "Kết nối đến đối tác AI (NVIDIA/Groq) bị quá hạn (Timeout). Vui lòng thử lại sau hoặc chuyển sang model Gemini để ổn định hơn.";
        statusCode = 504;
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
