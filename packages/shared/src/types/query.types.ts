import { z } from 'zod';

export const QueryResultSchema = z.object({
  columns: z.array(
    z.object({
      name: z.string(),
      dataType: z.string().optional(),
    })
  ),
  rows: z.array(z.record(z.unknown())),
  rowCount: z.number(),
  executionTimeMs: z.number(),
});

export type QueryResult = z.infer<typeof QueryResultSchema>;

export const ExecuteQueryInputSchema = z.object({
  sql: z.string().min(1),
  connectionId: z.string(),
  limit: z.number().int().positive().max(10000).default(1000),
});

export type ExecuteQueryInput = z.infer<typeof ExecuteQueryInputSchema>;
