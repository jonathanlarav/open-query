import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

export const connections = sqliteTable('connections', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'postgres' | 'mysql' | 'sqlite' | 'mongodb'
  encryptedCredentials: text('encrypted_credentials').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  lastConnectedAt: integer('last_connected_at', { mode: 'timestamp' }),
});

export type SelectConnection = typeof connections.$inferSelect;
export type InsertConnection = typeof connections.$inferInsert;
