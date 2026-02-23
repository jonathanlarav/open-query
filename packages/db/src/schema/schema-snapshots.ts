import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import { connections } from './connections';

export const schemaSnapshots = sqliteTable('schema_snapshots', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  connectionId: text('connection_id')
    .notNull()
    .references(() => connections.id, { onDelete: 'cascade' }),
  // JSON-serialized array of TableInfo
  tablesJson: text('tables_json').notNull().default('[]'),
  scannedAt: integer('scanned_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type SelectSchemaSnapshot = typeof schemaSnapshots.$inferSelect;
export type InsertSchemaSnapshot = typeof schemaSnapshots.$inferInsert;
