import { Registry, collectDefaultMetrics } from 'prom-client';

export const metricsRegistry = new Registry();

// Automatically collect default Node.js process and runtime metrics (heap, cpu, event loop lag, etc.)
collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'seekr_',
  // Event loop monitoring bucket intervals
  eventLoopMonitoringPrecision: 10,
});
