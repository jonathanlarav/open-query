import {
  findAllConnections,
  findConnectionById,
  insertConnection,
  updateConnection,
  deleteConnection,
  updateLastConnected,
} from '@open-query/db';
import type { Database } from '@open-query/db';
import { encrypt, decrypt } from '../../infrastructure/crypto/encryption.js';
import { getConnector, getConnectorFromCredentials } from '../../infrastructure/connectors/factory.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCode } from '@open-query/shared';
import type { CreateConnectionInput, UpdateConnectionInput } from './connections.types.js';

export class ConnectionsService {
  constructor(private readonly db: Database) {}

  list() {
    return findAllConnections(this.db).map(this.stripCredentials);
  }

  getById(id: string) {
    const conn = findConnectionById(this.db, id);
    if (!conn) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: `Connection not found: ${id}`,
        statusCode: 404,
      });
    }
    return this.stripCredentials(conn);
  }

  getCredentials(id: string) {
    const conn = findConnectionById(this.db, id);
    if (!conn) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: `Connection not found: ${id}`,
        statusCode: 404,
      });
    }
    return JSON.parse(decrypt(conn.encryptedCredentials)) as {
      type: string;
      credentials: Record<string, unknown>;
    };
  }

  create(data: CreateConnectionInput) {
    const credentials = { type: data.type, credentials: data.credentials };
    const encryptedCredentials = encrypt(JSON.stringify(credentials));
    const row = insertConnection(this.db, {
      name: data.name,
      type: data.type,
      encryptedCredentials,
    });
    return this.stripCredentials(row);
  }

  update(id: string, data: UpdateConnectionInput) {
    const existing = findConnectionById(this.db, id);
    if (!existing) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: `Connection not found: ${id}`,
        statusCode: 404,
      });
    }

    // Build the fields to update
    const patch: Parameters<typeof updateConnection>[2] = {};
    if (data.name) patch.name = data.name;
    if (data.credentials) {
      // Preserve the existing type — credentials must match it
      const existing_ = JSON.parse(decrypt(existing.encryptedCredentials)) as { type: string };
      const newCreds = { type: existing_.type, credentials: data.credentials };
      patch.encryptedCredentials = encrypt(JSON.stringify(newCreds));
    }

    const updated = updateConnection(this.db, id, patch);
    if (!updated) {
      throw new AppError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to update connection',
        statusCode: 500,
      });
    }
    return this.stripCredentials(updated);
  }

  delete(id: string): void {
    const existing = findConnectionById(this.db, id);
    if (!existing) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: `Connection not found: ${id}`,
        statusCode: 404,
      });
    }
    deleteConnection(this.db, id);
  }

  async testConnection(id: string): Promise<void> {
    const conn = findConnectionById(this.db, id);
    if (!conn) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: `Connection not found: ${id}`,
        statusCode: 404,
      });
    }

    const connector = getConnector(conn);
    try {
      await connector.testConnection();
      updateLastConnected(this.db, id);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError({
        code: ErrorCode.CONNECTION_FAILED,
        message: err instanceof Error ? err.message : 'Connection test failed',
        statusCode: 400,
        cause: err,
      });
    } finally {
      await connector.close();
    }
  }

  async testRawCredentials(input: CreateConnectionInput): Promise<void> {
    const connector = getConnectorFromCredentials(input);
    try {
      await connector.testConnection();
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError({
        code: ErrorCode.CONNECTION_FAILED,
        message: err instanceof Error ? err.message : 'Connection test failed',
        statusCode: 400,
        cause: err,
      });
    } finally {
      await connector.close();
    }
  }

  // Never expose encrypted credentials in API responses
  private stripCredentials(conn: ReturnType<typeof findConnectionById>) {
    if (!conn) return conn;
    const { encryptedCredentials: _creds, ...rest } = conn;
    return rest;
  }
}
