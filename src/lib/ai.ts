import { z } from "zod";
import { logger } from "./logger";
import { GoogleGenAI, Type } from "@google/genai";
import { QuotaTracker } from "./quota-tracker";

// Initialize Gemini in frontend as per skill requirement.
// We generally prefer the server proxy, but keep this for direct SDK usage if needed (e.g. in Capacitor).

const getClientSafeKey = () => {
  let key;
  if (typeof process !== "undefined" && process.env) {
    key = process.env.GEMINI_API_KEY;
  } else if (typeof import.meta !== "undefined" && import.meta.env) {
    key = (import.meta.env as any).VITE_GEMINI_API_KEY;
  }
  if (
    !key ||
    key === "undefined" ||
    key === "null" ||
    key.length < 10 ||
    key.includes("dummy_key")
  ) {
    return undefined;
  }
  return key;
};

const clientApiKey = getClientSafeKey();

const googleAI = new GoogleGenAI({
  apiKey: clientApiKey || "dummy_key_to_prevent_crash_on_load",
});

const isDummyKey = !clientApiKey;

// Types
export type AIProvider =
  | "google"
  | "openai"
  | "anthropic"
  | "nvidia"
  | "groq"
  | "openrouter"
  | "cerebras"
  | "sambanova"
  | "cloudflare"
  | "mistral"
  | "cohere"
  | "ai21"
  | "deepseek";

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
  supportsVision?: boolean;
  tags?: ("vision" | "reasoning" | "light" | "coding")[];
}

export const AVAILABLE_MODELS: AIModel[] = [
  // Google
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    provider: "google",
    description: "Nhanh, ổn định, hỗ trợ Vision tốt. Phổ biến nhất.",
    supportsVision: true,
    tags: ["light", "vision"],
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "google",
    description: "Khả năng suy luận cao, context cực dài (2M).",
    supportsVision: true,
    tags: ["reasoning", "vision"],
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    description: "Thế hệ mới nhất, phản hồi siêu tốc.",
    supportsVision: true,
    tags: ["light", "vision", "reasoning"],
  },

  // Groq
  {
    id: "groq/deepseek-r1-distill-llama-70b",
    name: "DeepSeek R1 Distill (Groq)",
    provider: "groq",
    description: "Model R1 tối ưu trên hạ tầng Groq siêu tốc.",
    supportsVision: false,
    tags: ["reasoning"],
  },
  {
    id: "groq/llama-3.3-70b-versatile",
    name: "Llama 3.3 70B (Groq)",
    provider: "groq",
    description: "Llama 3.3 mạnh mẽ chạy trên Groq LPU.",
    supportsVision: false,
    tags: ["reasoning"],
  },
  {
    id: "groq/gemma2-9b-it",
    name: "Gemma 2 9B (Groq)",
    provider: "groq",
    description: "Google Gemma 2 gọn nhẹ và thông minh.",
    supportsVision: false,
    tags: ["light"],
  },

  // OpenRouter (Miễn phí & Phổ biến)
  {
    id: "openrouter/deepseek/deepseek-r1:free",
    name: "DeepSeek R1 (Miễn phí)",
    provider: "openrouter",
    description: "Mô hình suy luận cực mạnh từ DeepSeek. Bản miễn phí.",
    supportsVision: false,
    tags: ["reasoning"],
  },
  {
    id: "openrouter/deepseek/deepseek-chat",
    name: "DeepSeek V3 (OpenRouter)",
    provider: "openrouter",
    description: "DeepSeek V3 mới nhất, thông minh và giá rẻ.",
    supportsVision: false,
    tags: ["reasoning", "coding"],
  },
  {
    id: "openrouter/google/gemma-2-9b-it:free",
    name: "Gemma 2 9B (Miễn phí)",
    provider: "openrouter",
    description: "Gemma 2 từ Google qua OpenRouter.",
    supportsVision: false,
    tags: ["light"],
  },
  {
    id: "openrouter/zhipu/glm-4-9b-chat",
    name: "GLM-4 9B (OpenRouter)",
    provider: "openrouter",
    description: "Mô hình GLM 4 mạnh mẽ từ Zhipu AI.",
    supportsVision: false,
    tags: ["reasoning"],
  },

  // Nvidia & Others
  {
    id: "nvidia/meta/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B (Nvidia)",
    provider: "nvidia",
    description: "Chạy qua Nvidia NIM API siêu tốc.",
    supportsVision: false,
    tags: ["reasoning"],
  },
  {
    id: "nvidia/deepseek/deepseek-r1",
    name: "DeepSeek R1 (Nvidia)",
    provider: "nvidia",
    description: "DeepSeek R1 trên hạ tầng Nvidia NIM.",
    supportsVision: false,
    tags: ["reasoning"],
  },
  {
    id: "nvidia/moonshotai/kimi-k2.5",
    name: "Kimi k2.5 (Nvidia)",
    provider: "nvidia",
    description: "Mô hình Kimi k2.5 hiệu năng cao trên Nvidia NIM.",
    supportsVision: true,
    tags: ["reasoning", "vision"],
  },
];

