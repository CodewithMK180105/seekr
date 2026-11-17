import {
  prisma,
  getCrawlerQueue,
  NotFoundError,
  BadRequestError,
  ConflictError,
  CreateCrawlJobInput,
} from '@seekr/shared';
import { CrawlJobDto } from '@seekr/types';

export class CrawlerService {
  async createCrawlJob(userId: string, input: CreateCrawlJobInput): Promise<CrawlJobDto> {
    const source = await prisma.source.findUnique({
      where: { id: input.sourceId },
    });

    if (!source) {
      throw new NotFoundError(`Source with ID "${input.sourceId}" not found`);
    }

    if (source.status === 'DISABLED') {
      throw new BadRequestError('Cannot start a crawl job for a disabled source');
    }

    // Check if an existing crawl job is currently running for this source
    const activeJob = await prisma.crawlJob.findFirst({
      where: {
        sourceId: input.sourceId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });

    if (activeJob) {
      throw new ConflictError(
        'A crawl job is already pending or actively running for this source'
      );
    }

    // Create CrawlJob in database
    const jobRecord = await prisma.crawlJob.create({
      data: {
        sourceId: source.id,
        createdBy: userId,
        status: 'PENDING',
        pagesProcessed: 0,
        pagesFailed: 0,
      },
      include: {
        source: {
          select: { name: true, baseUrl: true },
        },
      },
    });

    // Enqueue job into BullMQ seekr-crawler queue
    await getCrawlerQueue().add(
      'crawl',
      {
        crawlJobId: jobRecord.id,
        sourceId: source.id,
        baseUrl: source.baseUrl,
        maxPages: input.maxPages,
        maxDepth: input.maxDepth,
      },
      {
        jobId: jobRecord.id,
      }
    );

    return this.toDto(jobRecord);
  }

  async listCrawlJobs(
    page = 1,
    limit = 20
  ): Promise<{ jobs: CrawlJobDto[]; total: number }> {
    const skip = (page - 1) * limit;

    const [total, jobs] = await Promise.all([
      prisma.crawlJob.count(),
      prisma.crawlJob.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          source: {
            select: { name: true, baseUrl: true },
          },
        },
      }),
    ]);

    return {
      jobs: jobs.map(this.toDto),
      total,
    };
  }

  async getCrawlJobById(id: string): Promise<CrawlJobDto> {
    const job = await prisma.crawlJob.findUnique({
      where: { id },
      include: {
        source: {
          select: { name: true, baseUrl: true },
        },
      },
    });

    if (!job) {
      throw new NotFoundError(`Crawl job with ID "${id}" not found`);
    }

    return this.toDto(job);
  }

  async retryCrawlJob(id: string): Promise<CrawlJobDto> {
    const job = await prisma.crawlJob.findUnique({
      where: { id },
      include: {
        source: {
          select: { name: true, baseUrl: true },
        },
      },
    });

    if (!job) {
      throw new NotFoundError(`Crawl job with ID "${id}" not found`);
    }

    if (job.status !== 'FAILED') {
      throw new BadRequestError(`Cannot retry a job with status "${job.status}". Only FAILED jobs can be retried.`);
    }

    const updated = await prisma.crawlJob.update({
      where: { id },
      data: {
        status: 'PENDING',
        retryCount: { increment: 1 },
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      },
      include: {
        source: {
          select: { name: true, baseUrl: true },
        },
      },
    });

    await getCrawlerQueue().add(
      'crawl',
      {
        crawlJobId: updated.id,
        sourceId: updated.sourceId,
        baseUrl: updated.source.baseUrl,
        maxPages: 10,
        maxDepth: 2,
      },
      {
        jobId: `${updated.id}-retry-${updated.retryCount}`,
      }
    );

    return this.toDto(updated);
  }

  private toDto(job: any): CrawlJobDto {
    return {
      id: job.id,
      sourceId: job.sourceId,
      createdBy: job.createdBy,
      status: job.status,
      pagesProcessed: job.pagesProcessed,
      pagesFailed: job.pagesFailed,
      retryCount: job.retryCount,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      source: job.source,
    };
  }
}

export const crawlerService = new CrawlerService();
