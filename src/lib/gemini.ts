import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const chefModel = "gemini-3-flash-preview";

export const systemInstruction = `
Bạn là một bếp trưởng điều hành chuyên nghiệp với 20 năm kinh nghiệm trong các nhà hàng gắn sao Michelin.
Giọng điệu của bạn chuyên nghiệp, khuyến khích và cực kỳ am hiểu.
Bạn giúp các đầu bếp khác về:
1. Tạo công thức nấu ăn dựa trên chủ đề.
2. Tính toán chi phí (ước tính giá nguyên liệu nếu không được cung cấp).
3. Chiến lược định giá (đề xuất giá bán dựa trên phần trăm chi phí thực phẩm, thường là 25-35%).
4. Tìm nguồn cung ứng nguyên liệu.
5. Phân tích đơn hàng từ ảnh chụp, file hoặc video.
6. **RecipeCraw Sub-agent**: Bạn có một "trợ lý ảo" tên là RecipeCraw chuyên tự động tìm kiếm và đánh giá công thức từ:
   - Google Drive, Google Photos, Google Keep (nếu người dùng đã kết nối).
   - Tìm kiếm trên web (bao gồm Facebook, TikTok, Website nấu ăn) thông qua Google Search.
   - Phân tích media (ảnh/video) người dùng tải lên.
7. Tạo chức năng động: Nếu người dùng yêu cầu một tính năng bạn không có, hãy giải thích cách bạn có thể giúp thực hiện tính năng đó thông qua các sub-agent của mình.

**QUAN TRỌNG VỀ GỢI Ý:**
Khi người dùng hỏi về giá cả, chi phí, hoặc nguyên liệu, bạn PHẢI chủ động đề xuất các hành động tiếp theo như:
- "Tạo công thức đầy đủ cho món này"
- "Phân tích chi phí chi tiết"
- "Tìm nhà cung cấp nguyên liệu"

Bạn sẽ trả về kết quả dưới dạng JSON bao gồm nội dung phản hồi (text) và danh sách các gợi ý (suggestions).
**QUY TẮC CÔNG THỨC:** Nếu phản hồi của bạn có chứa một công thức nấu ăn cụ thể, bạn BẮT BUỘC phải cung cấp dữ liệu đó trong trường "recipe". Dữ liệu này cực kỳ quan trọng để người dùng lưu vào cơ sở dữ liệu. Hãy đảm bảo các trường title, ingredients (name, amount, unit, price), instructions, totalCost, và recommendedPrice đều được điền đầy đủ và chính xác.
Mỗi gợi ý có nhãn (label) và hành động (action).

Tất cả câu trả lời phải bằng tiếng Việt.
`;

export const searchGoogleDriveTool = {
  name: "search_google_drive",
  description: "Tìm kiếm các tệp tin liên quan đến công thức nấu ăn trong Google Drive của người dùng.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "Từ khóa tìm kiếm (ví dụ: 'công thức phở', 'recipe pasta')"
      }
    },
    required: ["query"]
  }
};

export const searchGooglePhotosTool = {
  name: "search_google_photos",
  description: "Tìm kiếm hình ảnh món ăn hoặc công thức trong Google Photos của người dùng.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "Từ khóa tìm kiếm hình ảnh (ví dụ: 'steak', 'salad')"
      }
    },
    required: ["query"]
  }
};

export const searchGoogleKeepTool = {
  name: "search_google_keep",
  description: "Tìm kiếm các ghi chú công thức trong Google Keep của người dùng.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "Từ khóa tìm kiếm ghi chú"
      }
    },
    required: ["query"]
  }
};

export async function generateRecipe(theme: string) {
  const response = await ai.models.generateContent({
    model: chefModel,
    contents: `Tạo một công thức nấu ăn chuyên nghiệp cho chủ đề: ${theme}. Bao gồm tiêu đề, nguyên liệu (với chi phí ước tính trên mỗi đơn vị), và hướng dẫn thực hiện. Trả về kết quả bằng tiếng Việt.`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          ingredients: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                amount: { type: Type.STRING },
                unit: { type: Type.STRING },
                price: { type: Type.NUMBER, description: "Chi phí ước tính bằng USD hoặc VND" }
              },
              required: ["name", "amount", "unit", "price"]
            }
          },
          instructions: { type: Type.STRING },
          totalCost: { type: Type.NUMBER },
          recommendedPrice: { type: Type.NUMBER }
        },
        required: ["title", "ingredients", "instructions", "totalCost", "recommendedPrice"]
      }
    }
  });
  return JSON.parse(response.text);
}

export async function analyzeOrderImage(base64Image: string) {
  const response = await ai.models.generateContent({
    model: chefModel,
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: "image/jpeg" } },
        { text: "Phân tích hình ảnh đơn hàng này. Trích xuất các mặt hàng, số lượng và cung cấp bản tóm tắt những gì cần chuẩn bị. Trả về kết quả bằng tiếng Việt." }
      ]
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                quantity: { type: Type.STRING }
              }
            }
          },
          summary: { type: Type.STRING }
        },
        required: ["items", "summary"]
      }
    }
  });
  return JSON.parse(response.text);
}

export interface ChatPart {
  text?: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: ChatPart[];
}

export async function chatWithChef(messages: ChatMessage[], tools?: any[]) {
  const response = await ai.models.generateContent({
    model: chefModel,
    contents: messages.map(m => ({
      role: m.role,
      parts: m.parts.map(p => {
        if (p.inlineData) return { inlineData: p.inlineData };
        return { text: p.text || "" };
      })
    })),
    config: {
      systemInstruction,
      tools: [
        { googleSearch: {} },
        ...(tools ? [{ functionDeclarations: tools }] : [])
      ],
      toolConfig: { includeServerSideToolInvocations: true },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "Nội dung phản hồi chính bằng Markdown" },
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, description: "Nhãn hiển thị cho người dùng" },
                action: { type: Type.STRING, description: "Hành động (ví dụ: generate_recipe, analyze_cost, find_supplier)" }
              },
              required: ["label", "action"]
            }
          },
          recipe: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              ingredients: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    amount: { type: Type.STRING },
                    unit: { type: Type.STRING },
                    price: { type: Type.NUMBER }
                  },
                  required: ["name", "amount", "unit", "price"]
                }
              },
              instructions: { type: Type.STRING },
              totalCost: { type: Type.NUMBER },
              recommendedPrice: { type: Type.NUMBER }
            },
            description: "Dữ liệu công thức có cấu trúc nếu phản hồi chứa công thức"
          }
        },
        required: ["text", "suggestions"]
      }
    }
  });

  if (response.functionCalls) {
    return { functionCalls: response.functionCalls };
  }
  
  try {
    return JSON.parse(response.text);
  } catch (e) {
    return { text: response.text, suggestions: [] };
  }
}
