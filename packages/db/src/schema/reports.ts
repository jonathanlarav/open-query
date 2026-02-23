import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import { connections } from './connections';
import { chatSessions } from './chat-sessions';

export const reports = sqliteTable('reports', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  connectionId: text('connection_id')
    .notNull()
    .references(() => connections.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').references(() => chatSessions.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  description: text('description'),
  sql: text('sql').notNull(),
  // JSON: { type: 'bar' | 'line' | 'pie' | 'table', config: {...} }
  chartConfigJson: text('chart_config_json'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type SelectReport = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;
