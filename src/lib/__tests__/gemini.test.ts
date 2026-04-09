import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleGenAI } from '@google/genai';
import { generateRecipe } from '../gemini';

vi.mock('@google/genai', () => {
  const mockGenerateContent = vi.fn();
  return {
    GoogleGenAI: class {
      models = {
        generateContent: mockGenerateContent,
      };
    },
    Type: {
      STRING: 'STRING',
      OBJECT: 'OBJECT',
      ARRAY: 'ARRAY',
      NUMBER: 'NUMBER',
    },
  };
});

describe('gemini.ts - generateRecipe', () => {
  let mockGenerateContent: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Retrieve the mock function from the mocked class instance
    const aiInstance = new GoogleGenAI({ apiKey: 'test' });
    mockGenerateContent = aiInstance.models.generateContent;
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a recipe successfully and parse JSON', async () => {
    const mockResponseText = {
      title: 'Phở Bò',
      ingredients: [
        { name: 'Bánh phở', amount: '500', unit: 'g', price: 20000 },
        { name: 'Thịt bò', amount: '300', unit: 'g', price: 80000 },
      ],
      instructions: 'Nấu nước dùng, chần bánh phở, thêm thịt và thưởng thức.',
      totalCost: 100000,
      recommendedPrice: 300000,
    };

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(mockResponseText),
    });

    const theme = 'Phở Bò truyền thống';
    const result = await generateRecipe(theme);

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3-flash-preview',
        contents: expect.stringContaining(theme),
        config: expect.objectContaining({
          responseMimeType: 'application/json',
          responseSchema: expect.any(Object),
        }),
      })
    );

    expect(result).toEqual(mockResponseText);
  });

  it('should throw an error if generateContent fails', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('API Error'));

    const theme = 'Gà rán';
    await expect(generateRecipe(theme)).rejects.toThrow('API Error');
  });

  it('should throw an error if the response text is not valid JSON', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'This is not valid JSON',
    });

    const theme = 'Bún chả';
    await expect(generateRecipe(theme)).rejects.toThrow(SyntaxError);
  });
});
