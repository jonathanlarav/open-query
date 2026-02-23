import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getMasterKey } from './key-manager.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCode } from '@open-query/shared';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns base64-encoded: iv (12) + authTag (16) + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypts a base64-encoded ciphertext produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
  try {
    const key = getMasterKey();
    const data = Buffer.from(ciphertext, 'base64');

    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return decipher.update(encrypted) + decipher.final('utf8');
  } catch (err) {
    throw new AppError({
      code: ErrorCode.ENCRYPTION_ERROR,
      message: 'Failed to decrypt credentials',
      statusCode: 500,
      cause: err,
    });
  }
}
