import { findConnectionById, insertQueryLog } from '@open-query/db';
import type { Database } from '@open-query/db';
import { getConnector } from '../../infrastructure/connectors/factory.js';
import { validateReadOnly } from '../../shared/utils/read-only-validator.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCode } from '@open-query/shared';
import type { ExecuteQueryInput, QueryResult } from '@open-query/shared';

const MAX_RESULT_ROWS = 10_000;

export class QueryService {
  constructor(private readonly db: Database) {}

  async executeQuery(input: ExecuteQueryInput): Promise<QueryResult> {
    const conn = findConnectionById(this.db, input.connectionId);
    if (!conn) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: `Connection not found: ${input.connectionId}`,
        statusCode: 404,
      });
    }

    // Security: validate before touching the database (db-type-aware)
    validateReadOnly(input.sql, conn.type);

    const connector = getConnector(conn);
    const start = Date.now();
    try {
      const limit = Math.min(input.limit ?? 1000, MAX_RESULT_ROWS);
      const sql = this.injectLimit(input.sql, limit, conn.type);
      const result = await connector.executeQuery(sql);

      insertQueryLog(this.db, {
        connectionId: input.connectionId,
        query: input.sql,
        rowCount: result.rowCount,
        executionTimeMs: Date.now() - start,
        error: null,
      });

      return result;
    } catch (err) {
      insertQueryLog(this.db, {
        connectionId: input.connectionId,
        query: input.sql,
        rowCount: null,
        executionTimeMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      await connector.close();
    }
  }

  private injectLimit(sql: string, limit: number, dbType: string): string {
    if (dbType === 'mongodb') return sql;
    const upperSql = sql.toUpperCase();
    if (upperSql.includes('LIMIT')) return sql;
    return `${sql.trimEnd()}\nLIMIT ${limit}`;
  }
}
