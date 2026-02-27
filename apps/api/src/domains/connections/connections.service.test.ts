import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase, getDb } from '@open-query/db';
import { initMasterKey } from '../../infrastructure/crypto/key-manager.js';
import { ConnectionsService } from './connections.service.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCode } from '@open-query/shared';

// Initialize master key once — consistent across all tests in this file
initMasterKey('test-master-key-16-chars-minimum');

// Fresh in-memory DB for each test to prevent cross-test contamination
beforeEach(async () => {
  await initDatabase(':memory:');
});

function makeService() {
  return new ConnectionsService(getDb());
}

describe('ConnectionsService', () => {
  describe('create()', () => {
    it('inserts and returns connection with credentials stripped', () => {
      const svc = makeService();
      const result = svc.create({
        name: 'Test SQLite',
        type: 'sqlite',
        credentials: { filePath: '/tmp/test.db' },
      })!;

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test SQLite');
      expect(result.type).toBe('sqlite');
      expect((result as Record<string, unknown>)['encryptedCredentials']).toBeUndefined();
    });
  });

  describe('list()', () => {
    it('returns all connections without encryptedCredentials', () => {
      const svc = makeService();
      svc.create({ name: 'A', type: 'sqlite', credentials: { filePath: '/a.db' } });
      svc.create({ name: 'B', type: 'sqlite', credentials: { filePath: '/b.db' } });

      const list = svc.list();
      expect(list).toHaveLength(2);
      for (const conn of list) {
        expect((conn as Record<string, unknown>)['encryptedCredentials']).toBeUndefined();
      }
    });
  });

  describe('getById()', () => {
    it('returns the correct connection', () => {
      const svc = makeService();
      const created = svc.create({ name: 'Find Me', type: 'sqlite', credentials: { filePath: '/x.db' } })!;

      const found = svc.getById(created.id)!;
      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Find Me');
    });

    it('throws NOT_FOUND for missing id', () => {
      const svc = makeService();
      expect(() => svc.getById('nonexistent-id')).toThrow(AppError);
      try {
        svc.getById('nonexistent-id');
      } catch (err) {
        expect((err as AppError).code).toBe(ErrorCode.NOT_FOUND);
      }
    });
  });

  describe('delete()', () => {
    it('removes connection from the list', () => {
      const svc = makeService();
      const conn = svc.create({ name: 'Delete Me', type: 'sqlite', credentials: { filePath: '/del.db' } })!;

      svc.delete(conn.id);

      expect(svc.list()).toHaveLength(0);
      expect(() => svc.getById(conn.id)).toThrow(AppError);
    });
  });

  describe('getCredentials()', () => {
    it('decrypts and returns credentials', () => {
      const svc = makeService();
      const conn = svc.create({
        name: 'Creds Test',
        type: 'sqlite',
        credentials: { filePath: '/creds.db' },
      })!;

      const creds = svc.getCredentials(conn.id);
      expect(creds.type).toBe('sqlite');
      expect((creds.credentials as { filePath: string }).filePath).toBe('/creds.db');
    });
  });
});
