import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

async function test() {
  try {
    const model = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })('moonshotai/moonshot-v1-8k');
    const res = await generateText({
      model,
      prompt: 'Hello'
    });
    console.log("Success", res.text)
  } catch (e) {
    console.error("error:", e);
  }
}
test();
