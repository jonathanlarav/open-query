import { eq, desc, sql } from 'drizzle-orm';
import type { Database } from '../client';
import {
  chatSessions,
  chatMessages,
  type InsertChatSession,
  type InsertChatMessage,
  type SelectChatSession,
  type SelectChatMessage,
} from '../schema/index';

export function findAllSessions(db: Database): SelectChatSession[] {
  return db
    .select()
    .from(chatSessions)
    .orderBy(desc(chatSessions.updatedAt))
    .all();
}

export type SessionSummary = SelectChatSession & { messageCount: number };

export function findAllSessionsSummary(db: Database): SessionSummary[] {
  return db
    .select({
      id: chatSessions.id,
      connectionId: chatSessions.connectionId,
      title: chatSessions.title,
      createdAt: chatSessions.createdAt,
      updatedAt: chatSessions.updatedAt,
      messageCount: sql<number>`count(${chatMessages.id})`,
    })
    .from(chatSessions)
    .leftJoin(chatMessages, eq(chatMessages.sessionId, chatSessions.id))
    .groupBy(chatSessions.id)
    .orderBy(desc(chatSessions.updatedAt))
    .all();
}

export function touchSession(db: Database, id: string): void {
  db.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, id)).run();
}

export function findSessionById(
  db: Database,
  id: string
): SelectChatSession | undefined {
  return db.select().from(chatSessions).where(eq(chatSessions.id, id)).get();
}

export function insertSession(
  db: Database,
  data: InsertChatSession
): SelectChatSession {
  return db.insert(chatSessions).values(data).returning().get();
}

export function updateSessionTitle(
  db: Database,
  id: string,
  title: string
): SelectChatSession | undefined {
  return db
    .update(chatSessions)
    .set({ title, updatedAt: new Date() })
    .where(eq(chatSessions.id, id))
    .returning()
    .get();
}

export function deleteSession(db: Database, id: string): void {
  db.delete(chatSessions).where(eq(chatSessions.id, id)).run();
}

export function findMessagesBySession(
  db: Database,
  sessionId: string
): SelectChatMessage[] {
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt)
    .all();
}

export function insertMessage(
  db: Database,
  data: InsertChatMessage
): SelectChatMessage {
  return db.insert(chatMessages).values(data).returning().get();
}
