import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import * as schema from './schema/index';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function createDatabaseClient(
  databaseUrl: string
): Promise<ReturnType<typeof drizzle<typeof schema>>> {
  // Strip file: prefix if present
  const filePath = databaseUrl.startsWith('file:') ? databaseUrl.slice(5) : databaseUrl;

  // Ensure the data directory exists
  await mkdir(dirname(filePath), { recursive: true });

  const sqlite = new Database(filePath);

  // Enable WAL mode for better concurrent read performance
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  return drizzle(sqlite, { schema });
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    throw new Error('Database client not initialized. Call initDatabase() first.');
  }
  return _db;
}

export async function initDatabase(
  databaseUrl: string
): Promise<ReturnType<typeof drizzle<typeof schema>>> {
  _db = await createDatabaseClient(databaseUrl);
  return _db;
}

export type Database = ReturnType<typeof drizzle<typeof schema>>;
