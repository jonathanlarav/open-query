import { eq } from 'drizzle-orm';
import type { Database } from '../client';
import {
  schemaSnapshots,
  type InsertSchemaSnapshot,
  type SelectSchemaSnapshot,
} from '../schema/schema-snapshots';

export function findLatestSnapshot(
  db: Database,
  connectionId: string
): SelectSchemaSnapshot | undefined {
  return db
    .select()
    .from(schemaSnapshots)
    .where(eq(schemaSnapshots.connectionId, connectionId))
    .orderBy(schemaSnapshots.scannedAt)
    .get();
}

export function findSnapshotById(
  db: Database,
  id: string
): SelectSchemaSnapshot | undefined {
  return db.select().from(schemaSnapshots).where(eq(schemaSnapshots.id, id)).get();
}

export function insertSnapshot(
  db: Database,
  data: InsertSchemaSnapshot
): SelectSchemaSnapshot {
  return db.insert(schemaSnapshots).values(data).returning().get();
}

export function deleteSnapshotsForConnection(db: Database, connectionId: string): void {
  db.delete(schemaSnapshots)
    .where(eq(schemaSnapshots.connectionId, connectionId))
    .run();
}
