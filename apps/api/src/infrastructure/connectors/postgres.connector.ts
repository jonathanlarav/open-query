import pg from 'pg';
import type { DatabaseConnector, TableSchema } from './types.js';
import type { QueryResult } from '@open-query/shared';
import type { PostgresCredentials } from '@open-query/shared';

const { Pool } = pg;

export class PostgresConnector implements DatabaseConnector {
  private pool: pg.Pool;

  constructor(credentials: PostgresCredentials) {
    this.pool = new Pool({
      host: credentials.host,
      port: credentials.port,
      database: credentials.database,
      user: credentials.username,
      password: credentials.password,
      ssl: credentials.ssl ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }

  async testConnection(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    const client = await this.pool.connect();
    const start = Date.now();
    try {
      // Enforce read-only at connection level
      await client.query('SET default_transaction_read_only = on');
      const result = await client.query(sql);
      return {
        columns: (result.fields ?? []).map((f) => ({ name: f.name, dataType: String(f.dataTypeID) })),
        rows: result.rows as Record<string, unknown>[],
        rowCount: result.rowCount ?? result.rows.length,
        executionTimeMs: Date.now() - start,
      };
    } finally {
      client.release();
    }
  }

  async scanSchema(): Promise<TableSchema[]> {
    const client = await this.pool.connect();
    try {
      // Get all user tables
      const tablesResult = await client.query<{ table_schema: string; table_name: string; row_count: string }>(`
        SELECT
          t.table_schema,
          t.table_name,
          s.n_live_tup AS row_count
        FROM information_schema.tables t
        LEFT JOIN pg_stat_user_tables s ON s.schemaname = t.table_schema AND s.relname = t.table_name
        WHERE t.table_type = 'BASE TABLE'
          AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY t.table_schema, t.table_name
      `);

      const tables: TableSchema[] = [];

      for (const row of tablesResult.rows) {
        const columnsResult = await client.query<{
          column_name: string;
          data_type: string;
          is_nullable: string;
          column_default: string | null;
          is_pk: boolean;
          is_fk: boolean;
          fk_table: string | null;
          fk_column: string | null;
        }>(`
          SELECT
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default,
            (kcu.column_name IS NOT NULL) AS is_pk,
            (fk.column_name IS NOT NULL) AS is_fk,
            ccu.table_name AS fk_table,
            ccu.column_name AS fk_column
          FROM information_schema.columns c
          LEFT JOIN information_schema.table_constraints tc
            ON tc.table_schema = c.table_schema
            AND tc.table_name = c.table_name
            AND tc.constraint_type = 'PRIMARY KEY'
          LEFT JOIN information_schema.key_column_usage kcu
            ON kcu.constraint_name = tc.constraint_name
            AND kcu.column_name = c.column_name
          LEFT JOIN information_schema.referential_constraints rc
            ON rc.constraint_schema = c.table_schema
          LEFT JOIN information_schema.key_column_usage fk
            ON fk.constraint_name = rc.constraint_name
            AND fk.column_name = c.column_name
          LEFT JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = rc.unique_constraint_name
          WHERE c.table_schema = $1 AND c.table_name = $2
          ORDER BY c.ordinal_position
        `, [row.table_schema, row.table_name]);

        tables.push({
          name: row.table_name,
          schema: row.table_schema,
          rowCount: row.row_count ? parseInt(row.row_count) : null,
          columns: columnsResult.rows.map((col) => ({
            name: col.column_name,
            dataType: col.data_type,
            isNullable: col.is_nullable === 'YES',
            isPrimaryKey: Boolean(col.is_pk),
            isForeignKey: Boolean(col.is_fk),
            foreignKeyTable: col.fk_table ?? null,
            foreignKeyColumn: col.fk_column ?? null,
            defaultValue: col.column_default ?? null,
          })),
        });
      }

      return tables;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
