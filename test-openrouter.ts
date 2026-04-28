import { createOpenRouter } from '@openrouter/ai-sdk-provider';

try {
  const model = createOpenRouter({ apiKey: 'fake_key' })('moonshotai/moonshot-v1-8k');
  console.log("Success!")
} catch (e) {
  console.error("Error creating OpenRouter:", e)
}
