import { app } from './app.js';
import { config } from './config/index.js';
import { prisma, getRedisClient } from '@seekr/shared';

const server = app.listen(config.PORT, () => {
  console.log(`🚀 Seekr API server running on ${config.API_URL} (Port ${config.PORT})`);
  console.log(`📋 Health check available at ${config.API_URL}/health`);
  console.log(`📋 Readiness check available at ${config.API_URL}/ready`);
});

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
  console.log(`\n[${signal}] Received. Shutting down gracefully...`);

  server.close(async () => {
    console.log('HTTP server closed.');

    try {
      await prisma.$disconnect();
      console.log('PostgreSQL connection closed.');
    } catch (err) {
      console.error('Error closing PostgreSQL connection:', err);
    }

    try {
      const redis = getRedisClient();
      redis.disconnect();
      console.log('Redis connection closed.');
    } catch (err) {
      console.error('Error closing Redis connection:', err);
    }

    process.exit(0);
  });

  // Force shutdown after 10 seconds timeout
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
