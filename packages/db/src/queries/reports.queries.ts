import { eq, isNotNull } from 'drizzle-orm';
import type { Database } from '../client';
import {
  reports,
  type InsertReport,
  type SelectReport,
} from '../schema/reports';

export function findAllReports(db: Database): SelectReport[] {
  return db.select().from(reports).all();
}

export function findReportsByConnection(
  db: Database,
  connectionId: string
): SelectReport[] {
  return db.select().from(reports).where(eq(reports.connectionId, connectionId)).all();
}

export function findReportsBySession(
  db: Database,
  sessionId: string
): SelectReport[] {
  return db.select().from(reports).where(eq(reports.sessionId, sessionId)).all();
}

export function findAllReportsWithSession(db: Database): SelectReport[] {
  return db.select().from(reports).where(isNotNull(reports.sessionId)).all();
}

export function findReportById(db: Database, id: string): SelectReport | undefined {
  return db.select().from(reports).where(eq(reports.id, id)).get();
}

export function insertReport(db: Database, data: InsertReport): SelectReport {
  return db.insert(reports).values(data).returning().get();
}

export function updateReport(
  db: Database,
  id: string,
  data: Partial<InsertReport>
): SelectReport | undefined {
  return db
    .update(reports)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(reports.id, id))
    .returning()
    .get();
}

export function deleteReport(db: Database, id: string): void {
  db.delete(reports).where(eq(reports.id, id)).run();
}

export function deleteReportsBySession(db: Database, sessionId: string): void {
  db.delete(reports).where(eq(reports.sessionId, sessionId)).run();
}
