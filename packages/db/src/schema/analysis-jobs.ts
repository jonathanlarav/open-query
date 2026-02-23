import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import { connections } from './connections';

export const analysisJobs = sqliteTable(
  'analysis_jobs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    status: text('status', {
      enum: ['pending', 'running', 'completed', 'failed'],
    })
      .notNull()
      .default('pending'),
    progressPercent: integer('progress_percent').notNull().default(0),
    currentStep: text('current_step'),
    totalTables: integer('total_tables').notNull().default(0),
    processedTables: integer('processed_tables').notNull().default(0),
    error: text('error'),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    connectionCreatedAtIdx: index('analysis_jobs_connection_created_at_idx').on(
      table.connectionId,
      table.createdAt
    ),
  })
);

export type SelectAnalysisJob = typeof analysisJobs.$inferSelect;
export type InsertAnalysisJob = typeof analysisJobs.$inferInsert;