export interface AIConfig {
  openaiKey?: string;
  anthropicKey?: string;
  googleKey?: string;
  nvidiaKey?: string;
  groqKey?: string;
  openrouterKey?: string;
  cerebrasKey?: string;
  sambanovaKey?: string;
  cloudflareKey?: string;
  mistralKey?: string;
  cohereKey?: string;
  ai21Key?: string;
  deepseekKey?: string;
  // Chef Profile
  chefExpertise?: string;
  chefPhilosophy?: string;
  chefPassions?: string;
  chefTone?: "professional" | "creative" | "minimalist" | "supportive";
}

/**
 * Constructs a dynamic context string based on the Chef's personal profile.
 */
export function getChefContext(config?: AIConfig): string {
  if (!config) return "";

  let context = "\n\n--- THÔNG TIN CÁ NHÂN HÓA CỦA CHEF ---\n";
  if (config.chefExpertise) context += `- Chuyên môn/Sở trường: ${config.chefExpertise}\n`;
  if (config.chefPhilosophy) context += `- Triết lý & Văn hoá ẩm thực: ${config.chefPhilosophy}\n`;
  if (config.chefPassions) context += `- Ý tưởng & Đam mê hiện tại: ${config.chefPassions}\n`;
  
  const toneMap = {
    professional: "Hãy phản hồi với văn phong chuyên nghiệp, chính xác và nghiêm túc.",
    creative: "Hãy phản hồi với văn phong sáng tạo, giàu cảm hứng và phóng khoáng.",
    minimalist: "Hãy phản hồi cực kỳ ngắn gọn, đi thẳng vào vấn đề và thực dụng.",
    supportive: "Hãy phản hồi như một người cố vấn (mentor), ấm áp và cổ vũ tinh thần."
  };
  
  if (config.chefTone) {
    context += `- Yêu cầu văn phong: ${toneMap[config.chefTone] || toneMap.professional}\n`;
  }

  context += "--- HẾT THÔNG TIN CÁ NHÂN HÓA ---\n\n";
  context += "Ghi chú: Khi trả lời, hãy tinh tế lồng ghép phong cách và chuyên môn trên vào nội dung tư vấn để Chef cảm thấy sự đồng điệu. Nếu Chef đang có đam mê cụ thể, hãy ưu tiên gợi ý xoay quanh đam mê đó.";

  return context;
}

// AI Interaction Functions
function formatMessages(messages: any[]) {
  const aiMessages = messages
    .map((m) => {
      // Standardize roles for AI SDK: 'user' or 'assistant'
      const role =
        m.role === "model" || m.role === "assistant" ? "assistant" : "user";

      const partsToProcess =
        m.parts ||
        (Array.isArray(m.content)
          ? m.content
          : [{ text: m.text || m.content || "" }]);

      const contentParts = partsToProcess
        .map((p: any) => {
          if (p.inlineData) {
            let base64Data = p.inlineData.data;
            if (base64Data.includes("base64,")) {
              base64Data = base64Data.split("base64,")[1];
            }
            let type = "image";
            if (p.inlineData.mimeType?.startsWith("video/")) type = "video";
            else if (!p.inlineData.mimeType?.startsWith("image/"))
              type = "file";

            return {
              type,
              [type === "image"
                ? "image"
                : type === "video"
                ? "video"
                : "data"]: base64Data,
              mimeType: p.inlineData.mimeType,
            };
          }

          // Support my internal format directly if it's already structured
          if (p.type === "image" || p.type === "video" || p.type === "file") {
            let base64Data = p.image || p.video || p.data || p.inlineData?.data;
            if (
              base64Data &&
              typeof base64Data === "string" &&
              base64Data.includes("base64,")
            ) {
              base64Data = base64Data.split("base64,")[1];
            }
            return {
              type: p.type,
              [p.type === "image"
                ? "image"
                : p.type === "video"
                ? "video"
                : "data"]: base64Data,
              mimeType: p.mimeType || p.inlineData?.mimeType,
            };
          }

          return { type: "text", text: p.text || "" };
        })
        .filter((p: any) => {
          if (p.type === "image") return !!p.image;
          if (p.type === "video") return !!p.video;
          if (p.type === "file") return !!p.data;
          if (p.type === "text") return p.text.trim().length > 0;
          return false;
        });

      // Handle empty messages - Gemini rejects these
      if (contentParts.length === 0) {
        return { role, content: "..." };
      }

      // If only one text part, simplify to string for broader compatibility
      if (contentParts.length === 1 && contentParts[0].type === "text") {
        return { role, content: contentParts[0].text };
      }

      return { role, content: contentParts };
    })
    .filter((m) => {
      // Ensure we don't send messages with invalid content
      if (typeof m.content === "string") return m.content.trim().length > 0;
      if (Array.isArray(m.content)) return m.content.length > 0;
      return false;
    });

  // Ensure conversation starts with user if not empty
  if (aiMessages.length > 0 && aiMessages[0].role === "assistant") {
    aiMessages.unshift({ role: "user", content: "Tiếp tục phân tích." });
  }

  // Fallback for empty message list
  if (aiMessages.length === 0) {
    aiMessages.push({ role: "user", content: "Xin chào." });
  }

  return aiMessages;
}

