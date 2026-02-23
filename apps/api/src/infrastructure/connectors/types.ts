import type { QueryResult } from '@open-query/shared';

/**
 * Core interface every database connector must implement.
 * All connectors are read-only by design.
 */
export interface DatabaseConnector {
  /** Test the connection — throws on failure */
  testConnection(): Promise<void>;

  /** Execute a validated SELECT query and return results */
  executeQuery(sql: string, params?: unknown[]): Promise<QueryResult>;

  /** Introspect the database and return table/column metadata */
  scanSchema(): Promise<TableSchema[]>;

  /** Release any connection pool resources */
  close(): Promise<void>;
}

export interface ColumnSchema {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyTable: string | null;
  foreignKeyColumn: string | null;
  defaultValue: string | null;
}

export interface TableSchema {
  name: string;
  schema: string | null;
  rowCount: number | null;
  columns: ColumnSchema[];
}
