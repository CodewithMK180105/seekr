import jwt from 'jsonwebtoken';
import { JwtTokenPayload } from '@seekr/types';
import { UnauthorizedError } from './errors.js';

export interface TokenConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn?: string | number;
  refreshExpiresIn?: string | number;
}

export function signAccessToken(
  payload: JwtTokenPayload,
  secret: string,
  expiresIn: string | number = '15m'
): string {
  return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
}

export function signRefreshToken(
  payload: JwtTokenPayload,
  secret: string,
  expiresIn: string | number = '7d'
): string {
  return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
}

export function verifyAccessToken(token: string, secret: string): JwtTokenPayload {
  try {
    const decoded = jwt.verify(token, secret) as JwtTokenPayload;
    return {
      userId: decoded.userId,
      email: decoded.email,
    };
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Access token has expired', { expired: true });
    }
    throw new UnauthorizedError('Invalid access token');
  }
}

export function verifyRefreshToken(token: string, secret: string): JwtTokenPayload {
  try {
    const decoded = jwt.verify(token, secret) as JwtTokenPayload;
    return {
      userId: decoded.userId,
      email: decoded.email,
    };
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Refresh token has expired', { expired: true });
    }
    throw new UnauthorizedError('Invalid refresh token');
  }
}
