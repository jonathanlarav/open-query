import { desc, eq } from 'drizzle-orm';
import type { Database } from '../client';
import { queryLog, type InsertQueryLog, type SelectQueryLog } from '../schema/index';

export function insertQueryLog(
  db: Database,
  data: Omit<InsertQueryLog, 'id' | 'executedAt'>
): SelectQueryLog {
  return db.insert(queryLog).values(data).returning().get();
}

export function findRecentQueryLogs(
  db: Database,
  connectionId: string,
  limit = 20
): SelectQueryLog[] {
  return db
    .select()
    .from(queryLog)
    .where(eq(queryLog.connectionId, connectionId))
    .orderBy(desc(queryLog.executedAt))
    .limit(limit)
    .all();
}
