export type SourceType = 'WEBSITE' | 'DOCUMENTATION' | 'WIKIPEDIA_API' | 'GITHUB_API';

export type SourceStatus = 'ACTIVE' | 'PAUSED' | 'DISABLED';

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface SourceDto {
  id: string;
  name: string;
  baseUrl: string;
  sourceType: SourceType;
  status: SourceStatus;
  documentCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrawlJobDto {
  id: string;
  sourceId: string;
  createdBy: string;
  status: JobStatus;
  pagesProcessed: number;
  pagesFailed: number;
  retryCount: number;
  errorMessage?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  source?: {
    name: string;
    baseUrl: string;
  };
}

export interface CrawlJobPayload {
  sourceId: string;
  maxPages?: number;
  maxDepth?: number;
}

export interface CrawlJobData {
  crawlJobId: string;
  sourceId: string;
  baseUrl: string;
  maxPages: number;
  maxDepth: number;
}

export interface IndexJobData {
  documentId: string;
  isUpdate: boolean;
}
