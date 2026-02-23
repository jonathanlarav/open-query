import { streamText, generateObject } from 'ai';
import { z } from 'zod';
import {
  findSettings,
  findAllSessions,
  findAllSessionsSummary,
  findSessionById,
  insertSession,
  updateSessionTitle,
  deleteSession,
  touchSession,
  findMessagesBySession,
  insertMessage,
  findLatestSnapshot,
  findTableContexts,
  findAllColumnContexts,
  findLatestAnalysisJob,
  findConnectionById,
  upsertColumnContext,
  upsertTableContext,
} from '@open-query/db';
import type { Database } from '@open-query/db';
import { getLanguageModel } from '../../infrastructure/llm/provider-factory.js';
import { buildSystemPrompt } from '../../infrastructure/llm/prompt-builder.js';
import { extractSQLBlocks, extractContextUpdates } from '../../infrastructure/llm/sql-extractor.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCode } from '@open-query/shared';
import type { TableInfo } from '@open-query/shared';
import type { CreateChatSessionInput } from '@open-query/shared';


interface StreamChatInput {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  sessionId: string;
  connectionId: string;
}

export class ChatService {
  constructor(private readonly db: Database) {}

  listSessions() {
    return findAllSessions(this.db);
  }

  listSessionsSummary() {
    return findAllSessionsSummary(this.db);
  }

  deleteSession(id: string) {
    this.getSession(id);
    deleteSession(this.db, id);
  }

  getSession(id: string) {
    const session = findSessionById(this.db, id);
    if (!session) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: `Chat session not found: ${id}`,
        statusCode: 404,
      });
    }
    return session;
  }

  createSession(input: CreateChatSessionInput) {
    return insertSession(this.db, {
      connectionId: input.connectionId,
      title: input.title,
    });
  }

  renameSession(id: string, title: string) {
    this.getSession(id);
    updateSessionTitle(this.db, id, title);
  }

  getMessages(sessionId: string) {
    return findMessagesBySession(this.db, sessionId);
  }

  async streamChat(input: StreamChatInput) {
    this.getSession(input.sessionId);

    const settings = findSettings(this.db);
    if (!settings) {
      throw new AppError({
        code: ErrorCode.LLM_ERROR,
        message: 'LLM settings not configured. Visit Settings to configure a provider.',
        statusCode: 400,
      });
    }

    // Load schema snapshot + business context for system prompt
    const snapshot = findLatestSnapshot(this.db, input.connectionId);
    const tables: TableInfo[] = snapshot
      ? (JSON.parse(snapshot.tablesJson) as TableInfo[])
      : [];

    const tableContexts = findTableContexts(this.db, input.connectionId);
    const columnContexts = findAllColumnContexts(this.db, input.connectionId);

    // Load analysis status to enrich the system prompt
    const job = findLatestAnalysisJob(this.db, input.connectionId);
    const analysisStatus = job
      ? {
          isComplete: job.status === 'completed',
          progressPercent: job.progressPercent,
          currentStep: job.currentStep ?? null,
          hasAnyContext: tableContexts.length > 0 || columnContexts.length > 0,
        }
      : undefined;

    const conn = findConnectionById(this.db, input.connectionId);
    const dbType = conn?.type;

    const systemPrompt = buildSystemPrompt(
      tables,
      { tableContexts, columnContexts },
      analysisStatus,
      dbType
    );

    const historyLimit = settings.chatHistoryLimit ?? 20;

    // useChat sends the full message history — filter out system messages, apply limit
    const messages = input.messages
      .filter((m) => m.role !== 'system')
      .slice(-historyLimit)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Persist the latest user message
    const lastUserMessage = [...input.messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      insertMessage(this.db, {
        sessionId: input.sessionId,
        role: 'user',
        content: lastUserMessage.content,
        sqlBlocksJson: '[]',
      });
    }

    const model = getLanguageModel(settings);
    const db = this.db;
    const connectionId = input.connectionId;

    const sessionId = input.sessionId;

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      maxTokens: settings.maxTokens,
      onFinish: async ({ text }) => {
        const sqlBlocks = extractSQLBlocks(text);
        insertMessage(db, {
          sessionId,
          role: 'assistant',
          content: text,
          sqlBlocksJson: JSON.stringify(sqlBlocks),
        });
        touchSession(db, sessionId);

        // Auto-title the session after the first exchange using the LLM
        const savedMessages = findMessagesBySession(db, sessionId);
        if (savedMessages.length === 2) {
          const firstUser = savedMessages.find((m) => m.role === 'user');
          const currentSession = findSessionById(db, sessionId);
          if (firstUser && currentSession?.title === 'New Chat') {
            try {
              const { object } = await generateObject({
                model,
                schema: z.object({
                  title: z.string().describe('4–7 word noun phrase summarising the topic of this chat session. No question words, no trailing punctuation.'),
                }),
                prompt: [
                  'Generate a short chat session title from this first user message.',
                  'Rules: 4–7 words, noun phrase, describes what the session is about (e.g. "Revenue trends by region"). No "can you", no question marks, no trailing punctuation.',
                  '',
                  `User message: ${firstUser.content}`,
                ].join('\n'),
              });
              updateSessionTitle(db, sessionId, object.title);
            } catch {
              // Leave as "New Chat" if generation fails
            }
          }
        }

        // Extract and persist any CONTEXT_UPDATE blocks from the response
        const contextUpdates = extractContextUpdates(text);
        for (const update of contextUpdates) {
          if (update.column) {
            upsertColumnContext(db, {
              connectionId,
              tableName: update.table,
              columnName: update.column,
              description: update.fact,
              isInferred: true,
            });
          } else {
            upsertTableContext(db, {
              connectionId,
              tableName: update.table,
              businessPurpose: update.fact,
              isInferred: true,
            });
          }
        }
      },
    });

    return result;
  }
}
