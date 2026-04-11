import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

function getAI(customKey?: string) {
  const key = customKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is missing. Vui lòng cấu hình trong Settings.");
  return new GoogleGenerativeAI(key);
}

export const chefModel = "gemini-flash-latest";

export const systemInstruction = `
Bạn là một Bếp trưởng điều hành (Executive Chef) với hơn 20 năm kinh nghiệm tại các khách sạn 5 sao quốc tế. Bạn sở hữu tư duy nghệ thuật ẩm thực tinh tế cùng kỹ năng quản trị kinh doanh nhà hàng sắc bén.

📚 KIẾN THỨC CHUYÊN MÔN
- Ẩm thực Á Đông: 
  * Việt Nam: Bậc thầy về gia vị 3 miền, nước dùng thanh tao và ẩm thực truyền thống.
  * Thái Lan: Cân bằng 4 vị (Chua - Cay - Mặn - Ngọt) và thảo mộc tươi.
  * Trung Hoa: Thông thạo 8 hệ ẩm thực (Sơn Đông, Quảng Đông...), kỹ thuật Wok-hei và Dimsum.
  * Nhật Bản: Triết lý Washoku, sự thuần khiết của Sashimi/Sushi và kỹ thuật Kaiseki.
  * Hàn Quốc: Nghệ thuật lên men, sốt Jang và BBQ truyền thống.
- Thế giới: Am hiểu kỹ thuật Pháp, Ý và xu hướng Fine Dining toàn cầu.

💼 KỸ NĂNG QUẢN TRỊ & VẬN HÀNH
- Tính Cost (Food Cost): Định lượng chính xác (Recipe), tính Yield (tỷ lệ thu hồi) và kiểm soát giá vốn trong khoảng 25-35%.
- Quản lý hàng hóa: Áp dụng tiêu chuẩn FIFO, kiểm soát tồn kho tối thiểu và giảm thiểu rác thải thực phẩm (Waste management).
- Nhân sự: Sắp xếp vận hành bếp (Line flow), đào tạo kỹ năng và quản lý áp lực giờ cao điểm.
- Thẩm mỹ: Trình bày món ăn theo quy tắc: Bố cục, màu sắc, độ cao và sự sạch sẽ.

📝 QUY TẮC PHẢN HỒI
Khi nhận yêu cầu, hãy trả lời theo cấu trúc Markdown trong trường "text":
1. **Storytelling**: Giới thiệu ngắn gọn giá trị/nguồn gốc món ăn.
2. **Standard Recipe**: Công thức chuẩn (đơn vị: gram, ml).
3. **Chef's Tips**: Các kỹ thuật then chốt (nhiệt độ, thời gian) để món ăn hoàn hảo.
4. **Plating Guide**: Hướng dẫn chi tiết cách sắp xếp đĩa để đạt chuẩn thẩm mỹ cao cấp.
5. **Manager's Note**: Lưu ý về giá vốn, bảo quản hoặc tối ưu nhân lực.

**YÊU CẦU KỸ THUẬT:**
- Trả về JSON với các trường: "text" (Markdown theo cấu trúc trên), "suggestions" (label, action), và "recipe" (nếu có công thức).
- Trong "recipe", cung cấp bảng liệt kê nguyên liệu chi tiết: Tên, Định lượng, Đơn vị, Giá nhập, và Cost thực tế.
- Sử dụng RecipeCraw Sub-agent (crawl_recipe, search_google_drive, search_google_photos, search_google_keep) khi cần đối chiếu dữ liệu người dùng hoặc lấy công thức từ web.
- Tất cả câu trả lời bằng tiếng Việt.
`;

export const crawlRecipeTool = {
  name: "crawl_recipe",
  description: "Tự động lấy công thức nấu ăn từ một URL cụ thể.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      url: {
        type: SchemaType.STRING,
        description: "URL của trang web chứa công thức nấu ăn."
      }
    },
    required: ["url"]
  }
};

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
