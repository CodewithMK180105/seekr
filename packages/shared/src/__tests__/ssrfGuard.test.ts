import { describe, it, expect } from 'vitest';
import { validateSafeUrl } from '../ssrfGuard.js';
import { BadRequestError } from '../errors.js';

describe('SSRF Guard Service', () => {
  it('blocks invalid protocol URLs', async () => {
    await expect(validateSafeUrl('file:///etc/passwd')).rejects.toThrow(BadRequestError);
    await expect(validateSafeUrl('ftp://ftp.example.com')).rejects.toThrow(BadRequestError);
    await expect(validateSafeUrl('gopher://example.com')).rejects.toThrow(BadRequestError);
  });

  it('blocks localhost and internal hostnames', async () => {
    await expect(validateSafeUrl('http://localhost:4000')).rejects.toThrow(BadRequestError);
    await expect(validateSafeUrl('http://test.localhost')).rejects.toThrow(BadRequestError);
    await expect(validateSafeUrl('http://redis.internal')).rejects.toThrow(BadRequestError);
  });

  it('blocks private IPv4 loopback (127.0.0.1)', async () => {
    await expect(validateSafeUrl('http://127.0.0.1:6379')).rejects.toThrow(BadRequestError);
  });

  it('blocks cloud metadata IP (169.254.169.254)', async () => {
    await expect(validateSafeUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      BadRequestError
    );
  });

  it('blocks private subnet IPs (10.x, 192.168.x)', async () => {
    await expect(validateSafeUrl('http://10.0.0.5:8080')).rejects.toThrow(BadRequestError);
    await expect(validateSafeUrl('http://192.168.1.1')).rejects.toThrow(BadRequestError);
  });

  it('strips hash fragments and normalizes valid URLs', async () => {
    // Wikipedia public IP
    const url = 'https://en.wikipedia.org/wiki/Redis#Persistence';
    const safe = await validateSafeUrl(url);
    expect(safe).toBe('https://en.wikipedia.org/wiki/Redis');
  });
});
