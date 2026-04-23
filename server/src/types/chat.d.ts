// Placeholder for error handler type definitions
export interface APIError extends Error {
  statusCode?: number;
  details?: any;
}
