import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import { connections } from './connections';

export const queryLog = sqliteTable(
  'query_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'),
    query: text('query').notNull(),
    rowCount: integer('row_count'),
    executionTimeMs: integer('execution_time_ms'),
    error: text('error'),
    executedAt: integer('executed_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    connectionExecutedAtIdx: index('query_log_connection_executed_at_idx').on(
      table.connectionId,
      table.executedAt
    ),
  })
);

export type SelectQueryLog = typeof queryLog.$inferSelect;
export type InsertQueryLog = typeof queryLog.$inferInsert;
