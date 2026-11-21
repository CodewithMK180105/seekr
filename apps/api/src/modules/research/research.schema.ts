import { z } from 'zod';

export const researchQuerySchema = z.object({
  query: z
    .string({ required_error: 'Query is required' })
    .trim()
    .min(2, 'Query must be at least 2 characters')
    .max(500, 'Query must not exceed 500 characters'),
  mode: z.enum(['KEYWORD', 'SEMANTIC', 'HYBRID']).default('HYBRID').optional(),
  maxSources: z.coerce
    .number()
    .int('maxSources must be an integer')
    .min(1, 'maxSources must be at least 1')
    .max(20, 'maxSources cannot exceed 20')
    .default(8)
    .optional(),
  temperature: z.coerce
    .number()
    .min(0, 'temperature cannot be less than 0')
    .max(1, 'temperature cannot exceed 1')
    .default(0.2)
    .optional(),
});

export type ValidatedResearchQuery = z.infer<typeof researchQuerySchema>;
