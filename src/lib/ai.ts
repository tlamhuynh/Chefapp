// Types
export type AIProvider = 'google' | 'openai' | 'anthropic';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
}

export const AVAILABLE_MODELS: AIModel[] = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'google', description: 'Nhanh, hiệu quả cho các tác vụ hàng ngày.' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'google', description: 'Mạnh mẽ, thông minh vượt trội cho các bài toán phức tạp.' },
  { id: 'gemma-4-it', name: 'Gemma 4', provider: 'google', description: 'Model mã nguồn mở mới nhất từ Google, tối ưu cho hội thoại.' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Model hàng đầu từ OpenAI, đa năng và chính xác.' },
  { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: 'Model thông minh nhất từ Anthropic, viết lách và tư duy tốt.' },
];

export async function chatWithAI(
  modelId: string,
  messages: any[],
  systemInstruction: string,
  tools?: any[]
) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      modelId,
      messages,
      systemInstruction,
      tools
    })
  });

  if (!response.ok) {
    let errorMsg = 'Failed to fetch from API';
    try {
      const errData = await response.json();
      if (errData.error) errorMsg = errData.error;
    } catch(e) {}
    throw new Error(errorMsg);
  }

  return response.json();
}
