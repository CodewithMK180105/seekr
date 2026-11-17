import { z } from 'zod';

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(100, 'Password must not exceed 100 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const createSourceSchema = z.object({
  name: z.string().min(1, 'Source name is required').max(100),
  baseUrl: z.string().url('Base URL must be a valid URL'),
  sourceType: z.enum(['WEBSITE', 'DOCUMENTATION', 'WIKIPEDIA_API', 'GITHUB_API']),
});

export type CreateSourceInput = z.infer<typeof createSourceSchema>;

export const updateSourceStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'DISABLED']),
});

export type UpdateSourceStatusInput = z.infer<typeof updateSourceStatusSchema>;

export const createCrawlJobSchema = z.object({
  sourceId: z.string().uuid('Invalid source ID format'),
  maxPages: z.coerce.number().int().min(1).max(100).default(10),
  maxDepth: z.coerce.number().int().min(0).max(5).default(2),
});

export type CreateCrawlJobInput = z.infer<typeof createCrawlJobSchema>;

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Query cannot be empty').max(500, 'Query too long').trim(),
  mode: z.enum(['KEYWORD', 'SEMANTIC', 'HYBRID']).default('HYBRID'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
