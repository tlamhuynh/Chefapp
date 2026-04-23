import { URL } from 'url';

/**
 * Validates a URL to prevent SSRF (Server-Side Request Forgery) attacks.
 * Blocks private and local IP ranges.
 */
export function isSafeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    
    // Only allow HTTP and HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    
    // Check for private and local IP blocks
    const privateIpBlocks = [
      /^localhost$/,
      /^127\./,
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^169\.254\./,
      /^::1$/,
      /^fe80:/
    ];
    
    if (privateIpBlocks.some(regex => regex.test(hostname))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
