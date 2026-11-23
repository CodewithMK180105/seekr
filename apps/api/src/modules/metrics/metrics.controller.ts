import { Request, Response } from 'express';
import { metricsRegistry, collectQueueMetrics } from '@seekr/shared';
import { SemanticCacheService } from '../cache/semantic-cache.service.js';

const semanticCacheService = new SemanticCacheService();

/**
 * Controller exposing Prometheus exposition text metrics and JSON format.
 */
export async function getMetrics(req: Request, res: Response): Promise<void> {
  try {
    // 1. Asynchronously sync latest queue and cache gauges
    await Promise.allSettled([
      collectQueueMetrics(),
      semanticCacheService.syncMetricsGauges(),
    ]);

    // 2. Format negotiation: return structured JSON if explicitly requested
    const wantsJson =
      req.query.format === 'json' ||
      (req.headers.accept &&
        req.headers.accept.includes('application/json') &&
        !req.headers.accept.includes('text/plain'));

    if (wantsJson) {
      const jsonMetrics = await metricsRegistry.getMetricsAsJSON();
      res.status(200).json({
        success: true,
        data: jsonMetrics,
      });
      return;
    }

    // 3. Default: Prometheus text exposition format (version 0.0.4)
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    const metricsOutput = await metricsRegistry.metrics();
    res.status(200).send(metricsOutput);
  } catch (err) {
    console.error('[MetricsController] Error generating metrics:', err);
    res.status(500).send('# ERROR: Failed to collect metrics\n');
  }
}
