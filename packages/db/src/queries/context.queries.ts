import { and, eq } from 'drizzle-orm';
import type { Database } from '../client';
import {
  tableContext,
  columnContext,
  type InsertTableContext,
  type InsertColumnContext,
  type SelectTableContext,
  type SelectColumnContext,
} from '../schema/index';

// Table context
export function findTableContexts(
  db: Database,
  connectionId: string
): SelectTableContext[] {
  return db
    .select()
    .from(tableContext)
    .where(eq(tableContext.connectionId, connectionId))
    .all();
}

export function findTableContext(
  db: Database,
  connectionId: string,
  tableName: string
): SelectTableContext | undefined {
  return db
    .select()
    .from(tableContext)
    .where(
      and(
        eq(tableContext.connectionId, connectionId),
        eq(tableContext.tableName, tableName)
      )
    )
    .get();
}

export function upsertTableContext(
  db: Database,
  data: InsertTableContext
): SelectTableContext {
  return db
    .insert(tableContext)
    .values(data)
    .onConflictDoUpdate({
      target: [tableContext.connectionId, tableContext.tableName],
      set: {
        description: data.description,
        businessPurpose: data.businessPurpose,
        isInferred: data.isInferred,
        updatedAt: new Date(),
      },
    })
    .returning()
    .get();
}

// Column context
export function findAllColumnContexts(
  db: Database,
  connectionId: string
): SelectColumnContext[] {
  return db
    .select()
    .from(columnContext)
    .where(eq(columnContext.connectionId, connectionId))
    .all();
}

export function findColumnContexts(
  db: Database,
  connectionId: string,
  tableName: string
): SelectColumnContext[] {
  return db
    .select()
    .from(columnContext)
    .where(
      and(
        eq(columnContext.connectionId, connectionId),
        eq(columnContext.tableName, tableName)
      )
    )
    .all();
}

export function upsertColumnContext(
  db: Database,
  data: InsertColumnContext
): SelectColumnContext {
  return db
    .insert(columnContext)
    .values(data)
    .onConflictDoUpdate({
      target: [columnContext.connectionId, columnContext.tableName, columnContext.columnName],
      set: {
        description: data.description,
        exampleValues: data.exampleValues,
        dataProfileJson: data.dataProfileJson,
        isInferred: data.isInferred,
        updatedAt: new Date(),
      },
    })
    .returning()
    .get();
}
