import { Queue, QueueOptions } from 'bullmq';
import { CrawlJobData, IndexJobData } from '@seekr/types';
import { getRedisClient } from './redis.js';

export const QUEUE_NAMES = {
  CRAWLER: 'seekr-crawler',
  INDEXER: 'seekr-indexer',
} as const;

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    age: 24 * 3600, // keep up to 24h
    count: 500,
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // keep up to 7 days
    count: 1000,
  },
};

let crawlerQueueInstance: Queue<CrawlJobData> | null = null;
let indexerQueueInstance: Queue<IndexJobData> | null = null;

function getQueueOptions(): QueueOptions {
  return {
    connection: getRedisClient(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  };
}

export function getCrawlerQueue(): Queue<CrawlJobData> {
  if (!crawlerQueueInstance) {
    crawlerQueueInstance = new Queue<CrawlJobData>(QUEUE_NAMES.CRAWLER, getQueueOptions());
  }
  return crawlerQueueInstance;
}

export function getIndexerQueue(): Queue<IndexJobData> {
  if (!indexerQueueInstance) {
    indexerQueueInstance = new Queue<IndexJobData>(QUEUE_NAMES.INDEXER, getQueueOptions());
  }
  return indexerQueueInstance;
}