// Convert AI SDK message format to @google/genai format
function convertToGeminiMessages(messages: any[]) {
  return messages.map((m) => {
    let role = m.role;
    if (role === "assistant") role = "model";

    let parts: any[] = [];
    if (typeof m.content === "string") {
      parts.push({ text: m.content });
    } else if (Array.isArray(m.content)) {
      parts = m.content.map((c) => {
        if (c.type === "image" || c.type === "video" || c.type === "file") {
          return {
            inlineData: {
              data: c.image || c.video || c.data,
              mimeType:
                c.mimeType || (c.type === "video" ? "video/mp4" : "image/jpeg"),
            },
          };
        }
        return { text: c.text };
      });
    }

    return { role, parts };
  });
}

// Convert tools to Gemini function declarations
function convertToGeminiTools(tools?: any) {
  if (!tools) return undefined;

  const functionDeclarations: any[] = [];

  Object.entries(tools).forEach(([name, definition]: [string, any]) => {
    // We cannot easily convert Zod schemas to Gemini API schemas manually here without zod-to-json-schema
    // Instead of doing a half-baked conversion that crashes Gemini (like 'type: None'),
    // we'll just omit tools from direct Gemini SDK calls entirely on the client,
    // since we prefer the server proxy (which uses Vercel AI SDK that handles tool schemas natively) anyway.
    logger.warn(
      `[convertToGeminiTools] Tool '${name}' ignored in client SDK fallback to prevent schema crash.`
    );
  });

  return functionDeclarations.length > 0
    ? [{ functionDeclarations }]
    : undefined;
}

// Helper to robustly parse JSON from AI responses
function robustParseJson(jsonStr: string) {
  if (!jsonStr) return {};

  let cleaned = jsonStr.trim();

  // Remove markdown code blocks if present
  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n");
    if (lines[0].startsWith("```")) lines.shift();
    if (lines[lines.length - 1].trim().startsWith("```")) lines.pop();
    cleaned = lines.join("\n").trim();
  }

  // Attempt standard parse first
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && parsed !== null) {
      parsed._rawResponse = cleaned;
    }
    return parsed;
  } catch (e: any) {
    logger.warn("[robustParseJson] Initial parse failed, attempting cleanup", {
      error: e.message,
    });
  }

  // Find the first '{' or '['
  const startIndex = cleaned.search(/[\{\[]/);
  if (startIndex === -1) {
    throw new Error("No JSON object or array found in response");
  }

  let openBraces = 0;
  let endIndex = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{" || char === "[") {
        openBraces++;
      } else if (char === "}" || char === "]") {
        openBraces--;
        if (openBraces === 0) {
          endIndex = i;
          break;
        }
      }
    }
  }

  if (endIndex !== -1) {
    cleaned = cleaned.substring(startIndex, endIndex + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && parsed !== null) {
      parsed._rawResponse = cleaned;
    }
    return parsed;
  } catch (e: any) {
    try {
      // Common AI mistakes: trailing commas, single quotes on keys
      const fixed = cleaned
        .replace(/,\s*([\}\]])/g, "$1") // Trailing commas
        .replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":'); // Single quoted keys

      const parsed = JSON.parse(fixed);
      if (typeof parsed === "object" && parsed !== null) {
        parsed._rawResponse = fixed;
      }
      return parsed;
    } catch (e2: any) {
      logger.error("[robustParseJson] All parse attempts failed", {
        error: e2.message,
        snippet: cleaned.slice(0, 100) + "...",
      });
      // Thêm raw message để debug
      throw new Error(
        `Failed to parse AI response. Raw output: ${cleaned.substring(
          0,
          200
        )}...`
      );
    }
  }
}

