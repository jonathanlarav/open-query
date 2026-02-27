import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
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

  // Run migrations automatically. MIGRATIONS_PATH env var overrides the default
  // (used by the Electron app to point at bundled migrations).
  // When running from compiled dist/, migrations are at ../src/migrations.
  // When running directly from src/ (tsx/tests), they are at ./migrations.
  const defaultMigrations = __dirname.endsWith('dist')
    ? resolve(__dirname, '../src/migrations')
    : resolve(__dirname, './migrations');
  const migrationsFolder = process.env['MIGRATIONS_PATH'] ?? defaultMigrations;
  migrate(_db, { migrationsFolder });

  return _db;
}

export type Database = ReturnType<typeof drizzle<typeof schema>>;
