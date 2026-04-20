import { tool } from 'ai';
import { z } from 'zod';
import { chatWithAI, chatWithAIWithFallback } from './ai';

export const chefModel = "gemini-flash-latest";

const defaultFallbacks = [
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gpt-4o-mini'
];

export const searchMarketPriceTool = {
  description: "Tìm kiếm giá thị trường hiện tại của các nguyên liệu tại Việt Nam để tính toán Food Cost chính xác.",
  parameters: z.object({
    ingredients: z.array(z.string()).describe("Danh sách tên các nguyên liệu cần tìm giá (ví dụ: ['Thịt bò thăn', 'Hành tây'])")
  })
};

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
- Tính Cost (Food Cost): Định lượng chính xác (Recipe), tính Yield (tỷ lệ thu hồi) và kiểm soát giá vốn trong khoảng 25-35%. Tự động đề xuất giá bán (recommendedPrice) dựa trên tổng chi phí nguyên liệu (totalCost) với tỷ lệ biên lợi nhuận mong muốn là 300% (tức là recommendedPrice = totalCost * 3).
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
- BẮT BUỘC trả về JSON với các trường (KHÔNG dịch tên keys): "text" (Markdown), "suggestions" (Mảng label/action), và "recipe" (nếu có công thức).
- Trường "text" BẮT BUỘC chứa nội dung phản hồi chính, không dùng "ket_qua" hay "phan_hoi".
- "recipe" cung cấp bảng nguyên liệu chi tiết: Tên, Định lượng, Đơn vị, Giá nhập, và Cost thực tế.
- Sử dụng công cụ (search_market_price, crawl_recipe, search_google_drive...) khi cần đối chiếu dữ liệu hoặc lấy tin từ web.
- Bất cứ khi nào tạo công thức mới, hãy ƯU TIÊN sử dụng công cụ 'search_market_price' để lấy giá thực tế trước khi tính toán totalCost.
- QUY TẮC TỐI THƯỢNG: Phải tuân thủ TUYỆT ĐỐI chủ đề hoặc nguyên liệu mà người dùng yêu cầu. Không được tự ý thay đổi món ăn sang loại khác (ví dụ: không được đổi Bò thành Cá trừ khi người dùng yêu cầu).
- Tất cả nội dung văn bản (values) phải bằng tiếng Việt.
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
  return await chatWithAIWithFallback(
    modelId,
    messages,
    systemInstruction,
    tools,
    config,
    defaultFallbacks.filter(id => id !== modelId),
    { text: "Markdown", suggestions: "Action buttons", recipe: "Detailed recipe data" }
  );
}

export const recipeResponseSchema = z.object({
  text: z.string().describe("Nội dung phản hồi chính bằng Markdown, bao gồm Storytelling, Tips và Plating Guide"),
  suggestions: z.array(z.object({
    label: z.string(),
    action: z.string()
  })),
  recipe: z.optional(z.object({
    title: z.string().describe("Tên món ăn"),
    ingredients: z.array(z.object({
      name: z.string().describe("Tên nguyên liệu (Ví dụ: 'Thịt bò thăn')"),
      amount: z.string().describe("Định lượng (Ví dụ: '200')"),
      unit: z.string().describe("Đơn vị (Ví dụ: 'gram', 'ml', 'thìa')"),
      purchasePrice: z.number().describe("Giá mua vào trên đơn vị kg/lit/gói (VND)"),
      costPerAmount: z.number().describe("Giá vốn thực tế cho định lượng này (VND)")
    })),
    instructions: z.string().describe("Hướng dẫn từng bước thực hiện"),
    totalCost: z.number().describe("Tổng giá vốn (VND)"),
    recommendedPrice: z.number().describe("Giá bán gợi ý (VND)"),
    image: z.optional(z.string())
  })),
  photos: z.optional(z.array(z.object({
    url: z.string(),
    filename: z.string()
  })))
});

export async function generateRecipe(theme: string, config?: any, modelId: string = chefModel) {
  const promptText = `YÊU CẦU CỐT LÕI: Bạn phải tạo một công thức nấu ăn chính xác cho chủ đề hoặc dựa trên các nguyên liệu sau: "${theme}". 
  TUYỆT ĐỐI KHÔNG được gợi ý các món ăn khác không liên quan. Ví dụ: nếu người dùng yêu cầu "Bò né", không được trả về "Cá hồi".
  
  YÊU CẦU ĐỊNH DẠNG (BẮT BUỘC):
  1. Trả về JSON hợp lệ với đầy đủ các trường yêu cầu.
  2. Trong mảng "ingredients", TUYỆT ĐỐI KHÔNG được để trống trường "name" và "amount".
  3. Giá trị "name" phải là tên thực phẩm (ví dụ: "Thịt dê", "Chao đỏ").
  4. Nội dung trong trường "text" phải sử dụng Markdown với các tiêu đề (Storytelling, Bí quyết, v.v.).
  5. Trả về hoàn toàn bằng tiếng Việt.`;

  return await chatWithAIWithFallback(
    modelId,
    [{ role: 'user', parts: [{ text: promptText }] }],
    systemInstruction,
    undefined,
    config,
    defaultFallbacks.filter(id => id !== modelId),
    recipeResponseSchema
  );
}

