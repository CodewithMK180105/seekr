import { Request, Response, NextFunction } from 'express';
import { httpRequestsTotal, httpErrorsTotal, httpRequestDurationSeconds } from '@seekr/shared';

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Normalizes HTTP route paths to prevent metric label cardinality explosion.
 * Replaces UUIDs, arbitrary IDs, and query strings with parameterized tokens.
 */
export function normalizeRoute(req: Request): string {
  // If Express route and non-empty baseUrl are available, use them
  if (req.route?.path && req.baseUrl) {
    const base = req.baseUrl;
    const path = req.route.path === '/' && base !== '' ? '' : req.route.path;
    return `${base}${path}` || '/';
  }

  let pathname = (req.originalUrl || req.url || '/').split('?')[0];

  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  pathname = pathname.replace(UUID_REGEX, ':id');

  return pathname || '/';
}

/**
 * Middleware that tracks total HTTP requests, error responses, and request latency distributions.
 */
export function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = performance.now();

  res.on('finish', () => {
    try {
      const durationSeconds = (performance.now() - startTime) / 1000;
      const method = req.method.toUpperCase();
      const route = normalizeRoute(req);
      const statusCode = String(res.statusCode);

      httpRequestsTotal.inc({ method, route, status_code: statusCode });
      httpRequestDurationSeconds.observe({ method, route, status_code: statusCode }, durationSeconds);

      if (res.statusCode >= 400) {
        const errorType = res.statusCode >= 500 ? '5xx' : '4xx';
        httpErrorsTotal.inc({
          method,
          route,
          status_code: statusCode,
          error_type: errorType,
        });
      }
    } catch (err) {
      // Metrics collection must never crash or block response completion
      console.warn('[httpMetricsMiddleware] Error recording metrics:', err);
    }
  });

  next();
}
