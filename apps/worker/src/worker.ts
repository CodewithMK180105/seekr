import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'bullmq';
import {
  QUEUE_NAMES,
  getRedisClient,
  prisma,
} from '@seekr/shared';
import { CrawlJobData } from '@seekr/types';
import { processCrawlJob } from './processors/crawlProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

console.log('🤖 Starting Seekr Background Worker...');

const crawlWorker = new Worker<CrawlJobData>(
  QUEUE_NAMES.CRAWLER,
  async (job) => {
    await processCrawlJob(job);
  },
  {
    connection: getRedisClient(),
    concurrency: 2,
  }
);

crawlWorker.on('ready', () => {
  console.log(`✅ Crawl worker listening on queue: "${QUEUE_NAMES.CRAWLER}"`);
});

crawlWorker.on('completed', (job) => {
  console.log(`🎯 Job ${job.id} completed successfully`);
});

crawlWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed with error:`, err.message);
});

crawlWorker.on('error', (err) => {
  console.error('⚠️ Worker error:', err);
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n[${signal}] Shutting down worker...`);
  try {
    await crawlWorker.close();
    console.log('Crawl worker closed.');
    await prisma.$disconnect();
    console.log('PostgreSQL connection closed.');
    const redis = getRedisClient();
    redis.disconnect();
    console.log('Redis connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
