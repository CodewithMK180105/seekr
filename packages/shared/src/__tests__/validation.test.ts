import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, searchQuerySchema } from '../validation.js';

describe('Validation Schemas', () => {
  describe('registerSchema', () => {
    it('should validate a correct email and strong password', () => {
      const result = registerSchema.safeParse({
        email: 'user@seekr.dev',
        password: 'SecurePassword123!',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@seekr.dev');
      }
    });

    it('should normalize uppercase email addresses and trim whitespace', () => {
      const result = registerSchema.safeParse({
        email: '  USER@Seekr.Dev  ',
        password: 'SecurePassword123!',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@seekr.dev');
      }
    });

    it('should fail on invalid email', () => {
      const result = registerSchema.safeParse({
        email: 'not-an-email',
        password: 'ValidPassword123!',
      });
      expect(result.success).toBe(false);
    });

    it('should fail on password shorter than 8 characters', () => {
      const result = registerSchema.safeParse({
        email: 'user@seekr.dev',
        password: 'short',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should validate valid email and password', () => {
      const result = loginSchema.safeParse({
        email: '  USER@Seekr.Dev ',
        password: 'anypassword',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@seekr.dev');
      }
    });

    it('should fail when password is empty', () => {
      const result = loginSchema.safeParse({
        email: 'user@seekr.dev',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('searchQuerySchema', () => {
    it('should apply default search mode and pagination', () => {
      const result = searchQuerySchema.safeParse({
        q: 'redis persistence aof',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('HYBRID');
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
      }
    });

    it('should fail on empty search query', () => {
      const result = searchQuerySchema.safeParse({
        q: '',
      });
      expect(result.success).toBe(false);
    });
  });
});