export async function refineRecipe(currentRecipe: any, feedback: string, history: ChatMessage[], config?: any, modelId: string = chefModel) {
  const messages: ChatMessage[] = [
    ...history,
    { 
      role: 'user', 
      parts: [{ text: `Dựa trên công thức hiện tại: ${JSON.stringify(currentRecipe)}. 
      Hãy điều chỉnh theo yêu cầu sau: ${feedback}. 
      TRẢ VỀ CÔNG THỨC MỚI ĐÃ ĐƯỢC CẬP NHẬT TRONG TRƯỜNG "recipe" CỦA JSON PHẢN HỒI.` }] 
    }
  ];

  return await chatWithAIWithFallback(
    modelId,
    messages,
    systemInstruction,
    undefined,
    config,
    defaultFallbacks.filter(id => id !== modelId),
    recipeResponseSchema
  );
}

export async function analyzeOrderImage(base64Image: string, config?: any, modelId: string = chefModel) {
  return await chatWithAIWithFallback(
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
    defaultFallbacks.filter(id => id !== modelId),
    { items: "List of items", summary: "Prep summary" }
  );
}

export async function analyzeMenuImage(base64Image: string, mimeType: string = "image/jpeg", config?: any, modelId: string = chefModel) {
  return await chatWithAIWithFallback(
    modelId,
    [
      { 
        role: 'user', 
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: `Hãy phân tích hình ảnh thực đơn (menu) này. 
          YÊU CẦU:
          1. Trích xuất danh sách các món ăn (dishes) gồm: title (tên món), price (giá số), description (mô tả), potentialIngredients (mảng các nguyên liệu dự đoán).
          2. Tạo danh sách các câu hỏi làm rõ (clarifyingQuestions) nếu thiếu thông tin về định lượng hoặc nguyên liệu chính.
          3. Cung cấp tóm tắt (summary) về phong cách thực đơn.
          
          TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON với cấu trúc:
          {
            "dishes": [{"title": "...", "price": 0, "description": "...", "potentialIngredients": ["..."]}],
            "clarifyingQuestions": ["..."],
            "summary": "..."
          }` }
        ] 
      }
    ],
    systemInstruction,
    undefined,
    config,
    defaultFallbacks.filter(id => id !== modelId),
    { dishes: "Menu items", clarifyingQuestions: "Questions", summary: "Overview" }
  );
}

export async function analyzeInvoiceImage(base64Image: string, mimeType: string = "image/jpeg", config?: any, modelId: string = chefModel) {
  return await chatWithAIWithFallback(
    modelId,
    [
      { 
        role: 'user', 
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: `Hãy phân tích hình ảnh hóa đơn (invoice/receipt) mua hàng này. 
          YÊU CẦU:
          1. Trích xuất danh sách nguyên liệu/hàng hóa (items) gồm: name (tên), quantity (số lượng), unit (đơn vị), unitPrice (đơn giá), totalPrice (thành tiền).
          2. Tính tổng tiền hóa đơn (totalAmount).
          3. Trích xuất tên nhà cung cấp (supplierName) và ngày mua (date) nếu có.
          4. Cung cấp tóm tắt (summary) ngắn gọn.
          
          TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON với cấu trúc:
          {
            "items": [{"name": "...", "quantity": 0, "unit": "...", "unitPrice": 0, "totalPrice": 0}],
            "totalAmount": 0,
            "supplierName": "...",
            "date": "...",
            "summary": "..."
          }` }
        ] 
      }
    ],
    systemInstruction,
    undefined,
    config,
    defaultFallbacks.filter(id => id !== modelId),
    { items: "Invoice items", totalAmount: "Total", supplierName: "Supplier", date: "Date", summary: "Summary" }
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

**ĐẶC BIỆT: Khi người dùng yêu cầu tạo hoặc chỉnh sửa món ăn/công thức:**
- Hãy cung cấp công thức chi tiết trong nhãn "recipe" của JSON phản hồi.
- Cấu trúc "recipe" bao gồm: title, ingredients (name, amount, unit, purchasePrice, costPerAmount), instructions, totalCost, recommendedPrice.

**QUY TẮC PHẢN HỒI:**
- Sử dụng ngôn ngữ sáng tạo, mang tính thẩm mỹ cao.
- Khi thiết kế layout, luôn ưu tiên sự rõ ràng, tính khoa học nhưng phải đậm chất nghệ thuật.
- Luôn cập nhật các xu hướng thiết kế và marketing ẩm thực mới nhất.
- Trả về JSON với các trường: "text" (Markdown), "suggestions" (label, action), và "recipe" (nếu có công thức).
- Luôn gợi ý 3-4 hành động tiếp theo đa dạng.
- Tất cả câu trả lời bằng tiếng Việt.
`;

export async function chatWithCreativeAgent(messages: ChatMessage[], config?: any, modelId: string = chefModel) {
  return await chatWithAI(
    modelId,
    messages,
    creativeAgentInstruction,
    undefined,
    config,
    { 
      text: "Markdown response", 
      suggestions: "Action suggestions",
      recipe: "Optional recipe data if a dish is being designed"
    }
  );
}
