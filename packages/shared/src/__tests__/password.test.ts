import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../password.js';

describe('Password Utility (Argon2id)', () => {
  it('should hash a password with argon2id prefix', async () => {
    const plain = 'StrongPassword123!';
    const hash = await hashPassword(plain);

    expect(hash).toBeDefined();
    expect(hash).toContain('$argon2id$');
  });

  it('should generate different hashes for the same password due to unique salt', async () => {
    const plain = 'StrongPassword123!';
    const hash1 = await hashPassword(plain);
    const hash2 = await hashPassword(plain);

    expect(hash1).not.toBe(hash2);
  });

  it('should correctly verify a valid password', async () => {
    const plain = 'SuperSecretSearchKey';
    const hash = await hashPassword(plain);

    const isValid = await verifyPassword(hash, plain);
    expect(isValid).toBe(true);
  });

  it('should fail verification for an incorrect password', async () => {
    const plain = 'SuperSecretSearchKey';
    const hash = await hashPassword(plain);

    const isValid = await verifyPassword(hash, 'WrongPassword');
    expect(isValid).toBe(false);
  });

  it('should safely return false for malformed hash strings', async () => {
    const isValid = await verifyPassword('not-a-valid-argon-hash', 'SomePassword');
    expect(isValid).toBe(false);
  });
});
