import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

async function main() {
  const oai = createOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY || 'sk-fake', 
  });
  
  const model = oai("gpt-4o");
  
  try {
    await generateText({ 
      model, 
      messages: [{ role: 'user', content: 'Hi' }] 
    });
  } catch (e: any) {
    if (e.url) console.error('FAILED URL:', e.url);
    else console.error('FAILED ERROR:', e);
  }
}
main();
