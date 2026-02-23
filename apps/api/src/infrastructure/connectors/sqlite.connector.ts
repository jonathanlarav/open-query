import BetterSqlite3 from 'better-sqlite3';
import type { DatabaseConnector, TableSchema } from './types.js';
import type { QueryResult } from '@open-query/shared';
import type { SQLiteCredentials } from '@open-query/shared';

export class SQLiteConnector implements DatabaseConnector {
  private db: BetterSqlite3.Database;

  constructor(credentials: SQLiteCredentials) {
    // readonly: true enforces read-only at driver level
    this.db = new BetterSqlite3(credentials.filePath, { readonly: true });
  }

  async testConnection(): Promise<void> {
    this.db.prepare('SELECT 1').get();
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    const start = Date.now();
    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as Record<string, unknown>[];
    const columns = rows.length > 0
      ? Object.keys(rows[0]!).map((name) => ({ name }))
      : [];

    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs: Date.now() - start,
    };
  }

  async scanSchema(): Promise<TableSchema[]> {
    const tables = this.db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type='table' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`
      )
      .all() as { name: string }[];

    const result: TableSchema[] = [];
    for (const table of tables) {
      const columns = this.db
        .prepare(`PRAGMA table_info("${table.name}")`)
        .all() as {
          name: string;
          type: string;
          notnull: number;
          dflt_value: string | null;
          pk: number;
        }[];

      const fkInfo = this.db
        .prepare(`PRAGMA foreign_key_list("${table.name}")`)
        .all() as { from: string; table: string; to: string }[];

      const rowCount = (
        this.db
          .prepare(`SELECT COUNT(*) as count FROM "${table.name}"`)
          .get() as { count: number }
      ).count;

      result.push({
        name: table.name,
        schema: null,
        rowCount,
        columns: columns.map((col) => {
          const fk = fkInfo.find((f) => f.from === col.name);
          return {
            name: col.name,
            dataType: col.type,
            isNullable: col.notnull === 0,
            isPrimaryKey: col.pk > 0,
            isForeignKey: Boolean(fk),
            foreignKeyTable: fk?.table ?? null,
            foreignKeyColumn: fk?.to ?? null,
            defaultValue: col.dflt_value,
          };
        }),
      });
    }

    return result;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
