import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { prisma, hashPassword, signAccessToken } from '@seekr/shared';
import { config } from '../config/index.js';

vi.mock('@seekr/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@seekr/shared')>();
  return {
    ...actual,
    prisma: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    },
  };
});

describe('Auth Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('returns 422 if email or password are invalid', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'bad-email', password: 'short' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 409 if user email already exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: '123',
        email: 'exists@seekr.dev',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'exists@seekr.dev', password: 'StrongPassword123!' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('registers a new user and sets refresh token cookie', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        id: 'uuid-1234',
        email: 'newuser@seekr.dev',
        passwordHash: 'argon_hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'newuser@seekr.dev', password: 'StrongPassword123!' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('newuser@seekr.dev');
      expect(res.body.data.accessToken).toBeDefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('seekr_refresh_token=');
      expect(cookies[0]).toContain('HttpOnly');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns 401 on incorrect password', async () => {
      const validHash = await hashPassword('CorrectPassword123!');

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'uuid-1234',
        email: 'user@seekr.dev',
        passwordHash: validHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'user@seekr.dev', password: 'WrongPassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('successfully logs in with valid credentials', async () => {
      const validHash = await hashPassword('CorrectPassword123!');

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'uuid-1234',
        email: 'user@seekr.dev',
        passwordHash: validHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'user@seekr.dev', password: 'CorrectPassword123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns user profile when a valid Bearer token is sent', async () => {
      const token = signAccessToken(
        { userId: 'uuid-1234', email: 'user@seekr.dev' },
        config.JWT_ACCESS_SECRET
      );

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'uuid-1234',
        email: 'user@seekr.dev',
        passwordHash: 'hash',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      } as any);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe('uuid-1234');
      expect(res.body.data.user.email).toBe('user@seekr.dev');
    });
  });
});