/**
 * Streaming Chat Agent for Gemini Frontend
 */
export async function* chatWithAIStream(
  modelId: string,
  messages: any[],
  systemInstruction: string,
  config?: AIConfig
) {
  const mappedModelId = modelId.includes("gemini")
    ? modelId
    : "gemini-2.0-flash";

  const formattedMessages = formatMessages(messages);
  const geminiMessages = convertToGeminiMessages(formattedMessages);
  const personalizedInstruction = (systemInstruction || "") + getChefContext(config);

  try {
    const stream = await googleAI.models.generateContentStream({
      model: mappedModelId,
      contents: geminiMessages,
      config: {
        systemInstruction: personalizedInstruction,
        temperature: 0.7,
      },
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error: any) {
    logger.captureApiError(`chatWithAIStream [${mappedModelId}]`, error);
    throw error;
  }
}

/**
 * Smart Agent with Multi-step Tool Calling and Self-Correction
 */
export async function chatWithAI(
  modelId: string,
  messages: any[],
  systemInstruction: string,
  tools?: any,
  config?: AIConfig,
  responseSchema?: any,
  type?: "text" | "object" | "multi-agent" | "insights"
) {
  const formattedMessages = formatMessages(messages);
  const personalizedInstruction = (systemInstruction || "") + getChefContext(config);
  
  logger.info(`[chatWithAI] Request to ${modelId}`, {
    type: type || (responseSchema ? "object" : "text"),
  });

  // Multi-provider routing setup
  let apiKey = "";
  let baseURL = "";
  let actualModelId = modelId;

  if (modelId.startsWith("openrouter/")) {
    apiKey = config?.openrouterKey || "";
    baseURL = "https://openrouter.ai/api/v1/chat/completions";
  } else if (modelId.startsWith("groq/")) {
    apiKey = config?.groqKey || "";
    baseURL = "https://api.groq.com/openai/v1/chat/completions";
    actualModelId = modelId.replace("groq/", "");
    if (actualModelId.includes("deepseek-r1-distill-llama-70b")) {
      actualModelId = "llama-3.3-70b-versatile";
    }
  } else if (modelId.startsWith("nvidia/")) {
    apiKey = config?.nvidiaKey || "";
    baseURL = "https://integrate.api.nvidia.com/v1/chat/completions";
    actualModelId = modelId.replace("nvidia/", "");
  } else if (modelId.startsWith("deepseek/")) {
    apiKey = config?.deepseekKey || "";
    baseURL = "https://api.deepseek.com/v1/chat/completions";
    actualModelId = modelId.replace("deepseek/", "");
  } else if (modelId.startsWith("anthropic/") || modelId.startsWith("claude")) {
    apiKey = config?.anthropicKey || "";
    baseURL = "https://api.anthropic.com/v1/messages";
    actualModelId = modelId.replace("anthropic/", "");
  } else if (modelId.startsWith("gpt")) {
    apiKey = config?.openaiKey || "";
    baseURL = "https://api.openai.com/v1/chat/completions";
  }

  // Disable Direct Client FETCH in standard web environments to avoid CORS issues.
  // We will prefer the server-side proxy which is more reliable.
  const isCapacitor = (window as any).Capacitor !== undefined;

  // Handle Anthropic specifically since its API structure is completely different
  if (isCapacitor && (modelId.startsWith("claude") || modelId.startsWith("anthropic/")) && apiKey && baseURL) {
    logger.info(
      `[chatWithAI] Using Direct Client FETCH for Anthropic ${modelId}`
    );
    try {
      const fetchPayload: any = {
        model: modelId,
        max_tokens: 4096,
        system: personalizedInstruction || "",
        messages: formattedMessages.map((msg) => ({
          role: msg.role === "assistant" ? "assistant" : "user",
          content:
            typeof msg.content === "string"
              ? msg.content
              : msg.content
                  .map((c: any) => c.text || JSON.stringify(c))
                  .join(" "),
        })),
        temperature: 0.7,
      };

      const response = await fetch(baseURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerously-allow-browser": "true", // Capacitor runs as native, but this is required for Webpack/Browser environments
        },
        body: JSON.stringify(fetchPayload),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        const errMsg =
          errJson?.error?.message || (await response.text()) || "Unknown error";
        throw new Error(`[${response.status}] ${errMsg}`);
      }

      const payload = await response.json();
      const contentStr = payload.content?.[0]?.text || "{}";

      if (responseSchema) {
        return robustParseJson(contentStr);
      }

      return { text: contentStr };
    } catch (e: any) {
      logger.error(`[chatWithAI] Direct fetch failed for ${modelId}`, e);
      throw e;
    }
  }

  // Handle OpenAI-compatible endpoints
  if (isCapacitor && apiKey && baseURL && !modelId.startsWith("claude")) {
    logger.info(
      `[chatWithAI] Using Direct Client FETCH (CORS Safe in Capacitor) for ${modelId}`
    );
    try {
      const fetchPayload: any = {
        model: actualModelId,
        messages: [
          ...(personalizedInstruction
            ? [{ role: "system", content: personalizedInstruction }]
            : []),
          ...formattedMessages.map((msg) => ({
            role: msg.role,
            content:
              typeof msg.content === "string"
                ? msg.content
                : msg.content
                    .map((c: any) => c.text || JSON.stringify(c))
                    .join(" "),
          })),
        ],
        temperature: 0.7,
      };

      if (responseSchema) {
        // Since responseSchema is a Zod object, it cannot be passed directly into OpenAI's json_schema object
        // Use standard json_object format instead
        fetchPayload.response_format = { type: "json_object" };
      }

      const response = await fetch(baseURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://souschef.app",
          "X-Title": "SousChef AI",
        },
        body: JSON.stringify(fetchPayload),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        const errMsg =
          errJson?.error?.message || (await response.text()) || "Unknown error";
        throw new Error(`[${response.status}] ${errMsg}`);
      }

      const payload = await response.json();
      const contentStr = payload.choices?.[0]?.message?.content || "{}";

      if (responseSchema) {
        return robustParseJson(contentStr);
      }

      return { text: contentStr };
    } catch (e: any) {
      logger.error(`[chatWithAI] Direct fetch failed for ${modelId}`, e);
      throw e; // Fail directly in Capacitor apps
    }
  }

  // If not Gemini or if multi-agent/insights/object is requested, prefer server proxy.
  // Also prefer server proxy if we don't have a valid key in the browser (standard for AI Studio).
  if (
    !modelId.startsWith("gemini") ||
    type ||
    responseSchema ||
    (isDummyKey && !isCapacitor)
  ) {
    logger.info(
      `[chatWithAI] Calling server proxy for ${modelId}${
        type ? ` (type: ${type})` : ""
      }`
    );
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId,
        messages: formattedMessages,
        systemInstruction: personalizedInstruction,
        type: type || (responseSchema ? "object" : "text"),
        config, // Pass user preferences (including API keys) to server safely
        ...(type === "multi-agent"
          ? { inventoryData: tools?.inventory, recipeData: tools?.recipes }
          : {}),
        ...(type === "insights"
          ? { inventory: tools?.inventory, recipes: tools?.recipes }
          : {}),
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(
        errorData.error || `AI request failed: ${response.status}`
      );
    }

    const result = await response.json();
    if (type === "multi-agent" || type === "insights" || responseSchema) {
      return result.object;
    }
    return { text: result.text, functionCalls: result.toolCalls };
  }

  // Handle Gemini directly via SDK (only for simple text chat when direct access is preferred)
  logger.info(`[chatWithAI] Using Direct Client SDK for Gemini: ${modelId}`);
  try {
    const geminiMessages = convertToGeminiMessages(formattedMessages);
    const res = await googleAI.models.generateContent({
      model: modelId,
      contents: geminiMessages,
      config: {
        systemInstruction: personalizedInstruction || undefined,
        temperature: 0.7,
      },
    });

    return { text: res.text || "" };
  } catch (e: any) {
    logger.error(`[chatWithAI] Direct Gemini SDK fetch failed`, {
      error: e.message,
      raw: e,
    });

    // As a last resort, if direct SDK fails, try the server proxy if not Capacitor
    if (!isCapacitor) {
      logger.info(
        `[chatWithAI] Retrying via server proxy after direct SDK failure...`
      );
      return chatWithAI(
        modelId,
        messages,
        systemInstruction,
        tools,
        config,
        responseSchema,
        type || "text"
      );
    }

    throw e;
  }
}

