import {
  queueJobsWaiting,
  queueJobsActive,
  queueJobsCompleted,
  queueJobsFailed,
  queueJobsDelayed,
  queuePaused,
} from './metrics.js';
import { getCrawlerQueue, getIndexerQueue, QUEUE_NAMES } from '../queue.js';

/**
 * Periodically or on-demand polls BullMQ queues and updates Prometheus gauge metrics.
 * Designed to fail gracefully if Redis is temporarily unreachable.
 */
export async function collectQueueMetrics(): Promise<void> {
  const queues = [
    { name: QUEUE_NAMES.CRAWLER, getQueue: getCrawlerQueue },
    { name: QUEUE_NAMES.INDEXER, getQueue: getIndexerQueue },
  ];

  for (const { name, getQueue } of queues) {
    try {
      const q = getQueue();
      const [counts, isPaused] = await Promise.all([
        q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
        q.isPaused(),
      ]);

      queueJobsWaiting.set({ queue: name }, counts.waiting ?? 0);
      queueJobsActive.set({ queue: name }, counts.active ?? 0);
      queueJobsCompleted.set({ queue: name }, counts.completed ?? 0);
      queueJobsFailed.set({ queue: name }, counts.failed ?? 0);
      queueJobsDelayed.set({ queue: name }, counts.delayed ?? 0);
      queuePaused.set({ queue: name }, isPaused ? 1 : 0);
    } catch (err) {
      // Non-blocking telemetry fallback if Redis or BullMQ is not connected
      console.warn(`[collectQueueMetrics] Unable to sample BullMQ queue "${name}":`, err);
    }
  }
}
