import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, verifyAccessToken } from '@seekr/shared';
import { JwtTokenPayload } from '@seekr/types';
import { config } from '../config/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtTokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication token required');
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    throw new UnauthorizedError('Authentication token missing');
  }

  try {
    const payload = verifyAccessToken(token, config.JWT_ACCESS_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
}
