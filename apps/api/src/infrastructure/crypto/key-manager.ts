import { createHash } from 'node:crypto';

let _masterKey: Buffer | null = null;

export function initMasterKey(rawKey: string): void {
  if (!rawKey || rawKey.length < 16) {
    throw new Error('MASTER_KEY must be at least 16 characters');
  }
  // Derive a consistent 32-byte key using SHA-256
  _masterKey = createHash('sha256').update(rawKey).digest();
}

export function getMasterKey(): Buffer {
  if (!_masterKey) {
    throw new Error('Master key not initialized. Call initMasterKey() first.');
  }
  return _masterKey;
}
