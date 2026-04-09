import express from 'express';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: '.env.local' });

export const AVAILABLE_MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'google', description: 'Nhanh, hiệu quả cho các tác vụ hàng ngày.' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'google', description: 'Mạnh mẽ, thông minh vượt trội cho các bài toán phức tạp.' },
  { id: 'gemma-4-it', name: 'Gemma 4', provider: 'google', description: 'Model mã nguồn mở mới nhất từ Google, tối ưu cho hội thoại.' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Model hàng đầu từ OpenAI, đa năng và chính xác.' },
  { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: 'Model thông minh nhất từ Anthropic, viết lách và tư duy tốt.' },
];

let googleAI: GoogleGenAI | null = null;
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

function getGoogleAI() {
  if (!googleAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is missing");
    googleAI = new GoogleGenAI({ apiKey: key });
  }
  return googleAI;
}

function getOpenAI() {
  if (!openaiClient) {
    const key = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is missing.");
    openaiClient = new OpenAI({ apiKey: key });
  }
  return openaiClient;
}

function getAnthropic() {
  if (!anthropicClient) {
    const key = process.env.VITE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is missing.");
    anthropicClient = new Anthropic({ apiKey: key });
  }
  return anthropicClient;
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '50mb' }));

  app.post('/api/chat', async (req, res) => {
    try {
      const { modelId, messages, systemInstruction, tools } = req.body;
      const model = AVAILABLE_MODELS.find(m => m.id === modelId) || AVAILABLE_MODELS[0];

      if (model.provider === 'google') {
        const ai = getGoogleAI();
        const response = await ai.models.generateContent({
          model: model.id,
          contents: messages.map((m: any) => ({
            role: m.role,
            parts: m.parts.map((p: any) => {
              if (p.inlineData) return { inlineData: p.inlineData };
              return { text: p.text || "" };
            })
          })),
          config: {
            systemInstruction,
            responseMimeType: "application/json",
          }
        });

        try {
          res.json(JSON.parse(response.text || "{}"));
        } catch (e) {
          res.json({ text: response.text, suggestions: [] });
        }
        return;
      }

      if (model.provider === 'openai') {
        const openai = getOpenAI();
        const response = await openai.chat.completions.create({
          model: model.id,
          messages: [
            { role: 'system', content: systemInstruction + "\n\nQUAN TRỌNG: Bạn PHẢI trả về kết quả dưới dạng JSON hợp lệ theo cấu trúc đã yêu cầu." },
            ...messages.map((m: any) => ({
              role: m.role === 'model' ? 'assistant' : 'user',
              content: m.parts.map((p: any) => p.text).join('\n')
            }))
          ],
          response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content || "{}";
        res.json(JSON.parse(content));
        return;
      }

      if (model.provider === 'anthropic') {
        const anthropic = getAnthropic();
        const response = await anthropic.messages.create({
          model: model.id,
          system: systemInstruction + "\n\nQUAN TRỌNG: Bạn PHẢI trả về kết quả dưới dạng JSON hợp lệ theo cấu trúc đã yêu cầu.",
          max_tokens: 4096,
          messages: messages.map((m: any) => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.parts.map((p: any) => p.text).join('\n')
          }))
        });

        const content = (response.content[0] as any).text || "{}";
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          res.json(JSON.parse(jsonMatch ? jsonMatch[0] : content));
        } catch (e) {
          res.json({ text: content, suggestions: [] });
        }
        return;
      }

      res.status(400).json({ error: "Provider không hỗ trợ" });
    } catch (error: any) {
      console.error('API Error:', error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.use('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist/index.html'));
    });
  }

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();
