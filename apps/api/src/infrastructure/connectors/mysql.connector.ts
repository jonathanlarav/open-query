import mysql from 'mysql2/promise';
import type { DatabaseConnector, TableSchema } from './types.js';
import type { QueryResult } from '@open-query/shared';
import type { MySQLCredentials } from '@open-query/shared';

export class MySQLConnector implements DatabaseConnector {
  private pool: mysql.Pool;
  private database: string;

  constructor(credentials: MySQLCredentials) {
    this.database = credentials.database;
    this.pool = mysql.createPool({
      host: credentials.host,
      port: credentials.port,
      database: credentials.database,
      user: credentials.username,
      password: credentials.password,
      ssl: credentials.ssl ? { rejectUnauthorized: false } : undefined,
      connectionLimit: 5,
    });
  }

  async testConnection(): Promise<void> {
    const conn = await this.pool.getConnection();
    try {
      await conn.query('SELECT 1');
    } finally {
      conn.release();
    }
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    const conn = await this.pool.getConnection();
    const start = Date.now();
    try {
      await conn.query('SET SESSION TRANSACTION READ ONLY');
      const [rows, fields] = await conn.query(sql);
      const rowsArray = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
      return {
        columns: (fields ?? []).map((f) => ({ name: f.name, dataType: f.type?.toString() })),
        rows: rowsArray,
        rowCount: rowsArray.length,
        executionTimeMs: Date.now() - start,
      };
    } finally {
      conn.release();
    }
  }

  async scanSchema(): Promise<TableSchema[]> {
    const conn = await this.pool.getConnection();
    try {
      const [tables] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT TABLE_NAME as table_name, TABLE_ROWS as row_count
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
         ORDER BY TABLE_NAME`,
        [this.database]
      );

      const result: TableSchema[] = [];
      for (const table of tables) {
        const [columns] = await conn.query<mysql.RowDataPacket[]>(
          `SELECT
            COLUMN_NAME as column_name,
            DATA_TYPE as data_type,
            IS_NULLABLE as is_nullable,
            COLUMN_DEFAULT as column_default,
            COLUMN_KEY as column_key
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
           ORDER BY ORDINAL_POSITION`,
          [this.database, table['table_name']]
        );

        result.push({
          name: String(table['table_name']),
          schema: this.database,
          rowCount: table['row_count'] ? Number(table['row_count']) : null,
          columns: columns.map((col) => ({
            name: String(col['column_name']),
            dataType: String(col['data_type']),
            isNullable: col['is_nullable'] === 'YES',
            isPrimaryKey: col['column_key'] === 'PRI',
            isForeignKey: col['column_key'] === 'MUL',
            foreignKeyTable: null,
            foreignKeyColumn: null,
            defaultValue: col['column_default'] ? String(col['column_default']) : null,
          })),
        });
      }
      return result;
    } finally {
      conn.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
