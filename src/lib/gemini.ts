import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

function getAI(customKey?: string) {
  const key = customKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is missing. Vui lòng cấu hình trong Settings.");
  return new GoogleGenerativeAI(key);
}

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
6. **Data Knowledge & Backup**: 
   - Hỗ trợ người dùng kết nối dữ liệu với NotebookLM bằng cách xuất file JSON/Markdown chất lượng cao.
   - Tự động hóa việc sao lưu dữ liệu lên Google Drive để tránh mất mát dữ liệu local.

**PHONG CÁCH LÀM VIỆC:**
- Chuyên nghiệp, quyết đoán, và thực tế.
- Luôn đi kèm các con số và dữ liệu cụ thể.
- Ngôn ngữ chuyên ngành bếp (ví dụ: Mise en place, Food Cost, Yield, FIFO...).

**QUY TẮC PHẢN HỒI CÔNG THỨC:**
- Khi trả về công thức, bạn PHẢI cung cấp bảng liệt kê nguyên liệu chi tiết gồm: Tên nguyên liệu, Định lượng, Đơn vị, Giá nhập (trên đơn vị chuẩn như kg, lít), và Cost thực tế (dựa trên định lượng sử dụng).
- Trả về JSON với các trường: "text" (Markdown), "suggestions" (label, action), và "recipe" (nếu có công thức).
- Trong "recipe", đảm bảo "totalCost" và "recommendedPrice" phản ánh đúng tư duy tài chính của một Bếp trưởng.
- Nếu bạn đề xuất một món ăn, hãy cố gắng cung cấp một URL hình ảnh minh họa chất lượng cao trong trường "image" của đối tượng "recipe". Bạn có thể sử dụng các URL hình ảnh từ Unsplash hoặc các nguồn hình ảnh thực phẩm uy tín khác (ví dụ: https://images.unsplash.com/photo-...).
- Tất cả câu trả lời bằng tiếng Việt.
`;

export const searchGoogleDriveTool = {
  name: "search_google_drive",
  description: "Tìm kiếm các tệp tin liên quan đến công thức nấu ăn trong Google Drive của người dùng.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
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
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
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
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
        description: "Từ khóa tìm kiếm ghi chú"
      }
    },
    required: ["query"]
  }
};

export async function generateRecipe(theme: string, customKey?: string) {
  const genAI = getAI(customKey);
  const model = genAI.getGenerativeModel({
    model: chefModel,
    systemInstruction: systemInstruction,
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: `Tạo một công thức nấu ăn chuyên nghiệp cho chủ đề: ${theme}. Bao gồm tiêu đề, nguyên liệu (với chi phí ước tính trên mỗi đơn vị), và hướng dẫn thực hiện. Trả về kết quả bằng tiếng Việt.` }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          ingredients: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                amount: { type: SchemaType.STRING },
                unit: { type: SchemaType.STRING },
                purchasePrice: { type: SchemaType.NUMBER, description: "Giá nhập trên một đơn vị chuẩn (ví dụ: giá/kg, giá/lít)" },
                costPerAmount: { type: SchemaType.NUMBER, description: "Chi phí thực tế cho định lượng sử dụng trong món ăn" }
              },
              required: ["name", "amount", "unit", "purchasePrice", "costPerAmount"]
            }
          },
          instructions: { type: SchemaType.STRING },
          totalCost: { type: SchemaType.NUMBER },
          recommendedPrice: { type: SchemaType.NUMBER }
        },
        required: ["title", "ingredients", "instructions", "totalCost", "recommendedPrice"]
      }
    }
  });

  return JSON.parse(result.response.text() || "{}");
}

export async function analyzeOrderImage(base64Image: string, customKey?: string) {
  const genAI = getAI(customKey);
  const model = genAI.getGenerativeModel({
    model: chefModel,
    systemInstruction: systemInstruction,
  });

  const result = await model.generateContent({
    contents: [
      { 
        role: 'user', 
        parts: [
          { inlineData: { data: base64Image, mimeType: "image/jpeg" } },
          { text: "Phân tích hình ảnh đơn hàng này. Trích xuất các mặt hàng, số lượng và cung cấp bản tóm tắt những gì cần chuẩn bị. Trả về kết quả bằng tiếng Việt." }
        ] 
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          items: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                quantity: { type: SchemaType.STRING }
              }
            }
          },
          summary: { type: SchemaType.STRING }
        },
        required: ["items", "summary"]
      }
    }
  });

  return JSON.parse(result.response.text() || "{}");
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

export async function chatWithChef(messages: ChatMessage[], tools?: any[], customKey?: string) {
  const genAI = getAI(customKey);
  const model = genAI.getGenerativeModel({
    model: chefModel,
    systemInstruction: systemInstruction,
  });

  // Ensure the first message is from user and roles alternate
  let contents = messages.map(m => ({
    role: m.role,
    parts: m.parts.map(p => {
      if (p.inlineData) {
        return {
          inlineData: {
            data: p.inlineData.data,
            mimeType: p.inlineData.mimeType
          }
        } as any;
      }
      return { text: p.text || "" } as any;
    })
  }));

  const firstUserIndex = contents.findIndex(c => c.role === 'user');
  if (firstUserIndex > 0) {
    contents = contents.slice(firstUserIndex);
  } else if (firstUserIndex === -1) {
    return { text: "Vui lòng nhập tin nhắn của bạn.", suggestions: [] };
  }

  const result = await model.generateContent({
    contents: contents as any,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          text: { type: SchemaType.STRING, description: "Nội dung phản hồi chính bằng Markdown" },
          suggestions: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                label: { type: SchemaType.STRING, description: "Nhãn hiển thị cho người dùng" },
                action: { type: SchemaType.STRING, description: "Hành động (ví dụ: generate_recipe, analyze_cost, find_supplier)" }
              },
              required: ["label", "action"]
            }
          },
          recipe: {
            type: SchemaType.OBJECT,
            properties: {
              title: { type: SchemaType.STRING },
              ingredients: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    name: { type: SchemaType.STRING },
                    amount: { type: SchemaType.STRING },
                    unit: { type: SchemaType.STRING },
                    purchasePrice: { type: SchemaType.NUMBER },
                    costPerAmount: { type: SchemaType.NUMBER }
                  },
                  required: ["name", "amount", "unit", "purchasePrice", "costPerAmount"]
                }
              },
              instructions: { type: SchemaType.STRING },
              totalCost: { type: SchemaType.NUMBER },
              recommendedPrice: { type: SchemaType.NUMBER },
              image: { type: SchemaType.STRING, description: "URL hình ảnh món ăn minh họa (nếu có)" }
            },
            description: "Dữ liệu công thức có cấu trúc nếu phản hồi chứa công thức"
          },
          photos: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                url: { type: SchemaType.STRING },
                filename: { type: SchemaType.STRING }
              },
              required: ["url", "filename"]
            },
            description: "Danh sách hình ảnh từ Google Photos nếu có"
          }
        },
        required: ["text", "suggestions"]
      }
    } as any,
    tools: tools ? [{ functionDeclarations: tools }] : undefined,
  } as any);

  const response = result.response;
  if (response.functionCalls()) {
    return { functionCalls: response.functionCalls() };
  }
  
  try {
    const text = response.text();
    return JSON.parse(text || "{}");
  } catch (e) {
    const text = response.text();
    return { text: text || "", suggestions: [] };
  }
}

export const creativeAgentInstruction = `
Bạn là một Chuyên gia Sáng tạo đa năng trong lĩnh vực F&B, kết hợp kỹ năng của một Graphic Designer chuyên về Izakaya, một Food Stylist am hiểu văn hóa Nhật Bản và một Content Creator chuyên nghiệp cho Social Media.

Nhiệm vụ của bạn là hỗ trợ người dùng trong các mảng sau:
1. **Cải thiện & Thiết kế Menu**:
   - Phân tích cấu trúc món ăn để tối ưu hóa lợi nhuận (Menu Engineering).
   - Tư vấn bố cục (Layout) theo phong cách Izakaya hiện đại, tối giản hoặc truyền thống.
   - Sử dụng thuật ngữ chuyên môn ẩm thực Nhật Bản (Sashimi, Yakimono, Tempura...) một cách chính xác và hấp dẫn.
2. **Food Stylist & Hình ảnh**:
   - Gợi ý cách trình bày món ăn (Plating) trên đĩa: sử dụng lá tía tô, củ cải bào, hay các loại chén dĩa gốm sứ phù hợp.
   - Mô tả chi tiết góc chụp, ánh sáng (Lighting) và màu sắc để tạo ra những tấm ảnh món ăn "thèm nhỏ dãi" cho menu và mạng xã hội.
3. **Lên ý tưởng & Content Social Media**:
   - Lên lịch nội dung hàng tuần (Content Calendar) cho Facebook/Instagram/TikTok.
   - Viết bài caption (kể chuyện về món ăn, văn hóa nhắm rượu, không khí quán) với phong cách cuốn hút, gần gũi nhưng vẫn chuyên nghiệp.
   - Gợi ý ý tưởng video ngắn (Reels/TikTok) về quy trình chế biến món ăn hoặc không gian quán.

**QUY TẮC PHẢN HỒI:**
- Sử dụng ngôn ngữ sáng tạo, mang tính thẩm mỹ cao.
- Khi thiết kế layout, luôn ưu tiên sự rõ ràng, tính khoa học nhưng phải đậm chất nghệ thuật.
- Luôn cập nhật các xu hướng thiết kế và marketing ẩm thực mới nhất.
- Trả về JSON với các trường: "text" (Markdown), "suggestions" (label, action).
- Luôn gợi ý 3-4 hành động tiếp theo đa dạng (ví dụ: "Xem ví dụ plating", "Lên lịch post tuần tới", "Tính cost món này").
- Tất cả câu trả lời bằng tiếng Việt.
`;

export async function chatWithCreativeAgent(messages: ChatMessage[], customKey?: string) {
  const genAI = getAI(customKey);
  const model = genAI.getGenerativeModel({
    model: chefModel,
    systemInstruction: creativeAgentInstruction,
  });

  // Ensure the first message is from user and roles alternate
  let contents = messages.map(m => ({
    role: m.role,
    parts: m.parts.map(p => ({ text: p.text || "" }))
  }));

  const firstUserIndex = contents.findIndex(c => c.role === 'user');
  if (firstUserIndex > 0) {
    contents = contents.slice(firstUserIndex);
  } else if (firstUserIndex === -1) {
    return { text: "Vui lòng nhập tin nhắn của bạn.", suggestions: [] };
  }

  const result = await model.generateContent({
    contents: contents as any,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          text: { type: SchemaType.STRING },
          suggestions: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                label: { type: SchemaType.STRING },
                action: { type: SchemaType.STRING }
              },
              required: ["label", "action"]
            }
          }
        },
        required: ["text", "suggestions"]
      }
    }
  });

  return JSON.parse(result.response.text() || "{}");
}
