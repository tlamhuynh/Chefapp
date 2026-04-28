import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

async function test() {
try {
  const model = createOpenAI({ 
        apiKey: undefined,
        baseURL: 'https://api.groq.com/openai/v1'
  })('llama-3.3-70b-versatile');
  
  const res = await generateText({
     model,
     prompt: 'Hello'
  });
  console.log("Success", res.text)
} catch (e) {
  console.error("Groq fallback error:", e);
}
}
test();
