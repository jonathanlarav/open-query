import { desc, eq } from 'drizzle-orm';
import type { Database } from '../client';
import { analysisJobs, type SelectAnalysisJob, type InsertAnalysisJob } from '../schema/index';

export function insertAnalysisJob(
  db: Database,
  data: Omit<InsertAnalysisJob, 'id' | 'createdAt'>
): SelectAnalysisJob {
  return db.insert(analysisJobs).values(data).returning().get();
}

export function findLatestAnalysisJob(
  db: Database,
  connectionId: string
): SelectAnalysisJob | undefined {
  return db
    .select()
    .from(analysisJobs)
    .where(eq(analysisJobs.connectionId, connectionId))
    .orderBy(desc(analysisJobs.createdAt))
    .limit(1)
    .get();
}

export function updateAnalysisJob(
  db: Database,
  id: string,
  data: Partial<Omit<SelectAnalysisJob, 'id' | 'connectionId' | 'createdAt'>>
): SelectAnalysisJob | undefined {
  return db
    .update(analysisJobs)
    .set(data)
    .where(eq(analysisJobs.id, id))
    .returning()
    .get();
}
