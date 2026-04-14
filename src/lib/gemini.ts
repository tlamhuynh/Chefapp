import { tool } from 'ai';
import { z } from 'zod';
import { chatWithAI } from './ai';

export const chefModel = "gemini-2.0-flash";

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
  description: "Tự động lấy công thức nấu ăn từ một URL cụ thể.",
  parameters: z.object({
    url: z.string().describe("URL của trang web chứa công thức nấu ăn.")
  })
};

export const searchGoogleDriveTool = {
  description: "Tìm kiếm các tệp tin liên quan đến công thức nấu ăn trong Google Drive của người dùng.",
  parameters: z.object({
    query: z.string().describe("Từ khóa tìm kiếm (ví dụ: 'công thức phở', 'recipe pasta')")
  })
};

export const searchGooglePhotosTool = {
  description: "Tìm kiếm hình ảnh món ăn hoặc công thức trong Google Photos của người dùng.",
  parameters: z.object({
    query: z.string().describe("Từ khóa tìm kiếm hình ảnh (ví dụ: 'steak', 'salad')")
  })
};

export const searchGoogleKeepTool = {
  description: "Tìm kiếm các ghi chú công thức trong Google Keep của người dùng.",
  parameters: z.object({
    query: z.string().describe("Từ khóa tìm kiếm ghi chú")
  })
};

export async function chatWithChef(messages: ChatMessage[], tools?: any, customKey?: string, modelId: string = chefModel) {
  const config = customKey ? { googleKey: customKey } : {};
  return await chatWithAI(
    modelId,
    messages,
    systemInstruction,
    tools,
    config,
    recipeResponseSchema
  );
}

export const recipeResponseSchema = z.object({
  text: z.string().describe("Nội dung phản hồi chính bằng Markdown"),
  suggestions: z.array(z.object({
    label: z.string(),
    action: z.string()
  })),
  recipe: z.optional(z.object({
    title: z.string(),
    ingredients: z.array(z.object({
      name: z.string(),
      amount: z.string(),
      unit: z.string(),
      purchasePrice: z.number(),
      costPerAmount: z.number()
    })),
    instructions: z.string(),
    totalCost: z.number(),
    recommendedPrice: z.number(),
    image: z.optional(z.string())
  })),
  photos: z.optional(z.array(z.object({
    url: z.string(),
    filename: z.string()
  })))
});

export async function generateRecipe(theme: string, config?: any, modelId: string = chefModel) {
  return await chatWithAI(
    modelId,
    [{ role: 'user', parts: [{ text: `Tạo một công thức nấu ăn chuyên nghiệp cho chủ đề: ${theme}. Bao gồm tiêu đề, nguyên liệu (với chi phí ước tính trên mỗi đơn vị), và hướng dẫn thực hiện. Trả về kết quả bằng tiếng Việt.` }] }],
    systemInstruction,
    undefined,
    config,
    recipeResponseSchema
  );
}

export async function analyzeOrderImage(base64Image: string, config?: any, modelId: string = chefModel) {
  return await chatWithAI(
    modelId,
    [
      { 
        role: 'user', 
        parts: [
          { inlineData: { data: base64Image, mimeType: "image/jpeg" } },
          { text: "Phân tích hình ảnh đơn hàng này. Trích xuất các mặt hàng, số lượng và cung cấp bản tóm tắt những gì cần chuẩn bị. Trả về kết quả bằng tiếng Việt." }
        ] 
      }
    ],
    systemInstruction,
    undefined,
    config,
    z.object({
      items: z.array(z.object({ name: z.string(), quantity: z.string() })),
      summary: z.string()
    })
  );
}

export async function analyzeMenuImage(base64Image: string, config?: any, modelId: string = chefModel) {
  return await chatWithAI(
    modelId,
    [
      { 
        role: 'user', 
        parts: [
          { inlineData: { data: base64Image, mimeType: "image/jpeg" } },
          { text: "Hãy phân tích hình ảnh thực đơn (menu) này. Trích xuất danh sách các món ăn, mô tả (nếu có) và giá bán. Nếu thông tin nào không rõ ràng hoặc thiếu (ví dụ: định lượng, nguyên liệu chính), hãy tạo danh sách các câu hỏi để hỏi lại người dùng. Trả về kết quả bằng tiếng Việt dưới dạng JSON." }
        ] 
      }
    ],
    systemInstruction,
    undefined,
    config,
    z.object({
      dishes: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
        price: z.number(),
        potentialIngredients: z.array(z.string()).optional()
      })),
      clarifyingQuestions: z.array(z.string()),
      summary: z.string()
    })
  );
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

export async function chatWithCreativeAgent(messages: ChatMessage[], config?: any, modelId: string = chefModel) {
  return await chatWithAI(
    modelId,
    messages,
    creativeAgentInstruction,
    undefined,
    config,
    z.object({
      text: z.string(),
      suggestions: z.array(z.object({ label: z.string(), action: z.string() }))
    })
  );
}
