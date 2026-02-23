import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import { connections } from './connections';

export const tableContext = sqliteTable(
  'table_context',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    schemaName: text('schema_name'),
    description: text('description'),
    businessPurpose: text('business_purpose'),
    isInferred: integer('is_inferred', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    uniqConnectionTable: uniqueIndex('table_context_connection_table_uniq').on(
      table.connectionId,
      table.tableName
    ),
  })
);

export type SelectTableContext = typeof tableContext.$inferSelect;
export type InsertTableContext = typeof tableContext.$inferInsert;
