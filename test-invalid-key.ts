import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

async function test() {
  const finalKey = "ABdc1231231invalidkey";
  console.log("Key length:", finalKey?.length);
  
  try {
    const google = createGoogleGenerativeAI({ apiKey: finalKey });
    const model = google('gemini-2.5-flash');
    
    const result = await generateText({
      model,
      prompt: 'Hello',
    });
    
    console.log("Success:", result.text);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

test();
