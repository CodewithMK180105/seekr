import { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { TooManyRequestsError, RateLimiterService, rateLimitExceededTotal } from '@seekr/shared';
import { RateLimitOptions } from '@seekr/types';
import { config } from '../config/index.js';

const defaultService = new RateLimiterService();

export function createRateLimiter(
  options: RateLimitOptions = {},
  rateLimiterService: RateLimiterService = defaultService
) {
  const windowMs = options.windowMs ?? 60000;
  const prefix = options.prefix || 'api';

  return async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    // Global bypass switch (useful for automated benchmarks)
    if (config.RATE_LIMIT_DISABLED === 'true' || process.env.RATE_LIMIT_DISABLED === 'true') {
      return next();
    }

    try {
      // 1. Resolve client identity and authentication tier
      let identifier = '';
      let isAuthenticated = false;

      if ((req as any).user?.userId) {
        identifier = `user:${(req as any).user.userId}`;
        isAuthenticated = true;
      } else if (req.headers['x-api-key']) {
        const keyHash = createHash('sha256')
          .update(String(req.headers['x-api-key']))
          .digest('hex')
          .slice(0, 16);
        identifier = `apikey:${keyHash}`;
        isAuthenticated = true;
      } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        const tokenHash = createHash('sha256')
          .update(req.headers.authorization.substring(7))
          .digest('hex')
          .slice(0, 16);
        identifier = `token:${tokenHash}`;
        isAuthenticated = true;
      } else {
        const rawIp =
          (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
          req.ip ||
          req.socket.remoteAddress ||
          '127.0.0.1';
        identifier = `ip:${rawIp}`;
        isAuthenticated = false;
      }

      // 2. Select tier limit
      const limit = isAuthenticated
        ? options.authenticatedLimit ?? options.maxRequests ?? 180
        : options.anonymousLimit ?? options.maxRequests ?? 60;

      const redisKey = `seekr:ratelimit:${prefix}:${identifier}`;

      // 3. Atomically consume token from sliding window in Redis
      const result = await rateLimiterService.consume(redisKey, limit, windowMs);

      // 4. Attach standard rate limit headers
      res.setHeader('RateLimit-Limit', String(result.limit));
      res.setHeader('RateLimit-Remaining', String(result.remaining));
      res.setHeader('RateLimit-Reset', String(result.resetTime));

      // 5. Enforce limit
      if (!result.allowed) {
        res.setHeader('Retry-After', String(result.retryAfter));
        try {
          rateLimitExceededTotal.inc({ category: prefix });
        } catch {
          // Non-blocking telemetry
        }
        throw new TooManyRequestsError(
          `Rate limit exceeded for ${prefix}. Please try again in ${result.retryAfter} seconds.`,
          result.retryAfter
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

// ============================================================================
// Tiered Rate Limiter Presets
// ============================================================================

export const searchRateLimiter = createRateLimiter({
  prefix: 'search',
  windowMs: 60000,
  anonymousLimit: config.RATE_LIMIT_SEARCH_ANON,
  authenticatedLimit: config.RATE_LIMIT_SEARCH_AUTH,
});

export const researchRateLimiter = createRateLimiter({
  prefix: 'research',
  windowMs: 60000,
  anonymousLimit: config.RATE_LIMIT_RESEARCH_ANON,
  authenticatedLimit: config.RATE_LIMIT_RESEARCH_AUTH,
});

export const suggestionsRateLimiter = createRateLimiter({
  prefix: 'suggestions',
  windowMs: 60000,
  anonymousLimit: config.RATE_LIMIT_SUGGESTIONS_ANON,
  authenticatedLimit: config.RATE_LIMIT_SUGGESTIONS_AUTH,
});

export const globalApiRateLimiter = createRateLimiter({
  prefix: 'global',
  windowMs: 60000,
  anonymousLimit: config.RATE_LIMIT_GLOBAL_ANON,
  authenticatedLimit: config.RATE_LIMIT_GLOBAL_AUTH,
});
