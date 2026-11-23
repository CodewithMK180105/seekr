import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root if available
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config(); // fallback to cwd

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_URL: z.string().default('http://localhost:4000'),
  WEB_URL: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  EMBEDDING_PROVIDER: z.string().default('gemini'),
  EMBEDDING_MODEL: z.string().default('text-embedding-004'),
  EMBEDDING_DIMENSION: z.coerce.number().default(768),
  LLM_PROVIDER: z.string().default('gemini'),
  LLM_MODEL: z.string().default('gemini-2.5-flash'),

  GEMINI_API_KEY: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),

  // Rate Limiting Quotas (Requests per minute)
  RATE_LIMIT_DISABLED: z.enum(['true', 'false']).default('false'),
  RATE_LIMIT_SEARCH_ANON: z.coerce.number().default(60),
  RATE_LIMIT_SEARCH_AUTH: z.coerce.number().default(180),
  RATE_LIMIT_RESEARCH_ANON: z.coerce.number().default(10),
  RATE_LIMIT_RESEARCH_AUTH: z.coerce.number().default(30),
  RATE_LIMIT_SUGGESTIONS_ANON: z.coerce.number().default(120),
  RATE_LIMIT_SUGGESTIONS_AUTH: z.coerce.number().default(300),
  RATE_LIMIT_GLOBAL_ANON: z.coerce.number().default(120),
  RATE_LIMIT_GLOBAL_AUTH: z.coerce.number().default(300),

  // Caching & Thresholds
  SEMANTIC_CACHE_SEARCH_THRESHOLD: z.coerce.number().default(0.88),
  SEMANTIC_CACHE_RESEARCH_THRESHOLD: z.coerce.number().default(0.90),
  CACHE_SEARCH_TTL_SECONDS: z.coerce.number().default(900),
  CACHE_RESEARCH_TTL_SECONDS: z.coerce.number().default(3600),

  // Research Token Budgeting
  RESEARCH_MAX_CONTEXT_TOKENS: z.coerce.number().default(4096),
  RESEARCH_RESERVED_RESPONSE_TOKENS: z.coerce.number().default(1024),
  RESEARCH_MAX_SOURCES: z.coerce.number().default(8),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration error');
}

export const config = parsed.data;
