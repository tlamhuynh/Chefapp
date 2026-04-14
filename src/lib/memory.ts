import { db, collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, orderBy, limit } from './firebase';
import { chatWithAI } from './ai';
import { z } from 'zod';

export interface Memory {
  id?: string;
  userId: string;
  key: string;
  value: string;
  importance: number;
  updatedAt: any;
}

export async function getMemories(userId: string): Promise<Memory[]> {
  try {
    const q = query(
      collection(db, 'memories'),
      where('userId', '==', userId),
      orderBy('importance', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memory));
  } catch (error) {
    console.error("Error fetching memories:", error);
    return [];
  }
}

export async function saveMemory(userId: string, key: string, value: string, importance: number = 5) {
  try {
    const q = query(
      collection(db, 'memories'),
      where('userId', '==', userId),
      where('key', '==', key)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const memoryDoc = snapshot.docs[0];
      await updateDoc(doc(db, 'memories', memoryDoc.id), {
        value,
        importance,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, 'memories'), {
        userId,
        key,
        value,
        importance,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Error saving memory:", error);
  }
}

export async function extractMemoriesFromChat(userId: string, messages: any[], modelId: string = 'gemini-2.0-flash', config?: any) {
  const systemInstruction = `Bạn là một hệ thống phân tích trí nhớ (Memory Extraction System).
Nhiệm vụ của bạn là phân tích cuộc hội thoại giữa đầu bếp và AI để trích xuất các thông tin quan trọng về sở thích, phong cách, hạn chế hoặc mục tiêu của người dùng.

Hãy trả về một danh sách các "memory" dưới dạng JSON.
Mỗi memory gồm:
- key: Tên ngắn gọn của thông tin (ví dụ: 'dietary_restrictions', 'preferred_cuisine', 'cost_focus')
- value: Nội dung chi tiết thông tin trích xuất được.
- importance: Độ quan trọng từ 1-10.

Chỉ trích xuất những thông tin THỰC SỰ mới hoặc thay đổi. Nếu không có gì mới, trả về mảng trống.`;

  try {
    const result = await chatWithAI(
      modelId,
      [{ role: 'user', parts: [{ text: JSON.stringify(messages.slice(-10)) }] }],
      systemInstruction,
      undefined,
      config,
      z.object({
        memories: z.array(z.object({
          key: z.string(),
          value: z.string(),
          importance: z.number()
        }))
      })
    );

    if (result && result.memories) {
      for (const mem of result.memories) {
        await saveMemory(userId, mem.key, mem.value, mem.importance);
      }
    }
  } catch (error) {
    console.error("Error extracting memories:", error);
  }
}

export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (memories.length === 0) return "";
  
  const memoryText = memories
    .map(m => `- ${m.key}: ${m.value}`)
    .join('\n');
    
  return `\n\nTHÔNG TIN VỀ NGƯỜI DÙNG (BẠN ĐÃ HỌC ĐƯỢC):
${memoryText}\nHãy sử dụng những thông tin này để cá nhân hóa câu trả lời và đưa ra lời khuyên thông minh hơn.`;
}
