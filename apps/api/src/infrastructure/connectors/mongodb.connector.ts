import { MongoClient, ReadPreference } from 'mongodb';
import type { DatabaseConnector, TableSchema } from './types.js';
import type { QueryResult } from '@open-query/shared';
import type { MongoDBCredentials } from '@open-query/shared';

export class MongoDBConnector implements DatabaseConnector {
  private client: MongoClient;
  private database: string;

  constructor(credentials: MongoDBCredentials) {
    this.database = credentials.database;
    this.client = new MongoClient(credentials.uri, {
      readPreference: ReadPreference.SECONDARY_PREFERRED,
    });
  }

  async testConnection(): Promise<void> {
    await this.client.connect();
    await this.client.db(this.database).command({ ping: 1 });
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    // MongoDB uses aggregation pipeline via JSON, not SQL
    // sql here is expected to be a JSON string: { collection, pipeline }
    const start = Date.now();
    const { collection: collectionName, pipeline } = JSON.parse(sql) as {
      collection: string;
      pipeline: Record<string, unknown>[];
    };
    const db = this.client.db(this.database);
    const rows = await db
      .collection(collectionName)
      .aggregate(pipeline)
      .toArray() as Record<string, unknown>[];

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
    await this.client.connect();
    const db = this.client.db(this.database);
    const collections = await db.listCollections().toArray();
    const result: TableSchema[] = [];

    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      // Sample first doc to infer schema
      const sample = await db.collection(col.name).findOne();
      const columns = sample
        ? Object.entries(sample).map(([key, value]) => ({
            name: key,
            dataType: Array.isArray(value) ? 'array' : typeof value,
            isNullable: true,
            isPrimaryKey: key === '_id',
            isForeignKey: false,
            foreignKeyTable: null,
            foreignKeyColumn: null,
            defaultValue: null,
          }))
        : [];

      result.push({
        name: col.name,
        schema: this.database,
        rowCount: count,
        columns,
      });
    }

    return result;
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
