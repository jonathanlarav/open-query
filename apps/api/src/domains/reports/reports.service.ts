import { z } from 'zod';
import {
  findAllReports,
  findAllReportsWithSession,
  findReportById,
  findReportsByConnection,
  findReportsBySession,
  insertReport,
  updateReport,
  deleteReport,
  deleteReportsBySession,
} from '@open-query/db';
import { findSessionById } from '@open-query/db';
import type { Database } from '@open-query/db';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCode } from '@open-query/shared';

export const CreateReportSchema = z.object({
  connectionId: z.string(),
  sessionId: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  sql: z.string().min(1),
  chartConfig: z
    .object({
      type: z.enum(['bar', 'line', 'pie', 'table']),
      xAxis: z.string().optional(),
      yAxis: z.string().optional(),
    })
    .optional(),
});

export type CreateReportInput = z.infer<typeof CreateReportSchema>;

export type ReportSession = {
  sessionId: string;
  sessionTitle: string;
  connectionId: string;
  pinCount: number;
  lastSavedAt: Date;
};

export class ReportsService {
  constructor(private readonly db: Database) {}

  list(connectionId?: string) {
    return connectionId
      ? findReportsByConnection(this.db, connectionId)
      : findAllReports(this.db);
  }

  listBySession(sessionId: string) {
    return findReportsBySession(this.db, sessionId);
  }

  listSessionsWithPins(): ReportSession[] {
    const reportsWithSession = findAllReportsWithSession(this.db);

    const grouped = new Map<string, typeof reportsWithSession>();
    for (const report of reportsWithSession) {
      const sid = report.sessionId!;
      if (!grouped.has(sid)) grouped.set(sid, []);
      grouped.get(sid)!.push(report);
    }

    const result: ReportSession[] = [];
    for (const [sessionId, pins] of grouped) {
      const session = findSessionById(this.db, sessionId);
      if (!session) continue;
      const firstPin = pins[0];
      if (!firstPin) continue;
      const lastSavedAt = pins.reduce<Date>((max, p) => {
        return p.createdAt > max ? p.createdAt : max;
      }, firstPin.createdAt);
      result.push({
        sessionId,
        sessionTitle: session.title,
        connectionId: session.connectionId,
        pinCount: pins.length,
        lastSavedAt,
      });
    }

    result.sort((a, b) => b.lastSavedAt.getTime() - a.lastSavedAt.getTime());
    return result;
  }

  getById(id: string) {
    const report = findReportById(this.db, id);
    if (!report) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: `Report not found: ${id}`,
        statusCode: 404,
      });
    }
    return report;
  }

  create(input: CreateReportInput) {
    return insertReport(this.db, {
      connectionId: input.connectionId,
      sessionId: input.sessionId,
      title: input.title,
      description: input.description,
      sql: input.sql,
      chartConfigJson: input.chartConfig ? JSON.stringify(input.chartConfig) : null,
    });
  }

  deleteBySession(sessionId: string): void {
    deleteReportsBySession(this.db, sessionId);
  }

  delete(id: string): void {
    const existing = findReportById(this.db, id);
    if (!existing) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: `Report not found: ${id}`,
        statusCode: 404,
      });
    }
    deleteReport(this.db, id);
  }
}
