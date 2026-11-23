export interface RateLimitOptions {
  windowMs?: number; // Duration of sliding window in milliseconds (default: 60,000ms / 1 min)
  maxRequests?: number; // Generic fallback limit
  anonymousLimit?: number; // Quota for unauthenticated IP clients
  authenticatedLimit?: number; // Quota for authenticated users / API keys
  prefix?: string; // Redis key namespace prefix e.g. "search", "research"
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number; // Unix timestamp in seconds when window resets
  retryAfter: number; // Seconds until next allowed request (0 if allowed)
}