/**
 * Multi-Agent Orchestration (Feature #3 & #6)
 * Coordinates between Creative and Financial agents
 */
export async function multiAgentChat(
  modelId: string,
  messages: any[],
  systemInstruction: string,
  config?: AIConfig,
  inventoryData?: any[],
  recipeData?: any[]
) {
  return chatWithAI(
    modelId,
    messages,
    systemInstruction,
    { inventory: inventoryData, recipes: recipeData },
    config,
    undefined,
    "multi-agent"
  );
}

/**
 * Proactive Insight Agent (Feature #4)
 */
export async function generateProactiveInsights(
  modelId: string,
  inventory: any[],
  recipes: any[],
  config?: AIConfig
) {
  try {
    // Always prefer a lightweight model for background tasks like proactive insights
    const lightModelId = "groq/llama-3.1-8b-instant";

    return await chatWithAIWithFallback(
      lightModelId,
      [],
      "",
      { inventory, recipes },
      config,
      ["gemini-2.0-flash-lite", "gemini-2.0-flash"], // fast and light fallback, avoid heavy ones or openrouter
      undefined,
      "insights"
    );
  } catch (error: any) {
    logger.info(
      `[generateProactiveInsights] Background task gracefully skipped due to AI limits: ${
        error.message || String(error)
      }`
    );
    return { insights: [] };
  }
}

