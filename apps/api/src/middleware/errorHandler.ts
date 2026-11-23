import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@seekr/shared';
import { ApiResponse } from '@seekr/types';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req.headers['x-request-id'] as string) || undefined;

  // Handle known operational AppError
  if (err instanceof AppError) {
    if ('retryAfter' in err && typeof (err as any).retryAfter === 'number') {
      res.setHeader('Retry-After', String((err as any).retryAfter));
    }
    const response: ApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        ...('retryAfter' in err ? { retryAfter: (err as any).retryAfter } : {}),
      },
      meta: { requestId },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle Zod schema validation errors (instanceof or duck-typed)
  if (err instanceof ZodError || err.name === 'ZodError' || 'issues' in err) {
    const issues = (err as any).issues || (err as any).errors || [];
    const formattedErrors = issues.map((e: any) => ({
      path: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
      message: e.message,
    }));

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request input',
        details: formattedErrors,
      },
      meta: { requestId },
    };
    res.status(422).json(response);
    return;
  }

  // Handle unexpected internal server errors
  console.error('[Unhandled Server Error]', err);

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err.message || 'Internal server error',
    },
    meta: { requestId },
  };

  res.status(500).json(response);
}
