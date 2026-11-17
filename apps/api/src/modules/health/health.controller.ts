import { Request, Response } from 'express';
import { checkDatabaseHealth, checkRedisHealth } from '@seekr/shared';
import { ApiResponse, HealthCheckResponse } from '@seekr/types';

export async function getLiveness(_req: Request, res: Response): Promise<void> {
  const healthData: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  const response: ApiResponse<HealthCheckResponse> = {
    success: true,
    data: healthData,
  };

  res.status(200).json(response);
}

export async function getReadiness(_req: Request, res: Response): Promise<void> {
  const [dbOk, redisOk] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);

  const allReady = dbOk && redisOk;
  const statusCode = allReady ? 200 : 503;

  const healthData: HealthCheckResponse = {
    status: allReady ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: dbOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
    },
  };

  const response: ApiResponse<HealthCheckResponse> = {
    success: allReady,
    data: healthData,
    error: allReady
      ? undefined
      : {
          code: 'SERVICES_UNAVAILABLE',
          message: 'One or more required infrastructure services are down',
          details: healthData.services,
        },
  };

  res.status(statusCode).json(response);
}
