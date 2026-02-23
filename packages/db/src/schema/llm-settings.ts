import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const llmSettings = sqliteTable('llm_settings', {
  id: text('id').primaryKey().default('singleton'),
  provider: text('provider').notNull().default('anthropic'), // 'anthropic' | 'openai' | 'ollama'
  model: text('model').notNull().default('claude-sonnet-4-6'),
  encryptedApiKey: text('encrypted_api_key'), // null for ollama
  ollamaBaseUrl: text('ollama_base_url').default('http://localhost:11434'),
  maxTokens: integer('max_tokens').notNull().default(4096),
  temperature: integer('temperature').notNull().default(0), // stored as integer * 100 (0.0 = 0)
  chatHistoryLimit: integer('chat_history_limit').notNull().default(20),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type SelectLLMSettings = typeof llmSettings.$inferSelect;
export type InsertLLMSettings = typeof llmSettings.$inferInsert;
