import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/lib/crypto';

describe('encrypt / decrypt', () => {
  const key = 'test-secret-key-2024';
  const plaintext = 'Hello, SOMMA! This is sensitive data.';

  it('encrypt produces a string with the somma:v1 prefix', () => {
    const encrypted = encrypt(plaintext, key);
    expect(encrypted.startsWith('somma:v1:')).toBe(true);
  });

  it('decrypt reverses encrypt to return original plaintext', () => {
    const encrypted = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it('decrypt throws for payload without the somma:v1 prefix', () => {
    expect(() => decrypt('invalid-payload', key)).toThrow('Invalid encrypted payload');
  });

  it('decrypt throws when key is wrong', () => {
    const encrypted = encrypt(plaintext, key);
    expect(() => decrypt(encrypted, 'wrong-key')).toThrow('Unable to decrypt payload');
  });

  it('encrypts empty string but decrypt throws (CryptoJS limitation)', () => {
    const encrypted = encrypt('', key);
    expect(encrypted.startsWith('somma:v1:')).toBe(true);
    // CryptoJS.AES.decrypt of empty plaintext returns empty WordArray → toString is ''
    expect(() => decrypt(encrypted, key)).toThrow('Unable to decrypt payload');
  });

  it('handles special characters and unicode', () => {
    const special = '🏋️ Treino pesado! Ação & reação — "quotes"';
    const encrypted = encrypt(special, key);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe(special);
  });

  it('produces different ciphertext for same plaintext (AES randomness)', () => {
    const a = encrypt(plaintext, key);
    const b = encrypt(plaintext, key);
    // The somma:v1: prefix is same, but the ciphertext body should differ
    expect(a).not.toBe(b);
  });
});
