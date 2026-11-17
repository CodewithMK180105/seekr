import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../jwt.js';
import { UnauthorizedError } from '../errors.js';

describe('JWT Utility', () => {
  const secret = 'super-secret-test-key-32-chars-long!!';
  const payload = { userId: '123e4567-e89b-12d3-a456-426614174000', email: 'test@example.com' };

  it('should sign and verify a valid access token', () => {
    const token = signAccessToken(payload, secret, '1h');
    const decoded = verifyAccessToken(token, secret);

    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });

  it('should sign and verify a valid refresh token', () => {
    const token = signRefreshToken(payload, secret, '7d');
    const decoded = verifyRefreshToken(token, secret);

    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });

  it('should throw UnauthorizedError when verifying with wrong secret', () => {
    const token = signAccessToken(payload, secret, '1h');
    expect(() => verifyAccessToken(token, 'wrong-secret-key-that-does-not-match')).toThrow(
      UnauthorizedError
    );
  });

  it('should throw UnauthorizedError for expired tokens', async () => {
    const token = signAccessToken(payload, secret, '1ms');

    // Wait 10ms for expiration
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(() => verifyAccessToken(token, secret)).toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError for malformed token strings', () => {
    expect(() => verifyAccessToken('not.a.jwt', secret)).toThrow(UnauthorizedError);
  });
});
