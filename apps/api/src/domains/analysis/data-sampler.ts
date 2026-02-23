import type { DatabaseConnector, TableSchema, ColumnSchema } from '../../infrastructure/connectors/types.js';

export interface ColumnProfile {
  columnName: string;
  sampleValues: string[];
  distinctCount: number | null;
  nullRate: number | null;
  minValue: string | null;
  maxValue: string | null;
}

export interface TableProfile {
  tableName: string;
  rowCount: number;
  columns: ColumnProfile[];
}

const MAX_ROWS = 10_000_000;
const MAX_QUERIES_PER_TABLE = 10;
const DISTINCT_LIMIT = 20;

export class DataSampler {
  constructor(
    private readonly connector: DatabaseConnector,
    private readonly dbType: string
  ) {}

  async profileTable(table: TableSchema): Promise<TableProfile | null> {
    const rowCount = await this.verifyRowCount(table.name);
    if (rowCount === null || rowCount > MAX_ROWS) return null;

    const columns: ColumnProfile[] = [];
    let queryCount = 0;

    for (const col of table.columns) {
      if (queryCount >= MAX_QUERIES_PER_TABLE) break;
      try {
        const profile = await this.profileColumn(table.name, col, rowCount);
        if (profile) {
          columns.push(profile);
          queryCount++;
        }
      } catch {
        // non-fatal — missing data for one column never aborts the table
      }
    }

    return { tableName: table.name, rowCount, columns };
  }

  private async verifyRowCount(tableName: string): Promise<number | null> {
    try {
      if (this.dbType === 'mongodb') {
        const result = await this.connector.executeQuery(
          JSON.stringify({ collection: tableName, pipeline: [{ $count: 'count' }] })
        );
        return (result.rows[0]?.['count'] as number) ?? 0;
      }
      const q = this.quoteIdentifier(tableName);
      const result = await this.connector.executeQuery(`SELECT COUNT(*) AS cnt FROM ${q}`);
      const row = result.rows[0];
      const cnt = row?.['cnt'] ?? row?.['count'] ?? row?.['COUNT(*)'];
      return cnt !== undefined ? Number(cnt) : null;
    } catch {
      return null;
    }
  }

  private async profileColumn(
    tableName: string,
    col: ColumnSchema,
    rowCount: number
  ): Promise<ColumnProfile | null> {
    const kind = this.classifyColumn(col);
    if (kind === 'skip') return null;

    const profile: ColumnProfile = {
      columnName: col.name,
      sampleValues: [],
      distinctCount: null,
      nullRate: null,
      minValue: null,
      maxValue: null,
    };

    if (this.dbType === 'mongodb') {
      return this.profileMongoColumn(tableName, col.name, profile);
    }

    const tbl = this.quoteIdentifier(tableName);
    const c = this.quoteIdentifier(col.name);

    if (kind === 'categorical') {
      const result = await this.connector.executeQuery(
        `SELECT DISTINCT ${c} FROM ${tbl} WHERE ${c} IS NOT NULL LIMIT ${DISTINCT_LIMIT}`
      );
      profile.sampleValues = result.rows
        .map((r) => String(Object.values(r)[0] ?? ''))
        .filter(Boolean)
        .slice(0, 8);
      profile.distinctCount = result.rows.length;
    } else if (kind === 'numeric' || kind === 'date') {
      const result = await this.connector.executeQuery(
        `SELECT MIN(${c}) AS min_val, MAX(${c}) AS max_val FROM ${tbl}`
      );
      const row = result.rows[0];
      profile.minValue = row?.['min_val'] != null ? String(row['min_val']) : null;
      profile.maxValue = row?.['max_val'] != null ? String(row['max_val']) : null;
    }

    if (rowCount > 0) {
      const nullResult = await this.connector.executeQuery(
        `SELECT COUNT(*) AS null_cnt FROM ${tbl} WHERE ${c} IS NULL`
      );
      const row = nullResult.rows[0];
      const nullCount = Number(row?.['null_cnt'] ?? row?.['COUNT(*)'] ?? 0);
      profile.nullRate = nullCount / rowCount;
    }

    return profile;
  }

  private async profileMongoColumn(
    tableName: string,
    colName: string,
    profile: ColumnProfile
  ): Promise<ColumnProfile> {
    const result = await this.connector.executeQuery(
      JSON.stringify({
        collection: tableName,
        pipeline: [
          { $match: { [colName]: { $ne: null } } },
          { $group: { _id: `$${colName}` } },
          { $limit: DISTINCT_LIMIT },
        ],
      })
    );
    profile.sampleValues = result.rows
      .map((r) => String(r['_id'] ?? ''))
      .filter(Boolean)
      .slice(0, 8);
    profile.distinctCount = result.rows.length;
    return profile;
  }

  private classifyColumn(col: ColumnSchema): 'categorical' | 'numeric' | 'date' | 'text' | 'skip' {
    const type = col.dataType.toLowerCase();
    if (/int|float|decimal|numeric|double|real|number/.test(type)) return 'numeric';
    if (/date|time|timestamp/.test(type)) return 'date';
    if (/bool/.test(type)) return 'categorical';
    if (/char|varchar|enum|string/.test(type)) {
      const name = col.name.toLowerCase();
      if (/status|type|category|state|code|kind/.test(name)) return 'categorical';
      return 'text';
    }
    return 'skip';
  }

  private quoteIdentifier(name: string): string {
    return this.dbType === 'mysql' ? `\`${name}\`` : `"${name}"`;
  }
}
