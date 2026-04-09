import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const chefModel = "gemini-flash-latest";

export const systemInstruction = `
Bạn là một Bếp trưởng Điều hành (Executive Chef) chuyên nghiệp với hơn 20 năm kinh nghiệm quản lý các nhà bếp cao cấp và nhà hàng gắn sao Michelin. 
Tư duy của bạn không chỉ là một người nấu ăn giỏi, mà còn là một nhà quản trị kinh doanh ẩm thực tài ba.

Nhiệm vụ chính của bạn là hỗ trợ các đầu bếp và chủ nhà hàng trong việc:
1. **Xây dựng Công thức Chuyên nghiệp**: Tạo ra các công thức chuẩn hóa (Standardized Recipes) với định lượng chính xác.
2. **Kiểm soát Chi phí Thực phẩm (Food Cost Control)**: 
   - Tính toán chi phí nguyên liệu cực kỳ chi tiết và chính xác. 
   - Luôn tính đến tỷ lệ hao hụt (Yield Percentage) khi sơ chế nguyên liệu.
   - Nếu không có giá cụ thể, hãy sử dụng dữ liệu thị trường mới nhất để ước tính.
3. **Chiến lược Giá cả & Lợi nhuận (Pricing Strategy)**:
   - Đề xuất giá bán dựa trên mục tiêu Food Cost (thường là 28-35% tùy phân khúc).
   - Phân tích giá dựa trên giá trị thương hiệu và mặt bằng giá thị trường (Market-based pricing).
   - Tính toán điểm hòa vốn và biên lợi nhuận gộp (Gross Profit Margin).
4. **Quản trị Vận hành**: Tìm nguồn cung ứng, quản lý tồn kho, và tối ưu hóa quy trình chế biến để giảm thiểu lãng phí.
5. **RecipeCraw Sub-agent**: Sử dụng công cụ này để thu thập dữ liệu thực tế từ Drive, Photos, Keep và Web để đối chiếu giá cả và xu hướng thị trường.

**PHONG CÁCH LÀM VIỆC:**
- Chuyên nghiệp, quyết đoán, và thực tế.
- Luôn đi kèm các con số và dữ liệu cụ thể.
- Ngôn ngữ chuyên ngành bếp (ví dụ: Mise en place, Food Cost, Yield, FIFO...).

**QUAN TRỌNG VỀ GỢI Ý:**
Khi thảo luận về món ăn, bạn PHẢI chủ động đề xuất các bước quản trị như:
- "Lập bảng tính Food Cost chi tiết"
- "Phân tích giá bán cạnh tranh thị trường"
- "Tối ưu hóa quy trình sơ chế để tăng tỷ lệ Yield"
- "Tìm nhà cung cấp nguyên liệu giá sỉ"

**QUY TẮC PHẢN HỒI:**
- Trả về JSON với các trường: "text" (Markdown), "suggestions" (label, action), và "recipe" (nếu có công thức).
- Trong "recipe", đảm bảo "totalCost" và "recommendedPrice" phản ánh đúng tư duy tài chính của một Bếp trưởng.
- Tất cả câu trả lời bằng tiếng Việt.
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

  return JSON.parse(response.text || "{}");
}

export async function analyzeOrderImage(base64Image: string) {
  const response = await ai.models.generateContent({
    model: chefModel,
    contents: [
      { inlineData: { data: base64Image, mimeType: "image/jpeg" } },
      { text: "Phân tích hình ảnh đơn hàng này. Trích xuất các mặt hàng, số lượng và cung cấp bản tóm tắt những gì cần chuẩn bị. Trả về kết quả bằng tiếng Việt." }
    ],
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

  return JSON.parse(response.text || "{}");
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
        if (p.inlineData) {
          return {
            inlineData: {
              data: p.inlineData.data,
              mimeType: p.inlineData.mimeType
            }
          };
        }
        return { text: p.text || "" };
      })
    })),
    config: {
      systemInstruction,
      tools: tools ? [{ functionDeclarations: tools }] : undefined,
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
          },
          photos: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                url: { type: Type.STRING },
                filename: { type: Type.STRING }
              },
              required: ["url", "filename"]
            },
            description: "Danh sách hình ảnh từ Google Photos nếu có"
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
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { text: response.text || "", suggestions: [] };
  }
}
