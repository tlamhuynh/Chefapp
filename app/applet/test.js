function robustParseJson(jsonStr) {
  if (!jsonStr) return {};
  
  let cleaned = jsonStr.trim();
  
  // Remove markdown code blocks if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '');
  }

  // Attempt standard parse first
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.log("[robustParseJson] Initial parse failed", e.message);
  }

  // Find the first '{' or '['
  const startIndex = cleaned.search(/[\{\[]/);
  if (startIndex === -1) {
    throw new Error("No JSON object or array found in response");
  }

  let openBraces = 0;
  let endIndex = -1;
  let inString = false;
  let escapeNext = false;
  
  for (let i = startIndex; i < cleaned.length; i++) {
    const char = cleaned[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{' || char === '[') {
        openBraces++;
      } else if (char === '}' || char === ']') {
        openBraces--;
        if (openBraces === 0) {
          endIndex = i;
          break;
        }
      }
    }
  }

  if (endIndex !== -1) {
    cleaned = cleaned.substring(startIndex, endIndex + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.log("Secondary parse failed", e);
    try {
      // Common AI mistakes: trailing commas, single quotes on keys
      const fixed = cleaned
        .replace(/,\s*([\}\]])/g, '$1') // Trailing commas
        .replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":'); // Single quoted keys
      
      return JSON.parse(fixed);
    } catch (e2) {
      console.log("All parsing failed!");
      throw e2;
    }
  }
}

console.log(robustParseJson('```json\n{"text": "Hello\\nWorld"}```'));
console.log(robustParseJson('Here is your response:\n{"test": "blabla\nblabla"}\nHope it helps!'));
console.log(robustParseJson('{"a": "b"} {"c": "d"}'));
