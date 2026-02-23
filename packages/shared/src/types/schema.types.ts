import { z } from 'zod';

export const ColumnInfoSchema = z.object({
  name: z.string(),
  dataType: z.string(),
  isNullable: z.boolean(),
  isPrimaryKey: z.boolean(),
  isForeignKey: z.boolean(),
  foreignKeyTable: z.string().nullable(),
  foreignKeyColumn: z.string().nullable(),
  defaultValue: z.string().nullable(),
});

export type ColumnInfo = z.infer<typeof ColumnInfoSchema>;

export const TableInfoSchema = z.object({
  name: z.string(),
  schema: z.string().nullable(),
  rowCount: z.number().nullable(),
  columns: z.array(ColumnInfoSchema),
});

export type TableInfo = z.infer<typeof TableInfoSchema>;

export const SchemaSnapshotSchema = z.object({
  id: z.string(),
  connectionId: z.string(),
  tables: z.array(TableInfoSchema),
  scannedAt: z.date(),
});

export type SchemaSnapshot = z.infer<typeof SchemaSnapshotSchema>;

export const ScanSchemaResponseSchema = z.object({
  snapshotId: z.string(),
  tableCount: z.number(),
  scannedAt: z.date(),
});

export type ScanSchemaResponse = z.infer<typeof ScanSchemaResponseSchema>;