/**
 * Fallback mechanism using AI SDK
 */
export async function chatWithAIWithFallback(
  modelId: string,
  messages: any[],
  systemInstruction: string,
  tools?: any,
  config?: AIConfig,
  fallbackModelIds: string[] = [],
  responseSchema?: any,
  type?: "text" | "object" | "multi-agent" | "insights"
) {
  const modelsToTry = [modelId, ...fallbackModelIds];
  let lastError: any = null;
  let skipProviders = new Set<string>();

  const requiresVision = messages.some((msg: any) =>
    msg.parts?.some(
      (part: any) =>
        part.inlineData ||
        part.type === "image" ||
        part.type === "video" ||
        part.image ||
        part.video
    ) || msg.parts?.some((part: any) => 
      // Handle the case where the content contains images in a structured way
      typeof part === 'object' && (part.type === 'image' || part.image || part.inlineData)
    )
  );

  let filteredModelsToTry = [...modelsToTry];
  
  // If vision is required, ensure we only try models that support it
  if (requiresVision) {
    filteredModelsToTry = modelsToTry.filter(id => {
      const info = AVAILABLE_MODELS.find(m => m.id === id);
      return info?.supportsVision === true;
    });
    
    // Add default vision fallbacks if list is empty
    if (filteredModelsToTry.length === 0) {
      filteredModelsToTry = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];
    }
  }

  for (const currentModelId of filteredModelsToTry) {
    let provider = "google";
    if (currentModelId.startsWith("openrouter/")) provider = "openrouter";
    else if (currentModelId.startsWith("groq/")) provider = "groq";
    else if (currentModelId.startsWith("nvidia/")) provider = "nvidia";
    else if (currentModelId.includes("claude")) provider = "anthropic";
    else if (currentModelId.includes("gpt")) provider = "openai";

    if (skipProviders.has(provider)) {
      logger.info(
        `[chatWithAIWithFallback] Skipping ${currentModelId} because provider ${provider} is out of quota`
      );
      continue;
    }

    const modelInfo = AVAILABLE_MODELS.find(
      (m) => m.id === currentModelId || m.id === `openrouter/${currentModelId}`
    );
    if (requiresVision && modelInfo && modelInfo.supportsVision === false) {
      logger.info(
        `[chatWithAIWithFallback] Skipping ${currentModelId} because it does not support vision required for this task.`
      );

      if (currentModelId === modelId && typeof window !== "undefined") {
        const fallbackModelStr = modelsToTry.find((id) => {
          const info = AVAILABLE_MODELS.find(
            (m) => m.id === id || m.id === `openrouter/${id}`
          );
          return (
            id !== modelId &&
            info &&
            (info.supportsVision === true || info.supportsVision === undefined)
          );
        });
        const fbName =
          AVAILABLE_MODELS.find((m) => m.id === fallbackModelStr)?.name ||
          fallbackModelStr;
        window.dispatchEvent(
          new CustomEvent("ai-model-fallback", {
            detail: {
              originalModel: modelInfo.name,
              reason: "vision_support",
              fallbackModel: fbName,
            },
          })
        );
      }

      if (!lastError)
        lastError = new Error(
          `${currentModelId} không hỗ trợ phân tích hình ảnh.`
        );
      continue;
    }
    if (requiresVision && !modelInfo?.supportsVision) {
      logger.info(
        `[chatWithAIWithFallback] Skipping ${currentModelId} because it does not formally support vision.`
      );

      if (currentModelId === modelId && typeof window !== "undefined") {
        const fallbackModelStr = modelsToTry.find((id) => {
          const info = AVAILABLE_MODELS.find(
            (m) => m.id === id || m.id === `openrouter/${id}`
          );
          return id !== modelId && info && info.supportsVision;
        });
        const fbName =
          AVAILABLE_MODELS.find((m) => m.id === fallbackModelStr)?.name ||
          fallbackModelStr;
        window.dispatchEvent(
          new CustomEvent("ai-model-fallback", {
            detail: {
              originalModel: modelInfo?.name || currentModelId,
              reason: "vision_support",
              fallbackModel: fbName,
            },
          })
        );
      }

      if (!lastError)
        lastError = new Error(
          `${currentModelId} không hỗ trợ phân tích hình ảnh.`
        );
      continue;
    }

    const quotaTracker = QuotaTracker.getInstance();
    const quotaCheck = quotaTracker.canRequest(provider, currentModelId, 0);
    if (!quotaCheck.allowed) {
      logger.warn(
        `[chatWithAIWithFallback] Local Quota Tracker prevented request: ${quotaCheck.reason}`
      );
      skipProviders.add(provider);
      if (!lastError)
        lastError = new Error(
          `Local Quota reached for ${provider}: ${quotaCheck.reason}`
        );
      continue;
    }

    try {
      logger.info(`[chatWithAIWithFallback] Trying model: ${currentModelId}`);

      // 45s Timeout wrapper
      const aiCallPromise = chatWithAI(
        currentModelId,
        messages,
        systemInstruction,
        tools,
        config,
        responseSchema,
        type
      );
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error("AI Request Timeout - Quá thời gian phản hồi (45s)")
            ),
          45000
        );
      });

      const response = await Promise.race([aiCallPromise, timeoutPromise]);
      // Assuming average 500 tokens for now, as we don't return usage everywhere
      quotaTracker.recordRequest(provider, currentModelId, 500);
      return response;
    } catch (error: any) {
      logger.warn(
        `[chatWithAIWithFallback] Error with ${currentModelId}: ${
          error.message || String(error)
        }`
      );

      const errMsg = (error.message || String(error)).toLowerCase();
      const isQuotaError =
        errMsg.includes("[429]") ||
        errMsg.includes("quota") ||
        errMsg.includes("limit") ||
        errMsg.includes("credits") ||
        errMsg.includes("afford");
      const isInvalidKeyError =
        errMsg.includes("key not valid") ||
        errMsg.includes("api key") ||
        errMsg.includes("không tìm thấy api key") ||
        errMsg.includes("unauthorized");
      const isNotFoundError =
        errMsg.includes("not found") ||
        errMsg.includes("404") ||
        errMsg.includes("not supported");

      if (isInvalidKeyError && !isNotFoundError) {
        logger.warn(
          `[chatWithAIWithFallback] Invalid/Missing key for ${provider}. Skipping model ${currentModelId}...`
        );
        skipProviders.add(provider);
        if (!lastError) lastError = error;
        continue;
      }

      if (isQuotaError) {
        if (!(lastError?.message || "").toLowerCase().includes("quota")) {
          lastError = error;
        }
        skipProviders.add(provider);
      } else if (isNotFoundError) {
        logger.info(
          `[chatWithAIWithFallback] Skipping ${currentModelId} because it returned Not Found / Not Supported`
        );
        if (!lastError) lastError = error;
        continue; // skip the wait and go to next model immediately
      } else if (!lastError) {
        lastError = error;
      }

      // If it's a rate limit or high demand wait a bit before trying fallback
      if (isQuotaError || errMsg.includes("high demand")) {
        logger.info(
          `[chatWithAIWithFallback] Temporary error or limit reached, waiting 1s before fallback...`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  logger.warn(
    `[chatWithAIWithFallback] All models failed. Last error: ${
      lastError?.message || String(lastError)
    }`
  );
  if (lastError) {
    const msg = (lastError.message || String(lastError)).toLowerCase();
    const isInvalidKeyError =
      msg.includes("key not valid") ||
      msg.includes("api key") ||
      msg.includes("không tìm thấy api key") ||
      msg.includes("unauthorized");

    if (isInvalidKeyError) {
      throw new Error(
        "Mã API Key không hợp lệ hoặc chưa được cấu hình. Thiết lập thẻ API OpenAI/Anthropic/Groq/OpenRouter tại 'Trợ lý AI' -> 'Bánh Răng Cài Đặt'."
      );
    }
    if (
      msg.includes("quota") ||
      msg.includes("429") ||
      msg.includes("limit") ||
      msg.includes("credits") ||
      msg.includes("afford")
    ) {
      throw new Error(
        "Hạn mức API miễn phí (hoặc Credits) của bạn đã hết. Vui lòng vào 'Trợ lý AI' -> 'Bánh Răng Cài Đặt' và nhập thẻ API OpenAI/Anthropic/Groq/OpenRouter của riêng bạn để tiếp tục."
      );
    }
    if (msg.includes("high demand") || msg.includes("overloaded")) {
      throw new Error(
        "Hệ thống Chef Assistant đang tạm thời có lượng truy cập lớn dẫn đến quá tải. Vui lòng thử lại sau ít phút hoặc sử dụng thẻ API riêng."
      );
    }
    if (msg.includes("500") || msg.includes("status code 500")) {
      throw new Error(
        "Mô hình AI hiện tại đang gặp lỗi từ máy chủ (Error 500) và tất cả hệ thống dự phòng cũng thất bại. Vui lòng thử đổi Mô hình AI khác hoặc thử lại sau."
      );
    }
    if (msg.includes("502") || msg.includes("503") || msg.includes("504")) {
      throw new Error(
        "Mô hình AI đang không phản hồi (Lỗi Server/Timeout). Vui lòng thử lại sau."
      );
    }
    throw lastError;
  }
  throw new Error("All AI models failed.");
}

/**
 * Fallback mechanism for Multi-Agent Chat
 */
export async function multiAgentChatWithFallback(
  modelId: string,
  messages: any[],
  systemInstruction: string,
  config?: AIConfig,
  inventoryData?: any[],
  recipeData?: any[],
  fallbackModelIds: string[] = []
) {
  const modelsToTry = [modelId, ...fallbackModelIds];
  let lastError: any = null;
  let skipProviders = new Set<string>();

  for (const currentModelId of modelsToTry) {
    let provider = "google";
    if (currentModelId.startsWith("openrouter/")) provider = "openrouter";
    else if (currentModelId.startsWith("groq/")) provider = "groq";
    else if (currentModelId.startsWith("nvidia/")) provider = "nvidia";
    else if (currentModelId.includes("claude")) provider = "anthropic";
    else if (currentModelId.includes("gpt")) provider = "openai";

    if (skipProviders.has(provider)) {
      continue;
    }

    const quotaTracker = QuotaTracker.getInstance();
    const quotaCheck = quotaTracker.canRequest(provider, currentModelId, 0);
    if (!quotaCheck.allowed) {
      logger.warn(
        `[multiAgentChatWithFallback] Local Quota Tracker prevented request: ${quotaCheck.reason}`
      );
      skipProviders.add(provider);
      if (!lastError)
        lastError = new Error(
          `Local Quota reached for ${provider}: ${quotaCheck.reason}`
        );
      continue;
    }

    try {
      logger.info(
        `[multiAgentChatWithFallback] Trying model: ${currentModelId}`
      );
      const response = await multiAgentChat(
        currentModelId,
        messages,
        systemInstruction,
        config,
        inventoryData,
        recipeData
      );
      quotaTracker.recordRequest(provider, currentModelId, 800); // Higher estimate for multi-agent
      return response;
    } catch (error: any) {
      logger.warn(
        `[multiAgentChatWithFallback] Error with ${currentModelId}: ${error.message}`
      );

      // Enhance error message with model info
      const errMsg = error.message || String(error);
      const lowerMsg = errMsg.toLowerCase();
      let cleanMsg = errMsg;

      // Detection of common quota/limit errors to provide better UX
      const isQuotaError =
        lowerMsg.includes("quota") ||
        lowerMsg.includes("limit") ||
        lowerMsg.includes("429") ||
        lowerMsg.includes("credits");

      if (isQuotaError) {
        cleanMsg = `Model ${currentModelId
          .split("/")
          .pop()} đạt giới hạn quota (Quota Exceeded). Đang thử model dự phòng...`;
        skipProviders.add(provider);
      }

      lastError = new Error(cleanMsg);

      // If it's a rate limit, high demand, or quota issue, wait a bit before trying fallback
      if (
        isQuotaError ||
        lowerMsg.includes("high demand") ||
        lowerMsg.includes("overloaded")
      ) {
        logger.info(
          `[multiAgentChatWithFallback] Temporary error or limit reached, waiting 0.5s before fallback...`
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  logger.error(`[multiAgentChatWithFallback] All models failed`, lastError);

  // Last chance meaningful error message
  if (
    lastError.message.includes("quota") ||
    lastError.message.includes("limit") ||
    lastError.message.includes("credits")
  ) {
    throw new Error(
      "Hạn mức API miễn phí (hoặc Credits) của bạn đã hết. Vui lòng vào 'Trợ lý AI' -> 'Bánh Răng Cài Đặt' và nhập thẻ API OpenAI/Anthropic/Groq/OpenRouter của riêng bạn để tiếp tục."
    );
  }
  if (
    lastError.message.includes("high demand") ||
    lastError.message.includes("overloaded")
  ) {
    throw new Error(
      "Hệ thống Chef Assistant đang tạm thời có lượng truy cập lớn dẫn đến quá tải. Vui lòng thử lại sau ít phút hoặc sử dụng thẻ API riêng."
    );
  }

  throw lastError || new Error("Mọi mô hình AI đều thất bại.");
}
