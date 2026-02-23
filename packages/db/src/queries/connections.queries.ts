import { eq } from 'drizzle-orm';
import type { Database } from '../client';
import {
  connections,
  type InsertConnection,
  type SelectConnection,
} from '../schema/connections';

export function findAllConnections(db: Database): SelectConnection[] {
  return db.select().from(connections).all();
}

export function findConnectionById(
  db: Database,
  id: string
): SelectConnection | undefined {
  return db.select().from(connections).where(eq(connections.id, id)).get();
}

export function insertConnection(
  db: Database,
  data: InsertConnection
): SelectConnection {
  return db.insert(connections).values(data).returning().get();
}

export function updateConnection(
  db: Database,
  id: string,
  data: Partial<InsertConnection>
): SelectConnection | undefined {
  return db
    .update(connections)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(connections.id, id))
    .returning()
    .get();
}

export function deleteConnection(db: Database, id: string): void {
  db.delete(connections).where(eq(connections.id, id)).run();
}

export function updateLastConnected(db: Database, id: string): void {
  db.update(connections)
    .set({ lastConnectedAt: new Date(), updatedAt: new Date() })
    .where(eq(connections.id, id))
    .run();
}
