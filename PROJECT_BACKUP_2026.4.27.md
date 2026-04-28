# PROJECT BACKUP CHECKPOINT - 2026.04.27

## 🚀 TRẠNG THÁI HIỆN TẠI
Ứng dụng **SousChef AI** đã hoàn thiện các tính năng cốt lõi về quản lý nhà hàng thông minh, tích hợp AI đa phương thức (Multi-modal).

## 🛠 TECH STACK CỐT LÕI
- **Frontend**: React 18, Vite, Tailwind CSS (v4), Framer Motion.
- **Backend Proxy**: Express server tích hợp trong Vite để xử lý API call (tránh CORS) và quản lý API Key an toàn.
- **AI Engine**: Hệ thống Custom `chatWithAI` hỗ trợ nhiều Provider: Google (Gemini), Groq (Llama), Nvidia (Kimi, Nemotron), OpenRouter, Anthropic (Claude-3.5), Cerebras, SambaNova.

## 🧠 LOGIC AI QUAN TRỌNG (CẦN NHỚ KHI RESTORE)
1. **Model Mapping (`src/server/services/aiProvider.ts`)**:
   - Hệ thống tự động map các model ID "hallucinated" (ví dụ gemini-2.5) về bản ổn định (gemini-2.0).
   - Ưu tiên sử dụng `GEMINI_API_KEY` từ môi trường hệ thống.
2. **Vision Detection & Filtering (`src/lib/ai.ts`)**:
   - Các model được gắn tag: `vision`, `reasoning`, `light`, `coding`.
   - Hệ thống tự động lọc danh sách model theo chức năng:
     - **Menu/Hóa đơn**: Chỉ hiện các model hỗ trợ `vision`.
     - **Chef Chat/Creative**: Hiện các model `reasoning`.
     - **Dashboard**: Hiện các model `light`.
   - Logic `chatWithAIWithFallback` tự động phát hiện `requiresVision` từ nội dung tin nhắn để chuyển sang model fallback hỗ trợ hình ảnh nếu model chính không hỗ trợ.

## 📂 CẤU TRÚC SUB-AGENTS
- **Creative Agent**: Lập kế hoạch menu, tạo công thức món ăn mới.
- **Analysis Agent**: Phân tích tồn kho, dự báo lợi nhuận.
- **Menu Digitizer**: Nhận diện hình ảnh thực đơn giấy bằng AI Vision.

## 🐞 CÁC LỖI QUAN TRỌNG ĐÃ FIX
- **Key Collision**: Fix lỗi duplicate key React khi hiển thị danh sách model.
- **CORS/Proxy**: Đảm bảo tất cả request AI đều đi qua server-side endpoint `/api/chat`.
- **Nvidia/Kimi Mapping**: Khắc phục lỗi Kimi k2.5 bị map sai sang Llama trên Nvidia NIM.

## 🔑 BIẾN MÔI TRƯỜNG CẦN THIẾT
- `GEMINI_API_KEY`: Key mặc định cho Google.
- `GROQ_API_KEY`: Cho Llama 3.1/3.3.
- `NVIDIA_API_KEY`: Cho Kimi và Nemotron.
- `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`.

---
*Lưu ý cho AI Agent kế tiếp: Đọc file `src/lib/ai.ts` để hiểu logic fallback đa tầng trước khi sửa bất kỳ phần nào liên quan đến AI.*
