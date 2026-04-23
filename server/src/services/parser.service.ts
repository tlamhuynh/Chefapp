import { extractJson } from '../../../src/server/utils/json';
import { isSafeUrl } from '../../../src/server/utils/security';
import { logger } from '../utils/logger';

export class ParserService {
  /**
   * Safely extracts and parses JSON from potentially conversational LLM output
   */
  static extractJsonFromText<T>(text: string): T | null {
    try {
      return extractJson<T>(text);
    } catch (error) {
      logger.error('ParserService: Failed to extract JSON: %o', error);
      return null;
    }
  }

  /**
   * Validates a URL to prevent SSRF and other security risks
   */
  static isValidPublicUrl(url: string): boolean {
    if (!url) return false;
    const isSafe = isSafeUrl(url);
    if (!isSafe) {
      logger.warn('ParserService: Blocked unsafe URL: %s', url);
    }
    return isSafe;
  }
}
