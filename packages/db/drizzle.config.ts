import { defineConfig } from 'drizzle-kit';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Project root is 2 levels up from packages/db/
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../');

function resolveDbUrl(url: string): string {
  if (url.startsWith('file:./') || url.startsWith('file:../')) {
    return `file:${resolve(PROJECT_ROOT, url.slice('file:'.length))}`;
  }
  return url;
}

const databaseUrl = resolveDbUrl(process.env['DATABASE_URL'] ?? 'file:./data/openquery.db');

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
