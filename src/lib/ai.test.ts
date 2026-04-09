import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chatWithAI } from './ai';

// --- Mocks ---

// Mock GoogleGenAI
const mockGenerateContent = vi.fn();
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: mockGenerateContent
      };
    }
  };
});

// Mock OpenAI
const mockChatCompletionsCreate = vi.fn();
vi.mock('openai', () => {
  return {
    default: class {
      chat = {
        completions: {
          create: mockChatCompletionsCreate
        }
      };
    }
  };
});

// Mock Anthropic
const mockMessagesCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class {
      messages = {
        create: mockMessagesCreate
      };
    }
  };
});

describe('chatWithAI multi-provider routing', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Set fake API keys to avoid throwing initialization errors
    process.env.GEMINI_API_KEY = 'fake-gemini-key';
    process.env.OPENAI_API_KEY = 'fake-openai-key';
    process.env.ANTHROPIC_API_KEY = 'fake-anthropic-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const sampleMessages = [
    { role: 'user', parts: [{ text: 'Hello' }] }
  ];
  const sampleSystemInstruction = 'You are a helpful assistant';

  describe('Google Provider', () => {
    it('should route to Google provider and parse valid JSON', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: '{"result": "success", "message": "Hi there"}'
      });

      const response = await chatWithAI('gemini-3-flash-preview', sampleMessages, sampleSystemInstruction);

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.model).toBe('gemini-3-flash-preview');
      expect(callArgs.config.systemInstruction).toBe(sampleSystemInstruction);
      expect(response).toEqual({ result: 'success', message: 'Hi there' });
    });

    it('should handle invalid JSON from Google provider by falling back to object', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: 'Not a valid JSON string'
      });

      const response = await chatWithAI('gemini-3.1-pro-preview', sampleMessages, sampleSystemInstruction);

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(response).toEqual({ text: 'Not a valid JSON string', suggestions: [] });
    });
  });

  describe('OpenAI Provider', () => {
    it('should route to OpenAI provider and parse valid JSON', async () => {
      mockChatCompletionsCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '{"result": "openai-success"}'
            }
          }
        ]
      });

      const response = await chatWithAI('gpt-4o', sampleMessages, sampleSystemInstruction);

      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockChatCompletionsCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4o');
      expect(callArgs.response_format).toEqual({ type: 'json_object' });
      expect(response).toEqual({ result: 'openai-success' });
    });

    it('should handle missing content in OpenAI response', async () => {
      mockChatCompletionsCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null
            }
          }
        ]
      });

      const response = await chatWithAI('gpt-4o', sampleMessages, sampleSystemInstruction);

      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);
      expect(response).toEqual({}); // Fallback to "{}" which parses to {}
    });
  });

  describe('Anthropic Provider', () => {
    it('should route to Anthropic provider and extract JSON from text', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          { text: 'Here is your response:\n\n{"result": "anthropic-success"}\n\nHope this helps!' }
        ]
      });

      const response = await chatWithAI('claude-3-5-sonnet-latest', sampleMessages, sampleSystemInstruction);

      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockMessagesCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('claude-3-5-sonnet-latest');
      expect(response).toEqual({ result: 'anthropic-success' });
    });

    it('should handle invalid JSON from Anthropic provider by falling back to object', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          { text: 'Just a normal text response' }
        ]
      });

      const response = await chatWithAI('claude-3-5-sonnet-latest', sampleMessages, sampleSystemInstruction);

      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
      expect(response).toEqual({ text: 'Just a normal text response', suggestions: [] });
    });
  });

  describe('Unknown Provider', () => {
    it('should fallback to first model if modelId is not found', async () => {
      // First model is 'gemini-3-flash-preview' (google)
      mockGenerateContent.mockResolvedValueOnce({
        text: '{"default": "model"}'
      });

      const response = await chatWithAI('non-existent-model', sampleMessages, sampleSystemInstruction);

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(mockGenerateContent.mock.calls[0][0].model).toBe('gemini-3-flash-preview');
      expect(response).toEqual({ default: 'model' });
    });
  });
});
