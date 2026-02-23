import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import { connections } from './connections';

export const columnContext = sqliteTable(
  'column_context',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    columnName: text('column_name').notNull(),
    description: text('description'),
    exampleValues: text('example_values'), // JSON array
    dataProfileJson: text('data_profile_json'), // JSON: { sampleValues, distinctCount, nullRate, minValue, maxValue }
    isInferred: integer('is_inferred', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    uniqConnectionTableColumn: uniqueIndex('column_context_connection_table_column_uniq').on(
      table.connectionId,
      table.tableName,
      table.columnName
    ),
  })
);

export type SelectColumnContext = typeof columnContext.$inferSelect;
export type InsertColumnContext = typeof columnContext.$inferInsert;
