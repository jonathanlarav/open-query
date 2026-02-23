import { findConnectionById, getDb } from '@open-query/db';
import {
  insertSnapshot,
  findLatestSnapshot,
  deleteSnapshotsForConnection,
} from '@open-query/db';
import type { Database } from '@open-query/db';
import { getConnector } from '../../infrastructure/connectors/factory.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCode } from '@open-query/shared';
import type { SchemaSnapshot } from '@open-query/shared';

export class SchemaService {
  constructor(private readonly db: Database) {}

  getSnapshot(connectionId: string): SchemaSnapshot | null {
    const row = findLatestSnapshot(this.db, connectionId);
    if (!row) return null;
    return {
      id: row.id,
      connectionId: row.connectionId,
      tables: JSON.parse(row.tablesJson) as SchemaSnapshot['tables'],
      scannedAt: row.scannedAt,
    };
  }

  async scan(connectionId: string) {
    const conn = findConnectionById(this.db, connectionId);
    if (!conn) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: `Connection not found: ${connectionId}`,
        statusCode: 404,
      });
    }

    const connector = getConnector(conn);
    try {
      const tables = await connector.scanSchema();
      // Delete old snapshots for this connection
      deleteSnapshotsForConnection(this.db, connectionId);
      const snapshot = insertSnapshot(this.db, {
        connectionId,
        tablesJson: JSON.stringify(tables),
        scannedAt: new Date(),
      });

      return {
        snapshotId: snapshot.id,
        tableCount: tables.length,
        scannedAt: snapshot.scannedAt,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError({
        code: ErrorCode.SCHEMA_SCAN_FAILED,
        message: err instanceof Error ? err.message : 'Schema scan failed',
        statusCode: 500,
        cause: err,
      });
    } finally {
      await connector.close();
    }
  }
}
