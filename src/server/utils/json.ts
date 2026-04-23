/**
 * Robustly extracts and parses JSON from a string that might contain extra text.
 * Uses indexOf('{') and lastIndexOf('}') as suggested for reliability.
 */
export function extractJson<T = any>(text: string): T | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  
  if (start === -1 || end === -1 || end < start) {
    return null;
  }
  
  const jsonStr = text.substring(start, end + 1);
  
  try {
    return JSON.parse(jsonStr) as T;
  } catch (error) {
    console.error('[JSON Utils] Malformed JSON extracted:', jsonStr);
    return null;
  }
}
